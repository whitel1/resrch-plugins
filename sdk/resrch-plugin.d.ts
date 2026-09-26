// Type surface for the vendored guest SDK (`resrch-plugin.js`) and the
// host-written shim it wraps (`resrch.session.js`). The normative shim
// contract is `docs/plugins/resrch-plugin-api.d.ts` in the resrch repository.

// --- host-written shim: resrch.session.js -----------------------------------

declare module "resrch.session.js" {
  /** Queued PluginRequest JSON document, or null when the queue is empty. */
  export function pull_invocation(): string | null;
  export function complete_invocation(label: string, response: string): void;
  export function complete_invocation_failure(label: string, message: string): void;
  export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";
  export function log(level: LogLevel, message: string): void;
  export function workspace_read_text(path: string): Promise<{ path: string; text: string }>;
  export function workspace_write_output(
    path: string,
    contents: string,
    overwrite?: boolean,
  ): Promise<{ path: string; bytes_written: number }>;
  export function http_fetch(
    url: string,
    method?: string,
    headers?: Record<string, string>,
    body?: string | null,
  ): Promise<{ status: number; headers: Record<string, string>; body: string }>;
  export function kv_get(key: string): Promise<{ value: string | null }>;
  export function kv_put(key: string, value: string): Promise<void>;
  export function search_query(
    query: string,
    limit?: number,
    scope?: string | null,
  ): Promise<{
    results: { title: string; snippet: string; source: string; path?: string; line?: number }[];
  }>;
  export function ai_invoke(operation: string, input: unknown): Promise<{ operation: string; output: unknown }>;
  export function secret_get(name: string): Promise<{ value: string | null }>;
  /** Resolves a `Plugin.*` key in the active locale; null when undefined. */
  export function translate(key: string): string | null;
  /** Read-only theme introspection: every offered base theme. */
  export function list_themes(): { name: string; mode: "light" | "dark" }[];
  /** Read-only theme introspection: the applied base theme. */
  export function current_theme(): { name: string; mode: "light" | "dark" } | null;
  /** Host API feature strings the running host implements. */
  export function api_features(): string[];
}

// --- vendored SDK: resrch-plugin.js -----------------------------------------

declare module "resrch-plugin.js" {
  import * as shim from "resrch.session.js";

  export const INVOCATION_WAKE_ACTION: "resrch.invoke";
  export const DEFAULT_POLL_INTERVAL_MS: number;

  /** Minimal PluginRequest shape plugins routinely inspect. */
  export interface PluginRequestLike {
    app_api_version: number;
    plugin_id: string;
    invocation?: { kind?: string; command_id?: string; transform_id?: string; analyzer_id?: string; panel_id?: string };
    context?: {
      workspace_id?: string;
      workspace_root?: string;
      active_document?: {
        doc_id?: string;
        title?: string;
        path?: string | null;
        doc_type?: string;
        is_modified?: boolean;
        content?: string;
        line_count?: number;
        character_count?: number;
      };
    };
  }

  export interface PluginResponseLike {
    actions?: Array<Record<string, unknown>>;
    output?: unknown;
    diagnostics?: Array<Record<string, unknown>>;
  }

  export interface PermissionRequestLike {
    permission_id?: string;
    items?: string[];
  }

  export class PluginHostError extends Error {
    constructor(message: string, envelope: Record<string, unknown> | null);
    envelope: Record<string, unknown>;
    code: string;
    category: string;
    recoveryAction: string | null;
    permissionRequest: PermissionRequestLike | null;
    readonly isPermissionDenied: boolean;
  }

  export function toHostError(error: unknown): PluginHostError;
  export function translateKey(key: string, fallback: string): string;
  export function makeTranslator(keyPrefix: string): (key: string, fallback: string) => string;
  export function supportedFeatures(): string[];
  export function supportsFeature(feature: string): boolean;
  /**
   * Lists the host's offered base themes; null when the host predates the
   * `theme_query` feature.
   */
  export function listThemes(): { name: string; mode: "light" | "dark" }[] | null;
  /**
   * The currently applied base theme; null on older hosts or before the
   * shell published its first snapshot.
   */
  export function currentTheme(): { name: string; mode: "light" | "dark" } | null;

  /**
   * Renders a host modal input dialog; resolves with the submitted text or
   * `null` on cancel (and when the host predates `request_input`). Requires
   * the `prompts.input` permission.
   */
  export function requestInput(request: {
    title: string;
    message: string;
    placeholder?: string;
    value?: string;
  }): Promise<string | null>;

  export interface InvocationStats {
    handled: number;
    lastInvocation: string | null;
    lastError: PluginHostError | null;
  }

  export type InvocationHandler = (
    request: PluginRequestLike,
    cx: unknown,
  ) => Promise<PluginResponseLike | void> | PluginResponseLike | void;

  export function runInvocation(
    raw: string,
    handler: InvocationHandler,
    cx?: { notify?: () => void } | null,
    stats?: InvocationStats,
  ): Promise<InvocationStats>;

  export function startInvocationLoop(
    cx: {
      spawn: (f: (cx: { sleep: (ms: number) => Promise<void>; notify?: () => void }) => Promise<void>) => void;
      sleep: (ms: number) => Promise<void>;
      notify?: () => void;
    },
    handler: InvocationHandler,
    options?: { pollIntervalMs?: number },
  ): InvocationStats;
}
