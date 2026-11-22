import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { NgStyle, TitleCasePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MycurrencyPipe } from '../../../../../core/pipes';
import { ProductsService } from '../../../services/products.service';
import { buildChildrenBody } from '../../../services/product-list-requests';
import { getProductTypeBadgeStyle } from '../../../utils/product-type-badge';
import { productTypeKey, treePillKey } from '../../../utils/product-labels';

/** Same page size the list's tree uses for one expanded node (treeConfig.pageSize). */
const CHILD_PAGE_SIZE = 15;

/**
 * "Units" / "Variants" section of the product details drawer (Overview tab).
 *
 * Loads the children of one product lazily, with the SAME endpoint, request body and paging as the Products list's
 * tree (`productChildsList` via `buildChildrenBody`), and shows them as compact rows: name, SKU chip, type, qty, price.
 * A child's quantity belongs to that child: nothing here is summed into the parent's numbers.
 */
@Component({
  selector: 'app-product-children',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgStyle, TitleCasePipe, TranslateModule, MycurrencyPipe],
  template: `
    <section class="card" [attr.aria-label]="title()">
      <div class="card-head">
        <span>{{ title() }}</span>
        @if (total() !== null) { <span class="count">{{ countLabel() }}</span> }
      </div>

      @if (status() === 'loading') {
        <div class="rows" aria-busy="true">
          @for (i of [1, 2, 3]; track i) {
            <div class="row row--skeleton">
              <span class="skeleton w-60"></span><span class="skeleton w-30"></span><span class="skeleton w-40"></span>
              <span class="skeleton w-30"></span><span class="skeleton w-40"></span>
            </div>
          }
        </div>
      } @else if (status() === 'error') {
        <div class="inline-state inline-state--error" role="alert">
          <span>{{ 'COMMON.LP_TREE_LOAD_ERROR' | translate }}</span>
          <button type="button" class="link-btn" (click)="load(true)">{{ 'COMMON.LP_TREE_RETRY' | translate }}</button>
        </div>
      } @else if (!rows().length) {
        <div class="inline-state">{{ 'COMMON.LP_TREE_NO_CHILDREN' | translate }}</div>
      } @else {
        <div class="rows head-row" aria-hidden="true">
          <div class="row row--head">
            <span>{{ 'PRODUCTS.FIELDS.NAME' | translate }}</span>
            <span>{{ 'PRODUCTS.FIELDS.SKU' | translate }}</span>
            <span>{{ 'PRODUCTS.FIELDS.TYPE' | translate }}</span>
            <span class="num">{{ 'PRODUCTS.FIELDS.QTY' | translate }}</span>
            <span class="num">{{ 'PRODUCTS.FIELDS.PRICE' | translate }}</span>
          </div>
        </div>
        <div class="rows">
          @for (c of rows(); track c.id ?? c._id) {
            <button type="button" class="row row--item" (click)="opened.emit(c)">
              <span class="cell-name">{{ c.name | titlecase }}</span>
              <span>
                @if (c.SKU) { <span class="app-product-badge app-product-badge--sku">{{ c.SKU }}</span> } @else { <span class="muted">—</span> }
              </span>
              <span>
                @if (c.type) {
                  <span class="type-chip" [ngStyle]="typeStyle(c.type)">{{ typeLabel(c.type) }}</span>
                } @else { <span class="muted">—</span> }
              </span>
              <span class="num">{{ c.qty ?? c.inventorySummary?.qtySum ?? 0 }}</span>
              <span class="num">{{ c.defaultPrice | mycurrency }}</span>
            </button>
          }
          @if (hasNext()) {
            @if (moreError()) {
              <div class="inline-state inline-state--error" role="alert">
                <span>{{ 'COMMON.LP_TREE_LOAD_ERROR' | translate }}</span>
                <button type="button" class="link-btn" (click)="loadMore()">{{ 'COMMON.LP_TREE_RETRY' | translate }}</button>
              </div>
            } @else {
              <button type="button" class="more-row" [disabled]="loadingMore()" [attr.aria-busy]="loadingMore()" (click)="loadMore()">
                {{ 'COMMON.LP_TREE_SHOW_MORE_PLAIN' | translate }}
              </button>
            }
          }
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; margin-bottom: 16px; }
    .card { background: var(--ui-surface); border: 1px solid var(--ui-line); border-radius: 10px; overflow: hidden; }
    .card-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 10px 14px; background: var(--ui-surface-1); border-bottom: 1px solid var(--ui-line);
      font-size: 13px; font-weight: 600; color: var(--ui-text);
    }
    .count { font-weight: 500; font-size: 12px; color: var(--ui-muted); }
    .row {
      display: grid; align-items: center; gap: 12px; width: 100%;
      grid-template-columns: minmax(0, 2.4fr) minmax(0, 1.2fr) minmax(0, 1.1fr) minmax(48px, .6fr) minmax(72px, 1fr);
      padding: 9px 14px; font-size: 13px; color: var(--ui-text); text-align: start;
    }
    .row--head { padding-block: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--ui-muted); background: var(--ui-surface-1); border-bottom: 1px solid var(--ui-line); }
    .row--item { border: 0; border-bottom: 1px solid var(--ui-surface-2); background: transparent; cursor: pointer; font: inherit; }
    .row--item:last-of-type { border-bottom: 0; }
    .row--item:hover { background: var(--ui-surface-1); }
    .row--item:focus-visible { outline: 2px solid var(--ui-brand-text); outline-offset: -2px; }
    .cell-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .num { text-align: end; font-variant-numeric: tabular-nums; }
    .muted { color: var(--ui-faint); }
    .type-chip { display: inline-flex; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; white-space: nowrap; }
    .more-row {
      display: block; width: 100%; padding: 10px 14px; border: 0; border-top: 1px solid var(--ui-surface-2);
      background: transparent; color: var(--ui-brand-text); font-size: 13px; font-weight: 600; cursor: pointer; text-align: center;
    }
    .more-row:hover:not(:disabled) { background: var(--ui-surface-1); }
    .more-row:disabled { color: var(--ui-faint); cursor: default; }
    .inline-state { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 14px; font-size: 13px; color: var(--ui-faint); }
    .inline-state--error { color: var(--ui-red-text); }
    .link-btn { border: 0; background: transparent; color: var(--ui-brand-text); font-weight: 600; cursor: pointer; text-decoration: underline; font-size: 13px; }
    .skeleton {
      display: block; height: 12px; border-radius: 6px;
      background: linear-gradient(90deg, var(--ui-line) 0%, var(--ui-surface-2) 50%, var(--ui-line) 100%);
      background-size: 200% 100%; animation: ch-shimmer 1.4s ease-in-out infinite;
    }
    .w-30 { width: 30%; } .w-40 { width: 40%; } .w-60 { width: 60%; }
    @keyframes ch-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
    @media (max-width: 600px) {
      .row { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(48px, .6fr) minmax(64px, 1fr); }
      .row > :nth-child(3) { display: none; }   /* type chip: the name row already says what it is on phones */
    }
  `],
})
export class ProductChildrenComponent implements OnInit {
  private svc = inject(ProductsService);
  private translate = inject(TranslateService);

  /** Parent product id (the `id` sent to productChildsList). */
  parentId = input.required<string>();
  /** Parent type: picks the section wording (matrix -> Variants, otherwise Units). */
  parentType = input<string | null | undefined>(null);
  /** A child row was chosen: the drawer opens it like any product. */
  opened = output<any>();

  rows = signal<any[]>([]);
  status = signal<'loading' | 'ready' | 'error'>('loading');
  total = signal<number | null>(null);
  hasNext = signal(false);
  loadingMore = signal(false);
  moreError = signal(false);
  private page = 1;
  private seq = 0;

  private key = computed(() => treePillKey(this.parentType()));
  title = computed(() => this.translate.instant('PRODUCTS.TREE.' + this.key()));
  countLabel = computed(() => {
    const n = this.total();
    if (n === null) return '';
    return this.translate.instant('PRODUCTS.TREE.' + this.key() + (n === 1 ? '_ONE' : '_N'), { count: n });
  });

  typeStyle(type: string) { return getProductTypeBadgeStyle(type); }
  typeLabel(type: string): string { return this.translate.instant('PRODUCTS.TYPES.' + productTypeKey(type)); }

  ngOnInit(): void { void this.load(true); }

  /** First page (or a retry of it). */
  async load(reset: boolean): Promise<void> {
    const seq = ++this.seq;
    if (reset) { this.page = 1; this.status.set('loading'); this.moreError.set(false); }
    try {
      const res = await this.svc.productChildsList(this.body(1));
      if (seq !== this.seq) return;
      this.rows.set(res.list ?? []);
      this.total.set(res.count === undefined || res.count === null ? null : Number(res.count));
      this.hasNext.set(res.hasNext === true);
      this.status.set('ready');
    } catch {
      if (seq !== this.seq) return;
      this.status.set('error');
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasNext()) return;
    const seq = this.seq;
    this.loadingMore.set(true);
    this.moreError.set(false);
    try {
      const res = await this.svc.productChildsList(this.body(this.page + 1));
      if (seq !== this.seq) return;
      this.page += 1;
      this.rows.update(r => [...r, ...(res.list ?? [])]);
      this.hasNext.set(res.hasNext === true);
    } catch {
      if (seq === this.seq) this.moreError.set(true);
    } finally {
      this.loadingMore.set(false);
    }
  }

  /** Same body the list's tree sends: no search, no sort, no filters. */
  private body(page: number) {
    return buildChildrenBody(this.parentId(), { page, limit: CHILD_PAGE_SIZE });
  }
}
