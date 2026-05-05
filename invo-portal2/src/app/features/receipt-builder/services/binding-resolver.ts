// ── Receipt-builder binding resolver ────────────────────────────────────
// Replaces `!invoice.*` / `!preferences.*` tokens inside receipt-element
// text with values pulled from a demo profile, so the canvas preview
// reads the way the printed receipt will. Tokens that don't resolve
// (path missing on the profile) fall back to a `{lastSegment}`
// placeholder — mirrors the legacy preview behaviour visible in
// `InvoCloudFront2`'s receipt-builder.
//
// Formatter calls (`.shortDate()`, `.currency()`, `.number()`, etc.)
// are applied as the path walker reaches them, so e.g.
// `!invoice.createdAt.shortDate()` becomes `29-Apr-2026`.
//
// The resolver is pure-function so it can be reused from element-render
// (live preview) and from a future server-side render without dragging
// in Angular DI.
// ────────────────────────────────────────────────────────────────────────

export interface DemoInvoiceLine {
  qty: number;
  taxPercentage: number;
  taxTotal: number;
  price: number;
  discountAmount: number;
  discountTotal?: number;
  subTotal?: number;
  subTotalWithoutTax?: number;
  total: number;
  serialNo?: string;
  product: {
    name: string;
    secondaryName?: string;
    kitchenName?: string;
    barcode?: string;
  };
  UOM: string;
}

export interface DemoInvoiceTax {
  name: string;
  rate: number;
  /** `amount` and `total` carry the same value; legacy column keys
   *  reference `total` (`!total.number()`), but some integrations
   *  also expect `amount`. Carrying both keeps either binding shape
   *  resolvable. */
  amount: number;
  total: number;
}

export interface DemoInvoicePayment {
  /** Legacy cell.key for the method column is `paymentMethod`. The
   *  `paymentMethod.name` binding (used in the cell.value template)
   *  walks into this object, so it carries a nested name. */
  paymentMethod: { name: string };
  /** Legacy cell labels reference `tenderAmount` and
   *  `tenderEquivalent.currency()` — both carry the same total here. */
  tenderAmount: number;
  tenderEquivalent: number;
  /** Generic `amount` kept for any binding that uses the simpler form. */
  amount: number;
  method: string;
}

export interface DemoInvoice {
  id: string;
  invoiceNumber: string;
  refrenceNumber: string;
  createdAt: Date;
  printTime: Date;
  scheduleTime?: Date;
  employeeName: string;
  customerName?: string;
  customerContact?: string;
  customerAddress?: string;
  note?: string;
  serviceName: string;
  tableName?: string;
  table?: { name: string };
  isPaid: number;

  itemSubTotal: number;
  itemDiscountTotal: number;
  itemSubTotalAfterDiscount: number;
  discountAmount: number;
  discountTotal: number;
  chargeTotal: number;
  deliveryCharge: number;
  roundingTotal: number;
  total: number;
  balance: number;
  change: number;

  zatcaCode: string;

  lines: DemoInvoiceLine[];
  taxes: DemoInvoiceTax[];
  payments: DemoInvoicePayment[];
}

export interface DemoPreferences {
  name: string;
  branchName: string;
  branchAddress: string;
  phoneNumber: string;
  vatNumber: string;
  logo?: string;
  logoSecondary?: string;
}

export interface DemoProfile {
  /** Stable id used by the picker dropdown. */
  id: string;
  /** i18n key relative to `RECEIPT_BUILDER.DEMO.*`. */
  labelKey: string;
  invoice: DemoInvoice;
  preferences: DemoPreferences;
}

// ────────────────────────────────────────────────────────────────────────
// Predefined profiles. Each one represents a realistic receipt scenario:
//   • DEFAULT  — minimal sample data, mostly placeholders. Useful for
//                designing layout without distractions.
//   • DINE_IN  — table-service order with server, table, customer name.
//   • PAID     — totals + payment + change due, isPaid flag set.
//   • DELIVERY — delivery service with customer address + delivery
//                charge so the user can preview that conditional row.
// Numbers are deliberately generic (no real currency symbol) so a
// single profile reads naturally regardless of tenant locale.
// ────────────────────────────────────────────────────────────────────────

const SAMPLE_LINES: DemoInvoiceLine[] = [
  // `subTotalWithoutTax` is total / 1.15 (15% VAT). Sample lines mirror
  // the full set of legacy column keys so every catalog binding
  // resolves on the canvas — qty / price / tax / discount /
  // subTotalWithoutTax / serialNo / product.barcode / secondaryName /
  // kitchenName all carry sample values.
  {
    qty: 2, taxPercentage: 15, taxTotal: 4.50, price: 15.00,
    discountAmount: 0, discountTotal: 0,
    subTotal: 30.00, subTotalWithoutTax: 26.09, total: 30.00,
    serialNo: 'SN-001',
    product: { name: 'Latte', secondaryName: 'لاتيه', kitchenName: 'LAT', barcode: '1001' },
    UOM: 'pcs',
  },
  {
    qty: 1, taxPercentage: 15, taxTotal: 1.20, price: 8.00,
    discountAmount: 0, discountTotal: 0,
    subTotal: 8.00, subTotalWithoutTax: 6.96, total: 8.00,
    serialNo: 'SN-002',
    product: { name: 'Croissant', secondaryName: 'كرواسون', kitchenName: 'CRO', barcode: '1002' },
    UOM: 'pcs',
  },
  {
    qty: 1, taxPercentage: 15, taxTotal: 0.45, price: 3.00,
    discountAmount: 0, discountTotal: 0,
    subTotal: 3.00, subTotalWithoutTax: 2.61, total: 3.00,
    serialNo: 'SN-003',
    product: { name: 'Espresso shot', secondaryName: 'اسبريسو', kitchenName: 'ESP', barcode: '1003' },
    UOM: 'pcs',
  },
];

const SAMPLE_TAXES: DemoInvoiceTax[] = [
  { name: 'VAT 15%', rate: 15, amount: 6.15, total: 6.15 },
];

const SAMPLE_PAYMENTS: DemoInvoicePayment[] = [
  { paymentMethod: { name: 'Cash' }, method: 'Cash',
    tenderAmount: 50.00, tenderEquivalent: 50.00, amount: 50.00 },
];

const NOW = new Date();

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v, (_, x) => x instanceof Date ? { __d: x.toISOString() } : x), (_, x) => x && x.__d ? new Date(x.__d) : x) as T; }

const DEFAULT_PREFERENCES: DemoPreferences = {
  name:           'Acme Coffee',
  branchName:     'Downtown',
  branchAddress:  '123 Main St, City Center',
  phoneNumber:    '+966 11 234 5678',
  vatNumber:      '300000000000003',
};

export const DEMO_PROFILES: DemoProfile[] = [
  {
    id: 'default',
    labelKey: 'PROFILE_DEFAULT',
    invoice: {
      id: 'demo-1',
      invoiceNumber: 'INV-1042',
      refrenceNumber: 'R-204',
      createdAt: NOW,
      printTime: NOW,
      // Schedule + customer + table + note all filled so the
      // legacy default template's conditional rows render with real
      // values instead of `{placeholder}` tokens.
      scheduleTime: new Date(NOW.getTime() + 30 * 60 * 1000),
      employeeName: 'Server',
      customerName: 'Walk-in customer',
      customerContact: '+966 50 123 4567',
      customerAddress: '123 Main St',
      note: 'Thank you for your visit!',
      tableName: 'T-1',
      table: { name: 'T-1' },
      serviceName: 'Walk-in',
      isPaid: 0,
      itemSubTotal: 41.00,
      itemDiscountTotal: 0,
      itemSubTotalAfterDiscount: 41.00,
      discountAmount: 0,
      discountTotal: 0,
      chargeTotal: 0,
      deliveryCharge: 0,
      roundingTotal: 0,
      total: 47.15,
      balance: 47.15,
      change: 0,
      zatcaCode: 'AQpBY21lIENvZmZlZQIPMzAwMDAwMDAwMDAwMDAzAxQyMDI2LTA0LTI5VDEyOjAwOjAwWgQENDcuMTUFAjYuMTU=',
      lines: clone(SAMPLE_LINES),
      taxes: clone(SAMPLE_TAXES),
      payments: [],
    },
    preferences: clone(DEFAULT_PREFERENCES),
  },
  {
    id: 'dineIn',
    labelKey: 'PROFILE_DINE_IN',
    invoice: {
      id: 'demo-2',
      invoiceNumber: 'INV-1043',
      refrenceNumber: 'R-205',
      createdAt: NOW,
      printTime: NOW,
      // All conditional rows resolve so the user sees a fully-filled
      // dine-in receipt: customer info + table + scheduled time + note.
      scheduleTime: new Date(NOW.getTime() + 30 * 60 * 1000),
      employeeName: 'Aisha M.',
      customerName: 'Khalid',
      customerContact: '+966 50 555 1234',
      customerAddress: 'Riyadh — 4th Floor',
      note: 'Allergic to peanuts',
      serviceName: 'Dine-in',
      tableName: 'T-12',
      table: { name: 'T-12' },
      isPaid: 0,
      itemSubTotal: 41.00,
      itemDiscountTotal: 0,
      itemSubTotalAfterDiscount: 41.00,
      discountAmount: 0,
      discountTotal: 0,
      chargeTotal: 0,
      deliveryCharge: 0,
      roundingTotal: 0,
      total: 47.15,
      balance: 47.15,
      change: 0,
      zatcaCode: 'AQpBY21lIENvZmZlZQIPMzAwMDAwMDAwMDAwMDAzAxQyMDI2LTA0LTI5VDEyOjAwOjAwWgQENDcuMTUFAjYuMTU=',
      lines: clone(SAMPLE_LINES),
      taxes: clone(SAMPLE_TAXES),
      payments: [],
    },
    preferences: clone(DEFAULT_PREFERENCES),
  },
  {
    id: 'paid',
    labelKey: 'PROFILE_PAID',
    invoice: {
      id: 'demo-3',
      invoiceNumber: 'INV-1044',
      refrenceNumber: 'R-206',
      createdAt: NOW,
      printTime: NOW,
      scheduleTime: new Date(NOW.getTime() + 30 * 60 * 1000),
      employeeName: 'Khaled',
      customerName: 'Faisal',
      customerContact: '+966 55 222 9988',
      customerAddress: '—',
      tableName: 'T-3',
      table: { name: 'T-3' },
      serviceName: 'Walk-in',
      isPaid: 1,
      note: 'Thank you, please come again!',
      itemSubTotal: 41.00,
      itemDiscountTotal: 0,
      itemSubTotalAfterDiscount: 41.00,
      discountAmount: 0,
      discountTotal: 0,
      chargeTotal: 0,
      deliveryCharge: 0,
      roundingTotal: 0,
      total: 47.15,
      balance: 0,
      change: 2.85,
      zatcaCode: 'AQpBY21lIENvZmZlZQIPMzAwMDAwMDAwMDAwMDAzAxQyMDI2LTA0LTI5VDEyOjAwOjAwWgQENDcuMTUFAjYuMTU=',
      lines: clone(SAMPLE_LINES),
      taxes: clone(SAMPLE_TAXES),
      payments: clone(SAMPLE_PAYMENTS),
    },
    preferences: clone(DEFAULT_PREFERENCES),
  },
  {
    id: 'delivery',
    labelKey: 'PROFILE_DELIVERY',
    invoice: {
      id: 'demo-4',
      invoiceNumber: 'INV-1045',
      refrenceNumber: 'R-207',
      createdAt: NOW,
      printTime: NOW,
      scheduleTime: new Date(NOW.getTime() + 45 * 60 * 1000),
      employeeName: 'Driver',
      customerName: 'Sara N.',
      customerContact: '+966 50 111 2222',
      customerAddress: 'Apt 4, 90 Olive Tree Rd, Riyadh',
      note: 'Leave at door',
      tableName: '—',
      table: { name: '—' },
      serviceName: 'Delivery',
      isPaid: 0,
      itemSubTotal: 41.00,
      itemDiscountTotal: 0,
      itemSubTotalAfterDiscount: 41.00,
      discountAmount: 0,
      discountTotal: 0,
      chargeTotal: 0,
      deliveryCharge: 7.00,
      roundingTotal: 0,
      total: 54.15,
      balance: 54.15,
      change: 0,
      zatcaCode: 'AQpBY21lIENvZmZlZQIPMzAwMDAwMDAwMDAwMDAzAxQyMDI2LTA0LTI5VDEyOjAwOjAwWgQENDcuMTUFAjYuMTU=',
      lines: clone(SAMPLE_LINES),
      taxes: clone(SAMPLE_TAXES),
      payments: [],
    },
    preferences: clone(DEFAULT_PREFERENCES),
  },
];

export const DEFAULT_PROFILE_ID = 'default';

// ────────────────────────────────────────────────────────────────────────
// Resolver
// ────────────────────────────────────────────────────────────────────────

const TOKEN_RE = /!(invoice|preferences)\.([a-zA-Z0-9_.()]+)/g;

/**
 * Replace every `!invoice.path[.fn()]` / `!preferences.path[.fn()]`
 * token in `text` with the resolved value from `profile`. Unresolved
 * paths fall back to `{lastSegment}` so the user can still see what
 * each binding represents in the preview.
 *
 * Pass `lineContext` when resolving a Table body row — bindings then
 * resolve against that line first (e.g. `qty`, `product.name`) and
 * fall back to the invoice/preferences scope.
 */
export function resolveBindings(
  text: string,
  profile: DemoProfile,
  lineContext?: Record<string, unknown>,
): string {
  if (!text) return text;
  return text.replace(TOKEN_RE, (_match, root, path) => {
    const scope = root === 'preferences' ? profile.preferences : profile.invoice;
    const value = walkPath(scope, path, lineContext);
    if (value === undefined || value === null || value === '') {
      // Strip any formatter parens, return the last path segment.
      const stripped = path.replace(/\([^)]*\)/g, '');
      const segs = stripped.split('.');
      return '{' + (segs[segs.length - 1] || stripped) + '}';
    }
    return String(value);
  });
}

/**
 * Resolve a *raw* binding key (no `!root.` prefix) against a line
 * context — used by Table dynamic rows where each cell's `key` is a
 * relative path like `qty`, `product.name`, `total.number()`.
 */
export function resolveLineKey(
  key: string,
  line: Record<string, unknown>,
  profile: DemoProfile,
): string {
  if (!key) return '';
  const value = walkPath(line, key, undefined);
  if (value === undefined || value === null || value === '') {
    const stripped = key.replace(/\([^)]*\)/g, '');
    const segs = stripped.split('.');
    return '{' + (segs[segs.length - 1] || stripped) + '}';
  }
  return String(value);
}

// ── Internals ──────────────────────────────────────────────────────────

function walkPath(
  scope: unknown,
  path: string,
  fallbackScope?: Record<string, unknown>,
): unknown {
  // Split the path while keeping `fn()` segments intact.
  const segments = path.split('.');
  let cur: unknown = scope;
  let scopeFellBack = false;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (cur == null) return undefined;

    if (seg.endsWith('()')) {
      cur = applyFormatter(cur, seg.slice(0, -2));
      continue;
    }

    // Step into property. If the first step misses on the primary
    // scope but a fallback (e.g. invoice while resolving inside a
    // line) is supplied, retry from there once.
    const next = (cur as Record<string, unknown>)[seg];
    if (next === undefined && i === 0 && fallbackScope && !scopeFellBack) {
      cur = fallbackScope[seg];
      scopeFellBack = true;
      if (cur === undefined) return undefined;
      continue;
    }
    cur = next;
  }

  return cur;
}

function applyFormatter(value: unknown, fn: string): string {
  if (value == null) return '';
  switch (fn) {
    case 'shortDate':
      return value instanceof Date ? formatShortDate(value) : String(value);
    case 'shortTime':
      return value instanceof Date ? formatShortTime(value) : String(value);
    case 'longDate':
      return value instanceof Date ? formatLongDate(value) : String(value);
    case 'currency':
      return formatNumber(Number(value));
    case 'number':
      return formatNumber(Number(value));
    default:
      return String(value);
  }
}

// Date formatters — small, locale-independent so the preview reads
// the same regardless of the user's browser locale (matches what
// thermal printers actually output).

function pad2(n: number): string { return n.toString().padStart(2, '0'); }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatShortDate(d: Date): string {
  return `${pad2(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function formatShortTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatLongDate(d: Date): string {
  return `${formatShortDate(d)} ${formatShortTime(d)}`;
}

function formatNumber(n: number): string {
  if (!isFinite(n)) return '0.00';
  return n.toFixed(2);
}
