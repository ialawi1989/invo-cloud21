import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { privilegeGuard } from '@core/guards/privilege.guard';

// ── URL pattern ──────────────────────────────────────────────────────────────
// /products                            → redirects to /products/list
// /products/list                       → product list
// /products/form/:type/new             → create a new product of :type
// /products/form/:type/:id             → edit an existing product (id ≠ 'new')
// /products/form/:type/:id?clone=true  → clone source :id into a new product
//
// :type is one of: inventory | serialized | batch | kit | service |
//                  package  | menuItem   | menuSelection | tailoring
// Keeping :type in the URL lets the form resolve field visibility
// (`fieldsOptions`) instantly from the route, before the product loads.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blocks route activation until the `products` translation namespace is
 * fetched and merged. Prevents templates from rendering raw `PRODUCTS.*`
 * keys on first paint.
 *
 * Uses a module-level cache so we only pay the HTTP cost on the first
 * navigation into the products feature per language — LanguageService
 * itself also dedups via its `loaded` map.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('products');
  return true;
};

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/products-list/products-list.component').then(m => m.ProductsListComponent),
    data: { permissionPath: 'productSecurity.actions.view' },
  },
  {
    path: 'form/:type/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent),
    // `add` is the Add/Edit privilege in this model — there is no separate
    // edit action (see privileges/definitions/productSecurity.ts).
    data: { permissionPath: 'productSecurity.actions.add.access' },
  },
  {
    path: 'bulk-print',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/bulk-print/bulk-print.component').then(m => m.BulkPrintComponent),
    // Same gate as the per-row Print Label action.
    data: { permissionPath: 'productSecurity.actions.printBarcode.access' },
  },

  // ── Classifications: Departments ──────────────────────────────────────────
  {
    path: 'department',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/departments/departments-list.component').then(m => m.DepartmentsListComponent),
    data: { permissionPath: 'departmentSecurity.actions.view' },
  },
  {
    path: 'department/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/departments/department-form.component').then(m => m.DepartmentFormComponent),
    data: { permissionPath: 'departmentSecurity.actions.add.access' },
  },

  // ── Classifications: Categories ───────────────────────────────────────────
  {
    path: 'category',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/categories/categories-list.component').then(m => m.CategoriesListComponent),
    data: { permissionPath: 'categorySecurity.actions.view' },
  },
  {
    path: 'category/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/categories/category-form.component').then(m => m.CategoryFormComponent),
    data: { permissionPath: 'categorySecurity.actions.add.access' },
  },

  // ── Classifications: Brands ───────────────────────────────────────────────
  {
    path: 'brands',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/brands/brands-list.component').then(m => m.BrandsListComponent),
    data: { permissionPath: 'brandSecurity.actions.view' },
  },
  {
    path: 'brands/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/brands/brand-form.component').then(m => m.BrandFormComponent),
    data: { permissionPath: 'brandSecurity.actions.add.access' },
  },

  // ── Options & Recipes: Recipes ────────────────────────────────────────────
  {
    path: 'recipe',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/recipes/recipes-list.component').then(m => m.RecipesListComponent),
    data: { permissionPath: 'recipeSecurity.actions.view' },
  },
  {
    path: 'recipe/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/recipes/recipe-form.component').then(m => m.RecipeFormComponent),
    data: { permissionPath: 'recipeSecurity.actions.add.access' },
  },

  // ── Options & Recipes: Options ────────────────────────────────────────────
  {
    path: 'option',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/options/options-list.component').then(m => m.OptionsListComponent),
    data: { permissionPath: 'optionSecurity.actions.view' },
  },
  {
    // Must precede `option/:id` so it isn't swallowed as an option id.
    path: 'option-availability',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/options/option-availability.component').then(m => m.OptionAvailabilityComponent),
    data: { permissionPath: 'optionSecurity.actions.optionAvailable.access' },
  },
  {
    path: 'option/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/options/option-form.component').then(m => m.OptionFormComponent),
    data: { permissionPath: 'optionSecurity.actions.add.access' },
  },

  // ── Options & Recipes: Option Groups ──────────────────────────────────────
  {
    path: 'option-group',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/option-groups/option-groups-list.component').then(m => m.OptionGroupsListComponent),
    data: { permissionPath: 'optionGroupSecurity.actions.view' },
  },
  {
    path: 'option-group/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/option-groups/option-group-form.component').then(m => m.OptionGroupFormComponent),
    data: { permissionPath: 'optionGroupSecurity.actions.add.access' },
  },

  // ── Options & Recipes: Product Recipe (quick menu-item recipe editor) ──────
  {
    path: 'product-recipe',
    canActivate: [translationsLoaded, privilegeGuard],
    loadComponent: () =>
      import('./pages/product-recipe/product-recipe.component').then(m => m.ProductRecipeComponent),
    data: { permissionPath: 'recipeSecurity.actions.view' },
  },
];
