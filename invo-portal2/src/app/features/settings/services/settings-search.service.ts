import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { SettingItem } from '../settings.catalog';

/**
 * Bounded Levenshtein distance — returns `-1` as soon as the cost exceeds `budget`, which lets
 * the caller skip the inner allocation for obviously-too-different word pairs.
 */
function levenshtein(a: string, b: string, budget: number): number {
  if (Math.abs(a.length - b.length) > budget) return -1;
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > budget) return -1;
    [prev, curr] = [curr, prev];
  }
  return prev[n] <= budget ? prev[n] : -1;
}

/**
 * The Settings search: token-AND matching over a tile's label, description and every translation
 * under its `i18nPrefix`, plus the "Did you mean …" suggestion. Shared by the Settings landing page
 * and the settings menu.
 */
@Injectable({ providedIn: 'root' })
export class SettingsSearchService {
  private readonly translate = inject(TranslateService);

  /** Every whitespace-separated word of the query must appear somewhere in the tile's corpus. */
  matches(item: SettingItem, query: string): boolean {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    const corpus = this.itemCorpus(item);
    for (const tok of q.split(/\s+/)) {
      if (tok && !corpus.includes(tok)) return false;
    }
    return true;
  }

  /**
   * Closest-word suggestion for a query that matched nothing, drawn only from words that would
   * surface a real tile (`items` = the accessible ones). `null` when nothing is close enough.
   */
  suggest(query: string, items: SettingItem[]): string | null {
    const q = query.trim();
    if (!q) return null;

    const corpus = new Set<string>();
    for (const i of items) {
      for (const w of this.itemCorpus(i).split(/\s+/)) {
        const clean = w.replace(/[^a-z0-9؀-ۿ]/gi, '');
        if (clean.length >= 3) corpus.add(clean);
      }
    }

    // Threshold scales with word length so short tokens get tighter matching.
    const out: string[] = [];
    let changed = false;
    for (const w of q.split(/\s+/)) {
      const lower = w.toLowerCase();
      if (lower.length < 3 || corpus.has(lower)) { out.push(w); continue; }
      const budget = Math.max(1, Math.floor(lower.length / 4));
      let best: { word: string; dist: number } | null = null;
      for (const c of corpus) {
        if (Math.abs(c.length - lower.length) > budget) continue;
        const d = levenshtein(lower, c, budget);
        if (d < 0) continue;
        if (!best || d < best.dist) best = { word: c, dist: d };
        if (best.dist === 0) break;
      }
      if (best && best.dist > 0 && best.dist <= budget) { out.push(best.word); changed = true; }
      else out.push(w);
    }
    return changed ? out.join(' ') : null;
  }

  /** The tile's translated label + description + every leaf string under `i18nPrefix`, lowercased. */
  private itemCorpus(item: SettingItem): string {
    const parts: string[] = [this.t(item.label), this.t(item.description)];
    if (item.i18nPrefix) this.collectLeaves(this.lookupTree(item.i18nPrefix), parts);
    return parts.join(' ').toLowerCase();
  }

  private lookupTree(prefix: string): unknown {
    const lang = this.translate.currentLang ?? this.translate.getFallbackLang();
    const dict = (this.translate as any).store?.translations?.[lang ?? ''];
    if (!dict || typeof dict !== 'object') return null;
    let node: unknown = dict;
    for (const seg of prefix.split('.')) {
      if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[seg];
      } else {
        return null;
      }
    }
    return node;
  }

  private collectLeaves(node: unknown, out: string[]): void {
    if (typeof node === 'string') { out.push(node); return; }
    if (node && typeof node === 'object') {
      for (const v of Object.values(node as Record<string, unknown>)) this.collectLeaves(v, out);
    }
  }

  private t(key: string): string { return this.translate.instant(key); }
}
