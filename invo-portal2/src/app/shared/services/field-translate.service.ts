import { Injectable, inject } from '@angular/core';
import { AiService } from '@core/ai/ai.service';

/** A target language for translation — code + human label (native name). */
export interface TranslateTarget {
  code: string;
  label: string;
}

/**
 * FieldTranslateService
 * ─────────────────────
 * Auto-translates a single field's English source into every other site
 * language in ONE streamed AI call, returning a `{ code: translation }` map.
 * Used by the shared Translation modal's "Auto-translate" button so any form
 * can machine-fill a field's other languages from the English original.
 *
 * The prompt mirrors the Translation Manager's batch translator: meaning-based,
 * UI-length aware, transliterates names, preserves numbers/codes/placeholders,
 * and applies a must-match Arabic business glossary for consistency.
 */
@Injectable({ providedIn: 'root' })
export class FieldTranslateService {
  private ai = inject(AiService);

  /**
   * Translate `source` (English) into each `targets` language.
   * Returns a map keyed by language code; failed/blank languages are omitted.
   * `context` (e.g. the field label) sharpens terminology when provided.
   *
   * Each language is translated with its OWN request using the same proven
   * JSON-array protocol as the Translation Manager (`[source]` → `[translation]`)
   * — this reliably produces target-script output (e.g. Arabic), whereas asking
   * for a single JSON object keyed by code tended to echo the Latin source.
   */
  async translate(
    source: string,
    targets: TranslateTarget[],
    context = '',
  ): Promise<Record<string, string>> {
    const clean = (source ?? '').trim();
    const langs = targets.filter((t) => t.code && t.code !== 'en');
    if (!clean || !langs.length) return {};

    const out: Record<string, string> = {};
    for (const lang of langs) {
      try {
        const t = await this.translateOne(clean, lang, context);
        if (t) out[lang.code] = t;
      } catch { /* skip this language, keep going */ }
    }
    return out;
  }

  /** Translate a single string into one target language; returns '' on failure. */
  private async translateOne(source: string, lang: TranslateTarget, context: string): Promise<string> {
    const langLabel = lang.label || lang.code;
    const isArabic = lang.code.toLowerCase().split('-')[0] === 'ar';
    const glossary = isArabic ? this.arabicGlossary() : '';

    const prompt =
      `You are an expert software and business localizer, fluent in ${langLabel}, working on a ` +
      `point-of-sale, inventory, accounting and e-commerce platform. ` +
      `Translate each item of the given JSON array from English into ${langLabel}. ` +
      (context ? `These strings are the "${context}" field shown in the app interface. ` : '') +
      `Use the officially-recognised, industry-standard ${langLabel} terminology a native ` +
      `professional expects — translate by meaning, not word for word, and keep it short enough for a UI label. ` +
      (glossary ? `ALWAYS use these exact translations when a term matches (case-insensitive), including its ` +
        `singular/plural: ${glossary}. ` : '') +
      `Transliterate personal, business and brand names into ${langLabel} script so they read naturally to a ` +
      `native speaker (e.g. "Sayed Hussain" → "سيد حسين"); do NOT leave a name in its original Latin spelling ` +
      `when the target uses a different script. ` +
      `Keep EXACTLY as-is (do NOT translate, transliterate or reorder): numbers, measurements and units, ` +
      `product codes and SKUs, model/serial numbers, HTML tags, and placeholders such as {{name}}, {0}, %s, ` +
      `:param or {% ... %} template tokens. If an item is only such a code/number/token, return it unchanged. ` +
      `Return ONLY a JSON array of strings — the translations in the SAME ORDER and SAME LENGTH as the input, ` +
      `no keys, no numbering, no commentary, no code fences.`;

    let acc = '';
    await this.ai.generateStream(
      { task: 'custom', prompt, content: JSON.stringify([source]) },
      (delta) => { acc += delta; },
    );
    return this.parseFirst(acc);
  }

  /** Extract the first string from a JSON array in the model's raw output. */
  private parseFirst(raw: string): string {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end <= start) return '';
    try {
      const arr = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(arr) && typeof arr[0] === 'string') return arr[0].trim();
    } catch { /* leave empty — caller treats missing as "not translated" */ }
    return '';
  }

  /** Compact must-match Arabic business glossary (subset of the Translation
   *  Manager's) so common accounting/retail terms stay consistent. */
  private arabicGlossary(): string {
    const map: Record<string, string> = {
      'Credit Note': 'إشعار دائن',
      'Debit Note': 'إشعار مدين',
      'Invoice': 'فاتورة',
      'Purchase': 'شراء',
      'Sales': 'مبيعات',
      'Discount': 'خصم',
      'Tax': 'ضريبة',
      'Category': 'فئة',
      'Brand': 'علامة تجارية',
      'Option': 'خيار',
      'Recipe': 'وصفة',
      'Quantity': 'كمية',
      'Price': 'السعر',
    };
    return Object.entries(map).map(([en, ar]) => `${en} → ${ar}`).join('; ');
  }
}
