import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';

export interface WastePopupData {
  /** The company asks for a reason with every waste. */
  enableVoidReason: boolean;
  /** A reason already typed on the line. */
  voidReason?: string;
}

/** What the dialog hands back when the user confirms: the line is waste, with the reason they gave. */
export interface WastePopupResult { isWaste: true; wasteReason: string; }

/**
 * "Waste" question shown after a saved invoice line is removed (legacy `WastePopupComponent`): was the removed item
 * wasted? Yes marks the line as waste with an optional - or, when the company requires it, mandatory - void reason.
 */
@Component({
  selector: 'app-waste-popup',
  standalone: true,
  imports: [FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="'INVOICES.WASTE.TITLE' | translate"/>
    <div class="wp">
      <label for="wp-reason">{{ 'INVOICES.WASTE.VOID_REASON' | translate }} @if (data.enableVoidReason) { <span class="wp__req">*</span> }</label>
      <textarea id="wp-reason" rows="3" class="wp__text" [class.wp__text--bad]="missing()"
        [placeholder]="'INVOICES.WASTE.VOID_REASON' | translate" [ngModel]="reason()" (ngModelChange)="reason.set($event)"></textarea>
      @if (missing()) { <p class="wp__error">{{ 'INVOICES.WASTE.REQUIRED' | translate }}</p> }
    </div>
    <app-modal-footer>
      <button type="button" class="wp__btn" (click)="ref.close(null)">{{ 'INVOICES.WASTE.NO' | translate }}</button>
      <button type="button" class="wp__btn wp__btn--primary" [disabled]="missing()" (click)="yes()">{{ 'INVOICES.WASTE.YES' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .wp { padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
    .wp > label { font-size: 13px; font-weight: 600; color: #334155; }
    .wp__req { color: #dc2626; }
    .wp__text { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid #d0d5dd; border-radius: 8px; font: inherit; resize: vertical;
      &:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .15); } }
    .wp__text--bad { border-color: #dc2626; }
    .wp__error { margin: 0; font-size: 12px; color: #dc2626; }
    .wp__btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-size: 13.5px; font-weight: 600; cursor: pointer;
      &:hover:not(:disabled) { background: #f8fafc; } &:disabled { opacity: .5; cursor: not-allowed; }
      &--primary { border-color: #2691a4; background: #2691a4; color: #fff; &:hover:not(:disabled) { background: #227d8d; } } }
  `],
})
export class WastePopupComponent {
  data = inject<WastePopupData>(MODAL_DATA);
  ref = inject<ModalRef<WastePopupResult | null>>(MODAL_REF);

  reason = signal(this.data.voidReason ?? '');
  missing = () => this.data.enableVoidReason && !this.reason().trim();

  yes(): void { this.ref.close({ isWaste: true, wasteReason: this.reason().trim() }); }
}
