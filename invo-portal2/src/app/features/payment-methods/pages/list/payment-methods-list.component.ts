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
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { PaymentMethodService } from '../../services/payment-method.service';
import { PaymentMethod, PaymentKind } from '../../services/payment-method.types';
import { findProviderByName } from '../../utils/provider-registry';

/** Top-level tab — what kind of methods we're showing. */
type Tab = 'currency' | 'card' | 'online';

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
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SkeletonComponent,
    SegmentedToggleComponent,
    MycurrencyPipe,
    DragDropModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-methods-list.component.html',
  styleUrl:    './payment-methods-list.component.scss',
})
export class PaymentMethodsListComponent implements OnInit {
  private service    = inject(PaymentMethodService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  rows    = signal<PaymentMethod[]>([]);

  tab    = signal<Tab>('currency');
  search = signal<string>('');

  private searchDebounce?: ReturnType<typeof setTimeout>;
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

  /** Online list groups by enabled state — matches the legacy
   *  "Enabled / Disabled" sections. For Currency / Card we render
   *  a flat list. */
  enabledOnline  = computed<PaymentMethod[]>(() => this.rows().filter(r => r.isEnabled));
  disabledOnline = computed<PaymentMethod[]>(() => this.rows().filter(r => !r.isEnabled));

  constructor() {
    withTranslations('payment-methods');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  setTab(t: Tab): void {
    if (this.tab() === t) return;
    this.tab.set(t);
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const term = this.search().trim();
      const res = this.tab() === 'online'
        ? await this.service.getOnlineList({ searchTerm: term })
        : await this.service.getList({
            searchTerm: term,
            type: this.tab() === 'card' ? 'Card' : 'Cash',
            limit: 200,
          });
      // Sort by `index` ascending so the drag order from the
      // server is preserved.
      this.rows.set([...res.list].sort((a, b) => a.index - b.index));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Search ─────────────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.load(), 300);
  }
  clearSearch(): void { this.search.set(''); this.load(); }

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
   *  the legacy convention. */
  connect(row: PaymentMethod, ev: Event): void {
    ev.stopPropagation();
    const slug = (row.name ?? '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) return;
    void this.router.navigate(['/settings/payment-methods/connect', slug]);
  }

  /** Toggle the `isEnabled` flag without leaving the list. */
  async toggleEnabled(row: PaymentMethod, ev: Event): Promise<void> {
    ev.stopPropagation();
    const next = !row.isEnabled;
    // Optimistic update — flip immediately, roll back on failure.
    this.rows.update(list => list.map(r => r.id === row.id ? { ...r, isEnabled: next } : r));
    try {
      const ok = await this.service.setEnabled(row.id, next);
      if (!ok) throw new Error('save failed');
    } catch (err: any) {
      this.rows.update(list => list.map(r => r.id === row.id ? { ...r, isEnabled: !next } : r));
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    }
  }

  // ─── Drag-reorder ───────────────────────────────────────────────
  async dropRow(ev: CdkDragDrop<PaymentMethod[]>): Promise<void> {
    if (ev.previousIndex === ev.currentIndex) return;
    const next = [...this.rows()];
    moveItemInArray(next, ev.previousIndex, ev.currentIndex);
    // Snapshot the new order locally first for snappy feedback.
    this.rows.set(next.map((r, i) => ({ ...r, index: i })));
    try {
      const ok = await this.service.reorder(this.rows());
      if (!ok) throw new Error('save failed');
    } catch (err: any) {
      // Roll back by reloading from the server — simpler than
      // remembering the prior order when reorder fails mid-page.
      await this.load();
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    }
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
