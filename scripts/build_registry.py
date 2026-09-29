#!/usr/bin/env python3
"""Builds distributable packages and the registry catalog.

For every plugin under plugins/ this script:

1. runs `rdev plugin check` (contract, locale, and coverage validation),
2. reuses the committed `dist/<id>-<version>.rplugin` when that exact version
   is already pinned in the catalog, otherwise runs `rdev plugin package`
   to build it,
3. merges the result into `registry/index.json` following the
   `plugin-registry-index-v1` schema (schema_version 1, unique ids, `latest`
   mirrored from `versions`, newest first).

The catalog is append-only per plugin: previously published `versions` are
preserved, a new version must be strictly newer than the published latest,
and re-publishing a pinned version with changed content (sha256, byte size,
or `min_app_version`) fails the build — packages are immutable per
`(id, version)`, so any change means bumping the version. Entry metadata
(name, description, ...) refreshes from plugin.toml without a bump, and a
plugin removed from plugins/ is delisted with its artifacts pruned.

`--verify` skips the build and validates the committed catalog instead:
schema shape, ordering, `latest` mirroring, every pin matching the on-disk
artifact, and no orphan files in dist/.

The app-side marketplace fetches `registry/index.json` from the GitHub Pages
site this repository's CI deploys; `package` locations resolve relative to
the index URL, so `dist/<file>` ships next to it.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PLUGINS = REPO / "plugins"
DIST = REPO / "dist"
REGISTRY = REPO / "registry" / "index.json"

MANIFEST_VERSION = 2
INDEX_SCHEMA_VERSION = 1
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
OPTIONAL_ENTRY_FIELDS = ("description", "license", "homepage", "repository")


def manifest_args() -> list[str]:
    """Points locale/coverage checks at the product i18n manifest."""
    candidate = REPO.parent / "resrch-app" / "i18n.toml"
    if candidate.is_file():
        return ["--manifest", str(candidate)]
    return []


def run(command: list[str]) -> None:
    print("+", " ".join(str(part) for part in command))
    subprocess.run(command, check=True, cwd=REPO)


def load_manifest(plugin_dir: Path) -> dict:
    with open(plugin_dir / "plugin.toml", "rb") as fh:
        return tomllib.load(fh)


def pin(package_path: Path) -> dict:
    digest = hashlib.sha256(package_path.read_bytes()).hexdigest()
    return {"sha256": digest, "byte_size": package_path.stat().st_size}


def version_key(version: str) -> tuple[int, int, int]:
    return tuple(int(part) for part in version.split("."))  # type: ignore[return-value]


def load_previous_index() -> dict[str, dict]:
    """Returns {plugin id: catalog entry} from the committed catalog."""
    if not REGISTRY.is_file():
        return {}
    index = json.loads(REGISTRY.read_text())
    if index.get("schema_version") != INDEX_SCHEMA_VERSION:
        sys.exit(f"{REGISTRY}: unexpected schema_version {index.get('schema_version')!r}")
    previous: dict[str, dict] = {}
    for entry in index["plugins"]:
        if entry["id"] in previous:
            sys.exit(f"{REGISTRY}: duplicate plugin id {entry['id']}")
        previous[entry["id"]] = entry
    return previous


def rebuild_pinned(
    plugin_id: str, version: str, meta: dict, previous: dict, package_path: Path
) -> dict:
    """Re-publishes the already-pinned `version`: the committed artifact and
    manifest metadata must still match the pin exactly."""
    pinned = next(v for v in previous["versions"] if v["version"] == version)
    if version != previous["versions"][0]["version"]:
        sys.exit(
            f"{plugin_id}: cannot rebuild historical version {version}; restore "
            f"plugin.toml to {previous['versions'][0]['version']} or bump the version"
        )
    if not package_path.is_file():
        sys.exit(
            f"{plugin_id} {version}: pinned but {package_path} is missing — restore "
            "it from git (git checkout <rev> -- dist/) or bump the version"
        )
    actual = pin(package_path)
    if actual["sha256"] != pinned["sha256"] or actual["byte_size"] != pinned["byte_size"]:
        sys.exit(
            f"{plugin_id} {version}: dist artifact no longer matches the pinned "
            "sha256 — packages are immutable per (id, version); bump the version"
        )
    if meta.get("min_app_version") != pinned.get("min_app_version"):
        sys.exit(
            f"{plugin_id} {version}: min_app_version changed under a pinned "
            "version — bump the version"
        )
    return dict(pinned)


def build_entry(plugin_dir: Path, meta: dict, previous: dict | None) -> dict:
    plugin_id = meta["id"]
    version = meta["version"]
    if not VERSION_RE.match(version):
        sys.exit(f"{plugin_id}: version {version!r} is not plain X.Y.Z")

    run(["rdev", "plugin", "check", *manifest_args(), str(plugin_dir)])

    DIST.mkdir(exist_ok=True)
    package_path = DIST / f"{plugin_id}-{version}.rplugin"

    if previous is not None and any(v["version"] == version for v in previous["versions"]):
        version_entry = rebuild_pinned(plugin_id, version, meta, previous, package_path)
    else:
        if previous is not None:
            latest = previous["versions"][0]["version"]
            if version_key(version) <= version_key(latest):
                sys.exit(
                    f"{plugin_id}: version {version} is not newer than the "
                    f"published latest {latest}"
                )
        run(["rdev", "plugin", "package", str(plugin_dir), "--output", str(package_path)])
        version_entry = {
            "version": version,
            "package": f"dist/{package_path.name}",
            **pin(package_path),
            "manifest_version": MANIFEST_VERSION,
        }
        if "min_app_version" in meta:
            version_entry["min_app_version"] = meta["min_app_version"]

    entry = {
        "id": plugin_id,
        "name": meta["name"],
        "versions": [version_entry],
    }
    for optional in OPTIONAL_ENTRY_FIELDS:
        if optional in meta:
            entry[optional] = meta[optional]
    if previous is not None:
        entry["versions"].extend(v for v in previous["versions"] if v["version"] != version)
    entry["latest"] = version_entry
    return entry


def referenced_packages(entries: list[dict]) -> set[str]:
    return {v["package"] for entry in entries for v in entry["versions"]}


def prune_orphans(entries: list[dict]) -> None:
    if not DIST.is_dir():
        return
    referenced = referenced_packages(entries)
    for path in sorted(DIST.glob("*.rplugin")):
        if f"dist/{path.name}" not in referenced:
            print(f"pruned dist/{path.name} (not referenced by the catalog)")
            path.unlink()


def verify(entries: list[dict]) -> None:
    problems: list[str] = []
    seen: set[str] = set()
    for entry in entries:
        eid = entry.get("id", "<no id>")
        if eid in seen:
            problems.append(f"{eid}: duplicate id")
        seen.add(eid)
        for field in ("name", "versions", "latest"):
            if field not in entry:
                problems.append(f"{eid}: missing {field}")
        versions = entry.get("versions") or []
        if not versions:
            problems.append(f"{eid}: no versions")
        if versions and entry.get("latest") != versions[0]:
            problems.append(f"{eid}: latest does not mirror versions[0]")
        if len({v.get("version") for v in versions}) != len(versions):
            problems.append(f"{eid}: duplicate versions")
        keys = [version_key(v["version"]) for v in versions if VERSION_RE.match(str(v.get("version", "")))]
        if keys != sorted(keys, reverse=True):
            problems.append(f"{eid}: versions are not newest-first")

        for version_entry in versions:
            vid = version_entry.get("version", "?")
            if not VERSION_RE.match(str(vid)):
                problems.append(f"{eid}: bad version {vid!r}")
                continue
            for field in ("package", "sha256", "byte_size", "manifest_version"):
                if field not in version_entry:
                    problems.append(f"{eid} {vid}: missing {field}")
            if version_entry.get("manifest_version") != MANIFEST_VERSION:
                problems.append(f"{eid} {vid}: unexpected manifest_version")
            expected = f"dist/{eid}-{vid}.rplugin"
            if version_entry.get("package") != expected:
                problems.append(f"{eid} {vid}: package should be {expected}")
                continue
            path = REPO / expected
            if not path.is_file():
                problems.append(f"{expected}: missing artifact")
                continue
            actual = pin(path)
            if actual["sha256"] != version_entry.get("sha256") or actual["byte_size"] != version_entry.get("byte_size"):
                problems.append(f"{expected}: pin does not match the artifact")

    if DIST.is_dir():
        for path in sorted(DIST.glob("*.rplugin")):
            if f"dist/{path.name}" not in referenced_packages(entries):
                problems.append(f"dist/{path.name}: orphan artifact")

    if problems:
        for problem in problems:
            print(f"verify: {problem}", file=sys.stderr)
        sys.exit(1)
    print(f"verify: {len(entries)} entries, pins match, no orphans")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build and verify the plugin registry catalog."
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="validate the committed catalog and dist/ tree without building",
    )
    args = parser.parse_args()

    if args.verify:
        index = json.loads(REGISTRY.read_text())
        if index.get("schema_version") != INDEX_SCHEMA_VERSION:
            sys.exit(f"{REGISTRY}: unexpected schema_version {index.get('schema_version')!r}")
        verify(index["plugins"])
        return 0

    previous = load_previous_index()
    entries: list[dict] = []
    for plugin_dir in sorted(path for path in PLUGINS.iterdir() if path.is_dir()):
        if not (plugin_dir / "plugin.toml").exists():
            continue
        meta = load_manifest(plugin_dir)["plugin"]
        entries.append(build_entry(plugin_dir, meta, previous.get(meta["id"])))

    for plugin_id in sorted(set(previous) - {entry["id"] for entry in entries}):
        print(f"delisted {plugin_id} (no longer under plugins/)")

    REGISTRY.parent.mkdir(exist_ok=True)
    REGISTRY.write_text(
        json.dumps(
            {"schema_version": INDEX_SCHEMA_VERSION, "plugins": entries},
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )
    prune_orphans(entries)
    print(f"wrote {REGISTRY} with {len(entries)} plugin(s)")
    verify(entries)
    return 0


if __name__ == "__main__":
    sys.exit(main())
