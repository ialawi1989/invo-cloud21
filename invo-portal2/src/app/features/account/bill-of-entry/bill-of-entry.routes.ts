import '../account-i18n';
import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { privilegeGuard } from '@core/guards/privilege.guard';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';
import { BillOfEntryService } from './services/bill-of-entry.service';
import { BillOfEntryActions } from './services/bill-of-entry-actions';
import { docEditableGuard } from '../guards/doc-editable.guard';

// /account/bill-of-entry               -> list
// /account/bill-of-entry/view/:id      -> view
// /account/bill-of-entry/0/:billId     -> new, made from that bill ("Create Bill Of Entry" on a bill)
// /account/bill-of-entry/:id           -> edit

const translationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('account/bill-of-entry');
  return true;
};

const form = () => import('./pages/bill-of-entry-form/bill-of-entry-form.component').then(m => m.BillOfEntryFormComponent);

/** `/account/bill-of-entry/:id`: a bill of entry in a locked period opens read-only. */
const billOfEntryEditableGuard = docEditableGuard(() => {
  const svc = inject(BillOfEntryService);
  const actions = inject(BillOfEntryActions);
  return {
    load: (id: string) => svc.getBillOfEntry(id),
    block: async (b: any) => { await actions.refresh(b.branchId || null); return actions.editStateBlock(b); },
  };
}, '/account/bill-of-entry/view');

export const BILL_OF_ENTRY_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'billOfEntrySecurity.actions.view.access' },
    loadComponent: () => import('./pages/bill-of-entry-list/bill-of-entry-list.component').then(m => m.BillOfEntryListComponent),
  },
  {
    path: 'view/:id',
    canActivate: [translationsLoaded, privilegeGuard],
    data: { permissionPath: 'billOfEntrySecurity.actions.view.access' },
    loadComponent: () => import('./pages/bill-of-entry-view/bill-of-entry-view.component').then(m => m.BillOfEntryViewComponent),
  },
  {
    path: ':id/:billId',
    canActivate: [translationsLoaded, privilegeGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'billOfEntrySecurity.actions.add.access' },
    loadComponent: form,
  },
  {
    path: ':id',
    canActivate: [translationsLoaded, privilegeGuard, billOfEntryEditableGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permissionPath: 'billOfEntrySecurity.actions.add.access' },
    loadComponent: form,
  },
];
