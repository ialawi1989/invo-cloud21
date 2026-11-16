import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { CustomerMini, CustomerPickerComponent } from '@shared/components/customer-picker/customer-picker.component';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import { TranslatedString } from '../../models/common.model';
import { TranslatedStringInputComponent } from '../translated-string-input/translated-string-input.component';

export interface IssueCouponData {
  /** Most that can still be issued from the set (0 = unlimited). */
  max: number;
  /** Stamp cards use "stamp card" wording. */
  isStampCard: boolean;
}

export interface IssueCouponResult {
  count: number;
  phoneNumber: string;
  email?: string;
  reason: TranslatedString;
  note: string;
}

/**
 * Issue coupons / stamp cards from a set — the legacy `IssueCouponComponent`:
 * how many (with "issue all"), optional customer (phone / email) and the
 * mandatory reason + note. Small form, so a dialog.
 */
@Component({
  selector: 'app-issue-coupon-modal',
  standalone: true,
  imports: [
    FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, CustomerPickerComponent,
    PhoneInputComponent, TranslatedStringInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="(data.isStampCard ? 'PROMOTIONS.COUPONS.ISSUE_STAMP_CARD' : 'PROMOTIONS.COUPONS.ISSUE_COUPON') | translate" />

    <div class="icm">
      <div class="icm-field">
        <label>
          {{ 'PROMOTIONS.COUPONS.COUPON_COUNT' | translate }}
          @if (data.max > 0) { <small>({{ 'PROMOTIONS.COUPONS.MAX_COUPONS' | translate: { max: data.max } }})</small> }
        </label>
        <div class="icm-inline">
          <input type="number" class="icm-input" [ngModel]="count()" (ngModelChange)="count.set($event)"/>
          @if (data.max > 0) {
            <button type="button" class="icm-btn" (click)="count.set(data.max)">{{ 'PROMOTIONS.COUPONS.ISSUE_ALL' | translate }}</button>
          }
        </div>
        @switch (countError()) {
          @case ('less') { <p class="icm-error">{{ 'PROMOTIONS.COUPONS.LESS_THAN_1' | translate }}</p> }
          @case ('required') { <p class="icm-error">{{ 'PROMOTIONS.COUPONS.REQUIRED' | translate }}</p> }
          @case ('more') { <p class="icm-error">{{ 'PROMOTIONS.COUPONS.MAX_COUPONS' | translate: { max: data.max } }}</p> }
        }
      </div>

      <div class="icm-field">
        <label>{{ 'PROMOTIONS.PROMOTIONS_VOUCHERS.CUSTOMER' | translate }}</label>
        <app-customer-picker (valueChange)="onCustomer($event)"/>
      </div>

      <div class="icm-field">
        <label>{{ 'PROMOTIONS.COUPONS.PHONE_NUMBER' | translate }}</label>
        <app-phone-input [disabled]="customerSelected()" [ngModel]="phone()" (ngModelChange)="phone.set($event)"/>
        @if (phoneError()) { <p class="icm-error">{{ 'PROMOTIONS.COUPONS.INVALID_PHONE' | translate }}</p> }
      </div>

      <div class="icm-field">
        <label>{{ 'PROMOTIONS.COUPONS.EMAIL' | translate }}</label>
        <input type="text" class="icm-input" [disabled]="customerSelected()" [ngModel]="email()" (ngModelChange)="email.set($event)"/>
        @if (!emailValid()) { <p class="icm-error">{{ 'PROMOTIONS.COUPONS.INVALID_EMAIL' | translate }}</p> }
      </div>

      <app-translated-string-input label="PROMOTIONS.COUPONS.REASON" [required]="true"
        [value]="reason()" (valueChange)="reason.set($event)"/>
      @if (!reasonValid()) { <p class="icm-error">{{ 'PROMOTIONS.PROMOTIONS_POINTS.REASON_REQUIRED' | translate }}</p> }

      <div class="icm-field">
        <label>{{ 'PROMOTIONS.PROMOTIONS_POINTS.NOTE' | translate }}</label>
        <textarea class="icm-input" rows="2" [ngModel]="note()" (ngModelChange)="note.set($event)"></textarea>
      </div>
    </div>

    <app-modal-footer>
      <button type="button" class="icm-btn" (click)="cancel()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="icm-btn icm-btn--primary" [disabled]="!valid()" (click)="save()">{{ 'COMMON.SAVE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .icm { padding: 16px 24px; min-width: 440px; max-width: 100%; display: flex; flex-direction: column; gap: 14px; }
    .icm-field { display: flex; flex-direction: column; gap: 6px; > label { font-size: 13px; font-weight: 600; color: #334155; } small { font-weight: 400; color: #64748b; } }
    .icm-inline { display: flex; gap: 8px; }
    .icm-input { flex: 1; padding: 9px 12px; border: 1px solid #d0d5dd; border-radius: 8px; font-size: 13.5px; color: #0f172a; font-family: inherit; }
    .icm-input:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38,145,164,.12); }
    .icm-error { margin: 0; font-size: 12px; color: #dc2626; }
    .icm-btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .icm-btn:disabled { opacity: .5; cursor: not-allowed; }
    .icm-btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class IssueCouponModalComponent {
  data = inject<IssueCouponData>(MODAL_DATA);
  private ref = inject<ModalRef<IssueCouponResult | null>>(MODAL_REF);
  private lang = inject(LanguageService);

  count = signal<number | null>(0);
  phone = signal('');
  email = signal('');
  reason = signal<TranslatedString>({ en: '' });
  note = signal('');
  customerSelected = signal(false);

  onCustomer(c?: CustomerMini): void {
    this.customerSelected.set(!!c);
    this.phone.set(c ? c.phone || '' : '');
    this.email.set(c ? c.email || '' : '');
  }

  // ── validation (legacy) ───────────────────────────────────────────
  countError = computed<string | null>(() => {
    const c = this.count();
    if (c === null || c === undefined) return 'required';
    if (c < 1) return 'less';
    if (this.data.max !== 0 && c > this.data.max) return 'more';
    return null;
  });
  phoneError = computed(() => {
    const p = this.phone();
    return !!p && !/^\+?\d{8,}$/.test(p);
  });
  emailValid = computed(() => {
    const e = this.email().trim();
    return !e || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  });
  reasonValid = computed(() => (this.reason()[this.lang.current() || 'en'] ?? '') !== '');
  valid = computed(() => this.reasonValid() && this.countError() === null);

  cancel(): void {
    this.ref.close(null);
  }

  save(): void {
    if (!this.valid()) return;
    this.ref.close({
      count: this.count() ?? 0,
      phoneNumber: this.phone(),
      email: this.email().trim() || undefined,
      reason: this.reason(),
      note: this.note(),
    });
  }
}
