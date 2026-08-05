import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { ResolvedPage } from '../../core/page-types/page-type.types';
import { SiteConfigService } from '../../core/site-config/site-config.service';
import { CurrencyService } from '../../core/currency/currency.service';
import { CartApiService } from '../cart/cart.api';
import {
  CheckoutApiService,
  CheckoutBranch,
  CheckoutService,
  PlacedOrder,
} from './checkout.api';

/**
 * Checkout — the `checkout` page type. Cash / pay-later only.
 *
 * One screen rather than a wizard: branch, service, contact, place. The order
 * is small enough that splitting it into steps would add navigation without
 * adding clarity.
 *
 * Deliberately absent — loyalty points, coupons, scheduled times, DineIn table
 * selection, and all six payment gateways. Each is a flow of its own and none
 * is needed to take a cash order.
 */
@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="co">
      <h1 class="co__title">{{ page().name || 'Checkout' }}</h1>

      @if (placed(); as order) {
        <!-- Confirmation read back from the server, not assumed from a success
             flag — cash checkout returns no order data of its own. -->
        <div class="co__done">
          <p class="co__done-title">Order placed</p>
          <p class="co__done-ref">Reference <strong>{{ order.reference }}</strong></p>
          @if (order.total) { <p class="co__muted">{{ currency.format(order.total) }}</p> }
          @if (order.serviceName) { <p class="co__muted">{{ order.serviceName }}</p> }
          <p class="co__muted">Pay when you collect or receive your order.</p>
          <a class="co__btn" [routerLink]="shopLink()">Continue shopping</a>
        </div>
      } @else if (loading()) {
        <div class="co__state"><span class="co__spin"></span></div>
      } @else if (!lines().length) {
        <div class="co__state">
          <p class="co__done-title">Your cart is empty</p>
          <a class="co__btn" [routerLink]="shopLink()">Start shopping</a>
        </div>
      } @else {
        <div class="co__grid">
          <form class="co__form" (submit)="submit($event)">
            <label class="co__field">
              <span>Branch</span>
              <select [value]="branchId()" (change)="pickBranch($any($event.target).value)">
                <option value="">Choose a branch…</option>
                @for (b of branches(); track b.id) {
                  <option [value]="b.id">{{ b.name }}</option>
                }
              </select>
            </label>

            <label class="co__field">
              <span>How would you like it?</span>
              <select [value]="serviceName()" [disabled]="!branchId()"
                      (change)="serviceName.set($any($event.target).value)">
                <option value="">Choose…</option>
                @for (s of services(); track s.id) {
                  <option [value]="s.name">{{ s.name }}</option>
                }
              </select>
              @if (branchId() && !services().length) {
                <small class="co__hint">This branch isn't taking online orders right now.</small>
              }
            </label>

            <label class="co__field">
              <span>Name</span>
              <input type="text" [value]="name()" (input)="name.set($any($event.target).value)"
                     autocomplete="name" required/>
            </label>

            <label class="co__field">
              <span>Phone</span>
              <input type="tel" [value]="phone()" (input)="phone.set($any($event.target).value)"
                     autocomplete="tel" required/>
              <small class="co__hint">We'll use this to reach you about the order.</small>
            </label>

            <label class="co__field">
              <span>Note <em>(optional)</em></span>
              <textarea rows="2" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
            </label>

            <div class="co__pay">
              <strong>Pay on collection or delivery</strong>
              <span class="co__muted">No card is taken now.</span>
            </div>

            @if (error(); as err) {
              <p class="co__error" role="alert">{{ err }}</p>
            }

            <button type="submit" class="co__btn" [disabled]="!canSubmit() || placing()">
              {{ placing() ? 'Placing your order…' : 'Place order' }}
            </button>
          </form>

          <aside class="co__summary">
            <h2 class="co__summary-title">Your order</h2>
            <ul class="co__lines">
              @for (line of lines(); track line.id) {
                <li>
                  <span class="co__line-name">{{ line.qty }}× {{ line.name }}</span>
                  <span>{{ currency.format(line.total) }}</span>
                </li>
              }
            </ul>
            @if (cart().subTotal) { <div class="co__row"><span>Subtotal</span><span>{{ currency.format(cart().subTotal) }}</span></div> }
            @if (cart().discount) { <div class="co__row"><span>Discount</span><span>−{{ currency.format(cart().discount) }}</span></div> }
            @if (cart().delivery) { <div class="co__row"><span>Delivery</span><span>{{ currency.format(cart().delivery) }}</span></div> }
            @if (cart().tax)      { <div class="co__row"><span>Tax</span><span>{{ currency.format(cart().tax) }}</span></div> }
            <div class="co__row co__row--grand"><span>Total</span><span>{{ currency.format(cart().total) }}</span></div>
            <a class="co__link" [routerLink]="cartLink()">Edit cart</a>
          </aside>
        </div>
      }
    </section>
  `,
  styles: [`
    .co { max-width: 940px; margin: 0 auto; padding: 28px 20px 56px; }
    .co__title { margin: 0 0 20px; font-size: 26px; font-weight: 700; color: #111827; }

    .co__grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 28px; align-items: start; }
    @media (max-width: 820px) { .co__grid { grid-template-columns: 1fr; } }

    .co__form { display: grid; gap: 14px; }
    .co__field { display: grid; gap: 5px; font-size: 14px; color: #374151; }
    .co__field > span { font-weight: 600; color: #111827; }
    .co__field em { font-style: normal; font-weight: 400; color: #9ca3af; }
    .co__field select, .co__field input, .co__field textarea {
      width: 100%; padding: 10px 12px; border: 1px solid #e1e5eb; border-radius: 10px;
      font: inherit; color: #111827; background: #fff;
    }
    .co__field select:disabled { background: #f6f7f9; color: #9ca3af; }
    .co__hint { font-size: 12px; color: #9ca3af; }

    .co__pay {
      display: grid; gap: 2px; padding: 12px 14px; border: 1px solid #eceff3;
      border-radius: 10px; background: #fafbfc; font-size: 14px;
    }

    .co__summary { border: 1px solid #eceff3; border-radius: 12px; padding: 16px 18px; background: #fff; }
    .co__summary-title { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #111827; }
    .co__lines { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 8px; font-size: 14px; }
    .co__lines li { display: flex; justify-content: space-between; gap: 14px; color: #4b5563; }
    .co__line-name { min-width: 0; }
    .co__row { display: flex; justify-content: space-between; gap: 14px; font-size: 14px; color: #4b5563; padding: 2px 0; }
    .co__row--grand { border-top: 1px solid #eceff3; margin-top: 6px; padding-top: 8px; font-weight: 700; color: #111827; }
    .co__link { display: inline-block; margin-top: 12px; color: #6d3bf5; font-size: 14px; text-decoration: none; }

    .co__btn {
      padding: 12px 22px; border: 0; border-radius: 999px; background: #6d3bf5;
      color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none;
      display: inline-block; text-align: center;
    }
    .co__btn:disabled { opacity: .5; cursor: not-allowed; }
    .co__error { margin: 0; color: #b91c1c; font-size: 14px; }

    .co__done { text-align: center; padding: 48px 0; display: grid; gap: 6px; justify-items: center; }
    .co__done-title { margin: 0; font-size: 20px; font-weight: 700; color: #111827; }
    .co__done-ref { margin: 0; font-size: 15px; color: #374151; }
    .co__muted { margin: 0; color: #6b7280; font-size: 14px; }
    .co__done .co__btn { margin-top: 14px; }

    .co__state { padding: 56px 0; text-align: center; }
    .co__spin {
      display: inline-block; width: 26px; height: 26px; border-radius: 50%;
      border: 3px solid #e5e7eb; border-top-color: #6d3bf5; animation: cospin .8s linear infinite;
    }
    @keyframes cospin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .co__spin { animation: none; } }
  `],
})
export class CheckoutPage {
  private api        = inject(CheckoutApiService);
  private cartApi    = inject(CartApiService);
  private siteConfig = inject(SiteConfigService);
  private router     = inject(Router);
  /** Public: the template renders every price through this. */
  currency = inject(CurrencyService);

  page = input.required<ResolvedPage>();

  loading = signal<boolean>(true);
  placing = signal<boolean>(false);
  error   = signal<string>('');
  placed  = signal<PlacedOrder | null>(null);

  branches = signal<CheckoutBranch[]>([]);
  services = signal<CheckoutService[]>([]);

  branchId    = signal<string>('');
  serviceName = signal<string>('');
  name        = signal<string>('');
  phone       = signal<string>('');
  note        = signal<string>('');

  cart  = this.cartApi.state;
  lines = computed(() => this.cart().lines);

  canSubmit = computed<boolean>(() =>
    !!this.branchId() && !!this.serviceName() &&
    this.name().trim().length > 0 && this.phone().trim().length > 0);

  constructor() {
    queueMicrotask(() => void this.init());
  }

  private async init(): Promise<void> {
    this.loading.set(true);
    try {
      const [, branches] = await Promise.all([this.cartApi.load(), this.api.branches()]);
      this.branches.set(branches);
      // One branch is not a choice — pick it and load its services, so the
      // shopper isn't asked a question with a single answer.
      if (branches.length === 1) await this.pickBranch(branches[0].id);
    } finally {
      this.loading.set(false);
    }
  }

  async pickBranch(branchId: string): Promise<void> {
    this.branchId.set(branchId);
    this.serviceName.set('');
    this.services.set([]);
    if (!branchId) return;

    // Already filtered to what this storefront can actually fulfil — see
    // CheckoutApiService.UNSUPPORTED_SERVICES.
    const services = await this.api.services(branchId);
    this.services.set(services);
    if (services.length === 1) this.serviceName.set(services[0].name);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit() || this.placing()) return;

    this.placing.set(true);
    this.error.set('');
    try {
      const res = await this.api.placeOrder({
        branchId:    this.branchId(),
        serviceName: this.serviceName(),
        name:        this.name().trim(),
        phone:       this.phone().trim(),
        note:        this.note().trim(),
      });

      if (!res.ok) {
        this.error.set(res.msg || 'Could not place your order');
        return;
      }
      if (!res.order) {
        // The order went through but couldn't be read back. Saying "failed"
        // would invite a duplicate order, which is the worse mistake.
        this.error.set('Your order was placed, but we could not load the confirmation. Please check your orders before ordering again.');
        return;
      }
      this.placed.set(res.order);
    } finally {
      this.placing.set(false);
    }
  }

  private langPrefix(): string[] {
    const first = this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
    return first && first.length <= 5 ? ['/', first] : ['/'];
  }

  shopLink = computed<any[]>(() => {
    const slug = String(this.siteConfig.value('commerce', 'primaryListingSlug', '') || 'shop');
    return [...this.langPrefix(), slug];
  });

  cartLink = computed<any[]>(() => [...this.langPrefix(), 'cart']);
}
