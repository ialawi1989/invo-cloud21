import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { PaymentAccount } from '../../services/payment-method.types';

/**
 * "Per-branch GL account" override modal — legacy name "Advance".
 *
 * Each row is a branch with a single GL-account picker; the user
 * can override the method's default account on a per-branch basis.
 * Branches without a row in the map fall back to the method's
 * main `accountId` at posting time (the backend handles that
 * fallback; the modal only edits the map).
 *
 * The modal returns the updated map `{ branchId → accountId }` on
 * Save; empty values are dropped so the wire payload stays small.
 * Returns `undefined` on dismiss so the caller can no-op.
 */
export interface BranchAdvanceBranch {
  id:   string;
  name: string;
}

export interface BranchAdvanceModalData {
  branches: BranchAdvanceBranch[];
  accounts: PaymentAccount[];
  /** Current map. Pass `undefined` or `{}` for a fresh edit. */
  branchesAccounts?: Record<string, string>;
}

export type BranchAdvanceResult = Record<string, string>;

@Component({
  selector: 'app-branch-advance-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'PAYMENT_METHODS.BRANCH_ADVANCE.TITLE' | translate"/>

    <div class="body">
      <p class="sub">{{ 'PAYMENT_METHODS.BRANCH_ADVANCE.SUB' | translate }}</p>

      @if (branches.length === 0) {
        <div class="empty">
          <p>{{ 'PAYMENT_METHODS.BRANCH_ADVANCE.NO_BRANCHES' | translate }}</p>
        </div>
      } @else {
        <div class="table">
          <div class="table__head">
            <span>{{ 'PAYMENT_METHODS.BRANCH_ADVANCE.BRANCH' | translate }}</span>
            <span>{{ 'PAYMENT_METHODS.BRANCH_ADVANCE.ACCOUNT' | translate }}</span>
          </div>
          @for (b of branches; track b.id) {
            <div class="row">
              <span class="row__name">{{ b.name }}</span>
              <app-search-dropdown
                class="row__picker"
                [items]="accounts"
                [displayWith]="accountDisplay"
                [compareWith]="accountCompare"
                [toValue]="accountToValue"
                [value]="selectedAccountFor(b.id)"
                [clearable]="true"
                [placeholder]="'PAYMENT_METHODS.BRANCH_ADVANCE.ACCOUNT_PLACEHOLDER' | translate"
                (valueChange)="setForBranch(b.id, $event)"/>
            </div>
          }
        </div>
      }
    </div>

    <app-modal-footer>
      <button type="button" class="btn-cancel" (click)="ref.dismiss()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="btn-confirm" (click)="save()">
        {{ 'COMMON.SAVE' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
    .sub  { margin: 0; font-size: 13px; color: #64748b; line-height: 1.5; }

    .empty {
      text-align: center;
      padding: 24px 16px;
      background: #f9fafb;
      border: 1px dashed #e5e7eb;
      border-radius: 8px;
      color: #64748b;

      p { margin: 0; font-size: 13px; }
    }

    .table {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .table__head {
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: 12px;
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: 12px;
      align-items: center;
      padding: 10px 14px;
      border-top: 1px solid #f1f5f9;

      &:first-of-type { border-top: 0; }

      &__name { font-size: 13px; font-weight: 600; color: #0f172a; }
      &__picker { display: block; }
    }

    .btn-cancel {
      padding: 9px 20px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      &:hover { background: #e5e7eb; }
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
      &:hover { background: var(--color-brand-700, #0e7490); }
    }
  `],
})
export class BranchAdvanceModalComponent {
  data = inject<BranchAdvanceModalData>(MODAL_DATA);
  ref  = inject<ModalRef<BranchAdvanceResult>>(MODAL_REF);

  readonly branches = this.data?.branches ?? [];
  readonly accounts = this.data?.accounts ?? [];

  /** Live draft — keyed by branchId. Cleared values delete the
   *  entry on save so the wire payload only carries real overrides. */
  private map = signal<Record<string, string>>({ ...(this.data?.branchesAccounts ?? {}) });

  // ─── Dropdown adapters ───────────────────────────────────────────
  accountDisplay = (a: PaymentAccount | null) => a?.name ?? '';
  accountCompare = (a: PaymentAccount | null, b: PaymentAccount | null) => (a?.id ?? '') === (b?.id ?? '');
  accountToValue = (a: PaymentAccount | null) => a?.id ?? '';

  selectedAccountFor(branchId: string): PaymentAccount | null {
    const id = this.map()[branchId];
    if (!id) return null;
    return this.accounts.find(a => a.id === id) ?? { id, name: id };
  }

  setForBranch(branchId: string, value: PaymentAccount | PaymentAccount[] | null): void {
    const picked = Array.isArray(value) ? value[0] ?? null : value;
    this.map.update(prev => {
      const next = { ...prev };
      if (picked?.id) {
        next[branchId] = picked.id;
      } else {
        delete next[branchId];
      }
      return next;
    });
  }

  save(): void {
    // Strip any stale empty entries before returning.
    const clean: Record<string, string> = {};
    for (const [bid, aid] of Object.entries(this.map())) {
      if (aid) clean[bid] = aid;
    }
    this.ref.close(clean);
  }
}
