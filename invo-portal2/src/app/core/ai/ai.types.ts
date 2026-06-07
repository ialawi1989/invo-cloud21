// ────────────────────────────────────────────────────────────────────
// Content AI — shared types for the company/employee settings and the
// streaming generate endpoint. Backend lives under `<backendUrl>ai/*`.
// The provider API key is NEVER returned to or stored on the client.
// ────────────────────────────────────────────────────────────────────

export type AiProviderId =
  | 'deepseek' | 'groq' | 'openai' | 'gemini' | 'openrouter' | 'custom';

/** One known provider preset from GET /ai/settings/providers. */
export interface AiProviderSpec {
  id:           string;
  label:        string;
  baseUrl:      string;
  defaultModel: string;
  keyHint:      string;
}

export interface AiProvidersResponse {
  providers: AiProviderSpec[];
  custom:    { id: string; label: string };
}

/** Company- or employee-level AI settings (GET/POST result). The key
 *  itself is never present — `apiKeySet` tells the UI one is stored. */
export interface AiSettings {
  enabled:   boolean;
  provider:  AiProviderId | null;
  baseUrl:   string;
  model:     string;
  apiKeySet: boolean;
}

/** Save payload. Omit `apiKey` (or send '') to PRESERVE the stored key. */
export interface AiSettingsPayload {
  provider:  AiProviderId | null;
  baseUrl?:  string;
  model?:    string;
  apiKey?:   string;
  enabled?:  boolean;
}

export type AiTask = 'rewrite' | 'improve' | 'summarize' | 'continue' | 'custom';

export interface AiGenerateRequest {
  task:     AiTask;
  prompt:   string;
  content?: string;
  /** Defaults to true (streaming). */
  stream?:  boolean;
}

/** Canonical backend error codes (in body.data.code or SSE error chunks). */
export type AiErrorCode =
  | 'INVALID_TASK' | 'INVALID_PROMPT' | 'INVALID_CONTENT' | 'EMPTY_REQUEST'
  | 'INPUT_TOO_LONG' | 'AI_NOT_CONFIGURED' | 'AI_UNAVAILABLE' | 'AI_AUTH_FAILED'
  | 'AI_INSUFFICIENT_BALANCE' | 'AI_RATE_LIMITED' | 'AI_BAD_REQUEST'
  | 'UPSTREAM_TIMEOUT' | 'UNKNOWN';

export class AiError extends Error {
  constructor(public code: AiErrorCode, message?: string, public retryAfter?: number) {
    super(message || code);
    this.name = 'AiError';
  }
}

/** Map a backend error code to the i18n key the UI shows. */
export function aiErrorI18nKey(code: AiErrorCode): string {
  switch (code) {
    case 'AI_NOT_CONFIGURED':       return 'PLUGINS.AI.ERR_NOT_CONFIGURED';
    case 'AI_UNAVAILABLE':          return 'PLUGINS.AI.ERR_UNAVAILABLE';
    case 'AI_AUTH_FAILED':          return 'PLUGINS.AI.ERR_AUTH_FAILED';
    case 'AI_INSUFFICIENT_BALANCE': return 'PLUGINS.AI.ERR_INSUFFICIENT_BALANCE';
    case 'AI_RATE_LIMITED':         return 'PLUGINS.AI.ERR_RATE_LIMITED';
    case 'AI_BAD_REQUEST':          return 'PLUGINS.AI.ERR_BAD_REQUEST';
    case 'INPUT_TOO_LONG':          return 'PLUGINS.AI.ERR_TOO_LONG';
    case 'UPSTREAM_TIMEOUT':        return 'PLUGINS.AI.ERR_TIMEOUT';
    default:                        return 'PLUGINS.AI.ERR_GENERIC';
  }
}

/** Total characters the backend accepts in one generate request. */
export const AI_MAX_INPUT = 8000;
