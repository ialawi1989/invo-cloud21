import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DiscountFieldComponent, DiscountValue } from '@shared/components/discount-field/discount-field.component';

import { Invoice } from '../../../models/invoice.model';
import { DocumentLineEditor } from '../../../services/document-line-editor';

/** Customer notes + totals block below the invoice lines (sub total, discount, tax, charge, delivery, total). */
@Component({
  selector: 'app-invoice-totals',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, SearchDropdownComponent, DiscountFieldComponent],
  template: `
    @let inv = invoice();
    <div class="it">
      <div class="it__notes">
        <label>{{ 'INVOICES.FORM.CUSTOMER_NOTES' | translate }}</label>
        <textarea rows="3" [ngModel]="inv.note" (ngModelChange)="onNote($event)" [placeholder]="'INVOICES.FORM.NOTES_PLACEHOLDER' | translate"></textarea>
        <small>{{ 'INVOICES.FORM.NOTES_HINT' | translate }}</small>
      </div>

      <div class="it__totals">
        <div class="it__row"><b>{{ 'INVOICES.FORM.SUB_TOTAL' | translate }}</b><b>{{ inv.itemTotalWithoutTax | mycurrency }}</b></div>

        @if (inv.discountType !== 'itemDiscount') {
          <div class="it__row it__row--field">
            <span>{{ 'INVOICES.FORM.DISCOUNT' | translate }}</span>
            <app-discount-field [amount]="inv.discountAmount" [percentage]="inv.discountPercentage" (changed)="onDiscount($event)"/>
            <span>({{ inv.discountTotal | mycurrency }})</span>
          </div>
        }

        <div class="it__row"><span>{{ 'INVOICES.FORM.TAX_TOTAL' | translate }}</span><span>{{ inv.invoiceTaxTotal | mycurrency }}</span></div>

        @if (surcharges().length) {
          <div class="it__row it__row--field">
            <span>{{ 'INVOICES.FORM.CHARGE' | translate }}</span>
            <app-search-dropdown [items]="surcharges()" [displayWith]="chargeLabel" [compareWith]="byId"
              [value]="chargeOf()" (valueChange)="onCharge($any($event)?.id ?? null)" [clearable]="true"
              [placeholder]="'INVOICES.FORM.NO_CHARGE' | translate"/>
            <span>{{ inv.chargeTotal | mycurrency }}</span>
          </div>
        }

        <div class="it__row it__row--field">
          <span>{{ 'INVOICES.FORM.DELIVERY_CHARGE' | translate }}</span>
          <input class="it__num" type="number" inputmode="decimal" min="0" [ngModel]="inv.deliveryCharge" (ngModelChange)="onDelivery($event)"/>
          <span></span>
        </div>

        @if (inv.roundingTotal) {
          <div class="it__row"><span>{{ 'INVOICES.FORM.ROUNDING' | translate }}</span><span>{{ inv.roundingTotal | mycurrency }}</span></div>
        }

        <div class="it__row it__row--total"><b>{{ 'INVOICES.FORM.TOTAL' | translate }}</b><b>{{ inv.total | mycurrency }}</b></div>
      </div>
    </div>
  `,
  styles: [`
    .it { display: grid; gap: 24px; grid-template-columns: 1fr; margin-top: 8px; }
    @media (min-width: 900px) { .it { grid-template-columns: 1fr 1fr; } }
    .it__notes { display: flex; flex-direction: column; gap: 6px; }
    .it__notes label { font-size: 13.5px; color: #0f172a; }
    .it__notes textarea { border: 1px solid #d0d5dd; border-radius: 6px; padding: 9px 12px; font: inherit; resize: vertical; }
    .it__notes small { color: #64748b; }
    .it__totals { background: #f8f9fc; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
    .it__row { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 14px; color: #334155; }
    .it__row--field { display: grid; grid-template-columns: 110px 1fr auto; }
    .it__row--total { border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 18px; color: #0f172a; }
    .it__num { border: 1px solid #d0d5dd; border-radius: 6px; padding: 7px 10px; font: inherit; text-align: end; width: 100%; }
  `],
})
export class InvoiceTotalsComponent {
  invoice = input.required<Invoice>();
  editor = input.required<DocumentLineEditor>();
  surcharges = input<any[]>([]);
  changed = output<void>();

  byId = (a: any, b: any) => a?.id === b?.id;
  chargeLabel = (c: any) => c?.name ?? '';
  chargeOf = () => this.surcharges().find(s => s.id == this.invoice().chargeId) ?? null;

  onNote(v: string): void { this.invoice().note = v; this.changed.emit(); }
  onDiscount(d: DiscountValue): void { this.editor().setInvoiceDiscount(d); this.changed.emit(); }
  onCharge(id: string | null): void { this.editor().setCharge(this.surcharges().find(s => s.id == id)); this.changed.emit(); }
  onDelivery(v: any): void {
    this.invoice().deliveryCharge = Number(v) || 0;
    this.invoice().calculateTotal();
    this.changed.emit();
  }
}
