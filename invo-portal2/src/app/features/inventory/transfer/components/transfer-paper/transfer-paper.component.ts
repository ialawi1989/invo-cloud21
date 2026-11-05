import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { InventoryTransfer, lineTotal, lineUnitCost } from '../../models/inventory-transfer.model';

/**
 * The transfer document (legacy `inventory-transfer-paper`): who created / confirmed it, the branches, and the lines
 * with their batches / serials. Unit cost and totals only show with `inventoryTransferSecurity.actions.showProductCost`
 * (legacy gated the cost columns but showed the grand total regardless; here the total follows the same gate).
 */
@Component({
  selector: 'app-transfer-paper',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  template: `
    @let t = transfer();
    <article class="tp">
      <header class="tp__head">
        @if (logo()) { <img class="tp__logo" [src]="logo()" alt=""/> }
        <div>
          <h2>{{ companyName() }}</h2>
        </div>
        <div class="tp__title">{{ 'INVENTORY_TRANSFER.TRANSFER' | translate }} ({{ 'INVENTORY_TRANSFER.TYPE.' + t.type | translate }})</div>
      </header>

      <div class="tp__grid">
        <dl>
          <div><dt>{{ 'INVENTORY_TRANSFER.CREATED_BY' | translate }}</dt><dd>{{ t.employeeName }}</dd></div>
          <div><dt>{{ 'INVENTORY_TRANSFER.TRANSFER_NO' | translate }}</dt><dd>{{ t.transferNumber }}</dd></div>
          <div><dt>{{ 'INVENTORY_TRANSFER.TRANSFER_DATE' | translate }}</dt><dd>{{ t.createdDate | date: 'dd/MM/yyyy' }}</dd></div>
          <div><dt>{{ 'INVENTORY_TRANSFER.TRANSFER_REASON' | translate }}</dt><dd>{{ t.reason }}</dd></div>
        </dl>
        <dl>
          <div><dt>{{ 'INVENTORY_TRANSFER.STATUS_LABEL' | translate }}</dt><dd>{{ 'INVENTORY_TRANSFER.STATUS.' + t.status | translate }}</dd></div>
          @if (t.confirmedEmployeeName) {
            <div><dt>{{ 'INVENTORY_TRANSFER.CONFIRMED_BY' | translate }}</dt><dd>{{ t.confirmedEmployeeName }}</dd></div>
            <div><dt>{{ 'INVENTORY_TRANSFER.CONFIRMED_DATE' | translate }}</dt><dd>{{ t.confirmDatetime | date: 'dd/MM/yyyy' }}</dd></div>
          }
          <div><dt>{{ 'INVENTORY_TRANSFER.FROM_BRANCH' | translate }}</dt><dd>{{ t.branchName }}</dd></div>
          @if (t.destinationBranchName) {
            <div><dt>{{ 'INVENTORY_TRANSFER.TO_BRANCH' | translate }}</dt><dd>{{ t.destinationBranchName }}</dd></div>
          }
        </dl>
      </div>

      <div class="tp__wrap">
        <table class="tp__table">
          <thead>
            <tr>
              <th>{{ 'INVENTORY_TRANSFER.PRODUCT' | translate }}</th>
              <th class="end">{{ 'INVENTORY_TRANSFER.ON_HAND' | translate }}</th>
              <th class="end">{{ 'INVENTORY_TRANSFER.QTY' | translate }}</th>
              @if (showCost) {
                <th class="end">{{ 'INVENTORY_TRANSFER.UNIT_COST' | translate }}</th>
                <th class="end">{{ 'INVENTORY_TRANSFER.TOTAL' | translate }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (l of t.lines; track $index) {
              <tr>
                <td>
                  <strong>{{ l.productName }}</strong>
                  @if (l.UOM) { <span class="tp__chip">{{ l.UOM }}</span> }
                  @if (l.barcode) { <div class="tp__muted">{{ l.barcode }}</div> }
                </td>
                <td class="end">{{ l.onHand }}</td>
                <td class="end">{{ qtyOf(l) }}</td>
                @if (showCost) {
                  <td class="end">{{ unitCost(l) | mycurrency }}</td>
                  <td class="end">{{ total(l) | mycurrency }}</td>
                }
              </tr>
              @if (l.batches.length) {
                <tr class="tp__sub">
                  <td [attr.colspan]="showCost ? 5 : 3">
                    @for (b of l.batches; track $index) {
                      <span class="tp__tag">{{ 'INVENTORY_TRANSFER.BATCH' | translate }}: {{ b.batch }} × {{ b.qty }}</span>
                    }
                  </td>
                </tr>
              }
              @if (l.serials.length) {
                <tr class="tp__sub">
                  <td [attr.colspan]="showCost ? 5 : 3">
                    @for (s of l.serials; track $index) {
                      <span class="tp__tag">{{ 'INVENTORY_TRANSFER.SERIAL' | translate }}: {{ s.serial }}</span>
                    }
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (showCost) {
        <div class="tp__total"><span>{{ 'INVENTORY_TRANSFER.TOTAL' | translate }}</span><strong>{{ grandTotal() | mycurrency }}</strong></div>
      }
      @if (t.note) { <p class="tp__note"><i>{{ t.note }}</i></p> }
    </article>
  `,
  styles: [`
    :host { display: block; }
    .tp { background: #fff; padding: 28px; border: 1px solid #e5e7eb; border-radius: 12px; display: flex; flex-direction: column; gap: 18px; }
    .tp__head { display: flex; align-items: center; gap: 14px; border-bottom: 1px solid #e5e7eb; padding-bottom: 14px; }
    .tp__head h2 { margin: 0; font-size: 18px; }
    .tp__logo { height: 40px; }
    .tp__title { margin-inline-start: auto; font-size: 22px; font-weight: 700; color: #0f172a; }
    .tp__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    dl { margin: 0; display: flex; flex-direction: column; gap: 6px; }
    dl > div { display: flex; gap: 8px; font-size: 14px; }
    dt { color: #64748b; min-width: 130px; } dd { margin: 0; color: #0f172a; }
    .tp__wrap { overflow-x: auto; }
    .tp__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .tp__table th { background: #0f172a; color: #fff; text-align: start; padding: 10px 12px; }
    .tp__table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .end { text-align: end !important; }
    .tp__chip { margin-inline-start: 8px; padding: 1px 8px; border-radius: 999px; background: #e2e8f0; font-size: 12px; }
    .tp__muted { color: #64748b; font-size: 12px; }
    .tp__sub td { background: #f8fafc; }
    .tp__tag { display: inline-block; margin: 2px 6px 2px 0; padding: 2px 10px; border-radius: 6px; background: #e0f2fe; color: #075985; font-size: 12px; }
    .tp__total { align-self: flex-end; display: flex; gap: 24px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 10px; min-width: 260px; justify-content: space-between; }
    .tp__note { margin: 0; color: #475569; }
  `],
})
export class TransferPaperComponent {
  private company = inject(CompanyService);
  private privileges = inject(PrivilegeService);

  transfer = input.required<InventoryTransfer>();

  readonly showCost = this.privileges.check('inventoryTransferSecurity.actions.showProductCost.access');

  companyName = computed(() => this.company.currentCompany()?.name ?? '');
  logo = computed(() => {
    const c: any = this.company.currentCompany();
    return c?.mediaUrl?.defaultUrl || c?.logoUrl || c?.logo || '';
  });

  total = lineTotal;
  unitCost = lineUnitCost;
  grandTotal = computed(() => this.transfer().lines.reduce((s, l) => s + lineTotal(l), 0));

  /** Batch / serial lines move what was picked, not the line's own qty. */
  qtyOf(l: InventoryTransfer['lines'][number]): number {
    if (l.batches.length) return l.batches.reduce((s, b) => s + (Number(b.qty) || 0), 0);
    if (l.serials.length) return l.serials.length;
    return l.qty;
  }
}
