import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF, ModalRef } from '@shared/modal';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ProductCrudService } from '../../../../services/product-crud.service';

export interface StockAdjustData {
  productId: string;
  branchId: string;
  currentOnHand: number;
}

export interface StockAdjustResult {
  onHand: number;
}

/**
 * "Inventory adjustment (On hand)" modal — mirrors the old project's
 * `AdjustSingleProductPopupComponent` when `type === 'on-hand'`.
 *
 * Shows current on-hand (read-only) + new on-hand input. On save, posts
 * a `saveManualAdjustmentMovement` record with `adjustmentType =
 * "onHand adjustment"` and returns the new qty so the parent can patch
 * the form.
 */
@Component({
  selector: 'app-stock-adjust-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'PRODUCTS.PRICING.STOCK_ADJUST_MODAL_TITLE' | translate"/>

    <div class="sa-body">
      <label class="sa-field">
        <span class="sa-label">{{ 'PRODUCTS.PRICING.CURRENT_ON_HAND' | translate }}</span>
        <input class="sa-input sa-input--readonly"
               type="number" readonly
               [value]="data.currentOnHand"/>
      </label>

      <label class="sa-field">
        <span class="sa-label">{{ 'PRODUCTS.PRICING.CHANGED_ON_HAND' | translate }}</span>
        <input class="sa-input"
               type="number" step="any"
               [ngModel]="newValue()"
               (ngModelChange)="newValue.set($event)"
               autofocus/>
        @if (delta() !== 0) {
          <span class="sa-delta" [class.sa-delta--neg]="delta() < 0">
            {{ delta() > 0 ? '+' : '' }}{{ delta() }}
            {{ 'PRODUCTS.PRICING.DELTA_SUFFIX' | translate }}
          </span>
        }
        @if (error()) {
          <span class="sa-error">{{ error() | translate }}</span>
        }
      </label>
    </div>

    <div class="sa-footer">
      <button type="button" class="sa-btn sa-btn--ghost" (click)="cancel()" [disabled]="saving()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="sa-btn sa-btn--primary" (click)="save()" [disabled]="saving()">
        @if (saving()) { <span class="sa-spinner" aria-hidden="true"></span> }
        {{ 'COMMON.SAVE' | translate }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .sa-body { padding: 16px 24px 8px; display: flex; flex-direction: column; gap: 14px; }
    .sa-field { display: flex; flex-direction: column; gap: 6px; }
    .sa-label { font-size: 12px; font-weight: 600; color: #475569; }

    .sa-input {
      width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
      border-radius: 8px; font-size: 14px; outline: none;
      transition: border-color .12s, box-shadow .12s;
      &:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }
      &--readonly { background: #f8fafc; color: #64748b; cursor: not-allowed; }
    }

    .sa-delta {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      background: #dcfce7;
      color: #166534;

      &--neg { background: #fef2f2; color: #b91c1c; }
    }

    .sa-error { font-size: 12px; color: #dc2626; }

    .sa-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 16px 24px 20px; border-top: 1px solid #f1f5f9;
    }
    .sa-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 16px; border-radius: 8px; font-size: 13px;
      font-weight: 500; cursor: pointer; border: 1px solid transparent;
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    .sa-btn--ghost   { background: #fff; border-color: #e5e7eb; color: #374151; }
    .sa-btn--primary { background: #32acc1; color: #fff;
      &:not(:disabled):hover { background: #2a93a6; }
    }

    .sa-spinner {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid currentColor; border-top-color: transparent;
      display: inline-block; animation: sa-spin .8s linear infinite;
    }
    @keyframes sa-spin { to { transform: rotate(360deg); } }
  `],
})
export class StockAdjustModalComponent {
  data = inject<StockAdjustData>(MODAL_DATA);
  modalRef = inject<ModalRef<StockAdjustResult>>(MODAL_REF);
  private crud = inject(ProductCrudService);

  newValue = signal<number>(this.data.currentOnHand ?? 0);
  saving   = signal<boolean>(false);
  error    = signal<string>('');

  delta(): number {
    return Math.round((Number(this.newValue()) - Number(this.data.currentOnHand ?? 0)) * 1000) / 1000;
  }

  cancel(): void { this.modalRef.dismiss(); }

  async save(): Promise<void> {
    const next = Number(this.newValue());
    if (!Number.isFinite(next)) {
      this.error.set('PRODUCTS.PRICING.INVALID_ON_HAND');
      return;
    }
    if (next === this.data.currentOnHand) {
      this.modalRef.close({ onHand: next });
      return;
    }

    this.saving.set(true);
    try {
      await this.crud.saveManualAdjustmentMovement(
        this.crud.buildStockAdjustmentBody(
          this.data.productId,
          this.data.branchId,
          this.data.currentOnHand,
          next,
        ),
      );
      this.modalRef.close({ onHand: next });
    } catch (e) {
      console.error('[stock-adjust] save failed', e);
      this.error.set('PRODUCTS.PRICING.ADJUST_SAVE_FAILED');
    } finally {
      this.saving.set(false);
    }
  }
}
