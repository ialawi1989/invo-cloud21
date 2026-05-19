// ── Receipt-builder binding catalog ─────────────────────────────────────
// Lists every `!invoice.*` / `!preferences.*` binding the legacy POS
// pipeline knows how to resolve at print time. Surfaced through the
// `BindableInputComponent`'s picker so the user can drop a binding in
// without remembering the exact spelling — especially handy for the
// quirky ones like `refrenceNumber` (sic — kept verbatim because that's
// the field name on the wire).
//
// Categories drive the popover's grouping. Add new bindings here when
// the POS pipeline gains a new field; the picker UI renders them
// automatically.
// ────────────────────────────────────────────────────────────────────────

export interface BindingDef {
  /** The exact wire token the POS resolves at print time. */
  value: string;
  /** Short human label shown in the picker. */
  label: string;
  /** One-liner shown under the label. */
  hint?: string;
}

export interface BindingGroup {
  /** i18n key relative to `RECEIPT_BUILDER.BINDINGS.GROUP.*`. */
  labelKey: string;
  bindings: BindingDef[];
}

export const BINDING_GROUPS: BindingGroup[] = [
  {
    labelKey: 'INVOICE_HEADER',
    bindings: [
      { value: '!invoice.invoiceNumber',                  label: 'Invoice number' },
      { value: '!invoice.serviceName',                    label: 'Service' },
      { value: '!invoice.refrenceNumber',                 label: 'Reference number' }, // legacy spelling
      { value: '!invoice.id',                             label: 'Invoice id', hint: 'Used for QR feedback links' },
      { value: '!invoice.createdAt.shortDate()',          label: 'Created — date' },
      { value: '!invoice.createdAt.shortTime()',          label: 'Created — time' },
      { value: '!invoice.printTime.longDate()',           label: 'Printed — long date' },
      { value: '!invoice.scheduleTime.shortDate()',       label: 'Scheduled — date' },
      { value: '!invoice.scheduleTime.shortTime()',       label: 'Scheduled — time' },
    ],
  },
  {
    labelKey: 'INVOICE_PARTIES',
    bindings: [
      { value: '!invoice.employeeName',     label: 'Server / employee' },
      { value: '!invoice.customerName',     label: 'Customer name' },
      { value: '!invoice.customerContact',  label: 'Customer contact' },
      { value: '!invoice.customerAddress',  label: 'Customer address' },
      { value: '!invoice.note',             label: 'Invoice note' },
      { value: '!invoice.tableName',        label: 'Table name' },
      { value: '!invoice.table.name',       label: 'Table name (object)' },
    ],
  },
  {
    labelKey: 'INVOICE_TOTALS',
    bindings: [
      { value: '!invoice.itemSubTotal.currency()',                label: 'Items subtotal' },
      { value: '!invoice.itemDiscountTotal.currency()',           label: 'Items discount' },
      { value: '!invoice.itemSubTotalAfterDiscount.currency()',   label: 'Items after discount' },
      { value: '!invoice.discountAmount',                         label: 'Discount %' },
      { value: '!invoice.discountTotal.currency()',               label: 'Discount total' },
      { value: '!invoice.chargeTotal.currency()',                 label: 'Charges' },
      { value: '!invoice.deliveryCharge.currency()',              label: 'Delivery charge' },
      { value: '!invoice.roundingTotal.currency()',               label: 'Rounding' },
      { value: '!invoice.total.currency()',                       label: 'Total' },
      { value: '!invoice.balance.currency()',                     label: 'Balance due' },
      { value: '!invoice.change.currency()',                      label: 'Change due' },
      { value: '!invoice.isPaid',                                 label: 'Paid flag (0/1)' },
    ],
  },
  {
    labelKey: 'INVOICE_TAX',
    bindings: [
      { value: '!invoice.zatcaCode',  label: 'ZATCA QR payload', hint: 'Saudi Arabia tax-compliance QR' },
    ],
  },
  {
    labelKey: 'PREFERENCES',
    bindings: [
      { value: '!preferences.name',           label: 'Business name' },
      { value: '!preferences.branchName',     label: 'Branch name' },
      { value: '!preferences.branchAddress',  label: 'Branch address' },
      { value: '!preferences.phoneNumber',    label: 'Phone' },
      { value: '!preferences.vatNumber',      label: 'VAT number' },
      { value: '!preferences.logo',           label: 'Company logo (image)' },
    ],
  },
];

/** Flat list of every binding, useful for fuzzy search across groups. */
export const ALL_BINDINGS: BindingDef[] = BINDING_GROUPS.flatMap((g) => g.bindings);
