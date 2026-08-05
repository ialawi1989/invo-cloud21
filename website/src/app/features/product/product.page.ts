import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml, Title, Meta } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProductApiService, StorefrontProduct } from './product-api.service';
import { CartApiService } from '../cart/cart.api';

/**
 * Product detail — temporary storefront page.
 * ───────────────────────────────────────────
 * Ported down from oldEco's `pages/product` to the smallest thing that
 * renders a real product: gallery, name, price, description, and the
 * identifiers a shopper checks. Cart, variants, options, kit contents,
 * alternative products and the reviews block are deliberately NOT here —
 * they carry the whole cart/session stack with them and this page exists so
 * the SEO preview link resolves to something real.
 *
 * Routed as `/menu/product/:key` (parameter mode) and
 * `/:lang/menu/product/:key` (subdirectory mode), SSR'd so the Express
 * meta-tag injection in `server.ts` has a document to inject into.
 *
 * `:key` is a product id today. It also accepts a slug so the URL shape the
 * dashboard advertises works the moment the backend resolves slugs; until
 * then a slug lands on the not-found state.
 */
@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="pp pp--center">
        <div class="pp__spinner" aria-hidden="true"></div>
        <p class="pp__muted">Loading…</p>
      </div>
    } @else if (!product()) {
      <div class="pp pp--center">
        <h1 class="pp__notfound">Product not found</h1>
        <p class="pp__muted">This product may have been removed, or the link is out of date.</p>
        <a class="pp__btn" routerLink="/">Back to the store</a>
      </div>
    } @else {
      <!-- Breadcrumb driven by the from= query param: the listing the visitor
           actually came from. Falls back to the store home when a product URL
           is opened cold (shared link, search result), so Back is never a dead
           end. -->
      <nav class="pp__crumbs" aria-label="Breadcrumb">
        <a [routerLink]="backLink()">{{ backLabel() }}</a>
        <span aria-hidden="true">/</span>
        <span class="pp__crumb-current">{{ name() }}</span>
      </nav>

      <article class="pp pp__grid">
        <div class="pp__media">
          @if (image()) {
            <img [src]="image()" [alt]="name()" class="pp__img"/>
          } @else {
            <div class="pp__img pp__img--empty" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>
              </svg>
            </div>
          }
        </div>

        <div class="pp__body">
          @if (product()?.brandName) {
            <p class="pp__brand">{{ product()?.brandName }}</p>
          }
          <h1 class="pp__title">{{ name() }}</h1>

          <p class="pp__price">
            <span class="pp__price-now">{{ product()?.defaultPrice | number: '1.3-3' }}</span>
            @if (hasCompare()) {
              <span class="pp__price-was">{{ product()?.comparePriceAt | number: '1.3-3' }}</span>
            }
          </p>

          @if (product()?.warning) {
            <p class="pp__warn">{{ product()?.warning }}</p>
          }

          @if (canAdd()) {
            <div class="pp__buy">
              <div class="pp__qty">
                <button type="button" (click)="stepQty(-1)" [disabled]="qty() <= 1 || adding()"
                        aria-label="Decrease quantity">−</button>
                <span>{{ qty() }}</span>
                <button type="button" (click)="stepQty(1)" [disabled]="adding()"
                        aria-label="Increase quantity">+</button>
              </div>
              <button type="button" class="pp__btn pp__btn--buy" [disabled]="adding()" (click)="addToCart()">
                {{ adding() ? 'Adding…' : 'Add to cart' }}
              </button>
            </div>
          } @else if (outOfStock()) {
            <p class="pp__warn">Out of stock.</p>
          } @else {
            <!-- Options, variants, package contents and measurements aren't
                 ported yet. Saying so beats an Add button that would send an
                 incomplete order line. -->
            <p class="pp__warn">
              This product needs options chosen before it can be ordered, which isn't
              available here yet.
            </p>
          }

          @if (addError(); as err) {
            <p class="pp__warn" role="alert">{{ err }}</p>
          } @else if (added()) {
            <p class="pp__added" role="status">
              Added to your cart. <a [routerLink]="cartLink()">View cart</a>
            </p>
          }

          @if (descriptionHtml()) {
            <div class="pp__desc" [innerHTML]="descriptionHtml()"></div>
          }

          <dl class="pp__facts">
            @if (product()?.sku) {
              <div><dt>SKU</dt><dd>{{ product()?.sku }}</dd></div>
            }
            @if (product()?.barcode) {
              <div><dt>Barcode</dt><dd>{{ product()?.barcode }}</dd></div>
            }
            @if (product()?.UOM) {
              <div><dt>Unit</dt><dd>{{ product()?.UOM }}</dd></div>
            }
          </dl>

          @if (attributes().length) {
            <ul class="pp__attrs">
              @for (a of attributes(); track a.name) {
                <li><span>{{ a.name }}</span><strong>{{ a.value }}</strong></li>
              }
            </ul>
          }
        </div>
      </article>
    }
  `,
  styles: [`
    .pp__crumbs {
      max-width: 1040px; margin: 0 auto; padding: 18px 20px 0;
      display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6b7280;
    }
    .pp__crumbs a { color: #6d3bf5; text-decoration: none; }
    .pp__crumbs a:hover { text-decoration: underline; }
    .pp__crumb-current { color: #374151; font-weight: 500; }

    .pp { max-width: 1040px; margin: 0 auto; padding: 32px 20px 56px; color: #1f2937; }
    .pp--center { text-align: center; padding-top: 96px; }
    .pp__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; }
    @media (max-width: 820px) { .pp__grid { grid-template-columns: 1fr; gap: 24px; } }

    .pp__img {
      width: 100%; aspect-ratio: 1 / 1; object-fit: cover;
      border-radius: 14px; background: #f3f4f6; border: 1px solid #eceff3;
    }
    .pp__img--empty {
      display: flex; align-items: center; justify-content: center; color: #c3c9d4;
    }

    .pp__brand {
      margin: 0 0 6px; font-size: 13px; letter-spacing: .06em;
      text-transform: uppercase; color: #6b7280;
    }
    .pp__title { margin: 0 0 14px; font-size: 30px; line-height: 1.2; font-weight: 700; }

    .pp__price { display: flex; align-items: baseline; gap: 10px; margin: 0 0 18px; }
    .pp__price-now { font-size: 24px; font-weight: 700; }
    .pp__price-was { font-size: 15px; color: #9ca3af; text-decoration: line-through; }

    .pp__warn {
      margin: 0 0 16px; padding: 9px 12px; border-radius: 8px;
      background: #fef3c7; color: #92400e; font-size: 13px;
    }

    .pp__desc { font-size: 15px; line-height: 1.7; color: #374151; }
    .pp__desc :is(img, video) { max-width: 100%; height: auto; }

    .pp__facts { margin: 22px 0 0; padding: 0; display: grid; gap: 8px; }
    .pp__facts div { display: flex; gap: 10px; font-size: 13px; }
    .pp__facts dt { margin: 0; color: #6b7280; min-width: 88px; }
    .pp__facts dd { margin: 0; font-weight: 600; }

    .pp__attrs { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 6px; }
    .pp__attrs li { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; border-bottom: 1px solid #f1f3f6; padding: 6px 0; }
    .pp__attrs span { color: #6b7280; }

    .pp__notfound { margin: 0 0 8px; font-size: 26px; font-weight: 700; }
    .pp__muted { color: #6b7280; font-size: 14px; }
    .pp__btn {
      display: inline-block; margin-top: 18px; padding: 10px 20px;
      border-radius: 999px; background: #6d3bf5; color: #fff;
      font-size: 14px; font-weight: 600; text-decoration: none;
    }

    .pp__spinner {
      width: 26px; height: 26px; margin: 0 auto 12px; border-radius: 50%;
      border: 3px solid #e5e7eb; border-top-color: #6d3bf5;
      animation: ppspin .8s linear infinite;
    }
    .pp__buy { display: flex; align-items: center; gap: 12px; margin: 0 0 14px; flex-wrap: wrap; }
    .pp__qty { display: inline-flex; align-items: center; gap: 12px; border: 1px solid #e1e5eb; border-radius: 999px; padding: 5px 12px; }
    .pp__qty button {
      width: 26px; height: 26px; border: 0; background: none; color: #374151;
      font-size: 17px; line-height: 1; cursor: pointer;
    }
    .pp__qty button:disabled { opacity: .4; cursor: default; }
    .pp__btn--buy { border: 0; cursor: pointer; font-weight: 600; }
    .pp__btn--buy:disabled { opacity: .6; cursor: default; }
    .pp__added { font-size: 14px; color: #15803d; margin: 0 0 14px; }
    .pp__added a { color: inherit; font-weight: 600; }

    @keyframes ppspin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .pp__spinner { animation: none; } }
  `],
})
export class ProductPage implements OnInit {
  private route      = inject(ActivatedRoute);
  private api        = inject(ProductApiService);
  private sanitizer  = inject(DomSanitizer);
  private title      = inject(Title);
  private meta       = inject(Meta);
  private destroyRef = inject(DestroyRef);
  private cart       = inject(CartApiService);

  loading = signal<boolean>(true);
  product = signal<StorefrontProduct | null>(null);

  /** Active language from the route (`/:lang/…`), for translated fields. */
  private lang = signal<string>('');

  name = computed<string>(() => {
    const p = this.product();
    if (!p) return '';
    return this.translated('name') || p.name || '';
  });

  descriptionHtml = computed<SafeHtml | null>(() => {
    const p = this.product();
    if (!p) return null;
    const html = this.translated('body') || this.translated('description') || p.description || '';
    // Server-authored product copy — same trust level as the blog body.
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : null;
  });

  image = computed<string>(() => {
    const p = this.product();
    if (!p) return '';
    if (p.mediaUrl) return p.mediaUrl;
    const first = (p.medias ?? [])[0];
    if (!first) return '';
    return typeof first === 'string' ? first : (first.url ?? first.defaultUrl ?? '');
  });

  hasCompare = computed<boolean>(() => {
    const p = this.product();
    const compare = Number(p?.comparePriceAt ?? 0);
    return compare > Number(p?.defaultPrice ?? 0);
  });

  attributes = computed<{ name: string; value: string }[]>(() =>
    (this.product()?.productAttributes ?? [])
      .map(a => ({ name: String(a?.name ?? ''), value: String(a?.value ?? '') }))
      .filter(a => a.name && a.value),
  );

  /** Listing slug the visitor came from (`?from=`), if any. */
  private from = signal<string>('');

  /** Where Back goes: the originating listing, else the store home. */
  backLink = computed<any[]>(() => {
    const lang = this.lang();
    const from = this.from();
    if (from) return lang ? ['/', lang, from] : ['/', from];
    return lang ? ['/', lang] : ['/'];
  });

  // ── Add to cart ────────────────────────────────────────────────────────
  /**
   * Does this product need the shopper to choose something first?
   *
   * Same rule as the old storefront's `productRequiresUserInput`. Such a
   * product can never be added with a bare `{productId, qty}` — a package with
   * no chosen items or a variant product with no variant is a broken order
   * line, not a sale. There is no option picker in this storefront yet, so the
   * button is disabled and says why instead of quietly sending a bad line.
   */
  requiresChoices = computed<boolean>(() => {
    const p = this.product();
    if (!p) return false;
    if ((p.optionGroups ?? []).some(g => Number(g?.minSelectable ?? 0) > 0)) return true;
    if ((p.selection ?? []).length || (p.fixedSelection ?? []).length) return true;
    if ((p.package ?? []).length || (p.fixedPackage ?? []).length) return true;
    if ((p.dimensions ?? []).length) return true;
    if (p.type === 'tailoring' && p.measurements) return true;
    return false;
  });

  /** `quantity === null` means the product isn't stock-tracked, which is not
   *  the same as "none left". */
  outOfStock = computed<boolean>(() => {
    const q = this.product()?.quantity;
    return q !== null && q !== undefined && Number(q) <= 0;
  });

  canAdd = computed<boolean>(() => !this.requiresChoices() && !this.outOfStock());

  qty      = signal<number>(1);
  adding   = signal<boolean>(false);
  added    = signal<boolean>(false);
  addError = signal<string>('');

  /** The cart page, language-prefixed the same way backLink is. */
  cartLink = computed<any[]>(() => {
    const lang = this.lang();
    return lang ? ['/', lang, 'cart'] : ['/', 'cart'];
  });

  stepQty(delta: number): void {
    this.qty.update(q => Math.max(1, q + delta));
  }

  async addToCart(): Promise<void> {
    const p = this.product();
    if (!p?.id || this.adding()) return;

    this.adding.set(true);
    this.addError.set('');
    this.added.set(false);
    try {
      const res = await this.cart.addItem(p.id, this.qty());
      if (res.ok) this.added.set(true);
      // The server's reason — out of stock, max per ticket, required options —
      // is the only useful thing to show, so it is shown verbatim.
      else this.addError.set(res.msg || 'Could not add to cart');
    } finally {
      this.adding.set(false);
    }
  }

  backLabel = computed<string>(() => {
    const from = this.from();
    if (!from) return 'Store';
    // `menu` → Menu, `table-reservation` → Table reservation.
    const words = from.replace(/-+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  });

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(q => this.from.set(q.get('from') ?? ''));

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.lang.set(params.get('lang') ?? '');
        void this.load(params.get('key') ?? '');
      });
  }

  private async load(key: string): Promise<void> {
    this.loading.set(true);
    try {
      this.product.set(await this.api.getProduct(key));
    } catch {
      this.product.set(null);
    } finally {
      this.loading.set(false);
      this.applyMeta();
    }
  }

  /**
   * Client-side title/description. On a crawler's first hit these are already
   * in the document — `server.ts` injects the full OG/Twitter set before the
   * HTML leaves the server — so this only keeps things right after in-app
   * navigation.
   */
  private applyMeta(): void {
    const p = this.product();
    if (!p) return;
    this.title.setTitle(this.name());
    const desc = stripHtml(p.description ?? '').slice(0, 300);
    if (desc) this.meta.updateTag({ name: 'description', content: desc });
  }

  /** `translation: { name: { en, ar }, body: { … } }` — falls back to the
   *  plain field when there's no entry for the active language. */
  private translated(field: string): string {
    const map = this.product()?.translation?.[field];
    const lang = this.lang();
    if (!map || !lang) return '';
    return String(map[lang] ?? '');
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
