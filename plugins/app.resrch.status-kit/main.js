// Status Kit — the official reference plugin for the declarative status bar.
//
// The manifest declares the status bar item and its command; this module is
// the runtime side: a QuickJS (gpui-shell) panel that serves invocations
// through the vendored SDK (`resrch-plugin.js`, copied from
// `sdk/` in the resrch-plugins repository), persists the counter in plugin
// kv storage, and updates the status bar item text with the
// `set_status_bar_item` response action.
//
// Host capabilities arrive through the generated `resrch.session.js` shim,
// which binds every call to this plugin's session token. Host failures arrive
// as rejected promises whose message carries the structured error envelope;
// the SDK decodes them into `PluginHostError`.
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { pull_invocation } from "./resrch.session.js";
import { kv_get, kv_put, log } from "./resrch.session.js";
import {
  INVOCATION_WAKE_ACTION,
  makeTranslator,
  requestInput,
  runInvocation,
  startInvocationLoop,
  supportedFeatures,
} from "./resrch-plugin.js";
/** @import { AsyncContext, Context } from "gpui-kit" */

/** kv key holding the persisted counter value (kv is per-plugin). */
const COUNT_KEY = "counter";

/** The status bar item id declared in `plugin.toml`. */
const STATUS_BAR_ITEM_ID = "status-kit.counter";

const t = makeTranslator("Plugin.app.resrch.status-kit.");

export default class StatusKitPanel extends View {
  /** @param {{ title?: string }} _props @param {AsyncContext} cx */
  init(_props, cx) {
    // Annotated where they are assigned rather than declared as class fields:
    // `View`'s constructor calls `init` from inside `super()`.
    this.count = 0;
    this.features = supportedFeatures();
    this.stats = { handled: 0, lastInvocation: null, lastError: null };
    this.restoreCount(cx);
    // The SDK loop pulls queued invocations, runs `dispatch`, and completes
    // each one against the host; the wake handler below only shortcuts it.
    startInvocationLoop(cx, (request, loopCx) => this.dispatch(request, loopCx));
    log("info", "Status Kit panel loaded");
  }

  /** Restores the persisted counter; kv failures degrade to 0. @param {AsyncContext} cx */
  restoreCount(cx) {
    cx.spawn(async (cx) => {
      try {
        const { value } = await kv_get(COUNT_KEY);
        const parsed = value === null ? 0 : Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed !== this.count) {
          this.count = parsed;
          cx.notify();
        }
      } catch (error) {
        log("warn", `Status Kit could not restore its counter: ${error?.message ?? error}`);
      }
    });
  }

  /**
   * Handles one queued invocation. Only the declared command reaches here;
   * anything else answers with the empty response.
   *
   * @param {{ invocation?: { kind?: string, command_id?: string } }} request
   * @param {Context} cx
   */
  async dispatch(request, cx) {
    const invocation = request.invocation ?? {};
    if (invocation.kind !== "command") {
      log("warn", `Status Kit ignored invocation ${invocation.kind ?? "unknown"}`);
      return;
    }
    switch (invocation.command_id) {
      case "status-kit.tick":
        return this.tick(cx);
      case "status-kit.set":
        return this.setCounter();
      default:
        log("warn", `Status Kit ignored command ${invocation.command_id ?? "unknown"}`);
        return;
    }
  }

  /** Advances the counter and refreshes the status bar item. @param {Context} cx */
  async tick(cx) {
    this.count += 1;
    const count = this.count;
    try {
      await kv_put(COUNT_KEY, String(count));
    } catch (error) {
      // Persistence is best-effort: the status bar text still advances.
      log("warn", `Status Kit could not persist its counter: ${error?.message ?? error}`);
    }
    cx.notify();
    return this.counterResponse(count, t("notifications.ticked", `Counter advanced to ${count}.`));
  }

  /**
   * Round trip: the host renders an input dialog and the promise resolves
   * with the submitted text — `null` when the user cancels. Guest-side reads
   * of contributed settings values ship with a future host call.
   */
  async setCounter() {
    const raw = await requestInput({
      title: t("prompt.title", "Status Kit"),
      message: t("prompt.message", "Set the counter to a whole number."),
      placeholder: "0",
      value: String(this.count),
    });
    if (raw === null) {
      return;
    }
    const parsed = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(parsed)) {
      return {
        actions: [
          {
            kind: "show_notification",
            payload: {
              notification: {
                level: "warning",
                message: t("notifications.invalid", `"${raw}" is not a whole number.`),
              },
            },
          },
        ],
        output: null,
        diagnostics: [],
      };
    }
    this.count = parsed;
    try {
      await kv_put(COUNT_KEY, String(this.count));
    } catch (error) {
      log("warn", `Status Kit could not persist its counter: ${error?.message ?? error}`);
    }
    return this.counterResponse(
      this.count,
      t("notifications.set", `Counter set to ${this.count}.`),
    );
  }

  /** @param {number} count @param {string} message */
  counterResponse(count, message) {
    return {
      actions: [
        {
          kind: "set_status_bar_item",
          payload: {
            item: { id: STATUS_BAR_ITEM_ID, text: String(count) },
          },
        },
        {
          kind: "show_notification",
          payload: {
            notification: { level: "success", message },
          },
        },
      ],
      output: null,
      diagnostics: [],
    };
  }

  /** @param {Context} cx */
  render(cx) {
    return v_flex()
      .gap(8)
      .p(12)
      // Advisory wake hint from the host: drain one queued invocation now.
      .on_action(INVOCATION_WAKE_ACTION, (_event, cx) => {
        const raw = pull_invocation();
        if (raw !== null && raw !== undefined) {
          void runInvocation(raw, (request, wakeCx) => this.dispatch(request, wakeCx), cx, this.stats);
        }
      })
      .child(this.line(t("panel.counter_label", "Counter"), cx))
      .child(
        div()
          .id("status-kit-count")
          .text_size(22)
          .text_color(cx.theme().colors.foreground)
          .child(String(this.count)),
      )
      .child(this.muted(t("panel.tagline", "Click the status bar item to advance the counter."), cx))
      .child(
        this.muted(
          `${t("panel.handled_label", "Invocations handled")}: ${this.stats.handled}`,
          cx,
        ),
      )
      .child(
        this.muted(
          `${t("panel.features_label", "Host features")}: ${
            this.features.length > 0 ? this.features.join(", ") : t("panel.features_none", "none announced")
          }`,
          cx,
        ),
      )
      .child(
        this.stats.lastError === null
          ? this.muted(t("panel.no_errors", "No invocation errors."), cx)
          : this.muted(
              `${t("panel.last_error_label", "Last error")}: ${this.stats.lastError.code} (${this.stats.lastError.category})`,
              cx,
            ),
      );
  }

  /** @param {string} text @param {Context} cx */
  line(text, cx) {
    return div().text_size(14).text_color(cx.theme().colors.muted_foreground).child(text);
  }

  /** @param {string} text @param {Context} cx */
  muted(text, cx) {
    return div()
      .text_size(12)
      .text_color(cx.theme().colors.muted_foreground)
      .child(text);
  }
}
