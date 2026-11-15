/**
 * Preview-time `T()` translation for message templates (port of legacy templates-form translation step).
 *
 * The server renders the template (it ignores `lang`), so the per-language part is resolved around it:
 *  - before the render, `T({{ path }})` is replaced with the wording for `lang` taken from the sample data;
 *  - after the render, remaining literal `T({ar="..",en=".."})` calls are resolved; a plain key keeps its
 *    own (English) wording because the Arabic bundle lives on the server.
 */

export type PreviewLang = 'en' | 'ar';

function normalizeLangTag(lang: string): string {
  return String(lang ?? '').trim().toLowerCase().split(/[-_]/)[0];
}

function stripQuotes(value: string): string {
  const text = value.trim();
  if (text.length >= 2 && (text[0] === "'" || text[0] === '"' || text[0] === '`') && text[text.length - 1] === text[0]) {
    return text.substring(1, text.length - 1);
  }
  return text;
}

/** Index of the ')' matching the '(' at `openIndex`, or -1 when unbalanced. */
function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Exact tag, then the bare language, then English, then the first entry. */
function pickLanguageEntry(entries: Map<string, string>, lang: string): string | null {
  if (entries.size === 0) return null;
  const requested = String(lang ?? '').trim().toLowerCase();
  return entries.get(requested) ?? entries.get(normalizeLangTag(lang)) ?? entries.get('en') ?? entries.values().next().value ?? null;
}

/** Resolves `{ar="X",en="Y"}` (also `:` separators, quoted or bare values) for `lang`; null when it is not a map. */
export function resolveInlineTranslation(source: string, lang: string): string | null {
  const body = source.substring(1, source.length - 1);
  const entries = new Map<string, string>();
  let i = 0;

  while (i < body.length) {
    let key = '';
    while (i < body.length && body[i] !== '=' && body[i] !== ':' && body[i] !== ',') { key += body[i]; i++; }
    if (i >= body.length || body[i] === ',') {
      if (body[i] === ',') { i++; continue; }
      break;
    }
    i++; // skip = or :
    while (i < body.length && /\s/.test(body[i])) i++;

    let value = '';
    if (body[i] === "'" || body[i] === '"' || body[i] === '`') {
      const quote = body[i];
      i++;
      while (i < body.length && body[i] !== quote) {
        if (body[i] === '\\' && i + 1 < body.length) { value += body[i + 1]; i += 2; }
        else { value += body[i]; i++; }
      }
      i++; // closing quote
      while (i < body.length && body[i] !== ',') i++;
    } else {
      while (i < body.length && body[i] !== ',') { value += body[i]; i++; }
      value = value.trim();
    }
    i++; // comma

    const normalizedKey = stripQuotes(key).trim().toLowerCase();
    if (normalizedKey !== '') entries.set(normalizedKey, value);
  }
  return pickLanguageEntry(entries, lang);
}

/** Wording for `lang` of a stored value: a per-language object / inline map resolves, anything else passes through. */
export function translateValue(value: unknown, lang: string): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    const entries = new Map<string, string>();
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === null || entry === undefined || typeof entry === 'object') continue;
      entries.set(String(key).trim().toLowerCase(), String(entry));
    }
    return pickLanguageEntry(entries, lang) ?? JSON.stringify(value);
  }

  const text = String(value);
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inline = resolveInlineTranslation(trimmed, lang);
    if (inline !== null) return inline;
  }
  return text;
}

function getByPath(data: unknown, path: string): unknown {
  return path.split('.').reduce<any>((acc, part) => (acc === null || acc === undefined ? undefined : acc[part.trim()]), data);
}

/**
 * Before the server render: `T({{ customer.name }})` becomes the wording of `customer.name` for `lang`.
 * Only a bare dotted path can be resolved here; any other expression is left for the server.
 */
export function preprocessDataTranslations(template: string, data: unknown, lang: string): string {
  if (!template || template.indexOf('T(') === -1) return template;

  let result = '';
  let i = 0;
  while (i < template.length) {
    if (template[i] === 'T' && template[i + 1] === '(' && (i === 0 || !/[\w$.]/.test(template[i - 1]))) {
      const close = findMatchingParen(template, i + 1);
      if (close !== -1) {
        const arg = template.substring(i + 2, close).trim();
        const m = /^\{\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\}\}$/.exec(arg);
        if (m) {
          const value = getByPath(data, m[1]);
          if (value !== undefined) {
            result += translateValue(value, lang);
            i = close + 1;
            continue;
          }
        }
      }
    }
    result += template[i];
    i++;
  }
  return result;
}

/** After the render: every `T(...)` becomes its wording for `lang` (a plain key keeps its own wording). */
export function translateExpressions(text: string, lang: string): string {
  if (!text || text.indexOf('T(') === -1) return text;

  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === 'T' && text[i + 1] === '(' && (i === 0 || !/[\w$.]/.test(text[i - 1]))) {
      const close = findMatchingParen(text, i + 1);
      if (close === -1) { result += text[i]; i++; continue; }

      const inner = translateExpressions(text.substring(i + 2, close), lang).trim();
      if (inner.startsWith('{') && inner.endsWith('}')) {
        const inline = resolveInlineTranslation(inner, lang);
        if (inline !== null) { result += inline; i = close + 1; continue; }
      }
      result += stripQuotes(inner);
      i = close + 1;
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
}
