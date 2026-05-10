import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ModalService } from '@shared/modal/modal.service';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { BranchConnectionService } from '@core/layout/services/branch.service';

import { ProductsService } from '../../services/products.service';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickProductResult,
  PickedProduct,
} from '../product-form/components/pick-product-modal/pick-product-modal.component';

import { LabelBuilderService } from '../../../label-builder/services/label-builder.service';
import {
  LabelTemplate,
  LabelTemplateSummary,
} from '../../../label-builder/services/label-template.types';
import { renderTemplateToCanvas } from '../../../label-builder/services/png-export';
import { LabelDataMap } from '../../../label-builder/services/token-resolver';
import {
  PreviewAllModalComponent,
  PreviewAllModalData,
} from './preview-all-modal/preview-all-modal.component';
import {
  ImportBarcodesModalComponent,
  ImportBarcodesResult,
} from './import-barcodes-modal/import-barcodes-modal.component';

interface BulkRow extends PickedProduct {
  /** How many labels to print for this product. */
  printQty: number;
  /** Full product blob so token resolution can read everything the
   *  user might have bound (`!product.*`). Lazy-loaded the first time
   *  the row is added — cached on the row to avoid refetching. */
  full?: any;
}

/**
 * BulkPrintComponent
 * ──────────────────
 * Port of the legacy InvoCloudFront2 Bulk Barcode Print page.
 *
 * Top settings: branch + label template. Mid: product picker with a
 * per-row print-qty stepper. Side: live preview of the highlighted
 * row's label rendered against real product data via the same
 * `renderTemplateToCanvas` + `resolveTokens` pipeline the single
 * Print Label modal uses. Footer: Print (multi-page popup window
 * with `@page` sized to the label and one page per label×qty).
 *
 * Scoped MVP:
 *   - branch + template + pick-products + qty + preview + print  ✔
 *   - CSV import / barcode-scanner  → deferred (legacy paths in OLD)
 *   - ZIP download / PDF export     → deferred (needs JSZip / jsPDF)
 *
 * The page is reachable from the products-list "Print Labels"
 * action.
 */
@Component({
  selector: 'app-bulk-print',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    SearchDropdownComponent,
    TooltipDirective,
    LoadingOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-print.component.html',
  styleUrl: './bulk-print.component.scss',
})
export class BulkPrintComponent {
  private translate = inject(TranslateService);
  private branches  = inject(BranchConnectionService);
  private builder   = inject(LabelBuilderService);
  private products  = inject(ProductsService);
  private modal     = inject(ModalService);

  constructor() {
    withTranslations('products');
    void this.loadInitial();
    // Re-render the preview whenever the active row, branch, or
    // template changes. Token resolution depends on all three:
    // branch picks the price line on `branchProduct[]`, template
    // controls which fields are referenced, the active row picks
    // which product fills `!product.*`.
    effect(() => {
      const active = this.activeRow();
      const t      = this.template();
      this.selectedBranchId(); // touch
      if (!active || !t) {
        this.previewUrl.set('');
        return;
      }
      void this.renderPreview(active, t);
    });
  }

  loading      = signal<boolean>(false);
  rendering    = signal<boolean>(false);
  printing     = signal<boolean>(false);
  previewing   = signal<boolean>(false);
  importing    = signal<boolean>(false);
  downloading  = signal<boolean>(false);
  /** Live progress chip while a download is in flight — `{ done,
   *  total }`. Null when idle. */
  downloadProgress = signal<{ done: number; total: number } | null>(null);
  /** Inline result chip after an import — `{ added, missed }` so the
   *  user knows how many barcodes resolved and how many didn't. */
  importResult = signal<{ added: number; missed: number; missedCodes: string[] } | null>(null);

  branchItems = computed(() =>
    this.branches.branches().map(b => ({ label: b.name || '—', value: b.id })),
  );
  selectedBranchId = signal<string>('');

  templates  = signal<LabelTemplateSummary[]>([]);
  templateItems = computed(() =>
    this.templates().map(t => ({ label: t.name || '—', value: t.id })),
  );
  selectedTemplateId = signal<string>('');
  /** Hydrated `LabelTemplate` for the active id. Either pulled from
   *  the inline `template[]` on the list payload or fetched via
   *  `getById` for legacy backends. */
  template = signal<LabelTemplate | null>(null);

  /** Selected products with their print quantities. */
  rows = signal<BulkRow[]>([]);

  /** Whichever row's preview is currently visible on the side
   *  panel — defaults to the first row, follows user clicks. */
  activeRowId = signal<string>('');
  activeRow = computed<BulkRow | null>(() =>
    this.rows().find(r => r.id === this.activeRowId()) ?? this.rows()[0] ?? null,
  );

  previewUrl = signal<string>('');

  // ─── i18n-aware breadcrumbs ───────────────────────────────────────
  private i18nTick = signal(0);
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.LIST_TITLE'), routerLink: '/products/list' },
      { label: this.translate.instant('PRODUCTS.BULK_PRINT.TITLE') },
    ];
  });

  // ─── Total label count (sum of printQty) ──────────────────────────
  totalLabels = computed<number>(() =>
    this.rows().reduce((sum, r) => sum + (r.printQty || 1), 0),
  );

  // ─── Initial load: branches + templates ───────────────────────────
  private async loadInitial(): Promise<void> {
    this.loading.set(true);
    try {
      if (!this.branches.loaded()) await this.branches.load();
      const { list } = await this.builder.getList({ page: 1, limit: 200 });
      this.templates.set(list);
      // Preselect the first branch + template so the user lands on
      // a usable state instead of staring at empty selectors.
      const firstBranch   = this.branches.branches()[0]?.id;
      if (firstBranch) this.selectedBranchId.set(firstBranch);
      if (list.length)  await this.pickTemplate(list[0].id);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Template / branch handlers ───────────────────────────────────
  onBranchChange(event: any): void {
    const id = event && typeof event === 'object' ? event.value : event;
    this.selectedBranchId.set(id ?? '');
  }

  async onTemplateChange(event: any): Promise<void> {
    const id = event && typeof event === 'object' ? event.value : event;
    if (!id) return;
    await this.pickTemplate(id);
  }

  private async pickTemplate(id: string): Promise<void> {
    this.selectedTemplateId.set(id);
    const cached = this.templates().find(t => t.id === id);
    let tpl: LabelTemplate | null = null;
    if (cached?.template) {
      tpl = new LabelTemplate();
      tpl.ParseJson({
        id:           cached.id,
        name:         cached.name,
        templateType: cached.templateType,
        labelHeight:  cached.labelHeight,
        labelWidth:   cached.labelWidth,
        dpi:          cached.dpi,
        template:     cached.template,
      });
    } else {
      tpl = await this.builder.getById(id);
    }
    this.template.set(tpl);
  }

  // ─── Row handling ─────────────────────────────────────────────────
  selectedItem = computed(() =>
    this.templateItems().find(t => t.value === this.selectedTemplateId()) ?? null,
  );
  selectedBranchItem = computed(() =>
    this.branchItems().find(b => b.value === this.selectedBranchId()) ?? null,
  );

  display = (item: any) => item?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  toValue = (item: any) => item?.value ?? item;

  /** Open the shared product picker. Excludes already-listed ids so
   *  the user doesn't add the same product twice — qty stepper is
   *  the right way to print N copies of one product. */
  pickProducts(): void {
    const ref = this.modal.open<
      PickProductModalComponent,
      PickProductModalData,
      PickProductResult
    >(PickProductModalComponent, {
      size: 'md',
      data: {
        excludedIds: this.rows().map(r => r.id),
        multiple:    true,
        title:       this.translate.instant('PRODUCTS.BULK_PRINT.PICK_PRODUCTS'),
      },
    });
    ref.afterClosed().then(res => {
      if (!res) return;
      const next: BulkRow[] = [...this.rows()];
      for (const p of res.added) {
        next.push({ ...p, printQty: 1 });
      }
      this.rows.set(next);
      if (!this.activeRowId() && next.length) this.activeRowId.set(next[0].id);
    });
  }

  // ─── Barcode scanner input ───────────────────────────────────────
  /** Free-text input above the list. Typing a barcode (or pasting
   *  one) hits Enter or auto-fires after a short debounce — matches
   *  the OLD bulk-print scanner box. Looks the product up by
   *  barcode against the active branch and either bumps the qty on
   *  an existing row or appends a new one. */
  scannerValue = signal<string>('');
  scannerError = signal<string>('');
  private scannerTimer: ReturnType<typeof setTimeout> | null = null;

  onScannerInput(value: string): void {
    this.scannerValue.set(value);
    this.scannerError.set('');
    if (this.scannerTimer) clearTimeout(this.scannerTimer);
    if (!value || value.length < 4) return;
    // Most barcode scanners send a Tab/Enter at the end so we
    // don't have to debounce, but if the user is typing manually
    // the small delay avoids a fetch per keystroke.
    this.scannerTimer = setTimeout(() => this.commitScanner(), 220);
  }

  onScannerEnter(event: Event): void {
    event.preventDefault();
    if (this.scannerTimer) clearTimeout(this.scannerTimer);
    void this.commitScanner();
  }

  private async commitScanner(): Promise<void> {
    const value = this.scannerValue().trim();
    const branchId = this.selectedBranchId();
    if (!value || !branchId) return;
    try {
      const match = await this.products.getProductByBarcode(value, branchId);
      if (!match || !match.id) {
        this.scannerError.set(this.translate.instant(
          'PRODUCTS.BULK_PRINT.BARCODE_NOT_FOUND', { code: value },
        ));
        return;
      }
      // Bump qty if already in the list, otherwise append.
      const existing = this.rows().find(r => r.id === match.id);
      if (existing) {
        this.changeQty(existing.id, 1);
      } else {
        const next: BulkRow = {
          id:        match.id,
          name:      match.name ?? '—',
          barcode:   match.barcode,
          sku:       match.sku,
          UOM:       match.UOM,
          unitCost:  match.unitCost,
          price:     match.price,
          type:      match.type,
          full:      match,
          printQty:  1,
        };
        const list = [...this.rows(), next];
        this.rows.set(list);
        if (!this.activeRowId()) this.activeRowId.set(next.id);
      }
      this.scannerValue.set('');
    } catch {
      this.scannerError.set(this.translate.instant(
        'PRODUCTS.BULK_PRINT.BARCODE_NOT_FOUND', { code: value },
      ));
    }
  }

  // ─── Import barcodes (paste / CSV) ───────────────────────────────
  /** Open the Import Barcodes modal. On apply: batch-resolve every
   *  barcode against the active branch via `getBarcodesProducts`,
   *  bump qty for matches already in the list, append the rest.
   *  Surfaces a small inline result chip: "X added · Y not found"
   *  with the missed codes available on hover for triage. */
  openImportBarcodes(): void {
    if (!this.selectedBranchId() || !this.selectedTemplateId()) return;
    const ref = this.modal.open<
      ImportBarcodesModalComponent,
      void,
      ImportBarcodesResult
    >(ImportBarcodesModalComponent, { size: 'md' });
    ref.afterClosed().then(res => {
      if (!res || !res.barcodes.length) return;
      void this.applyImport(res.barcodes);
    });
  }

  private async applyImport(barcodes: string[]): Promise<void> {
    const branchId = this.selectedBranchId();
    if (!branchId) return;
    this.importing.set(true);
    this.importResult.set(null);
    try {
      const products = await this.products.getBarcodesProducts(barcodes, branchId);
      const found = new Set<string>(products.map(p => String(p?.barcode ?? '')));
      const missedCodes = barcodes.filter(b => !found.has(b));

      // Merge the resolved products into the rows list — bump qty
      // when one is already there, append otherwise.
      const next: BulkRow[] = [...this.rows()];
      let added = 0;
      for (const p of products) {
        const existing = next.find(r => r.id === p.id);
        if (existing) {
          existing.printQty = (existing.printQty || 1) + 1;
        } else {
          next.push({
            id:        p.id,
            name:      p.name ?? '—',
            barcode:   p.barcode,
            sku:       p.sku,
            UOM:       p.UOM,
            unitCost:  p.unitCost,
            price:     p.price,
            type:      p.type,
            full:      p,
            printQty:  1,
          });
          added++;
        }
      }
      this.rows.set(next);
      if (!this.activeRowId() && next.length) this.activeRowId.set(next[0].id);

      this.importResult.set({
        added,
        missed: missedCodes.length,
        missedCodes,
      });
    } catch (err) {
      console.error('[bulk-print] import failed', err);
      this.importResult.set({
        added: 0,
        missed: barcodes.length,
        missedCodes: barcodes,
      });
    } finally {
      this.importing.set(false);
    }
  }

  dismissImportResult(): void {
    this.importResult.set(null);
  }

  removeRow(id: string): void {
    const next = this.rows().filter(r => r.id !== id);
    this.rows.set(next);
    if (this.activeRowId() === id) this.activeRowId.set(next[0]?.id ?? '');
  }

  setActiveRow(id: string): void {
    this.activeRowId.set(id);
  }

  changeQty(id: string, delta: number): void {
    this.rows.set(this.rows().map(r =>
      r.id === id ? { ...r, printQty: Math.max(1, (r.printQty || 1) + delta) } : r,
    ));
  }

  setQty(id: string, value: number): void {
    const qty = Math.max(1, Math.floor(Number(value) || 1));
    this.rows.set(this.rows().map(r => r.id === id ? { ...r, printQty: qty } : r));
  }

  // ─── Preview render ───────────────────────────────────────────────
  private async renderPreview(row: BulkRow, tpl: LabelTemplate): Promise<void> {
    this.rendering.set(true);
    try {
      // Lazy-load the full product when this row hasn't been
      // hydrated yet — the picker only returns light summaries.
      if (!row.full) {
        const full = await this.products.getProduct(row.id);
        if (full) {
          this.rows.set(this.rows().map(r => r.id === row.id ? { ...r, full } : r));
          row = { ...row, full };
        }
      }
      const product = this.resolveProduct(row);
      const canvas = await renderTemplateToCanvas(tpl, { product });
      this.previewUrl.set(canvas?.toDataURL('image/png') ?? '');
    } finally {
      this.rendering.set(false);
    }
  }

  /** Build the data blob for token resolution — pulls `price` from
   *  the active branch's `branchProduct[]` entry (falls back to
   *  `defaultPrice` when null). Mirrors the legacy `setPreferences`
   *  logic from `BulkPrintComponent.addItem`. */
  private resolveProduct(row: BulkRow): any {
    const product = { ...(row.full ?? row) };
    const branchId = this.selectedBranchId();
    if (branchId && Array.isArray(product.branchProduct)) {
      const match = product.branchProduct.find((bp: any) => bp?.branchId === branchId);
      if (match) {
        product.price = match.price != null ? Number(match.price) : Number(product.defaultPrice ?? 0);
      }
    }
    if (product.price == null) product.price = Number(product.defaultPrice ?? 0);
    return product;
  }

  // ─── Render every label ──────────────────────────────────────────
  /** Hydrate every row, then render row × printQty PNG dataUrls.
   *  Shared by `print()` and `openPreviewAll()` so the rendering
   *  pipeline is defined in exactly one place. */
  private async renderAllLabels(tpl: LabelTemplate): Promise<string[]> {
    // Hydrate every row first so token resolution has the full
    // product blob — bulk picks return summaries.
    const rows = await Promise.all(this.rows().map(async r => {
      if (r.full) return r;
      const full = await this.products.getProduct(r.id);
      return full ? { ...r, full } : r;
    }));
    this.rows.set(rows);

    const dataUrls: string[] = [];
    for (const row of rows) {
      const product = this.resolveProduct(row);
      const data: LabelDataMap = { product };
      for (let i = 0; i < (row.printQty || 1); i++) {
        const canvas = await renderTemplateToCanvas(tpl, data);
        if (canvas) dataUrls.push(canvas.toDataURL('image/png'));
      }
    }
    return dataUrls;
  }

  // ─── Preview-All modal ───────────────────────────────────────────
  /** Open a modal showing every label that will print. The user can
   *  scan the grid for binding mistakes / wrong quantities before
   *  committing to print. Print button on the modal hands the
   *  pre-rendered URLs back to the popup-window flow. */
  async openPreviewAll(): Promise<void> {
    const tpl = this.template();
    if (!tpl || this.rows().length === 0 || this.previewing()) return;
    this.previewing.set(true);
    try {
      const dataUrls = await this.renderAllLabels(tpl);
      if (!dataUrls.length) return;
      const ref = this.modal.open<
        PreviewAllModalComponent,
        PreviewAllModalData,
        'print' | undefined
      >(PreviewAllModalComponent, {
        size: 'lg',
        data: { dataUrls, template: tpl },
      });
      const result = await ref.afterClosed();
      if (result === 'print') {
        // Re-use the URLs we already rendered — no need to re-do
        // the work the user just confirmed.
        this.openPrintWindow(dataUrls, tpl.labelWidth, tpl.labelHeight);
      }
    } finally {
      this.previewing.set(false);
    }
  }

  // ─── Print ────────────────────────────────────────────────────────
  /** Render every row × printQty into PNG dataUrls and ship them to
   *  a popup print window with `@page` sized to the label. The
   *  browser handles paper-size routing + `page-break-after`
   *  between labels. Same pattern as the single-product Print
   *  Label modal — just multi-page. */
  async print(): Promise<void> {
    const tpl = this.template();
    if (!tpl || this.rows().length === 0 || this.printing()) return;
    this.printing.set(true);
    try {
      const dataUrls = await this.renderAllLabels(tpl);
      if (!dataUrls.length) return;
      this.openPrintWindow(dataUrls, tpl.labelWidth, tpl.labelHeight);
    } finally {
      this.printing.set(false);
    }
  }

  // ─── Download (sequential PNG saves) ─────────────────────────────
  /** Kick off N single-file PNG downloads, one per label × qty.
   *  No new deps — uses the same browser anchor-click trick the
   *  Print Label modal already uses for single labels. Browsers
   *  throttle rapid downloads, so a 60ms pause between files keeps
   *  the queue reliable up to a few hundred labels. For larger
   *  batches, a confirmation prompt avoids surprising the user with
   *  a hundred "Save as" dialogs. */
  async download(): Promise<void> {
    const tpl = this.template();
    if (!tpl || this.rows().length === 0 || this.downloading()) return;
    this.downloading.set(true);
    this.downloadProgress.set(null);
    try {
      const dataUrls = await this.renderAllLabels(tpl);
      if (!dataUrls.length) return;
      // Soft cap — most browsers grumble around 50+ in quick
      // succession. Confirm before flooding the download queue.
      if (dataUrls.length > 25) {
        const ok = window.confirm(
          this.translate.instant('PRODUCTS.BULK_PRINT.DOWNLOAD_CONFIRM', {
            count: dataUrls.length,
          }),
        );
        if (!ok) return;
      }
      await this.saveDataUrlsSequentially(dataUrls);
    } finally {
      this.downloading.set(false);
      this.downloadProgress.set(null);
    }
  }

  private async saveDataUrlsSequentially(dataUrls: string[]): Promise<void> {
    const total = dataUrls.length;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    for (let i = 0; i < total; i++) {
      this.downloadProgress.set({ done: i, total });
      const a = document.createElement('a');
      a.href = dataUrls[i];
      a.download = `label_${stamp}_${String(i + 1).padStart(3, '0')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Pause between saves so the browser doesn't drop trailing
      // requests in a burst — 60ms is enough on Chrome/Edge to
      // sequence reliably without dragging the UX out.
      await new Promise(r => setTimeout(r, 60));
    }
    this.downloadProgress.set({ done: total, total });
  }

  private openPrintWindow(dataUrls: string[], wIn: number, hIn: number): void {
    const win = window.open('', '', 'width=900,height=700');
    if (!win) return;
    const pages = dataUrls.map(u => `
      <div class="label-page"><img src="${u}" alt=""/></div>
    `).join('');
    win.document.open();
    win.document.write(`
      <html>
        <head>
          <title>Bulk Labels</title>
          <style>
            @page { size: ${wIn}in ${hIn}in; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { margin: 0; padding: 0; }
            .label-page {
              width: ${wIn}in;
              height: ${hIn}in;
              page-break-after: always;
              break-after: page;
              overflow: hidden;
            }
            .label-page:last-child { page-break-after: auto; }
            .label-page img {
              display: block;
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); }, 200)">
          ${pages}
        </body>
      </html>
    `);
    win.document.close();
  }

  trackRow = (_: number, r: BulkRow) => r.id;
}
