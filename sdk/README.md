# Guest plugin SDK

`resrch-plugin.js` is a dependency-free ES module that wraps the
host-generated `resrch.session.js` shim with the plumbing every runtime plugin
otherwise copies by hand:

| Helper | Replaces |
| --- | --- |
| `startInvocationLoop(cx, handler, options?)` | the pull / dispatch / `complete_invocation` poll loop |
| `runInvocation(raw, handler, cx?, stats?)` | the per-invocation parse / dispatch / failure path (also used inside the `resrch.invoke` wake handler) |
| `PluginHostError` + `toHostError(error)` | decoding the `__resrch_plugin_error_v1__:` structured error envelope (`code`, `category`, `recoveryAction`, `permissionRequest`) |
| `makeTranslator(prefix)` / `translateKey(key, fallback)` | `Plugin.*` locale lookups with inline fallbacks |
| `supportedFeatures()` / `supportsFeature(name)` | the host's `api_features()` announcement (see the versioning doc in `resrch`) |
| `INVOCATION_WAKE_ACTION` | the GPUI action name the host dispatches as the advisory wake hint |

## Vendoring

There is no package registry step on purpose: plugins run in an offline
capability sandbox, so the SDK ships inside each plugin package.

1. copy `sdk/resrch-plugin.js` (and `sdk/resrch-plugin.d.ts` for type
   checking) into your plugin root, next to your entry module,
2. import from `"./resrch-plugin.js"`; the SDK resolves
   `"./resrch.session.js"` itself,
3. keep the copy in sync when the contract adds surface — `rdev plugin check`
   validates your manifest and locales, not your JS.

## Reference usage

`plugins/app.resrch.status-kit` is the official SDK-driven reference: a
manifest-declared status bar item whose command increments a persisted
counter, updates the item text through the `set_status_bar_item` action, and
renders a sidebar panel from the shared invocation stats.
