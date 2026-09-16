# Markdown Toolkit

The official runtime *reference* plugin for Resrch. It exercises every runtime
extension point once, with no extra dependencies, so it doubles as the
copyable starting template for new runtime plugins:

- one palette **command** (`show_notification` action),
- one document **transform** (`apply_document_patch` with a full-document
  replacement),
- one **analyzer** (diagnostics + structured output),
- one script-rendered sidebar **panel** with plugin state,
- `Plugin.*` locale files for `en`, `zh-CN`, and `ja`,
- `workspace.read` and `kv` permission grants reviewed at activation.

## Layout

```
plugin.toml        manifest v2 (shell engine, contributions, permissions)
main.js            default-exports the panel View; answers queued invocations
locales/*.yml      flat locale files (Locale.* metadata + Plugin.* keys)
```

## Install

Package the directory and install it through the Extensions panel, or copy it
into an installed-plugins root:

```bash
rdev plugin package plugins/app.resrch.markdown-toolkit --out dist/
rdev plugin check   --manifest ../resrch-app/i18n.toml plugins/app.resrch.markdown-toolkit
```

The desktop app must be built with the `executable-plugins` feature (release
builds enable it by default through the `full` feature).

## Use as a template

1. copy the directory and rename the plugin id (reverse-DNS, owns your
   `Plugin.<id>.*` key namespace),
2. keep the contribution kinds you need and delete the rest — every
   `[[commands]]`/`[[transforms]]`/`[[analyzers]]`/`[[panels]]` entry requires
   the `[runtime]` section,
3. request the narrowest permissions that work; every host call is
   permission-checked per invocation and denials surface the structured
   `plugin.permission.denied` review flow,
4. run `rdev plugin check` before publishing.
