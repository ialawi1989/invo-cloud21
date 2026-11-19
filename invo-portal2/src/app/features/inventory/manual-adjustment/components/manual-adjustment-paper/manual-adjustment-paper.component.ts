import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';

import { ManualAdjustment, isUnitCost } from '../../models/manual-adjustment.model';

/** The manual adjustment document (legacy `manual-adjustment-paper`): who made it, the branch and the products with before / after. */
@Component({
  selector: 'app-manual-adjustment-paper',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    @let d = adjustment();
    <article class="mp">
      <header class="mp__head">
        @if (logo()) { <img class="mp__logo" [src]="logo()" alt=""/> }
        <h2>{{ companyName() }}</h2>
        <div class="mp__title">{{ 'MANUAL_ADJUSTMENT.ADJUSTMENT' | translate }} ({{ 'MANUAL_ADJUSTMENT.TYPE.' + d.adjustmentType | translate }})</div>
      </header>

      <dl class="mp__grid">
        <div><dt>{{ 'MANUAL_ADJUSTMENT.CREATED_BY' | translate }}</dt><dd>{{ d.employeeName }}</dd></div>
        <div><dt>{{ 'MANUAL_ADJUSTMENT.DATE' | translate }}</dt><dd>{{ d.inventoryMovmentDate | date: 'dd/MM/yyyy' }}</dd></div>
        <div><dt>{{ 'MANUAL_ADJUSTMENT.BRANCH' | translate }}</dt><dd>{{ d.branchName }}</dd></div>
      </dl>

      <div class="mp__wrap">
        <table class="mp__table">
          <thead>
            <tr>
              <th>{{ 'MANUAL_ADJUSTMENT.PRODUCT' | translate }}</th>
              @if (isCost()) {
                <th class="end">{{ 'MANUAL_ADJUSTMENT.CURRENT_COST' | translate }}</th>
                <th class="end">{{ 'MANUAL_ADJUSTMENT.NEW_COST' | translate }}</th>
              } @else {
                <th class="end">{{ 'MANUAL_ADJUSTMENT.QTY_AVAILABLE' | translate }}</th>
                <th class="end">{{ 'MANUAL_ADJUSTMENT.NEW_QTY' | translate }}</th>
                <th class="end">{{ 'MANUAL_ADJUSTMENT.QTY_ADJUSTED' | translate }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (l of d.lines; track $index) {
              <tr>
                <td>
                  <strong>{{ l.productName }}</strong>
                  @if (l.UOM) { <span class="mp__chip">{{ l.UOM }}</span> }
                  @if (l.barcode) { <div class="mp__muted">{{ l.barcode }}</div> }
                </td>
                @if (isCost()) {
                  <td class="end">{{ l.currentCost | number: '1.3-3' }}</td>
                  <td class="end">{{ l.cost | number: '1.3-3' }}</td>
                } @else {
                  <td class="end">{{ l.currentOnHand }}</td>
                  <td class="end">{{ l.newQty }}</td>
                  <td class="end" [class.mp__neg]="l.qty < 0" [class.mp__pos]="l.qty > 0">{{ l.qty }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .mp { background: var(--ui-surface); padding: 28px; border: 1px solid var(--ui-line); border-radius: 12px; display: flex; flex-direction: column; gap: 18px; }
    .mp__head { display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--ui-line); padding-bottom: 14px; }
    .mp__head h2 { margin: 0; font-size: 18px; }
    .mp__logo { height: 40px; }
    .mp__title { margin-inline-start: auto; font-size: 22px; font-weight: 700; color: var(--ui-text); }
    .mp__grid { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px 24px; }
    .mp__grid > div { display: flex; gap: 8px; font-size: 14px; }
    dt { color: var(--ui-muted); min-width: 100px; } dd { margin: 0; color: var(--ui-text); }
    .mp__wrap { overflow-x: auto; }
    .mp__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .mp__table th { background: var(--ui-ink); color: #fff; text-align: start; padding: 10px 12px; }
    .mp__table td { padding: 10px 12px; border-bottom: 1px solid var(--ui-surface-2); vertical-align: top; }
    .end { text-align: end !important; }
    .mp__chip { margin-inline-start: 8px; padding: 1px 8px; border-radius: 999px; background: var(--ui-line); font-size: 12px; }
    .mp__muted { color: var(--ui-muted); font-size: 12px; }
    .mp__neg { color: var(--ui-red-text); font-weight: 600; }
    .mp__pos { color: var(--ui-green-text); font-weight: 600; }
  `],
})
export class ManualAdjustmentPaperComponent {
  private company = inject(CompanyService);

  adjustment = input.required<ManualAdjustment>();

  isCost = computed(() => isUnitCost(this.adjustment().adjustmentType));
  companyName = computed(() => this.company.currentCompany()?.name ?? '');
  logo = computed(() => {
    const c: any = this.company.currentCompany();
    return c?.mediaUrl?.defaultUrl || c?.logoUrl || c?.logo || '';
  });
}
