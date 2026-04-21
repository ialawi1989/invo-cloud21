// Barrel + composed ProductFields class.
// All shared interfaces live in `./interfaces.ts`; each concrete per-type
// config lives in its own `<type>.fields.ts` for easier browsing.

export * from './interfaces';

import { Fields } from './interfaces';
import { inventoryFields }     from './inventory.fields';
import { serializedFields }    from './serialized.fields';
import { batchFields }         from './batch.fields';
import { kitFields }           from './kit.fields';
import { serviceFields }       from './service.fields';
import { packageFields }       from './package.fields';
import { menuItemFields }      from './menuItem.fields';
import { menuSelectionFields } from './menuSelection.fields';
import { tailoringFields }     from './tailoring.fields';

// Re-export individual configs so consumers can import a single type lazily.
export {
  inventoryFields,
  serializedFields,
  batchFields,
  kitFields,
  serviceFields,
  packageFields,
  menuItemFields,
  menuSelectionFields,
  tailoringFields,
};

/**
 * ProductFields
 * ─────────────
 * Aggregate object exposing one `Fields` config per product type. The form
 * component indexes into this by route `:type` param, e.g.
 *   const f = (new ProductFields() as any)[type];
 */
export class ProductFields {
  inventory:     Fields = inventoryFields;
  serialized:    Fields = serializedFields;
  batch:         Fields = batchFields;
  kit:           Fields = kitFields;
  service:       Fields = serviceFields;
  package:       Fields = packageFields;
  menuItem:      Fields = menuItemFields;
  menuSelection: Fields = menuSelectionFields;
  tailoring:     Fields = tailoringFields;
}
