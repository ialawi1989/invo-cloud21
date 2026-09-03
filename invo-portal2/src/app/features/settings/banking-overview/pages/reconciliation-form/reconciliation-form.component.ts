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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { BankingOverviewService } from '../../services/banking-overview.service';
import {
  ReconciliationAttachment,
  ReconciliationHeader,
  ReconciliationTransaction,
  SaveReconciliationPayload,
} from '../../services/banking-overview.types';
import { AccountHeaderComponent } from '../../components/account-header/account-header.component';
import type { MediaPickerModalComponent as MediaPickerType } from '../../../media/components/media-picker/media-picker-modal.component';

type GridFilter = 'all' | 'reconciled' | 'unreconciled' | 'debit' | 'credit';

/** Pinned opening-balance pseudo-row — always checked, never togglable,
 *  never counted against `selectedCount` / the changed-rows list. */
const OPENING_BALANCE_ID = '__opening-balance__';

const PAGE_SIZE = 15;

/**
 * Reconciliation workspace — create ('id' === '0') or edit an existing
 * period. Loads the full transaction set for the period ONCE; filtering,
 * search and pagination are all client-side from there on (matches the
 * legacy `reconcilation-form.component.ts`, which never re-fetches per
 * page/filter).
 */
@Component({
  selector: 'app-reconciliation-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    MycurrencyPipe,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    SegmentedToggleComponent,
    AccountHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reconciliation-form.component.html',
  styleUrl: './reconciliation-form.component.scss',
})
export class ReconciliationFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(BankingOverviewService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);
  dirty   = signal<boolean>(false);

  accountId       = signal<string>('');
  accountName     = signal<string>('');
  reconciliationId = signal<string>('');
  isNew           = computed(() => this.reconciliationId() === '' || this.reconciliationId() === '0');

  header  = signal<ReconciliationHeader | null>(null);
  /** '' (unsaved) | 'in-progress' | 'reconciled'. Local UI state — mirrors
   *  `reconcilationData.status` in the legacy form. Initialized from the
   *  loaded header (existing records reopen straight into the right
   *  screen) and flipped locally by `startReconciliation()`/`save()`
   *  without a page reload. */
  status = signal<'' | 'in-progress' | 'reconciled'>('');

  closingBalance = signal<number>(0);
  fromDate       = signal<string>('');
  toDate         = signal<string>('');

  openingBalanceRow = signal<ReconciliationTransaction | null>(null);
  transactions      = signal<ReconciliationTransaction[]>([]);
  attachments       = signal<ReconciliationAttachment[]>([]);

  filter     = signal<GridFilter>('all');
  searchTerm = signal<string>('');
  page       = signal<number>(1);

  private i18nTick = signal(0);

  filterOptions: SegmentedToggleOption<GridFilter>[] = [
    { value: 'all',          label: 'BANKING_OVERVIEW.FORM.FILTER_ALL' },
    { value: 'reconciled',   label: 'BANKING_OVERVIEW.FORM.FILTER_RECONCILED' },
    { value: 'unreconciled', label: 'BANKING_OVERVIEW.FORM.FILTER_UNRECONCILED' },
    { value: 'debit',        label: 'BANKING_OVERVIEW.FORM.FILTER_DEBIT' },
    { value: 'credit',       label: 'BANKING_OVERVIEW.FORM.FILTER_CREDIT' },
  ];

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    const accId = this.accountId();
    return [
      { label: this.translate.instant('MENU.DASHBOARD'), routerLink: '/dashboard' },
      { label: this.translate.instant('BANKING_OVERVIEW.TITLE'), routerLink: '/account/banking-overview' },
      { label: this.accountName() || '—', routerLink: `/account/banking-overview/transactions/${accId}` },
      { label: this.translate.instant('BANKING_OVERVIEW.LIST.RECONCILIATIONS'), routerLink: `/account/banking-overview/reconciliations/${accId}` },
      { label: this.translate.instant(this.isNew() ? 'BANKING_OVERVIEW.FORM.NEW_TITLE' : 'BANKING_OVERVIEW.FORM.EDIT_TITLE') },
    ];
  });

  // ─── Grid derivations ──────────────────────────────────────────────────
  /** All rows, opening balance first — filtered + searched (client-side). */
  filteredTransactions = computed<ReconciliationTransaction[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const f = this.filter();
    return this.transactions().filter(t => {
      const matchesFilter =
        f === 'all' ||
        (f === 'reconciled' && t.reconcile) ||
        (f === 'unreconciled' && !t.reconcile) ||
        (f === 'debit' && !!t.Debit) ||
        (f === 'credit' && !!t.Credit);
      const matchesSearch = !term ||
        (t.transactionDetails ?? '').toLowerCase().includes(term) ||
        (t.reference ?? '').toLowerCase().includes(term) ||
        (t.referenceNumber ?? '').toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  });

  pageCount = computed(() => Math.max(1, Math.ceil(this.filteredTransactions().length / PAGE_SIZE)));

  pagedTransactions = computed<ReconciliationTransaction[]>(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filteredTransactions().slice(start, start + PAGE_SIZE);
  });

  selectedCount = computed(() => this.transactions().filter(t => t.reconcile).length);

  totalDebit = computed(() => {
    const ob = this.openingBalanceRow();
    let total = ob ? (ob.Debit || 0) : 0;
    for (const t of this.transactions()) if (t.reconcile) total += Math.abs(t.Debit || 0);
    return this.round(total);
  });

  totalCredit = computed(() => {
    const ob = this.openingBalanceRow();
    let total = ob ? (ob.Credit || 0) : 0;
    for (const t of this.transactions()) if (t.reconcile) total += Math.abs(t.Credit || 0);
    return this.round(total);
  });

  clearedAmount = computed(() => this.round(this.totalDebit() - this.totalCredit()));
  difference    = computed(() => this.round(this.closingBalance() - this.clearedAmount()));

  selectAll = computed(() =>
    this.transactions().length > 0 && this.transactions().every(t => t.reconcile));

  /** Header fields are complete enough to begin ticking rows, or to force
   *  a "Save and Reconcile Later" draft through — mirrors the legacy
   *  `!myForm.valid` gate: a picked date range (`to` on/after `from`) and
   *  a strictly positive closing balance. */
  headerValid = computed(() =>
    !!this.fromDate() && !!this.toDate() && this.toDate() >= this.fromDate() &&
    this.closingBalance() > 0);

  /** Full "Reconcile" is only meaningful once the sheet balances and at
   *  least one (non-opening-balance) row is selected — matches the legacy
   *  `doSave` guard (`!myForm.valid || difference != 0 ||
   *  selectedTransctionCount == 0`). "Save and Reconcile Later" is exempt
   *  from this gate entirely (see `saveDraft()`). */
  canSave = computed(() =>
    this.headerValid() &&
    this.difference() === 0 &&
    this.selectedCount() > 0);

  constructor() {
    withTranslations('settings/banking-overview');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.accountId.set(this.route.snapshot.paramMap.get('accountId') || '');
    this.reconciliationId.set(this.route.snapshot.paramMap.get('id') || '0');
    await this.load();
  }

  hasUnsavedChanges(): boolean { return this.dirty() && !this.saving(); }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.accountName.set(await this.service.getAccountName(this.accountId()));

      if (this.isNew()) {
        this.status.set('');
        this.attachments.set([]);

        const suggestion = await this.service.getReconciliationDate(this.accountId());
        this.fromDate.set(suggestion.date);
        this.toDate.set('');

        const ob = await this.service.getOpeningBalance(this.accountId(), suggestion.date);
        this.openingBalanceRow.set(this.toOpeningBalanceRow(ob));
        this.transactions.set([]);
      } else {
        const header = await this.service.getReconciliation(this.reconciliationId());
        this.header.set(header);
        if (header) {
          // Reopens directly into whichever screen the period was left in
          // ('in-progress' → the grid, 'reconciled' → the read-only view)
          // rather than back at "Start Reconciliation".
          this.status.set(header.status);
          this.attachments.set(header.attachment ?? []);
          this.closingBalance.set(header.closingBalance);
          this.fromDate.set(this.toDateInput(header.from));
          this.toDate.set(this.toDateInput(header.to));

          const ob = await this.service.getOpeningBalance(this.accountId(), header.from);
          this.openingBalanceRow.set(this.toOpeningBalanceRow(ob));

          const reconcileOnly = header.status === 'reconciled';
          const rows = await this.service.getReconciliationRecords(this.reconciliationId(), reconcileOnly);
          this.transactions.set(rows);
        }
      }
      this.dirty.set(false);
    } catch (e) {
      console.error('[banking-overview] reconciliation-form load failed', e);
    } finally {
      this.loading.set(false);
    }
  }

  private toOpeningBalanceRow(ob: { Debit: number; Credit: number; transactionDetails: string; date: string | Date }): ReconciliationTransaction {
    return {
      id: OPENING_BALANCE_ID,
      reference: 'Opening Balance',
      referenceId: null,
      referenceNumber: null,
      transactionDetails: ob.transactionDetails || 'Opening Balance',
      date: ob.date,
      Debit: ob.Debit,
      Credit: ob.Credit,
      reconcile: true,
      reconciliationId: null,
    };
  }

  // ─── Header field edits ──────────────────────────────────────────────
  onClosingBalanceChange(value: string): void {
    const n = Math.max(0, parseFloat(value) || 0);
    this.closingBalance.set(n);
    this.dirty.set(true);
  }
  onFromDateChange(value: string): void { this.fromDate.set(value); this.dirty.set(true); }
  onToDateChange(value: string): void { this.toDate.set(value); this.dirty.set(true); }

  // ─── Grid interactions ───────────────────────────────────────────────
  onFilterChange(f: GridFilter): void { this.filter.set(f); this.page.set(1); }
  onSearchChange(term: string): void { this.searchTerm.set(term); this.page.set(1); }
  clearSearch(): void { this.searchTerm.set(''); this.page.set(1); }

  goToPage(p: number): void {
    if (p < 1 || p > this.pageCount()) return;
    this.page.set(p);
  }

  toggleRow(row: ReconciliationTransaction): void {
    this.transactions.update(rows => rows.map(r =>
      r === row || r.id === row.id ? { ...r, reconcile: !r.reconcile, isChanged: true } : r));
    this.dirty.set(true);
  }

  toggleSelectAll(checked: boolean): void {
    this.transactions.update(rows => rows.map(r => ({ ...r, reconcile: checked, isChanged: true })));
    this.dirty.set(true);
  }

  // ─── Start / Save ────────────────────────────────────────────────────
  /** `status === ''` → `'in-progress'`. Client-side only (no save call) —
   *  fetches the account's open (unreconciled) transactions for the
   *  chosen date range and reveals the grid, matching legacy
   *  `startReconcilation()` → `loadListData()`. */
  async startReconciliation(): Promise<void> {
    if (!this.headerValid() || this.loading()) return;

    this.loading.set(true);
    try {
      const res = await this.service.getTransactions({
        accountId:     this.accountId(),
        fromDate:      this.fromDate(),
        toDate:        this.toDate(),
        reconcile:     false,
        sortDirection: 'ASC',
        page:          1,
        limit:         100000,
      });
      // Drop any stray "Opening Balance" row the ledger endpoint might
      // include (it's rendered separately from `openingBalanceRow`) and
      // zero-amount rows — matches legacy `loadListData()`.
      this.transactions.set(res.list.filter(t =>
        t.reference !== 'Opening Balance' && ((t.Debit ?? 0) !== 0 || (t.Credit ?? 0) !== 0)));
      this.status.set('in-progress');
      this.dirty.set(true);
    } catch (e) {
      console.error('[banking-overview] startReconciliation failed', e);
      this.toast.error('COMMON.SAVE_FAILED');
    } finally {
      this.loading.set(false);
    }
  }

  /** "Save and Reconcile Later" — posts the currently-ticked rows with
   *  `status: 'in-progress'` and deliberately SKIPS the balance/selected-
   *  count gate (`canSave`): matches legacy `doSave(status)` when called
   *  with `status === ''`, which only short-circuits the validation block
   *  `if (status != '')`. Always available while the period is open. */
  async saveDraft(): Promise<void> {
    if (this.status() !== 'in-progress' || this.saving()) return;
    await this.doSave('in-progress');
  }

  /** "Reconcile" — the full close-out save. Gated on `canSave()` (sheet
   *  balances, at least one row selected) and asks for confirmation. */
  async save(): Promise<void> {
    if (!this.canSave()) return;

    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title:   this.translate.instant('BANKING_OVERVIEW.FORM.CONFIRM_SAVE_TITLE'),
          message: this.translate.instant('BANKING_OVERVIEW.FORM.CONFIRM_SAVE_MESSAGE'),
          confirm: this.translate.instant('COMMON.SAVE'),
        },
      },
    );
    if ((await ref.afterClosed()) !== true) return;

    await this.doSave('reconciled');
  }

  /** Shared save path for both the draft and the final reconcile — same
   *  payload construction (transactions/id/accountId/from/to/closing
   *  balance/attachments), differing only in `status`. Mirrors legacy
   *  `doSave(status)`. */
  private async doSave(status: 'in-progress' | 'reconciled'): Promise<void> {
    this.saving.set(true);
    try {
      const payload: SaveReconciliationPayload = {
        id:             this.isNew() ? '' : this.reconciliationId(),
        accountId:      this.accountId(),
        from:           this.fromDate(),
        to:             this.toDate(),
        closingBalance: this.closingBalance(),
        status,
        attachment:     this.attachments(),
        transactions:   this.transactions().filter(t => t.reconcile),
      };
      const ok = await this.service.save(payload);
      if (ok) {
        this.toast.success('MESSAGE.SUCCESSFULLY_SAVED');
        this.dirty.set(false);
        void this.router.navigate(['/account/banking-overview/reconciliations', this.accountId()]);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[banking-overview] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/account/banking-overview/reconciliations', this.accountId()]);
  }

  // ─── Attachments ─────────────────────────────────────────────────────
  /** Opens the shared media picker (lazy-loaded, same pattern as
   *  `business-settings`'s "Choose logo") and appends whatever comes back
   *  as `{id, size, mediaUrl, mediaType, mediaName}` — the shape
   *  `saveReconciliation` writes straight onto `Reconciliations.attachment`. */
  async addAttachment(): Promise<void> {
    const { MediaPickerModalComponent } =
      await import('../../../media/components/media-picker/media-picker-modal.component');
    const ref = this.modal.open<MediaPickerType, any, any>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image', 'document'],
          title: this.translate.instant('BANKING_OVERVIEW.FORM.ATTACH_FILE'),
          multiple: true,
        },
        closeOnBackdrop: true,
      },
    );
    const picked = await ref.afterClosed();
    if (!picked) return;
    const items: any[] = Array.isArray(picked) ? picked : [picked];
    if (!items.length) return;

    const mapped: ReconciliationAttachment[] = items
      .map((m: any): ReconciliationAttachment => ({
        id:        String(m?.id ?? m?._id ?? ''),
        size:      typeof m?.getSize === 'number' ? m.getSize : Number(m?.size?.size ?? m?.mediaSize ?? 0) || 0,
        mediaUrl:  m?.imageUrl || m?.url?.defaultUrl || m?.url?.original || m?.url?.thumbnail || '',
        mediaType: m?.mediaType?.fileType || m?.contentType || '',
        mediaName: m?.name || '',
      }))
      .filter(a => !!a.id);

    this.attachments.update(existing => {
      const seen = new Set(existing.map(a => a.id));
      return [...existing, ...mapped.filter(a => !seen.has(a.id))];
    });
    this.dirty.set(true);
  }

  removeAttachment(id: string): void {
    this.attachments.update(list => list.filter(a => a.id !== id));
    this.dirty.set(true);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
  trackRow = (_: number, r: ReconciliationTransaction) => r.id;

  private round(n: number): number { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

  private toDateInput(d: string | Date | null | undefined): string {
    if (!d) return '';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d).slice(0, 10);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

}
