// Resrch guest plugin SDK — vendored into each plugin package.
//
// Canonical source: `sdk/resrch-plugin.js` in the resrch-plugins repository
// (MIT). Copy this file next to your entry module; the host writes
// `resrch.session.js` beside it at enable time and this SDK wraps that shim
// with the pieces every runtime plugin otherwise re-implements: the
// invocation queue loop, structured host-error decoding, `Plugin.*`
// translation helpers, and host feature introspection.
//
// Contract references (resrch repository):
// - guest surface: docs/plugins/plugin-guest-api.md
// - error envelope: docs/plugins/plugin-guest-api.md ("Error envelope")
// - feature vocabulary: crates/plugin/src/features.rs

import {
  pull_invocation,
  complete_invocation,
  complete_invocation_failure,
  translate,
  api_features,
  request_input,
  list_themes,
  current_theme,
} from "./resrch.session.js";

/** Prefix carrying the versioned host error envelope on rejected promises. */
const ENVELOPE_PREFIX = "__resrch_plugin_error_v1__:";

/**
 * The GPUI action the host dispatches on the panel view as an advisory wake
 * hint when an invocation is queued. Register it in `render` with
 * `.on_action(INVOCATION_WAKE_ACTION, ...)` and call {@link runInvocation}
 * with the pulled request; the poll loop stays the correctness backstop.
 */
export const INVOCATION_WAKE_ACTION = "resrch.invoke";

/** Milliseconds between invocation polls when the queue stays empty. */
export const DEFAULT_POLL_INTERVAL_MS = 150;

/**
 * Structured failure raised by host calls. Wraps the versioned error envelope
 * when the host sends one; plain host failures degrade to `code` `unknown`.
 */
export class PluginHostError extends Error {
  /**
   * @param {string} message
   * @param {{ schema_version?: number, failure?: Record<string, unknown>, permission_request?: { permission_id?: string, items?: string[] } } | null} envelope
   */
  constructor(message, envelope) {
    super(message);
    this.name = "PluginHostError";
    /** @type {Record<string, unknown>} */
    this.envelope = envelope ?? {};
    /** Machine-readable failure code, e.g. `plugin.permission.denied`. */
    this.code = String(
      /** @type {{code?: unknown}} */ (envelope?.failure ?? {}).code ?? "unknown",
    );
    /** Failure category, e.g. `authorization`. */
    this.category = String(
      /** @type {{category?: unknown}} */ (envelope?.failure ?? {}).category ?? "unknown",
    );
    /** Recovery action advertised by the host, e.g. `plugin.permission.review`. */
    this.recoveryAction =
      /** @type {{recovery_action?: unknown}} */ (envelope?.failure ?? {}).recovery_action ?? null;
    /** Present on permission denials: `{permission_id, items}`. */
    this.permissionRequest = envelope?.permission_request ?? null;
  }

  /** @returns {boolean} true when the host denied a reviewed permission. */
  get isPermissionDenied() {
    return this.code === "plugin.permission.denied";
  }
}

/**
 * Normalizes anything thrown across the host boundary into a
 * {@link PluginHostError}; non-envelope errors pass through with their message.
 *
 * @param {unknown} error
 * @returns {PluginHostError}
 */
export function toHostError(error) {
  if (error instanceof PluginHostError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (!message.startsWith(ENVELOPE_PREFIX)) {
    return new PluginHostError(message, null);
  }
  try {
    const envelope = JSON.parse(message.slice(ENVELOPE_PREFIX.length));
    const failure = /** @type {{message?: unknown}} */ (envelope?.failure ?? {});
    return new PluginHostError(
      typeof failure.message === "string" && failure.message.length > 0
        ? failure.message
        : message,
      envelope,
    );
  } catch {
    return new PluginHostError(message, null);
  }
}

/**
 * Resolves one full `Plugin.*` key in the active locale, falling back to the
 * locale-independent string the host merges from every enabled plugin.
 *
 * @param {string} key
 * @param {string} fallback
 */
export function translateKey(key, fallback) {
  const resolved = translate(key);
  return resolved === null || resolved === undefined ? fallback : resolved;
}

/**
 * Binds a translator to one `Plugin.<plugin-id>.` key prefix.
 *
 * @param {string} keyPrefix e.g. `"Plugin.app.resrch.my-plugin."`
 * @returns {(key: string, fallback: string) => string}
 */
export function makeTranslator(keyPrefix) {
  return (key, fallback) => translateKey(`${keyPrefix}${key}`, fallback);
}

/**
 * Host API features the running host implements (additive-minor contract
 * channel). Returns an empty list when the host predates the announcement.
 *
 * @returns {string[]}
 */
export function supportedFeatures() {
  try {
    return api_features() ?? [];
  } catch {
    return [];
  }
}

/**
 * @param {string} feature
 * @returns {boolean}
 */
export function supportsFeature(feature) {
  return supportedFeatures().includes(feature);
}

/**
 * Lists the base themes the host currently offers (name + light/dark mode).
 * Requires the `theme_query` host feature; returns null on older hosts.
 *
 * @returns {{ name: string, mode: "light" | "dark" }[] | null}
 */
export function listThemes() {
  if (!supportsFeature("theme_query")) return null;
  try {
    return list_themes() ?? null;
  } catch {
    return null;
  }
}

/**
 * The theme the host currently has applied, or null on older hosts / before
 * the shell published its first snapshot. Requires the `theme_query` host
 * feature.
 *
 * @returns {{ name: string, mode: "light" | "dark" } | null}
 */
export function currentTheme() {
  if (!supportsFeature("theme_query")) return null;
  try {
    return current_theme() ?? null;
  } catch {
    return null;
  }
}

/**
 * Pulls, dispatches, and completes one queued invocation.
 *
 * `handler` receives the parsed `PluginRequest` and the ambient context and
 * returns a `PluginResponse`-shaped object (or `undefined` for the empty
 * response). Failures are reported to the host with
 * `complete_invocation_failure` and surfaced on the returned stats object —
 * they never reject into the poll loop.
 *
 * @param {string} raw The queued `PluginRequest` JSON document.
 * @param {(request: any, cx: any) => Promise<any> | any} handler
 * @param {{ notify?: () => void } | null} [cx] Context whose `notify()` re-renders panel state.
 * @param {{ handled?: number, lastInvocation?: string | null, lastError?: PluginHostError | null }} [stats]
 * @returns {Promise<{ handled: number, lastInvocation: string | null, lastError: PluginHostError | null }>}
 */
export async function runInvocation(raw, handler, cx, stats = {}) {
  const state = stats;
  let request;
  try {
    request = JSON.parse(raw);
  } catch {
    complete_invocation_failure("unknown", "plugin received a malformed request");
    return state;
  }
  const label = request?.invocation?.kind ?? "unknown";
  try {
    const response = await handler(request, cx);
    complete_invocation(
      label,
      JSON.stringify(response ?? { actions: [], output: null, diagnostics: [] }),
    );
    state.handled = (state.handled ?? 0) + 1;
    state.lastInvocation = label;
    state.lastError = null;
  } catch (error) {
    const hostError = toHostError(error);
    state.lastError = hostError;
    complete_invocation_failure(label, hostError.message);
  }
  cx?.notify?.();
  return state;
}

/**
 * Starts the drain-the-queue loop for a panel view and returns live stats for
 * rendering. The loop runs until the plugin unloads; the host's wake action
 * (see {@link INVOCATION_WAKE_ACTION}) is only a hint, so the interval is the
 * correctness backstop.
 *
 * @param {{ spawn: (f: (cx: any) => Promise<void>) => void, sleep: (ms: number) => Promise<void>, notify?: () => void }} cx
 * @param {(request: any, cx: any) => Promise<any> | any} handler
 * @param {{ pollIntervalMs?: number }} [options]
 * @returns {{ handled: number, lastInvocation: string | null, lastError: PluginHostError | null }}
 */
export function startInvocationLoop(cx, handler, options = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const stats = { handled: 0, lastInvocation: null, lastError: null };
  cx.spawn(async (loopCx) => {
    while (true) {
      let raw = null;
      try {
        raw = pull_invocation();
      } catch (error) {
        stats.lastError = toHostError(error);
      }
      if (raw !== null && raw !== undefined) {
        await runInvocation(raw, handler, loopCx, stats);
        continue;
      }
      await loopCx.sleep(pollIntervalMs);
    }
  });
  return stats;
}

/**
 * Asks the user for a text value through a host modal dialog and resolves
 * with the submitted text, or `null` when the user cancels. Requires the
 * `prompts.input` permission, the `request_input` host API feature, and a
 * prompt request within the presentation bounds (`title` <= 200,
 * `message`/`placeholder`/`value` <= 4096 characters). Untyped requests
 * resolve with `null` when the feature is missing so optional flows degrade.
 *
 * @param {{ title: string, message: string, placeholder?: string, value?: string }} request
 * @returns {Promise<string | null>}
 */
export async function requestInput(request) {
  if (!supportsFeature("request_input")) {
    return null;
  }
  try {
    const response = await request_input(request);
    return response?.value ?? null;
  } catch (error) {
    throw toHostError(error);
  }
}
