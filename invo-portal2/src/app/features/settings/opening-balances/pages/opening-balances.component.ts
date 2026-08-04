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
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import {
  LogsDrawerComponent,
  LogsDrawerData,
} from '@shared/components/logs-drawer/logs-drawer.component';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { BranchSettingsService } from '../../../settings/services/branch-settings.service';
import { accountTypeKey } from '../../chart-of-accounts/utils/account-types';
import { OpeningBalancesService } from '../services/opening-balances.service';
import {
  OpeningBalanceAccount,
  OpeningBalanceRecord,
  RecordPanelState,
  SaveOpeningBalancePayload,
} from '../services/opening-balances.types';
import {
  ImportExportModalComponent,
  ImportExportData,
  ImportExportResult,
} from './components/import-export-modal.component';

interface BranchOption { id: string; name: string; }

/** One `type` bucket inside a parent-type group (Current Assets only). */
interface TypeGroup { type: string; label: string; accounts: OpeningBalanceAccount[]; }
/** One parent-type group in the grid. */
interface ParentGroup { parentType: string; label: string; showTypeHeaders: boolean; typeGroups: TypeGroup[]; }

/** Display order of the parent-type buckets (mirrors the legacy grid). */
const PARENT_ORDER = [
  'Current Assets', 'Other Current Assets', 'Fixed Assets', 'Non Current Assets',
  'Current Liabilities', 'Other Current Liabilities', 'Long Term Liabilities', 'Equity',
];
/** Sub-type order within Current Assets (Cash, Bank, then the rest A→Z). */
const CA_TYPE_ORDER = ['Cash', 'Bank'];

const RECORD_LIMIT = 5;

/**
 * Opening Balances
 * ────────────────
 * Set every ledger account's starting debit/credit as of an opening date,
 * grouped by parent-type (Current Assets further split by type). Account
 * Receivable / Payable / Inventory accounts are read-only and driven by
 * expandable, paginated sub-records (customers / suppliers / products).
 *
 * Double-entry is enforced: the difference between total debit and total
 * credit is posted to an auto-computed "Opening Balance Adjustment" line so
 * the grand totals always balance.
 */
@Component({
  selector: 'app-opening-balances',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    MycurrencyPipe,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    DatePickerComponent,
    SearchDropdownComponent,
    DropdownMenuBtnComponent,
    RouterModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './opening-balances.component.html',
  styleUrl: './opening-balances.component.scss',
})
export class OpeningBalancesComponent implements OnInit, CanLeaveComponent {
  private service    = inject(OpeningBalancesService);
  private branchSvc  = inject(BranchSettingsService);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  loading  = signal<boolean>(false);
  saving   = signal<boolean>(false);
  editMode = signal<boolean>(false);
  dirty    = signal<boolean>(false);

  branches = signal<BranchOption[]>([]);
  branchId = signal<string | null>(null);

  /** Working copy of the accounts grid (mutated in edit mode). */
  accounts = signal<OpeningBalanceAccount[]>([]);
  /** ISO 'yyyy-MM-dd' opening date. */
  openingDate = signal<string | null>(null);
  /** Latest allowed opening date (company opening / creation − 1). */
  maxDate = signal<Date | null>(null);

  /** Record panels keyed by accountId (AR / AP / Inventory). */
  panels = signal<Record<string, RecordPanelState>>({});

  private i18nTick = signal(0);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Derived ─────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('OPENING_BALANCES.TITLE') },
    ];
  });

  branchDisplay = (b: BranchOption) => b?.name ?? '';
  branchCompare = (a: BranchOption, b: BranchOption) => a?.id === b?.id;
  selectedBranch = computed<BranchOption | null>(
    () => this.branches().find((b) => b.id === this.branchId()) ?? null,
  );

  /** `Date` view of the opening date for `<app-date-picker>`. */
  openingDateObj = computed<Date | null>(() => this.toDate(this.openingDate()));

  /** Visible (non-hidden) accounts. */
  private visibleAccounts = computed(() => this.accounts().filter((a) => !this.isAdjustment(a)));

  /** Grid grouped parent-type → (type) → account. */
  groups = computed<ParentGroup[]>(() => {
    this.i18nTick();
    const rows = this.visibleAccounts();
    const byParent = new Map<string, OpeningBalanceAccount[]>();
    for (const a of rows) {
      const pt = a.parentType || a.type || 'Other';
      (byParent.get(pt) ?? byParent.set(pt, []).get(pt)!).push(a);
    }
    const orderedParents = [
      ...PARENT_ORDER.filter((p) => byParent.has(p)),
      ...[...byParent.keys()].filter((p) => !PARENT_ORDER.includes(p)).sort(),
    ];
    return orderedParents.map((pt) => {
      const list = byParent.get(pt)!;
      const isCA = pt === 'Current Assets';
      if (!isCA) {
        return {
          parentType: pt,
          label: this.typeLabel(pt),
          showTypeHeaders: false,
          typeGroups: [{ type: '', label: '', accounts: this.sortAccounts(list) }],
        };
      }
      // Current Assets → sub-group by type (Cash, Bank, then A→Z).
      const byType = new Map<string, OpeningBalanceAccount[]>();
      for (const a of list) {
        const t = a.type || pt;
        (byType.get(t) ?? byType.set(t, []).get(t)!).push(a);
      }
      const orderedTypes = [...byType.keys()].sort((x, y) => {
        const ix = CA_TYPE_ORDER.indexOf(x), iy = CA_TYPE_ORDER.indexOf(y);
        if (ix !== -1 || iy !== -1) return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy);
        return x.localeCompare(y);
      });
      return {
        parentType: pt,
        label: this.typeLabel(pt),
        showTypeHeaders: true,
        typeGroups: orderedTypes.map((t) => ({
          type: t, label: this.typeLabel(t), accounts: this.sortAccounts(byType.get(t)!),
        })),
      };
    });
  });

  // ── Totals & double-entry balancing (adjustment excluded from raw totals) ──
  totalDebit  = computed(() => this.round(this.visibleAccounts().reduce((s, a) => s + (a.debit  || 0), 0)));
  totalCredit = computed(() => this.round(this.visibleAccounts().reduce((s, a) => s + (a.credit || 0), 0)));
  adjustmentDebit  = computed(() => this.round(Math.max(0, this.totalCredit() - this.totalDebit())));
  adjustmentCredit = computed(() => this.round(Math.max(0, this.totalDebit()  - this.totalCredit())));
  grandDebit  = computed(() => this.round(this.totalDebit()  + this.adjustmentDebit()));
  grandCredit = computed(() => this.round(this.totalCredit() + this.adjustmentCredit()));
  /** The signed imbalance (positive = credit-heavy). */
  imbalance = computed(() => this.round(this.totalDebit() - this.totalCredit()));
  isBalanced = computed(() => this.imbalance() === 0);

  constructor() {
    withTranslations('settings/opening-balances', 'settings/chart-of-accounts');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    await this.loadBranches();
    await this.load();
  }

  hasUnsavedChanges(): boolean { return this.dirty() && !this.saving(); }

  // ─── Data ────────────────────────────────────────────────────────────────
  private async loadBranches(): Promise<void> {
    try {
      const res = await this.branchSvc.getList({ limit: 200 });
      this.branches.set(res.list.map((b) => ({ id: b.id, name: b.name })));
      const main = res.list.find((b) => b.mainBranch) ?? res.list[0];
      this.branchId.set(main?.id ?? null);
    } catch (e) {
      console.error('[opening-balances] loadBranches failed', e);
    }
  }

  async load(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return;
    this.loading.set(true);
    try {
      const data = await this.service.getAccounts(branchId);
      this.accounts.set(data.accounts.map((a) => this.classify(a)));
      this.openingDate.set(data.openingBalanceDate ?? null);
      this.panels.set({});
      this.editMode.set(false);
      this.dirty.set(false);
    } catch (e) {
      console.error('[opening-balances] load failed', e);
      this.accounts.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  onBranchChange(option: BranchOption | BranchOption[] | null): void {
    const opt = Array.isArray(option) ? option[0] ?? null : option;
    this.branchId.set(opt?.id ?? null);
    void this.load();
  }

  // ─── Edit / save ─────────────────────────────────────────────────────────
  enterEdit(): void { this.editMode.set(true); }

  async cancel(): Promise<void> {
    await this.load(); // reload discards edits (also clears editMode + dirty)
  }

  setDebit(a: OpeningBalanceAccount, value: string): void {
    if (a.readonly) return;
    const n = Math.max(0, parseFloat(value) || 0);
    this.mutate(a, (row) => { row.debit = n; if (n > 0) row.credit = 0; });
  }
  setCredit(a: OpeningBalanceAccount, value: string): void {
    if (a.readonly) return;
    const n = Math.max(0, parseFloat(value) || 0);
    this.mutate(a, (row) => { row.credit = n; if (n > 0) row.debit = 0; });
  }

  async save(): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title:   this.translate.instant('OPENING_BALANCES.CONFIRM_TITLE'),
          message: this.translate.instant('OPENING_BALANCES.CONFIRM_MESSAGE', {
            count: this.visibleAccounts().length,
            date:  this.displayDate(this.openingDate()),
          }),
          confirm: this.translate.instant('COMMON.SAVE'),
        },
      },
    );
    if ((await ref.afterClosed()) !== true) return;

    this.saving.set(true);
    try {
      const payload: SaveOpeningBalancePayload = {
        branchId:           this.branchId() ?? '',
        openingBalanceDate: this.openingDate(),
        accounts: this.accounts().map((a) => ({
          accountId: a.accountId, name: a.name, default: a.default,
          type: a.type, parentType: a.parentType, debit: a.debit, credit: a.credit,
        })),
      };
      const ok = await this.service.save(payload);
      if (ok) {
        this.dirty.set(false);
        this.toast.success('OPENING_BALANCES.SAVED');
        await this.load();
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[opening-balances] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  // ─── Opening date ────────────────────────────────────────────────────────
  onDatePick(d: Date | null): void {
    this.openingDate.set(this.toIso(d));
    this.dirty.set(true);
  }

  displayDate(iso: string | null): string {
    const d = this.toDate(iso);
    if (!d) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  // ─── Header menu ─────────────────────────────────────────────────────────
  optionsMenu(): DropdownMenuBtnItem[] {
    return [
      { label: this.translate.instant('OPENING_BALANCES.IMPORT_EXPORT'), click: () => void this.openImportExport() },
      { label: this.translate.instant('OPENING_BALANCES.SHOW_LOGS'),     click: () => this.openLogs() },
    ];
  }

  async openImportExport(): Promise<void> {
    const ref = this.modal.open<ImportExportModalComponent, ImportExportData, ImportExportResult>(
      ImportExportModalComponent,
      { size: 'md', closeOnBackdrop: false, data: { branchId: this.branchId() ?? '' } },
    );
    const result = await ref.afterClosed();
    if (result?.reload) await this.load();
  }

  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true,
      drawerWidth: '480px',
      drawerResizable: true,
      data: {
        sourceTable: 'openingBalance',
        title: this.translate.instant('OPENING_BALANCES.TITLE'),
      },
    });
  }

  // ─── Expandable records ──────────────────────────────────────────────────
  async toggleExpand(a: OpeningBalanceAccount): Promise<void> {
    if (!a.expandable || !a.accountId) return;
    const willOpen = !a.expanded;
    this.mutate(a, (row) => { row.expanded = willOpen; }, false);
    if (willOpen && !this.panels()[a.accountId]) {
      await this.loadRecords(a, 1);
    }
  }

  panel(accountId: string | null): RecordPanelState | null {
    return accountId ? this.panels()[accountId] ?? null : null;
  }

  async goToRecordPage(a: OpeningBalanceAccount, page: number): Promise<void> {
    await this.loadRecords(a, page);
  }

  onInventorySearch(a: OpeningBalanceAccount, term: string): void {
    if (!a.accountId) return;
    this.patchPanel(a.accountId, { search: term });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.loadRecords(a, 1), 350);
  }

  private async loadRecords(a: OpeningBalanceAccount, page: number): Promise<void> {
    const id = a.accountId;
    if (!id) return;
    const branchId = this.branchId() ?? '';
    const existing = this.panels()[id];
    const search = existing?.search ?? '';
    this.patchPanel(id, { loading: true, page });
    try {
      let res;
      if (a.recordKind === 'receivable') res = await this.service.getReceivableRecords(branchId, page, RECORD_LIMIT);
      else if (a.recordKind === 'payable') res = await this.service.getPayableRecords(branchId, page, RECORD_LIMIT);
      else res = await this.service.getInventoryRecords(branchId, id, page, RECORD_LIMIT, search);
      this.patchPanel(id, {
        list: res.list, count: res.count, pageCount: res.pageCount, loading: false,
      });
    } catch (e) {
      console.error('[opening-balances] loadRecords failed', e);
      this.patchPanel(id, { loading: false, list: [] });
    }
  }

  // ─── Inventory inline edit ───────────────────────────────────────────────
  toggleRecordEdit(accountId: string, rec: OpeningBalanceRecord): void {
    this.patchRecord(accountId, rec.id, (r) => { r.editing = !r.editing; });
  }
  setRecordField(accountId: string, recId: string, field: 'stock' | 'openingBalance' | 'openingBalanceCost', value: string): void {
    const n = Math.max(0, parseFloat(value) || 0);
    this.patchRecord(accountId, recId, (r) => { (r as any)[field] = n; });
  }
  async applyRecord(a: OpeningBalanceAccount, rec: OpeningBalanceRecord): Promise<void> {
    if (!a.accountId) return;
    try {
      const ok = await this.service.saveInventoryRecord({
        branchId:           this.branchId() ?? '',
        productId:          rec.id,
        stock:              rec.stock ?? 0,
        openingBalance:     rec.openingBalance ?? 0,
        openingBalanceCost: rec.openingBalanceCost ?? 0,
      });
      if (ok) {
        this.patchRecord(a.accountId, rec.id, (r) => { r.editing = false; });
        this.toast.success('OPENING_BALANCES.RECORD_SAVED');
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  // ─── Labels / helpers ────────────────────────────────────────────────────
  /** Translate an account type / parent type, falling back to the raw value. */
  typeLabel = (value: string | null | undefined): string => {
    if (!value) return '—';
    const key = accountTypeKey(value);
    const label = this.translate.instant(key);
    return label && label !== key ? label : value;
  };

  recordViewLink(a: OpeningBalanceAccount, rec: OpeningBalanceRecord): string[] | null {
    if (a.recordKind === 'receivable') return ['/account/customers/view', rec.id];
    if (a.recordKind === 'payable')    return ['/account/suppliers/view', rec.id];
    return null;
  }

  trackAccount = (_: number, a: OpeningBalanceAccount) => a.accountId ?? a.name;
  trackRecord  = (_: number, r: OpeningBalanceRecord) => r.id;

  recordRange(p: RecordPanelState): { from: number; to: number } {
    const from = p.count === 0 ? 0 : (p.page - 1) * p.limit + 1;
    const to = Math.min(p.page * p.limit, p.count);
    return { from, to };
  }

  // ─── Private ─────────────────────────────────────────────────────────────
  private classify(a: OpeningBalanceAccount): OpeningBalanceAccount {
    const t = a.type;
    let readonly = false, expandable = false;
    let recordKind: OpeningBalanceAccount['recordKind'];
    if (a.default && t === 'Account Receivable') { readonly = true; expandable = true; recordKind = 'receivable'; }
    else if (a.default && t === 'Account Payable') { readonly = true; expandable = true; recordKind = 'payable'; }
    else if (t === 'Inventory Assets') { readonly = true; expandable = true; recordKind = 'inventory'; }
    return { ...a, readonly, expandable, recordKind, expanded: false };
  }

  private isAdjustment(a: OpeningBalanceAccount): boolean {
    return /opening\s*balance\s*adjus/i.test(a.name || '');
  }

  private sortAccounts(list: OpeningBalanceAccount[]): OpeningBalanceAccount[] {
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Clone-mutate-set a single account so `@for` sees a fresh reference.
   *  `markDirty` is false for UI-only changes like expand/collapse. */
  private mutate(target: OpeningBalanceAccount, fn: (row: OpeningBalanceAccount) => void, markDirty = true): void {
    this.accounts.update((rows) => rows.map((r) => {
      if (r !== target && !(r.accountId && r.accountId === target.accountId)) return r;
      const next = { ...r };
      fn(next);
      return next;
    }));
    if (markDirty) this.dirty.set(true);
  }

  private patchPanel(accountId: string, patch: Partial<RecordPanelState>): void {
    this.panels.update((map) => {
      const prev = map[accountId] ?? { list: [], page: 1, limit: RECORD_LIMIT, count: 0, pageCount: 1, search: '', loading: false };
      return { ...map, [accountId]: { ...prev, ...patch } };
    });
  }

  private patchRecord(accountId: string, recId: string, fn: (r: OpeningBalanceRecord) => void): void {
    this.panels.update((map) => {
      const panel = map[accountId];
      if (!panel) return map;
      const list = panel.list.map((r) => { if (r.id !== recId) return r; const n = { ...r }; fn(n); return n; });
      return { ...map, [accountId]: { ...panel, list } };
    });
  }

  private round(n: number): number { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

  private toDate(iso: string | null): Date | null {
    if (!iso) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  private toIso(d: Date | null): string | null {
    if (!d) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
