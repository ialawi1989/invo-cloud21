import { Injectable, inject, signal } from '@angular/core';

import { AiService } from '../ai.service';
import { limitsFor } from '../ai-limits';
import { AiError, AiUsageSummary, AiUsageTotals } from '../ai.types';
import { AiDraftService } from './ai-draft.service';
import { AssistantToolbox } from './assistant-tools';
import { AssistantLink, ChatItem, WireMessage } from './assistant.types';

/** Model round-trips per question (each tool round counts once) — stops a model that keeps calling tools. */
const MAX_STEPS = 6;
/** Wire messages kept per request; the backend accepts 40. */
const MAX_WIRE = 30;
const MAX_TOOL_RESULT = 12_000;

/** Error code -> i18n key shown in the chat. */
const ERROR_KEYS: Record<string, string> = {
  AI_NOT_CONFIGURED: 'ASSISTANT.ERR_NOT_CONFIGURED',
  AI_AUTH_FAILED: 'ASSISTANT.ERR_AUTH_FAILED',
  AI_INSUFFICIENT_BALANCE: 'ASSISTANT.ERR_BALANCE',
  AI_RATE_LIMITED: 'ASSISTANT.ERR_RATE_LIMITED',
  AI_BAD_REQUEST: 'ASSISTANT.ERR_BAD_REQUEST',
  UPSTREAM_TIMEOUT: 'ASSISTANT.ERR_TIMEOUT',
};

/**
 * Drives the dashboard assistant: sends the conversation to `ai/chat`, runs the tools the model asks for through
 * {@link AssistantToolbox} (the portal's own authorized services), feeds the results back and repeats until the model
 * answers in text. The conversation lives in memory only and starts empty each session.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private ai = inject(AiService);
  private toolbox = inject(AssistantToolbox);
  private drafts = inject(AiDraftService);

  readonly items = signal<ChatItem[]>([]);
  readonly busy = signal(false);
  /** Whether the chat panel is showing (toggled by the top bar button). */
  readonly open = signal(false);
  /** The company's AI usage today (null until loaded / when unavailable). */
  readonly usageToday = signal<AiUsageTotals | null>(null);
  /** Share (0-100) of the tightest daily free limit used by any model today; null when no limit is known. */
  readonly usagePct = signal<number | null>(null);

  private wire: WireMessage[] = [];
  private seq = 0;
  private abort: AbortController | null = null;

  reset(): void {
    this.drafts.clear();
    this.abort?.abort();
    this.wire = [];
    this.items.set([]);
    this.busy.set(false);
  }

  toggle(): void {
    this.open.update(v => !v);
    if (this.open()) void this.refreshUsage();
  }

  /** Reads today's recorded usage; a failure just hides the line. */
  async refreshUsage(): Promise<void> {
    try {
      const u = await this.ai.getUsage();
      this.usageToday.set(u.today);
      this.usagePct.set(AssistantService.dailyPct(u));
    } catch {
      this.usageToday.set(null);
      this.usagePct.set(null);
    }
  }

  /** Highest requests/day or tokens/day ratio across the models used today, as a capped whole percent. */
  private static dailyPct(u: AiUsageSummary): number | null {
    let best: number | null = null;
    for (const m of u.byModel ?? []) {
      const lim = limitsFor(m.model);
      if (!lim) continue;
      const ratios = [lim.rpd ? m.today.requests / lim.rpd : null, lim.tpd ? m.today.tokens / lim.tpd : null];
      for (const r of ratios) if (r !== null) best = Math.max(best ?? 0, r);
    }
    return best === null ? null : Math.min(100, Math.round(best * 100));
  }

  stop(): void { this.abort?.abort(); }

  async send(question: string): Promise<void> {
    const q = question.trim();
    if (!q || this.busy()) return;
    this.push({ role: 'user', text: q });
    this.wire.push({ role: 'user', content: q });
    this.busy.set(true);
    this.abort = new AbortController();
    const links: AssistantLink[] = [];

    try {
      const tools = this.toolbox.available();
      const defs = tools.map(t => t.def);
      for (let step = 0; step < MAX_STEPS; step++) {
        const turn = await this.ai.chat(this.window(), defs, this.abort.signal);
        this.wire.push({
          role: 'assistant',
          content: turn.content,
          ...(turn.toolCalls.length ? { tool_calls: turn.toolCalls } : {}),
        });

        if (!turn.toolCalls.length) {
          this.push({ role: 'assistant', text: turn.content.trim(), links: this.unique(links) });
          return;
        }
        for (const call of turn.toolCalls) {
          const tool = tools.find(t => t.def.name === call.name);
          let result: unknown;
          if (!tool) {
            result = { error: 'Unknown tool' };
          } else {
            try {
              const out = await tool.run(this.parse(call.arguments));
              result = out.result;
              if (out.links) links.push(...out.links);
            } catch (e: any) {
              result = { error: String(e?.error?.msg ?? e?.message ?? 'The lookup failed').slice(0, 200) };
            }
          }
          this.wire.push({ role: 'tool', tool_call_id: call.id, content: this.clip(result) });
        }
      }
      this.push({ role: 'assistant', text: '', error: true, key: 'ASSISTANT.ERR_TOO_MANY_STEPS' });
    } catch (e: any) {
      if (this.abort?.signal.aborted) return;
      const code = e instanceof AiError ? e.code : 'UNKNOWN';
      this.push({ role: 'assistant', text: '', error: true, key: ERROR_KEYS[code] ?? 'ASSISTANT.ERR_GENERIC' });
    } finally {
      this.busy.set(false);
      this.abort = null;
      void this.refreshUsage();
    }
  }

  /** The most recent messages, never starting on an orphaned tool result. */
  private window(): WireMessage[] {
    let w = this.wire.slice(-MAX_WIRE);
    while (w.length && w[0].role !== 'user') w = w.slice(1);
    return w;
  }

  private parse(raw: string): Record<string, any> {
    try {
      const v = JSON.parse(raw || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  }

  private clip(result: unknown): string {
    const s = JSON.stringify(result ?? null);
    return s.length > MAX_TOOL_RESULT ? JSON.stringify({ truncated: true, preview: s.slice(0, MAX_TOOL_RESULT - 100) }) : s;
  }

  private unique(links: AssistantLink[]): AssistantLink[] | undefined {
    const seen = new Set<string>();
    const out = links.filter(l => !seen.has(l.url) && seen.add(l.url));
    return out.length ? out.slice(0, 8) : undefined;
  }

  private push(i: Omit<ChatItem, 'id'>): void {
    this.items.update(l => [...l, { ...i, id: ++this.seq }]);
  }
}
