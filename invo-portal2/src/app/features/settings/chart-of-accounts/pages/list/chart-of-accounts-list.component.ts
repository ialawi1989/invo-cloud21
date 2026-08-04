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
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import {
  ListRowActionsDirective,
  ListCellTemplateDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import type {
  TableColumn,
  FilterConfig,
  ActionConfig,
  BulkActionConfig,
  ListQueryParams,
  ListResponse,
} from '@shared/components/list-page/interfaces/list-page.types';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { AccountService } from '../../services/account.service';
import { Account } from '../../services/account.types';
import { ACCOUNT_PARENT_TYPES, accountTypeKey, findAccountType } from '../../utils/account-types';
import {
  AccountsBulkEditModalComponent,
  AccountsBulkEditData,
  AccountsBulkEditResult,
} from './components/accounts-bulk-edit-modal.component';

type ViewMode = 'table' | 'tree';

/** Tree node — accounts grouped first by parent-type then by type
 *  (matches the legacy 3-level tree). Children carry the actual
 *  records; the leading bucket levels are pure UI containers. */
interface TreeNode {
  /** Stable key for the @for track expression. */
  id:       string;
  label:    string;
  /** Optional source row for leaf nodes (the actual Account). */
  account?: Account;
  /** Account count rendered as a small chip on the right. */
  count:    number;
  /** Nested children — empty for leaves. */
  children: TreeNode[];
}

/**
 * Chart of Accounts list — paginated GL-account browser. Uses the
 * shared `<app-list-page>` for the table view so column-customisation
 * and any future bulk-actions inherit automatically (matches the
 * products list).
 *
 * A "Tree view" toggle in the header swaps the table for a grouped
 * `parentType → type → account` hierarchy, mirroring the legacy
 * `viewType=tree` mode. Switching modes preserves the search term.
 */
@Component({
  selector: 'app-chart-of-accounts-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    ListPageComponent,
    ListRowActionsDirective,
    ListCellTemplateDirective,
    DropdownMenuBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chart-of-accounts-list.component.html',
  styleUrl:    './chart-of-accounts-list.component.scss',
})
export class ChartOfAccountsListComponent implements OnInit {
  private service    = inject(AccountService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);

  /** Direct handle to the embedded list-page so we can flip its
   *  page size on tree-mode entry (and restore it on exit). */
  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  /** Page size to restore when the user leaves tree mode. Snapshotted
   *  the moment they switch INTO tree so any value they had picked
   *  in the page-size dropdown is preserved. */
  private tablePageSize = signal<number>(25);
  /** Page size used while the tree view is active. Large enough to
   *  cover every realistic chart-of-accounts dataset; the legacy
   *  used a similar "fetch everything" pattern for its tree mode. */
  private readonly TREE_PAGE_SIZE = 999;

  /** Active view — table is the default; tree is a single click
   *  away via the list-page's view-mode toggle. Kept in sync with
   *  the list-page's internal signal via `onListPageViewModeChange`. */
  viewMode = signal<ViewMode>('table');

  /** Extra view-mode buttons surfaced inside `<app-list-page>`'s
   *  built-in toggle. Just one entry for now ("Tree"); the
   *  list-page renders an icon button next to Table/Grid and
   *  emits the id back via `(viewModeChange)`. */
  readonly extraViewModes = [
    {
      id:       'tree',
      labelKey: 'CHART_OF_ACCOUNTS.LIST.VIEW_TREE',
      // Hierarchy / "list-tree" glyph: a trunk branching to indented rows.
      iconPath: 'M21 12h-8 M21 6h-8 M21 18h-8 M3 6v4c0 1.1 .9 2 2 2h3 M3 10v6c0 1.1 .9 2 2 2h3',
    },
  ];

  onListPageViewModeChange(mode: string): void {
    const isTree    = mode === 'tree';
    const wasTree   = this.viewMode() === 'tree';
    this.viewMode.set(isTree ? 'tree' : 'table');

    if (!this.listPage) return;

    if (isTree) {
      // Entering tree — snapshot the current page size if we're
      // coming from table/grid (don't overwrite the snapshot if
      // the user is clicking Tree while already in Tree), then
      // bump to a "fetch everything" size so the tree shows the
      // full filtered dataset. `setPageSize` always calls
      // `loadData`, so this is the recall the user is after.
      if (!wasTree) this.tablePageSize.set(this.listPage.pageSize());
      this.listPage.setPageSize(this.TREE_PAGE_SIZE);
    } else {
      // Going to table or grid — always recall with the previously
      // snapshotted size so the user gets a paginated dataset
      // again. Fires whether coming from tree, or switching
      // between table and grid.
      this.listPage.setPageSize(this.tablePageSize());
    }
  }

  /** Tree-view state. Built from the same data the list-page table
   *  fetched, so the tree honours whatever filters/search the user
   *  has applied without making a separate request. */
  treeRoots   = signal<TreeNode[]>([]);
  treeLoading = signal<boolean>(false);
  /** Latest rows the list-page asked us to load. Cached here so
   *  switching to tree mode doesn't refetch and the tree reflects
   *  the active filters. */
  private cachedRows = signal<Account[]>([]);
  /** Set of expanded node ids. Default to all parent-type buckets
   *  expanded so users see the hierarchy at a glance. */
  expandedIds = signal<Set<string>>(new Set(ACCOUNT_PARENT_TYPES));

  // ─── list-page config ──────────────────────────────────────────
  columns: TableColumn<Account>[] = [];
  filters: FilterConfig[]         = [];
  headerActions: ActionConfig[]   = [];
  bulkActions: BulkActionConfig[] = [];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 25 };
  searchConfig     = { enabled: true, placeholder: '', debounceMs: 350 };
  sortingConfig    = { enabled: true, defaultSort: { key: 'name', direction: 'asc' as const } };
  emptyState       = { title: '', message: '' };

  // ─── breadcrumbs (used by `<app-list-page>`) ──────────────────
  breadcrumbs: { label: string; routerLink?: string }[] = [];

  /** Items shown in the per-row `…` overflow menu. Edit is
   *  intentionally NOT in here — the inline pill next to the
   *  trigger already exposes that action, so the dropdown is
   *  reserved for less-frequent / destructive operations. */
  rowMenuItems(row: Account): DropdownMenuBtnItem[] {
    const items: DropdownMenuBtnItem[] = [];
    if (!row.default) {
      items.push({
        label:  'COMMON.DELETE',
        danger: true,
        click:  () => void this.confirmDelete(row),
      });
    }
    return items;
  }
  /** Hide the `…` trigger entirely when the menu has no items
   *  (default rows have nothing actionable in the dropdown). */
  hasRowMenu = (row: Account): boolean => this.rowMenuItems(row).length > 0;

  /** Translate an account-type / parent-type wire value, falling back to the
   *  raw string for any legacy value not in the map. */
  typeLabel = (value: string | null | undefined): string => {
    if (!value) return '—';
    const key = accountTypeKey(value);
    const label = this.translate.instant(key);
    return label && label !== key ? label : value;
  };

  constructor() {
    withTranslations('settings/chart-of-accounts');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.initializeTranslations());
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.initializeTranslations());
  }

  ngOnInit(): void {
    this.initializeTranslations();
  }

  /** Build column/filter/search labels every time the translation
   *  bundle finishes loading. Mirrors the pattern in the products
   *  list — `<app-list-page>` reads these as plain Inputs so we
   *  must reassign the references when translations change. */
  private initializeTranslations(): void {
    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(key, params);

    this.breadcrumbs = [
      { label: t('SETTINGS.TITLE'),                routerLink: '/settings' },
      { label: t('CHART_OF_ACCOUNTS.LIST.TITLE') },
    ];

    this.columns = [
      {
        key:        'name',
        label:      t('CHART_OF_ACCOUNTS.LIST.NAME'),
        sortable:   true,
        width:      '260px',
        locked:     true,
        primary:    true,
        interactive: true,
        visible:    true,
        order:      0,
      },
      {
        key:            'type',
        label:          t('CHART_OF_ACCOUNTS.LIST.TYPE'),
        sortable:       true,
        customTemplate: true,
        visible:        true,
        order:          1,
      },
      {
        key:            'parentType',
        label:          t('CHART_OF_ACCOUNTS.LIST.PARENT_TYPE'),
        sortable:       true,
        customTemplate: true,
        visible:        true,
        order:          2,
      },
      {
        key:        'code',
        label:      t('CHART_OF_ACCOUNTS.LIST.CODE'),
        sortable:   true,
        width:      '120px',
        visible:    true,
        order:      3,
      },
      {
        key:        'description',
        label:      t('CHART_OF_ACCOUNTS.LIST.DESCRIPTION'),
        sortable:   false,
        visible:    false,
        order:      4,
      },
    ];

    this.filters = [
      {
        key:     'parentType',
        label:   t('CHART_OF_ACCOUNTS.LIST.PARENT_TYPE'),
        type:    'checkbox-group',
        options: ACCOUNT_PARENT_TYPES.map(p => ({ value: p, label: this.typeLabel(p) })),
      },
    ];

    this.bulkActions = [
      {
        id:      'bulk-edit',
        label:   t('CHART_OF_ACCOUNTS.BULK.ACTION'),
        icon:    'edit',
        color:   'primary',
        handler: (rows) => this.bulkEdit(rows as Account[]),
      },
    ];

    this.searchConfig = {
      ...this.searchConfig,
      placeholder: t('CHART_OF_ACCOUNTS.LIST.SEARCH_PLACEHOLDER'),
    };
    this.emptyState = {
      title:   t('CHART_OF_ACCOUNTS.LIST.EMPTY'),
      message: '',
    };
  }

  /** list-page dataSource. Wraps the service call so the table can
   *  drive pagination/sort/search/filter from one source. */
  loadAccounts = async (params: ListQueryParams): Promise<ListResponse<Account>> => {
    const filter = params.filter || {};
    const parentType = Array.isArray(filter['parentType'])
      ? (filter['parentType'] as string[])
      : (filter['parentType'] ? [String(filter['parentType'])] : []);

    const res = await this.service.getList({
      page:       params.page,
      limit:      params.limit,
      searchTerm: params.searchTerm || '',
      sortBy:     params.sortBy,
      parentType,
      columns:    params.columns,
    });
    // Cache the rows so tree-view can reuse the same filtered data
    // without making its own request. Rebuild the tree on every
    // fetch so the bucketed view stays in sync when the user
    // changes the filter from the table side.
    this.cachedRows.set(res.list);
    this.treeRoots.set(this.buildTree(res.list));
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  // ─── tree view ────────────────────────────────────────────────
  /** Group flat rows into `parentType → type → account`. Empty
   *  buckets are dropped so the tree only shows surfaces with
   *  real accounts. */
  private buildTree(rows: Account[]): TreeNode[] {
    const byParent = new Map<string, Map<string, Account[]>>();
    for (const row of rows) {
      const pt = row.parentType || row.type || 'Other';
      const t  = row.type || pt;
      let byType = byParent.get(pt);
      if (!byType) { byType = new Map(); byParent.set(pt, byType); }
      let accs = byType.get(t);
      if (!accs) { accs = []; byType.set(t, accs); }
      accs.push(row);
    }

    // Preserve the registry order for parent types; types/accounts
    // sort alphabetically for predictability.
    const out: TreeNode[] = [];
    for (const pt of ACCOUNT_PARENT_TYPES) {
      const byType = byParent.get(pt);
      if (!byType) continue;
      const typeNodes: TreeNode[] = [];
      let ptCount = 0;
      for (const [type, accs] of [...byType.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        accs.sort((a, b) => a.name.localeCompare(b.name));
        typeNodes.push({
          id:       `pt:${pt}/t:${type}`,
          label:    this.typeLabel(type),
          count:    accs.length,
          children: accs.map(a => ({
            id:       `acc:${a.id}`,
            label:    a.name,
            account:  a,
            count:    0,
            children: [],
          })),
        });
        ptCount += accs.length;
      }
      out.push({
        id:       `pt:${pt}`,
        label:    this.typeLabel(pt),
        count:    ptCount,
        children: typeNodes,
      });
    }
    return out;
  }

  toggleNode(id: string, ev?: Event): void {
    ev?.stopPropagation();
    this.expandedIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  isExpanded = (id: string): boolean => this.expandedIds().has(id);

  // ─── Row actions ──────────────────────────────────────────────
  edit(row: Account): void {
    void this.router.navigate(['/account/chart-of-accounts', row.id || 'new']);
  }

  add(): void {
    void this.router.navigate(['/account/chart-of-accounts', 'new']);
  }

  /** Bulk edit shared fields (Type + Parent type, Parent account) across the
   *  selected rows via the modal, then persist each record and refresh. */
  private async bulkEdit(rows: Account[]): Promise<void> {
    if (!rows?.length) return;
    const types = new Set(rows.map(r => r.type).filter(Boolean));
    const commonType = types.size === 1 ? [...types][0] : null;

    const ref = this.modal.open<AccountsBulkEditModalComponent, AccountsBulkEditData, AccountsBulkEditResult>(
      AccountsBulkEditModalComponent,
      { size: 'md', closeOnBackdrop: false, data: { count: rows.length, commonType } },
    );
    const result = await ref.afterClosed();
    if (!result || (result.type == null && result.parentId == null)) return;

    try {
      for (const row of rows) {
        const updated: Account = { ...row };
        if (result.type != null) {
          updated.type       = result.type;
          updated.parentType = findAccountType(result.type)?.parentType ?? result.type;
        }
        if (result.parentId != null) updated.parentId = result.parentId;

        const saved = await this.service.save(updated);
        if (!saved) { this.toast.error('COMMON.SAVE_FAILED'); return; }
      }
      this.toast.success('CHART_OF_ACCOUNTS.BULK.SAVED');
      this.listPage?.refresh();
    } catch (e: any) {
      console.error('[chart-of-accounts] bulk edit failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  onRowClick(event: { row: Account }): void {
    this.edit(event.row);
  }

  private async confirmDelete(row: Account): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title:   this.translate.instant('CHART_OF_ACCOUNTS.LIST.DELETE_TITLE'),
          message: this.translate.instant('CHART_OF_ACCOUNTS.LIST.DELETE_MESSAGE', { name: row.name || '—' }),
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
        // Optimistic refresh — drop the row from the cached
        // dataset so the tree (which reuses the same cache)
        // updates immediately. The table will refetch on next
        // load. The user can manually hit Refresh to pull fresh
        // server state.
        const next = this.cachedRows().filter(r => r.id !== row.id);
        this.cachedRows.set(next);
        this.treeRoots.set(this.buildTree(next));
      } else {
        this.toast.error('COMMON.DELETE_FAILED');
      }
    } catch (err: any) {
      this.toast.error('COMMON.DELETE_FAILED', err?.message);
    }
  }
}
