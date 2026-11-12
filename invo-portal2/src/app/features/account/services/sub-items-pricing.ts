/**
 * Package / menu-selection ("sub items") pricing — port of legacy `sub-items-pricing.ts`.
 *
 * Mirrors InvoiceLine.setPrice() of the backend, which stays the source of truth: the parent line
 * (the package or menu selection product) carries the price and the sub items are priced at 0.
 *
 *  fixedPrice              parent defaultPrice
 *  fixedPriceWOption       parent defaultPrice + the defaultPrice of every sub item option
 *  totalPrice              sum of (sub item defaultPrice + its options defaultPrice)
 *  totalPriceWithDiscount  totalPrice - priceModel.discount
 *
 * The calculation is always made from `defaultPrice` (never from `price`), so it can run any number of times.
 * Same as the backend, the sub item qty is not part of the total.
 */
import { MathUtils } from '@core/math/math-helpers';

export interface SubItemOptionLike { price: number; defaultPrice?: number; }
export interface SubItemLike { price: number; defaultPrice?: number; options: SubItemOptionLike[]; }
export interface SubItemsParentLike {
  price: number;
  defaultPrice?: number;
  priceModel?: { model?: string; discount?: number } | null;
  /** a price typed by the user for a model that calculates it (total price models), replaces the calculated one */
  priceOverride?: number | null;
  subItems: SubItemLike[];
}

/** package and menu selection products are the ones that are picked with sub items */
export function isSubItemsProduct(type: string | null | undefined): boolean {
  return type === 'package' || type === 'menuSelection';
}

/** the line's price comes from its sub items (set in the popup, not typed on the line) */
export function hasSubItemsPrice(line: { selectedItem?: { type?: string } | null } | null | undefined): boolean {
  return isSubItemsProduct(line?.selectedItem?.type);
}

export function hasSubItems(line: { subItems?: any[] } | null | undefined): boolean {
  return !!line && Array.isArray(line.subItems) && line.subItems.length > 0;
}

export function applySubItemsPricing(parent: SubItemsParentLike): void {
  if (!hasSubItems(parent) || !parent.priceModel?.model) return;

  const model = parent.priceModel.model;
  const discount = parent.priceModel.discount ?? 0;
  const parentDefault = parent.defaultPrice ?? 0;

  let optionsDefault = 0;
  let itemsTotal = 0;

  parent.subItems.forEach((item) => {
    let itemTotal = item.defaultPrice ?? 0;
    (item.options ?? []).forEach((op) => {
      itemTotal = MathUtils.add2(itemTotal, op.defaultPrice ?? 0);
      optionsDefault = MathUtils.add2(optionsDefault, op.defaultPrice ?? 0);
      op.price = 0;
    });
    itemsTotal = MathUtils.add2(itemsTotal, itemTotal);
    item.price = 0;
  });

  switch (model) {
    case 'fixedPrice': parent.price = MathUtils.roundDecimal(parentDefault); break;
    case 'fixedPriceWOption': parent.price = MathUtils.roundDecimal(MathUtils.add2(parentDefault, optionsDefault)); break;
    case 'totalPrice': parent.price = MathUtils.roundDecimal(itemsTotal); break;
    case 'totalPriceWithDiscount': parent.price = MathUtils.roundDecimal(MathUtils.sub2(itemsTotal, discount)); break;
    default: break;
  }

  /** only the models that calculate the price can be overridden, the fixed ones are changed through defaultPrice */
  if ((model === 'totalPrice' || model === 'totalPriceWithDiscount') && parent.priceOverride != null) {
    parent.price = MathUtils.roundDecimal(parent.priceOverride);
  }
}

/** shape returned by POST accounts/getSubItems (one row per product) */
export interface SubItemsDefinition {
  productName: string;
  priceModel: { model?: string; discount?: number } | null;
  /** menu selection: levels, package: the flat list of items */
  items: any[];
}

export function isMenuSelectionDefinition(def: SubItemsDefinition | null): boolean {
  return !!def && def.items.length > 0 && def.items[0].levelName !== undefined;
}
