import { Injectable, computed, inject, signal } from '@angular/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { CompanyService } from '@core/auth/company.service';

import { PaymentMethodService } from './payment-method.service';
import {
  PaymentMethod,
  emptyPaymentMethod,
} from './payment-method.types';
import {
  ProviderSpec,
  buildConnectList,
} from '../utils/provider-registry';

/** Top-level tab — what kind of methods we're showing. Mirrors the
 *  list page's union; kept in the store so the form pages can also
 *  read it (e.g. to decide which tab to land back on after save). */
export type PaymentMethodsTab = 'currency' | 'card' | 'online';

/** Per-tab rowset cache. Keeping each tab's rows separate means
 *  switching back to a recently-viewed tab is instant — we re-render
 *  from cache and refresh in the background instead of clearing the
 *  list to a spinner. */
interface TabState {
  rows:    PaymentMethod[];
  /** Wall-clock of the last successful fetch. Drives `isStale()`. */
  loadedAt: number;
}

/**
 * Feature-scoped state store for the payment-methods page.
 *
 * Owns:
 *   • Active tab + search term (so navigation away/back restores).
 *   • Per-tab cached rowset + freshness stamp.
 *   • Loading flag.
 *
 * Drives:
 *   • Optimistic enable-toggle and drag-reorder with rollback.
 *   • Post-save cache replacement so the form-page save bubbles
 *     back to the list without a re-fetch round-trip.
 *
 * Lives at `providedIn: 'root'` so cached state persists across
 * navigations within the same session. A page leaving the feature
 * doesn't tear the store down; coming back picks up where it was.
 */
@Injectable({ providedIn: 'root' })
export class PaymentMethodsStore {
  private service = inject(PaymentMethodService);
  private toast   = inject(ToastService);
  private company = inject(CompanyService);

  // ─── Public state ────────────────────────────────────────────────
  readonly tab    = signal<PaymentMethodsTab>('currency');
  readonly search = signal<string>('');
  readonly loading = signal<boolean>(false);

  /** Per-tab rowset cache. Lazily populated as tabs are visited. */
  private readonly tabs = signal<Record<PaymentMethodsTab, TabState>>({
    currency: { rows: [], loadedAt: 0 },
    card:     { rows: [], loadedAt: 0 },
    online:   { rows: [], loadedAt: 0 },
  });

  /** Rows for the currently-active tab. Components subscribe to this
   *  directly via the signal. */
  readonly rows = computed<PaymentMethod[]>(() => this.tabs()[this.tab()].rows);

  /** Online tab splits into "Enabled" vs "Not Connected" lists —
   *  exposed as computed signals so the template can pick them up
   *  without recomputing per row. */
  readonly connectedOnline    = computed<PaymentMethod[]>(() => this.rows().filter(r => r.isEnabled));
  readonly notConnectedOnline = computed<PaymentMethod[]>(() => this.rows().filter(r => !r.isEnabled));

  // ─── Tab + search controls ───────────────────────────────────────
  /** Switch tab. The caller drives the reload — we don't auto-fetch
   *  because callers often want to bundle tab + search changes into
   *  a single round-trip via `load()`. */
  setTab(t: PaymentMethodsTab): void {
    if (this.tab() === t) return;
    this.tab.set(t);
  }
  setSearch(term: string): void {
    this.search.set(term);
  }

  // ─── Fetching ────────────────────────────────────────────────────
  /** Stale-while-revalidate threshold. Tabs cached more recently than
   *  this skip the refetch when re-entered. */
  private static readonly FRESH_MS = 30_000;

  /** Load (or refresh) the active tab's rowset. If the tab's cache
   *  is still fresh and no search term changed, this is a no-op. */
  async load(opts: { force?: boolean } = {}): Promise<void> {
    const tab = this.tab();
    const cache = this.tabs()[tab];
    const fresh = Date.now() - cache.loadedAt < PaymentMethodsStore.FRESH_MS;
    if (!opts.force && fresh && !this.search().trim()) return;

    this.loading.set(true);
    try {
      const term = this.search().trim();
      const res = tab === 'online'
        ? await this.service.getOnlineList({ searchTerm: term })
        : await this.service.getList({
            searchTerm: term,
            type:       tab === 'card' ? 'Card' : 'Cash',
            limit:      200,
          });

      // Server returns rows in arbitrary order; sort by `index` so the
      // drag-reorder layout is preserved across reloads.
      const sorted = [...res.list].sort((a, b) => a.index - b.index);

      // Online tab also injects "Connect" stubs for providers the
      // user hasn't set up yet. The country filter restricts the
      // stub list to providers that actually serve the company's
      // country — already-saved rows are kept regardless of where
      // the company is now (so cross-region setups don't vanish).
      const finalRows = tab === 'online'
        ? buildConnectList(
            sorted,
            (p) => this.stubFromProvider(p),
            this.company.currentCompany()?.country ?? null,
          )
        : sorted;

      this.tabs.update(s => ({
        ...s,
        [tab]: { rows: finalRows, loadedAt: Date.now() },
      }));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Mutations ───────────────────────────────────────────────────
  /** Optimistic enable-toggle. Flips the flag locally for snappy
   *  feedback, then commits server-side and rolls back on failure. */
  async setRowEnabled(id: string, isEnabled: boolean): Promise<void> {
    const prev = this.findRow(id);
    if (!prev) return;
    this.patchRow(id, { isEnabled });
    try {
      const ok = await this.service.setEnabled(id, isEnabled);
      if (!ok) throw new Error('save failed');
    } catch (err: any) {
      this.patchRow(id, { isEnabled: prev.isEnabled });
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
    }
  }

  /** Persist a drag-reorder. Receives the rows in the *new* order;
   *  we save the rearranged snapshot immediately and roll back via a
   *  full reload on failure (simpler than remembering prior order). */
  async reorder(newOrder: PaymentMethod[]): Promise<void> {
    const tab = this.tab();
    const indexed = newOrder.map((r, i) => ({ ...r, index: i }));
    this.tabs.update(s => ({
      ...s,
      [tab]: { rows: indexed, loadedAt: Date.now() },
    }));
    try {
      const ok = await this.service.reorder(indexed);
      if (!ok) throw new Error('save failed');
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
      await this.load({ force: true });
    }
  }

  /** Replace an existing row (post-form-save) or append a new one if
   *  the id isn't already in cache. Lets the form pages bubble their
   *  changes back to the list without a network refetch. */
  upsertRow(row: PaymentMethod): void {
    if (!row?.id) return;
    const tab = this.tab();
    this.tabs.update(s => {
      const current = s[tab].rows;
      const idx = current.findIndex(r => r.id === row.id);
      const next = idx === -1
        ? [...current, row]
        : current.map(r => r.id === row.id ? row : r);
      return { ...s, [tab]: { rows: next, loadedAt: Date.now() } };
    });
  }

  /** Drop a row from cache — e.g. after a delete elsewhere. */
  removeRow(id: string): void {
    if (!id) return;
    const tab = this.tab();
    this.tabs.update(s => ({
      ...s,
      [tab]: {
        rows:     s[tab].rows.filter(r => r.id !== id),
        loadedAt: Date.now(),
      },
    }));
  }

  /** Invalidate every cached tab. Forces the next `load()` to hit
   *  the wire. Use after destructive operations whose blast radius
   *  isn't easy to pinpoint (bulk import, etc.). */
  invalidateAll(): void {
    this.tabs.set({
      currency: { rows: [], loadedAt: 0 },
      card:     { rows: [], loadedAt: 0 },
      online:   { rows: [], loadedAt: 0 },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  /** Look up a row across the active tab's cache. */
  private findRow(id: string): PaymentMethod | undefined {
    return this.rows().find(r => r.id === id);
  }

  /** Merge a partial patch into a row in the active tab's cache. */
  private patchRow(id: string, patch: Partial<PaymentMethod>): void {
    const tab = this.tab();
    this.tabs.update(s => ({
      ...s,
      [tab]: {
        rows:     s[tab].rows.map(r => r.id === id ? { ...r, ...patch } : r),
        loadedAt: s[tab].loadedAt,
      },
    }));
  }

  /** Synthesise an unsaved row for the online tab from a registry
   *  entry. Matches the legacy `generateConnectPayments` flag-set so
   *  the row reads as "Available — click to connect". */
  private stubFromProvider(p: ProviderSpec): PaymentMethod {
    return {
      ...emptyPaymentMethod(),
      name:      p.backendName,
      type:      'Card',
      isEnabled: false,
      countries: [...p.countries],
    };
  }
}
