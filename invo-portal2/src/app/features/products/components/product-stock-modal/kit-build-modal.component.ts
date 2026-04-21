import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { ModalHeaderComponent } from '../../../../shared/modal/modal-header.component';
import { ModalFooterComponent } from '../../../../shared/modal/modal-footer.component';
import { MycurrencyPipe, MynumberPipe } from '../../../../core/pipes';
import { ProductsService, BranchSummary, KitBuilderUsage } from '../../services/products.service';

export interface KitBuildModalData {
  productId:        string;
  productName?:     string;
  branch:           BranchSummary;
  maxQty:           number;
  kitBuilderUsages: KitBuilderUsage[];
}

@Component({
  selector: 'app-kit-build-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent, MycurrencyPipe, MynumberPipe],
  template: `
    <app-modal-header
      [title]="'Build a kit'"
      [subtitle]="data.productName ? (data.productName + ' · ' + data.branch.branch) : data.branch.branch" />

    <div class="body">
      <div class="row row--split">
        <label class="label" for="kit-build-qty">Build quantity</label>
        <div class="max">Max: <span class="max-val">{{ data.maxQty }}</span></div>
      </div>
      <input
        id="kit-build-qty"
        type="number"
        class="input"
        [min]="0"
        [max]="data.maxQty"
        [(ngModel)]="qty"
        (ngModelChange)="clamp()" />

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th class="start">Component</th>
              <th class="end">On hand</th>
              <th class="end usage-col">Usage</th>
              <th class="end">Cost</th>
            </tr>
          </thead>
          <tbody>
            @for (u of data.kitBuilderUsages; track u.productName) {
              <tr [class.row--warn]="u.onHand < qty() * u.qty">
                <td>
                  <div class="comp-name">
                    <span class="name">{{ u.productName }}</span>
                    @if (u.UOM) { <span class="uom">{{ u.UOM }}</span> }
                  </div>
                </td>
                <td class="end">
                  <span class="mono">{{ u.onHand | mynumber }}</span>
                  @if (qty() > 0) {
                    <div class="delta delta--down">−{{ qty() * u.qty | mynumber }}</div>
                  }
                </td>
                <td class="end usage-col">
                  <span class="usage-pill">×{{ u.qty | mynumber }}</span>
                </td>
                <td class="end">
                  <span class="mono">{{ u.qty * u.unitCost | mycurrency }}</span>
                  @if (qty() > 0) {
                    <div class="delta delta--down">
                      −{{ qty() * u.qty * u.unitCost | mycurrency }}
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th class="start">Total cost</th>
              <th></th>
              <th class="usage-col"></th>
              <th class="end">
                <span class="mono">{{ totalCost() | mycurrency }}</span>
                @if (qty() > 0) {
                  <div class="delta delta--down">−{{ qty() * totalCost() | mycurrency }}</div>
                }
              </th>
            </tr>
          </tfoot>
        </table>
      </div>

      @if (error()) { <div class="state state--error">{{ error() }}</div> }
    </div>

    <app-modal-footer>
      <button type="button" class="btn" (click)="ref.dismiss()">Cancel</button>
      <button type="button"
        class="btn btn--primary"
        [disabled]="qty() === 0 || busy()"
        (click)="submit()">
        {{ busy() ? 'Building…' : 'Build' }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body { padding: 16px 20px 8px; }
    .row--split { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
    .label { font-size: 13px; font-weight: 600; color: #0f172a; }
    .max   { font-size: 12px; color: #64748b; }
    .max-val { color: #0f172a; font-weight: 600; }
    .input {
      width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
      font-size: 15px; font-weight: 600; color: #0f172a; background: #fff;
      font-variant-numeric: tabular-nums;
    }
    .input:focus { outline: none; border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.18); }

    /* Component table — same chrome as stock modal */
    .tbl-wrap {
      margin-top: 14px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
    }
    .tbl { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
    .tbl thead th {
      background: #f8fafc; color: #64748b;
      font-weight: 600; font-size: 11px;
      text-transform: uppercase; letter-spacing: .04em;
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
    }
    .tbl tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
      vertical-align: middle;
    }
    .tbl tbody tr:last-child td { border-bottom: none; }
    .tbl tbody tr:hover { background: #f8fafc; }
    .tbl tfoot th {
      padding: 10px 14px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      color: #0f172a; font-weight: 700; font-size: 13px;
      text-transform: none; letter-spacing: 0;
    }
    .start { text-align: start; }
    .end   { text-align: end; }
    .mono  { font-variant-numeric: tabular-nums; }
    .usage-col { width: 90px; }

    /* Row when a build would drive this component below zero */
    .row--warn td { background: #fef2f2; }
    .row--warn:hover td { background: #fee2e2; }

    .comp-name { display: flex; align-items: center; gap: 8px; }
    .name      { font-weight: 500; color: #0f172a; }
    .uom {
      padding: 1px 8px; border-radius: 999px;
      background: #e0f2f7; color: #0e7490;
      font-size: 11px; font-weight: 500;
    }

    /* Usage factor chip */
    .usage-pill {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 3px 10px; border-radius: 999px;
      background: #f1f5f9; color: #475569;
      font-weight: 600; font-size: 12px; font-variant-numeric: tabular-nums;
    }

    /* Delta projection underneath the current value */
    .delta { margin-top: 2px; font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .delta--down { color: #b91c1c; }

    .state--error {
      margin-top: 12px; padding: 10px 12px;
      background: #fef2f2; border: 1px solid #fecaca;
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
export class KitBuildModalComponent {
  data = inject<KitBuildModalData>(MODAL_DATA);
  ref  = inject<ModalRef<{ onHand?: number }>>(MODAL_REF);
  private svc = inject(ProductsService);

  qty   = signal(0);
  busy  = signal(false);
  error = signal<string | null>(null);

  totalCost = computed(() =>
    this.data.kitBuilderUsages.reduce((s, u) => s + u.qty * u.unitCost, 0),
  );

  clamp(): void {
    const v = this.qty();
    if (v < 0) this.qty.set(0);
    else if (v > this.data.maxQty) this.qty.set(this.data.maxQty);
  }

  async submit(): Promise<void> {
    if (this.qty() === 0) return;
    this.busy.set(true);
    this.error.set(null);
    const branchId = this.data.branch.branchId || this.data.branch.id || '';
    const res = await this.svc.buildKit(this.data.productId, branchId, this.qty(), this.data.branch);
    this.busy.set(false);
    if (!res.success) {
      this.error.set(res.message || 'Build failed.');
      return;
    }
    this.ref.close({ onHand: res.data?.onHand });
  }
}
