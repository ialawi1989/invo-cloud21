import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

/**
 * Module slug for one row in the prefix-settings page. Matches the
 * legacy backend keys 1:1 so saved data round-trips unchanged.
 */
export type PrefixModule =
  | 'invoice'
  | 'bill'
  | 'estimate'
  | 'creditNote'
  | 'expense'
  | 'supplierCredit'
  | 'billOfEntry'
  | 'purchaseOrder'
  | 'inventoryTransfer';

/** One stored entry — the prefix template + zero-padding width. */
export interface PrefixEntry {
  prefix: string;
  /** Number of digits the trailing serial gets padded to (1–10). */
  width: number;
}

/** Wire shape for the whole prefix-settings blob. */
export type PrefixMap = Partial<Record<PrefixModule, PrefixEntry>>;

/** Project-canonical order rows are rendered in. */
export const PREFIX_MODULE_ORDER: readonly PrefixModule[] = [
  'invoice',
  'bill',
  'estimate',
  'creditNote',
  'expense',
  'supplierCredit',
  'billOfEntry',
  'purchaseOrder',
  'inventoryTransfer',
];

/**
 * Mapping from our internal camelCase module slug to the legacy
 * PascalCase wire key the backend expects/returns. Kept here so the
 * rest of the app — UI labels, route slugs, default map — can stay
 * camelCase without leaking the legacy shape.
 *
 *   invoice           ↔ Invoice
 *   creditNote        ↔ CreditNote
 *   purchaseOrder     ↔ PurchaseOrder
 *   …
 */
const WIRE_KEY: Record<PrefixModule, string> = {
  invoice:           'Invoice',
  bill:              'Bill',
  estimate:          'Estimate',
  creditNote:        'CreditNote',
  expense:           'Expense',
  supplierCredit:    'SupplierCredit',
  billOfEntry:       'BillOfEntry',
  purchaseOrder:     'PurchaseOrder',
  inventoryTransfer: 'InventoryTransfer',
};

/** Reverse lookup: wire key → internal slug. Used on load. */
const FROM_WIRE: Record<string, PrefixModule> = Object.fromEntries(
  Object.entries(WIRE_KEY).map(([k, v]) => [v, k as PrefixModule]),
) as Record<string, PrefixModule>;

/** Sensible defaults applied when the backend hasn't seen this module before. */
export const DEFAULT_PREFIX_MAP: Record<PrefixModule, PrefixEntry> = {
  invoice:           { prefix: 'INV-',   width: 4 },
  bill:              { prefix: 'BILL-',  width: 4 },
  estimate:          { prefix: 'EST-',   width: 4 },
  creditNote:        { prefix: 'CN-',    width: 4 },
  expense:           { prefix: 'EXP-',   width: 4 },
  supplierCredit:    { prefix: 'SC-',    width: 4 },
  billOfEntry:       { prefix: 'BOE-',   width: 4 },
  purchaseOrder:     { prefix: 'PO-',    width: 4 },
  inventoryTransfer: { prefix: 'IT-',    width: 4 },
};

/**
 * PrefixSettingsService
 * ─────────────────────
 * Wraps the legacy `company/getPrefixSettings` / `company/setPrefixSettings`
 * endpoints so the page doesn't have to know the wire shape.
 *
 * The legacy load endpoint accepts either an object `{ prefix, width }`
 * OR a bare string (older records). We normalise into the modern object
 * shape here so the page only ever sees one form.
 */
@Injectable({ providedIn: 'root' })
export class PrefixSettingsService {
  private api = inject(ApiService);

  async getAll(): Promise<PrefixMap> {
    const res = await this.api.request<any>(this.api.get('company/getPrefixSettings'));
    const raw = res?.data?.prefixSettings ?? res?.data ?? {};
    return this.normalise(raw);
  }

  async save(map: PrefixMap): Promise<boolean> {
    // Wire shape matches the legacy POST exactly: `{ prefixSettings: { <module>: { prefix, width } } }`.
    const payload = { prefixSettings: this.serialise(map) };
    const res = await this.api.request<any>(
      this.api.post('company/setPrefixSettings', payload),
    );
    return !!res?.success;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────
  /**
   * Coerce raw wire data into the canonical `{ prefix, width }` shape,
   * keyed by our internal camelCase module slug. Tolerates both the
   * legacy PascalCase wire keys (`Invoice`, `CreditNote`) and the new
   * camelCase ones — older records and newer ones round-trip correctly.
   */
  private normalise(raw: any): PrefixMap {
    if (!raw || typeof raw !== 'object') return {};
    const out: PrefixMap = {};
    for (const wireKey of Object.keys(raw)) {
      const v = raw[wireKey];
      if (v == null) continue;
      // Translate the wire key (PascalCase or camelCase) to our slug.
      const slug = FROM_WIRE[wireKey] ?? (wireKey as PrefixModule);
      if (!(slug in DEFAULT_PREFIX_MAP)) continue; // unknown module — skip
      if (typeof v === 'string') {
        out[slug] = { prefix: v, width: DEFAULT_PREFIX_MAP[slug].width };
      } else if (typeof v === 'object') {
        out[slug] = {
          prefix: String(v.prefix ?? ''),
          // Legacy records stored under either `width` or `suffixWidth`.
          width:  num(v.width ?? v.suffixWidth) ?? DEFAULT_PREFIX_MAP[slug].width,
        };
      }
    }
    return out;
  }

  /**
   * Serialise back to the legacy PascalCase wire shape — the backend
   * looks up entries with `prefixSettings.Invoice.prefix` etc. and
   * blows up with "Cannot read properties of undefined" if we send
   * lowercase keys.
   */
  private serialise(map: PrefixMap): Record<string, { prefix: string; width: number }> {
    const out: Record<string, { prefix: string; width: number }> = {};
    for (const slug of Object.keys(map) as PrefixModule[]) {
      const e = map[slug];
      if (!e) continue;
      out[WIRE_KEY[slug]] = { prefix: e.prefix, width: clamp(e.width, 1, 10) };
    }
    return out;
  }
}

/**
 * Token-aware preview generator. Expands `{YYYY}`/`{YY}`/`{MM}`/`{DD}`
 * against `Date.now()` and appends a zero-padded sample serial — gives
 * the user a live "what will my next number look like" hint.
 */
export function buildPreview(entry: PrefixEntry, sampleSerial = 1): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy   = yyyy.slice(-2);
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');

  const expanded = (entry.prefix ?? '')
    .replace(/{YYYY}/g, yyyy)
    .replace(/{YY}/g,   yy)
    .replace(/{MM}/g,   mm)
    .replace(/{DD}/g,   dd);

  const padded = String(sampleSerial).padStart(clamp(entry.width, 1, 10), '0');
  return `${expanded}${padded}`;
}

function num(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
