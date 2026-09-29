import '../../account-i18n';
import { Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { DiscountFieldComponent, DiscountValue } from '@shared/components/discount-field/discount-field.component';

export interface BulkUpdateData { mode: 'account' | 'discount'; accounts?: any[]; }
export type BulkUpdateResult = { account: any } | { discount: DiscountValue };

/** "Bulk Update Line Items": pick one account or one discount to apply to every selected line. */
@Component({
  selector: 'app-doc-bulk-update-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent, SearchDropdownComponent, DiscountFieldComponent],
  template: `
    <app-modal-header [title]="'DOC_LINES.BULK_UPDATE' | translate"/>
    <div class="bu">
      @if (data.mode === 'account') {
        <p class="bu__hint">{{ 'DOC_LINES.BULK_ACCOUNT_HINT' | translate }}</p>
        <label class="bu__label">{{ 'DOC_LINES.CHOOSE_ACCOUNT' | translate }}</label>
        <app-search-dropdown [items]="data.accounts ?? []" [displayWith]="label" [compareWith]="same"
          [value]="account()" (valueChange)="account.set($any($event))" [clearable]="false"
          [placeholder]="'DOC_LINES.SELECT_ACCOUNT' | translate"/>
      } @else {
        <p class="bu__hint">{{ 'DOC_LINES.BULK_DISCOUNT_HINT' | translate }}</p>
        <div class="bu__discount">
          <app-discount-field [amount]="discount().amount" [percentage]="discount().percentage" (changed)="discount.set($event)"/>
        </div>
      }
    </div>
    <app-modal-footer>
      <button type="button" class="bu__btn bu__btn--primary" [disabled]="!canApply()" (click)="apply()">{{ 'DOC_LINES.UPDATE' | translate }}</button>
      <button type="button" class="bu__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .bu { padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
    .bu__hint { margin: 0 0 4px; color: #475569; font-size: 13.5px; }
    .bu__label { font-size: 13px; font-weight: 600; color: #334155; }
    .bu__discount { max-width: 240px; }
    .bu__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .bu__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .bu__btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class DocBulkUpdateModalComponent {
  ref = inject<ModalRef<BulkUpdateResult | null>>(MODAL_REF);
  data = inject<BulkUpdateData>(MODAL_DATA);

  account = signal<any>(null);
  discount = signal<DiscountValue>({ amount: 0, percentage: true });

  label = (a: any) => a?.name ?? '';
  same = (a: any, b: any) => a?.id === b?.id;

  canApply = () => (this.data.mode === 'account' ? !!this.account() : true);
  apply(): void {
    this.ref.close(this.data.mode === 'account' ? { account: this.account() } : { discount: this.discount() });
  }
}
