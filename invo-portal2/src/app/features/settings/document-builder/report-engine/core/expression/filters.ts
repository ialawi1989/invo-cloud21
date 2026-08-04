import { BindingContext, FilterMap } from '../types';

/**
 * Default filters. All filters are pure and never throw on bad input —
 * they coerce or return empty string. This matters in production where
 * a single bad row should not break a whole invoice render.
 */
export const builtInFilters: FilterMap = {
  currency: (value, args, ctx) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    const code = args[0] ?? 'USD';
    const minDigits = args[1] !== undefined ? Number(args[1]) : 2;
    try {
      return new Intl.NumberFormat(ctx.locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: minDigits,
        maximumFractionDigits: minDigits,
      }).format(num);
    } catch {
      return num.toFixed(minDigits) + ' ' + code;
    }
  },

  number: (value, args, ctx) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    const minDigits = args[0] !== undefined ? Number(args[0]) : 0;
    const maxDigits = args[1] !== undefined ? Number(args[1]) : 2;
    return new Intl.NumberFormat(ctx.locale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(num);
  },

  percent: (value, args, ctx) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    const digits = args[0] !== undefined ? Number(args[0]) : 0;
    return new Intl.NumberFormat(ctx.locale, {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(num);
  },

  date: (value, args, ctx) => {
    if (value === null || value === undefined || value === '') return '';
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    const fmt = args[0] ?? 'medium';
    const map: Record<string, Intl.DateTimeFormatOptions> = {
      short: { dateStyle: 'short' },
      medium: { dateStyle: 'medium' },
      long: { dateStyle: 'long' },
      full: { dateStyle: 'full' },
      datetime: { dateStyle: 'medium', timeStyle: 'short' },
      time: { timeStyle: 'short' },
      iso: {},
    };
    if (fmt === 'iso') return d.toISOString();
    return new Intl.DateTimeFormat(ctx.locale, map[fmt] ?? { dateStyle: 'medium' }).format(d);
  },

  uppercase: (v) => String(v ?? '').toUpperCase(),
  lowercase: (v) => String(v ?? '').toLowerCase(),
  capitalize: (v) => {
    const s = String(v ?? '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  trim: (v) => String(v ?? '').trim(),

  truncate: (v, args) => {
    const len = args[0] !== undefined ? Number(args[0]) : 50;
    const s = String(v ?? '');
    return s.length > len ? s.slice(0, len) + '…' : s;
  },

  default: (v, args) => (v === null || v === undefined || v === '' ? args[0] ?? '' : v),

  if: (v, args) => (v ? args[0] ?? '' : args[1] ?? ''),

  /** Boolean-coerce. */
  bool: (v) => Boolean(v),

  /** Pad string left. e.g. {{n | pad:5:0}} → "00042". */
  pad: (v, args) => {
    const len = args[0] !== undefined ? Number(args[0]) : 0;
    const ch = args[1] ?? ' ';
    return String(v ?? '').padStart(len, ch);
  },

  /** Multiply — useful for converting fractions to percent. */
  times: (v, args) => Number(v) * Number(args[0] ?? 1),

  /** Add — handy in totals. */
  plus: (v, args) => Number(v) + Number(args[0] ?? 0),

  /** Render array length. */
  length: (v) => (Array.isArray(v) || typeof v === 'string' ? v.length : 0),

  /** Join array. */
  join: (v, args) => (Array.isArray(v) ? v.join(args[0] ?? ', ') : String(v ?? '')),

  /**
   * Project each element of an array through a template string, recursing
   * into the binding engine so nested `{{…}}` placeholders resolve against
   * the per-element row scope. Pair with `join` to flatten the resulting
   * string array:
   *
   *   row.subItems
   *     | each:"{{row.productName}}{{row.options.length ? ' (' + (row.options | pluck:optionName | join:', ') + ')' : ''}}"
   *     | join:'\n  • '
   *
   * Inside the template, `row` is rebound to the current array element —
   * so `row.productName`, `row.options`, etc. address the element's fields.
   * Use the `row.` prefix exactly like outside the filter; bare names
   * resolve at the document root, not the iterated element.
   *
   * Returns an empty array when `v` isn't an array or the helpers aren't
   * provided (the standalone evaluator path).
   */
  each: (v, args, _ctx, helpers) => {
    if (!Array.isArray(v) || !helpers) return [];
    const tpl = String(args[0] ?? '');
    if (!tpl) return v;
    return v.map((item, i) => {
      const rowCtx = helpers.withRow(_ctx, item as Record<string, unknown>, i);
      return helpers.interpolate(tpl, rowCtx);
    });
  },

  /**
   * Project each element of an array through a (possibly nested) field
   * path. Pairs with `join` for receipt-style options:
   *   `row.options | pluck:optionName | join:', '`
   * For nested paths quote the arg (the tokenizer treats `.` as path separator):
   *   `lines | pluck:'selectedItem.name' | join:'\n'`
   */
  pluck: (v, args) => {
    if (!Array.isArray(v)) return [];
    const path = String(args[0] ?? '');
    if (!path) return v;
    const segs = path.split('.');
    return v.map((item) => {
      let cur: unknown = item;
      for (const k of segs) {
        if (cur === null || cur === undefined) return '';
        cur = (cur as Record<string, unknown>)[k];
      }
      return cur === null || cur === undefined ? '' : cur;
    });
  },

  /** Replace substring. */
  replace: (v, args) =>
    String(v ?? '').split(args[0] ?? '').join(args[1] ?? ''),

  /** Convert Western digits to Arabic-Indic when locale starts with 'ar'. */
  arabicDigits: (v, _args, ctx) => {
    const s = String(v ?? '');
    if (!ctx.locale.startsWith('ar')) return s;
    const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return s.replace(/[0-9]/g, (d) => map[Number(d)]);
  },
};
