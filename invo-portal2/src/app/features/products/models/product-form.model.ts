// Re-export barrel. Keeps the legacy import path
//   `@features/products/models/product-form.model`
// working while the class, nested models, interfaces, and utils live in
// dedicated chunks under ./product-form/ for easier browsing.

export * from './product-form/index';
