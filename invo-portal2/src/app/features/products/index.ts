export * from './pages/products-list/products-list.component';
export * from './pages/product-form/product-form.component';
export * from './services/products.service';
export * from './services/products-side-panel.service';
export * from './models/product.model';
// product-form.model and product-fields.model are consumed directly by the
// form component; not re-exported here to avoid `Product` name collision
// with the light interface in product.model.ts used across the app.
export * from './state/products-list.state';
export * from './products.routes';
