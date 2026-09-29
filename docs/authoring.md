# Authoring a Resrch plugin

This repository hosts plugin **content**. The normative contract — the
`plugin.toml` v2 schema, the shell guest API, the error envelope, and the
registry index schema — lives in the `resrch` repository under
`docs/plugins/`; read `plugin-guest-api.md`,
`plugin-contract-versioning.md` (how new surface is added inside v2 through
the additive minor channel), `plugin-i18n-author-guide.md`, and
`plugin-theme-author-guide.md` before your first plugin.

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
  `[[panels]]`, `[[status_bar_items]]`) require the `[runtime]` section with
  `engine = "shell"`.
- every `[[status_bar_items]]` entry must reference a `[[commands]]` id
  declared by the same manifest; `text` is the initial display text and the
  plugin updates it at runtime with the `set_status_bar_item` action
  (see the vendored SDK). Status bar items ship through the additive minor
  channel, so declare the introducing app release via `min_app_version`.
- `[permissions.prompts] input = true` gates the `request_input` round trip
  (SDK `requestInput`): the host renders an input dialog and the promise
  resolves with the submitted text, or `null` on cancel. Gate the call on
  `supportsFeature("request_input")`; the permission is reviewed at
  activation like every other group.
- `[[resources.settings]]` entries render on the settings dialog's Plugins
  page and persist to the plugin settings file. Known gap: there is no guest
  read of stored values yet (a future `settings_get` host call); keep
  settings that the plugin does not need to act on at runtime, or track both
  sides in kv until then.
- resource paths stay inside the plugin root; no absolute paths, no `..`.
- localization keys stay in the `Plugin.<your.plugin.id>.` namespace and must
  be defined in at least one contributed locale file.
- product language packs declare honest `coverage`; `complete` fails while
  any product key is missing, and `%{placeholder}` sets must match the
  product catalog exactly. `app.resrch.language-pack-zh-hant` is the
  complete-coverage exemplar; a pack split across several files is fine —
  coverage is validated over the merged locale.
- `[[resources.themes]]` names must be unique: names reserved by the product
  catalog (the bundled product themes plus the vendored upstream set) and
  names duplicated across the plugin's own theme documents fail the check —
  the host catalog rebuilds from the live document set on every sync, so a
  duplicate is reported as an error instead of loading. Light/dark variants
  pair by family suffix (`" My Family Light"`/`" My Family Dark"`);
  documents load per manifest declaration, and edits, renames, and
  disable/uninstall take effect without an app restart.
  `[[resources.theme_packs]]` documents are validated for version/roles/
  colors, and their ids cannot reuse the bundled pack ids (`Default Editor`,
  `High Contrast`). `[[resources.syntax_themes]]` ships syntax-only
  highlight sources through the additive minor channel (`syntax_themes`
  feature — pin `min_app_version`); ids cannot shadow the bundled
  `Resrch Minimal Syntax`. Runtime plugins can read the theme state with the
  `theme_query` host feature (SDK `listThemes()`/`currentTheme()`). Load
  results (registered, refreshed, shadowed names, failures) surface per
  plugin in the Extensions panel. Full rules and format reference:
  `plugin-theme-author-guide.md` in the `resrch` repository.

## The guest SDK

Do not hand-write the invocation poll loop or error decoding. Copy
`../sdk/resrch-plugin.js` into your plugin root and import from
`"./resrch-plugin.js"`: it wraps the host-written `resrch.session.js` shim
with `startInvocationLoop`, `runInvocation`, `PluginHostError`/`toHostError`
(structured error envelopes), `makeTranslator` for `Plugin.*` keys, and
`supportedFeatures()` for the host's `api_features()` announcement. See
`sdk/README.md`; `plugins/app.resrch.status-kit` is the reference consumer.

## Validation

```bash
scripts/check-all.sh            # every plugin
rdev plugin check --manifest ../resrch-app/i18n.toml plugins/<id>
```

## Publishing (official plugins)

```bash
python3 scripts/build_registry.py           # check, package, merge the index
python3 scripts/build_registry.py --verify  # validate pins against dist/
```

The catalog is append-only: committed `dist/*.rplugin` artifacts are reused
for already-pinned versions, a new version must be strictly newer than the
published latest, and any change under a pinned `(id, version)` — package
content or `min_app_version` — fails the build, so bump the version instead.
Entry metadata (name, description, …) refreshes without a bump. A push to
`main` deploys the index and packages to GitHub Pages, which is the default
source the in-app marketplace fetches.

## Community submissions

1. fork, add `plugins/<your.plugin.id>/`, keep the permissions minimal,
2. `scripts/check-all.sh` must pass in CI,
3. a maintainer reviews requested permissions and declared resources before
   merge; anything executing guest code gets a closer review than pure
   resource packs,
4. keep `plugin.toml` metadata accurate (`description`, `license`,
   `repository`); the registry index mirrors it verbatim.
