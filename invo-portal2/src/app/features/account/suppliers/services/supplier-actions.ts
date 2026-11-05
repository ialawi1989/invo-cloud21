import { Injectable, inject } from '@angular/core';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';

/**
 * Single home of "may this button show?" for suppliers: the list, the form and (later) the dashboard all
 * read these rules, so a privilege can never be honoured on one screen and ignored on another.
 * Editing a supplier reuses the "add" privilege, as in legacy.
 */
@Injectable({ providedIn: 'root' })
export class SupplierActions {
  private privileges = inject(PrivilegeService);
  private can = (p: string) => this.privileges.check(p);

  get canAdd() { return this.can('supplierSecurity.actions.add.access'); }
  get canEdit() { return this.canAdd; }
  get canImportExport() { return this.can('supplierSecurity.actions.importExport.access'); }
}
