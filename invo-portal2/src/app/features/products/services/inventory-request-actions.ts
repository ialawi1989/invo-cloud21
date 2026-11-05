import { Injectable } from '@angular/core';

import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DocActionsBase } from '../../account/services/doc-actions-base';
import type { InventoryRequest } from './inventory-request.service';

/** What the rules read - satisfied by a full request and by a list row. */
export type InventoryRequestState = Pick<InventoryRequest, 'id' | 'status' | 'branchName' | 'hasSupplier'>;

/**
 * Single home of an inventory request's actions (see {@link DocActionsBase}): the privilege / status rules,
 * what the buttons do (convert to purchase order, convert to inventory transfer out, share) and the menu built
 * from them. The list row menu and the view toolbar both read from here so an option can't exist on one screen
 * and not the other. Legacy offers "Convert to transfer out" only for an unconverted request when the company
 * has more than one branch; the transfer form then prefills from `?requestId=`.
 */
@Injectable({ providedIn: 'root' })
export class InventoryRequestActions extends DocActionsBase {
  get canConvertPo(): boolean { return this.can('purchaseOrderSecurity.actions.convert.access'); }
  get canAddTransfer(): boolean { return this.can('inventoryTransferSecurity.actions.add.access'); }

  convertPo(r: InventoryRequestState & { lines?: { supplierId: string }[] }): boolean {
    if (!this.canConvertPo || r.status === 'Converted') return false;
    return r.lines ? r.lines.length > 0 && r.lines.every((l) => !!l.supplierId) : r.hasSupplier;
  }
  convertTransfer(r: InventoryRequestState, branchCount: number): boolean {
    return this.canAddTransfer && r.status !== 'Converted' && r.branchName !== '' && branchCount > 1;
  }

  runConvertPo(id: string): void { void this.router.navigate(['/inventory/request/convert-to-purchase-order', id]); }
  runConvertTransfer(id: string): void {
    void this.router.navigate(['/inventory/transfer/new/out'], { queryParams: { requestId: id } });
  }

  /** Native share sheet with a text summary and the view link; copies the text where unsupported. */
  async runShare(r: InventoryRequest): Promise<void> {
    const url = `${location.origin}/inventory/request/${r.id}/view`;
    const lines = r.lines.filter((l) => !!l.productId).map((l) => `${l.productName} x ${l.qty}`);
    const text = [`${this.t('PRODUCTS.INVENTORY_REQUEST.TITLE')} - ${r.branchName}`, ...lines].join('\n');
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: this.t('PRODUCTS.INVENTORY_REQUEST.TITLE'), text, url }); } catch { /* dismissed */ }
      return;
    }
    await this.copy(`${text}\n${url}`);
  }
  async runCopyLink(id: string): Promise<void> {
    await this.copy(`${location.origin}/inventory/request/${id}/view`);
  }
  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('PRODUCTS.INVENTORY_REQUEST.LINK_COPIED');
    } catch {
      this.toast.error('COMMON.OPS', '');
    }
  }

  shareItems(r: InventoryRequest): DropdownMenuBtnItem[] {
    return [
      this.item(this.t('PRODUCTS.INVENTORY_REQUEST.SHARE_DETAILS'), () => void this.runShare(r)),
      this.item(this.t('PRODUCTS.INVENTORY_REQUEST.COPY_LINK'), () => void this.runCopyLink(r.id)),
    ];
  }

  /** The "⋯" / Actions menu shared by the list row and the view. */
  menu(r: InventoryRequestState, branchCount: number): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (this.convertPo(r)) items.push(this.item(this.t('PRODUCTS.INVENTORY_REQUEST.CONVERT_TO_PO'), () => this.runConvertPo(r.id)));
    if (this.convertTransfer(r, branchCount)) {
      items.push(this.item(this.t('PRODUCTS.INVENTORY_REQUEST.CONVERT_TO_ITO'), () => this.runConvertTransfer(r.id)));
    }
    return items;
  }
}
