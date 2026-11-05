import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

// /account/credit-notes                           → list
// /account/credit-notes/view/:id                  → view
// /account/credit-notes/refund/:creditNoteId      → refund the unused balance (refund/view/:id edits one)
// /account/credit-notes/:id                       → form (0 / new = create, picks the invoice to credit)
// /account/credit-notes/:id/forInvoice/:invoiceId → form for one invoice ("Create Credit Note" on an invoice)

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/credit-notes');
  return true;
};

const form = () => import('./pages/credit-note-form/credit-note-form.component').then(m => m.CreditNoteFormComponent);

const refundForm = () => import('./pages/credit-note-refund-form/credit-note-refund-form.component').then(m => m.CreditNoteRefundFormComponent);

export const CREDIT_NOTES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'creditNoteSecurity.actions.view.access' },
    loadComponent: () => import('./pages/credit-notes-list/credit-notes-list.component').then(m => m.CreditNotesListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'creditNoteSecurity.actions.view.access' },
    loadComponent: () => import('./pages/credit-note-view/credit-note-view.component').then(m => m.CreditNoteViewComponent),
  },
  {
    path: 'refund/view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'creditNoteSecurity.actions.refund.access' },
    loadComponent: refundForm,
  },
  {
    path: 'refund/:creditNoteId',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'creditNoteSecurity.actions.refund.access' },
    loadComponent: refundForm,
  },
  {
    path: ':id/forInvoice/:invoiceId',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'creditNoteSecurity.actions.add.access' },
    loadComponent: form,
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'creditNoteSecurity.actions.add.access' },
    loadComponent: form,
  },
];
