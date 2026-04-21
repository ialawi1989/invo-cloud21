import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ModalHeaderComponent } from '../../../../shared/modal/modal-header.component';
import { ModalFooterComponent } from '../../../../shared/modal/modal-footer.component';
import { ProductsService, BranchSummary } from '../../services/products.service';

export interface KitBreakModalData {
  productId:    string;
  productName?: string;
  branch:       BranchSummary;
}

@Component({
  selector: 'app-kit-break-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header
      [title]="'Break a kit'"
      [subtitle]="data.productName ? (data.productName + ' · ' + data.branch.branch) : data.branch.branch" />

    <div class="body">
      <div class="row">
        <label class="label" for="kit-break-qty">Qty to break</label>
        <input
          id="kit-break-qty"
          type="number"
          class="input"
          [min]="0"
          [max]="max"
          [(ngModel)]="qty"
          (ngModelChange)="clamp()" />
      </div>
      <div class="row">
        <label class="label" for="kit-break-max">On hand</label>
        <input id="kit-break-max" type="text" class="input input--readonly" disabled [value]="max" />
      </div>

      @if (error()) { <div class="state state--error">{{ error() }}</div> }
    </div>

    <app-modal-footer>
      <button type="button" class="btn" (click)="ref.dismiss()">Cancel</button>
      <button type="button"
        class="btn btn--primary"
        [disabled]="qty() === 0 || busy()"
        (click)="submit()">
        {{ busy() ? 'Breaking…' : 'Break' }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 18px 24px 8px; display: flex; flex-direction: column; gap: 14px; }
    .row  { display: flex; flex-direction: column; gap: 6px; }
    .label { font-size: 13px; font-weight: 600; color: #0f172a; }
    .input {
      width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
      font-size: 14px; color: #0f172a; background: #fff;
    }
    .input:focus { outline: none; border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.18); }
    .input--readonly { background: #f8fafc; color: #475569; }
    .state--error {
      padding: 10px 12px; background: #fef2f2; border: 1px solid #fecaca;
      color: #991b1b; border-radius: 8px; font-size: 12px;
    }
    .btn {
      padding: 8px 16px; border-radius: 8px;
      border: 1px solid #e2e8f0; background: #fff;
      font-size: 13px; font-weight: 600; color: #475569;
      cursor: pointer; transition: background .12s;
    }
    .btn:hover:not(:disabled) { background: #f8fafc; }
    .btn--primary { background: #32acc1; border-color: #32acc1; color: #fff; }
    .btn--primary:hover:not(:disabled) { background: #2b95a8; border-color: #2b95a8; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class KitBreakModalComponent {
  data = inject<KitBreakModalData>(MODAL_DATA);
  ref  = inject<ModalRef<{ onHand?: number }>>(MODAL_REF);
  private svc = inject(ProductsService);

  qty   = signal(0);
  busy  = signal(false);
  error = signal<string | null>(null);

  get max(): number { return Number(this.data.branch.onHand ?? 0); }

  clamp(): void {
    const v = this.qty();
    if (v < 0) this.qty.set(0);
    else if (v > this.max) this.qty.set(this.max);
  }

  async submit(): Promise<void> {
    if (this.qty() === 0) return;
    this.busy.set(true);
    this.error.set(null);
    const branchId = this.data.branch.branchId || this.data.branch.id || '';
    const res = await this.svc.breakKit(this.data.productId, branchId, this.qty());
    this.busy.set(false);
    if (!res.success) {
      this.error.set(res.message || 'Break failed.');
      return;
    }
    this.ref.close({ onHand: res.data?.onHand });
  }
}
