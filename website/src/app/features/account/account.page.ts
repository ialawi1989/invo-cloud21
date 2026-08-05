import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ResolvedPage } from '../../core/page-types/page-type.types';
import { ShopperAuthService } from '../blog/services/shopper-auth.service';
import { AccountApiService, AccountOrder, AccountProfile } from './account.api';

type AccountTab = 'orders' | 'profile';

/**
 * Account — the `account` page type.
 *
 * The old storefront had four separate pages behind this idea (my-orders,
 * order, my-reservations, reservation), each with its own route and its own
 * near-empty settings entry. They are one type here: a signed-in shopper's own
 * records, shown in tabs.
 *
 * Auth is whatever the storefront already has — {@link ShopperAuthService} — so
 * no second session mechanism is introduced. Signed out, the page says so
 * rather than rendering empty lists that look like "you have no orders".
 */
@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ac">
      <header class="ac__head">
        <h1 class="ac__title">{{ page().name || 'My account' }}</h1>
        @if (shopper(); as who) {
          <span class="ac__who">{{ who.name || who.email }}</span>
        }
      </header>

      @if (!signedIn()) {
        <!-- Signed out is a different thing from "no orders", and conflating
             them is how a customer concludes their order vanished. -->
        <div class="ac__state">
          <p class="ac__state-title">Sign in to see your account</p>
          <p class="ac__muted">Your orders and details appear here once you're signed in.</p>
          <a class="ac__btn" routerLink="/">Back to the store</a>
        </div>
      } @else {
        <nav class="ac__tabs">
          <button type="button" class="ac__tab" [class.ac__tab--on]="tab() === 'orders'"
                  (click)="setTab('orders')">Orders</button>
          <button type="button" class="ac__tab" [class.ac__tab--on]="tab() === 'profile'"
                  (click)="setTab('profile')">Details</button>
        </nav>

        @if (loading()) {
          <div class="ac__state"><span class="ac__spin"></span></div>
        } @else if (tab() === 'orders') {
          @if (!orders().length) {
            <div class="ac__state ac__muted">No orders yet.</div>
          } @else {
            <ul class="ac__orders">
              @for (order of orders(); track order.id) {
                <li class="ac__order">
                  <div class="ac__order-main">
                    <span class="ac__order-ref">#{{ order.reference }}</span>
                    @if (order.status) { <span class="ac__chip">{{ order.status }}</span> }
                  </div>
                  <div class="ac__order-meta">
                    @if (order.createdAt) { <span>{{ order.createdAt | date: 'medium' }}</span> }
                    @if (order.serviceName) { <span>{{ order.serviceName }}</span> }
                  </div>
                  <span class="ac__order-total">{{ order.total | number: '1.3-3' }}</span>
                </li>
              }
            </ul>
          }
        } @else {
          <dl class="ac__profile">
            <div><dt>Name</dt><dd>{{ profile()?.name || '—' }}</dd></div>
            <div><dt>Email</dt><dd>{{ profile()?.email || '—' }}</dd></div>
            <div><dt>Mobile</dt><dd>{{ profile()?.mobile || '—' }}</dd></div>
          </dl>
        }
      }
    </section>
  `,
  styles: [`
    .ac { max-width: 900px; margin: 0 auto; padding: 28px 20px 56px; }
    .ac__head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 18px; }
    .ac__title { margin: 0; font-size: 26px; font-weight: 700; color: #111827; }
    .ac__who { font-size: 13px; color: #6b7280; }

    .ac__tabs { display: flex; gap: 4px; border-bottom: 1px solid #eceff3; margin-bottom: 18px; }
    .ac__tab {
      padding: 9px 14px; background: none; border: 0; border-bottom: 2px solid transparent;
      font-size: 14px; color: #6b7280; cursor: pointer;
    }
    .ac__tab--on { border-bottom-color: #6d3bf5; color: #111827; font-weight: 600; }

    .ac__orders { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .ac__order {
      display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; align-items: center;
      border: 1px solid #eceff3; border-radius: 12px; padding: 14px 16px; background: #fff;
    }
    .ac__order-main { display: flex; align-items: center; gap: 8px; }
    .ac__order-ref { font-weight: 600; color: #111827; }
    .ac__order-meta { grid-column: 1; display: flex; gap: 12px; font-size: 12.5px; color: #9ca3af; }
    .ac__order-total { grid-row: 1 / span 2; font-weight: 700; color: #111827; }
    .ac__chip {
      border-radius: 999px; background: #f3f4f6; color: #4b5563;
      font-size: 11px; font-weight: 600; padding: 2px 9px;
    }

    .ac__profile { margin: 0; display: grid; gap: 10px; }
    .ac__profile div { display: flex; gap: 12px; font-size: 14px; }
    .ac__profile dt { margin: 0; min-width: 90px; color: #6b7280; }
    .ac__profile dd { margin: 0; font-weight: 500; color: #111827; }

    .ac__state { padding: 56px 0; text-align: center; }
    .ac__state-title { margin: 0 0 6px; font-size: 17px; font-weight: 600; color: #374151; }
    .ac__muted { color: #6b7280; font-size: 14px; }
    .ac__btn {
      display: inline-block; margin-top: 16px; padding: 10px 20px; border-radius: 999px;
      background: #6d3bf5; color: #fff; font-size: 14px; font-weight: 600; text-decoration: none;
    }
    .ac__spin {
      display: inline-block; width: 26px; height: 26px; border-radius: 50%;
      border: 3px solid #e5e7eb; border-top-color: #6d3bf5; animation: acspin .8s linear infinite;
    }
    @keyframes acspin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ac__spin { animation: none; } }
  `],
})
export class AccountPage {
  private api  = inject(AccountApiService);
  private auth = inject(ShopperAuthService);

  page = input.required<ResolvedPage>();

  tab      = signal<AccountTab>('orders');
  loading  = signal<boolean>(false);
  orders   = signal<AccountOrder[]>([]);
  profile  = signal<AccountProfile | null>(null);

  shopper  = computed(() => this.auth.current());
  signedIn = computed<boolean>(() => !!this.auth.current() || !!this.auth.sessionId());

  private loaded = false;

  constructor() {
    queueMicrotask(() => void this.load());
  }

  setTab(tab: AccountTab): void {
    this.tab.set(tab);
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.signedIn() || this.loaded) return;
    this.loaded = true;

    this.loading.set(true);
    try {
      const [orders, profile] = await Promise.all([this.api.orders(), this.api.profile()]);
      this.orders.set(orders.list);
      // Fall back to the cached shopper so the tab isn't blank when the
      // profile call fails — the session already told us who this is.
      this.profile.set(profile ?? {
        name:   this.shopper()?.name ?? '',
        email:  this.shopper()?.email ?? '',
        mobile: '',
      });
    } finally {
      this.loading.set(false);
    }
  }
}
