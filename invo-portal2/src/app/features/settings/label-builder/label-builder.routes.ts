import { Routes } from '@angular/router';

/**
 * Label-builder feature routes (list page only — full-page form
 * editor is registered at the top level in `app.routes.ts` so it
 * sits outside the main layout chrome, same pattern as the
 * receipt / document builders).
 *
 *   /settings/label-builder            → list
 *   /settings/label-builder/:id        → editor (registered top-level)
 */
export const LABEL_BUILDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/label-builder-list/label-builder-list.component')
        .then(m => m.LabelBuilderListComponent),
  },
];
