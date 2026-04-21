// Thin re-export shim so existing imports keep working.
// The real configuration was split into `./product-fields/` for easier
// browsing:
//
//   ./product-fields/interfaces.ts         — shared interfaces (Fields, FieldTemplate, …)
//   ./product-fields/<type>.fields.ts      — one file per product type
//   ./product-fields/index.ts              — composes everything into `ProductFields`
//
// No behavioural change; pure file reorganisation.

export * from './product-fields/index';
