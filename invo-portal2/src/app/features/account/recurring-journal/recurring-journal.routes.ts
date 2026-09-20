import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * Recurring Journal — accounting feature under `/account/recurring-journal`.
 * Sidebar entry + privilege registry entry already existed before this
 * feature was built (see `sidebar.component.ts` id 64 and
 * `recurringJournalSecurity.ts`); this file supplies the routes those
 * already pointed at.
 *
 *   /account/recurring-journal          → list
 *   /account/recurring-journal/new      → create form
 *   /account/recurring-journal/:id      → read-only view
 *   /account/recurring-journal/:id/edit → edit form
 *
 * Static `new` is declared before `:id` so it wins the match.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('account/recurring-journal');
  return true;
};

export const RECURRING_JOURNAL_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'recurringJournalSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/recurring-journal-list/recurring-journal-list.component')
        .then(m => m.RecurringJournalListComponent),
  },
  {
    path: 'new',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'recurringJournalSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/recurring-journal-form/recurring-journal-form.component')
        .then(m => m.RecurringJournalFormComponent),
  },
  {
    path: ':id/edit',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'recurringJournalSecurity.actions.add.access' },
    loadComponent: () =>
      import('./pages/recurring-journal-form/recurring-journal-form.component')
        .then(m => m.RecurringJournalFormComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'recurringJournalSecurity.actions.view.access' },
    loadComponent: () =>
      import('./pages/recurring-journal-view/recurring-journal-view.component')
        .then(m => m.RecurringJournalViewComponent),
  },
];
