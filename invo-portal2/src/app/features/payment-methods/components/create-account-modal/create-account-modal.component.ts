import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { AccountService } from '../../../chart-of-accounts/services/account.service';
import { Account, emptyAccount } from '../../../chart-of-accounts/services/account.types';
import { AccountFormFieldsComponent } from '../../../chart-of-accounts/components/account-form-fields/account-form-fields.component';
import { findAccountType } from '../../../chart-of-accounts/utils/account-types';

import { PaymentAccount } from '../../services/payment-method.types';

/**
 * Inline "Create new GL account" modal for the payment-methods flow.
 *
 * Renders the same fields the standalone Chart-of-Accounts form
 * page uses (`<app-account-form-fields>` in full mode — name,
 * type, code, description, parent) so users get one consistent
 * surface across the modal and the dedicated
 * `/account/chart-of-accounts` page. Page chrome (breadcrumbs /
 * title / sticky save-bar) is omitted because the modal owns its
 * own header + footer.
 *
 * Saves through the chart-of-accounts service. Returns the saved
 * account as a `PaymentAccount` so the payment-methods form can
 * append it to its in-memory accounts list and pre-select it —
 * same flow as the legacy popup.
 */
export interface CreateAccountModalData {
  /** Optional seed name — pre-fills the field if the user typed
   *  something in the dropdown search before clicking Create. */
  initialName?: string;
}

@Component({
  selector: 'app-create-account-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    AccountFormFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'PAYMENT_METHODS.CREATE_ACCOUNT.TITLE' | translate"/>

    <div class="body">
      <app-account-form-fields
        [value]="account()"
        [namePlaceholderKey]="'PAYMENT_METHODS.CREATE_ACCOUNT.NAME_PLACEHOLDER'"
        (valueChange)="onValueChange($event)"/>
    </div>

    <app-modal-footer>
      <button type="button" class="btn-cancel" (click)="ref.dismiss()" [disabled]="saving()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="btn-confirm" (click)="save()" [disabled]="!canSave()">
        @if (saving()) { <span class="spinner" aria-hidden="true"></span> }
        {{ saving() ? ('COMMON.SAVING' | translate) : ('COMMON.SAVE' | translate) }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 20px 24px; }

    .btn-cancel {
      padding: 9px 20px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;

      &:hover:not(:disabled) { background: #e5e7eb; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
    .btn-confirm {
      padding: 9px 24px;
      background: var(--color-brand-600, #0891b2);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;

      &:hover:not(:disabled) { background: var(--color-brand-700, #0e7490); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: ca-spin 0.7s linear infinite;
    }
    @keyframes ca-spin { to { transform: rotate(360deg); } }
  `],
})
export class CreateAccountModalComponent {
  private service = inject(AccountService);
  private toast   = inject(ToastService);
  data            = inject<CreateAccountModalData>(MODAL_DATA);
  ref             = inject<ModalRef<PaymentAccount>>(MODAL_REF);

  /** Pre-seed the account with the typed-in name (if any) and a
   *  sensible default type ("Bank" is by far the most common pick
   *  for payment-method flows). */
  account = signal<Account>({
    ...emptyAccount(),
    name:       this.data?.initialName ?? '',
    type:       'Bank',
    parentType: findAccountType('Bank')?.parentType ?? 'Current Assets',
  });
  saving = signal<boolean>(false);

  canSave = computed<boolean>(() => {
    const a = this.account();
    return !!a.name.trim() && !!a.type && !this.saving();
  });

  onValueChange(a: Account): void { this.account.set(a); }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.account());
      if (!res?.id) {
        this.toast.error('COMMON.SAVE_FAILED');
        return;
      }
      // Return the row in the `PaymentAccount` shape the caller
      // expects so it can append + select without a re-fetch.
      const a = this.account();
      this.ref.close({
        id:   res.id,
        name: a.name.trim(),
        code: a.code || undefined,
      });
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
