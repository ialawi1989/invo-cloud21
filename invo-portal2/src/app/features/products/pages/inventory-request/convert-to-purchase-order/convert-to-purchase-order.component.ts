import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { SalesLookupsService } from '../../../../account/services/sales-lookups.service';
import { InventoryRequest, InventoryRequestService } from '../../../services/inventory-request.service';
import { PoPreviewPaperComponent, SupplierGroup, groupBySupplier } from '../po-preview-paper/po-preview-paper.component';

const ZOOM_KEY = 'convertToPurchaseOrderZoomLevel';

/**
 * Inventory request → Convert to purchase order (`/inventory/request/convert-to-purchase-order/:id`).
 * Legacy `convert-to-purchase-order`: the request's lines grouped per supplier, a preview of the PO each
 * supplier will get (pick one on the left), zoom + print, and "Convert all" which posts
 * `product/convertToPurchaseOrder { requestId }` — one PO per supplier, request marked Converted.
 */
@Component({
  selector: 'app-convert-to-purchase-order',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, LoadingOverlayComponent,
    FormStickyFooterComponent, PoPreviewPaperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './convert-to-purchase-order.component.html',
  styleUrl: './convert-to-purchase-order.component.scss',
})
export class ConvertToPurchaseOrderComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(InventoryRequestService);
  private lookups = inject(SalesLookupsService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);

  loading = signal(true);
  converting = signal(false);
  collapsed = signal(false);
  zoom = signal(this.savedZoom());

  request = signal<InventoryRequest | null>(null);
  groups = signal<SupplierGroup[]>([]);
  selected = signal<SupplierGroup | null>(null);
  branchName = signal('');
  private i18nTick = signal(0);

  /** Lines with no supplier can't become a PO (the backend rejects with "Supplier Is Required"). */
  hasUnassigned = computed(() => this.groups().some((g) => !g.supplierId));
  alreadyConverted = computed(() => this.request()?.status === 'Converted');

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.INVENTORY_REQUEST.TITLE'), routerLink: '/inventory/request' },
      { label: this.translate.instant('PRODUCTS.INVENTORY_REQUEST.CONVERT_TO_PO') },
    ];
  });

  constructor() {
    withTranslations('products');
    this.translate.onTranslationChange.subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange.subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    try {
      const req = await this.service.getById(id);
      if (!req) {
        this.toast.error('PRODUCTS.INVENTORY_REQUEST.NOT_FOUND');
        void this.router.navigate(['/inventory/request']);
        return;
      }
      this.request.set(req);
      const groups = groupBySupplier(req.lines.filter((l) => !!l.productId));
      this.groups.set(groups);
      this.selected.set(groups[0] ?? null);
      void this.lookups.getBranches()
        .then((b) => this.branchName.set(b.find((x: any) => x.id === req.branchId)?.name ?? req.branchName))
        .catch(() => undefined);
    } finally {
      this.loading.set(false);
    }
  }

  isActive = (g: SupplierGroup) => this.selected() === g;
  pick(g: SupplierGroup): void { this.selected.set(g); }

  async convert(): Promise<void> {
    const req = this.request();
    if (!req || this.converting() || this.hasUnassigned() || this.alreadyConverted()) return;
    this.converting.set(true);
    try {
      const res = await this.service.convertToPurchaseOrder(req.id);
      if (res?.success) {
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/inventory/request']);
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : '');
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.converting.set(false);
    }
  }

  print(): void { window.print(); }
  cancel(): void { void this.router.navigate(['/inventory/request']); }

  private savedZoom(): number {
    try {
      const v = Number(localStorage.getItem(ZOOM_KEY));
      return v >= 40 && v <= 150 ? v : 100;
    } catch { return 100; }
  }
  setZoom(v: number): void {
    this.zoom.set(v);
    try { localStorage.setItem(ZOOM_KEY, String(v)); } catch { /* storage unavailable */ }
  }
}
