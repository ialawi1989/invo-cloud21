import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  // ── Public (blocked for authenticated users) ─────────────────────────────
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login.component').then(m => m.LoginComponent),
  },

  // ── Error pages ──────────────────────────────────────────────────────────
  {
    path: '403',
    loadComponent: () =>
      import('./shared/pages/forbidden.component').then(m => m.ForbiddenComponent),
  },
  {
    path: 'feature-unavailable',
    loadComponent: () =>
      import('./shared/pages/feature-unavailable.component').then(m => m.FeatureUnavailableComponent),
  },

  // ── Full-page builders (no main layout chrome) ─────────────────────────
  // Table Management is a visual floor-plan builder — like the receipt /
  // invoice builders, it takes over the full viewport rather than living
  // inside the sidebar+topbar shell.
  {
    path: 'settings/tables',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/pages/table-management/table-management.component')
        .then(m => m.TableManagementComponent),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    // Receipt-builder editor — full-page builder like table management.
    // List page stays under MainLayoutComponent (registered below); only
    // the per-template editor takes over the viewport.
    path: 'settings/receipt-builder/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/receipt-builder/pages/receipt-builder-form/receipt-builder-form.component')
        .then(m => m.ReceiptBuilderFormComponent),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    // Document-builder editor — same full-page pattern as receipt-builder.
    // The list page lives under MainLayoutComponent (registered below);
    // the editor takes over the viewport so the canvas has room.
    path: 'settings/document-builder/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/document-builder/pages/document-builder-form/document-builder-form.component')
        .then(m => m.DocumentBuilderFormComponent),
    canDeactivate: [unsavedChangesGuard],
  },

  // ── Protected (requires login) ───────────────────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
      {
        path: 'settings/tab-builder',
        loadComponent: () =>
          import('./features/settings/pages/tab-builder-settings/tab-builder-settings.component')
            .then(m => m.TabBuilderSettingsComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'settings/business',
        loadComponent: () =>
          import('./features/settings/pages/business-settings/business-settings.component')
            .then(m => m.BusinessSettingsComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'settings/image-display',
        loadComponent: () =>
          import('./features/settings/pages/image-display-settings/image-display-settings.component')
            .then(m => m.ImageDisplaySettingsComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'settings/branches',
        loadComponent: () =>
          import('./features/settings/pages/branches-list/branches-list.component')
            .then(m => m.BranchesListComponent),
      },
      {
        path: 'settings/branches/:id',
        loadComponent: () =>
          import('./features/settings/pages/branch-form/branch-form.component')
            .then(m => m.BranchFormComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'settings/custom-fields',
        loadComponent: () =>
          import('./features/settings/pages/custom-fields-list/custom-fields-list.component')
            .then(m => m.CustomFieldsListComponent),
      },
      {
        path: 'settings/custom-fields/:type',
        loadComponent: () =>
          import('./features/settings/pages/custom-fields-manager/custom-fields-manager.component')
            .then(m => m.CustomFieldsManagerComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'settings/prefix',
        loadComponent: () =>
          import('./features/settings/pages/prefix-settings/prefix-settings.component')
            .then(m => m.PrefixSettingsComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'settings/pos-options',
        loadComponent: () =>
          import('./features/settings/pages/pos-options/pos-options.component')
            .then(m => m.PosOptionsComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'settings/invoice-options',
        loadComponent: () =>
          import('./features/settings/pages/invoice-options/invoice-options.component')
            .then(m => m.InvoiceOptionsComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'settings/tax',
        loadComponent: () =>
          import('./features/settings/pages/tax-settings/tax-settings.component')
            .then(m => m.TaxSettingsComponent),
      },
      {
        path: 'settings/kitchen',
        loadComponent: () =>
          import('./features/settings/pages/kitchen-sections-list/kitchen-sections-list.component')
            .then(m => m.KitchenSectionsListComponent),
      },
      {
        path: 'settings/kitchen/:id',
        loadComponent: () =>
          import('./features/settings/pages/kitchen-section-form/kitchen-section-form.component')
            .then(m => m.KitchenSectionFormComponent),
        canDeactivate: [unsavedChangesGuard],
      },
      // ── Content Library ─────────────────────────────────────────────────
      {
        path: 'website/content-library',
        loadComponent: () =>
          import('./features/website/content-library/pages/content-library-list/content-library-list.component').then(m => m.ContentLibraryListComponent),
      },
      {
        path: 'website/content-library/:id',
        loadComponent: () =>
          import('./features/website/content-library/pages/content-library/content-library.component').then(m => m.ContentLibraryComponent),
      },
      {
        path: 'website/content-library/:collectionId/item/:itemId',
        loadComponent: () =>
          import('./features/website/content-library/pages/content-item/content-item.component').then(m => m.ContentItemPageComponent),
      },
      {
        path: 'media',
        loadChildren: () => import('./features/media').then(m => m.MEDIA_ROUTES)
      },
      {
        path: 'products',
        loadChildren: () =>
          import('./features/products/products.routes').then(m => m.PRODUCTS_ROUTES)
      },
      {
        // Menu Builder is surfaced from Settings (see settings.component.ts
        // → SETTINGS.ITEMS.MENU_BUILDER), so it lives under /settings/* in
        // the URL space too.
        path: 'settings/menu-builder',
        loadChildren: () =>
          import('./features/menu-builder/menu-builder.routes').then(m => m.MENU_BUILDER_ROUTES)
      },
      {
        // Receipt Builder — surfaced from Settings (SETTINGS.ITEMS.RECEIPT_BUILDER).
        path: 'settings/receipt-builder',
        loadChildren: () =>
          import('./features/receipt-builder/receipt-builder.routes').then(m => m.RECEIPT_BUILDER_ROUTES)
      },
      {
        // Document Builder — surfaced from Settings (DOCUMENT_BUILDER.LIST_TITLE).
        path: 'settings/document-builder',
        loadChildren: () =>
          import('./features/document-builder/document-builder.routes').then(m => m.DOCUMENT_BUILDER_ROUTES)
      }
      // ── Add features here as you build them ──────────────────────────────
    ],
  },

  {
    path: '**',
    loadComponent: () =>
      import('./shared/pages/not-found.component').then(m => m.NotFoundComponent),
  },
];
