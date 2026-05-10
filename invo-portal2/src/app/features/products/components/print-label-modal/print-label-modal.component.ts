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
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { BranchConnectionService } from '@core/layout/services/branch.service';

import { LabelBuilderService } from '../../../label-builder/services/label-builder.service';
import {
  LabelTemplate,
  LabelTemplateSummary,
} from '../../../label-builder/services/label-template.types';
import { renderTemplateToCanvas } from '../../../label-builder/services/png-export';
import { LabelDataMap } from '../../../label-builder/services/token-resolver';

export interface PrintLabelModalData {
  /** The product to print a label for. The whole row is passed
   *  through so token resolution can read every field the user might
   *  have bound (`!product.name`, `!product.barcode`, etc.). */
  product: any;
}

/**
 * Print Label modal.
 * ──────────────────
 * Mirrors the legacy InvoCloudFront2 `GenerateBarcodeComponent`:
 *  1. lists every saved label template (lazy-loaded inline via the
 *     paginated list endpoint),
 *  2. renders a live PNG preview of the selected template against
 *     the product's real data via the shared `renderTemplateToCanvas`
 *     + `resolveTokens` pipeline,
 *  3. prints via a popup window (CSS `@page` keeps printer margins
 *     correct for the label's exact inch dimensions),
 *  4. downloads the same PNG to the user's machine.
 *
 * The data map mirrors `LabelDataMap`: only `product` is set since
 * the products list doesn't carry an invoice context.
 */
@Component({
  selector: 'app-print-label-modal',
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
  templateUrl: './print-label-modal.component.html',
  styleUrl: './print-label-modal.component.scss',
})
export class PrintLabelModalComponent {
  data = inject<PrintLabelModalData>(MODAL_DATA);
  ref  = inject<ModalRef<void>>(MODAL_REF);

  private builder  = inject(LabelBuilderService);
  private branches = inject(BranchConnectionService);

  loading        = signal<boolean>(true);
  rendering      = signal<boolean>(false);
  templates      = signal<LabelTemplateSummary[]>([]);
  selectedId     = signal<string>('');
  preview        = signal<string>('');

  /** Selected branch — drives the per-branch price lookup. Empty
   *  string means "no branch picked yet" → fall back to default
   *  price. The modal preselects the first branch on the product's
   *  `branchProduct` array so the preview reflects an actual price
   *  instead of always 0. */
  selectedBranchId = signal<string>('');

  /** Items for the branch dropdown — only branches the product is
   *  actually attached to (any in `branchProduct[]`). Falls back to
   *  the full company branch list when the product carries none. */
  branchItems = computed<{ label: string; value: string }[]>(() => {
    const product = this.data.product || {};
    const all = this.branches.branches();
    const productBranchIds = new Set(
      Array.isArray(product.branchProduct)
        ? product.branchProduct.map((bp: any) => bp?.branchId).filter(Boolean)
        : [],
    );
    const filtered = productBranchIds.size > 0
      ? all.filter(b => productBranchIds.has(b.id))
      : all;
    return filtered.map(b => ({ label: b.name || '—', value: b.id }));
  });

  branchDisplay = (item: { label: string; value: string }) => item?.label ?? '';
  branchCompare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  branchToValue = (item: any) => item?.value ?? item;

  selectedBranchItem = computed(() =>
    this.branchItems().find(b => b.value === this.selectedBranchId()) ?? null,
  );

  /** Display-formatted resolved price for the product summary
   *  line — keeps the template free of pipes / Number coercion. */
  resolvedPriceDisplay = computed<string>(() => {
    const v = this.resolvedPrice();
    return Number.isFinite(v) ? v.toFixed(3) : '0.000';
  });

  /** Effective price for the active branch. Mirrors the legacy
   *  generate-barcode logic: pick the matching `branchProduct`
   *  entry, use its `price` if set, otherwise fall back to the
   *  product's `defaultPrice`. Surfaces as `!product.price` /
   *  `!product.defaultPrice` in token resolution. */
  resolvedPrice = computed<number>(() => {
    const product = this.data.product || {};
    const fallback = Number(product.defaultPrice ?? 0) || 0;
    const branchId = this.selectedBranchId();
    if (!branchId) return fallback;
    const list: any[] = Array.isArray(product.branchProduct) ? product.branchProduct : [];
    const match = list.find(bp => bp?.branchId === branchId);
    if (!match) return fallback;
    return match.price != null ? Number(match.price) : fallback;
  });

  /** Resolved data map for token resolution. Wraps the raw product
   *  blob with the branch-derived `price` so `!product.price`
   *  reflects the picked branch instead of always reading the
   *  default. `defaultPrice` stays untouched for templates that
   *  reference it explicitly. */
  private dataMap = computed<LabelDataMap>(() => ({
    product: { ...(this.data.product || {}), price: this.resolvedPrice() },
  }));

  /** Items for the search-dropdown — `{ label, value }` shape. */
  templateItems = computed(() =>
    this.templates().map(t => ({ label: t.name || '—', value: t.id })),
  );

  templateDisplay  = (item: { label: string; value: string }) => item?.label ?? '';
  templateCompare  = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  templateToValue  = (item: any) => item?.value ?? item;

  selectedItem = computed(() =>
    this.templateItems().find(t => t.value === this.selectedId()) ?? null,
  );

  constructor() {
    void this.load();
    void this.loadBranches();
    // Re-render the preview whenever the template OR the branch
    // changes — branch swaps the resolved price so any template
    // that prints `!product.price` updates with the new value.
    effect(() => {
      const id = this.selectedId();
      // Touch the branch signal so the effect re-runs on branch
      // change too — `dataMap()` depends on it transitively.
      this.selectedBranchId();
      if (!id) return;
      void this.renderSelected(id);
    });
  }

  private async loadBranches(): Promise<void> {
    if (!this.branches.loaded()) {
      await this.branches.load();
    }
    // Preselect: prefer the explicit `printBranch` (set by the
    // batch / serial print flows), else the first branch the
    // product is actually attached to, else the first branch in the
    // company list.
    const product   = this.data.product || {};
    const list      = this.branchItems();
    const preferred = String(product.printBranch ?? '');
    const initial   = (preferred && list.some(b => b.value === preferred))
      ? preferred
      : (list[0]?.value ?? '');
    if (initial) this.selectedBranchId.set(initial);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      // Pull every template (no pagination) so the dropdown is
      // browsable in one go. Limit caps the request — typical N is
      // small (~tens), so a single page is fine.
      const { list } = await this.builder.getList({ page: 1, limit: 200 });
      this.templates.set(list);
      if (list.length) this.selectedId.set(list[0].id);
    } finally {
      this.loading.set(false);
    }
  }

  private async renderSelected(id: string): Promise<void> {
    this.rendering.set(true);
    try {
      // Prefer the inline template (already on the summary) so the
      // first paint is instant; fall back to `getById` for legacy
      // backend builds.
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
      if (!tpl) {
        this.preview.set('');
        return;
      }
      const canvas = await renderTemplateToCanvas(tpl, this.dataMap());
      this.preview.set(canvas?.toDataURL('image/png') ?? '');
    } finally {
      this.rendering.set(false);
    }
  }

  /** Open a print window with the rendered PNG sized to the
   *  label's exact dimensions. Same approach as the legacy modal —
   *  CSS `@page` keeps the printer margins zero, the body is the
   *  full label, the image fills it. */
  print(): void {
    const dataUrl = this.preview();
    if (!dataUrl) return;
    const cached = this.templates().find(t => t.id === this.selectedId());
    if (!cached) return;
    const wIn = cached.labelWidth  || 1;
    const hIn = cached.labelHeight || 1;

    const win = window.open('', '', 'width=800,height=600');
    if (!win) return;
    win.document.open();
    win.document.write(`
      <html>
        <head>
          <title>Print Label</title>
          <style>
            @page { size: ${wIn}in ${hIn}in; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: ${wIn}in; height: ${hIn}in;
              display: flex; align-items: center; justify-content: center;
            }
            img { width: 100%; height: 100%; object-fit: contain; }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <img src="${dataUrl}" alt="Label" />
        </body>
      </html>
    `);
    win.document.close();
  }

  download(): void {
    const dataUrl = this.preview();
    if (!dataUrl) return;
    const name = (this.data.product?.name as string) || 'product';
    const a = document.createElement('a');
    a.download = `label-${name}-${Date.now()}.png`;
    a.href = dataUrl;
    a.click();
  }

  cancel(): void { this.ref.dismiss(); }

  /** The dropdown's `valueChange` output emits the full selected
   *  item (the underlying `model()` is set to the item, not its
   *  toValue projection). Extract the bare id so the rest of the
   *  component continues to work with primitives. Accepts either
   *  shape (the dropdown's `clear` emits `null`; some consumers may
   *  pass the bare value via writeValue). */
  onTemplateChange(event: any): void {
    const id = event && typeof event === 'object' ? event.value : event;
    this.selectedId.set(id ?? '');
  }

  onBranchChange(event: any): void {
    const id = event && typeof event === 'object' ? event.value : event;
    this.selectedBranchId.set(id ?? '');
  }
}
