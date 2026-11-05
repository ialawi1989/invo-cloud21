import '../../../account-i18n';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { DiscountFieldComponent, DiscountValue } from '@shared/components/discount-field/discount-field.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';

import { Bill } from '../../../models/bill.model';

/**
 * Notes + totals block under the lines of a bill (and of a recurring bill's template): sub total, the bill
 * discount (amount or %, taken before or after tax, optionally including the tax of an inclusive-tax bill),
 * tax, rounding and total. It edits the bill in place and raises `changed`.
 */
@Component({
  selector: 'app-bill-totals',
  standalone: true,
  imports: [FormsModule, TranslateModule, MycurrencyPipe, DiscountFieldComponent, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    @let e = bill();
    <div class="bf-totals">
      <div class="bf-notes">
        <label>{{ 'BILLS.FORM.NOTES' | translate }}</label>
        <textarea rows="3" [ngModel]="e.note" (ngModelChange)="onNote($event)" [placeholder]="'BILLS.FORM.NOTES_PLACEHOLDER' | translate"></textarea>
      </div>
      <div class="bf-sum">
        <div class="bf-row"><b>{{ 'DOC_FORM.SUB_TOTAL' | translate }}</b><b>{{ e.itemTotalWithoutTax | mycurrency }}</b></div>
        <div class="bf-row bf-row--field">
          <span>{{ 'DOC_FORM.DISCOUNT' | translate }}</span>
          <app-discount-field [amount]="e.discountAmount" [percentage]="e.discountPercentage" (changed)="onDiscount($event)"/>
          <span>({{ e.billDiscount | mycurrency }})</span>
        </div>
        @if (e.discountAmount > 0) {
          <div class="bf-row bf-row--opts">
            <app-segmented-toggle [options]="when" [value]="whenValue" (valueChange)="onWhen($event)"/>
            @if (e.isInclusiveTax) {
              <label class="bf-check"><input type="checkbox" [checked]="e.discountIncludesTax" (change)="onIncludesTax($any($event.target).checked)"/> {{ 'BILLS.FORM.DISCOUNT_INCLUDES_TAX' | translate }}</label>
            }
          </div>
        }
        <div class="bf-row"><span>{{ 'DOC_FORM.TAX_TOTAL' | translate }}</span><span>{{ e.invoiceTaxTotal | mycurrency }}</span></div>
        @if (e.roundingTotal) { <div class="bf-row"><span>{{ 'DOC_FORM.ROUNDING' | translate }}</span><span>{{ e.roundingTotal | mycurrency }}</span></div> }
        <div class="bf-row bf-row--total"><b>{{ 'DOC_FORM.TOTAL' | translate }}</b><b>{{ e.total | mycurrency }}</b></div>
      </div>
    </div>
  `,
  styles: [`
    .bf-totals { display: grid; gap: 24px; grid-template-columns: 1fr; margin-top: 8px; }
    @media (min-width: 900px) { .bf-totals { grid-template-columns: 1fr 1fr; } }
    .bf-notes { display: flex; flex-direction: column; gap: 6px; }
    .bf-notes label { font-size: 13.5px; color: #0f172a; }
    .bf-notes textarea { background: #fff; border: 1px solid #d0d5dd; border-radius: 6px; padding: 9px 12px; font: inherit; resize: vertical; }
    .bf-sum { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
    .bf-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 14px; color: #334155; }
    .bf-row--field { display: grid; grid-template-columns: 110px 240px minmax(90px, 1fr); }
    .bf-row--field > :last-child { text-align: end; white-space: nowrap; }
    .bf-row--opts { flex-wrap: wrap; justify-content: flex-start; }
    .bf-check { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; }
    .bf-row--total { border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 18px; color: #0f172a; }
  `],
})
export class BillTotalsComponent {
  bill = input.required<Bill>();
  changed = output<void>();

  readonly when: SegmentedToggleOption[] = [
    { value: 'before', label: 'BILLS.FORM.BEFORE_TAX' },
    { value: 'after', label: 'BILLS.FORM.AFTER_TAX' },
  ];

  get whenValue(): string { return this.bill().applyDiscountBeforeTax ? 'before' : 'after'; }

  onNote(v: string): void { this.bill().note = v; this.changed.emit(); }

  onDiscount(d: DiscountValue): void {
    const b = this.bill();
    b.discountAmount = d.amount;
    b.discountPercentage = d.percentage;
    b.calculateTotal();
    this.changed.emit();
  }

  onWhen(v: string): void { const b = this.bill(); b.applyDiscountBeforeTax = v === 'before'; b.calculateTotal(); this.changed.emit(); }

  onIncludesTax(on: boolean): void { const b = this.bill(); b.discountIncludesTax = on; b.applyDiscountIncludesTaxToLines(); this.changed.emit(); }
}
