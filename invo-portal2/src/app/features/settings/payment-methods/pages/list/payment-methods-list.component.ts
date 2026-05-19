import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { withTranslations } from '@core/i18n/with-translations';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import {
  QueryParamsService,
  StringCodec,
  enumCodec,
  ParamDef,
} from '@shared/services/query-params.service';

import {
  PaymentMethodsStore,
  PaymentMethodsTab as Tab,
} from '../../services/payment-methods.store';
import { PaymentMethod } from '../../services/payment-method.types';
import { findProviderByName } from '../../utils/provider-registry';

/**
 * Payment methods list page (`/settings/payment-methods`).
 *
 * Three tabs:
 *   • Currency — manual Cash methods (one per currency).
 *   • Card     — manual Card methods (cash-equivalent, no provider).
 *   • Online   — providers the company can enable (Tap, Thawani, …).
 *
 * Inline:
 *   • Drag-reorder (CDK) — persisted on drop via `rearrangePaymentMethod`.
 *   • Enable toggle  — fires `enablePaymentMethods` immediately.
 *   • Row click      — opens the editor (regular form for Currency / Card).
 *
 * Connect-form for online providers is intentionally NOT wired in this
 * lean MVP — the row shows "Enable" only; the per-provider credential
 * form lands in a follow-up.
 */
@Component({
  selector: 'app-payment-methods-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    LoadingOverlayComponent,
    SkeletonComponent,
    SegmentedToggleComponent,
    ListShellComponent,
    MycurrencyPipe,
    DragDropModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-methods-list.component.html',
  styleUrl:    './payment-methods-list.component.scss',
})
export class PaymentMethodsListComponent implements OnInit {
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private store      = inject(PaymentMethodsStore);
  private qp         = inject(QueryParamsService);

  /** URL <-> state codecs. `tab=currency` is the default and is
   *  elided from the URL; other tabs are written explicitly so the
   *  link can be shared or bookmarked. */
  private readonly PARAMS = {
    tab:    { key: 'tab', codec: enumCodec(['currency', 'card', 'online'] as const, 'currency') } as ParamDef<Tab>,
    search: { key: 'q',   codec: StringCodec } as ParamDef<string>,
  };

  // ─── Store-backed state (read-through signals) ──────────────────
  // Owning the rows + tab + search at the store level means
  // navigating to a form page and back doesn't lose the user's
  // place; the list re-renders from cache while the store refreshes
  // in the background.
  loading = this.store.loading;
  rows    = this.store.rows;
  tab     = this.store.tab;
  search  = this.store.search;
  connectedOnline    = this.store.connectedOnline;
  notConnectedOnline = this.store.notConnectedOnline;

  private i18nTick = signal(0);

  readonly tabOptions: SegmentedToggleOption<Tab>[] = [
    { value: 'currency', label: 'PAYMENT_METHODS.LIST.TAB_CURRENCY' },
    { value: 'card',     label: 'PAYMENT_METHODS.LIST.TAB_CARD' },
    { value: 'online',   label: 'PAYMENT_METHODS.LIST.TAB_ONLINE' },
  ];

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('PAYMENT_METHODS.LIST.TITLE') },
    ];
  });

  /** Resolve the i18n key for a row's one-line description (used
   *  by the Connect-tab card layout). Falls back to empty string
   *  so the template can `@if (desc)` cleanly. */
  providerDesc = (row: PaymentMethod): string =>
    findProviderByName(row.name)?.descriptionKey ?? '';

  constructor() {
    withTranslations('settings/payment-methods');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    // Seed the store from the URL so refresh / direct links / back
    // button all restore the page state. Defaults match the store's
    // own defaults so an empty URL behaves the same as before.
    const initial = this.qp.read(this.PARAMS);
    this.store.setTab(initial.tab);
    this.store.setSearch(initial.search);
    await this.store.load();
  }

  /** Push current `tab` + `search` into the URL so refresh / back
   *  / shared links restore state. */
  private syncUrl(): void {
    this.qp.write(this.PARAMS, {
      tab:    this.tab(),
      search: this.search(),
    });
  }

  setTab(t: Tab): void {
    if (this.tab() === t) return;
    this.store.setTab(t);
    this.syncUrl();
    void this.store.load();
  }

  // ─── Search ─────────────────────────────────────────────────────
  onSearch(value: string): void {
    this.store.setSearch(value);
    this.syncUrl();
    void this.store.load({ force: true });
  }
  clearSearch(): void {
    this.store.setSearch('');
    this.syncUrl();
    void this.store.load({ force: true });
  }

  // ─── Row actions ────────────────────────────────────────────────
  edit(row: PaymentMethod): void {
    // Online providers don't have a regular form yet — skip the
    // navigation; the connect-form is a deferred milestone.
    if (this.tab() === 'online') return;
    if (row.isDefaultCash) return; // legacy: default cash is locked
    void this.router.navigate(['/settings/payment-methods', row.id || 'new']);
  }
  add(): void {
    void this.router.navigate(['/settings/payment-methods', 'new'], {
      queryParams: { type: this.tab() === 'card' ? 'Card' : 'Cash' },
    });
  }

  /** Open the per-provider connect form for an online method.
   *  Slug = the row's `name` (lowercased + spaces→dashes), matching
   *  the legacy convention. If the row is an existing saved record
   *  (has an `id`), we include it in the URL so the form can load
   *  the saved settings directly via `getById` — same pattern as
   *  the legacy `/payments-method/connect/:slug/:id`. Stub rows
   *  (id === '') route without the id and seed a fresh record. */
  connect(row: PaymentMethod, ev: Event): void {
    ev.stopPropagation();
    const slug = (row.name ?? '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) return;
    const path = row.id
      ? ['/settings/payment-methods/connect', slug, row.id]
      : ['/settings/payment-methods/connect', slug];
    void this.router.navigate(path);
  }

  /** Toggle the `isEnabled` flag without leaving the list — the
   *  store owns the optimistic flip + rollback. */
  async toggleEnabled(row: PaymentMethod, ev: Event): Promise<void> {
    ev.stopPropagation();
    await this.store.setRowEnabled(row.id, !row.isEnabled);
  }

  // ─── Drag-reorder ───────────────────────────────────────────────
  async dropRow(ev: CdkDragDrop<PaymentMethod[]>): Promise<void> {
    if (ev.previousIndex === ev.currentIndex) return;
    const next = [...this.rows()];
    moveItemInArray(next, ev.previousIndex, ev.currentIndex);
    await this.store.reorder(next);
  }

  // ─── Helpers ────────────────────────────────────────────────────
  trackRow = (_: number, r: PaymentMethod) => r.id || r.name;

  /** Pick the best thumbnail for a row. Prefer the server-supplied
   *  `mediaUrl.thumbnailUrl` (custom upload); fall back to the
   *  provider-registry logo for online providers; otherwise let the
   *  template render its generic placeholder. */
  rowThumb(row: PaymentMethod): string | null {
    if (row.mediaUrl?.thumbnailUrl) return row.mediaUrl.thumbnailUrl;
    return findProviderByName(row.name)?.logo ?? null;
  }
}
