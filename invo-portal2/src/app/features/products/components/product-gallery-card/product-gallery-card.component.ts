import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { treePillKey } from '../../utils/product-labels';

/** What the card reads off a product row. Every field is optional: the row only carries the columns the user selected. */
export interface GalleryProductRow {
  id?: string;
  name?: string;
  type?: string;
  image?: string | null;
  SKU?: string | null;
  barcode?: string | null;
  defaultPrice?: number | string | null;
  qty?: number | null;
  reorderLevel?: number | null;
  inventorySummary?: { qtySum?: number | null } | null;
  isParent?: boolean | null;
  departmentName?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
}

/**
 * One Products gallery card: image first, then name, SKU chip, a muted taxonomy line and a price + stock row.
 * Selection, the row menu and "open" belong to the page: this component only renders and emits.
 * The image box is reserved (aspect-ratio) so loading never shifts the layout; a missing or failed image shows a
 * neutral placeholder and is never retried.
 */
@Component({
  selector: 'app-product-gallery-card',
  standalone: true,
  imports: [NgTemplateOutlet, TranslateModule, MycurrencyPipe, TooltipDirective],
  templateUrl: './product-gallery-card.component.html',
  styleUrl: './product-gallery-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'article',
    tabindex: '0',
    '[class.is-selected]': 'selected()',
    '[attr.aria-label]': 'displayName()',
    '(click)': 'open.emit(row())',
    '(keydown.enter)': 'onEnter($event)',
  },
})
export class ProductGalleryCardComponent {
  private translate = inject(TranslateService);

  readonly row = input.required<GalleryProductRow>();
  readonly selected = input(false);
  readonly selectable = input(true);
  /** The page's row kebab (same menu as the list). Rendered inside the overlay; context `$implicit` = the row. */
  readonly menuTemplate = input<TemplateRef<any> | null>(null);

  readonly open = output<GalleryProductRow>();
  readonly selectToggle = output<GalleryProductRow>();

  readonly displayName = computed(() => this.row().name ?? '');

  // ── Image: one state per URL; a failed URL is remembered so it is never retried ──
  private readonly loadedUrl = signal<string | null>(null);
  private readonly failedUrl = signal<string | null>(null);
  readonly imageUrl = computed(() => (this.row().image || '').trim() || null);
  readonly imageState = computed<'none' | 'loading' | 'loaded' | 'error'>(() => {
    const url = this.imageUrl();
    if (!url) return 'none';
    if (this.failedUrl() === url) return 'error';
    return this.loadedUrl() === url ? 'loaded' : 'loading';
  });
  onImageLoad(): void { this.loadedUrl.set(this.imageUrl()); }
  onImageError(): void { this.failedUrl.set(this.imageUrl()); }

  // ── Text ──
  /** SKU first, else the barcode: one chip, its own line. */
  readonly code = computed(() => {
    const r = this.row();
    return r.SKU ? { text: r.SKU, kind: 'sku' } : r.barcode ? { text: r.barcode, kind: 'barcode' } : null;
  });
  /** Department / category / brand as ONE muted line; nothing at all when they are all empty. */
  readonly taxonomy = computed(() => {
    const r = this.row();
    return [r.departmentName, r.categoryName, r.brandName].filter((v): v is string => !!v && !!String(v).trim()).join(' · ');
  });

  // ── Price / stock ──
  readonly hasPrice = computed(() => this.row().defaultPrice !== undefined && this.row().defaultPrice !== null);
  readonly isMatrix = computed(() => this.row().type === 'matrix');
  /** undefined when the qty column was not requested: the pill is then left out instead of showing a false 0. */
  readonly qty = computed<number | undefined>(() => {
    const r = this.row();
    const q = r.qty ?? r.inventorySummary?.qtySum;
    return q === undefined || q === null ? undefined : Number(q);
  });
  readonly showStock = computed(() => this.isMatrix() || this.qty() !== undefined);
  readonly stockTier = computed<'out' | 'low' | 'ok'>(() => {
    const q = this.qty() ?? 0;
    if (q === 0) return 'out';
    return q <= (this.row().reorderLevel ?? 5) ? 'low' : 'ok';
  });

  // ── Children pill (visual only) ──
  readonly isParent = computed(() => this.row().isParent === true || this.isMatrix());
  readonly pillLabel = computed(() => this.translate.instant('PRODUCTS.TREE.' + treePillKey(this.row().type)));

  onEnter(e: Event): void {
    // Enter on the checkbox / kebab belongs to them; only a focused card itself opens the product.
    if (e.target === e.currentTarget) this.open.emit(this.row());
  }
  stop(e: Event): void { e.stopPropagation(); }
  onSelect(e: Event): void { e.stopPropagation(); this.selectToggle.emit(this.row()); }
}
