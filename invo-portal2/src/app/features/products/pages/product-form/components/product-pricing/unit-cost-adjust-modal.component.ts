import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF, ModalRef } from '@shared/modal';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ProductCrudService } from '../../../../services/product-crud.service';

export interface UnitCostAdjustData {
  productId: string;
  currentUnitCost: number;
}

export interface UnitCostAdjustResult {
  unitCost: number;
}

/**
 * "Inventory adjustment (Unit cost)" modal — mirrors the old project.
 *
 * Shows the current unit cost (read-only) and a changed-value input. On
 * save it posts a `saveManualAdjustmentMovement` record (audit trail), then
 * closes with the new cost so the pricing card can patch the form.
 */
@Component({
  selector: 'app-unit-cost-adjust-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'PRODUCTS.PRICING.ADJUST_MODAL_TITLE' | translate"/>

    <div class="ua-body">
      <label class="ua-field">
        <span class="ua-label">{{ 'PRODUCTS.PRICING.CURRENT_UNIT_COST' | translate }}</span>
        <input class="ua-input ua-input--readonly"
               type="number"
               readonly
               [value]="data.currentUnitCost"/>
      </label>

      <label class="ua-field">
        <span class="ua-label">{{ 'PRODUCTS.PRICING.CHANGED_UNIT_COST' | translate }}</span>
        <input class="ua-input"
               type="number"
               min="0"
               step="0.001"
               [ngModel]="newValue()"
               (ngModelChange)="newValue.set($event)"
               autofocus/>
        @if (error()) {
          <span class="ua-error">{{ error() | translate }}</span>
        }
      </label>
    </div>

    <div class="ua-footer">
      <button type="button" class="ua-btn ua-btn--ghost" (click)="cancel()" [disabled]="saving()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="ua-btn ua-btn--primary" (click)="save()" [disabled]="saving()">
        @if (saving()) { <span class="ua-spinner" aria-hidden="true"></span> }
        {{ 'COMMON.SAVE' | translate }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ua-body { padding: 16px 24px 8px; display: flex; flex-direction: column; gap: 14px; }

    .ua-field { display: flex; flex-direction: column; gap: 6px; }
    .ua-label { font-size: 12px; font-weight: 600; color: #475569; }

    .ua-input {
      width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
      border-radius: 8px; font-size: 14px; outline: none;
      transition: border-color .12s, box-shadow .12s;

      &:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }

      &--readonly { background: #f8fafc; color: #64748b; cursor: not-allowed; }
    }

    .ua-error { font-size: 12px; color: #dc2626; }

    .ua-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 16px 24px 20px; border-top: 1px solid #f1f5f9;
    }
    .ua-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 8px; font-size: 13px;
      font-weight: 500; cursor: pointer; border: 1px solid transparent;

      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    .ua-btn--ghost   { background: #fff; border-color: #e5e7eb; color: #374151; }
    .ua-btn--primary { background: #32acc1; color: #fff;
      &:not(:disabled):hover { background: #2a93a6; }
    }

    .ua-spinner {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid currentColor; border-top-color: transparent;
      display: inline-block; animation: ua-spin .8s linear infinite;
    }
    @keyframes ua-spin { to { transform: rotate(360deg); } }
  `],
})
export class UnitCostAdjustModalComponent {
  data = inject<UnitCostAdjustData>(MODAL_DATA);
  modalRef = inject<ModalRef<UnitCostAdjustResult>>(MODAL_REF);
  private crud = inject(ProductCrudService);

  newValue = signal<number>(this.data.currentUnitCost ?? 0);
  saving   = signal<boolean>(false);
  error    = signal<string>('');

  cancel(): void { this.modalRef.dismiss(); }

  async save(): Promise<void> {
    const v = Number(this.newValue());
    if (!Number.isFinite(v) || v < 0) {
      this.error.set('PRODUCTS.PRICING.INVALID_UNIT_COST');
      return;
    }

    // No-op if unchanged — just close.
    if (v === this.data.currentUnitCost) {
      this.modalRef.close({ unitCost: v });
      return;
    }

    this.saving.set(true);
    try {
      await this.crud.saveManualAdjustmentMovement(
        this.crud.buildUnitCostAdjustmentBody(this.data.productId, v, {
          currentUnitCost: this.data.currentUnitCost,
        }),
      );
      this.modalRef.close({ unitCost: v });
    } catch (e) {
      console.error('[unit-cost-adjust] save failed', e);
      this.error.set('PRODUCTS.PRICING.ADJUST_SAVE_FAILED');
    } finally {
      this.saving.set(false);
    }
  }
}
