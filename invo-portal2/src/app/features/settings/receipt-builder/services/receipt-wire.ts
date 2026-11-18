import type { PrintElement } from './receipt-builder.types';

/**
 * Wire format of a receipt template, matched to what the LEGACY builder saves and the live POS reads.
 *
 * Inside this app an invoice-lines table is `type: 'Table'` + `source: '!invoice.lines'` (one editor code path for the three
 * table kinds). On the wire the legacy builder writes `type: 'TableInvoiceLines'` + `source: 'invoice.lines'` (no `!`), and its
 * loader only treats `Table` as taxes / payments when the source is `!invoice.taxes` / `!invoice.payments`. So the conversion
 * happens here, at the boundary, in both directions. Everything the legacy model classes always write (element `id`, table
 * `options`, group `source`, row `visible` / `source` / `rows` / `rowType`, every cell field) is written too, so a template saved
 * here loads in the legacy builder and POS exactly like one saved there.
 */

const LINES_WIRE_TYPE = 'TableInvoiceLines';
const LINES_WIRE_SOURCE = 'invoice.lines';
const LINES_SOURCE = '!invoice.lines';

/** Same shape as the legacy `guidGenerator` (seconds + random hex groups); only uniqueness matters. */
export function newElementId(): string {
  const s4 = () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  return new Date().getSeconds() + (s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4());
}

/** Legacy `migrateOldCellKeys`: old templates stored `product.name.number()`, which is just `product.name`. */
function migrateLinesCellKeys(groups: any[]): void {
  for (const g of groups) {
    for (const r of g?.rows ?? []) {
      for (const c of r?.cells ?? []) {
        if (c.key === 'product.name.number()') c.key = 'product.name';
        if (c.key === 'product.name') c.isRequired = false;
      }
    }
  }
}

/** Wire element to editor element. Never mutates the input. */
export function elementFromWire(raw: any): PrintElement {
  const el = { ...raw };
  const isLines = el.type === LINES_WIRE_TYPE
    || (el.type === 'Table' && (el.source === LINES_WIRE_SOURCE || el.source === LINES_SOURCE));
  if (isLines) {
    el.type = 'Table';
    el.source = LINES_SOURCE;
    if (Array.isArray(el.groups)) {
      el.groups = JSON.parse(JSON.stringify(el.groups));
      migrateLinesCellKeys(el.groups);
    }
  }
  return el as PrintElement;
}

/** Editor element to wire element: strips client-only keys and writes every field the legacy classes write. */
export function elementToWire(el: PrintElement): Record<string, unknown> {
  const { __key, ...rest } = el as any;
  const out: any = { ...rest, id: rest.id || newElementId() };

  if (out.type === 'Table') {
    if (out.source === LINES_SOURCE) { out.type = LINES_WIRE_TYPE; out.source = LINES_WIRE_SOURCE; }
    out.options = {
      showOptions: true, showPrice: true, showKitchenName: false, showOptionName: false, showOptionSecondaryName: false,
      ...(out.options ?? {}),
    };
    out.groups = (Array.isArray(out.groups) ? out.groups : []).map((g: any) => ({
      rows: (Array.isArray(g.rows) ? g.rows : []).map((r: any) => ({
        cells: (Array.isArray(r.cells) ? r.cells : []).map((c: any) => ({
          key: c.key ?? '',
          width: c.width ?? 50,
          type: c.type ?? '',
          value: c.value ?? '',
          alignment: c.alignment ?? '',
          isSelected: false,
          isVisible: c.isVisible !== false,
          isRequired: !!c.isRequired,
        })),
        visible: r.visible ?? { value: '', operator: '', property: '' },
        source: r.source ?? {},
        rows: Array.isArray(r.rows) ? r.rows : [],
        rowType: r.rowType ?? 'static',
      })),
      source: g.source ?? 'none',
    }));
  }
  return out;
}
