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
      import('./features/settings/receipt-builder/pages/receipt-builder-form/receipt-builder-form.component')
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
      import('./features/settings/document-builder/pages/document-builder-form/document-builder-form.component')
        .then(m => m.DocumentBuilderFormComponent),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    // Label-builder editor — full-page like the other builders. The
    // list page is registered under MainLayoutComponent below.
    path: 'settings/label-builder/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/label-builder/pages/label-builder-form/label-builder-form.component')
        .then(m => m.LabelBuilderFormComponent),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    // Blog post composer — Wix-style full-page editor with its own
    // chrome (top bar / icon rail / side panel). Sits OUTSIDE the
    // admin's sidebar+topbar shell so it can use the whole viewport,
    // matching the receipt / document / label / table builders above.
    // The list page (/blog/posts) stays inside MainLayoutComponent.
    path: 'blog/posts/new',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/blog/blog-composer.routes').then(m => m.BLOG_COMPOSER_ROUTES),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'blog/posts/:id/edit',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/blog/blog-composer.routes').then(m => m.BLOG_COMPOSER_ROUTES),
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
        // Media Manager lives under /settings/media (IA: it's a
        // tenant-wide configuration of assets, alongside Image
        // Display). Redirect the legacy /media path so any existing
        // bookmarks / sidebar items keep working.
        path: 'media',
        redirectTo: 'settings/media',
        pathMatch: 'full',
      },
      {
        path: 'settings/media',
        loadChildren: () => import('./features/settings/media').then(m => m.MEDIA_ROUTES)
      },
      {
        path: 'settings/seo',
        loadChildren: () => import('./features/settings/seo/seo.routes').then(m => m.SEO_ROUTES)
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
          import('./features/settings/menu-builder/menu-builder.routes').then(m => m.MENU_BUILDER_ROUTES)
      },
      {
        // Receipt Builder — surfaced from Settings (SETTINGS.ITEMS.RECEIPT_BUILDER).
        path: 'settings/receipt-builder',
        loadChildren: () =>
          import('./features/settings/receipt-builder/receipt-builder.routes').then(m => m.RECEIPT_BUILDER_ROUTES)
      },
      {
        // Document Builder — surfaced from Settings (DOCUMENT_BUILDER.LIST_TITLE).
        path: 'settings/document-builder',
        loadChildren: () =>
          import('./features/settings/document-builder/document-builder.routes').then(m => m.DOCUMENT_BUILDER_ROUTES)
      },
      {
        // Label Builder — Zebra-style label / kitchen-ticket designer.
        path: 'settings/label-builder',
        loadChildren: () =>
          import('./features/settings/label-builder/label-builder.routes').then(m => m.LABEL_BUILDER_ROUTES)
      },
      {
        // Price Labels — named per-product price overrides (wholesale,
        // branch-specific, customer-segment lists). Mounted under
        // `/settings/*` to match the receipt-/label-/document-builder
        // convention.
        path: 'settings/price-label',
        loadChildren: () =>
          import('./features/settings/price-label/price-label.routes').then(m => m.PRICE_LABEL_ROUTES)
      },
      {
        // Surcharges — named fixed/percentage charges that get
        // applied to invoices and receipts. Settings tile already
        // links here.
        path: 'settings/surcharge',
        loadChildren: () =>
          import('./features/settings/surcharge/surcharge.routes').then(m => m.SURCHARGE_ROUTES)
      },
      {
        // Covered Addresses — single-page configuration of where
        // we deliver, with per-area branch + delivery economics.
        path: 'settings/covered-address',
        loadChildren: () =>
          import('./features/settings/covered-address/covered-address.routes').then(m => m.COVERED_ADDRESS_ROUTES)
      },
      {
        // Covered Zones — radius-based delivery zones around each
        // branch's pinned location, plus the company's pickup
        // max distance.
        path: 'settings/covered-zone',
        loadChildren: () =>
          import('./features/settings/covered-zone/covered-zone.routes').then(m => m.COVERED_ZONE_ROUTES)
      },
      {
        // Shipping — cross-border zones grouping countries with
        // weight/total-based shipping rate ranges.
        path: 'settings/shipping',
        loadChildren: () =>
          import('./features/settings/shipping/shipping.routes').then(m => m.SHIPPING_ROUTES)
      },
      {
        // Shipping & Delivery hub — single page that picks between
        // shipping (country zones), delivery-by-address, or
        // delivery-by-radius and embeds the matching editor.
        path: 'settings/shipping-delivery',
        loadChildren: () =>
          import('./features/settings/shipping-delivery/shipping-delivery.routes').then(m => m.SHIPPING_DELIVERY_ROUTES)
      },
      {
        // Discounts — named per-company discounts applied at POS /
        // checkout. Lean MVP: name, amount/percentage, product +
        // branch scope. Automatic schedules deferred.
        path: 'settings/discounts',
        loadChildren: () =>
          import('./features/settings/discount/discount.routes').then(m => m.DISCOUNT_ROUTES)
      },
      {
        // Payment methods — manual Cash + Card methods (regular
        // form), plus an Online tab listing providers the company
        // can enable. Per-provider connect forms ship one at a time;
        // AFS is the first.
        path: 'settings/payment-methods',
        loadChildren: () =>
          import('./features/settings/payment-methods/payment-methods.routes').then(m => m.PAYMENT_METHODS_ROUTES)
      },
      {
        // Plugins — per-company integrations grouped by type
        // (delivery aggregators, notification gateways, fiscal
        // utilities, Content AI). Catalogue list + per-plugin forms.
        path: 'settings/plugins',
        loadChildren: () =>
          import('./features/settings/plugins/plugins.routes').then(m => m.PLUGINS_ROUTES)
      },
      {
        // Service Management — POS service types (DineIn, PickUp,
        // Delivery, CarHop, Salon, Catering, Retail) with per-branch
        // setting overrides + drag-reorder.
        path: 'settings/service-management',
        loadChildren: () =>
          import('./features/settings/service-management/service-management.routes').then(m => m.SERVICE_MANAGEMENT_ROUTES)
      },
      {
        // Blog — top-level area with Posts / Categories & Tags / Comments /
        // Settings. See `features/blog/blog.routes.ts`.
        path: 'blog',
        loadChildren: () =>
          import('./features/blog/blog.routes').then(m => m.BLOG_ROUTES)
      },
      {
        // Chart of Accounts — the company's general ledger. List
        // page + form for individual accounts. Lives under
        // `/account/*` to match the legacy sidebar grouping
        // (Accounts → Chart of Accounts / Opening Balances / …).
        // Reused by the payment-methods feature's inline
        // "Create new account" modal via the shared
        // `<app-account-form-fields>` component.
        path: 'account/chart-of-accounts',
        loadChildren: () =>
          import('./features/settings/chart-of-accounts/chart-of-accounts.routes').then(m => m.CHART_OF_ACCOUNTS_ROUTES)
      },
      {
        // Analytics — store-wide GA4 traffic + e-commerce + realtime and
        // GSC search. Distinct from the blog-scoped `/blog/analytics`.
        path: 'analytics',
        loadChildren: () =>
          import('./features/analytics/analytics.routes').then(m => m.ANALYTICS_ROUTES)
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
