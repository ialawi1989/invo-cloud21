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
import { SiteConfigService } from '../../core/site-config/site-config.service';
import { CartApiService, CartLine } from './cart.api';

/**
 * Cart — the `cart` page type.
 *
 * Reviewing and adjusting what's in the cart; placing the order is checkout's
 * job and is not attempted here.
 *
 * Every quantity change round-trips to the server and the whole cart is
 * replaced from the response. Adjusting totals locally is how a cart ends up
 * showing a number the backend won't charge — promotions, tax and delivery are
 * all recalculated server-side.
 */
@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ct">
      <header class="ct__head">
        <h1 class="ct__title">{{ page().name || 'Your cart' }}</h1>
        @if (lines().length) {
          <button type="button" class="ct__link" [disabled]="busy()" (click)="clear()">Empty cart</button>
        }
      </header>

      @if (loading()) {
        <div class="ct__state"><span class="ct__spin"></span></div>
      } @else if (!lines().length) {
        <div class="ct__state">
          <p class="ct__state-title">Your cart is empty</p>
          <a class="ct__btn" [routerLink]="shopLink()">Start shopping</a>
        </div>
      } @else {
        <ul class="ct__lines">
          @for (line of lines(); track line.id) {
            <li class="ct__line">
              <div class="ct__thumb" [style.background-image]="thumb(line)"></div>

              <div class="ct__info">
                <span class="ct__name">{{ line.name }}</span>
                @if (line.note) { <span class="ct__note">{{ line.note }}</span> }
                <span class="ct__unit">{{ line.unitPrice | number: '1.3-3' }} each</span>
              </div>

              <div class="ct__qty">
                <button type="button" [disabled]="busy()" (click)="step(line, -1)" aria-label="Decrease">−</button>
                <span>{{ line.qty }}</span>
                <button type="button" [disabled]="busy()" (click)="step(line, 1)" aria-label="Increase">+</button>
              </div>

              <span class="ct__total">{{ line.total | number: '1.3-3' }}</span>

              <button type="button" class="ct__remove" [disabled]="busy()"
                      (click)="remove(line)" aria-label="Remove">×</button>
            </li>
          }
        </ul>

        <div class="ct__summary">
          @if (cart().subTotal) { <div><span>Subtotal</span><span>{{ cart().subTotal | number: '1.3-3' }}</span></div> }
          @if (cart().discount) { <div><span>Discount</span><span>−{{ cart().discount | number: '1.3-3' }}</span></div> }
          @if (cart().delivery) { <div><span>Delivery</span><span>{{ cart().delivery | number: '1.3-3' }}</span></div> }
          @if (cart().tax)      { <div><span>Tax</span><span>{{ cart().tax | number: '1.3-3' }}</span></div> }
          <div class="ct__grand"><span>Total</span><span>{{ cart().total | number: '1.3-3' }}</span></div>
        </div>

        <div class="ct__actions">
          <a class="ct__link" [routerLink]="shopLink()">Continue shopping</a>
          <!-- Checkout is not ported yet. Linking to a page that can't complete
               an order would lose the sale silently; saying so does not. -->
          <button type="button" class="ct__btn" disabled title="Checkout is being moved over">
            Checkout unavailable
          </button>
        </div>
      }
    </section>
  `,
  styles: [`
    .ct { max-width: 860px; margin: 0 auto; padding: 28px 20px 56px; }
    .ct__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
    .ct__title { margin: 0; font-size: 26px; font-weight: 700; color: #111827; }

    .ct__lines { list-style: none; margin: 0 0 20px; padding: 0; display: grid; gap: 10px; }
    .ct__line {
      display: grid; grid-template-columns: 64px 1fr auto auto auto; gap: 14px; align-items: center;
      border: 1px solid #eceff3; border-radius: 12px; padding: 12px 14px; background: #fff;
    }
    .ct__thumb { width: 64px; height: 64px; border-radius: 10px; background: #f3f4f6 center/cover no-repeat; }
    .ct__info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .ct__name { font-weight: 600; color: #111827; }
    .ct__note { font-size: 12px; color: #9ca3af; }
    .ct__unit { font-size: 12.5px; color: #6b7280; }

    .ct__qty { display: inline-flex; align-items: center; gap: 10px; }
    .ct__qty button {
      width: 28px; height: 28px; border-radius: 8px; border: 1px solid #e1e5eb;
      background: #fff; font-size: 16px; line-height: 1; cursor: pointer; color: #374151;
    }
    .ct__qty button:disabled { opacity: .5; cursor: default; }

    .ct__total { font-weight: 700; color: #111827; }
    .ct__remove {
      width: 28px; height: 28px; border: 0; background: none; color: #9ca3af;
      font-size: 20px; line-height: 1; cursor: pointer;
    }
    .ct__remove:hover { color: #dc2626; }

    .ct__summary { display: grid; gap: 6px; margin-left: auto; max-width: 280px; font-size: 14px; }
    .ct__summary div { display: flex; justify-content: space-between; gap: 24px; color: #4b5563; }
    .ct__grand { border-top: 1px solid #eceff3; padding-top: 8px; font-weight: 700; color: #111827; }

    .ct__actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 22px; }
    .ct__btn {
      padding: 11px 22px; border: 0; border-radius: 999px; background: #6d3bf5;
      color: #fff; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer;
    }
    .ct__btn:disabled { opacity: .5; cursor: not-allowed; }
    .ct__link { background: none; border: 0; padding: 0; color: #6d3bf5; font-size: 14px; cursor: pointer; text-decoration: none; }

    .ct__state { padding: 56px 0; text-align: center; }
    .ct__state-title { margin: 0 0 6px; font-size: 17px; font-weight: 600; color: #374151; }
    .ct__spin {
      display: inline-block; width: 26px; height: 26px; border-radius: 50%;
      border: 3px solid #e5e7eb; border-top-color: #6d3bf5; animation: ctspin .8s linear infinite;
    }
    @keyframes ctspin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ct__spin { animation: none; } }
  `],
})
export class CartPage {
  private api        = inject(CartApiService);
  private siteConfig = inject(SiteConfigService);
  private router     = inject(Router);

  page = input.required<ResolvedPage>();

  loading = signal<boolean>(true);
  busy    = signal<boolean>(false);

  cart  = this.api.state;
  lines = computed<CartLine[]>(() => this.cart().lines);

  constructor() {
    queueMicrotask(() => void this.load());
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      await this.api.load();
    } finally {
      this.loading.set(false);
    }
  }

  /** Stepping to zero is a removal — leaving a 0-quantity line in the cart is a
   *  state the backend shouldn't have to reason about. */
  async step(line: CartLine, delta: number): Promise<void> {
    const next = line.qty + delta;
    if (next < 1) { await this.remove(line); return; }
    await this.run(() => this.api.changeQty(line.id, next));
  }

  async remove(line: CartLine): Promise<void> {
    await this.run(() => this.api.remove(line.id));
  }

  async clear(): Promise<void> {
    await this.run(() => this.api.clear());
  }

  private async run(op: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await op();
    } finally {
      this.busy.set(false);
    }
  }

  /** Back to the store's primary listing, never a hardcoded /shop. */
  shopLink = computed<any[]>(() => {
    const slug = String(this.siteConfig.value('commerce', 'primaryListingSlug', '') || 'shop');
    const first = this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
    const isLang = !!first && first.length <= 5;
    return isLang ? ['/', first, slug] : ['/', slug];
  });

  thumb(line: CartLine): string {
    return line.imageUrl ? `url("${line.imageUrl}")` : 'none';
  }
}
