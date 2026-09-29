# Status Kit

Official reference plugin for the declarative **status bar** extension point
and the vendored guest SDK (`sdk/` in this repository).

The manifest declares two commands, one status bar item, and one setting:

- the item renders host-side (`text = "0"`, right-aligned) and dispatches
  `status-kit.tick` when clicked,
- `status-kit.tick` increments a counter persisted in plugin kv storage,
  updates the item text with the `set_status_bar_item` response action, and
  surfaces a success notification,
- `status-kit.set` demonstrates the round-trip `request_input` host call
  (`permissions.prompts.input`): the host renders an input dialog and the
  promise resolves with the submitted text — or `null` on cancel,
- the `notifications` setting under `[resources.settings]` shows up on the
  settings dialog's Plugins page and persists to the plugin settings file;
  guest-side reads of stored values ship with a future host call,
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
main.js               # SDK-driven panel view and the tick command handler
locales/              # en, zh-CN, ja
```

Runtime helpers (`startInvocationLoop`, `makeTranslator`,
`PluginHostError`, …) come from the host-generated `resrch.session.js`
shim — nothing is vendored into the package.
