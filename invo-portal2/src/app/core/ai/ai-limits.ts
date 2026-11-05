/**
 * Groq free-plan rate limits (RPM/RPD = requests per minute/day, TPM/TPD = tokens per minute/day; null = no limit
 * listed). One source for the limits table in the Content AI form and the usage bars on the plugin page.
 */
export interface ModelLimitRow {
  /** Shown in the table (may group several ids). */
  label: string;
  /** Model ids this row applies to. */
  ids: string[];
  rpm: number | null;
  rpd: number | null;
  tpm: number | null;
  tpd: number | null;
  /** Replaces the tokens/day cell when the limit isn't a token count (speech models). */
  tpdText?: string;
}

export const GROQ_LIMITS: ModelLimitRow[] = [
  { label: 'llama-3.1-8b-instant',            ids: ['llama-3.1-8b-instant'],            rpm: 30, rpd: 14_400, tpm: 6_000,  tpd: 500_000 },
  { label: 'llama-3.3-70b-versatile',         ids: ['llama-3.3-70b-versatile'],         rpm: 30, rpd: 1_000,  tpm: 12_000, tpd: 100_000 },
  { label: 'openai/gpt-oss-120b',             ids: ['openai/gpt-oss-120b'],             rpm: 30, rpd: 1_000,  tpm: 8_000,  tpd: 200_000 },
  { label: 'openai/gpt-oss-20b',              ids: ['openai/gpt-oss-20b'],              rpm: 30, rpd: 1_000,  tpm: 8_000,  tpd: 200_000 },
  { label: 'qwen/qwen3.8-27b',                ids: ['qwen/qwen3.8-27b'],                rpm: 30, rpd: 1_000,  tpm: 8_000,  tpd: 200_000 },
  { label: 'groq/compound, compound-mini',    ids: ['groq/compound', 'groq/compound-mini'], rpm: 30, rpd: 250, tpm: 70_000, tpd: null },
  { label: 'meta-llama/llama-prompt-guard-2', ids: ['meta-llama/llama-prompt-guard-2-22m', 'meta-llama/llama-prompt-guard-2-86m'], rpm: 30, rpd: 14_400, tpm: 15_000, tpd: 500_000 },
  { label: 'whisper-large-v3 / v3-turbo',     ids: ['whisper-large-v3', 'whisper-large-v3-turbo'], rpm: 20, rpd: 2_000, tpm: null, tpd: null, tpdText: '7.2K audio-sec/hr' },
];

/** The listed free-plan limits of a model id, or null for a model we have no figures for. */
export function limitsFor(model: string | null | undefined): ModelLimitRow | null {
  return GROQ_LIMITS.find(r => r.ids.includes(String(model ?? ''))) ?? null;
}
