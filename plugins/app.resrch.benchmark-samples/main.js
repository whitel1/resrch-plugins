// Benchmark Samples — official benchmark-provider reference plugin.
//
// Mirrors the runtime reference plugin's shape (see
// app.resrch.markdown-toolkit): the module default-exports a `View` subclass
// the host mounts for the declared panel, and a serve loop pulls queued
// invocations. The provider contract is one command that answers with a
// `contribute_benchmark_results` action; the host runs that command on
// "Refresh providers" (and on the scheduled refresh) and lands the rows in
// the pending review queue as `external` results sourced to this plugin id.
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

const t = (key, fallback) => translate(key) ?? fallback;

/**
 * Curated sample rows. Values are widely-cited top-1 accuracies for landmark
 * ImageNet-1k papers (paper-reported or official reference checkpoints,
 * rounded to one decimal); the point of the sample is the contribution
 * pipeline, so every row lands `pending` and the user confirms before
 * anything enters a leaderboard. Papers resolve in the host by arXiv id
 * first, then DOI, then title.
 */
const SAMPLE_ROWS = [
  {
    arxiv_id: "1512.03385",
    title: "Deep Residual Learning for Image Recognition",
    benchmark: "ImageNet-1k",
    metric: "Top-1 accuracy",
    value: 76.1,
    method: "ResNet-50",
  },
  {
    arxiv_id: "1512.03385",
    title: "Deep Residual Learning for Image Recognition",
    benchmark: "ImageNet-1k",
    metric: "Top-1 accuracy",
    value: 77.4,
    method: "ResNet-101",
  },
  {
    arxiv_id: "1512.03385",
    title: "Deep Residual Learning for Image Recognition",
    benchmark: "ImageNet-1k",
    metric: "Top-1 accuracy",
    value: 78.3,
    method: "ResNet-152",
  },
  {
    arxiv_id: "2012.12877",
    title: "Training data-efficient image transformers & distillation through attention",
    benchmark: "ImageNet-1k",
    metric: "Top-1 accuracy",
    value: 81.8,
    method: "DeiT-Base",
  },
  {
    arxiv_id: "2010.11929",
    title: "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale",
    benchmark: "ImageNet-1k",
    metric: "Top-1 accuracy",
    value: 85.3,
    method: "ViT-L/16 (JFT)",
  },
];

export default class BenchmarkSamplesPanel extends View {
  /** @param {{ title?: string }} _props @param {AsyncContext} cx */
  init(_props, cx) {
    // Annotated where they are assigned rather than declared as class fields:
    // `View`'s constructor calls `init` from inside `super()`.
    this.handled = 0;
    this.lastInvocation = "—";
    this.lastError = null;
    this.serve(cx);
    log("info", "Benchmark Samples panel loaded");
  }

  /**
   * Pulls queued invocations and answers them until the plugin unloads.
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
      complete_invocation_failure("benchmark-samples", "plugin received a malformed request");
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
   * Handles one command invocation. The host's provider refresh runs this
   * command with `input.reason = "benchmark-provider-refresh"`, but palette
   * activation uses the same path, so both answer identically.
   *
   * @param {{ invocation?: { kind?: string } }} request
   */
  async dispatch(request) {
    const invocation = request.invocation ?? {};
    switch (invocation.kind) {
      case "command":
        return this.contributeSamples();
      default:
        log("warn", `Benchmark Samples ignored invocation kind ${invocation.kind}`);
        return { actions: [], output: null, diagnostics: [] };
    }
  }

  /**
   * Emits the sample rows as one benchmark contribution action. The host
   * bounds the row list, permission-checks `benchmark.contribute`, and lands
   * the rows `external` + `pending` with this plugin id as their source.
   */
  contributeSamples() {
    return {
      actions: [
        {
          kind: "contribute_benchmark_results",
          payload: { contribution: { rows: SAMPLE_ROWS } },
        },
      ],
      output: null,
      diagnostics: [],
    };
  }

  /** @param {Context} cx */
  render(cx) {
    const keyPrefix = "Plugin.app.resrch.benchmark-samples.panel";
    return v_flex()
      .gap(8)
      .p(12)
      .on_action(INVOCATION_ACTION, (_event, cx) => {
        const raw = pull_invocation();
        if (raw !== null && raw !== undefined) {
          void this.run(raw, cx);
        }
      })
      .child(this.line(t(`${keyPrefix}.overview`, "Benchmark Samples"), cx))
      .child(
        this.muted(
          `${t(`${keyPrefix}.rows_label`, "Contributes sample rows")}: ${SAMPLE_ROWS.length}`,
          cx,
        ),
      )
      .children(
        SAMPLE_ROWS.map((row) =>
          this.muted(`${row.method} · ${row.benchmark} · ${row.metric} = ${row.value}`, cx),
        ),
      )
      .child(
        this.muted(
          `${t(`${keyPrefix}.handled_label`, "Invocations handled")}: ${this.handled}`,
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
