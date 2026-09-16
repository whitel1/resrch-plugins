// Markdown Toolkit — a Resrch runtime plugin for the gpui-shell engine.
//
// The file the manifest's `runtime.module` names is evaluated once when the
// plugin is enabled. It must default-export a `View` subclass: the view the
// host mounts for the plugin's declared panel.
//
// Host capabilities arrive through the generated `resrch.session.js` shim,
// which the host writes next to this file at enable time and which binds
// every call to this plugin's session token. Every broker call is
// permission-checked against the grants the user reviewed; a denial rejects
// the promise with an Error whose message is a structured error envelope
// (see `crates/plugin/src/host/errors.rs` in the resrch repository).
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import {
  pull_invocation,
  complete_invocation,
  complete_invocation_failure,
  log,
  translate,
} from "./resrch.session.js";
/** @import { AsyncContext, Context } from "gpui-kit" */

/** The action the host dispatches as a wake hint when an invocation is queued. */
const INVOCATION_ACTION = "resrch.invoke";

/** Milliseconds between invocation polls; the wake hint above is only a hint. */
const POLL_INTERVAL_MS = 150;

/**
 * Resolves a `Plugin.*` localization key in the active locale.
 *
 * The host merges every enabled plugin's `[[resources.locales]]` files into
 * one registry; `translate` returns null for unknown keys so the inline
 * English fallbacks below keep the panel readable in uncontributed locales.
 *
 * @param {string} key
 * @param {string} fallback
 */
const t = (key, fallback) => translate(key) ?? fallback;

export default class MarkdownToolkitPanel extends View {
  /** @param {{ title?: string }} _props @param {AsyncContext} cx */
  init(_props, cx) {
    // Annotated where they are assigned rather than declared as class fields:
    // `View`'s constructor calls `init` from inside `super()`.
    this.handled = 0;
    this.lastInvocation = "—";
    this.lastError = null;
    this.serve(cx);
    log("info", "Markdown Toolkit panel loaded");
  }

  /**
   * Pulls queued invocations and answers them until the plugin unloads.
   *
   * The host queues one `PluginRequest` JSON document per invocation and
   * wakes this panel with the `resrch.invoke` action; the timer below is the
   * correctness backstop, so a missed wake hint is safe.
   *
   * @param {AsyncContext} cx
   */
  serve(cx) {
    cx.spawn(async (cx) => {
      while (true) {
        const raw = pull_invocation();
        if (raw !== null && raw !== undefined) {
          await this.run(raw, cx);
          continue;
        }
        await cx.sleep(POLL_INTERVAL_MS);
      }
    });
  }

  /**
   * Runs one invocation and reports the `PluginResponse` back to the host.
   *
   * @param {string} raw - The queued `PluginRequest` JSON document.
   * @param {Context} cx
   */
  async run(raw, cx) {
    let request;
    try {
      request = JSON.parse(raw);
    } catch {
      complete_invocation_failure("markdown-toolkit", "plugin received a malformed request");
      return;
    }
    const label = request.invocation?.kind ?? "unknown";
    try {
      const response = await this.dispatch(request);
      complete_invocation(label, JSON.stringify(response));
      this.handled += 1;
      this.lastInvocation = label;
      this.lastError = null;
    } catch (error) {
      complete_invocation_failure(label, error?.message ?? String(error));
      this.lastError = error?.message ?? String(error);
    }
    cx.notify();
  }

  /**
   * Handles one command, transform, or analyzer invocation.
   *
   * @param {{ invocation?: { kind?: string }, context?: { active_document?: { doc_id?: string, content?: string } } }} request
   */
  async dispatch(request) {
    const invocation = request.invocation ?? {};
    const document = request.context?.active_document;
    switch (invocation.kind) {
      case "command":
        return this.summarize(document);
      case "transform":
        return this.normalizeHeadings(document);
      case "analyze":
        return this.lintHeadings(document);
      default:
        log("warn", `Markdown Toolkit ignored invocation kind ${invocation.kind}`);
        return { actions: [], output: null, diagnostics: [] };
    }
  }

  /** @param {{ doc_id?: string, content?: string } | undefined} document */
  summarize(document) {
    const message = document
      ? `Summary preview: ${document.content.split("\n").slice(0, 3).join(" / ")}`
      : "No active document to summarize.";
    return {
      actions: [
        {
          kind: "show_notification",
          payload: { notification: { level: "info", message } },
        },
      ],
      output: null,
      diagnostics: [],
    };
  }

  /** @param {{ doc_id?: string, content?: string } | undefined} document */
  normalizeHeadings(document) {
    const actions = [];
    if (document) {
      const normalized = document.content
        .split("\n")
        .map((line) => (line.startsWith("# ") ? `## ${line.slice(2).trim()}` : line))
        .join("\n");
      actions.push({
        kind: "apply_document_patch",
        payload: {
          doc_id: document.doc_id,
          patch: {
            replacements: [{ target: { kind: "full_document" }, text: normalized }],
          },
        },
      });
    }
    return { actions, output: null, diagnostics: [] };
  }

  /** @param {{ content?: string } | undefined} document */
  lintHeadings(document) {
    const diagnostics = [];
    const headings = [];
    if (document) {
      document.content.split("\n").forEach((line, index) => {
        if (line.startsWith("# ")) {
          headings.push(line.slice(2).trim());
          diagnostics.push({
            severity: "warning",
            message: "Prefer ## headings in this example plugin.",
            range: {
              start: { line: index, character: 0 },
              end: { line: index, character: line.length },
            },
            source: "markdown-toolkit",
            code: "MDTK001",
          });
        }
      });
    }
    return {
      actions: [],
      output: { heading_count: headings.length, headings },
      diagnostics,
    };
  }

  /** @param {Context} cx */
  render(cx) {
    const keyPrefix = "Plugin.app.resrch.markdown-toolkit.panel";
    return v_flex()
      .gap(8)
      .p(12)
      .on_action(INVOCATION_ACTION, (_event, cx) => {
        const raw = pull_invocation();
        if (raw !== null && raw !== undefined) {
          void this.run(raw, cx);
        }
      })
      .child(this.line(t(`${keyPrefix}.overview`, "Markdown Toolkit"), cx))
      .child(this.muted(t(`${keyPrefix}.tagline`, "A gpui-shell runtime plugin."), cx))
      .child(
        this.line(
          `${t(`${keyPrefix}.handled_label`, "Invocations handled")}: ${this.handled}`,
          cx,
        ),
      )
      .child(
        this.muted(
          `${t(`${keyPrefix}.last_invocation_label`, "Last invocation")}: ${this.lastInvocation}`,
          cx,
        ),
      )
      .child(
        this.lastError === null
          ? this.muted(t(`${keyPrefix}.no_errors`, "No invocation errors."), cx)
          : this.muted(
              `${t(`${keyPrefix}.last_error_label`, "Last error")}: ${this.lastError}`,
              cx,
            ),
      )
      .child(
        div()
          .id("markdown-toolkit-ping")
          .px(10)
          .py(6)
          .rounded(6)
          .bg(cx.theme().colors.primary)
          .text_color(cx.theme().colors.primary_foreground)
          .on_click((_event, cx) => {
            log("info", "Markdown Toolkit ping");
            cx.notify();
          })
          .child(t(`${keyPrefix}.ping`, "Ping host log")),
      );
  }

  /** @param {string} text @param {Context} cx */
  line(text, cx) {
    return div().text_size(14).text_color(cx.theme().colors.foreground).child(text);
  }

  /** @param {string} text @param {Context} cx */
  muted(text, cx) {
    return div()
      .text_size(12)
      .text_color(cx.theme().colors.muted_foreground)
      .child(text);
  }
}
