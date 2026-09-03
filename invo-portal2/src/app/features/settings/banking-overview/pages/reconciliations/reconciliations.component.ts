import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
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
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import type {
  TableColumn,
  ListQueryParams,
  ListResponse,
} from '@shared/components/list-page/interfaces/list-page.types';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';

import { BranchSettingsService } from '../../../services/branch-settings.service';
import { BankingOverviewService } from '../../services/banking-overview.service';
import { ReconciliationListRow } from '../../services/banking-overview.types';
import { AccountHeaderComponent } from '../../components/account-header/account-header.component';

interface BranchOption { id: string; name: string; }

type StatusFilter = '' | 'in-progress' | 'reconciled';

/**
 * Per-account list of saved reconciliation periods. Mirrors the legacy
 * `disableInitiateReconcile()`: the "Initiate Reconciliation" button is
 * disabled whenever the most recent period (first row, page 1, no
 * search/filter — the same condition the legacy screen checked) is still
 * `in-progress`, or its `[from, to]` window covers today.
 */
@Component({
  selector: 'app-banking-reconciliations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    MycurrencyPipe,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    SegmentedToggleComponent,
    SearchDropdownComponent,
    DropdownMenuBtnComponent,
    BreadcrumbsComponent,
    AccountHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reconciliations.component.html',
  styleUrl: './reconciliations.component.scss',
})
export class ReconciliationsComponent implements OnInit {
  private service    = inject(BankingOverviewService);
  private branchSvc  = inject(BranchSettingsService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  accountId   = signal<string>('');
  accountName = signal<string>('');

  statusFilter = signal<StatusFilter>('');
  branches     = signal<BranchOption[]>([]);
  selectedBranchIds = signal<string[]>([]);

  /** First row of the most recently fetched page-1, no-filter dataset —
   *  used only to decide whether "Initiate Reconciliation" is disabled. */
  private latestPeriod = signal<ReconciliationListRow | null>(null);
  private currentPage  = signal<number>(1);

  private i18nTick = signal(0);

  statusOptions: SegmentedToggleOption<StatusFilter>[] = [
    { value: '',             label: 'BANKING_OVERVIEW.STATUS.ALL' },
    { value: 'in-progress',  label: 'BANKING_OVERVIEW.STATUS.UNRECONCILED' },
    { value: 'reconciled',   label: 'BANKING_OVERVIEW.STATUS.RECONCILED' },
  ];

  branchDisplay = (b: BranchOption) => b?.name ?? '';
  branchCompare = (a: BranchOption, b: BranchOption) => a?.id === b?.id;
  selectedBranches = computed<BranchOption[]>(() => {
    const ids = new Set(this.selectedBranchIds());
    return this.branches().filter(b => ids.has(b.id));
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('MENU.DASHBOARD'), routerLink: '/dashboard' },
      { label: this.translate.instant('BANKING_OVERVIEW.TITLE'), routerLink: '/account/banking-overview' },
      { label: this.accountName() || '—', routerLink: `/account/banking-overview/transactions/${this.accountId()}` },
      { label: this.translate.instant('BANKING_OVERVIEW.LIST.RECONCILIATIONS') },
    ];
  });

  /** Mirrors the legacy `disableInitiateReconcile()`. */
  initiateDisabled = computed<boolean>(() => {
    if (this.currentPage() !== 1) return true;
    const p = this.latestPeriod();
    if (!p) return false;
    if (p.status === 'in-progress') return true;
    const now = Date.now();
    const from = p.from ? new Date(p.from).getTime() : NaN;
    const to   = p.to   ? new Date(p.to).getTime()   : NaN;
    if (!Number.isNaN(from) && !Number.isNaN(to) && now >= from && now <= to) return true;
    return false;
  });

  columns: TableColumn<ReconciliationListRow>[] = [];

  constructor() {
    withTranslations('settings/banking-overview');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.i18nTick.update(n => n + 1); this.initColumns(); });
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.i18nTick.update(n => n + 1); this.initColumns(); });
  }

  async ngOnInit(): Promise<void> {
    this.initColumns();
    this.accountId.set(this.route.snapshot.paramMap.get('accountId') || '');
    await Promise.all([this.loadAccountName(), this.loadBranches()]);
  }

  private initColumns(): void {
    const t = (key: string) => this.translate.instant(key);
    this.columns = [
      { key: 'reconciledAt',   label: t('BANKING_OVERVIEW.RECONCILIATIONS.RECONCILED_DATE'), customTemplate: true },
      { key: 'from',           label: t('BANKING_OVERVIEW.RECONCILIATIONS.PERIOD'),           customTemplate: true, sortable: true },
      { key: 'closingBalance', label: t('BANKING_OVERVIEW.RECONCILIATIONS.CLOSING_BALANCE'),  customTemplate: true, align: 'right' },
      { key: 'status',         label: t('BANKING_OVERVIEW.RECONCILIATIONS.STATUS'),           customTemplate: true },
    ];
  }

  private async loadAccountName(): Promise<void> {
    try {
      this.accountName.set(await this.service.getAccountName(this.accountId()));
    } catch (e) {
      console.error('[banking-overview] loadAccountName failed', e);
    }
  }

  private async loadBranches(): Promise<void> {
    try {
      const res = await this.branchSvc.getList({ limit: 200 });
      this.branches.set(res.list.map(b => ({ id: b.id, name: b.name })));
    } catch (e) {
      console.error('[banking-overview] loadBranches failed', e);
    }
  }

  onStatusChange(v: StatusFilter): void {
    this.statusFilter.set(v);
    this.listPage?.refresh();
  }

  onBranchChange(options: BranchOption | BranchOption[] | null): void {
    const list = Array.isArray(options) ? options : (options ? [options] : []);
    this.selectedBranchIds.set(list.map(b => b.id));
    this.listPage?.refresh();
  }

  loadReconciliations = async (params: ListQueryParams): Promise<ListResponse<ReconciliationListRow>> => {
    this.currentPage.set(params.page);
    const res = await this.service.getReconciliationList({
      accountId:  this.accountId(),
      branches:   this.selectedBranchIds().length ? this.selectedBranchIds() : null,
      status:     this.statusFilter() || null,
      page:       params.page,
      limit:      params.limit,
      searchTerm: params.searchTerm || '',
    });
    // Only trust page-1, unfiltered results for the "most recent period"
    // check — matches the legacy screen's guard (`this.pageNum == 1`).
    if (params.page === 1 && !this.statusFilter() && !this.selectedBranchIds().length && !params.searchTerm) {
      this.latestPeriod.set(res.list[0] ?? null);
    }
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  rowMenuItems(row: ReconciliationListRow): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (row.status !== 'reconciled') {
      items.push({ label: this.translate.instant('COMMON.EDIT'), click: () => this.edit(row) });
    }
    if (row.status === 'reconciled' && this.isMostRecent(row)) {
      items.push({ label: this.translate.instant('BANKING_OVERVIEW.RECONCILIATIONS.UNDO'), click: () => void this.undo(row) });
    }
    items.push({ label: this.translate.instant('COMMON.DELETE'), danger: true, click: () => void this.confirmDelete(row) });
    return items;
  }

  private isMostRecent(row: ReconciliationListRow): boolean {
    return this.currentPage() === 1 && this.latestPeriod()?.id === row.id;
  }

  edit(row: ReconciliationListRow): void {
    void this.router.navigate(['/account/banking-overview/reconciliations', this.accountId(), 'form', row.id]);
  }

  view(row: ReconciliationListRow): void {
    this.edit(row);
  }

  initiate(): void {
    void this.router.navigate(['/account/banking-overview/reconciliations', this.accountId(), 'form', '0']);
  }

  private async undo(row: ReconciliationListRow): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title:   this.translate.instant('MESSAGE.CONFIRM_WARNING'),
          message: '',
          confirm: this.translate.instant('MESSAGE.YES'),
        },
      },
    );
    if (!(await ref.afterClosed())) return;
    try {
      const ok = await this.service.undo(row.id);
      if (ok) {
        this.toast.success('MESSAGE.SUCCESSFULLY_UNDO');
        this.listPage?.refresh();
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  private async confirmDelete(row: ReconciliationListRow): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title:   this.translate.instant('BANKING_OVERVIEW.RECONCILIATIONS.DELETE_TITLE'),
          message: this.translate.instant('BANKING_OVERVIEW.RECONCILIATIONS.DELETE_MESSAGE'),
          confirm: this.translate.instant('COMMON.DELETE'),
          danger:  true,
        },
        closeOnBackdrop: false,
      },
    );
    if (!(await ref.afterClosed())) return;
    try {
      const ok = await this.service.delete(row.id);
      if (ok) {
        this.toast.success('COMMON.DELETED_OK');
        this.listPage?.refresh();
      } else {
        this.toast.error('COMMON.DELETE_FAILED');
      }
    } catch (e: any) {
      this.toast.error('COMMON.DELETE_FAILED', e?.message);
    }
  }
}
