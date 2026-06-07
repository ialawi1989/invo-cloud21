import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  signal,
  computed,
  effect,
  ContentChildren,
  QueryList,
  TemplateRef,
  ElementRef,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, catchError, of, tap, from, isObservable } from 'rxjs';

// Interfaces
import {
  TableColumn,
  ListQueryParams,
  ListResponse,
  FilterConfig,
  ActionConfig,
  BulkActionConfig,
  PaginationConfig,
  SearchConfig,
  SortingConfig,
  EmptyStateConfig,
  FilterState,
  ListPageState,
  RowClickEvent,
  ActionClickEvent,
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  PageChangeEvent
} from '../interfaces/list-page.types';

// Directives
import {
  ListCellTemplateDirective,
  ListHeaderTemplateDirective,
  ListRowActionsDirective
} from '../directives/list-template.directives';

// FilterModal - MUST be relative import from same folder
import { FilterModalComponent, FilterModalData, FilterModalResult } from './filter-modal.component';
import { ModalService } from '../../../modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '../../../modal/demo/confirm-modal.component';
import { CustomizeColumnsModalComponent, CustomizeColumnsData } from './customize-columns-modal.component';
import { PaginationComponent } from '../../pagination';
import { BreadcrumbsComponent, BreadcrumbItem } from '../../breadcrumbs';
import { ListPreferencesService } from '../../../../core/layout/services/list-preferences.service';
import { ListColumnPref } from '../../../../core/layout/services/employee-options.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';

// Utilities
import {
  ListUrlStateHelper,
  ColumnHelper,
  FilterHelper,
  SelectionHelper,
  HighlightHelper
} from '../utils/list-helpers';

/**
 * Reusable List Page Component
 *
 * A comprehensive, configurable component for displaying lists with:
 * - Search, filters, sorting, pagination
 * - Bulk actions and row selection
 * - Custom cell templates
 * - URL state synchronization
 * - Mobile responsive (auto-switches to cards)
 * - Integration with existing components and services
 *
 * @example
 * <app-list-page
 *   [columns]="columns"
 *   [dataSource]="loadData"
 *   [pagination]="{ enabled: true }"
 *   [search]="{ enabled: true }">
 * </app-list-page>
 */
@Component({
  selector: 'app-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    FilterModalComponent,
    PaginationComponent,
    BreadcrumbsComponent,
    TranslateModule,
    TooltipDirective
  ],
  templateUrl: './list-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    /* ── Sticky columns (checkbox + primary on the start edge, actions
       on the end edge) ─────────────────────────────────────────────────
       Keep the sticky cells opaque so rows underneath don't bleed through
       when the user scrolls horizontally, and match the row hover colour
       so the sticky cells don't look out of place on hover. */
    .list-sticky-cell {
      background-color: #ffffff;
      transition: background-color 150ms ease;
    }
    tr.list-row:hover .list-sticky-cell { background-color: #f4fbfb; }
    tr.list-row-expanded .list-sticky-cell { background-color: #ecfafd; }

    /* Drop shadow on the right edge of the last start-side sticky column
       so horizontally-scrolled content visibly tucks underneath. Gated on
       the .list-has-scroll-start parent class (set by the scroll-affordance
       state) so the shadow only appears when there's actually content
       scrolled behind the sticky column - matches the Wix table pattern. */
    /* Right-edge fade on the frozen start (Post) column. Painted INSIDE the
       cell via ::after so no overflow:hidden ancestor can clip it, and it
       sits above the scrolling cells because the sticky cell is a z-indexed
       positioning context. Revealed only once the table is scrolled. */
    .list-sticky-col::after {
      content: "";
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 16px;
      transform: translateX(100%);
      /* Drop shadow CAST BY the frozen column onto the scrolling content:
         darkest at the column edge, fading to transparent (dark stop first). */
      background: linear-gradient(to right, rgba(15, 23, 42, 0.10), rgba(15, 23, 42, 0));
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 3;
    }
    .list-has-scroll-start .list-sticky-col::after { opacity: 1; }
    :host-context([dir="rtl"]) .list-sticky-col::after {
      right: auto;
      left: 0;
      transform: translateX(-100%);
      background: linear-gradient(to left, rgba(15, 23, 42, 0.10), rgba(15, 23, 42, 0));
    }

    /* Pinned Actions column — SOLID white so content scrolls cleanly under
       it (no left-edge fade/shadow). The header cell keeps the teal tint. */
    .list-floating-actions { background: #ffffff; }
    tr.list-row:hover .list-floating-actions { background-color: #f4fbfb; }

    /* ── Themed table (thead + tbody) ───────────────────────────────────
       Soft teal header, roomy cells, subtle dividers, teal accent. Applies
       to every list page since the table lives in this shared component. */
    .list-page-container thead th {
      background: #d6f0f1 !important;
      color: #4a5163 !important;
      font-size: 14px;
      font-weight: 600;
      padding: 13px 18px !important;
      white-space: nowrap;
      border-bottom: 0 !important;
    }
    /* Body cells. --row-pad-y tunes vertical density in one place. */
    .list-page-container { --row-pad-y: 12px; }
    .list-page-container tbody td {
      padding: var(--row-pad-y, 12px) 18px !important;
      font-size: 14px;
      color: #4a5163;
      white-space: nowrap;
    }
    /* Subtle row dividers (recolour the Tailwind divide-y borders) */
    .list-page-container tbody tr { border-top-color: #e6e8ee !important; }
    /* Row hover (override Tailwind hover:bg-slate-50) */
    .list-page-container tbody tr.list-row:hover { background-color: #f4fbfb !important; }
    /* Teal accent — checkboxes + link-styled values */
    .list-page-container input[type="checkbox"] { accent-color: #00aab3; }
    .list-page-container .list-interactive-cell { color: #00aab3; }

    /* Card container — clean rounded corners (clip the inner square-cornered
       scroll area) + a soft, layered slate shadow tuned for the near-white
       (#f8fafc) page background. */
    .list-card {
      border-radius: 14px !important;
      overflow: hidden;
      border-color: #eef1f5 !important;
      box-shadow:
        0 1px 2px rgba(15, 23, 42, 0.04),
        0 4px 12px rgba(15, 23, 42, 0.06),
        0 12px 32px rgba(15, 23, 42, 0.05) !important;
    }

    /* Force the table to its natural (nowrap) width so it overflows the
       scroll container when there are many columns — without this the
       w-full table just shrinks to fit and the sticky-column shadows
       never trigger (scrollWidth === clientWidth). */
    .list-page-container table { min-width: max-content; }

    /* Lock the frozen columns to a constant width (min = max) so they can't
       reflow narrower/wider during horizontal scroll — keeps the Post
       column's right divider (and its shadow) in a fixed position. The
       checkbox column's width matches the Post column's left: 3rem offset. */
    .list-page-container th.start-0,
    .list-page-container td.start-0 {
      width: 48px; min-width: 48px; max-width: 48px;
      padding-left: 16px !important; padding-right: 0 !important;
    }
    .list-page-container th.list-sticky-col,
    .list-page-container td.list-sticky-col {
      width: 300px; min-width: 300px; max-width: 300px;
    }
    .list-page-container td.list-floating-actions,
    .list-page-container th.list-actions-th {
      width: 184px; min-width: 184px; max-width: 184px;
    }
  `]
})
export class ListPageComponent<T = any> implements OnInit, OnDestroy {
  // ══════════════════════════════════════════════════════════════
  // INJECTED SERVICES
  // ══════════════════════════════════════════════════════════════
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private modalService = inject(ModalService);
  private listPrefs = inject(ListPreferencesService);

  protected readonly Math = Math;
  // Expose Object to template
  protected readonly Object = Object;
  // Note: These services should be injected from your existing project
  // private tableHelperService = inject(TableHelperService, { optional: true });
  // private tableColumnService = inject(TableColumnService, { optional: true });
  // private customFieldsService = inject(CustomFieldsService, { optional: true });
  // private permissionService = inject(PermissionService, { optional: true });

  // ══════════════════════════════════════════════════════════════
  // INPUTS - Configuration
  // ══════════════════════════════════════════════════════════════

  /** Table columns configuration */
  private _columns = signal<TableColumn<T>[]>([]);
  private _urlColumnsRestored = false;
  // undefined = not fetched yet, null = no saved prefs, array = saved prefs
  private _savedPrefs: ListColumnPref[] | null | undefined = undefined;
  private _initialLoadDispatched = false;
  @Input({ required: true })
  get columns(): TableColumn<T>[] { return this._columns(); }
  set columns(value: TableColumn<T>[]) {
    console.debug('[list-page] columns setter fired', {
      valueKeys: value.map(c => c.key),
      initialLoadDispatched: this._initialLoadDispatched,
      customFieldsLoaded: this._customFieldsLoaded,
      savedPrefsLength: this._savedPrefs?.length,
    });
    this._columns.set(value);
    // Only set default visible columns if URL state hasn't already set them
    if (value.length > 0 && !this._urlColumnsRestored) {
      this.visibleColumns.set(ColumnHelper.getColumnKeys(value));
    }
    // Columns may arrive after ngOnInit (parent populates them async) — try
    // to apply saved prefs + load data whenever columns become ready.
    this.tryApplyPrefsAndLoad();
  }

  /** Page title displayed in header */
  @Input() pageTitle = '';

  /** Page subtitle / description */
  @Input() pageSubtitle = '';

  /** Breadcrumb items */
  @Input() breadcrumbs: BreadcrumbItem[] = [];

  /** Data source function - returns observable of list response */
  @Input({ required: true }) dataSource!: (params: ListQueryParams) => any;

  /** Pagination configuration */
  @Input() pagination: PaginationConfig = { enabled: false };

  /** Search configuration */
  @Input() search: SearchConfig = { enabled: false };

  /** Sorting configuration */
  @Input() sorting: SortingConfig = { enabled: false };

  /** Filter configurations */
  @Input() filters: FilterConfig[] = [];

  /** Header action buttons (e.g., "New", "Import") */
  @Input() headerActions: ActionConfig[] = [];

  /** Bulk action configurations (e.g., "Delete Selected") */
  @Input() bulkActions: BulkActionConfig[] = [];

  /** Row action configurations (shown in each row) */
  @Input() rowActions: ActionConfig[] = [];

  /** Sync state to URL query parameters */
  @Input() syncToUrl = true;

  /**
   * Entity type (e.g. 'product', 'customer'). Used as the key for loading
   * custom fields AND for persisting column preferences (visibility + order)
   * into the employee options — when set, saved prefs are loaded on init and
   * re-saved whenever the customize-columns modal is applied.
   */
  @Input() entityType?: string;

  /**
   * Async function to load custom fields and merge them into columns.
   * Called before opening the customize columns modal.
   * Should return the updated columns array with custom fields appended.
   */
  @Input() loadCustomFieldsFn?: (columns: TableColumn<T>[]) => Promise<TableColumn<T>[]>;

  /** Permission mappings */
  @Input() permissions: Record<string, string> = {};

  /** Enable row selection with checkboxes */
  @Input() selectable = false;

  /** Hide the built-in Grid view toggle. Pages that don't have a
   *  card layout (e.g. Chart of Accounts) can pass `false` to
   *  drop the grid button from the view-mode toggle entirely. */
  @Input() showGridView = true;

  /** Additional view modes to surface alongside the built-in
   *  Table / Grid toggle. Each entry renders as an icon button in
   *  the toggle row. When the user picks one, the list-page hides
   *  its own table/grid bodies and emits `(viewModeChange)`; the
   *  parent renders custom content via the `[listCustomView]`
   *  projection slot. Example use: a "Tree" mode on the
   *  Chart-of-Accounts page. */
  @Input() extraViewModes: { id: string; labelKey?: string; iconPath?: string }[] = [];

  /** Fires whenever the active view mode changes — including the
   *  built-in 'table' / 'grid' modes. Useful for parents that need
   *  to load mode-specific data lazily. */
  @Output() viewModeChange = new EventEmitter<string>();

  /** Set of expanded row IDs (for parent-child rendering) */
  @Input() expandedRowIds: { (): Set<string> } = () => new Set();

  /** Key on each row that holds children array */
  @Input() childrenKey = 'children';

  /** Empty state configuration */
  @Input() emptyState: EmptyStateConfig = {
    title: 'No items found',
    message: 'Try adjusting your filters or search query'
  };

  /** Dynamic row CSS class */
  @Input() rowClass?: string | ((row: T) => string);

  /** ID field name for row selection */
  @Input() idField = 'id';

  /** Initial page size */
  @Input() initialPageSize = 25;

  /** Show loading spinner */
  @Input() loading = false;

  // ══════════════════════════════════════════════════════════════
  // OUTPUTS - Events
  // ══════════════════════════════════════════════════════════════

  @Output() rowClicked = new EventEmitter<RowClickEvent<T>>();
  @Output() actionClicked = new EventEmitter<ActionClickEvent>();
  @Output() selectionChanged = new EventEmitter<SelectionChangeEvent<T>>();
  @Output() sortChanged = new EventEmitter<SortChangeEvent>();
  @Output() filterChanged = new EventEmitter<FilterChangeEvent>();
  @Output() filterOpened = new EventEmitter<void>();

  /** Optional async function to call before opening filter modal (e.g. to load filter options) */
  @Input() beforeFilterOpen?: () => Promise<void>;
  @Output() pageChanged = new EventEmitter<PageChangeEvent>();

  // ══════════════════════════════════════════════════════════════
  // CONTENT CHILDREN - Custom Templates
  // ══════════════════════════════════════════════════════════════

  @ContentChildren(ListCellTemplateDirective) cellTemplates!: QueryList<ListCellTemplateDirective>;
  @ContentChildren(ListHeaderTemplateDirective) headerTemplates!: QueryList<ListHeaderTemplateDirective>;
  @ContentChildren(ListRowActionsDirective) rowActionsTemplates!: QueryList<ListRowActionsDirective>;

  // ══════════════════════════════════════════════════════════════
  // STATE SIGNALS
  // ══════════════════════════════════════════════════════════════

  // Data
  data = signal<T[]>([]);
  totalCount = signal<number>(0);
  pageCount = signal<number>(1);

  // UI State
  isLoading = signal(false);
  viewMode = signal<string>('table');
  isMobile = signal(false);
  showFilters = signal(false);
  showFilterModal = signal(false);

  /** Horizontal-scroll affordance flag — true once the table is scrolled
   *  right, so the frozen start (Post) column can cast its right-edge
   *  shadow over the content tucked behind it. */
  hasScrollStart = signal<boolean>(false);

  /** ViewChild reference to the horizontally-scrolling table
   *  container — used by the data-change effect to recompute the
   *  scroll-affordance state when rows are added/removed and on
   *  window resize. */
  @ViewChild('scrollHost') scrollHost?: ElementRef<HTMLElement>;

  /** Recompute the scroll-affordance flags from a scroll container
   *  element. RTL flips `scrollLeft`'s polarity in some browsers,
   *  so we use Math.abs to keep the logic direction-agnostic. */
  updateScrollState(el: HTMLElement | EventTarget | null): void {
    const node = el as HTMLElement | null;
    if (!node) return;
    const left = Math.abs(node.scrollLeft);
    // 1px slack so floating-point rounding doesn't flicker the shadow.
    this.hasScrollStart.set(left > 1);
  }

  /** Recompute on resize — column widths can change when the
   *  viewport grows/shrinks, which flips whether the table needs
   *  horizontal scrolling at all. */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.scrollHost) this.updateScrollState(this.scrollHost.nativeElement);
  }

  // List State
  currentPage = signal(1);
  pageSize = signal(this.initialPageSize);
  /** Committed search term — the value the data source filters by.
   *  Only changes when the user submits (Enter or magnifier click);
   *  typing in the input updates `searchDraft` locally instead. */
  searchTerm = signal('');
  /** Local typing buffer for the search input. Nothing fires until
   *  the user commits via `submitSearch()`, which mirrors the rest
   *  of the app's submit-on-action search UX. */
  searchDraft = signal('');
  sortBy = signal<{ sortValue: string; sortDirection: 'asc' | 'desc' } | undefined>(undefined);
  activeFilters = signal<FilterState>({});
  filterLabels = signal<Record<string, string>>({});
  selectedRows = signal<T[]>([]);
  expandedRows = signal<Set<string>>(new Set());
  visibleColumns = signal<string[]>([]);

  // ══════════════════════════════════════════════════════════════
  // COMPUTED SIGNALS
  // ══════════════════════════════════════════════════════════════

  /**
   * Visible columns, with columns sharing the same `label` collapsed into a
   * single "leader" column that carries its siblings on `groupedItems`. The
   * table template renders the leader as one cell and stacks sibling values
   * inside it according to each sibling's `displayStyle`.
   */
  displayColumns = computed(() => {
    const allCols = this._columns();
    const visible = this.visibleColumns();
    const filtered = visible.length > 0
      ? allCols.filter(col => col.visible !== false && visible.includes(col.key))
      : ColumnHelper.getVisibleColumns(allCols);

    // Group by label. A label shared by multiple columns → one cell.
    const groups = new Map<string, TableColumn<T>[]>();
    for (const col of filtered) {
      const existing = groups.get(col.label);
      if (existing) existing.push(col);
      else groups.set(col.label, [col]);
    }

    const result: TableColumn<T>[] = [];
    groups.forEach(items => {
      if (items.length === 1) {
        result.push(items[0]);
      } else {
        items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        // Split into layout rows. First item always starts a row. Subsequent
        // items join the current row if their displayStyle is 'inline',
        // otherwise they start a new row.
        const rows: TableColumn<T>[][] = [];
        let current: TableColumn<T>[] = [];
        items.forEach((item, idx) => {
          if (idx === 0 || item.displayStyle !== 'inline') {
            if (current.length) rows.push(current);
            current = [item];
          } else {
            current.push(item);
          }
        });
        if (current.length) rows.push(current);

        // Leader keeps its own key/customTemplate/etc.; siblings live on `groupedItems`.
        result.push({ ...items[0], groupedItems: items, groupedRows: rows });
      }
    });
    result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return result;
  });

  /** Check if any filters are active */
  hasActiveFilters = computed(() =>
    FilterHelper.hasActiveFilters(this.activeFilters())
  );

  /** Count of active filters */
  activeFilterCount = computed(() =>
    FilterHelper.countActiveFilters(this.activeFilters())
  );

  /** Check if all visible rows are selected */
  allSelected = computed(() =>
    SelectionHelper.allSelected(this.data(), this.selectedRows(), this.idField)
  );

  /** Check if some (but not all) rows are selected */
  someSelected = computed(() =>
    SelectionHelper.someSelected(this.data(), this.selectedRows(), this.idField)
  );

  /** Enabled header actions (based on permissions) */
  enabledHeaderActions = computed(() =>
    this.headerActions.filter(action => this.hasPermission(action.permission))
  );

  /** Enabled bulk actions (based on permissions and selection) */
  enabledBulkActions = computed(() => {
    const hasSelection = this.selectedRows().length > 0;
    return this.bulkActions.filter(action =>
      this.hasPermission(action.permission) &&
      (!action.requiresSelection || hasSelection)
    );
  });

  /** Get custom cell template for column */
  getCellTemplate = computed(() => {
    const templates = this.cellTemplates?.toArray() || [];
    return (key: string) => {
      return templates.find(t => t.columnKey === key)?.template;
    };
  });


  /** Get custom header template */
  getHeaderTemplate = computed(() => (): TemplateRef<any> | undefined => {
    return this.headerTemplates?.first?.template;
  });

  /** Get custom row actions template */
  getRowActionsTemplate = computed(() => {
    const template = this.rowActionsTemplates?.first;  // ✅ Use .first
    return template?.template;
  });

  // ══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ══════════════════════════════════════════════════════════════

  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();
  private subscriptions = new Subscription();
  private dataSubscription?: Subscription;

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ══════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.initializeState();
    this.setupSearchDebounce();
    this.setupViewportDetection();

    // Kick off the prefs fetch. It may resolve before or after the parent
    // populates `columns` — `tryApplyPrefsAndLoad` handles both orderings and
    // fires the initial data load exactly once, after both are ready.
    // Note: we load prefs even when the URL restored columns, because the URL
    // only carries *keys* — for custom fields the column definition itself is
    // lazy, so we still need prefs to drive eager-loading via
    // `ensureCustomFieldsForPrefs`. If URL columns disagree with prefs, prefs
    // win (they are the canonical persisted state).
    if (this.entityType) {
      this.listPrefs.load(this.entityType).then(pref => {
        this._savedPrefs = pref?.columns ?? null;
        this.tryApplyPrefsAndLoad();
      });
    } else {
      this._savedPrefs = null;
    }
    this.tryApplyPrefsAndLoad();
  }

  /**
   * Fire the initial data load once columns are populated AND saved prefs
   * have been fetched (or we know there are none). Applies saved prefs to
   * the current column set before dispatching the load so `getProductList`
   * is called with the persisted visibility/order.
   */
  private async tryApplyPrefsAndLoad(): Promise<void> {
    if (this._initialLoadDispatched) return;
    if (this._savedPrefs === undefined) return;   // prefs still loading
    if (this._columns().length === 0) return;    // columns not yet populated
    this._initialLoadDispatched = true;

    console.debug('[list-page] tryApplyPrefsAndLoad', {
      entityType: this.entityType,
      savedPrefsKeys: this._savedPrefs?.map(p => p.key),
      currentColumnKeys: this._columns().map(c => c.key),
    });

    if (this._savedPrefs && this._savedPrefs.length > 0) {
      await this.ensureCustomFieldsForPrefs(this._savedPrefs);
      this.applyColumnPrefs(this._savedPrefs);
    }
    this.loadInitialData();
  }

  /**
   * If saved prefs reference column keys we don't have locally (likely custom
   * fields which are loaded lazily), eager-load custom fields now so the
   * table renders in the saved configuration on first paint.
   */
  private async ensureCustomFieldsForPrefs(prefs: ListColumnPref[]): Promise<void> {
    if (!this.loadCustomFieldsFn || this._customFieldsLoaded) return;
    const knownKeys = new Set(this._columns().map(c => c.key));
    const unknownKeys = prefs.filter(p => !knownKeys.has(p.key)).map(p => p.key);
    if (unknownKeys.length === 0) return;

    console.debug('[list-page] eager-loading custom fields for prefs', { unknownKeys });
    try {
      const merged = await this.loadCustomFieldsFn([...this._columns()]);
      this._columns.set(merged);
      this._customFieldsLoaded = true;
      console.debug('[list-page] custom fields loaded', {
        mergedKeys: merged.map(c => c.key),
      });
    } catch (e) {
      console.error('[list-page] failed to eager-load custom fields', e);
    }
  }

  /**
   * Merge saved column prefs (visibility + order) into the current columns.
   * Locked columns always stay visible — only their order can be overridden.
   */
  private applyColumnPrefs(prefs: ListColumnPref[]): void {
    const current = this._columns();
    if (current.length === 0) return;
    const prefMap = new Map(prefs.map(p => [p.key, p]));
    const cols = current.map(col => {
      const p = prefMap.get(col.key);
      if (!p) return col;
      if (col.locked) return {
        ...col,
        order: p.order ?? col.order,
        displayStyle: p.displayStyle ?? col.displayStyle,
      };
      return {
        ...col,
        visible: p.visible,
        order: p.order ?? col.order,
        displayStyle: p.displayStyle ?? col.displayStyle,
      };
    });
    cols.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this._columns.set(cols);
    this.visibleColumns.set(ColumnHelper.getColumnKeys(cols));
    console.debug('[list-page] applyColumnPrefs', {
      applied: cols.map(c => ({ key: c.key, visible: c.visible, order: c.order })),
      visibleColumns: ColumnHelper.getColumnKeys(cols),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.unsubscribe();
    this.dataSubscription?.unsubscribe();
  }

  // ══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ══════════════════════════════════════════════════════════════

  private initializeState(): void {
    // Initialize default page size
    if (this.pagination.enabled && this.pagination.default) {
      this.pageSize.set(this.pagination.default);
    }

    // Initialize default sort
    if (this.sorting.enabled && this.sorting.defaultSort) {
      this.sortBy.set({
        sortValue: this.sorting.defaultSort.key,
        sortDirection: this.sorting.defaultSort.direction
      });
    }

    // Initialize visible columns
    this.visibleColumns.set(ColumnHelper.getColumnKeys(this.columns));

    // Restore state from URL if enabled
    if (this.syncToUrl) {
      this.restoreStateFromUrl();
    }

    // Custom fields are loaded lazily when customize modal opens
  }

  private setupSearchDebounce(): void {
    // Intentionally a no-op now — search runs on submit (Enter or
    // magnifier click), not on keystrokes. Kept as a hook so the
    // ngOnInit call site still type-checks; remove this method
    // entirely once nothing else references the debounce subject.
  }

  private setupViewportDetection(): void {
    this.checkViewportSize();

    window.addEventListener('resize', () => this.checkViewportSize());
  }

  private checkViewportSize(): void {
    const wasMobile = this.isMobile();
    this.isMobile.set(window.innerWidth < 768);

    // Auto-switch to grid view on mobile
    if (this.isMobile()) {
      this.viewMode.set('grid');
    }

    // Reload data if mobile state changed
    if (wasMobile !== this.isMobile()) {
      // Optional: trigger re-render or adjust layout
    }
  }

  private async loadCustomFields(): Promise<void> {
    if (this.loadCustomFieldsFn && !this._customFieldsLoaded) {
      try {
        const merged = await this.loadCustomFieldsFn(this.columns);
        this.columns = merged;
        this._customFieldsLoaded = true;
      } catch (e) {
        console.error('Failed to load custom fields', e);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ══════════════════════════════════════════════════════════════

  private loadInitialData(): void {
    this.loadData();
  }

  /** Scope signature of the last `loadData` call — used to detect whether a
   *  reload is a pagination/sort (same scope, keep selection) or a
   *  filter/search change (new scope, drop stale selections). */
  private _lastScope: string | null = null;

  loadData(): void {
    if (!this.dataSource) {
      console.warn('ListPageComponent: No dataSource provided');
      return;
    }

    // Cancel previous request
    this.dataSubscription?.unsubscribe();

    this.isLoading.set(true);

    const params: ListQueryParams = {
      page: this.currentPage(),
      limit: this.pageSize(),
      searchTerm: this.searchTerm() || undefined,
      sortBy: this.sortBy(),
      filter: this.activeFilters(),
      // API columns array — strips UI-only keys (`noApi: true`) like
      // image thumbnails / derived totals so the backend's matcher
      // doesn't silently drop search hits against non-existent
      // fields. Tracking-side `visibleColumns()` still includes them
      // so the table renders them locally.
      columns: ColumnHelper.getApiColumnKeys(this.columns)
    };

    // "Scope" excludes page/limit/sort — those operate on the same dataset
    // and should preserve selection across reloads. Search + filters change
    // the dataset itself, so scope changes trigger selection pruning.
    const scope = JSON.stringify({
      searchTerm: params.searchTerm ?? '',
      filter: params.filter ?? {},
    });
    const scopeChanged = this._lastScope !== null && this._lastScope !== scope;
    this._lastScope = scope;

    const result = this.dataSource(params);
    const source$ = isObservable(result) ? result : from(Promise.resolve(result));

    this.dataSubscription = source$
      .pipe(
        tap((response: ListResponse<T>) => {
          this.data.set(response.list);
          this.pageCount.set(response.pageCount);
          if (response.count !== undefined) {
            this.totalCount.set(response.count);
          }
          if (scopeChanged) this.pruneSelection(response.list);
          this.isLoading.set(false);
          // Wait for the DOM to flush the new rows before measuring
          // scrollWidth — otherwise the end-edge fade flashes off
          // even when the new data overflows the viewport.
          requestAnimationFrame(() => {
            if (this.scrollHost) this.updateScrollState(this.scrollHost.nativeElement);
          });
        }),
        catchError(error => {
          console.error('ListPageComponent: Error loading data', error);
          this.isLoading.set(false);
          this.data.set([]);
          if (scopeChanged) this.pruneSelection([]);
          return of({ list: [], pageCount: 0 });
        })
      )
      .subscribe();
  }

  /**
   * Drop any selected row that isn't present in the freshly-loaded data.
   * Only called when the query scope (search/filters) changes — pagination
   * and sort keep the selection intact so users can multi-page select.
   */
  private pruneSelection(newData: T[]): void {
    const selected = this.selectedRows();
    if (selected.length === 0) return;
    const visibleIds = new Set(newData.map((r: any) => r[this.idField]));
    const pruned = selected.filter((r: any) => visibleIds.has(r[this.idField]));
    if (pruned.length !== selected.length) {
      this.selectedRows.set(pruned);
      this.emitSelectionChange();
    }
  }

  refresh(): void {
    this.loadData();
  }

  // ══════════════════════════════════════════════════════════════
  // SEARCH
  // ══════════════════════════════════════════════════════════════

  /** Keystroke handler — updates only the local draft. The actual
   *  filtered fetch happens on `submitSearch()` (Enter / magnifier
   *  click). Match the rest of the app's search UX. */
  onSearchInput(event: Event): void {
    if (!this.search.enabled) return;
    const target = event.target as HTMLInputElement;
    this.searchDraft.set(target.value);
  }

  /** Commit the draft as the active search term and fire a fetch.
   *  Respects the `minLength` config — short queries are silently
   *  ignored so users don't trigger noisy load-empty cycles. */
  submitSearch(): void {
    if (!this.search.enabled) return;
    const value = this.searchDraft();
    if (this.search.minLength && value.length > 0 && value.length < this.search.minLength) {
      return;
    }
    if (this.searchTerm() === value) return;
    this.searchTerm.set(value);
    this.currentPage.set(1);
    this.loadData();
    this.syncStateToUrl();
  }

  /** Esc — revert the draft to the committed term without firing
   *  a fetch. Lets users back out of an unsubmitted edit. */
  cancelSearchEdit(): void {
    this.searchDraft.set(this.searchTerm());
  }

  clearSearch(): void {
    this.searchDraft.set('');
    this.searchTerm.set('');
    this.currentPage.set(1);
    this.loadData();
    this.syncStateToUrl();
  }

  // ══════════════════════════════════════════════════════════════
  // SORTING
  // ══════════════════════════════════════════════════════════════

  onColumnSort(column: TableColumn<T>): void {
    if (!this.sorting.enabled || !column.sortable) return;

    const current = this.sortBy();
    let newSort: { sortValue: string; sortDirection: 'asc' | 'desc' } | undefined;

    if (current?.sortValue === column.key) {
      // Toggle direction: asc -> desc -> none
      if (current.sortDirection === 'asc') {
        newSort = { sortValue: column.key, sortDirection: 'desc' };
      } else {
        newSort = undefined; // Clear sort
      }
    } else {
      // New column sort
      newSort = { sortValue: column.key, sortDirection: 'asc' };
    }

    this.sortBy.set(newSort);
    this.currentPage.set(1);
    this.loadData();
    this.syncStateToUrl();

    this.sortChanged.emit({
      column: column.key,
      direction: newSort?.sortDirection || null
    });
  }

  getSortIcon(column: TableColumn<T>): string {
    const current = this.sortBy();
    if (current?.sortValue !== column.key) return '';
    return current.sortDirection === 'asc' ? '↑' : '↓';
  }

  /** True if any grouped sibling is marked `primary`. Used by the header
   *  template to show the flag icon on grouped leaders whose child is primary. */
  hasPrimaryItem(column: TableColumn<T>): boolean {
    return !!column.groupedItems?.some(i => i.primary);
  }

  // Continued in next part...
  // ══════════════════════════════════════════════════════════════
  // FILTERING
  // ══════════════════════════════════════════════════════════════

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  async openFilterModal(): Promise<void> {
    if (this.beforeFilterOpen) {
      await this.beforeFilterOpen();
    }
    this.filterOpened.emit();
    const ref = this.modalService.open<FilterModalComponent, FilterModalData, FilterModalResult>(
      FilterModalComponent,
      {
        size: 'md',
        data: {
          filters: this.filters,
          activeFilters: this.activeFilters(),
          filterLabels: this.filterLabels()
        }
      }
    );
    ref.afterClosed().then(result => {
      if (result) {
        this.filterLabels.set(result.labels || {});
        this.applyFilters(result.filters);
      }
    });
  }

  closeFilterModal(): void {
    // no-op — modal service handles closing
  }

  applyFilters(filters: FilterState): void {
    this.activeFilters.set(filters);
    this.currentPage.set(1);
    this.loadData();
    this.syncStateToUrl();
    this.closeFilterModal();

    this.filterChanged.emit({
      filters,
      hasActiveFilters: FilterHelper.hasActiveFilters(filters)
    });
  }

  removeFilter(key: string): void {
    const newFilters = FilterHelper.removeFilter(this.activeFilters(), key);
    this.filterLabels.update(labels => {
      const updated = { ...labels };
      delete updated[key];
      return updated;
    });
    this.applyFilters(newFilters);
  }

  clearAllFilters(): void {
    this.filterLabels.set({});
    this.applyFilters({});
  }

  getFilterDisplayValue(key: string): string {
    // Check stored labels first
    const storedLabel = this.filterLabels()[key];
    if (storedLabel) return storedLabel;

    const filter = this.filters.find(f =>
      'key' in f && f.key === key ||
      'keyFrom' in f && (f.keyFrom === key || f.keyTo === key)
    );

    if (!filter) return key;

    const value = this.activeFilters()[key];
    if (!value) return '';

    // Handle different filter types
    if (filter.type === 'date-range') {
      const dateFilter = filter as any;
      const from = this.activeFilters()[dateFilter.keyFrom];
      const to = this.activeFilters()[dateFilter.keyTo];
      if (from && to) {
        return `${this.formatDate(from)} - ${this.formatDate(to)}`;
      }
      return '';
    }

    // Try to find label from static options
    if ('options' in filter && Array.isArray((filter as any).options)) {
      const opts = (filter as any).options as any[];
      if (Array.isArray(value)) {
        return value.map((v: any) => opts.find(opt => opt.value === v)?.label || v).join(', ');
      }
      const option = opts.find(opt => opt.value === value);
      return option?.label || value;
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value.toString();
  }

  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ══════════════════════════════════════════════════════════════
  // PAGINATION
  // ══════════════════════════════════════════════════════════════

  goToPage(page: number): void {
    if (page < 1 || page > this.pageCount()) return;

    this.currentPage.set(page);
    this.loadData();
    this.syncStateToUrl();
    this.scrollToTop();

    this.pageChanged.emit({
      page,
      pageSize: this.pageSize()
    });
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1); // Reset to first page
    this.loadData();
    this.syncStateToUrl();

    this.pageChanged.emit({
      page: 1,
      pageSize: size
    });
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ══════════════════════════════════════════════════════════════
  // SELECTION
  // ══════════════════════════════════════════════════════════════

  toggleAllSelection(): void {
    if (!this.selectable) return;

    const newSelection = SelectionHelper.toggleAll(
      this.data(),
      this.selectedRows(),
      this.idField
    );

    this.selectedRows.set(newSelection);
    this.emitSelectionChange();
  }

  toggleRowSelection(row: T): void {
    if (!this.selectable) return;

    const newSelection = SelectionHelper.toggleRow(
      row,
      this.selectedRows(),
      this.idField
    );

    this.selectedRows.set(newSelection);
    this.emitSelectionChange();
  }

  isRowSelected(row: T): boolean {
    return SelectionHelper.isRowSelected(row, this.selectedRows(), this.idField);
  }

  clearSelection(): void {
    this.selectedRows.set([]);
    this.emitSelectionChange();
  }

  private emitSelectionChange(): void {
    this.selectionChanged.emit({
      selectedRows: this.selectedRows(),
      allSelected: this.allSelected()
    });
  }

  // ══════════════════════════════════════════════════════════════
  // ROW EXPANSION
  // ══════════════════════════════════════════════════════════════

  toggleRowExpansion(rowId: string, event?: Event): void {
    event?.stopPropagation();

    this.expandedRows.update(expanded => {
      const newSet = new Set(expanded);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  }

  isRowExpanded(rowId: string): boolean {
    return this.expandedRows().has(rowId);
  }

  // ══════════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════════

  onHeaderAction(action: ActionConfig): void {
    if (this.isActionDisabled(action)) return;

    if (action.handler) {
      action.handler();
    }

    this.actionClicked.emit({
      action,
      selectedRows: this.selectedRows()
    });
  }

  async onBulkAction(action: BulkActionConfig): Promise<void> {
    if (this.isActionDisabled(action)) return;

    // Show confirmation modal if configured
    if (action.confirmMessage) {
      const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(
        ConfirmModalComponent,
        {
          size: 'sm',
          data: {
            title: action.label,
            message: action.confirmMessage,
            confirm: action.label,
            danger: action.color === 'danger',
          },
        }
      );
      const confirmed = await ref.afterClosed();
      if (!confirmed) return;
    }

    if (action.handler) {
      action.handler(this.selectedRows());
    }

    this.actionClicked.emit({
      action,
      selectedRows: this.selectedRows()
    });
  }

  onRowAction(action: ActionConfig, row: T, event?: Event): void {
    event?.stopPropagation();

    if (this.isActionDisabled(action)) return;

    if (action.handler) {
      action.handler(row);
    }

    this.actionClicked.emit({
      action,
      row
    });
  }

  isActionDisabled(action: ActionConfig): boolean {
    if (typeof action.disabled === 'function') {
      return action.disabled();
    }
    return action.disabled || false;
  }

  // ══════════════════════════════════════════════════════════════
  // ROW EVENTS
  // ══════════════════════════════════════════════════════════════

  onRowClick(row: T, column: TableColumn<T> | undefined, event: MouseEvent): void {
    // Don't trigger if clicking on checkbox or action buttons
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('button')) {
      return;
    }

    // Handle clickable column navigation
    if (column?.clickable?.enabled) {
      const route = typeof column.clickable.route === 'function'
        ? column.clickable.route(row)
        : column.clickable.route;

      const queryParams = column.clickable.queryParams
        ? (typeof column.clickable.queryParams === 'function'
          ? column.clickable.queryParams(row)
          : column.clickable.queryParams)
        : undefined;

      if (column.clickable.target === '_blank') {
        window.open(route, '_blank');
      } else {
        this.router.navigate([route], { queryParams });
      }
      return;
    }

    this.rowClicked.emit({ row, column, event });
  }

  // ══════════════════════════════════════════════════════════════
  // CELL RENDERING
  // ══════════════════════════════════════════════════════════════

  getCellValue(row: T, column: TableColumn<T>): any {
    return ColumnHelper.getNestedValue(row, column.key);
  }

  getFormattedCellValue(row: T, column: TableColumn<T>): string {
    const value = this.getCellValue(row, column);
    return ColumnHelper.formatCellValue(value, column, row);
  }

  getCellClass(row: T, column: TableColumn<T>): string {
    if (!column.cellClass) return '';

    if (typeof column.cellClass === 'function') {
      return column.cellClass(row);
    }

    return column.cellClass;
  }

  getRowClass(row: T): string {
    if (!this.rowClass) return '';

    if (typeof this.rowClass === 'function') {
      return this.rowClass(row);
    }

    return this.rowClass;
  }

  highlightSearchTerm(text: string): string {
    if (!this.searchTerm() || !this.search.enabled) {
      return text;
    }
    return HighlightHelper.highlightText(text, this.searchTerm());
  }

  // ══════════════════════════════════════════════════════════════
  // COLUMN CUSTOMIZATION
  // ══════════════════════════════════════════════════════════════

  private _customFieldsLoaded = false;

  async openColumnCustomization(): Promise<void> {
    // Load custom fields if available and not yet loaded
    if (this.loadCustomFieldsFn && !this._customFieldsLoaded) {
      try {
        const currentCols = [...this._columns()];
        const merged = await this.loadCustomFieldsFn(currentCols);
        this._columns.set(merged);
        this._customFieldsLoaded = true;
        // Custom fields were just added with their defaults — reapply the saved
        // prefs so persisted visibility/order for custom fields takes effect.
        if (this._savedPrefs && this._savedPrefs.length > 0) {
          this.applyColumnPrefs(this._savedPrefs);
        }
      } catch (e) {
        console.error('Failed to load custom fields', e);
      }
    }

    // Sync visible state with visibleColumns signal before opening.
    // When visibleColumns is empty (no saved prefs / no user tweak yet) we
    // mirror the table's fallback: use the column's own `visible` flag so
    // defaults render as enabled instead of everything appearing disabled.
    const visibleKeys = this.visibleColumns();
    const useFallback = visibleKeys.length === 0;
    const allCols = this._columns();
    console.debug('[list-page] openColumnCustomization state', {
      visibleKeys,
      allColsSnapshot: allCols.map(c => ({ key: c.key, visible: c.visible, isCustomField: c.isCustomField })),
      savedPrefs: this._savedPrefs,
    });
    const columnsWithState = allCols.map(col => ({
      ...col,
      visible: col.isCustomField
        ? (col.visible === true)
        : useFallback ? (col.visible !== false) : visibleKeys.includes(col.key),
    }));

    const ref = this.modalService.open<CustomizeColumnsModalComponent, CustomizeColumnsData, TableColumn[]>(
      CustomizeColumnsModalComponent,
      {
        drawer: true,
        drawerWidth: '420px',
        drawerResizable: true,
        // Desktop width is fixed; only the mobile bottom-sheet can be resized.
        drawerResizableWidth: false,
        data: { columns: columnsWithState }
      }
    );
    ref.afterClosed().then(result => {
      if (result) {
        this.columns = result;
        this.visibleColumns.set(ColumnHelper.getColumnKeys(result));
        this.loadData();
        this.syncStateToUrl();
        this.persistColumnPrefs(result);
      }
    });
  }

  /** Persist column visibility + order + displayStyle to employee options for this entity. */
  private persistColumnPrefs(columns: TableColumn<T>[]): void {
    if (!this.entityType) return;
    const prefs: ListColumnPref[] = columns.map((col, i) => ({
      key: col.key,
      visible: col.visible !== false,
      order: col.order ?? i,
      ...(col.displayStyle ? { displayStyle: col.displayStyle } : {}),
    }));
    this.listPrefs.save(this.entityType, prefs);
  }

  // ══════════════════════════════════════════════════════════════
  // VIEW MODE
  // ══════════════════════════════════════════════════════════════

  setViewMode(mode: string): void {
    // Prevent switching to table on mobile.
    if (this.isMobile() && mode === 'table') {
      return;
    }
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    this.viewModeChange.emit(mode);
  }

  /** True when the active view mode is one of the built-in
   *  table/grid bodies. False for any consumer-provided extra mode
   *  (e.g. 'tree') so the parent's projected content takes over. */
  isBuiltInView = computed<boolean>(() => {
    const m = this.viewMode();
    return m === 'table' || m === 'grid';
  });

  // ══════════════════════════════════════════════════════════════
  // URL STATE SYNCHRONIZATION
  // ══════════════════════════════════════════════════════════════

  private restoreStateFromUrl(): void {
    const params = this.route.snapshot.queryParams;

    const state = ListUrlStateHelper.fromQueryParams(params, {
      page: 1,
      pageSize: this.pageSize(),
      searchTerm: '',
      filters: {},
      visibleColumns: ColumnHelper.getColumnKeys(this.columns)
    });

    if (state.page) this.currentPage.set(state.page);
    if (state.pageSize) this.pageSize.set(state.pageSize);
    if (state.searchTerm) {
      this.searchTerm.set(state.searchTerm);
      // Seed the draft too so the input shows the restored term.
      this.searchDraft.set(state.searchTerm);
    }
    if (state.sortBy) this.sortBy.set(state.sortBy);
    if (state.filters) this.activeFilters.set(state.filters);
    if (state.visibleColumns) {
      this.visibleColumns.set(state.visibleColumns);
      this._urlColumnsRestored = true;
    }
  }

  private syncStateToUrl(): void {
    if (!this.syncToUrl) return;

    const state: Partial<ListPageState> = {
      page: this.currentPage(),
      pageSize: this.pageSize(),
      searchTerm: this.searchTerm(),
      sortBy: this.sortBy(),
      filters: this.activeFilters(),
      visibleColumns: this.visibleColumns()
    };

    const queryParams = ListUrlStateHelper.toQueryParams(state);

    // Null out any existing filter_ params not in the new state
    const currentParams = this.route.snapshot.queryParams;
    Object.keys(currentParams).forEach(key => {
      if (key.startsWith('filter_') && !(key in queryParams)) {
        queryParams[key] = null;
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PERMISSIONS
  // ══════════════════════════════════════════════════════════════

  private hasPermission(permission?: string): boolean {
    if (!permission) return true;

    // TODO: Integrate with PermissionService
    // if (this.permissionService) {
    //   return this.permissionService.has(permission);
    // }

    // Default: allow all if no permission service
    return true;
  }

  // ══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ══════════════════════════════════════════════════════════════

  trackByFn(index: number, item: any): any {
    return item[this.idField] || index;
  }

  getVisiblePages(): (number | string)[] {
    const current = this.currentPage();
    const total = this.pageCount();
    const delta = 2;

    const range: number[] = [];  // ✅ Changed to number[]
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    // Collect page numbers
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    // Add ellipsis
    for (const i of range) {  // ✅ Now i is always number
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }
}
