// Editor reference for the host-generated session shim
// (`resrch.session.js`) that the app writes into every enabled plugin at
// enable time — plugins import it as `./resrch.session.js`. Since app 0.3.0
// the shim exports BOTH the raw host calls and the session SDK helpers, so
// plugins never vendor an SDK copy anymore (see docs/authoring.md).
//
// This file is a convenience copy for local IntelliSense only: the shim is
// host-generated and never ships inside a package. The normative contract is
// docs/plugins/resrch-plugin-api.d.ts in the resrch repository; keep this
// copy in sync with it when the surface changes.

declare module "resrch.session.js" {
  // --- raw host calls ---------------------------------------------------------

  /** Queued PluginRequest JSON document, or null when the queue is empty. */
  export function pull_invocation(): string | null;
  export function complete_invocation(label: string, response: string): void;
  export function complete_invocation_failure(label: string, message: string): void;

  export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";
  export function log(level: LogLevel, message: string): void;
  export function log_floor(): LogLevel | null;

  export interface HttpFetchResult {
    status: number;
    headers: Record<string, string>;
    /** Response body decoded as UTF-8 text. */
    body: string;
  }
  export function http_fetch(
    url: string,
    method?: string,
    headers?: Record<string, string>,
    body?: string | null,
  ): Promise<HttpFetchResult>;

  export function workspace_read_text(path: string): Promise<{ path: string; text: string }>;
  export function workspace_write_output(
    path: string,
    contents: string,
    overwrite?: boolean,
  ): Promise<{ path: string; bytes_written: number }>;

  export function kv_get(key: string): Promise<{ value: string | null }>;
  export function kv_put(key: string, value: string): Promise<{ ok: boolean }>;

  export interface SearchResult {
    title: string;
    snippet: string;
    source: string;
    path?: string;
    line?: number;
  }
  export function search_query(
    query: string,
    limit?: number | null,
    scope?: string | null,
  ): Promise<{ results: SearchResult[] }>;

  export function ai_invoke(
    operation: string,
    input: unknown,
  ): Promise<{ operation: string; output: unknown }>;
  export function secret_get(name: string): Promise<{ value: string | null }>;

  /**
   * Reads one of this plugin's own `[[contributes.settings]]` values by its
   * unqualified `key`; `value: null` means unset — apply the manifest
   * default yourself. Requires the `settings_read` host API feature.
   */
  export function settings_get(key: string): Promise<{ value: string | null }>;

  /** Modal input dialog; resolves the submitted text or null on cancel. */
  export function request_input(request: {
    title: string;
    message: string;
    placeholder?: string;
    value?: string;
  }): Promise<string | null>;

  /** Resolves a `Plugin.*` key in the active locale; null when undefined. */
  export function translate(key: string): string | null;

  /** Read-only theme introspection: every offered base theme. */
  export function list_themes(): { name: string; mode: "light" | "dark" }[];
  /** Read-only theme introspection: the applied base theme. */
  export function current_theme(): { name: string; mode: "light" | "dark" } | null;

  /** Host API feature strings the running host implements. */
  export function api_features(): string[];

  export interface LibraryItemSummary {
    paper_id: string;
    title: string;
    publication_year?: number;
    doi?: string;
    arxiv_id?: string;
    citation_key?: string;
  }
  export interface LibraryItemDetails extends LibraryItemSummary {
    item_type?: string;
    added_at?: string;
    author_names: string[];
    tag_names: string[];
    aliases: string[];
  }
  export interface LibraryAnnotation {
    annotation_id: string;
    kind: "highlight" | "note" | "bookmark" | "link";
    page?: number;
    content?: string;
    quote_text?: string;
  }
  export function library_search(
    query: string,
    limit?: number | null,
  ): Promise<{ items: LibraryItemSummary[] }>;
  export function library_get_item(item_id: string): Promise<{ item: LibraryItemDetails | null }>;
  export function library_list_annotations(
    document_id: string,
    limit?: number | null,
  ): Promise<{ annotations: LibraryAnnotation[] }>;
  export function library_annotation_upsert(request: unknown): Promise<unknown>;

  export function reader_context(): Promise<{
    available: boolean;
    document_id?: string;
    title?: string;
    content_kind?: string;
    page?: number;
    selection?: string;
  }>;

  // --- session SDK helpers (exported by the shim since app 0.3.0) -----------

  /** The GPUI action the host dispatches as the advisory invocation wake hint. */
  export const INVOCATION_WAKE_ACTION: "resrch.invoke";
  /** Default milliseconds between invocation polls when the queue is empty. */
  export const DEFAULT_POLL_INTERVAL_MS: number;

  /** Minimal PluginRequest shape plugins routinely inspect. */
  export interface PluginRequestLike {
    app_api_version: number;
    plugin_id: string;
    invocation?: {
      kind?: string;
      command_id?: string;
      transform_id?: string;
      analyzer_id?: string;
      panel_id?: string;
    };
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

  /** Minimal PluginResponse shape handlers return. */
  export interface PluginResponseLike {
    actions?: Array<Record<string, unknown>>;
    output?: unknown;
    diagnostics?: Array<Record<string, unknown>>;
  }

  /** Permission-review payload carried on permission denials. */
  export interface PermissionRequestLike {
    permission_id?: string;
    items?: string[];
  }

  /**
   * Structured failure raised by host calls: the decoded error envelope when
   * the host sent one, `code` "unknown" otherwise.
   */
  export class PluginHostError extends Error {
    constructor(message: string, envelope: Record<string, unknown> | null);
    envelope: Record<string, unknown>;
    code: string;
    category: string;
    recoveryAction: string | null;
    permissionRequest: PermissionRequestLike | null;
    readonly isPermissionDenied: boolean;
  }

  /** Normalizes anything thrown across the host boundary into PluginHostError. */
  export function toHostError(error: unknown): PluginHostError;
  /** Resolves one full `Plugin.*` key, falling back to `fallback`. */
  export function translateKey(key: string, fallback: string): string;
  /** Binds a translator to one `Plugin.<plugin-id>.` key prefix. */
  export function makeTranslator(keyPrefix: string): (key: string, fallback: string) => string;
  /** Host API features the running host implements; `[]` on older hosts. */
  export function supportedFeatures(): string[];
  export function supportsFeature(feature: string): boolean;
  /** Feature-gated `theme_query` wrappers; `null` on hosts without the feature. */
  export function listThemes(): { name: string; mode: "light" | "dark" }[] | null;
  export function currentTheme(): { name: string; mode: "light" | "dark" } | null;

  /**
   * Renders a host modal input dialog; resolves with the submitted text or
   * `null` on cancel (and when the host predates `request_input`). Requires
   * the `prompts.input` permission; denials reject as PluginHostError.
   */
  export function requestInput(request: {
    title: string;
    message: string;
    placeholder?: string;
    value?: string;
  }): Promise<string | null>;

  /** Live loop statistics returned by runInvocation / startInvocationLoop. */
  export interface InvocationStats {
    handled: number;
    lastInvocation: string | null;
    lastError: PluginHostError | null;
  }

  export type InvocationHandler = (
    request: PluginRequestLike,
    cx: unknown,
  ) => Promise<PluginResponseLike | void> | PluginResponseLike | void;

  /**
   * Pulls, dispatches, and completes one queued invocation; failures are
   * reported to the host and surfaced on `stats`, never rejected.
   */
  export function runInvocation(
    raw: string,
    handler: InvocationHandler,
    cx?: { notify?: () => void } | null,
    stats?: InvocationStats,
  ): Promise<InvocationStats>;

  /**
   * Starts the drain-the-queue loop for a panel view and returns live stats
   * for rendering; runs until the plugin unloads.
   */
  export function startInvocationLoop(
    cx: {
      spawn: (f: (cx: {
        sleep: (ms: number) => Promise<void>;
        notify?: () => void;
      }) => Promise<void>) => void;
      sleep: (ms: number) => Promise<void>;
      notify?: () => void;
    },
    handler: InvocationHandler,
    options?: { pollIntervalMs?: number },
  ): InvocationStats;
}
