# Authoring a Resrch plugin

This repository hosts plugin **content**. The normative contract — the
`plugin.toml` v2 schema, the shell guest API, the error envelope, and the
registry index schema — lives in the `resrch` repository under
`docs/plugins/`; read `plugin-guest-api.md` and `plugin-i18n-author-guide.md`
there before your first plugin.

## Quick start

```bash
rdev plugin new plugins/<your.plugin.id> --plugin-id <your.plugin.id>
# or start from the reference plugin:
cp -R plugins/app.resrch.markdown-toolkit plugins/<your.plugin.id>
```

## Manifest rules that fail CI

- `manifest_version` is exactly `2`; unknown fields anywhere are rejected.
- plugin ids are lowercase reverse-DNS with at least one dot, and the
  directory name must equal the id.
- runtime contributions (`[[commands]]`, `[[transforms]]`, `[[analyzers]]`,
  `[[panels]]`) require the `[runtime]` section with `engine = "shell"`.
- resource paths stay inside the plugin root; no absolute paths, no `..`.
- localization keys stay in the `Plugin.<your.plugin.id>.` namespace and must
  be defined in at least one contributed locale file.
- product language packs declare honest `coverage`; `complete` fails while
  any product key is missing, and `%{placeholder}` sets must match the
  product catalog exactly.

## Validation

```bash
scripts/check-all.sh            # every plugin
rdev plugin check --manifest ../resrch-app/i18n.toml plugins/<id>
```

## Publishing (official plugins)

```bash
python3 scripts/build_registry.py
```

regenerates `dist/*.rplugin` and `registry/index.json`. Publishing then
attaches the packages to a GitHub release for the catalog version; the
index's `package` field points at the release asset (or a catalog-relative
path for static hosting). Packages are immutable per `(id, version)` —
changing content means bumping the version.

## Community submissions

1. fork, add `plugins/<your.plugin.id>/`, keep the permissions minimal,
2. `scripts/check-all.sh` must pass in CI,
3. a maintainer reviews requested permissions and declared resources before
   merge; anything executing guest code gets a closer review than pure
   resource packs,
4. keep `plugin.toml` metadata accurate (`description`, `license`,
   `repository`); the registry index mirrors it verbatim.
