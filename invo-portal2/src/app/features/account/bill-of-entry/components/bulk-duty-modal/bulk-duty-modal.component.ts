import '../../../account-i18n';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

/** "Update Custom Duty": one duty amount to set on every ticked line of a bill of entry. */
@Component({
  selector: 'app-bulk-duty-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="'BILL_OF_ENTRY.FORM.BULK_DUTY' | translate"/>
    <div class="bd">
      <p class="bd__hint">{{ 'BILL_OF_ENTRY.FORM.BULK_DUTY_HINT' | translate }}</p>
      <label class="bd__label">{{ 'BILL_OF_ENTRY.FORM.CUSTOM_DUTY' | translate }}</label>
      <input class="bd__num" type="number" min="0" placeholder="0" [ngModel]="duty()" (ngModelChange)="duty.set($event)"/>
    </div>
    <app-modal-footer>
      <button type="button" class="bd__btn bd__btn--primary" [disabled]="duty() == null || duty()! < 0" (click)="ref.close(duty())">{{ 'BILL_OF_ENTRY.FORM.APPLY' | translate }}</button>
      <button type="button" class="bd__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .bd { padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
    .bd__hint { margin: 0 0 4px; color: #475569; font-size: 13.5px; }
    .bd__label { font-size: 13px; font-weight: 600; color: #334155; }
    .bd__num { max-width: 240px; box-sizing: border-box; background: #fff; border: 1px solid #d0d5dd; border-radius: 8px; padding: 9px 12px; font: inherit; text-align: end; }
    .bd__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .bd__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .bd__btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class BulkDutyModalComponent {
  ref = inject<ModalRef<number | null>>(MODAL_REF);
  duty = signal<number | null>(null);
}
