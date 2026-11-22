/**
 * Label helpers shared by the Products list and the product details drawer, so both surfaces word things the same way.
 * (Moved out of products-list.component.ts unchanged; the list now imports them from here.)
 */

/** Product type -> i18n key under PRODUCTS.TREE for the children pill/section: `<KEY>` plain, `<KEY>_ONE` / `<KEY>_N` with a count. */
const TREE_PILL_KEYS: Readonly<Record<string, string>> = { matrix: 'VARIANTS', inventory: 'UNITS' };

export function treePillKey(type: string | undefined | null): string {
  return (type ? TREE_PILL_KEYS[type] : undefined) ?? TREE_PILL_KEYS['inventory'];
}

/** `menuItem` -> `MENU_ITEM`: the suffix of the PRODUCTS.TYPES.* translation key the type chip uses. */
export function productTypeKey(type: string): string {
  return type.replace(/([A-Z])/g, '_$1').toUpperCase();
}
