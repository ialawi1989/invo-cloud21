import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { ResolvedPage } from '../../core/page-types/page-type.types';
import { ListingApiService, ListingGroup } from './listing.api';

/**
 * Product listing — ONE component for what used to be three pages.
 *
 * The old storefront shipped `menu`, `shop` and `collections` as separate
 * routes + components + catalog entries. Diffing their settings showed eight
 * identical keys and exactly one unique key each (`show_pager_button` for menu,
 * `show_filter_by_brand` for shop); they really differed only in data source.
 *
 * So this renders any `product-list` page: the page's `source` decides where
 * products come from, its `settings` decide how they look. A merchant can have
 * `/menu` AND `/shop` — they're two rows, not two builds — which is the whole
 * point: company type now only seeds what exists, it doesn't gate it.
 */
@Component({
  selector: 'app-product-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pl">
      <header class="pl__head">
        <h1 class="pl__title">{{ page().name || page().slug }}</h1>
        @if (!loading() && count()) {
          <span class="pl__count">{{ count() }} products</span>
        }
      </header>

      @if (loading()) {
        <div class="pl__state"><span class="pl__spin"></span></div>
      } @else if (!groups().length) {
        <div class="pl__state pl__muted">Nothing to show here yet.</div>
      } @else {
        @for (group of groups(); track group.id) {
          <section class="pl__group">
            @if (group.title) { <h2 class="pl__group-title">{{ group.title }}</h2> }

            <div [class]="view() === 'list' ? 'pl__items pl__items--list' : 'pl__items'">
              @for (p of group.products; track p.id) {
                <!-- Canonical product URL + provenance in the query, never in
                     the path: one product = one URL, and Back knows where it
                     came from. -->
                <a class="pl__card"
                   [routerLink]="productLink(p.id)"
                   [queryParams]="{ from: page().slug }">
                  <div class="pl__thumb" [style.background-image]="thumb(p)"
                       [style.background-size]="imageSize()"></div>
                  <div class="pl__info">
                    <span class="pl__name" [class.pl__name--clamp]="!longName()">{{ p.name }}</span>
                    <span class="pl__price">{{ p.defaultPrice | number: '1.3-3' }}</span>
                  </div>
                </a>
              }
            </div>
          </section>
        }

        @if (hasNext()) {
          <div class="pl__more">
            <button type="button" class="pl__more-btn" [disabled]="loadingMore()" (click)="loadMore()">
              {{ loadingMore() ? 'Loading…' : 'Load more' }}
            </button>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .pl { max-width: 1180px; margin: 0 auto; padding: 28px 20px 56px; }
    .pl__head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px; }
    .pl__title { margin: 0; font-size: 26px; font-weight: 700; color: #111827; }
    .pl__count { font-size: 13px; color: #6b7280; }

    .pl__group + .pl__group { margin-top: 34px; }
    .pl__group-title { margin: 0 0 14px; font-size: 17px; font-weight: 600; color: #374151; }

    .pl__items { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 18px; }
    .pl__items--list { grid-template-columns: 1fr; }
    .pl__items--list .pl__card { flex-direction: row; align-items: center; gap: 14px; }
    .pl__items--list .pl__thumb { width: 96px; padding-top: 0; height: 96px; flex: none; }

    .pl__card {
      display: flex; flex-direction: column; text-decoration: none; color: inherit;
      border: 1px solid #eceff3; border-radius: 12px; overflow: hidden; background: #fff;
      transition: border-color .15s, transform .15s;
    }
    .pl__card:hover { border-color: #d6dbe3; transform: translateY(-2px); }

    .pl__thumb {
      width: 100%; padding-top: 100%; background: #f3f4f6 center/cover no-repeat;
    }
    .pl__info { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 12px; }
    .pl__name { font-size: 14px; font-weight: 500; }
    .pl__name--clamp { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
    .pl__price { font-size: 14px; font-weight: 700; color: #111827; }

    .pl__more { display: flex; justify-content: center; margin-top: 28px; }
    .pl__more-btn {
      padding: 10px 24px; border-radius: 999px; cursor: pointer;
      border: 1px solid #d6dbe3; background: #fff; color: #374151;
      font-size: 14px; font-weight: 600;
    }
    .pl__more-btn:hover:not(:disabled) { border-color: #6d3bf5; color: #6d3bf5; }
    .pl__more-btn:disabled { opacity: .6; cursor: default; }

    .pl__state { padding: 60px 0; text-align: center; }
    .pl__muted { color: #6b7280; font-size: 14px; }
    .pl__spin {
      display: inline-block; width: 26px; height: 26px; border-radius: 50%;
      border: 3px solid #e5e7eb; border-top-color: #6d3bf5; animation: plspin .8s linear infinite;
    }
    @keyframes plspin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .pl__spin { animation: none; } }
  `],
})
export class ProductListPage {
  private api    = inject(ListingApiService);
  private router = inject(Router);

  /** The resolved page row - type, settings (defaults applied) and source. */
  page = input.required<ResolvedPage>();

  loading     = signal<boolean>(true);
  loadingMore = signal<boolean>(false);
  groups      = signal<ListingGroup[]>([]);
  count       = signal<number>(0);

  /** Paging follows the stack's `hasNext` convention: a page count is
   *  meaningless for a menu (returned whole) and unreliable for search. */
  hasNext = signal<boolean>(false);
  private pageNo = signal<number>(1);

  // Settings come from the registry, so a page saved before a field existed
  // still gets the manifest default instead of `undefined`.
  view      = computed<string>(() => String(this.page().settings['default_view'] ?? 'grid'));
  imageSize = computed<string>(() => String(this.page().settings['product_image_size'] || 'cover'));
  longName  = computed<boolean>(() => !!this.page().settings['long_product_name']);
  private limit = computed<number>(() => Number(this.page().settings['page_limit'] ?? 24) || 24);

  private loadedFor = '';

  constructor() {
    // `page` is a signal input, so the host can swap pages (/menu -> /shop)
    // without remounting this component.
    queueMicrotask(() => void this.sync());
  }

  ngOnChanges(): void { void this.sync(); }

  private source() {
    return this.page()?.source ?? { kind: 'catalog' as const };
  }

  private async sync(): Promise<void> {
    const page = this.page();
    if (!page || this.loadedFor === page.slug) return;
    this.loadedFor = page.slug;

    this.loading.set(true);
    this.pageNo.set(1);
    try {
      const res = await this.api.load(this.source(), { page: 1, limit: this.limit() });
      this.groups.set(res.groups);
      this.count.set(res.count);
      this.hasNext.set(res.hasNext);
    } finally {
      this.loading.set(false);
    }
  }

  /** Append the next page. Groups are merged by id so a paginated source
   *  doesn't repeat its section headings. */
  async loadMore(): Promise<void> {
    if (!this.hasNext() || this.loadingMore()) return;

    const next = this.pageNo() + 1;
    this.loadingMore.set(true);
    try {
      const res = await this.api.load(this.source(), { page: next, limit: this.limit() });
      this.groups.update(existing => mergeGroups(existing, res.groups));
      if (res.count) this.count.set(res.count);
      this.hasNext.set(res.hasNext);
      this.pageNo.set(next);
    } finally {
      this.loadingMore.set(false);
    }
  }

  /** Language-aware canonical product path. */
  productLink(id: string): any[] {
    const first = this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
    const isLang = !!first && first.length <= 5;
    return isLang ? ['/', first, 'product', id] : ['/', 'product', id];
  }

  thumb(p: any): string {
    const url = typeof p?.mediaUrl === 'string'
      ? p.mediaUrl
      : (p?.mediaUrl?.defaultUrl ?? p?.medias?.[0]?.url ?? p?.medias?.[0]?.defaultUrl ?? '');
    return url ? `url("${url}")` : 'none';
  }
}

/** Append incoming products into matching groups, keeping order stable. */
function mergeGroups(existing: ListingGroup[], incoming: ListingGroup[]): ListingGroup[] {
  const out = existing.map(g => ({ ...g, products: [...g.products] }));
  for (const group of incoming) {
    const at = out.findIndex(g => g.id === group.id);
    if (at >= 0) out[at].products.push(...group.products);
    else out.push({ ...group, products: [...group.products] });
  }
  return out;
}
