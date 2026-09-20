import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * Manual Journals — accounting feature under `/account/manual-journals`.
 * Sidebar entry + privilege registry entry already existed before this
 * feature was built (`sidebar.component.ts` and `manualJournalSecurity.ts`);
 * this file supplies the routes those already pointed at, mirroring the
 * sibling Recurring Journal feature's route/guard conventions.
 *
 *   /account/manual-journals            → list
 *   /account/manual-journals/:id        → create ('new') / edit / clone
 *                                          (?clone=true, matches legacy)
 *   /account/manual-journals/view/:id   → read-only view
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('account/manual-journals');
  return true;
};

export const MANUAL_JOURNALS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'manualJournalSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/list/manual-journals-list.component')
        .then(m => m.ManualJournalsListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'manualJournalSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/view/manual-journal-view.component')
        .then(m => m.ManualJournalViewComponent),
  },
  {
    // Static 'view/:id' is declared above this so it wins the match ahead
    // of this catch-all ':id' (create/edit/clone).
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'manualJournalSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/form/manual-journal-form.component')
        .then(m => m.ManualJournalFormComponent),
  },
];
