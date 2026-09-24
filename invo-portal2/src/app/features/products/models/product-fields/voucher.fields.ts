import { Fields } from './interfaces';
import { inventoryFields } from './inventory.fields';

// Gift-voucher product config, ported from the legacy `voucherProduct`.
//
// The legacy object only lists what a voucher shows — anything it omits is
// simply not rendered. This `Fields` type marks many members required, and
// several form sections read them, so the omitted ones are filled with hidden
// defaults (derived from a full config, with every flag switched off). Result:
// same visibility as the legacy config, without undefined lookups.

type Node = Record<string, any>;

function hideAll(node: any): any {
  if (typeof node === 'boolean') return false;
  if (Array.isArray(node) || node === null || typeof node !== 'object') return node;
  const out: Node = {};
  for (const k of Object.keys(node)) {
    const v = (node as Node)[k];
    if (k === 'isVisible' || k === 'isRequired' || k === 'isDisabled') out[k] = false;
    else out[k] = hideAll(v);
  }
  return out;
}

function merge(base: Node, over: Node): Node {
  const out: Node = { ...base };
  for (const k of Object.keys(over)) {
    const b = out[k];
    const o = over[k];
    out[k] = b && o && typeof b === 'object' && typeof o === 'object' && !Array.isArray(o) ? merge(b, o) : o;
  }
  return out;
}

const visible = (isRequired = false) => ({ isVisible: true, isDisabled: false, isRequired });

const VOUCHER_CONFIG: Node = {
  name: visible(true),
  barcode: visible(true),
  SKU: visible(),
  description: visible(),
  pricing: {
    defaultPrice: visible(true),
    tax: visible(),
  },
  image: true,
  department: visible(),
  category: visible(),
  brand: visible(),
  maxItemPerTicket: visible(),
  tags: visible(),
  itemMessage: visible(),
  warning: { isVisible: false, isDisabled: false, isRequired: false },
  aliasBarcodes: visible(),
  aliasBarcodesList: visible(),
  altProduct: visible(),
  branchProduct: {
    available: true,
    availableOnline: true,
    differentPrice: true,
    price: visible(),
  },
  customFields: visible(),
  isTaxable: visible(),
  isSaleItem: visible(),
  saleAccount: visible(),
  promotionSettings: {
    voucherName: visible(true),
    initialVoucher: visible(true),
    expiryPeriod: visible(),
    activePeriod: visible(),
    oneTimeUse: visible(),
    private: visible(),
  },
};

export const voucherFields: Fields = merge(hideAll(inventoryFields), VOUCHER_CONFIG) as Fields;
