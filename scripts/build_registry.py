#!/usr/bin/env python3
"""Builds distributable packages and the registry catalog.

For every plugin under plugins/ this script:

1. runs `rdev plugin check` (contract, locale, and coverage validation),
2. runs `rdev plugin package` to emit `dist/<id>-<version>.rplugin`,
3. pins the package SHA-256 and byte size into `registry/index.json`
   following the `plugin-registry-index-v1` schema (schema_version 1,
   unique ids, `latest` mirrored into `versions`, newest first).

The catalog is the only thing an app-side marketplace client consumes; it
fetches `registry/index.json`, resolves `package` locations (here: relative
paths against the index URL that a release attachment mirrors), verifies the
digest, and hands the file to the existing install pipeline.
"""

from __future__ import annotations

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
    return {
        "sha256": digest,
        "byte_size": package_path.stat().st_size,
    }


def build_entry(plugin_dir: Path) -> dict:
    manifest = load_manifest(plugin_dir)
    meta = manifest["plugin"]
    plugin_id = meta["id"]
    version = meta["version"]

    run(["rdev", "plugin", "check", *manifest_args(), str(plugin_dir)])

    DIST.mkdir(exist_ok=True)
    package_path = DIST / f"{plugin_id}-{version}.rplugin"
    run(["rdev", "plugin", "package", str(plugin_dir), "--output", str(package_path)])

    pins = pin(package_path)
    version_entry = {
        "version": version,
        "package": f"dist/{package_path.name}",
        **pins,
        "manifest_version": MANIFEST_VERSION,
    }
    if "min_app_version" in meta:
        version_entry["min_app_version"] = meta["min_app_version"]

    entry = {
        "id": plugin_id,
        "name": meta["name"],
        "versions": [version_entry],
    }
    for optional in ("description", "license", "homepage", "repository"):
        if optional in meta:
            entry[optional] = meta[optional]
    entry["latest"] = version_entry
    return entry


def main() -> int:
    entries = []
    for plugin_dir in sorted(path for path in PLUGINS.iterdir() if path.is_dir()):
        if not (plugin_dir / "plugin.toml").exists():
            continue
        entries.append(build_entry(plugin_dir))

    index = {"schema_version": INDEX_SCHEMA_VERSION, "plugins": entries}
    REGISTRY.parent.mkdir(exist_ok=True)
    REGISTRY.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {REGISTRY} with {len(entries)} plugin(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
