import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

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
      },
      {
        path: 'settings/business',
        loadComponent: () =>
          import('./features/settings/pages/business-settings/business-settings.component')
            .then(m => m.BusinessSettingsComponent),
      },
      {
        path: 'settings/image-display',
        loadComponent: () =>
          import('./features/settings/pages/image-display-settings/image-display-settings.component')
            .then(m => m.ImageDisplaySettingsComponent),
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
