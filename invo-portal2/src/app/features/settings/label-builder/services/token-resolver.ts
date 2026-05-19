// ────────────────────────────────────────────────────────────────────
// Label-builder token resolver.
//
// Ports the legacy `LabelTemplate.getValue()` regex+walk into a pure
// function so the canvas + ZPL emitters can share it. Tokens look
// like `!path.with.dots(formatter())` — a leading `!`, a dot-
// separated path, optional formatter calls along the way.
//
// Examples
//   "!product.name"
//   "!product.barcode"
//   "!product.defaultPrice.currency()"
//   "!product.expireDate.shortDate()"
//   "!product.custom.{abbr}"
//   "!invoiceLines.product.name"
//
// Unknown tokens swallow to "" — matches legacy behavior so old
// templates with bad references don't crash the canvas.
// ────────────────────────────────────────────────────────────────────

export type LabelDataMap = {
  product?:      Record<string, any>;
  invoiceLine?:  Record<string, any>;
  /** Optional company context — used for `!company.*` tokens (e.g.
   *  `!company.currencySymbol`). */
  company?:      Record<string, any>;
  /** Resolved abbr → field-id map for product custom fields. The
   *  legacy back-end stores `customFields[id]` keyed by id; user-
   *  facing tokens use abbr — this map bridges the two. */
  customFieldsMap?: Map<string, string>;
};

export type ResolveOptions = {
  /** Fixed decimal places for `number()` / `currency()` formatters.
   *  Old code read this from `MathUtils.afterDecimal` (3); kept as
   *  an injectable here so callers can vary it per company. */
  decimals?: number;
  /** Currency symbol prepended by `currency()`. Defaults to `$` so
   *  the canvas preview never shows a literal "undefined". */
  currencySymbol?: string;
};

const TOKEN_REGEX = /![a-zA-Z0-9._]+(?:\(\))?/g;

/** Format a Date / ISO string into `DD-MMM-YYYY`. Pure JS — no
 *  moment dep — uses the locale's short month abbreviation. */
function formatShortDate(value: any): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd  = String(d.getDate()).padStart(2, '0');
  const mmm = d.toLocaleString('en', { month: 'short' });
  const yyyy = d.getFullYear();
  return `${dd}-${mmm}-${yyyy}`;
}
function formatShortTime(value: any): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatLongDate(value: any): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = formatShortDate(d);
  const hh   = String(d.getHours()).padStart(2, '0');
  const mm   = String(d.getMinutes()).padStart(2, '0');
  const ss   = String(d.getSeconds()).padStart(2, '0');
  return `${date} ${hh}:${mm}:${ss}`;
}

/** Resolve a single token string (without the leading `!`) against
 *  the data map. Returns the formatted value as a string, or `null`
 *  to signal "drop the token entirely" (e.g. `hideIfOne()` on a 1).
 *  Returns `undefined` when the path can't be resolved at all so the
 *  caller can decide whether to substitute "" or leave the token. */
function resolvePath(
  rawPath: string,
  data: LabelDataMap,
  opts: Required<ResolveOptions>,
): string | null | undefined {
  const parts = rawPath.split('.');
  if (!parts.length) return undefined;

  // Pick the root namespace by the first segment. Legacy quirks:
  //   - `product.price` aliases to `defaultPrice`
  //   - `product.priceWithTax` aliases to `getPriceWithTax`
  //   - `product.custom.{abbr}` reads via the customFieldsMap when
  //     present, else from a plain `custom` dummy bag.
  let cursor: any;
  switch (parts[0]) {
    case 'product':      cursor = data.product ?? {}; break;
    case 'invoiceLines': cursor = data.invoiceLine ?? {}; break;
    case 'company':      cursor = data.company ?? {}; break;
    default: return undefined;
  }

  // Special-case rewrites that match legacy aliases. The product /
  // invoiceLine bags are typed as `Record<string, any>`; bracket
  // access keeps the strict-tsconfig `noPropertyAccessFromIndexSignature`
  // rule happy.
  if (parts[0] === 'product' && parts[1] === 'price') {
    cursor = data.product?.['defaultPrice'] ?? data.product?.['price'];
    parts.splice(0, 2);
  } else if (parts[0] === 'product' && parts[1] === 'priceWithTax') {
    cursor = data.product?.['getPriceWithTax'] ?? data.product?.['priceWithTax'];
    parts.splice(0, 2);
  } else if (parts[0] === 'product' && parts[1] === 'custom' && parts.length >= 3) {
    const key = parts[2];
    const cf  = data.product?.['customFields'];
    const map = data.customFieldsMap;
    if (cf && map?.get(key) && cf[map.get(key)!] !== undefined) {
      cursor = cf[map.get(key)!];
    } else if (cf && cf[key] !== undefined) {
      cursor = cf[key];
    } else if (data.product?.['custom']?.[key] !== undefined) {
      cursor = data.product['custom'][key];
    } else {
      cursor = '';
    }
    parts.splice(0, 3);
  } else {
    parts.shift(); // consume the namespace itself
  }

  // Walk the remaining segments. A segment may be either a property
  // name, or a formatter call (`number()`, `currency()`, …) that
  // transforms `cursor` in-place.
  for (const seg of parts) {
    if (cursor === null || cursor === undefined) break;
    switch (seg) {
      case 'toString()':
        cursor = String(cursor); break;
      case 'stringTrim()':
        cursor = String(cursor).trim(); break;
      case 'numberTrim()':
        cursor = String(cursor).replace(/(\.0+)(?!\d)/g, '').trim(); break;
      case 'number()':
        cursor = (Number(cursor) || 0).toFixed(opts.decimals); break;
      case 'currency()':
        if (typeof cursor === 'number' || !Number.isNaN(Number(cursor))) {
          cursor = `${opts.currencySymbol} ${(Number(cursor) || 0).toFixed(opts.decimals)}`;
        }
        break;
      case 'shortDate()':  cursor = formatShortDate(cursor); break;
      case 'shortTime()':  cursor = formatShortTime(cursor); break;
      case 'longDate()':   cursor = formatLongDate(cursor); break;
      case 'hideIfOne()':
        if (typeof cursor === 'number' && cursor === 1) return null;
        break;
      default:
        // Plain property access — guard against null bridging so
        // bad paths don't throw.
        if (cursor != null && cursor[seg] !== undefined) {
          cursor = cursor[seg];
        } else {
          // Path miss: keep walking so trailing formatters still
          // apply on the empty string. Matches legacy behavior of
          // "no error, just empty".
          cursor = '';
        }
    }
  }

  if (cursor === null || cursor === undefined) return '';
  if (typeof cursor === 'object') return '-';
  return String(cursor);
}

/**
 * Resolve every `!path` token in `template` against `data`. Tokens
 * that resolve to `null` (e.g. `hideIfOne()` matched 1) are removed
 * entirely; tokens that don't resolve are replaced with the empty
 * string so the surrounding text still reads cleanly.
 *
 * Pure — safe to call from `computed` / `effect`.
 */
export function resolveTokens(
  template: string,
  data: LabelDataMap,
  opts: ResolveOptions = {},
): string {
  if (!template) return '';
  const resolved: Required<ResolveOptions> = {
    decimals:       opts.decimals       ?? 3,
    currencySymbol: opts.currencySymbol ?? '$',
  };
  return template.replace(TOKEN_REGEX, (match) => {
    const path = match.slice(1); // drop the leading '!'
    try {
      const value = resolvePath(path, data, resolved);
      if (value === null)      return ''; // hideIfOne — drop entirely
      if (value === undefined) return match; // unknown root — leave as-is
      return value;
    } catch {
      return ''; // legacy swallows all errors
    }
  });
}

// ── Default preview data ─────────────────────────────────────────────

/** Reasonable dummy product so the canvas isn't empty before the user
 *  has bound real data. Mirrors the legacy `fillProductDummyData()`. */
export function defaultPreviewData(): LabelDataMap {
  return {
    product: {
      id:              '00000000-0000-0000-0000-000000000000',
      name:            'FULL BAG SHERRY',
      UOM:             'PCS',
      barcode:         '8320223244367',
      sku:             '1235465',
      description:     'FULL BAG SHERRY Description',
      defaultPrice:    10,
      price:           20,
      priceWithTax:    11,
      getPriceWithTax: 11,
      taxPercentage:   10,
      categoryName:    'Dryer',
      departmentName:  'Department 1',
      type:            'inventory',
      unitCost:        30,
      onHand:          '550',
      weightUnit:      'kg',
      preparationTime: 15,
      serviceTime:     30,
      serial:          '157563763575',
      batch:           'batch 1256',
      expireDate:      '2026-12-31',
      url:             'https://shop.example.com/product/preview',
      urlAddToCart:    'https://shop.example.com/product/preview?addtocart=true',
      nutrition:       { kcal: 2000, fat: 1000, carb: 3000, protien: 2000 },
      customFields:    {},
      custom:          {},
    },
    invoiceLine: {
      id:            'preview-line',
      invoiceId:     'preview-invoice',
      qty:           10,
      product:       { name: 'Hommos' },
      optionsText:   'Large, Spicy',
      total:         20,
      UOM:           'PCS',
      serial:        '157563763575',
      batch:         'batch 1256',
      seatNumber:    15,
      note:          'This item available only in dinein',
      discountTotal: 2,
      taxTotal:      1.3,
    },
  };
}
