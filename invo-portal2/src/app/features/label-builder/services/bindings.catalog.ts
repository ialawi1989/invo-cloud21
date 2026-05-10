// ── Label-builder binding catalog ──────────────────────────────────────
// Mirrors the shape of the receipt-builder catalog so the same
// `<app-bindable-input>` widget can power the picker. Two static
// bundles (PRODUCT_GROUPS for label templates, KITCHEN_GROUPS for
// kitchen-ticket templates) plus a runtime helper that appends a
// "Custom fields" group from the live customization payload.
//
// Categories drive the popover's grouping. Add new bindings here when
// the renderer gains a new field; the picker UI renders them
// automatically.
// ────────────────────────────────────────────────────────────────────────

export interface BindingDef {
  /** The exact wire token the renderer / ZPL emitter resolves at
   *  print time. */
  value: string;
  /** Short human label shown in the picker. */
  label: string;
  /** One-liner shown under the label. */
  hint?: string;
}

export interface BindingGroup {
  /** i18n key relative to `LABEL_BUILDER.BINDINGS.GROUP.*`. */
  labelKey: string;
  bindings: BindingDef[];
}

/** Bindings available on product-label templates (the default). */
export const PRODUCT_GROUPS: BindingGroup[] = [
  {
    labelKey: 'PRODUCT_CORE',
    bindings: [
      { value: '!product.name',                  label: 'Product name' },
      { value: '!product.barcode',               label: 'Barcode' },
      { value: '!product.sku',                   label: 'SKU' },
      { value: '!product.UOM',                   label: 'Unit of measure' },
      { value: '!product.description',           label: 'Description' },
      { value: '!product.type',                  label: 'Type' },
      { value: '!product.categoryName',          label: 'Category' },
      { value: '!product.departmentName',        label: 'Department' },
    ],
  },
  {
    labelKey: 'PRODUCT_PRICING',
    bindings: [
      { value: '!product.price.currency()',         label: 'Price', hint: 'Default selling price (currency)' },
      { value: '!product.priceWithTax.currency()',  label: 'Price with tax' },
      { value: '!product.unitCost.currency()',      label: 'Unit cost' },
    ],
  },
  {
    labelKey: 'PRODUCT_INVENTORY',
    bindings: [
      { value: '!product.onHand',                label: 'On-hand qty' },
      { value: '!product.serial',                label: 'Serial' },
      { value: '!product.batch',                 label: 'Batch' },
      { value: '!product.expireDate.shortDate()', label: 'Expiry date' },
      { value: '!product.weightUnit',            label: 'Weight unit' },
      { value: '!product.preparationTime',       label: 'Preparation time' },
      { value: '!product.serviceTime',           label: 'Service time' },
    ],
  },
  {
    labelKey: 'PRODUCT_NUTRITION',
    bindings: [
      { value: '!product.nutrition.kcal',     label: 'Calories (kcal)' },
      { value: '!product.nutrition.fat',      label: 'Fat' },
      { value: '!product.nutrition.carb',     label: 'Carbs' },
      { value: '!product.nutrition.protien',  label: 'Protein', hint: 'Field name preserved (legacy spelling)' },
    ],
  },
  {
    labelKey: 'PRODUCT_LINKS',
    bindings: [
      { value: '!product.url',          label: 'Product URL', hint: 'Storefront view-only link' },
      { value: '!product.urlAddToCart', label: 'Add-to-cart URL' },
    ],
  },
];

/** Bindings available on kitchen-ticket templates — invoice line
 *  context, not product context. */
export const KITCHEN_GROUPS: BindingGroup[] = [
  {
    labelKey: 'INVOICE_LINE',
    bindings: [
      { value: '!invoiceLines.product.name', label: 'Item name' },
      { value: '!invoiceLines.qty',          label: 'Quantity' },
      { value: '!invoiceLines.UOM',          label: 'Unit of measure' },
      { value: '!invoiceLines.optionsText',  label: 'Options text' },
      { value: '!invoiceLines.note',         label: 'Line note' },
      { value: '!invoiceLines.seatNumber',   label: 'Seat number' },
      { value: '!invoiceLines.serial',       label: 'Serial' },
      { value: '!invoiceLines.batch',        label: 'Batch' },
    ],
  },
  {
    labelKey: 'INVOICE_LINE_TOTALS',
    bindings: [
      { value: '!invoiceLines.total.currency()',         label: 'Line total' },
      { value: '!invoiceLines.discountTotal.currency()', label: 'Line discount' },
      { value: '!invoiceLines.taxTotal.currency()',      label: 'Line tax' },
    ],
  },
  {
    labelKey: 'INVOICE_LINE_IDS',
    bindings: [
      { value: '!invoiceLines.id',         label: 'Line id' },
      { value: '!invoiceLines.invoiceId',  label: 'Invoice id' },
    ],
  },
];

/** Return the full set of binding groups for the given template
 *  type, optionally appending a `PRODUCT_CUSTOM` group built from
 *  the live custom-fields payload so users can pick `!product.custom.{abbr}`
 *  tokens by their actual field name instead of memorizing abbrs. */
export function getBindingGroups(
  type: 'label' | 'kitchen' | '',
  customFields?: ReadonlyArray<{ abbr: string; label: string; type: string }>,
): BindingGroup[] {
  if (type === 'kitchen') return [...KITCHEN_GROUPS];
  const groups = [...PRODUCT_GROUPS];
  if (customFields && customFields.length) {
    groups.push({
      labelKey: 'PRODUCT_CUSTOM',
      bindings: customFields.map((cf) => ({
        value: `!product.custom.${cf.abbr}`,
        label: cf.label || cf.abbr,
        hint:  cf.type ? `Custom field · ${cf.type}` : undefined,
      })),
    });
  }
  return groups;
}
