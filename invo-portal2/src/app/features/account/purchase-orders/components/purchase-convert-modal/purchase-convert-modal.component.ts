import '../../../account-i18n';
import { Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

/** Partly converted purchase order -> bill: bill the full quantities again, or only what is left. */
@Component({
  selector: 'app-purchase-convert-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="'PURCHASE_ORDERS.CONVERT.TITLE' | translate"/>
    <div class="pc">
      <p>{{ 'PURCHASE_ORDERS.CONVERT.TEXT' | translate }}</p>
      <label class="pc__opt"><input type="radio" name="pc" [checked]="choice() === 'full'" (change)="choice.set('full')"/> {{ 'PURCHASE_ORDERS.CONVERT.FULL_QUANTITY' | translate }}</label>
      <label class="pc__opt"><input type="radio" name="pc" [checked]="choice() === 'partial'" (change)="choice.set('partial')"/> {{ 'PURCHASE_ORDERS.CONVERT.REMAINING_QUANTITY' | translate }}</label>
    </div>
    <app-modal-footer>
      <button type="button" class="pc__btn pc__btn--primary" (click)="ref.close(choice())">{{ 'PURCHASE_ORDERS.CONVERT.CONFIRM' | translate }}</button>
      <button type="button" class="pc__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .pc { padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; }
    .pc p { margin: 0 0 4px; color: #374151; font-size: 14px; }
    .pc__opt { display: flex; gap: 8px; align-items: center; font-size: 14px; cursor: pointer; }
    .pc__btn { height: 38px; padding: 0 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; cursor: pointer; font: inherit; }
    .pc__btn--primary { background: #227d8d; border-color: #227d8d; color: #fff; }
  `],
})
export class PurchaseConvertModalComponent {
  ref = inject<ModalRef<'full' | 'partial' | null>>(MODAL_REF);
  choice = signal<'full' | 'partial'>('partial');
}
