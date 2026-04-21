import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MODAL_DATA, MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef, ModalService } from '../../../../shared/modal/modal.service';
import { ModalHeaderComponent } from '../../../../shared/modal/modal-header.component';
import { PrivilegeService } from '../../../../core/auth/privileges/privilege.service';
import { MycurrencyPipe, MynumberPipe } from '../../../../core/pipes';
import { ProductsService, BranchSummary } from '../../services/products.service';
import { KitBuildModalComponent, KitBuildModalData } from './kit-build-modal.component';
import { KitBreakModalComponent, KitBreakModalData } from './kit-break-modal.component';

export interface ProductStockModalData {
  productId:   string;
  productName?: string;
  productType?: string;
  qtySum?:     number;
}

/**
 * Per-product branch summary. Shows on-hand + stock value per branch and
 * (for kit products) per-branch Build / Break actions that open secondary
 * modals handled by sibling components.
 */
@Component({
  selector: 'app-product-stock-modal',
  standalone: true,
  imports: [CommonModule, ModalHeaderComponent, MycurrencyPipe, MynumberPipe],
  template: `
    <app-modal-header
      [title]="data.productName ? (data.productName + ' — Stock') : 'Stock breakdown'" />

    <div class="body">
      @if (loading()) {
        <div class="state">Loading…</div>
      } @else if (error()) {
        <div class="state state--error">{{ error() }}</div>
      } @else if (rows().length === 0) {
        <div class="state">No availability data.</div>
      } @else {
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th class="start">Branch</th>
                <th class="end qty-col">On hand</th>
                @if (canViewStockValue) {
                  <th class="end">Stock value</th>
                }
                @if (isKit) {
                  <th class="end action-col">Actions</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.branchId || row.id || row.branch) {
                <tr>
                  <td>
                    <span class="branch">{{ row.branch }}</span>
                  </td>
                  <td class="end qty-col">
                    <span class="qty-pill"
                      [class.qty-pill--zero]="!row.onHand">{{ row.onHand | mynumber }}</span>
                  </td>
                  @if (canViewStockValue) {
                    <td class="end mono">{{ row.stockValue | mycurrency }}</td>
                  }
                  @if (isKit) {
                    <td class="end actions action-col">
                      <button type="button" class="btn-small btn-small--success" (click)="askBuild(row)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="12" height="12">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Build
                      </button>
                      <button type="button" class="btn-small btn-small--danger"
                        [disabled]="!row.onHand"
                        (click)="askBreak(row)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="12" height="12">
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Break
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <th class="start">Total</th>
                <th class="end qty-col">
                  <span class="qty-pill qty-pill--total">{{ totalOnHand() | mynumber }}</span>
                </th>
                @if (canViewStockValue) {
                  <th class="end mono">{{ totalStockValue() | mycurrency }}</th>
                }
                @if (isKit) { <th class="end action-col"></th> }
              </tr>
            </tfoot>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .body   { padding: 16px 20px; }
    .state  { padding: 32px 8px; text-align: center; color: #64748b; font-size: 13px; }
    .state--error {
      margin: 0 0 12px; padding: 10px 12px;
      background: #fef2f2; border: 1px solid #fecaca;
      color: #991b1b; border-radius: 8px; font-size: 12px; text-align: start;
    }

    /* Rounded, bordered container so the table reads as one unit */
    .tbl-wrap {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
    }

    .tbl {
      width: 100%; border-collapse: separate; border-spacing: 0;
      font-size: 13px;
    }
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

    /* Column widths: keep the action column compact so the branch column can breathe. */
    .qty-col    { width: 110px; }
    .action-col { width: 150px; }

    .branch { font-weight: 500; color: #0f172a; }

    /* Numeric display */
    .mono { font-variant-numeric: tabular-nums; color: #0f172a; }

    /* On-hand pill — visual focus on the number */
    .qty-pill {
      display: inline-flex; min-width: 36px; justify-content: center;
      padding: 3px 10px; border-radius: 999px;
      background: #e0f2f7; color: #0e7490;
      font-weight: 600; font-size: 12px; font-variant-numeric: tabular-nums;
    }
    .qty-pill--zero {
      background: #f1f5f9; color: #94a3b8;
    }
    .qty-pill--total {
      background: #cffafe; color: #0e7490;
    }

    /* Compact action buttons with an icon */
    .actions { display: inline-flex; gap: 6px; justify-content: flex-end; }
    .btn-small {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 10px; border-radius: 6px;
      border: 1px solid transparent;
      font-size: 12px; font-weight: 600;
      cursor: pointer;
      transition: background .12s, border-color .12s, color .12s;
    }
    .btn-small:disabled { opacity: .45; cursor: not-allowed; }
    .btn-small--success {
      background: #ecfeff; border-color: #a5f3fc; color: #0e7490;
    }
    .btn-small--success:hover:not(:disabled) {
      background: #cffafe; border-color: #67e8f9;
    }
    .btn-small--danger {
      background: #fef2f2; border-color: #fecaca; color: #b91c1c;
    }
    .btn-small--danger:hover:not(:disabled) {
      background: #fee2e2; border-color: #fca5a5;
    }
  `],
})
export class ProductStockModalComponent implements OnInit {
  data          = inject<ProductStockModalData>(MODAL_DATA);
  ref           = inject<ModalRef<BranchSummary[]>>(MODAL_REF);
  private svc   = inject(ProductsService);
  private modal = inject(ModalService);
  private privs = inject(PrivilegeService);

  loading = signal(true);
  error   = signal<string | null>(null);
  rows    = signal<BranchSummary[]>([]);

  totalOnHand     = computed(() => this.rows().reduce((s, r) => s + Number(r.onHand ?? 0), 0));
  totalStockValue = computed(() => this.rows().reduce((s, r) => s + Number(r.stockValue ?? 0), 0));

  get isKit(): boolean { return this.data.productType === 'kit'; }
  get canViewStockValue(): boolean {
    return this.privs.check('productSecurity.actions.viewStockValue.access');
  }

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.svc.getProductAvailability(this.data.productId);
      this.rows.set(data);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load availability.');
    } finally {
      this.loading.set(false);
    }
    // When this modal closes we hand the latest rows back to the opener so
    // the caller can reflect updated on-hand numbers after a build/break.
    this.ref.setResult(this.rows());
  }

  async askBuild(row: BranchSummary): Promise<void> {
    const branchId = row.branchId || row.id || '';
    if (!branchId) {
      this.error.set('Missing branch id for this row.');
      return;
    }
    this.error.set(null);
    try {
      const res = await this.svc.getKitMaxQty(this.data.productId, branchId);
      if (!res.success) {
        this.error.set(res.message || 'Unable to load kit data.');
        return;
      }

      const buildRef = this.modal.open<KitBuildModalComponent, KitBuildModalData, { onHand?: number }>(
        KitBuildModalComponent,
        {
          size: 'md',
          data: {
            productId:       this.data.productId,
            productName:     this.data.productName,
            branch:          row,
            maxQty:          res.data.maximumQty,
            kitBuilderUsages: res.data.kitBuilderUsages,
          },
        },
      );
      const result = await buildRef.afterClosed();
      if (result?.onHand !== undefined) {
        this.updateRowOnHand(row, result.onHand);
      }
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to open build dialog.');
      console.error('[product-stock-modal] askBuild failed', e);
    }
  }

  async askBreak(row: BranchSummary): Promise<void> {
    const breakRef = this.modal.open<KitBreakModalComponent, KitBreakModalData, { onHand?: number }>(
      KitBreakModalComponent,
      {
        size: 'md',
        data: {
          productId:   this.data.productId,
          productName: this.data.productName,
          branch:      row,
        },
      },
    );
    const result = await breakRef.afterClosed();
    if (result?.onHand !== undefined) {
      this.updateRowOnHand(row, result.onHand);
    }
  }

  private updateRowOnHand(target: BranchSummary, onHand: number): void {
    this.rows.update(list => list.map(r =>
      (r.branchId && r.branchId === target.branchId) || (r.id && r.id === target.id)
        ? { ...r, onHand }
        : r
    ));
    this.ref.setResult(this.rows());
  }
}

