import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

export type RemainingChoice = 'wallet' | 'change' | 'cancel';

/**
 * The tender is larger than what the picked invoices settle: ask where the excess goes —
 * kept as credit on the customer's wallet, or handed back as change (legacy `confirmRemainingAmount`).
 */
@Component({
  selector: 'app-remaining-amount-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="'PAYMENTS.REMAINING.TITLE' | translate"/>
    <div class="ra">
      <p>{{ 'PAYMENTS.REMAINING.MESSAGE' | translate: { amount: data.amount } }}</p>
    </div>
    <app-modal-footer>
      <button type="button" class="ra__btn ra__btn--primary" (click)="ref.close('wallet')">{{ 'PAYMENTS.REMAINING.WALLET' | translate }}</button>
      <button type="button" class="ra__btn" (click)="ref.close('change')">{{ 'PAYMENTS.REMAINING.CHANGE' | translate }}</button>
      <button type="button" class="ra__btn" (click)="ref.close('cancel')">{{ 'COMMON.CANCEL' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .ra { padding: 16px 20px; min-width: min(460px, 90vw); }
    .ra p { margin: 0; color: #334155; }
    .ra__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .ra__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class RemainingAmountModalComponent {
  data = inject<{ amount: string }>(MODAL_DATA);
  ref = inject<ModalRef<RemainingChoice>>(MODAL_REF);
}
