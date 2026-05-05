import type { DocumentRenderData } from './token-resolve';

/**
 * Sample render-data profiles for previews.
 *
 * Used by the document-builder form's "Preview as…" picker so users
 * can see how their templates render against realistic data without
 * needing a real entity record. The shape is also the contract entity
 * view pages must satisfy when they migrate — they'll project their
 * own model into the same fields.
 *
 * Profiles match the canonical scenarios most templates need to
 * handle:
 *   - default:    full invoice with VAT + balance due
 *   - paid:       same numbers, balance = 0 (status changes how
 *                 customerBalance card renders)
 *   - discounted: discount > 0 + grand-total reflects it
 *   - multipage:  long line list — useful for testing pagination
 */

const COMPANY = {
  name:     'ABC Trading Company W.L.L.',
  nameEn:   'ABC Trading Company W.L.L.',
  nameAr:   'شركة ABC التجارية ذ.م.م',
  vat:      '200012345600002',
  crNumber: '123456-7',
  address:  'Building 123, Road 456, Block 789, Manama',
  phone:    '+973 1700 0000',
  fax:      '+973 1700 0001',
  email:    'info@abc-trading.com',
  website:  'www.abc-trading.com',
} as const;

const CUSTOMER = {
  name:    'XYZ Enterprises Ltd.',
  vat:     '200056789400001',
  address: 'Building 55, Block 303, Road 101, Riffa, Bahrain',
  phone:   '+973 1800 0000',
  email:   'orders@xyz-enterprises.com',
} as const;

const SUPPLIER = {
  name:    'Aqua Supplies W.L.L.',
  vat:     '200011223300001',
  address: 'Industrial Area 2, Block 601, Road 2205, Sitra',
  phone:   '+973 1900 0000',
  email:   'sales@aqua-supplies.com',
} as const;

/** Sample lines carry every legacy column the table can show — qty,
 *  uom, unitCost, price, taxRate, tax, discount, amount/total. The
 *  Classic renderer picks the ones the user has marked visible in
 *  `tableCustomization`, and ignores the rest. Lines also expose
 *  `note`, `barcode`, `options`, `voidedItems` so the description
 *  column can render the rich legacy content. */
const LINES_DEFAULT = [
  {
    desc: 'Professional consulting services — Q1 2026',
    qty: 40, uom: 'hr',  price: 75,   taxRate: 10, tax: 300, discount: 0, total: 3300,
    barcode: 'P-CONS-001',
    note:    'Includes quarterly review meeting',
    options: [{ name: 'Express delivery', price: 50 }],
  },
  {
    desc: 'Software license — Annual subscription',
    qty: 1,  uom: 'pcs', price: 2400, taxRate: 10, tax: 240, discount: 0, total: 2640,
    barcode: 'P-LIC-2026',
    voidedItems: [
      // A previously-void line — renders below the main row with the
      // legacy "table-light" styling (greyed + smaller).
      { desc: 'Software license (cancelled)', qty: -1, uom: 'pcs', price: 2400, taxRate: 10, tax: -240, discount: 0, total: -2640 },
    ],
  },
  {
    desc: 'On-site support & training (3 days)',
    qty: 3,  uom: 'day', price: 450,  taxRate: 10, tax: 135, discount: 0, total: 1485,
  },
  {
    desc: 'Hardware setup & configuration',
    qty: 1,  uom: 'pcs', price: 850,  taxRate: 10, tax: 85,  discount: 0, total: 935,
  },
];

const LINES_LONG = Array.from({ length: 18 }, (_, i) => {
  const qty   = (i % 4) + 1;
  const price = 50 + (i % 7) * 25;
  const sub   = qty * price;
  return {
    desc:    `Item ${(i + 1).toString().padStart(2, '0')} — Generic placeholder description`,
    qty,
    uom:     'pcs',
    price,
    taxRate: 10,
    tax:     sub * 0.1,
    discount: 0,
    total:   sub * 1.1,
  };
});

/** Profile-id → render-data builder. Pure functions so each call
 *  starts from a clean snapshot (no shared mutable state). */
export const SAMPLE_PROFILES: Record<string, () => DocumentRenderData> = {
  default: () => ({
    company:  { ...COMPANY },
    // Branch — separate from the company so a tenant with multiple
    // locations renders the location-specific identity in the header
    // ("Branch: Main Branch", "Branch Address: …"). Falls back to
    // company values in the renderer when no branch is set.
    branch:   {
      name:    'Main Branch',
      address: 'Building 123, Road 456, Block 789, Manama',
      phone:   '+973 1700 0000',
    },
    customer: { ...CUSTOMER },
    supplier: { ...SUPPLIER },
    invoice:  {
      number:    'INV-2026-001287',
      date:      '20/04/2026',
      dueDate:   '20/05/2026',
      reference: 'PO-2026-0456',
      accountNo: 'AC-8891',
      orderNo:   'ORD-2026-0789',
      salesRep:  'Ahmed Al-Mansoori',
      service:   'Dine-in',
      line1:     LINES_DEFAULT[0].desc,
      line2:     LINES_DEFAULT[1].desc,
      // Drives the Order-summary row's tax-mode chip.
      isInclusiveTax: false,
      status:    'Issued',
      // The footer's customer-note band reads `notes` directly.
      customerNote: 'Please pay by bank transfer using the reference above.',
    },
    invoicePayments: [
      // Each entry renders as a "Payment Method" row in the orange box.
      { paymentMethodName: 'Bank Transfer', amount: 3000, status: 'SUCCESS', referenceNumber: 'TRX-789' },
      { paymentMethodName: 'Card',          amount: 1170, status: 'SUCCESS' },
    ],
    totals:   {
      subtotal:       7600,
      discount:       100,
      vat:            760,
      charge:         50,
      delivery:       30,
      rounding:       0,
      grandTotal:     8340,
      // Partially paid so the orange Payments table reads with real
      // values instead of all zeros — gives the user a meaningful
      // preview of the colours / row visibility.
      paid:           4170,
      paymentMethods: 'Cash · Card',
      credit:         200,
      balance:        3970,
      vatRate:        '10%',
      lineCount:      LINES_DEFAULT.length,
      amountInWords:  'Eight Thousand Three Hundred Forty Bahraini Dinars',
    },
    lines:    LINES_DEFAULT,
    notes:    'Thank you for your business. Payment is due within 30 days of invoice date.',
    terms:    'Goods once sold are not returnable. Late payments subject to 2% monthly service charge.',
    additional: {},
    // Sample custom-field values — only matter when the user defines
    // CFs with matching `abbr`s. Unrecognised abbrs render as
    // `[<field name>]` placeholders so the preview stays informative.
    customFieldValues: {
      branch: {
        taxOffice:    'Manama Tax Office',
        branchLicense:'CR-123-456',
      },
      entity: {
        poNumber:     'PO-2026-0456',
        deliveryNote: 'Express required',
        salesArea:    'Capital',
      },
    },
  }),

  paid: () => ({
    company:  { ...COMPANY },
    customer: { ...CUSTOMER },
    supplier: { ...SUPPLIER },
    invoice:  {
      number:    'INV-2026-001287',
      date:      '20/04/2026',
      dueDate:   '20/05/2026',
      reference: 'PO-2026-0456',
      status:    'Paid',
    },
    totals:   {
      subtotal:    7600,
      discount:    0,
      vat:         760,
      grandTotal:  8360,
      paid:        8360,
      balance:     0,
      vatRate:     '10%',
      lineCount:   LINES_DEFAULT.length,
    },
    lines:    LINES_DEFAULT,
    notes:    'Paid in full — thank you.',
    terms:    'Goods once sold are not returnable.',
    additional: {},
  }),

  discounted: () => ({
    company:  { ...COMPANY },
    customer: { ...CUSTOMER },
    supplier: { ...SUPPLIER },
    invoice:  {
      number:    'INV-2026-001288',
      date:      '21/04/2026',
      dueDate:   '21/05/2026',
      reference: 'PO-2026-0457',
    },
    totals:   {
      subtotal:    7600,
      discount:    760,
      vat:         684,
      grandTotal:  7524,
      paid:        0,
      balance:     7524,
      vatRate:     '10%',
      lineCount:   LINES_DEFAULT.length,
    },
    lines:    LINES_DEFAULT,
    notes:    'Loyalty discount applied. Thank you for your continued business.',
    terms:    'Discount valid for this invoice only.',
    additional: {},
  }),

  multipage: () => ({
    company:  { ...COMPANY },
    customer: { ...CUSTOMER },
    supplier: { ...SUPPLIER },
    invoice:  {
      number:    'INV-2026-001289',
      date:      '22/04/2026',
      dueDate:   '22/05/2026',
      reference: 'PO-2026-0458',
    },
    totals:   {
      subtotal:    LINES_LONG.reduce((a, b) => a + b.total, 0),
      discount:    0,
      vat:         LINES_LONG.reduce((a, b) => a + b.total, 0) * 0.1,
      grandTotal:  LINES_LONG.reduce((a, b) => a + b.total, 0) * 1.1,
      paid:        0,
      balance:     LINES_LONG.reduce((a, b) => a + b.total, 0) * 1.1,
      vatRate:     '10%',
      lineCount:   LINES_LONG.length,
    },
    lines:    LINES_LONG,
    notes:    'Multi-page test — confirms pagination behaviour.',
    terms:    'Standard terms apply.',
    additional: {},
  }),
};

export type SampleProfileId = keyof typeof SAMPLE_PROFILES;

export const SAMPLE_PROFILE_IDS: SampleProfileId[] =
  ['default', 'paid', 'discounted', 'multipage'];
