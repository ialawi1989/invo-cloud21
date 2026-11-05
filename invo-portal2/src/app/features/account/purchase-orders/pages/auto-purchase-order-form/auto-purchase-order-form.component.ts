import '../../../account-i18n';
import { ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { QtyInputComponent } from '@shared/components/qty-input/qty-input.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { DocFormShellComponent } from '../../../components/doc-form-shell/doc-form-shell.component';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { SuppliersService } from '../../../suppliers/services/suppliers.service';
import { PurchaseOrdersService } from '../../services/purchase-orders.service';

interface AutoLine {
  productId: string;
  name: string;
  type: string;
  qty: number;
  unitCost: number;
  productCost: number;
  supplierCost: number | null;
  supplier: { id: string; name: string } | null;
}

/**
 * Auto purchase order (`/account/purchase-order/auto-po/new`): pick a branch and the products that fell to
 * their re-order point are proposed with a quantity (the re-order amount), the cheapest supplier's cost and
 * that supplier. Each line can change supplier (its cost follows) or be dropped; "Create Purchase Order" makes
 * one purchase order per supplier (`accounts/convertAutoPurchase`).
 */
@Component({
  selector: 'app-auto-purchase-order-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, DocFormShellComponent, SearchDropdownComponent, QtyInputComponent],
  template: `
    <app-doc-form-shell
      [title]="'PURCHASE_ORDERS.AUTO.TITLE' | translate" [breadcrumbs]="breadcrumbs"
      [canDraft]="false" [submitting]="submitting()" [saveDisabled]="!lines().length"
      [saveLabel]="'PURCHASE_ORDERS.AUTO.CREATE' | translate" [total]="total()" [totalQty]="totalQty()"
      (save)="create()" (cancel)="cancel()">

      <section class="df-card">
        <h2 class="df-card__title"><span class="df-ico df-ico--green" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg></span>{{ 'PURCHASE_ORDERS.AUTO.DETAILS' | translate }}</h2>
        <div class="df-field df-field--wide">
          <label>{{ 'DOC_FORM.BRANCH' | translate }} <span class="req">*</span></label>
          <app-search-dropdown [items]="branches()" [displayWith]="branchLabel" [compareWith]="byId"
            [value]="branch()" (valueChange)="onBranch($any($event))" [clearable]="false"
            [placeholder]="'DOC_FORM.SELECT_BRANCH' | translate"/>
        </div>
      </section>

      <section class="df-card">
        <h2 class="df-card__title">{{ 'PURCHASE_ORDERS.AUTO.RECOMMENDED_LINES' | translate }}</h2>
        @if (loading()) {
          <p class="ap__empty">…</p>
        } @else if (!branch()) {
          <p class="ap__empty">{{ 'PURCHASE_ORDERS.AUTO.PICK_BRANCH' | translate }}</p>
        } @else if (!lines().length) {
          <p class="ap__empty">{{ 'PURCHASE_ORDERS.AUTO.NOTHING_TO_ORDER' | translate }}</p>
        } @else {
          <div class="ap__wrap">
            <table class="ap__table">
              <thead>
                <tr>
                  <th>{{ 'PURCHASE_ORDERS.AUTO.PRODUCT' | translate }}</th>
                  <th>{{ 'DOC_LINES.COL_QTY' | translate }}</th>
                  <th>{{ 'PURCHASE_ORDERS.FORM.UNIT_COST' | translate }}</th>
                  <th>{{ 'PURCHASE_ORDERS.AUTO.SUPPLIER' | translate }}</th>
                  <th class="end">{{ 'DOC_LINES.COL_AMOUNT' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (l of lines(); track l.productId; let i = $index) {
                  <tr>
                    <td><b>{{ l.name }}</b></td>
                    <td class="ap__qty"><app-qty-input size="sm" [min]="0.001" [ngModel]="l.qty" (ngModelChange)="setQty(l, $event)"/></td>
                    <td class="ap__cost">
                      <input class="ap__num" type="number" min="0" step="any" [ngModel]="l.unitCost" (ngModelChange)="setCost(l, $event)"/>
                      <small>{{ (l.supplierCost ? 'PURCHASE_ORDERS.FORM.SUPPLIER_COST' : 'PURCHASE_ORDERS.FORM.PRODUCT_COST') | translate }}</small>
                    </td>
                    <td class="ap__supplier">
                      <app-search-dropdown [loadFn]="loadSuppliers" [pageSize]="20" [displayWith]="supplierLabel" [compareWith]="byId"
                        [value]="l.supplier" (valueChange)="onSupplier(l, $any($event))" [clearable]="false"
                        [class.ap__missing]="!l.supplier && showErrors()"
                        [placeholder]="'PURCHASE_ORDERS.AUTO.SELECT_SUPPLIER' | translate"/>
                    </td>
                    <td class="end">{{ l.unitCost * l.qty | mycurrency }}</td>
                    <td class="end"><button type="button" class="ap__x" (click)="remove(i)" aria-label="remove">✕</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </app-doc-form-shell>
  `,
  styles: [`
    .ap__empty { color: #64748b; margin: 0; }
    .ap__wrap { overflow-x: auto; }
    .ap__table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .ap__table th { text-align: start; font-size: 12.5px; color: #64748b; font-weight: 600; padding: 8px 10px; border-bottom: 1px solid #e4e7ec; white-space: nowrap; }
    .ap__table td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .ap__table .end { text-align: end; }
    .ap__qty { width: 150px; }
    .ap__cost { width: 150px; }
    .ap__cost small { display: block; font-size: 11px; color: #b45309; margin-top: 2px; }
    .ap__supplier { min-width: 220px; width: 260px; }
    .ap__num { width: 100%; box-sizing: border-box; background: #fff; border: 1px solid #d0d5dd; border-radius: 8px; padding: 8px 10px; font: inherit; height: 38px; text-align: end; }
    .ap__x { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #fecaca; background: #fff; color: #dc2626; cursor: pointer; }
    .ap__missing { outline: 1px solid #dc2626; border-radius: 8px; }
  `],
})
export class AutoPurchaseOrderFormComponent implements OnInit {
  private orders = inject(PurchaseOrdersService);
  private suppliers = inject(SuppliersService);
  private lookups = inject(SalesLookupsService);
  private router = inject(Router);
  private location = inject(Location);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;

  breadcrumbs: BreadcrumbItem[] = [];
  branches = signal<any[]>([]);
  branch = signal<any>(null);
  lines = signal<AutoLine[]>([]);
  loading = signal(false);
  submitting = signal(false);
  showErrors = signal(false);

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/purchase-orders');
    await this.lang.loadFeature('account/components/doc-lines-table');
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('PURCHASE_ORDERS.DASHBOARD'), routerLink: '/dashboard' },
      { label: t('PURCHASE_ORDERS.LIST.PURCHASE_ORDER_LIST'), routerLink: '/account/purchase-order' },
      { label: t('PURCHASE_ORDERS.AUTO.TITLE') },
    ];
    this.branches.set(await this.lookups.getBranches());
    this.cdr.detectChanges();
  }

  branchLabel = (b: any) => b?.name ?? '';
  supplierLabel = (s: any) => s?.name ?? '';
  byId = (a: any, b: any) => a?.id === b?.id;

  loadSuppliers = async (p: { page: number; pageSize: number; search: string }) => {
    const d = await this.suppliers.getSuppliersMiniList({ page: p.page, limit: p.pageSize, searchTerm: p.search, sortBy: {} });
    return { items: d?.list ?? [], hasMore: p.page < (d?.pageCount ?? 1) };
  };

  total = () => this.lines().reduce((s, l) => s + (Number(l.unitCost) || 0) * (Number(l.qty) || 0), 0);
  totalQty = () => this.lines().reduce((s, l) => s + (Number(l.qty) || 0), 0);

  async onBranch(b: any): Promise<void> {
    this.branch.set(b ?? null);
    this.lines.set([]);
    if (!b) return;
    this.loading.set(true);
    this.cdr.detectChanges();
    try {
      const res: any = await this.orders.getRecommendedPurchaseProducts({ branchId: b.id });
      const rows: any[] = Array.isArray(res?.data) ? res.data : [];
      this.lines.set(rows.filter(r => r.productId).map(r => {
        const supplierCost = r.supplierCost == null ? null : Number(r.supplierCost);
        const sup = r.recommendedSupplier;
        return {
          productId: r.productId,
          name: r.name,
          type: r.type,
          qty: Number(r.reorderAmount) || 1,
          unitCost: supplierCost ? supplierCost : Number(r.productCost) || 0,
          productCost: Number(r.productCost) || 0,
          supplierCost,
          supplier: sup?.id ? { id: sup.id, name: sup.name } : null,
        } as AutoLine;
      }));
    } finally {
      this.loading.set(false);
      this.cdr.detectChanges();
    }
  }

  setQty(l: AutoLine, v: any): void { l.qty = Number(v) || 0; this.cdr.markForCheck(); }
  setCost(l: AutoLine, v: any): void { l.unitCost = Number(v) || 0; this.cdr.markForCheck(); }
  remove(i: number): void { this.lines.set(this.lines().filter((_, k) => k !== i)); this.cdr.markForCheck(); }

  /** A different supplier brings its own cost for the product (else the product's cost). */
  async onSupplier(l: AutoLine, s: any): Promise<void> {
    l.supplier = s ? { id: s.id, name: s.name } : null;
    if (!s) return;
    const item: any = await this.suppliers.getSupplierItemCost(l.productId, s.id);
    if (item) {
      l.supplierCost = item.cost;
      if (item.cost != null && Number(item.cost) !== 0) l.unitCost = Number(item.cost);
    } else {
      l.supplierCost = 0;
      l.unitCost = l.productCost;
    }
    this.cdr.markForCheck();
  }

  async create(): Promise<void> {
    if (this.submitting()) return;
    if (this.lines().some(l => !l.supplier)) {
      this.showErrors.set(true);
      this.toast.error('COMMON.OPS', this.lang.instant('PURCHASE_ORDERS.AUTO.FILL_OR_DELETE'));
      return;
    }
    this.submitting.set(true);
    try {
      const res: any = await this.orders.convertAutoPurchase({
        branchId: this.branch().id,
        lines: this.lines().map(l => ({ productId: l.productId, supplierId: l.supplier!.id, unitCost: l.unitCost, qty: l.qty })),
      });
      if (res?.success) {
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/account/purchase-order']);
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : '');
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.submitting.set(false);
      this.cdr.markForCheck();
    }
  }

  cancel(): void {
    if (this.canGoBack) this.location.back();
    else void this.router.navigate(['/account/purchase-order']);
  }
}
