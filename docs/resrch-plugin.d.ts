// Type definitions for the host-generated `resrch.session.js` shim
// (manifest_version 2). Copy this file next to your plugin's entry module (or
// reference it with `/// <reference path="./resrch-plugin-api.d.ts" />`) so
// TypeScript editors can check the host surface without running the app.
//
// The shim is written by the Resrch host when a plugin is enabled and is
// bound to a per-plugin session token; plugin code imports it by relative
// path, exactly as `app.resrch.markdown-toolkit/main.js` in the
// `resrch-plugins` repository does:
//
//   import { pull_invocation, complete_invocation, log } from "./resrch.session.js";
//
// Capability calls (`workspace_read_text`, `http_fetch`, `kv_get`, ...) return
// envelope objects and reject with the structured error envelope string
// documented in `plugin-guest-api.md` when the host denies the call.

export type PluginLogLevel = "trace" | "debug" | "info" | "warn" | "error";

/** Serialized `PluginRequest` (see plugin-guest-api.md), or `null` when the queue is empty. */
export type PluginRequestJson = string;

/** Serialized `PluginResponse` (see plugin-guest-api.md). */
export type PluginResponseJson = string;

/** Arbitrary host-assigned label echoed back by `complete_invocation*`. */
export type InvocationLabel = string;

/** Pops the oldest queued invocation; the host wakes the panel when work arrives. */
export function pull_invocation(): PluginRequestJson | null;

/** Answers the in-flight invocation with a serialized `PluginResponse`. */
export function complete_invocation(
  label: InvocationLabel,
  response: PluginResponseJson,
): boolean;

/** A structured failure the plugin raises itself; `code` must be a well-formed
 * dotted code in the plugin namespace (`plugin.…`) and is host-validated. */
export interface PluginStructuredFailure {
  code: string;
  message: string;
}

/** Fails the in-flight invocation with a plain message, or with a structured
 * `{ code, message }` failure that the host validates and attributes to this
 * plugin in diagnostics. */
export function complete_invocation_failure(
  label: InvocationLabel,
  failure: string | PluginStructuredFailure,
): boolean;

export function log(level: PluginLogLevel, message: string): void;
export function log(
  level: PluginLogLevel,
  message: string,
  options: {
    /** Structured key/values rendered into the recorded line; clamped
     * host-side to the contract budget (16 entries, keys ≤ 64, values ≤ 200
     * characters — the contract crate's `log_request_bounds`). Requires the
     * `log_fields` host feature. */
    fields?: Record<string, string>;
    /** Attributes the line to this correlation id instead of the host's
     * in-flight invocation tracking; truncates at the shared correlation
     * budget (128 bytes). Requires the `log_fields` feature. */
    request_id?: string;
  },
): void;

/**
 * The per-plugin log floor the user configured (`"trace"` … `"error"`), or
 * `null` when no floor is set (everything passes). Read-only; the floor is
 * a user control, not a plugin setting. Requires the `log_floor` host
 * feature. Use it to skip building expensive debug lines that would be
 * dropped anyway.
 */
export function log_floor(): PluginLogLevel | null;

/**
 * Resolves the key against the merged plugin locale backend for the active
 * locale; returns `null` for unknown keys so the plugin can fall back.
 */
export function translate(key: string): string | null;

export function workspace_read_text(path: string): Promise<{ path: string; text: string }>;

export function workspace_write_output(
  path: string,
  contents: string,
  overwrite?: boolean,
): Promise<{ path: string; bytes_written: number }>;

export interface PluginHttpFetchResult {
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
): Promise<PluginHttpFetchResult>;

export function kv_get(key: string): Promise<{ value: string | null }>;

export function kv_put(key: string, value: string): Promise<{ ok: boolean }>;

export interface PluginSearchResult {
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
): Promise<{ results: PluginSearchResult[] }>;

export function ai_invoke(
  operation: string,
  input: unknown,
): Promise<{ operation: string; output: unknown }>;

export function secret_get(name: string): Promise<{ value: string | null }>;

/**
 * Reads one of this plugin's own `[[contributes.settings]]` values by its
 * unqualified `key` (the host namespaces it under `plugin.<id>`). Resolves
 * with `value: null` when the key has no stored value — apply the manifest
 * default yourself. Keys clamp at 512 characters, so an over-long key reads
 * as unset. Requires the `settings_read` host API feature.
 */
export function settings_get(key: string): Promise<{ value: string | null }>;

/**
 * Structured library item search (identity and citation metadata; no
 * document contents). Requires the `library.read` permission and the
 * `library_read` host API feature.
 */
export function library_search(
  query: string,
  limit?: number | null,
): Promise<{ items: LibraryItemSummary[] }>;

/**
 * Full item details by identifier (UUID or unambiguous prefix). A missing
 * item rejects. Same permission and feature as `library_search`.
 */
export function library_get_item(item_id: string): Promise<{ item: LibraryItemDetails | null }>;

/**
 * Annotations of one document, projected read-only (bounded count, text
 * bounds enforced by the host). Same permission and feature as
 * `library_search`.
 */
export function library_list_annotations(
  document_id: string,
  limit?: number | null,
): Promise<{ annotations: LibraryAnnotation[] }>;

/**
 * Read-only snapshot of the reader workspace: the currently open reader
 * document identity plus the live selection text. `available` is `false` when
 * no reader document is open. `page` is the 1-based PDF page when the surface
 * tracks one. `selection` is host-bounded to 4000 characters. Requires the
 * `reader.read` permission and the `reader_context` host API feature.
 */
export function reader_context(): Promise<{
  available: boolean;
  document_id?: string;
  title?: string;
  content_kind?: string;
  page?: number;
  selection?: string;
}>;

/**
 * The `input` payload a `[[search_providers]]` command receives when the
 * host's library search surface settles a query. Answer through
 * `complete_invocation` with `{ actions: [], output: { results: [...] } }`.
 * Requires the `search_providers` host API feature.
 */
export interface SearchProviderRequest {
  query: string;
  limit?: number;
}

export interface SearchProviderHit {
  title: string;
  year?: number;
  authors?: string[];
  snippet?: string;
  url?: string;
  item_id?: string;
  /** When present, the host offers one-click import through its DOI resolve pipeline. */
  doi?: string;
  /** Optional direct open-access PDF link (bounded to the 2,048-character
   * URL budget, like `url`). */
  pdf_url?: string;
}

/**
 * One bibliographic metadata record for `[[metadata_providers]]`. An empty
 * `title` means "not resolved". Requires the `metadata_providers` host API
 * feature.
 */
export interface ResolvedMetadata {
  title: string;
  author_names?: string[];
  publication_year?: number;
  publication_month?: number;
  doi?: string;
  arxiv_id?: string;
  venue_name?: string;
}

/**
 * The `input` payload a `[[metadata_providers]]` command receives when
 * built-in identifier resolution came up empty (`kind` is `doi` or
 * `arxiv_id`). Answer with `{ actions: [], output: { metadata } }`.
 */
export interface MetadataProviderRequest {
  kind: string;
  identifier: string;
}

/**
 * A library item context-menu entry (`[[item_menu_items]]`). When the user
 * right-clicks a library item, the host appends `title` and dispatches the
 * `command` invocation with `input` = `{ paper_ids: string[] }` (selected
 * items). Requires the `item_menu_items` host API feature. Panels accept
 * `placement = "right_panel"` behind the `right_panel_placement` feature.
 */
export interface ItemMenuItem {
  id: string;
  title: string;
}

/**
 * A library event delivered by the host through a `[[subscriptions]]`
 * entry. The event arrives as a `pull_invocation()` request whose
 * `invocation` is `{ kind: "event", subscription_id, event_kind }` and whose
 * `input` is one of the payload shapes below (tagged by `kind`). Answer it
 * with `complete_invocation` like any command request. Requires the
 * `event_subscriptions` host API feature and the matching
 * `permissions.events.subscribe` item.
 */
export type PluginEventPayload =
  | { kind: "library_paper_created"; paper_ids: string[] }
  | { kind: "library_paper_updated"; paper_ids: string[] }
  | { kind: "library_paper_deleted"; paper_ids: string[] }
  | {
      kind: "library_papers_imported";
      paper_ids: string[];
      import_source: string;
    }
  | { kind: "library_changed" }
  | {
      kind: "reader_feed_entry_import_updated";
      subscription_id: string;
      entry_id: string;
      status: "not_imported" | "queued" | "importing" | "imported" | "failed";
      linked_paper_id?: string;
    }
  | {
      /** This plugin's contributed settings changed. `keys` are the
       * plugin-local setting keys (without the `plugin.<id>` namespace)
       * whose stored values changed; the host only ever delivers a
       * plugin's own keys. */
      kind: "settings_plugin_changed";
      keys: string[];
    };

export interface PluginRequestInputRequest {
  /** Dialog title, at most 200 characters. */
  title: string;
  /** Prompt body, at most 4096 characters. */
  message: string;
  /** Empty-field placeholder, at most 200 characters. */
  placeholder?: string;
  /** Pre-filled value, at most 4096 characters. */
  value?: string;
}

/**
 * Renders a modal input dialog and resolves with the submitted text, or
 * `null` when the user cancels. Requires the `prompts.input` permission and
 * the `request_input` host API feature.
 */
export function request_input(
  request: PluginRequestInputRequest,
): Promise<{ value: string | null }>;

/**
 * Structured library item search. Requires the `library.read` permission and
 * the `library_read` host API feature.
 */
export interface LibraryItemSummary {
  paper_id: string;
  title: string;
  publication_year?: number;
  doi?: string;
  arxiv_id?: string;
  citation_key?: string;
}

/** Full item details for `library_get_item` (authors, tags, aliases). */
export interface LibraryItemDetails extends LibraryItemSummary {
  item_type?: string;
  added_at?: string;
  author_names: string[];
  tag_names: string[];
  aliases: string[];
}

/**
 * One annotation of a document, projected read-only. `page` is the 1-based
 * PDF page when the annotation anchors to a page.
 */
export interface LibraryAnnotation {
  annotation_id: string;
  kind: "highlight" | "note" | "bookmark" | "link";
  page?: number;
  content?: string;
  quote_text?: string;
}

/**
 * Creates a page-level note or bookmark. `page` is 1-based; `kind` must be
 * `note` or `bookmark`. The optional quote context is provenance that helps
 * the reader surface re-anchor the annotation later. Requires the
 * `annotations.write` permission and the `annotation_write` host API feature.
 */
export function library_annotation_upsert(request: {
  document_id: string;
  kind: "note" | "bookmark";
  page: number;
  content?: string;
  quote_text?: string;
  quote_prefix?: string;
  quote_suffix?: string;
}): Promise<{ annotation_id: string; version?: number }>;

/**
 * Host API feature strings the running host implements (additive-minor
 * contract channel). The vocabulary lives in
 * `crates/plugin/src/features.rs` and is documented in `plugin-guest-api.md`.
 * Returns an empty list on hosts that predate the announcement.
 */
/** Read-only theme introspection: every base theme the host offers. */
export function list_themes(): { name: string; mode: "light" | "dark" }[];
/** Read-only theme introspection: the applied base theme, when known. */
export function current_theme(): { name: string; mode: "light" | "dark" } | null;
export function api_features(): string[];

// --- session SDK helpers (app 0.3.0+) ----------------------------------------
// Convenience layer exported by the same shim; see plugin-guest-api.md
// ("Session SDK helpers"). Plugins import these from ./resrch.session.js.

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
export interface PluginPermissionRequestLike {
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
  permissionRequest: PluginPermissionRequestLike | null;
  readonly isPermissionDenied: boolean;
}

/** Normalizes anything thrown across the host boundary into PluginHostError. */
export function toHostError(error: unknown): PluginHostError;
/** Resolves one full `Plugin.*` key, falling back to `fallback`. */
export function translateKey(key: string, fallback: string): string;
/** Binds a translator to one `Plugin.<plugin-id>.` key prefix. */
export function makeTranslator(
  keyPrefix: string,
): (key: string, fallback: string) => string;
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

/**
 * The per-plugin log floor (`"trace"` … `"error"`), or `null` when no floor
 * is set or the host predates `log_floor`. A null result means "assume it
 * logs".
 */
export function logFloor(): PluginLogLevel | null;
/**
 * Whether a `log(level, …)` call would currently survive the user's
 * per-plugin floor — the guard for skipping expensive debug formatting.
 * Returns `true` when the floor is unknown (older hosts, no floor).
 */
export function wouldLog(level: PluginLogLevel): boolean;
/**
 * The attributed console: routes `log`/`info`/`debug`/`warn`/`error` through
 * the session-attributed host log (identity, floor, invocation
 * attribution, flood caps) instead of the runtime's anonymous global
 * console. Import it to shadow the global in plugin modules; the global
 * itself is shared by every plugin and stays untouched.
 */
export const console: {
  debug: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/** Live loop statistics returned by runInvocation / startInvocationLoop. */
export interface PluginInvocationStats {
  handled: number;
  lastInvocation: string | null;
  lastError: PluginHostError | null;
}

export type PluginInvocationHandler = (
  request: PluginRequestLike,
  cx: unknown,
) => Promise<PluginResponseLike | void> | PluginResponseLike | void;

/**
 * Pulls, dispatches, and completes one queued invocation; failures are
 * reported to the host and surfaced on `stats`, never rejected.
 */
export function runInvocation(
  raw: string,
  handler: PluginInvocationHandler,
  cx?: { notify?: () => void } | null,
  stats?: PluginInvocationStats,
): Promise<PluginInvocationStats>;

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
  handler: PluginInvocationHandler,
  options?: { pollIntervalMs?: number },
): PluginInvocationStats;
