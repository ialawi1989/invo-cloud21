import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { LayoutService } from '@core/layout/services/layout.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { DocRailItem } from '../../../../account/services/document-view-base';
import { DocViewShellComponent } from '../../../../account/components/doc-view-shell/doc-view-shell.component';
import { InventoryRequest, InventoryRequestService } from '../../../services/inventory-request.service';
import { InventoryRequestPaperComponent } from '../inventory-request-paper/inventory-request-paper.component';

const ZOOM_KEY = 'inventoryRequestZoomLevel';

/**
 * Inventory request → view (`/inventory/request/:id/view`). Legacy `inventory-request-view`:
 * the request on paper with a persisted zoom, links to its converted purchase / transfer orders,
 * Edit (until Converted) and Print, plus the left rail of other requests (search + paging) to hop
 * between records. Uses the shared Zoho-style `<app-doc-view-shell>` with the paper in its `alt` slot.
 */
@Component({
  selector: 'app-inventory-request-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, DocViewShellComponent, InventoryRequestPaperComponent],
  templateUrl: './inventory-request-view.component.html',
  styleUrl: './inventory-request-view.component.scss',
  // Keeps the fixed-height chain from `.main-content.no-padding` down to the shell intact.
  host: { style: 'display: contents' },
})
export class InventoryRequestViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(InventoryRequestService);
  private layout = inject(LayoutService);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('productSecurity.actions.requestInventoryAdd.access');
  readonly canConvertPo = this.privileges.check('purchaseOrderSecurity.actions.convert.access');

  doc = signal<InventoryRequest | null>(null);
  loading = signal(true);
  zoom = signal(this.savedZoom());

  // ── rail ──────────────────────────────────────────────────────────────────
  readonly railPageSize = 15;
  railItems = signal<DocRailItem[]>([]);
  railLoading = signal(false);
  railTerm = signal('');
  railPage = signal(1);
  railPageCount = signal(1);
  private railSeq = 0;
  private railSearch$ = new Subject<string>();

  get id(): string { return this.route.snapshot.paramMap.get('id') ?? ''; }
  title = computed(() => this.lang.instant('PRODUCTS.INVENTORY_REQUEST.TITLE'));
  paperData = computed(() => {
    const d = this.doc();
    return d && { ...d };
  });

  printItems = computed<DropdownMenuBtnItem[]>(() => [
    { label: this.lang.instant('COMMON.PRINT'), click: () => window.print(), disabled: false, danger: false },
  ]);

  async ngOnInit(): Promise<void> {
    // Edge-to-edge like the other document views — drop the app shell's padding.
    this.layout.setNoPadding(true);
    await this.lang.loadFeature('products');
    this.railSearch$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((t) => {
      this.railTerm.set(t);
      void this.loadRail(1);
    });
    void this.loadRail(1);
    this.route.paramMap.subscribe(() => void this.load());
  }

  ngOnDestroy(): void {
    this.layout.setNoPadding(false);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    const d = await this.service.getById(this.id);
    if (!d) {
      void this.router.navigate(['/inventory/request']);
      return;
    }
    this.doc.set(d);
    this.loading.set(false);
  }

  async loadRail(page: number): Promise<void> {
    const seq = ++this.railSeq;
    this.railLoading.set(true);
    try {
      const res = await this.service.getList({ page, limit: this.railPageSize, searchTerm: this.railTerm(), sortBy: {} });
      if (seq !== this.railSeq) return;
      this.railItems.set(res.list.map((r) => ({
        id: r.id,
        primary: r.branchName,
        amountLabel: r.status,
        sub: `${r.employeeName} · ${new Date(r.createdAt).toLocaleDateString()}`,
      })));
      this.railPage.set(page);
      this.railPageCount.set(Math.max(1, res.pageCount));
    } finally {
      if (seq === this.railSeq) this.railLoading.set(false);
    }
  }

  onRailSearch(term: string): void { this.railSearch$.next(term); }
  railPrev(): void { if (this.railPage() > 1) void this.loadRail(this.railPage() - 1); }
  railNext(): void { if (this.railPage() < this.railPageCount()) void this.loadRail(this.railPage() + 1); }
  railGoTo(item: DocRailItem): void { void this.router.navigate(['/inventory/request', item.id, 'view']); }

  add(): void { void this.router.navigate(['/inventory/request', 'new']); }
  edit(): void { void this.router.navigate(['/inventory/request', this.id]); }
  goToList(): void { void this.router.navigate(['/inventory/request']); }
  convertToPo(): void { void this.router.navigate(['/inventory/request/convert-to-purchase-order', this.id]); }

  canEdit = computed(() => this.canAdd && !!this.doc() && this.doc()!.status !== 'Converted');
  canConvert = computed(() => {
    const d = this.doc();
    return !!d && this.canConvertPo && d.status !== 'Converted' && d.lines.length > 0 && d.lines.every((l) => !!l.supplierId);
  });

  // ── zoom (persisted like legacy) ──────────────────────────────────────────
  private savedZoom(): number {
    try {
      const v = Number(localStorage.getItem(ZOOM_KEY));
      return v >= 40 && v <= 150 ? v : 100;
    } catch { return 100; }
  }
  setZoom(v: number): void {
    this.zoom.set(v);
    try { localStorage.setItem(ZOOM_KEY, String(v)); } catch { /* storage unavailable — zoom still applies for the session */ }
  }
}
