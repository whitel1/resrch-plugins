# Status Kit

Official reference plugin for the declarative **status bar** extension point
and the vendored guest SDK (`sdk/` in this repository).

The manifest declares one command and one status bar item:

- the item renders host-side (`text = "0"`, right-aligned) and dispatches
  `status-kit.tick` when clicked,
- the command increments a counter persisted in plugin kv storage, updates the
  item text with the `set_status_bar_item` response action, and surfaces a
  success notification,
- the sidebar panel is rendered by this plugin's script view through the SDK's
  invocation loop and shows the counter, invocation stats, and the host
  features the running host announced via `api_features()`.

`min_app_version` is `0.3.0`: the `status_bar_items` contribution ships through
the additive minor channel documented in
`docs/plugins/plugin-contract-versioning.md` of the `resrch` repository, and
older hosts reject this manifest fail-closed with an unknown-field error
instead of silently dropping the item.

## Layout

```
plugin.toml           # manifest: command + [[status_bar_items]] + panel
resrch-plugin.js      # vendored SDK (copy of sdk/resrch-plugin.js)
main.js               # SDK-driven panel view and the tick command handler
locales/              # en, zh-CN, ja
```
