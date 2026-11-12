import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { DriveStep, Side } from 'driver.js';

import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { CustomReportsService } from '../../services/custom-reports.service';
import { ReportV2Service } from '../../services/report-v2.service';
import { OpenedReport, SavedReportsService } from '../../services/saved-reports.service';
import { ReportTourService } from '../../services/report-tour.service';
import { AskAiPanelComponent } from '../ask-ai-panel/ask-ai-panel.component';
import {
  CatalogIndex,
  MAX_RELATION_HOPS,
  RelationOption,
  childRelations,
  entityOfNode,
  hopsOf,
  indexCatalog,
  nodeFansOut,
  nodeFields,
  nodeLabel,
  nodeOfField,
  pathOfField,
  sheetNodeIds,
} from '../../shared/v2/catalog-fields';
import {
  SpecBuildError,
  columnKey,
  coerceByRunColumns,
  keepResolvableCalculatedFields,
  legacyPayloadOf,
  sheetColumns,
  sheetToSpec,
  specToSheet,
  upgradeLegacySheet,
  withRequiredDateRange,
} from '../../shared/v2/spec-adapter';
import {
  CatalogEntity,
  ReportApiError,
  ReportSpecV2,
  RunResult,
} from '../../shared/v2/report-v2.model';
import { formatCellValue } from '../../shared/format/cell-formatter';
import { CompanyService } from '@core/auth/company.service';
import {
  suggestPlacement,
  suggestLive,
  LiveSuggestion,
  SuggestedColumn,
} from '../../shared/marks/suggest';
import { classifyField } from '../../shared/marks/field-classifier';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import {
  customReportsEditPrivilegeFullKey,
  customReportsViewPrivilegeFullKey,
} from '../../custom-reports.privileges';
import { ColumnPickerComponent, ColumnPickerData } from '../column-picker/column-picker.component';
import { ChartPreviewComponent } from '../chart-preview/chart-preview.component';
import { FieldListComponent } from '../field-list/field-list.component';
import { ShelvesPanelComponent } from '../shelves-panel/shelves-panel.component';
import { MarksCardComponent } from '../marks-card/marks-card.component';
import { SheetTabsComponent } from '../sheet-tabs/sheet-tabs.component';
import { ViewModeComponent } from '../view-mode/view-mode.component';
import { DashboardCanvasComponent } from '../dashboard-canvas/dashboard-canvas.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { CalculatedFieldsComponent } from '../calculated-fields/calculated-fields.component';
import {
  DataSourceTable,
  ReportJoin,
  FlatField,
  ReportColumn,
  FilterRule,
  SortRule,
  SavedModule,
  SavedQuery,
  SheetConfig,
  MarkEncoding,
  DashboardConfig,
  DashboardSheet,
  ReportConfig,
  BuilderMode,
  BuilderSnapshotV2,
  CHART_TYPES,
  ChartTypeDef,
  NAV_ITEMS,
  JOIN_TYPES,
  CalculatedField,
  ColumnFormat,
  createDefaultSheet,
  shelvesToApiParams,
  applyCalculatedFields,
  coerceNumericMeasures,
  coerceNumericRows,
  buildColumnMeta,
} from '../../shared/models/custom-report.model';
import { DashboardRow, DashboardWidgets } from '../../models/dashboard-layout.model';
import { LayoutEditorComponent } from '../layout-editor/layout-editor.component';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
/**
 * Pre-seed parameters passed from a fixed report's "Customise Report" button
 * via query params. `dataset` scopes the first sheet; the optional
 * field/value pairs carry the report's current filters across.
 */
interface SeedConfig {
  dataset: string;
  fromDate: string | null;
  toDate: string | null;
  branchId: string | null;
  dateField: string | null;
  branchField: string | null;
  /** `Table.field` specs to pre-place as columns on the first sheet. */
  columns: string[];
}

@Component({
  selector: 'app-report-builder',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    NgSelectModule,
    SearchDropdownComponent,
    ScrollingModule,
    ChartPreviewComponent,
    FieldListComponent,
    ShelvesPanelComponent,
    MarksCardComponent,
    SheetTabsComponent,
    ViewModeComponent,
    DashboardCanvasComponent,
    PaginationComponent,
    CalculatedFieldsComponent,
    LayoutEditorComponent,
    AskAiPanelComponent,
  ],
  templateUrl: './report-builder.component.html',
  styleUrls: ['./report-builder.component.scss'],
})
export class ReportBuilderComponent implements OnInit, AfterViewInit, OnDestroy {
  // Constants
  chartTypes = CHART_TYPES;
  navItems = NAV_ITEMS;
  joinTypes = JOIN_TYPES;

  // ─── Mode ──────────────────────────────────────────
  mode: BuilderMode = 'edit';
  reportType: 'sheet' | 'dashboard' = 'sheet';

  // ─── UI State ──────────────────────────────────────
  activeNav = 'general';
  reportName = 'Untitled report';
  /** Shown under the Report Name field when a save is refused for its name. */
  nameError: string | null = null;
  // Off by default: shelf/filter/sort edits are frequent while composing a
  // report, and auto-fetching on every one of them re-queries the backend
  // repeatedly (costly against large tables). Users who want live updates
  // while editing can flip this on in Settings; otherwise data only (re)loads
  // on open or via the explicit Run action.
  autoRefresh = false;
  showShelves = false;
  exportOpen = false;
  /** "Show Me" chart-type picker popover (canvas header). Single source for
   *  switching chart type — replaces the old top tile bar + right-panel list. */
  showMeOpen = false;
  /** Chart type whose description shows in the Show Me popover footer while
   *  hovering a tile. Null → fall back to the active chart type. */
  showMeHover: ChartTypeDef | null = null;
  /** True while we're fetching all rows from the server prior to writing
   *  the export file. Surfaced in the toolbar as a spinner / "Exporting…"
   *  state and used to block double-clicks. */
  exporting = false;
  loading = false;
  saving = false;
  previewDragOver = false;

  // Surface for save failures. The backend returns HTTP 200 + { success:false, msg }
  // on validation failure (see docs/custom-reports-backend-api.md), so callers
  // can't rely on the HTTP layer to flag it. Cleared at the start of each save.
  saveError: string | null = null;

  // ─── New visual state (UI only — no data/service impact) ──
  canvasFullscreen = false;
  editingName = false;
  lastSavedAt: Date | null = null;
  moduleSearch = '';
  showAllModules = false;
  favoriteModuleIds = new Set<string>();
  private readonly FAV_STORAGE_KEY = 'invo.customReports.favModules';
  private readonly LAYOUT_STORAGE_KEY = 'invo.customReports.layout';

  // ─── Resizable panel sizes (visual only) ──
  fieldListWidth = 240;
  marksWidth = 164;
  configPanelWidth = 280;
  shelfHeight: number | null = null; // null = auto-size by content

  private resizing: {
    target: 'field-list' | 'marks' | 'config' | 'shelf-block';
    startX: number;
    startY: number;
    startVal: number;
  } | null = null;

  /**
   * The active chart type's definition (label + note). Drives the default
   * description shown in the Show Me popover when nothing is hovered.
   */
  get activeChartTile(): ChartTypeDef | null {
    return this.chartTypes.find((t) => t.id === this.activeSheet?.chartType) || null;
  }

  /** Right-panel tabs (icon + label, replaces vertical rotated tabs) */
  rightTabs = [
    { id: 'general', label: 'CUSTOM_REPORTS.TABS.GENERAL', icon: 'M4 6h16M4 12h16M4 18h10' },
    {
      id: 'datasource',
      label: 'CUSTOM_REPORTS.TABS.SOURCE',
      icon: 'M4 7c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3zM4 7v10c0 1.66 3.58 3 8 3s8-1.34 8-3V7M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3',
    },
    // Chart type is now picked from the canvas-header "Show Me" popover and
    // Marks live in the shelves area, so the old "Visual" tab is gone.
    // "Data" tab — quick filters + color legend. Surfaces the colour mark's
    // legend and lets the user drill-down by picking a single value per
    // shelf dimension (backend has no `in` operator yet; multi-select is a
    // Phase 2 enhancement).
    {
      id: 'data',
      label: 'CUSTOM_REPORTS.TABS.DATA',
      icon: 'M3 6h18M3 12h18M3 18h18M9 3v18M15 3v18',
    },
    {
      id: 'settings',
      label: 'CUSTOM_REPORTS.TABS.SETTINGS',
      icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM19 12l2 1-1 3-2-1M5 12l-2 1 1 3 2-1M12 5V3M12 21v-2',
    },
  ];

  // Column reorder dialog
  showReorderDialog = false;
  reorderList: { key: string; label: string }[] = [];
  reorderDragIndex: number | null = null;
  /** Index where the drop placeholder line is currently rendered. */
  reorderDragOverIndex: number | null = null;

  // Add-sort picker dialog
  showAddSortDialog = false;
  addSortChoices: { key: string; label: string }[] = [];
  addSortSelectedKey = '';
  addSortDir: 'ASC' | 'DESC' = 'ASC';

  // Sort list drag-reorder
  sortDragIndex: number | null = null;

  // ─── Smart marks suggestion state ───────────────────────────
  /**
   * Non-destructive suggestion VM emitted by `shared/marks/suggest`. Rebuilt
   * on every `rebuildDerived()` (reportData / chartType / shelves change).
   * `null` means no actionable suggestion right now.
   */
  liveSuggestion: LiveSuggestion | null = null;
  /**
   * Set of "reason" strings the user has dismissed in the current session.
   * Identical suggestions stay hidden until something material changes.
   */
  private dismissedSuggestions = new Set<string>();

  // ─── Data Sources (v2 catalog) ─────────────────────
  /** Catalog entities as the shape the pickers already render (id = entity key). */
  dataSources: DataSourceTable[] = [];
  catalog: CatalogEntity[] = [];
  catalogIndex: CatalogIndex = new Map();
  /** Relation groups the user opened in the field tree (node ids). */
  expandedNodes = new Set<string>();
  /** Relations that can still be opened, per visible node. */
  relationOptions: { [nodeId: string]: RelationOption[] } = {};
  /** Display label per visible node. */
  nodeLabels: { [nodeId: string]: string } = {};
  /** True when a field on the sheet sits behind a `many` relation (rows repeat). */
  sheetFansOut = false;

  /** Last refused/failed run — shown next to the builder as the backend worded it. */
  runError: string | null = null;
  runErrorCode: string | null = null;

  /** Saved report sharing: false keeps it to its creator. */
  isShared = true;
  /** Id of the legacy module this report was opened from (moved to v2 on save). */
  legacyModuleId: string | null = null;
  /** Shown when an old report couldn't be moved to the new engine. */
  loadError: string | null = null;

  /** Ask AI side panel. */
  aiOpen = false;

  // ─── Sheets (setters auto-rebuild derived caches) ──
  private _sheets: SheetConfig[] = [];
  get sheets(): SheetConfig[] {
    return this._sheets;
  }
  set sheets(val: SheetConfig[]) {
    this._sheets = val;
    this.rebuildDerived();
  }

  private _activeSheetId = '';
  get activeSheetId(): string {
    return this._activeSheetId;
  }
  set activeSheetId(val: string) {
    this._activeSheetId = val;
    this.rebuildDerived();
  }

  // ─── Dashboard ────────────────────────────────────
  dashboard: DashboardConfig | null = null;
  dashboardSheetsData = new Map<string, any[]>();
  dashboardSheetsLoading = new Set<string>();

  // ─── Saved modules/queries ────────────────────────
  modules: SavedModule[] = [];
  queries: SavedQuery[] = [];
  activeModuleId: string | null = null;

  // ─── Report data (setter rebuilds dimKey/measKeys) ──
  private _reportData: any[] = [];
  get reportData(): any[] {
    return this._reportData;
  }
  set reportData(val: any[]) {
    this._reportData = val;
    this.rebuildDerived();
  }
  /** hasNext cursor pagination: true when the backend signalled more records
   *  exist after the current page. Drives the "Next" control (there is no
   *  total-count / last-page any more). */
  hasNext = false;
  /** Group by shelf: per-group metadata (value, full count, page-slice length,
   *  subtotals) passed to the chart preview. Null in normal (non-grouped) mode. */
  groupedMeta:
    | { value: any; count: number; len: number; subtotals: { [key: string]: number } }[]
    | null = null;
  /** Display label of the group-by field, shown in each group header. */
  groupFieldLabel = '';

  // ─── Undo/Redo ────────────────────────────────────
  history: string[] = [];
  future: string[] = [];

  // ─── Field options cache ──────────────────────────
  fieldOptions: { [fieldId: string]: any[] } = {};
  fieldOptionsLoading = false;

  private fetchTimeout: any = null;

  /** True when the current employee has the custom-reports Edit privilege. */
  canEdit = false;

  constructor(
    private customReports: CustomReportsService,
    private reportsV2: ReportV2Service,
    private savedReports: SavedReportsService,
    private modal: ModalService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private privileges: PrivilegeService,
    private tour: ReportTourService,
    private translate: TranslateService,
  ) {
    this.canEdit = this.privileges.check(customReportsEditPrivilegeFullKey);
  }

  /**
   * Navigate back to the reports list. The builder is mounted at the
   * top-level full-screen route (no app sidebar), so we need an explicit
   * way out — the Reports crumb and the back button both call this.
   */
  goBackToReports(): void {
    this.router.navigate(['/reports/custom']);
  }

  // ─── Lifecycle ────────────────────────────────────

  ngOnInit(): void {
    // Set view mode from route data if provided
    const routeMode = this.route.snapshot.data?.['mode'];
    if (routeMode === 'view') this.mode = 'view';

    // Users without the Edit privilege are locked to read-only mode.
    if (!this.canEdit) this.mode = 'view';

    // Read moduleId from route (used by /reports/custom/:moduleId)
    const moduleId = this.route.snapshot.paramMap.get('moduleId');

    // Pre-seed support: a fixed report's "Customise Report" button opens the
    // builder at /custom-report/new?dataset=<source>&fromDate=&toDate=&branchId=
    // &dateField=&branchField=, scoping the first sheet to that data source and
    // carrying the report's current date-range / branch filters across.
    const qp = this.route.snapshot.queryParamMap;
    const dataset = qp.get('dataset');
    const seed: SeedConfig | null = dataset
      ? {
          dataset,
          fromDate: qp.get('fromDate'),
          toDate: qp.get('toDate'),
          branchId: qp.get('branchId'),
          dateField: qp.get('dateField'),
          branchField: qp.get('branchField'),
          columns: (qp.get('columns') || '').split(',').filter(Boolean),
        }
      : null;

    this.loadInitialData(moduleId && moduleId !== '0' ? moduleId : null, seed);
    this.loadFavorites();
    this.loadLayout();
  }

  ngAfterViewInit(): void {
    // Auto-show the walkthrough for editors until they tick "Don't show this
    // again" (persisted in localStorage). The "?" toolbar button replays it.
    if (
      this.canEdit &&
      this.mode === 'edit' &&
      !this.tour.hasSeen(ReportBuilderComponent.TOUR_KEY)
    ) {
      // Let the initial panels/data settle before spotlighting them.
      setTimeout(() => {
        if (!this.tour.hasSeen(ReportBuilderComponent.TOUR_KEY)) this.startTour();
      }, 900);
    }
  }

  ngOnDestroy(): void {
    if (this.fetchTimeout) clearTimeout(this.fetchTimeout);
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
    this.tour.stop();
  }

  // ─── Guided tour ──────────────────────────────────

  private static readonly TOUR_KEY = 'crb_tour_seen_v1';

  /**
   * Launch the step-by-step builder walkthrough. Opens the shelves first so the
   * Marks/Columns/Rows anchors exist, then drives driver.js through each panel.
   * Steps whose anchor isn't on screen (e.g. pagination before a run) are
   * skipped by the service, so the flow stays intact in any state.
   */
  startTour(): void {
    // Make sure the panels the tour points at are actually rendered.
    this.showShelves = true;
    this.showMeOpen = false;
    this.cdr.detectChanges();

    // Defer one frame so the just-opened shelves are in the DOM to anchor to.
    const key = ReportBuilderComponent.TOUR_KEY;
    setTimeout(
      () =>
        this.tour.run(this.buildTourSteps(), {
          dontShowAgain: {
            isChecked: () => this.tour.hasSeen(key),
            onToggle: (checked) => (checked ? this.tour.markSeen(key) : this.tour.clearSeen(key)),
          },
        }),
      60,
    );
  }

  private step(
    selector: string,
    title: string,
    description: string,
    side: Side = 'right',
  ): DriveStep {
    return {
      element: selector,
      popover: { title, description, side, align: 'start' },
    };
  }

  /** Shorthand for a `CUSTOM_REPORTS.TOUR.*` string. */
  private tourText(key: string): string {
    return this.translate.instant('CUSTOM_REPORTS.TOUR.' + key);
  }

  private buildTourSteps(): DriveStep[] {
    return [
      {
        popover: {
          title: this.tourText('WELCOME_TITLE'),
          description: this.tourText('WELCOME_DESC'),
          align: 'center',
        },
      },
      this.step('[data-tour="fields"]', this.tourText('STEP1_TITLE'), this.tourText('STEP1_DESC')),
      this.step(
        '[data-tour="shelves-toggle"]',
        this.tourText('STEP2_TITLE'),
        this.tourText('STEP2_DESC'),
      ),
      this.step('[data-tour="shelves"]', this.tourText('STEP3_TITLE'), this.tourText('STEP3_DESC')),
      {
        ...this.step(
          '[data-tour="marks"]',
          this.tourText('STEP4_TITLE'),
          this.tourText('STEP4_DESC'),
          'left',
        ),
        // Marks live in the Settings tab; open it before the element is looked up.
        element: () => {
          this.activeNav = 'settings';
          this.cdr.detectChanges();
          return document.querySelector('[data-tour="marks"]') as Element;
        },
      },
      this.step('[data-tour="calc"]', this.tourText('STEP5_TITLE'), this.tourText('STEP5_DESC')),
      this.step(
        '[data-tour="show-me"]',
        this.tourText('STEP6_TITLE'),
        this.tourText('STEP6_DESC'),
        'left',
      ),
      this.step(
        '[data-tour="run"]',
        this.tourText('STEP7_TITLE'),
        this.tourText('STEP7_DESC'),
        'bottom',
      ),
      this.step('[data-tour="preview"]', this.tourText('STEP8_TITLE'), this.tourText('STEP8_DESC')),
      this.step(
        '[data-tour="pagination"]',
        this.tourText('STEP9_TITLE'),
        this.tourText('STEP9_DESC'),
        'top',
      ),
      this.step(
        '[data-tour="save"]',
        this.tourText('STEP11_TITLE'),
        this.tourText('STEP11_DESC'),
        'bottom',
      ),
      {
        element: '[data-tour="save"]',
        popover: {
          title: this.tourText('STEP12_TITLE'),
          description: this.tourText('STEP12_DESC'),
          side: 'bottom',
          align: 'start',
        },
      },
    ];
  }

  // ─── Resizable panels ─────────────────────────────

  startResize(event: MouseEvent, target: 'field-list' | 'marks' | 'config' | 'shelf-block'): void {
    event.preventDefault();
    let startVal = 0;
    if (target === 'field-list') startVal = this.fieldListWidth;
    else if (target === 'marks') startVal = this.marksWidth;
    else if (target === 'config') startVal = this.configPanelWidth;
    else /* shelf-block */ {
      // If no override yet, capture the current rendered height
      const row = (event.target as HTMLElement)
        .closest('.builder-center')
        ?.querySelector('.shelf-area-row') as HTMLElement | null;
      startVal = this.shelfHeight ?? (row ? row.getBoundingClientRect().height : 220);
    }
    this.resizing = { target, startX: event.clientX, startY: event.clientY, startVal };
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
    document.body.style.cursor = target === 'shelf-block' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }

  private onResizeMove = (event: MouseEvent): void => {
    if (!this.resizing) return;
    const r = this.resizing;
    if (r.target === 'field-list') {
      this.fieldListWidth = this.clamp(r.startVal + (event.clientX - r.startX), 180, 420);
    } else if (r.target === 'marks') {
      this.marksWidth = this.clamp(r.startVal + (event.clientX - r.startX), 120, 320);
    } else if (r.target === 'config') {
      // Dragging the config handle leftward grows the panel
      this.configPanelWidth = this.clamp(r.startVal - (event.clientX - r.startX), 220, 480);
    } else /* shelf-block */ {
      this.shelfHeight = this.clamp(r.startVal + (event.clientY - r.startY), 120, 600);
    }
  };

  private onResizeEnd = (): void => {
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.resizing = null;
    this.persistLayout();
  };

  private clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
  }

  private loadLayout(): void {
    try {
      const raw = localStorage.getItem(this.LAYOUT_STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.fieldListWidth === 'number') this.fieldListWidth = s.fieldListWidth;
      if (typeof s.marksWidth === 'number') this.marksWidth = s.marksWidth;
      if (typeof s.configPanelWidth === 'number') this.configPanelWidth = s.configPanelWidth;
      if (typeof s.shelfHeight === 'number') this.shelfHeight = s.shelfHeight;
    } catch {}
  }

  private persistLayout(): void {
    try {
      localStorage.setItem(
        this.LAYOUT_STORAGE_KEY,
        JSON.stringify({
          fieldListWidth: this.fieldListWidth,
          marksWidth: this.marksWidth,
          configPanelWidth: this.configPanelWidth,
          shelfHeight: this.shelfHeight,
        }),
      );
    } catch {}
  }

  // ─── Active Sheet ─────────────────────────────────

  private _emptySheet = createDefaultSheet('');
  /** The sheet object the shown results were fetched for (edits replace the sheet). */
  private _lastRunSheet: SheetConfig | null = null;

  /** True when the sheet changed since the last run and auto refresh won't catch up. */
  get needsRun(): boolean {
    return (
      this.mode === 'edit' &&
      !this.autoRefresh &&
      !this.loading &&
      this._lastRunSheet !== this.activeSheet &&
      sheetColumns(this.activeSheet).length > 0
    );
  }

  private _pendingKey: unknown[] = [];
  private _pendingColumns: { key: string; label: string }[] = [];

  /**
   * Shelf fields added since the last run, shown in the Table as empty
   * "Run to update" columns. Cached so the array keeps its identity between
   * change-detection passes (the preview rebuilds on a new reference).
   */
  get pendingColumns(): { key: string; label: string }[] {
    const inputs = [this.needsRun, this.activeSheet, this.reportData, this.orderedColumns];
    if (inputs.every((v, i) => v === this._pendingKey[i])) return this._pendingColumns;
    this._pendingKey = inputs;
    if (!this.needsRun) {
      this._pendingColumns = [];
    } else {
      const have = new Set(this.reportData?.length ? Object.keys(this.reportData[0]) : []);
      this._pendingColumns = this.orderedColumns
        .filter((k) => !have.has(k))
        .map((k) => ({ key: k, label: this.columnLabels[k] || this.labelForKey(k) }));
    }
    return this._pendingColumns;
  }

  get activeSheet(): SheetConfig {
    return (
      this.sheets.find((s) => s.id === this.activeSheetId) || this.sheets[0] || this._emptySheet
    );
  }

  // ─── Cached derived values (stable references for templates) ──

  allFields: FlatField[] = [];
  joinedTableIds: string[] = [];
  availableTables: DataSourceTable[] = [];
  dimKey: string | null = null;
  measKeys: string[] = [];
  colorField: string | null = null;
  columnLabels: { [key: string]: string } = {};
  columnFormats: { [key: string]: ColumnFormat } = {};
  /**
   * Backend-declared field type per column key (e.g. 'text' | 'number' |
   * 'date' | 'boolean'). Aggregations (sum.*, count.*, …) are always
   * 'number'. Date parts (year.*, month.*, …) are always 'text' (formatted
   * year/month strings). Plain columns fall through to the field's declared
   * type from getDataSource. chart-preview uses this map to render cells
   * correctly without name-based guessing.
   */
  columnTypes: { [key: string]: string } = {};
  /**
   * Backend-declared sub-format for numeric columns ('currency' | 'decimal' |
   * 'integer'). Built from DataSourceField.numberFormat. Aggregations
   * inherit the underlying field's numberFormat (SUM(price) is still
   * currency). chart-preview branches the number renderer on this hint.
   */
  columnNumberFormats: { [key: string]: string } = {};
  orderedColumns: string[] = [];
  currentSort: { key: string; dir: 'ASC' | 'DESC' } | null = null;
  dataKeys: string[] = []; // keys from the current report data (for calculated field dropdown)

  /**
   * Flat map of `Table.fieldId` → backend field meta, derived from the
   * currently-joined `allFields`. Cheap to call per fetch — kept as a tiny
   * helper instead of cached state so we don't have to keep two copies in
   * sync with `rebuildDerived`.
   */
  private fieldMetaByFullId(): {
    [fullId: string]: { id?: string; type?: string; numberFormat?: string };
  } {
    const out: { [fullId: string]: { id?: string; type?: string; numberFormat?: string } } = {};
    for (const f of this.allFields) {
      out[f.fullId] = { id: f.id, type: f.type, numberFormat: (f as any).numberFormat };
    }
    return out;
  }

  /** Rebuild all cached derived values. Auto-called by sheets/activeSheetId/reportData setters. */
  private rebuildDerived(): void {
    const sheet = this.activeSheet;

    if (sheet) {
      // Field tree: the root entity, every relation the user opened, and every
      // node the sheet already uses (so its fields always resolve). Opened
      // nodes from another root (after a data-source switch) are skipped.
      const root = sheet.primaryTable;
      const nodes = new Set<string>([root, ...sheetNodeIds(sheet)]);
      this.expandedNodes.forEach((n) => nodes.add(n));
      this.joinedTableIds = [...nodes]
        .filter(
          (n) => (n === root || n.startsWith(root + '.')) && !!entityOfNode(this.catalogIndex, n),
        )
        .sort();
      this.allFields = this.joinedTableIds.flatMap((n) => nodeFields(this.catalogIndex, n));
      const relations: { [nodeId: string]: RelationOption[] } = {};
      const labels: { [nodeId: string]: string } = {};
      for (const n of this.joinedTableIds) {
        relations[n] = childRelations(this.catalogIndex, n).filter((r) => !nodes.has(r.nodeId));
        labels[n] = nodeLabel(this.catalogIndex, n);
      }
      this.relationOptions = relations;
      this.nodeLabels = labels;
      this.sheetFansOut = sheetNodeIds(sheet).some((n) => nodeFansOut(this.catalogIndex, n));
      this.availableTables = [];
      const colorMark = sheet.marks.find((m) => m.channel === 'color');
      this.colorField = colorMark ? columnKey(colorMark.field) : null;

      // Column metadata (labels / formats / types / number formats / order) —
      // shared helper so the view and dashboard widget render identically.
      const meta = buildColumnMeta(sheet, this.allFields);
      this.columnLabels = meta.columnLabels;
      this.columnFormats = meta.columnFormats;
      this.columnTypes = meta.columnTypes;
      this.columnNumberFormats = meta.columnNumberFormats;
      this.orderedColumns = meta.orderedColumns;

      // Current sort
      this.currentSort =
        sheet.sortBy.length > 0 ? { key: sheet.sortBy[0].id, dir: sheet.sortBy[0].mod } : null;
    } else {
      this.joinedTableIds = [];
      this.allFields = [];
      this.availableTables = [];
      this.relationOptions = {};
      this.nodeLabels = {};
      this.sheetFansOut = false;
      this.colorField = null;
      this.orderedColumns = [];
      this.columnTypes = {};
      this.columnNumberFormats = {};
      this.currentSort = null;
    }

    if (this.reportData && this.reportData.length > 0) {
      const keys = Object.keys(this.reportData[0]);
      this.dataKeys = keys;
      // Find a true dimension — a key WITHOUT an aggregation prefix. If every
      // key is aggregated (the KPI case, e.g. just `sum.Invoices.total`),
      // dimKey stays null and ALL keys go to measKeys so the renderer sees
      // a measure-only payload.
      const dim = keys.find((k) => !/^(sum|count|avg|max|min)\./.test(k) && k !== 'value');
      this.dimKey = dim || null;
      this.measKeys = this.dimKey ? keys.filter((k) => k !== this.dimKey) : [...keys];
    } else {
      this.dataKeys = [];
      this.dimKey = null;
      this.measKeys = [];
    }

    this.recomputeLiveSuggestion();
    this.rebuildDataTabState();
  }

  /**
   * Re-derive the smart-marks suggestion VM. Pure / non-destructive — uses
   * the current sheet + sample of `reportData`. Suppresses any reason the
   * user has explicitly dismissed in this session.
   */
  private recomputeLiveSuggestion(): void {
    const sheet = this.activeSheet;
    if (!sheet || this.mode !== 'edit' || !this.canEdit) {
      this.liveSuggestion = null;
      return;
    }
    const sample = this.reportData?.length ? this.reportData.slice(0, 200) : undefined;
    const live = suggestLive(
      {
        columnsShelf: sheet.columnsShelf,
        rowsShelf: sheet.rowsShelf,
        marks: sheet.marks,
      },
      this.allFields,
      sheet.chartType,
      sample,
    );
    if (live && this.dismissedSuggestions.has(live.reason)) {
      this.liveSuggestion = null;
      return;
    }
    this.liveSuggestion = live;
  }

  // ─── Data Loading ─────────────────────────────────

  async loadInitialData(
    moduleIdToLoad: string | null = null,
    seed: SeedConfig | null = null,
  ): Promise<void> {
    this.loading = true;
    try {
      // A selected report is loaded by id below; no saved-report list is
      // needed on open.
      this.setCatalog(await this.reportsV2.getCatalog());

      if (this.dataSources.length > 0) {
        const defaultSheet = createDefaultSheet(this.dataSources[0].id);
        this.sheets = [defaultSheet];
        this.activeSheetId = defaultSheet.id;
      }

      // A report selected in the URL: v2 specs first, then the legacy module
      // list (old reports are moved to v2 when the user saves them).
      if (moduleIdToLoad) {
        await this.openSavedReport(moduleIdToLoad);
      } else if (seed) {
        await this.applySeed(seed);
      }
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      this.loadError = err?.message || null;
    }
    this.loading = false;
  }

  private setCatalog(catalog: CatalogEntity[]): void {
    this.catalog = catalog;
    this.catalogIndex = indexCatalog(catalog);
    // The pickers render DataSourceTable; `data` = the entity's own fields.
    this.dataSources = [...catalog]
      .sort(
        (a, b) =>
          (a.category || '').localeCompare(b.category || '') || a.label.localeCompare(b.label),
      )
      .map((e) => ({
        id: e.key,
        label: e.label,
        data: nodeFields(this.catalogIndex, e.key),
        refs: [],
      }));
  }

  /**
   * Seed the first sheet from a fixed report's "Customise Report" launch. The
   * launch names legacy views and columns ("InvoiceView", "Table.field"), so
   * /v2/fromLegacy maps them onto the catalog. Columns from other views carry
   * no join information here, so only the dataset's own columns are seeded.
   */
  private async applySeed(seed: SeedConfig): Promise<void> {
    const legacy = createDefaultSheet(seed.dataset);
    if (seed.dateField && seed.fromDate && seed.toDate) {
      legacy.filterRules.push({
        field: `${seed.dataset}.${seed.dateField}`,
        type: 'date',
        condition: { type: 'between', filter: { start: seed.fromDate, end: seed.toDate } },
        includes: [],
      });
    }
    if (seed.branchField && seed.branchId) {
      legacy.filterRules.push({
        field: `${seed.dataset}.${seed.branchField}`,
        type: 'text',
        condition: { type: 'equal', filter: seed.branchId },
        includes: [],
      });
    }
    seed.columns
      .filter((spec) => spec.split('.')[0] === seed.dataset)
      .forEach((spec, i) =>
        legacy.columnsShelf.push({
          col: spec,
          agg: '',
          datePart: '',
          key: `${Date.now()}-${i}-${spec}`,
        }),
      );

    try {
      const spec = await this.reportsV2.fromLegacy(legacyPayloadOf(legacy));
      const { sheet } = upgradeLegacySheet(legacy, spec, this.catalogIndex);
      this.sheets = [sheet];
      this.activeSheetId = sheet.id;
      // Opens as e.g. "Payouts (Customized)" instead of "Untitled report".
      this.reportName = `${nodeLabel(this.catalogIndex, sheet.primaryTable)} (Customized)`;
      if (sheet.columnsShelf.length && this.mode === 'edit') this.fetchReportData();
    } catch (err: any) {
      console.error('[CustomReports] Could not seed from', seed.dataset, err);
      this.loadError = err?.message || null;
    }
  }

  /** Lazy-load options for a single field (called on demand when filter dropdown opens) */
  async loadFieldOptionsFor(fieldId: string): Promise<void> {
    // Already loaded or currently loading
    if (this.fieldOptions[fieldId] !== undefined) return;

    // Mark as loading (empty array prevents re-fetch)
    this.fieldOptions[fieldId] = [];
    try {
      // /v2/fieldValues returns up to 50 distinct raw values; the filter key
      // IS the value, so id and value are the same string.
      const values = await this.reportsV2.fieldValues(
        this.activeSheet.primaryTable,
        pathOfField(fieldId),
      );
      const opts = values
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map((v) => ({ id: String(v), value: String(v) }));
      this.fieldOptions = {
        ...this.fieldOptions,
        [fieldId]: this.dedupeOptions(opts),
      };
    } catch {
      this.fieldOptions = { ...this.fieldOptions, [fieldId]: [] };
    }
  }

  /** Dedupe an option list preserving original order. */
  private dedupeOptions(opts: any[]): any[] {
    if (!Array.isArray(opts) || opts.length === 0) return [];
    const seen = new Set<string>();
    const out: any[] = [];
    for (const opt of opts) {
      const id = opt?.id;
      const fallback = opt?.value ?? opt?.name;
      const key =
        id !== undefined && id !== null && id !== ''
          ? '__id__:' + String(id)
          : '__val__:' + String(fallback ?? '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(opt);
    }
    return out;
  }

  // ─── Data tab (Phase 1: color legend + per-dimension quick filter) ───
  //
  // IMPORTANT: Everything here is consumed by the template, which means
  // Angular's default change detection re-evaluates these expressions on
  // every tick (mousemove, drag, blur, async resolve, …). Getters that
  // walked arrays + a method call that re-`.filter()`-ed 10k items per tick
  // was freezing the Data tab. Now every derived value is a *field*,
  // recomputed only when its actual inputs change.

  /**
   * Per-field search string for the Data-tab quick-filter list. Empty means
   * no filter applied; matching is substring, case-insensitive, against the
   * option's value / name / id. We hand a setter (`onQuickFilterSearch`) to
   * the template so the cache invalidates on input.
   */
  quickFilterSearch: { [col: string]: string } = {};

  /** Collapsed state per column for the Data-tab filter sections. Default
   *  expanded; click the header to toggle. */
  quickFilterCollapsed: { [col: string]: boolean } = {};
  toggleQuickFilterCollapsed(col: string): void {
    this.quickFilterCollapsed[col] = !this.quickFilterCollapsed[col];
  }

  /**
   * Human-readable selection count for the column header. Returns:
   *   - 'All (N)'      when no quick-filter rules
   *   - 'None'         when sentinel-equal rule
   *   - '1 / N'        when 'only' mode (single value selected)
   *   - 'K / N'        when 'except' mode (K of N selected)
   *
   * Used as a subtle right-aligned badge in the filter head so the user
   * sees at a glance how restrictive each filter is.
   */
  quickFilterSummary(col: string): string {
    const s = this.quickFilterState[col];
    const total = this.knownOptionIds(col).length;
    if (!s || s.mode === 'all') return total > 0 ? `All (${total})` : 'All';
    if (s.mode === 'none') return 'None';
    if (s.mode === 'only') return total > 0 ? `1 / ${total}` : '1';
    // 'except'
    const selected = total > 0 ? total - s.values.size : 0;
    return total > 0 ? `${selected} / ${total}` : `−${s.values.size}`;
  }

  /** True when the filter is in a partial state (some selected, some not).
   *  Drives the indeterminate "(All)" checkbox visual. */
  isQuickFilterPartial(col: string): boolean {
    const s = this.quickFilterState[col];
    if (!s) return false;
    return s.mode === 'only' || s.mode === 'except';
  }

  /** Color legend items — recomputed in rebuildDerived(). */
  legendItems: { value: string; color: string }[] = [];

  /** Quick-filter dimensions on the active sheet — recomputed in rebuildDerived(). */
  quickFilterDimensions: { col: string; label: string }[] = [];

  /**
   * Memoized per-column cache for `filteredFieldOptions`. Key: column id.
   * Value: { term used, source array reference, computed result }. We
   * invalidate by checking whether the search term or the source array
   * identity changed since the last call.
   */
  private _filteredOptionsCache = new Map<string, { term: string; source: any[]; result: any[] }>();

  /**
   * Filtered (and lightly normalised) options for a dimension's quick
   * filter. Returns the same array reference on consecutive calls when
   * inputs haven't changed, so cdk-virtual-scroll doesn't think the input
   * has changed every tick and re-virtualise.
   */
  filteredFieldOptions(col: string): any[] {
    const source = this.fieldOptions[col] || [];
    const term = (this.quickFilterSearch[col] || '').trim().toLowerCase();
    const cached = this._filteredOptionsCache.get(col);
    if (cached && cached.source === source && cached.term === term) {
      return cached.result;
    }
    const result = term
      ? source.filter((opt: any) => {
          const text = String(opt.value ?? opt.name ?? opt.id ?? '').toLowerCase();
          return text.includes(term);
        })
      : source;
    this._filteredOptionsCache.set(col, { term, source, result });
    return result;
  }

  /** Setter for the Data-tab search input — clears the cache entry for
   *  the column so the next render recomputes once. Bind via ngModelChange. */
  onQuickFilterSearch(col: string, value: string): void {
    this.quickFilterSearch[col] = value;
    this._filteredOptionsCache.delete(col);
  }

  /** trackBy for the virtual list so identity-stable rows aren't recreated
   *  when the user toggles the radio. */
  trackOptionById = (_i: number, opt: any): any => opt?.id ?? _i;

  /**
   * Backing color array used by chart-preview. Mirrored here so the legend
   * in the Data tab paints the same swatches the chart does.
   */
  private _legendColors = [
    '#00bcd4',
    '#26a69a',
    '#42a5f5',
    '#ffa726',
    '#ef5350',
    '#ab47bc',
    '#8d6e63',
    '#78909c',
  ];

  /** Rebuild legendItems + quickFilterDimensions. Called from rebuildDerived
   *  whenever the sheet or reportData changes (the only inputs they care
   *  about). Kept separate to keep rebuildDerived readable. */
  private rebuildDataTabState(): void {
    const sheet = this.activeSheet;
    if (!sheet) {
      this.legendItems = [];
      this.quickFilterDimensions = [];
      this.quickFilterState = {};
      return;
    }

    // Quick-filter dimensions: non-aggregated, non-date-part Columns-shelf
    // entries, with ID/identifier-style fields excluded — they have one
    // distinct value per row, so a "filter by this id" UI doesn't help
    // analysis. The field stays on the Columns shelf (it's still shown in
    // the table); we just don't expose a quick-filter section for it.
    this.quickFilterDimensions = sheet.columnsShelf
      .filter((c) => !c.agg && !c.datePart)
      .filter((c) => {
        const field = this.allFields.find((f) => f.fullId === c.col) as any;
        if (!field) return true; // unknown field — keep it, fail-open
        const cls = classifyField(field);
        return cls.subtype !== 'identifier';
      })
      .map((c) => ({ col: c.col, label: this.getFieldLabel(c.col) }));

    // Quick-filter state per column — derived from filterRules tagged with
    // `_quickFilter`. Three rule shapes are recognised:
    //   - `equal __quickFilter_none__` → mode 'none'
    //   - `equal <value>`              → mode 'only' (single selected)
    //   - `notEqual <value>` (1+)      → mode 'except' (some excluded)
    const nextState: {
      [col: string]: { mode: 'all' | 'none' | 'only' | 'except'; values: Set<string> };
    } = {};
    for (const r of sheet.filterRules) {
      if (!(r as any)._quickFilter) continue;
      const field = r.field;
      const cond = r.condition;
      if (!cond || typeof cond.filter !== 'string') continue;

      if (cond.type === 'equal') {
        if (cond.filter === ReportBuilderComponent.QUICK_FILTER_NONE_SENTINEL) {
          nextState[field] = { mode: 'none', values: new Set() };
        } else {
          // 'only' — single equal rule beats any partial 'except' data
          // (multiple equal rules with the same field shouldn't coexist
          // but if they do, the last one wins).
          nextState[field] = { mode: 'only', values: new Set([cond.filter]) };
        }
      } else if (cond.type === 'notEqual') {
        const existing = nextState[field];
        if (!existing || existing.mode !== 'except') {
          nextState[field] = { mode: 'except', values: new Set([cond.filter]) };
        } else {
          existing.values.add(cond.filter);
        }
      }
    }
    this.quickFilterState = nextState;

    // Color legend: only when a color mark is set + there's report data to
    // pull distinct values from. Capped at 24 to keep the UI sane.
    const colorMark = sheet.marks.find((m) => m.channel === 'color');
    if (!colorMark || !this.reportData?.length) {
      this.legendItems = [];
      return;
    }
    const key = columnKey(colorMark.field);
    const seen = new Set<string>();
    const out: { value: string; color: string }[] = [];
    for (const row of this.reportData) {
      const v = row[key];
      const label = v === null || v === undefined || v === '' ? '(empty)' : String(v);
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ value: label, color: this._legendColors[out.length % this._legendColors.length] });
      if (out.length >= 24) break;
    }
    this.legendItems = out;
  }

  /**
   * Per-column quick-filter state. Four modes:
   *   'all'    → every value selected, no rules emitted.
   *   'none'   → nothing selected, emitted as one sentinel `equal` rule
   *              (`__quickFilter_none__`) instead of N `notEqual` rules.
   *   'only'   → exactly one value selected, emitted as one `equal` rule.
   *   'except' → some values excluded, emitted as one `notEqual` per value.
   *
   * Rebuilt in rebuildDataTabState() from filterRules tagged with
   * `_quickFilter: true`. The mode is chosen for minimal payload — when
   * the user has 1 of 100 values selected we send 1 rule, not 99.
   *
   * The backend has no `in` operator, so multi-value selections in the
   * `else` zone (2..N-2 selected) still fall back to `notEqual` per
   * excluded value combined with the sheet's default 'AND' glue.
   */
  quickFilterState: {
    [col: string]: { mode: 'all' | 'none' | 'only' | 'except'; values: Set<string> };
  } = {};

  /** Sentinel emitted as `equal.filter` when the user wants zero rows. */
  private static readonly QUICK_FILTER_NONE_SENTINEL = '__quickFilter_none__';

  /** True when every value is selected (no filter active). */
  isQuickFilterAll(col: string): boolean {
    const s = this.quickFilterState[col];
    return !s || s.mode === 'all';
  }

  /** True when the given option is currently checked. */
  isQuickFilterChecked(col: string, valueId: string): boolean {
    const s = this.quickFilterState[col];
    if (!s || s.mode === 'all') return true;
    if (s.mode === 'none') return false;
    const idStr = String(valueId);
    if (s.mode === 'only') return s.values.has(idStr);
    return !s.values.has(idStr); // 'except'
  }

  /**
   * Toggle a single value's checkbox. Computes the resulting "selected set"
   * then re-applies the optimal rule shape for that selection.
   */
  toggleQuickFilter(col: string, valueId: string, checked: boolean): void {
    if (!this.canEdit) return;
    const sheet = this.activeSheet;
    if (!sheet) return;
    const idStr = String(valueId);
    const allIds = this.knownOptionIds(col);
    const currentSelected = this.computeSelectedSet(col, allIds);
    if (checked) currentSelected.add(idStr);
    else currentSelected.delete(idStr);
    this.applyQuickFilterSelection(sheet, col, currentSelected, allIds);
  }

  /** Clear all quick-filter rules for the column — "(All)" checked.
   *  Wired to the small `×` clear-button next to the dimension label. */
  clearQuickFilter(col: string): void {
    if (!this.canEdit) return;
    const sheet = this.activeSheet;
    if (!sheet) return;
    this.applyQuickFilterSelection(sheet, col, /* selected */ null, []);
  }

  /**
   * Tableau-style "(All)" toggle:
   *   all selected   → switch to nothing selected (one sentinel rule).
   *   any other mode → switch back to all selected (no rules).
   */
  toggleAllQuickFilter(col: string): void {
    if (!this.canEdit) return;
    const sheet = this.activeSheet;
    if (!sheet) return;
    if (this.isQuickFilterAll(col)) {
      this.applyQuickFilterSelection(sheet, col, new Set(), []);
    } else {
      this.applyQuickFilterSelection(sheet, col, null, []);
    }
  }

  /**
   * Decide the rule shape for a selected-set and write it into filterRules.
   *
   * `selected === null` is a hard "all selected" signal — used by Clear and
   * by "(All)" toggle when going to all. Otherwise the set's size relative
   * to the known options decides the shape: 0 → sentinel, 1 → `equal`,
   * `total` → no rules, everything else → `notEqual` per excluded.
   */
  private applyQuickFilterSelection(
    sheet: SheetConfig,
    col: string,
    selected: Set<string> | null,
    allIdsIfKnown: string[],
  ): void {
    const field = this.allFields.find((f) => f.fullId === col);
    const type = field?.type || 'text';
    const otherRules = sheet.filterRules.filter(
      (r) => !(r.field === col && (r as any)._quickFilter),
    );

    let generated: FilterRule[] = [];
    let nextState: { mode: 'all' | 'none' | 'only' | 'except'; values: Set<string> } | null = null;

    const makeEqual = (val: string): FilterRule =>
      ({
        field: col,
        type,
        condition: { type: 'equal', filter: val },
        includes: [],
        _quickFilter: true,
      }) as unknown as FilterRule;
    const makeNotEqual = (val: string): FilterRule =>
      ({
        field: col,
        type,
        condition: { type: 'notEqual', filter: val },
        includes: [],
        _quickFilter: true,
      }) as unknown as FilterRule;

    const allIds = allIdsIfKnown.length ? allIdsIfKnown : this.knownOptionIds(col);

    if (selected === null) {
      // 'all' — no rules
      generated = [];
      nextState = null;
    } else if (selected.size === 0) {
      // 'none' — single sentinel
      generated = [makeEqual(ReportBuilderComponent.QUICK_FILTER_NONE_SENTINEL)];
      nextState = { mode: 'none', values: new Set() };
    } else if (
      allIds.length > 0 &&
      selected.size === allIds.length &&
      allIds.every((v) => selected.has(v))
    ) {
      // All known values selected → effectively 'all'
      generated = [];
      nextState = null;
    } else if (selected.size === 1) {
      // 'only' — single equal rule
      const v = Array.from(selected)[0];
      generated = [makeEqual(v)];
      nextState = { mode: 'only', values: new Set([v]) };
    } else if (allIds.length > 0) {
      // 'except' — notEqual per excluded value
      const excluded = new Set<string>(allIds.filter((v) => !selected.has(v)));
      generated = Array.from(excluded).map(makeNotEqual);
      nextState = { mode: 'except', values: excluded };
    } else {
      // Options not loaded yet and we can't compute the excluded set —
      // fall back to a single equal rule for the first selected value
      // (best effort; rare edge case).
      const v = Array.from(selected)[0];
      generated = [makeEqual(v)];
      nextState = { mode: 'only', values: new Set([v]) };
    }

    this.pushHistory();
    this.sheets = this.sheets.map((s) =>
      s.id === sheet.id ? { ...s, filterRules: [...otherRules, ...generated] } : s,
    );
    // Optimistically write the derived state — rebuildDataTabState will
    // also recompute it from the new filterRules, but updating here keeps
    // the UI snappy without waiting for the async chain.
    const nextStateMap = { ...this.quickFilterState };
    if (nextState) nextStateMap[col] = nextState;
    else delete nextStateMap[col];
    this.quickFilterState = nextStateMap;
    if (this.autoRefresh) this.fetchReportData();
  }

  /** All known option ids for a column (from the cached distinct list). */
  private knownOptionIds(col: string): string[] {
    return (this.fieldOptions[col] || [])
      .map((o: any) => String(o?.id ?? ''))
      .filter((id: string) => id !== '');
  }

  /**
   * Derive the currently-selected set for a column from its state. Falls
   * back to `allIds` when no state exists (= mode 'all'). Returns a *new*
   * Set the caller can freely mutate before re-applying.
   */
  private computeSelectedSet(col: string, allIds: string[]): Set<string> {
    const s = this.quickFilterState[col];
    if (!s || s.mode === 'all') return new Set(allIds);
    if (s.mode === 'none') return new Set();
    if (s.mode === 'only') return new Set(s.values);
    // 'except'
    return new Set(allIds.filter((v) => !s.values.has(v)));
  }

  // ─── Fetch Report Data ────────────────────────────

  async fetchReportData(immediate = false): Promise<void> {
    const current = this.activeSheet;
    if (!current) return;

    // An entity that requires a date range gets a "between" date filter
    // (last 30 days) when the user hasn't set one — visible in the Filters
    // shelf so it can be edited.
    const filterRules =
      this.mode === 'edit' && this.canEdit
        ? withRequiredDateRange(current, this.catalogIndex)
        : null;
    if (filterRules) {
      this.sheets = this.sheets.map((s) => (s.id === current.id ? { ...s, filterRules } : s));
    }
    const sheet = this.activeSheet ?? current;
    this._lastRunSheet = sheet;

    // Clear any prior grouped view; the success path repopulates it when the
    // backend returns groups[]. Keeps stale group headers/subtotals from lingering.
    this.groupedMeta = null;
    this.groupFieldLabel = '';

    if (sheetColumns(sheet).length === 0) {
      this.reportData = [];
      this.hasNext = false;
      this.runError = null;
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    // Build the v2 spec up front so a locally-refused report (no date range
    // on an entity that needs one, group-by on an aggregated report) never
    // reaches the backend.
    let spec: ReportSpecV2;
    try {
      spec = sheetToSpec(sheet, { index: this.catalogIndex });
    } catch (err) {
      this.showSpecError(err);
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    if (this.fetchTimeout) {
      clearTimeout(this.fetchTimeout);
      this.fetchTimeout = null;
    }

    const doFetch = async () => {
      this.loading = true;
      this.cdr.detectChanges();
      try {
        const result = await this.reportsV2.run(spec);
        const { rows, grouped } = this.shapeRunResult(result, sheet);
        this.groupedMeta = grouped;
        this.groupFieldLabel =
          grouped && sheet.groupBy
            ? this.allFields.find((f) => f.fullId === sheet.groupBy)?.label ||
              sheet.groupBy.split('.').pop() ||
              ''
            : '';
        this.reportData = rows;
        // hasNext cursor pagination: the backend tells us directly whether more
        // records follow this page — no total count to reconcile.
        this.hasNext = result.hasNext === true;
        this.runError = null;
        this.runErrorCode = null;
      } catch (err: any) {
        console.error('Failed to fetch report:', err);
        this.reportData = [];
        this.hasNext = false;
        this.runError = err?.message || this.translate.instant('CUSTOM_REPORTS.NOTICES.RUN_FAILED');
        this.runErrorCode = err instanceof ReportApiError ? err.code || null : null;
      }
      this.loading = false;
      this.cdr.detectChanges();
    };

    if (immediate) {
      await doFetch();
    } else {
      this.fetchTimeout = setTimeout(() => {
        this.fetchTimeout = null;
        doFetch();
      }, 500);
    }
  }

  /**
   * Turn a /v2/run result into the rows the preview renders: flatten display
   * groups, parse numeric strings, apply calculated fields. Rows are already
   * keyed by the builder's column keys (each spec column's `as`).
   */
  private shapeRunResult(
    result: RunResult,
    sheet: SheetConfig,
  ): {
    rows: any[];
    grouped: { value: any; count: number; len: number; subtotals: any }[] | null;
  } {
    let rows = result.rows || [];
    let grouped: { value: any; count: number; len: number; subtotals: any }[] | null = null;
    if (sheet.groupBy && result.groups && result.groups.length) {
      rows = result.groups.flatMap((g) => g.rows || []);
      grouped = result.groups.map((g) => {
        const len = (g.rows || []).length;
        const subtotals: { [key: string]: number } = {};
        for (const k of Object.keys(g.subtotals || {})) {
          const n = parseFloat(g.subtotals[k]);
          subtotals[k] = isNaN(n) ? g.subtotals[k] : n;
        }
        return {
          value: g.value,
          count: typeof g.count === 'number' ? g.count : len,
          len,
          subtotals,
        };
      });
    }
    coerceByRunColumns(rows, result.columns);
    coerceNumericMeasures(rows);
    coerceNumericRows(rows, sheet, this.fieldMetaByFullId());
    if (sheet.calculatedFields?.length) {
      applyCalculatedFields(rows, sheet.calculatedFields);
    }
    return { rows, grouped };
  }

  /** Surface a locally-refused spec as the transient builder notice. */
  private showSpecError(err: any): void {
    if (err instanceof SpecBuildError) {
      this.setJoinNotice(this.translate.instant(err.messageKey, err.params));
    } else {
      this.setJoinNotice(
        err?.message || this.translate.instant('CUSTOM_REPORTS.NOTICES.RUN_FAILED'),
      );
    }
  }

  // ─── Smart marks: "Choose for me" + live suggestion apply ───────────

  /**
   * Replace the active sheet's shelves with the engine's full proposal for
   * the current chart type. A single undoable action. No-op for read-only
   * users and when there are no fields to work with.
   */
  chooseForMe(): void {
    if (!this.canEdit || this.mode !== 'edit') return;
    const sheet = this.activeSheet;
    if (!sheet) return;

    const proposal = suggestPlacement(
      this.allFields,
      sheet.chartType,
      this.reportData?.length ? this.reportData.slice(0, 200) : undefined,
    );
    if (!proposal.hasContent) {
      // Nothing actionable — surface the reason in the live VM so the user
      // sees why the button did nothing.
      this.liveSuggestion = { placementMismatch: true, reason: proposal.reason };
      return;
    }

    this.pushHistory();
    this.sheets = this.sheets.map((s) =>
      s.id === sheet.id
        ? {
            ...s,
            columnsShelf: proposal.columnsShelf,
            rowsShelf: proposal.rowsShelf,
            marks: proposal.marks,
          }
        : s,
    );
    // Clear any stale dismissal — the user just opted into the engine.
    this.dismissedSuggestions.clear();
    this.liveSuggestion = null;
    // Direct user action — bypass the 500ms typing-debounce so the chart
    // reflects the new shelves on the first click. Otherwise the user
    // perceives a "click twice to get correct rows" because the first
    // click's debounced fetch hasn't landed yet when they look at the chart.
    if (this.autoRefresh && this.mode === 'edit') this.fetchReportData(true);
  }

  /**
   * Apply the current live suggestion (currently only color-split). Single
   * undoable action. Called by the inline "[Apply]" chip.
   */
  applyLiveSuggestion(): void {
    if (!this.canEdit || this.mode !== 'edit') return;
    const live = this.liveSuggestion;
    if (!live?.suggestedColorField) return;

    const sheet = this.activeSheet;
    if (!sheet) return;

    const next: SuggestedColumn = live.suggestedColorField;
    this.pushHistory();
    this.sheets = this.sheets.map((s) =>
      s.id === sheet.id
        ? {
            ...s,
            // Replace any existing color mark, preserve everything else.
            marks: [
              ...s.marks.filter((m) => m.channel !== 'color'),
              { channel: 'color', field: next as any },
            ],
          }
        : s,
    );
    this.liveSuggestion = null;
    // Direct user action — see chooseForMe for why this bypasses debounce.
    if (this.autoRefresh && this.mode === 'edit') this.fetchReportData(true);
  }

  /** Hide the current suggestion until something material changes. */
  dismissLiveSuggestion(): void {
    if (this.liveSuggestion?.reason) {
      this.dismissedSuggestions.add(this.liveSuggestion.reason);
    }
    this.liveSuggestion = null;
  }

  // ─── Mode Toggle ──────────────────────────────────

  // app-search-dropdown helpers (the model stays the plain table id)
  dsLabel = (t: any): string => t?.label ?? String(t ?? '');
  dsSame = (a: any, b: any): boolean => (a?.id ?? a) === (b?.id ?? b);
  dsValue = (t: any): string => t?.id ?? t;

  toggleMode(): void {
    // Read-only users can't switch into edit mode.
    if (!this.canEdit) {
      this.mode = 'view';
      return;
    }
    const next = this.mode === 'edit' ? 'view' : 'edit';
    // A saved report: switch via the URL (/view/:id <-> /edit/:id) so a
    // reload or shared link lands in the same mode. The route change
    // recreates the builder, which reloads the report in the new mode.
    if (this.activeModuleId) {
      this.router.navigate(['/reports/builder', next, this.activeModuleId]);
      return;
    }
    this.mode = next;
  }

  toggleReportType(): void {
    this.pushHistory();
    if (this.reportType === 'sheet') {
      this.reportType = 'dashboard';
      if (!this.dashboard) {
        this.dashboard = {
          id: 'dash-' + Date.now(),
          name: this.reportName,
          sheets: this.sheets.map((s, i) => ({
            sheetId: s.id,
            x: (i % 2) * 6,
            y: Math.floor(i / 2),
            width: 6,
            height: 1,
          })),
          globalFilters: [],
          globalFilterGlue: ' AND ',
        };
      } else {
        // A sheet may have been added while in sheet mode — make sure every
        // sheet has a card on the dashboard.
        this.syncDashboardSheets();
      }
      // Populate the grid immediately rather than waiting for "Run All".
      this.onDashboardRunAll();
    } else {
      this.reportType = 'sheet';
      if (this.autoRefresh) this.fetchReportData();
    }
  }

  /** Ensure dashboard.sheets has exactly one card per existing sheet. */
  private syncDashboardSheets(): void {
    if (!this.dashboard) return;
    const existing = new Set(this.dashboard.sheets.map((ds) => ds.sheetId));
    const additions = this.sheets
      .filter((s) => !existing.has(s.id))
      .map(
        (s, i) =>
          ({
            sheetId: s.id,
            x: 0,
            y: 0,
            width: 6,
            height: 1,
          }) as DashboardSheet,
      );
    // Drop cards whose sheet was deleted, then append cards for new sheets.
    const live = this.dashboard.sheets.filter((ds) => this.sheets.some((s) => s.id === ds.sheetId));
    this.dashboard = { ...this.dashboard, sheets: [...live, ...additions] };
  }

  // ─── Sheet Management ─────────────────────────────

  onSelectSheet(sheetId: string): void {
    this.activeSheetId = sheetId;
    this.fieldOptions = {};
    // Clear the canvas so it doesn't show the previous sheet's data
    this.reportData = [];
    this.hasNext = false;
    if (this.autoRefresh) this.fetchReportData();
  }

  onAddSheet(): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    const newSheet = createDefaultSheet(
      sheet?.primaryTable || this.dataSources[0]?.id || '',
      `Sheet ${this.sheets.length + 1}`,
    );
    this.sheets = [...this.sheets, newSheet];
    this.activeSheetId = newSheet.id;

    // New sheet starts empty — clear previous sheet's data from the canvas
    this.reportData = [];
    this.hasNext = false;
    this.fieldOptions = {};

    // Add to dashboard if in dashboard mode
    if (this.dashboard) {
      const row = Math.floor(this.dashboard.sheets.length / 2);
      const col = (this.dashboard.sheets.length % 2) * 6;
      this.dashboard.sheets = [
        ...this.dashboard.sheets,
        {
          sheetId: newSheet.id,
          x: col,
          y: row,
          width: 6,
          height: 1,
        },
      ];
    }

    if (this.autoRefresh) this.fetchReportData();
  }

  onRemoveSheet(sheetId: string): void {
    if (this.sheets.length <= 1) return;
    this.pushHistory();
    this.sheets = this.sheets.filter((s) => s.id !== sheetId);
    if (this.activeSheetId === sheetId) {
      this.activeSheetId = this.sheets[0].id;
    }
    if (this.dashboard) {
      this.dashboard.sheets = this.dashboard.sheets.filter((ds) => ds.sheetId !== sheetId);
    }
    if (this.autoRefresh) this.fetchReportData();
  }

  onRenameSheet(event: { id: string; name: string }): void {
    this.sheets = this.sheets.map((s) => (s.id === event.id ? { ...s, name: event.name } : s));
  }

  // ─── Sheet Config Changes ────────────────────────

  onSheetChange(updated: SheetConfig): void {
    this.pushHistory();
    this.sheets = this.sheets.map((s) => (s.id === updated.id ? updated : s));
    if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
  }

  /** Mirror MarksCard's data-labels toggle into the active sheet config. */
  onShowLabelsChange(next: boolean): void {
    if (!this.canEdit) return;
    const sheet = this.activeSheet;
    if (!sheet) return;
    this.pushHistory();
    this.sheets = this.sheets.map((s) => (s.id === sheet.id ? { ...s, showLabels: !!next } : s));
    // No re-fetch needed — labels are a pure render concern.
  }

  onMarksChange(marks: MarkEncoding[]): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    if (sheet) {
      // A mark on a field that is already on a shelf must reuse that column
      // (same date part / aggregation) — otherwise it is queried and shown a
      // second time, e.g. a plain date on Rows plus a default year-month mark.
      const shelf = [...sheet.columnsShelf, ...sheet.rowsShelf];
      marks = marks.map((m) => {
        const hit = shelf.find((c) => c.col === m.field.col);
        return hit ? { ...m, field: { ...m.field, agg: hit.agg, datePart: hit.datePart } } : m;
      });
      this.sheets = this.sheets.map((s) => (s.id === sheet.id ? { ...s, marks } : s));
      if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
    }
  }

  onCalculatedFieldsChange(calcFields: CalculatedField[]): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    if (!sheet) return;

    // Update sheet config (triggers rebuildDerived → updates columnLabels & orderedColumns)
    this.sheets = this.sheets.map((s) =>
      s.id === sheet.id ? { ...s, calculatedFields: calcFields } : s,
    );

    // Re-apply to existing data rows and trigger view update
    if (this._reportData.length > 0) {
      applyCalculatedFields(this._reportData, calcFields);
      // Use the backing field + manual rebuild to avoid double rebuild
      this.rebuildDerived();
      this.cdr.detectChanges();
    }
  }

  onPreviewDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    this.previewDragOver = true;
  }

  onPreviewDrop(event: DragEvent): void {
    event.preventDefault();
    this.previewDragOver = false;
    try {
      const json = event.dataTransfer!.getData('application/json');
      if (!json) return;
      const field: FlatField = JSON.parse(json);
      this.onFieldDoubleClick(field); // reuse same logic — measures to rows, dimensions to columns
    } catch {}
  }

  onFieldDoubleClick(field: FlatField): void {
    const sheet = this.activeSheet;
    if (!sheet) return;
    // Check if already in shelves
    const existing = [...sheet.columnsShelf, ...sheet.rowsShelf];
    if (existing.find((c) => c.col === field.fullId)) return;

    // Auto-resolve the join chain so picking a field from any related table
    // "just works" — null means the table can't be linked, so don't add a
    // column the backend would reject.
    const addJoins = this.joinsToReach(field.fullId, sheet);
    if (addJoins === null) {
      this.flashJoinNotice(field.table);
      return;
    }

    this.pushHistory();
    const newCol: ReportColumn = {
      col: field.fullId,
      agg: field.type === 'number' ? 'sum' : '',
      datePart: field.type === 'date' ? 'yearmonth' : '',
      key: Date.now() + '-' + field.fullId,
    };

    // Measures go to rows (Y-axis), dimensions go to columns (X-axis)
    if (newCol.agg) {
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id
          ? { ...s, joins: [...s.joins, ...addJoins], rowsShelf: [...s.rowsShelf, newCol] }
          : s,
      );
    } else {
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id
          ? { ...s, joins: [...s.joins, ...addJoins], columnsShelf: [...s.columnsShelf, newCol] }
          : s,
      );
    }

    if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
  }

  onAddToShelf(event: {
    field: FlatField;
    target: 'columns' | 'rows' | 'filters' | 'group';
  }): void {
    const sheet = this.activeSheet;
    if (!sheet) return;

    if (event.target === 'group') {
      // Formulas can't be a grouping dimension.
      if (event.field.isFormula) {
        this.setJoinNotice(this.translate.instant('CUSTOM_REPORTS.NOTICES.FORMULA_NO_GROUP_BY'));
        return;
      }
      const addJoins = this.joinsToReach(event.field.fullId, sheet);
      if (addJoins === null) {
        this.flashJoinNotice(event.field.table);
        return;
      }
      this.pushHistory();
      // Single field — replaces any existing group-by.
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id
          ? { ...s, joins: [...s.joins, ...addJoins], groupBy: event.field.fullId }
          : s,
      );
      if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
      return;
    }

    if (event.target === 'filters') {
      if (event.field.filterable === false) {
        this.setJoinNotice(
          this.translate.instant('CUSTOM_REPORTS.NOTICES.NOT_FILTERABLE', {
            field: event.field.label,
          }),
        );
        return;
      }
      const addJoins = this.joinsToReach(event.field.fullId, sheet);
      if (addJoins === null) {
        this.flashJoinNotice(event.field.table);
        return;
      }
      this.pushHistory();
      const newFilter: FilterRule = {
        field: event.field.fullId,
        type: event.field.type,
        condition: { type: 'equal', filter: '' },
        includes: [],
        ...(event.field.isFormula ? { isFormula: true } : {}),
      };
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id
          ? { ...s, joins: [...s.joins, ...addJoins], filterRules: [...s.filterRules, newFilter] }
          : s,
      );
      // Formula fields have no distinct-value option list; only real FK columns do.
      if (!event.field.isFormula && event.field.id.endsWith('Id')) {
        this.loadFieldOptionsFor(event.field.fullId);
      }
      if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
      return;
    }

    const existing = [...sheet.columnsShelf, ...sheet.rowsShelf];
    if (existing.find((c) => c.col === event.field.fullId)) return;

    const addJoins = this.joinsToReach(event.field.fullId, sheet);
    if (addJoins === null) {
      this.flashJoinNotice(event.field.table);
      return;
    }

    this.pushHistory();
    const newCol: ReportColumn = {
      col: event.field.fullId,
      agg: event.field.type === 'number' ? 'sum' : '',
      datePart: event.field.type === 'date' ? 'yearmonth' : '',
      key: Date.now() + '-' + event.field.fullId,
    };

    if (event.target === 'columns') {
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id
          ? { ...s, joins: [...s.joins, ...addJoins], columnsShelf: [...s.columnsShelf, newCol] }
          : s,
      );
    } else {
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id
          ? { ...s, joins: [...s.joins, ...addJoins], rowsShelf: [...s.rowsShelf, newCol] }
          : s,
      );
    }
    if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
  }

  // ─── Chart Type ───────────────────────────────────

  setChartType(type: string): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    if (sheet) {
      this.sheets = this.sheets.map((s) => (s.id === sheet.id ? { ...s, chartType: type } : s));
    }
  }

  // ─── Show Me (chart-type picker popover) ──────────

  toggleShowMe(): void {
    this.showMeOpen = !this.showMeOpen;
    if (!this.showMeOpen) this.showMeHover = null;
  }

  closeShowMe(): void {
    this.showMeOpen = false;
    this.showMeHover = null;
  }

  /** Pick a chart type from the Show Me popover and close it. */
  pickChartType(type: string): void {
    this.setChartType(type);
    this.closeShowMe();
  }

  /** Description shown in the Show Me popover footer — the hovered tile's
   *  note, falling back to the currently-active chart type. */
  get showMeDescription(): ChartTypeDef | null {
    return this.showMeHover || this.activeChartTile;
  }

  // ─── Primary Table ────────────────────────────────

  setPrimaryTable(tableId: string): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    if (sheet) {
      // Field paths are relative to the entity, so filters and sorts from the
      // previous one no longer resolve either.
      this.expandedNodes.clear();
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id
          ? {
              ...s,
              primaryTable: tableId,
              joins: [],
              columnsShelf: [],
              rowsShelf: [],
              marks: [],
              filterRules: [],
              sortBy: [],
              groupBy: undefined,
            }
          : s,
      );
      this.fieldOptions = {};
    }
  }

  // ─── Relations (v2 catalog) ───────────────────────

  /**
   * v2 resolves joins on the server from field paths (`product.name`), so a
   * field from any node of the field tree can be used directly. Kept as the
   * single gate the shelf handlers call: null refuses a field past the
   * backend's hop limit.
   */
  private joinsToReach(fullId: string, _sheet: SheetConfig): ReportJoin[] | null {
    return hopsOf(nodeOfField(fullId)) <= MAX_RELATION_HOPS ? [] : null;
  }

  /** Expand / collapse a relation group in the field tree. */
  toggleRelation(nodeId: string): void {
    if (this.expandedNodes.has(nodeId)) {
      // Collapse its subtree too; nodes the sheet uses stay visible regardless.
      for (const n of [...this.expandedNodes]) {
        if (n === nodeId || n.startsWith(nodeId + '.')) this.expandedNodes.delete(n);
      }
    } else {
      this.expandedNodes.add(nodeId);
    }
    this.rebuildDerived();
  }

  /** Transient banner shown when a picked field can't be used. */
  joinNotice: string | null = null;
  private joinNoticeTimer: any = null;

  /** Show a transient banner message that auto-clears after a few seconds. */
  private setJoinNotice(message: string): void {
    this.joinNotice = message;
    if (this.joinNoticeTimer) clearTimeout(this.joinNoticeTimer);
    this.joinNoticeTimer = setTimeout(() => {
      this.joinNotice = null;
      this.cdr.markForCheck();
    }, 6000);
  }

  /** Briefly surface that a relation path is too deep to use. */
  private flashJoinNotice(nodeId: string): void {
    this.setJoinNotice(
      this.translate.instant('CUSTOM_REPORTS.NOTICES.CANT_LINK_TABLE', {
        table: nodeLabel(this.catalogIndex, nodeId),
      }),
    );
  }

  // ─── Sort ─────────────────────────────────────────

  /**
   * Open the Add-sort picker modal. Pre-populates the choices with every
   * column currently on the shelves that isn't already in sortBy.
   */
  addSort(): void {
    const { columns } = shelvesToApiParams(this.activeSheet);
    if (columns.length === 0) return;
    const alreadySorted = new Set(this.activeSheet.sortBy.map((s) => s.id));
    this.addSortChoices = columns
      .filter((k) => !alreadySorted.has(k))
      .map((k) => ({ key: k, label: this.labelForKey(k) }));
    if (this.addSortChoices.length === 0) return; // every column already sorted
    this.addSortSelectedKey = this.addSortChoices[0].key;
    this.addSortDir = 'ASC';
    this.showAddSortDialog = true;
  }

  closeAddSortDialog(): void {
    this.showAddSortDialog = false;
  }

  /** Append the chosen column to sortBy, then close the dialog. */
  confirmAddSort(): void {
    if (!this.addSortSelectedKey) return;
    this.pushHistory();
    const sheet = this.activeSheet;
    const newEntry = { id: this.addSortSelectedKey, mod: this.addSortDir };
    this.sheets = this.sheets.map((s) =>
      s.id === sheet.id ? { ...s, sortBy: [...s.sortBy, newEntry] } : s,
    );
    this.showAddSortDialog = false;
    if (this.autoRefresh) this.fetchReportData();
  }

  // ─── Sort list drag-reorder ───────────────────────

  onSortDragStart(event: DragEvent, index: number): void {
    this.sortDragIndex = index;
    event.dataTransfer!.effectAllowed = 'move';
  }

  onSortDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onSortDrop(event: DragEvent, toIndex: number): void {
    event.preventDefault();
    const from = this.sortDragIndex;
    this.sortDragIndex = null;
    if (from === null || from === toIndex) return;
    this.pushHistory();
    const sheet = this.activeSheet;
    const list = [...sheet.sortBy];
    const [moved] = list.splice(from, 1);
    list.splice(toIndex, 0, moved);
    this.sheets = this.sheets.map((s) => (s.id === sheet.id ? { ...s, sortBy: list } : s));
    if (this.autoRefresh) this.fetchReportData();
  }

  removeSort(index: number): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    this.sheets = this.sheets.map((s) =>
      s.id === sheet.id ? { ...s, sortBy: s.sortBy.filter((_, i) => i !== index) } : s,
    );
  }

  toggleSortDir(index: number): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    this.sheets = this.sheets.map((s) =>
      s.id === sheet.id
        ? {
            ...s,
            sortBy: s.sortBy.map((sr, i) =>
              i === index ? { ...sr, mod: sr.mod === 'ASC' ? 'DESC' : 'ASC' } : sr,
            ),
          }
        : s,
    );
  }

  // ─── View Mode Run ────────────────────────────────

  onViewModeRun(event: {
    filters: FilterRule[];
    glue: string;
    page: number;
    pageSize: number;
  }): void {
    const sheet = this.activeSheet;
    if (sheet) {
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id
          ? {
              ...s,
              filterRules: event.filters,
              filterGlue: event.glue,
              currentPage: event.page,
              pageSize: event.pageSize,
            }
          : s,
      );
      this.fetchReportData(true);
    }
  }

  // ─── Pagination ───────────────────────────────────

  onSortChange(event: { key: string; dir: 'ASC' | 'DESC' }): void {
    const sheet = this.activeSheet;
    if (!sheet) return;
    // Replace sort with the clicked column (server-side sort = single column)
    this.sheets = this.sheets.map((s) =>
      s.id === sheet.id ? { ...s, sortBy: [{ id: event.key, mod: event.dir }], currentPage: 1 } : s,
    );
    this.fetchReportData(true);
  }

  onPageChange(page: number): void {
    const sheet = this.activeSheet;
    if (sheet) {
      this.sheets = this.sheets.map((s) => (s.id === sheet.id ? { ...s, currentPage: page } : s));
      this.fetchReportData(true);
    }
  }

  onPageSizeChange(size: number): void {
    const sheet = this.activeSheet;
    if (sheet) {
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id ? { ...s, pageSize: size, currentPage: 1 } : s,
      );
      this.fetchReportData(true);
    }
  }

  // ─── Dashboard ────────────────────────────────────

  onDashboardGlobalFilters(event: { filters: FilterRule[]; glue: string }): void {
    if (this.dashboard) {
      this.dashboard = {
        ...this.dashboard,
        globalFilters: event.filters,
        globalFilterGlue: event.glue,
      };
    }
  }

  /** Card resize / reorder from the dashboard canvas. */
  onDashboardLayoutChange(sheets: DashboardSheet[]): void {
    if (!this.dashboard) return;
    this.pushHistory();
    this.dashboard = { ...this.dashboard, sheets };
  }

  // ─── Dashboard "Arrange layout" (shared layout editor) ──────────
  arrangeOpen = false;
  arrangeRows: DashboardRow[] = [];

  /** Open the shared layout editor to arrange the dashboard's sheets. */
  openArrange(): void {
    if (!this.dashboard) return;
    this.syncDashboardSheets();
    this.arrangeRows = this.sheetsToRows();
    this.arrangeOpen = true;
  }

  closeArrange(): void {
    this.arrangeOpen = false;
  }

  /** Apply the arranged rows back to the dashboard (order + width). */
  applyArrange(): void {
    if (!this.dashboard) {
      this.arrangeOpen = false;
      return;
    }
    this.pushHistory();
    this.dashboard = { ...this.dashboard, sheets: this.rowsToSheets(this.arrangeRows) };
    this.arrangeOpen = false;
    this.onDashboardRunAll();
  }

  /** Map dashboard sheets → editor rows (packed left-to-right into 12 cols). */
  private sheetsToRows(): DashboardRow[] {
    const rows: DashboardRow[] = [];
    let row = new DashboardRow();
    let used = 0;
    for (const ds of this.dashboard?.sheets || []) {
      const sheet = this.sheets.find((s) => s.id === ds.sheetId);
      if (!sheet) continue;
      const w = new DashboardWidgets();
      w.slug = ds.sheetId;
      w.title = sheet.name || 'Sheet';
      w.colSpan = ds.width || 6;
      w.isCustom = false;
      if (used + w.colSpan > 12 && row.widgets.length) {
        rows.push(row);
        row = new DashboardRow();
        used = 0;
      }
      w.rowId = row.id;
      row.widgets.push(w);
      used += w.colSpan;
    }
    if (row.widgets.length) rows.push(row);
    return rows;
  }

  /** Flatten editor rows → dashboard sheets (order preserved, width = colSpan). */
  private rowsToSheets(rows: DashboardRow[]): DashboardSheet[] {
    const out: DashboardSheet[] = [];
    rows.forEach((r) =>
      r.widgets.forEach((w) => {
        out.push({ sheetId: w.slug, x: 0, y: 0, width: w.colSpan || 6, height: 1 });
      }),
    );
    return out;
  }

  async onDashboardRunAll(): Promise<void> {
    if (!this.dashboard) return;
    this.dashboardSheetsLoading = new Set(this.dashboard.sheets.map((ds) => ds.sheetId));
    this.cdr.detectChanges();

    const results = await Promise.all(
      this.dashboard.sheets.map(async (ds) => {
        const sheet = this.sheets.find((s) => s.id === ds.sheetId);
        if (!sheet || sheetColumns(sheet).length === 0)
          return { sheetId: ds.sheetId, data: [] as any[] };
        try {
          // Global filters only apply to sheets on the same entity — their
          // field paths are relative to it.
          const extraFilters = (this.dashboard?.globalFilters || []).filter(
            (r) => r.field.split('.')[0] === sheet.primaryTable,
          );
          const spec = sheetToSpec(sheet, { index: this.catalogIndex, extraFilters, page: 1 });
          const result = await this.reportsV2.run(spec);
          return { sheetId: ds.sheetId, data: this.shapeRunResult(result, sheet).rows };
        } catch (err) {
          console.error('[CustomReports] Dashboard sheet failed:', ds.sheetId, err);
          return { sheetId: ds.sheetId, data: [] as any[] };
        }
      }),
    );

    const newMap = new Map<string, any[]>();
    results.forEach((r) => newMap.set(r.sheetId, r.data));
    this.dashboardSheetsData = newMap;
    this.dashboardSheetsLoading = new Set();
    this.cdr.detectChanges();
  }

  // ─── Undo / Redo ──────────────────────────────────

  private getSnapshot(): string {
    const snap: BuilderSnapshotV2 = {
      sheets: this.sheets,
      activeSheetId: this.activeSheetId,
      dashboard: this.dashboard || undefined,
      mode: this.mode,
    };
    return JSON.stringify(snap);
  }

  pushHistory(): void {
    this.history = [...this.history.slice(-19), this.getSnapshot()];
    this.future = [];
  }

  undo(): void {
    if (this.history.length === 0) return;
    const prev: BuilderSnapshotV2 = JSON.parse(this.history[this.history.length - 1]);
    this.future = [...this.future, this.getSnapshot()];
    this.history = this.history.slice(0, -1);
    this.applySnapshot(prev);
  }

  redo(): void {
    if (this.future.length === 0) return;
    const next: BuilderSnapshotV2 = JSON.parse(this.future[this.future.length - 1]);
    this.history = [...this.history, this.getSnapshot()];
    this.future = this.future.slice(0, -1);
    this.applySnapshot(next);
  }

  private applySnapshot(snap: BuilderSnapshotV2): void {
    this.sheets = snap.sheets;
    this.activeSheetId = snap.activeSheetId;
    this.dashboard = snap.dashboard || null;
    this.mode = snap.mode;
    if (this.autoRefresh) this.fetchReportData();
  }

  // ─── Save / Load ─────────────────────────────────

  async saveReport(): Promise<void> {
    if (!this.canEdit) return;
    if (this.isDefaultReportName()) {
      // Reports saved as "Untitled report" can't be told apart in the list.
      this.nameError = this.translate.instant('CUSTOM_REPORTS.BUILDER.NAME_REQUIRED');
      // The Report Name field lives on the General tab.
      this.activeNav = 'general';
      return;
    }
    this.nameError = null;
    this.saving = true;
    this.saveError = null;
    try {
      const ui: ReportConfig = {
        version: 2,
        type: this.reportType,
        activeSheetId: this.activeSheetId,
        sheets: this.sheets,
        dashboard: this.dashboard || undefined,
      };

      // The spec's own query is the active sheet (else the first sheet with
      // columns) — what the AI, MCP clients and other v2 readers run. `ui`
      // carries every sheet and its presentation; the backend stores it as is.
      const primary = sheetColumns(this.activeSheet).length
        ? this.activeSheet
        : this.sheets.find((s) => sheetColumns(s).length > 0) || this.activeSheet;
      const spec: ReportSpecV2 = {
        ...sheetToSpec(primary, { index: this.catalogIndex, page: 1, withCalculated: true }),
        ui,
      };

      const result = await this.reportsV2.saveSpec({
        ...(this.activeModuleId ? { id: this.activeModuleId } : {}),
        name: this.reportName,
        spec,
        isShared: this.isShared,
      });

      const wasNew = !this.activeModuleId;
      if (wasNew && result?.id) {
        this.activeModuleId = result.id;
      }
      this.lastSavedAt = new Date();

      // First save of a report opened from the old builder: the v2 copy now
      // exists, so offer to remove the old one (only on the user's say-so).
      if (this.legacyModuleId && this.activeModuleId) {
        const oldId = this.legacyModuleId;
        this.legacyModuleId = null;
        this.offerLegacyDelete(oldId);
      }

      // First save of a brand-new report — move the URL from
      // `/custom-report/new` to `/custom-report/edit/<id>` so a reload or
      // shared link opens the saved module. `replaceUrl: true` so the
      // history stack doesn't get a stale `/new` entry behind us.
      if (wasNew && this.activeModuleId) {
        this.router.navigate(['/reports/builder', 'edit', this.activeModuleId], {
          replaceUrl: true,
        });
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      this.saveError =
        err instanceof SpecBuildError
          ? this.translate.instant(err.messageKey, err.params)
          : err?.message ||
            err?.msg ||
            this.translate.instant('CUSTOM_REPORTS.BUILDER.SAVE_FAILED');
    }
    this.saving = false;
  }

  private async offerLegacyDelete(moduleId: string): Promise<void> {
    // Pre-translated: the helper's root TranslateService may not have this
    // feature's lazily loaded strings.
    // invo-portal2: the SweetAlert confirm becomes the shared ConfirmModal.
    const confirmed = await this.modal
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        size: 'sm',
        data: {
          title: this.translate.instant('CUSTOM_REPORTS.BUILDER.LEGACY_DELETE_TITLE'),
          message: this.translate.instant('CUSTOM_REPORTS.BUILDER.LEGACY_DELETE_TEXT'),
          confirm: this.translate.instant('CUSTOM_REPORTS.BUILDER.LEGACY_DELETE_CONFIRM'),
          cancel: this.translate.instant('CUSTOM_REPORTS.BUILDER.LEGACY_DELETE_KEEP'),
        },
      })
      .afterClosed();
    if (!confirmed) return;
    try {
      await this.customReports.deleteModule(moduleId);
    } catch (err) {
      console.error('[CustomReports] Could not delete the old report:', err);
    }
  }

  // ─── New UI helpers (visual only — no data/service impact) ──

  get statusLabel(): string {
    return this.activeModuleId
      ? 'CUSTOM_REPORTS.BUILDER.PUBLISHED'
      : 'CUSTOM_REPORTS.BUILDER.DRAFT';
  }

  get savedAgoText(): { key: string; params?: { n: number } } {
    if (!this.lastSavedAt) return { key: 'CUSTOM_REPORTS.BUILDER.NOT_SAVED_YET' };
    const diff = Math.floor((Date.now() - this.lastSavedAt.getTime()) / 1000);
    if (diff < 5) return { key: 'CUSTOM_REPORTS.BUILDER.SAVED_JUST_NOW' };
    if (diff < 60) return { key: 'CUSTOM_REPORTS.BUILDER.SAVED_SEC_AGO', params: { n: diff } };
    const min = Math.floor(diff / 60);
    if (min < 60) return { key: 'CUSTOM_REPORTS.BUILDER.SAVED_MIN_AGO', params: { n: min } };
    const hr = Math.floor(min / 60);
    if (hr < 24) return { key: 'CUSTOM_REPORTS.BUILDER.SAVED_HR_AGO', params: { n: hr } };
    const day = Math.floor(hr / 24);
    return { key: 'CUSTOM_REPORTS.BUILDER.SAVED_DAY_AGO', params: { n: day } };
  }

  /** Empty, or still the placeholder name (in English or the UI language). */
  private isDefaultReportName(): boolean {
    const name = (this.reportName || '').trim().toLowerCase();
    if (!name) return true;
    const placeholder = (this.translate.instant('CUSTOM_REPORTS.BUILDER.UNTITLED_REPORT') as string)
      .trim()
      .toLowerCase();
    return name === 'untitled report' || name === placeholder;
  }

  commitName(): void {
    this.editingName = false;
    if (!this.reportName.trim())
      this.reportName = this.translate.instant('CUSTOM_REPORTS.BUILDER.UNTITLED_REPORT');
    this.onNameChange();
  }

  /** Drops the "name required" error once the name is acceptable. */
  onNameChange(): void {
    if (this.nameError && !this.isDefaultReportName()) this.nameError = null;
  }

  onNameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === 'Escape') {
      (event.target as HTMLElement).blur();
    }
  }

  /** Filtered + sorted modules for the right-panel "Recent" group (newest first) */
  get filteredModules(): SavedModule[] {
    const q = this.moduleSearch.toLowerCase().trim();
    const toTime = (m: any): number => {
      const v = m?.updated ?? m?.updatedAt ?? m?.created ?? m?.createdAt;
      if (!v) return 0;
      const t = new Date(v).getTime();
      return isNaN(t) ? 0 : t;
    };
    let list = [...this.modules].sort((a, b) => toTime(b) - toTime(a));
    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q));
    return list;
  }

  get visibleModules(): SavedModule[] {
    const list = this.filteredModules;
    return this.showAllModules ? list : list.slice(0, 5);
  }

  get hiddenModuleCount(): number {
    return Math.max(0, this.filteredModules.length - 5);
  }

  /** Best-effort chart type extraction from a saved module's text */
  getModuleChartType(m: SavedModule): string {
    try {
      const cfg = JSON.parse(m.text);
      if (cfg?.sheets?.length) {
        const s = cfg.sheets.find((x: any) => x.id === cfg.activeSheetId) || cfg.sheets[0];
        return s?.chartType || '';
      }
      return cfg?.type || cfg?.meta?.chart || '';
    } catch {
      return '';
    }
  }

  getModuleMeta(m: SavedModule): string {
    const ct = this.getModuleChartType(m);
    const parts: string[] = [];
    parts.push('Saved module');
    if (ct) parts.push(ct);
    return parts.join(' · ');
  }

  isFavorite(id: string): boolean {
    return this.favoriteModuleIds.has(id);
  }

  toggleFavorite(event: Event, id: string): void {
    event.stopPropagation();
    if (this.favoriteModuleIds.has(id)) this.favoriteModuleIds.delete(id);
    else this.favoriteModuleIds.add(id);
    this.persistFavorites();
  }

  private loadFavorites(): void {
    try {
      const raw = localStorage.getItem(this.FAV_STORAGE_KEY);
      if (raw) this.favoriteModuleIds = new Set(JSON.parse(raw));
    } catch {}
  }

  private persistFavorites(): void {
    try {
      localStorage.setItem(this.FAV_STORAGE_KEY, JSON.stringify([...this.favoriteModuleIds]));
    } catch {}
  }

  /** Jump the right panel to the Saved modules list and focus the search */
  jumpToSavedModules(): void {
    this.activeNav = 'general';
    this.showAllModules = false;
    setTimeout(() => {
      const el = document.querySelector('.modules-search input') as HTMLInputElement | null;
      el?.focus();
    }, 50);
  }

  /** Reset to a blank report (new) */
  newReport(): void {
    if (!this.canEdit) return;
    if (this.dataSources.length === 0) return;
    this.pushHistory();
    const sheet = createDefaultSheet(this.dataSources[0].id);
    this.sheets = [sheet];
    this.activeSheetId = sheet.id;
    this.activeModuleId = null;
    this.legacyModuleId = null;
    this.isShared = true;
    this.reportName = 'Untitled report';
    this.lastSavedAt = null;
    this.reportData = [];
  }

  /**
   * Open a saved report by id: a v2 spec, else a module from the old builder
   * (converted on open; saving creates its v2 copy).
   */
  async openSavedReport(id: string): Promise<void> {
    this.loadError = null;
    let report: OpenedReport | null;
    try {
      report = await this.savedReports.open(id);
    } catch (err: any) {
      // An old report /v2/fromLegacy refused (e.g. a join type no longer
      // allowed): show its message; the old module is left untouched.
      console.error('[CustomReports] Could not open report:', err);
      this.loadError = this.translate.instant('CUSTOM_REPORTS.BUILDER.LEGACY_CONVERT_FAILED', {
        msg: err?.message || '',
      });
      return;
    }
    if (!report) {
      this.loadError = this.translate.instant('CUSTOM_REPORTS.BUILDER.REPORT_NOT_FOUND');
      return;
    }

    this.pushHistory();
    this.sheets = report.sheets;
    this.activeSheetId = report.activeSheetId;
    this.reportType = report.type;
    this.dashboard = report.dashboard;
    if (report.droppedFilters) {
      this.setJoinNotice(
        this.translate.instant('CUSTOM_REPORTS.NOTICES.FILTERS_DROPPED', {
          n: report.droppedFilters,
        }),
      );
    }
    // An old module has no v2 id yet: saving creates the v2 report.
    this.activeModuleId = report.legacy ? null : report.id;
    this.legacyModuleId = report.legacy ? report.id : null;
    this.reportName = report.name;
    this.isShared = report.isShared;
    await this.afterReportLoaded();
  }

  private async afterReportLoaded(): Promise<void> {
    await this.fetchReportData(true);
    // Dashboard reports also need their per-card data populated on load.
    if (this.reportType === 'dashboard' && this.dashboard) {
      this.syncDashboardSheets();
      this.onDashboardRunAll();
    }
  }

  /**
   * Load a spec from the Ask AI panel into the builder — same as opening a
   * saved report, but nothing is saved until the user presses Save.
   */
  applyAiSpec(spec: ReportSpecV2): void {
    if (!this.canEdit) return;
    this.pushHistory();
    const current = this.activeSheet;
    const { sheet, droppedFilters, hasCalculated } = specToSheet(spec, {
      index: this.catalogIndex,
      name: current?.name,
    });
    // Replace the active sheet in place so other sheets / the dashboard stay.
    sheet.id = current?.id || sheet.id;
    sheet.chartType = current && sheetColumns(current).length ? current.chartType : sheet.chartType;
    // The AI sees the open report's calculated fields and returns the full
    // list when it touches them; otherwise keep those whose inputs remain.
    if (!hasCalculated) {
      sheet.calculatedFields = keepResolvableCalculatedFields(
        current?.calculatedFields || [],
        sheet,
      );
    }
    this.sheets = this.sheets.length
      ? this.sheets.map((s) => (s.id === sheet.id ? sheet : s))
      : [sheet];
    this.activeSheetId = sheet.id;
    if (droppedFilters)
      this.setJoinNotice(
        this.translate.instant('CUSTOM_REPORTS.NOTICES.FILTERS_DROPPED', { n: droppedFilters }),
      );
    this.fetchReportData(true);
  }

  /**
   * The active sheet as a spec, sent with follow-up AI questions ("add the
   * branch"). A function, not a getter, so the panel builds it only on send.
   */
  currentSpecForAi = (): ReportSpecV2 | null => {
    try {
      return sheetColumns(this.activeSheet).length
        ? sheetToSpec(this.activeSheet, { index: this.catalogIndex, page: 1, withCalculated: true })
        : null;
    } catch {
      return null;
    }
  };

  loadQuery(q: SavedQuery): void {
    this.pushHistory();
    try {
      const cfg = JSON.parse(q.text);
      const sheet = this.activeSheet;
      if (sheet) {
        this.sheets = this.sheets.map((s) =>
          s.id === sheet.id
            ? { ...s, filterRules: cfg.rules || [], filterGlue: cfg.glue || ' AND ' }
            : s,
        );
        if (this.autoRefresh) this.fetchReportData();
      }
    } catch {}
  }

  // ─── Run ──────────────────────────────────────────

  runReport(): void {
    this.fetchReportData(true);
  }

  // ─── Column Reorder Dialog ────────────────────────

  onOpenReorder(): void {
    this.reorderList =
      this.orderedColumns.length > 0
        ? this.orderedColumns.map((k) => ({
            key: k,
            label: this.getFieldLabel(k) || this.labelForKey(k),
          }))
        : this.dataKeys.map((k) => ({ key: k, label: this.labelForKey(k) }));
    this.showReorderDialog = true;
  }

  closeReorderDialog(): void {
    this.showReorderDialog = false;
  }

  moveColumnUp(index: number): void {
    if (index <= 0) return;
    const list = [...this.reorderList];
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    this.reorderList = list;
  }

  moveColumnDown(index: number): void {
    if (index >= this.reorderList.length - 1) return;
    const list = [...this.reorderList];
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
    this.reorderList = list;
  }

  applyReorder(): void {
    this.setColumnOrder(this.reorderList.map((r) => r.key));
    this.showReorderDialog = false;
  }

  /**
   * Apply a new display order by reordering the shelf fields themselves, so
   * the order is saved with the report and seen by every reader of the spec.
   * `keys` are result-column keys (`datePart.col` / `agg.col` / `col`); keys
   * that aren't shelf fields (marks, calculated fields) keep their place at
   * the end. Within a shelf the fields are just reordered; if the new order
   * interleaves the two shelves, all of them move into the columns shelf.
   */
  setColumnOrder(keys: string[]): void {
    const sheet = this.activeSheet;
    if (!sheet) return;

    const keyOf = (c: ReportColumn) =>
      c.datePart ? `${c.datePart}.${c.col}` : c.agg ? `${c.agg}.${c.col}` : c.col;
    const tagged = [
      ...sheet.columnsShelf.map((c) => ({ c, shelf: 'columns' as const })),
      ...sheet.rowsShelf.map((c) => ({ c, shelf: 'rows' as const })),
    ];
    const ordered: typeof tagged = [];
    for (const k of keys) {
      const i = tagged.findIndex((t) => keyOf(t.c) === k);
      if (i >= 0) ordered.push(...tagged.splice(i, 1));
    }
    ordered.push(...tagged); // shelf fields the keys didn't mention

    const firstRows = ordered.findIndex((t) => t.shelf === 'rows');
    const interleaved =
      firstRows >= 0 && ordered.slice(firstRows).some((t) => t.shelf === 'columns');
    const columnsShelf = interleaved
      ? ordered.map((t) => t.c)
      : ordered.filter((t) => t.shelf === 'columns').map((t) => t.c);
    const rowsShelf = interleaved ? [] : ordered.filter((t) => t.shelf === 'rows').map((t) => t.c);

    const unchanged =
      columnsShelf.length === sheet.columnsShelf.length &&
      columnsShelf.every((c, i) => c === sheet.columnsShelf[i]) &&
      rowsShelf.length === sheet.rowsShelf.length &&
      rowsShelf.every((c, i) => c === sheet.rowsShelf[i]);
    if (unchanged) return;

    this.pushHistory();
    this.sheets = this.sheets.map((s) =>
      s.id === sheet.id ? { ...s, columnsShelf, rowsShelf } : s,
    );
  }

  onReorderDragStart(event: DragEvent, index: number): void {
    this.reorderDragIndex = index;
    this.reorderDragOverIndex = null;
    event.dataTransfer!.effectAllowed = 'move';
  }

  onReorderDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    // Compute whether the cursor is in the top or bottom half of the row;
    // top half → drop before this row, bottom half → drop after.
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const after = event.clientY - rect.top > rect.height / 2;
    this.reorderDragOverIndex = after ? index + 1 : index;
  }

  onReorderDragLeave(): void {
    // Don't clear on every leave — the next dragover from a sibling row will
    // overwrite. Only clear in dragend / drop.
  }

  onReorderDragEnd(): void {
    this.reorderDragIndex = null;
    this.reorderDragOverIndex = null;
  }

  onReorderDrop(event: DragEvent, toIndex: number): void {
    event.preventDefault();
    const from = this.reorderDragIndex;
    // Use the placeholder position (which accounts for top/bottom half) when
    // available, otherwise fall back to the row that received the drop.
    let to = this.reorderDragOverIndex !== null ? this.reorderDragOverIndex : toIndex;
    this.reorderDragIndex = null;
    this.reorderDragOverIndex = null;
    if (from === null) return;
    // Removing the source shifts subsequent indices down by 1.
    if (to > from) to -= 1;
    if (to === from) return;
    const list = [...this.reorderList];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    this.reorderList = list;
  }

  /**
   * Friendly display label for a column key.
   * Priority:
   *   1. Explicit alias in `columnLabels` (user-set, or calculated field name).
   *   2. Aggregation prefix → `SUM(field)` / `COUNT(field)` / `AVG(field)` …
   *   3. Date-part prefix   → `yearmonth(field)` / `month(field)` / `day(field)` …
   *   4. Bare field name (last `.`-segment).
   *   5. The raw key as-is.
   *
   * Used by the column reorder dialog AND by the CSV / XLSX exporter so the
   * downloaded file's headers read the same as the on-screen preview.
   */
  /** Friendly name for a formula column key "Table.@key" — the backend formula
   *  name, or the bare key (sans @) when its metadata isn't loaded. */
  private formulaLabel(fullId: string): string {
    const f = this.allFields.find((x) => x.fullId === fullId && x.isFormula);
    if (f) return f.label;
    const leaf = fullId.split('.').pop() || fullId;
    return leaf.startsWith('@') ? leaf.slice(1) : leaf;
  }

  private labelForKey(key: string): string {
    if (this.columnLabels[key]) return this.columnLabels[key];
    const parts = (key || '').split('.');
    // A formula leaf ("@key") resolves to the formula's name; plain leaves pass through.
    const leaf = (table: string, seg: string): string =>
      seg && seg.startsWith('@') ? this.formulaLabel(table + '.' + seg) : seg;
    if (parts.length >= 3 && ['sum', 'count', 'avg', 'max', 'min'].includes(parts[0])) {
      return parts[0].toUpperCase() + '(' + leaf(parts[1], parts[parts.length - 1]) + ')';
    }
    if (
      parts.length >= 3 &&
      ['year', 'month', 'day', 'yearmonth', 'yearmonthday'].includes(parts[0])
    ) {
      return parts[0] + '(' + leaf(parts[1], parts[parts.length - 1]) + ')';
    }
    if (parts.length >= 2) return leaf(parts[0], parts[parts.length - 1]);
    return key || '';
  }

  // ─── Export ───────────────────────────────────────

  toggleExport(): void {
    this.exportOpen = !this.exportOpen;
  }

  closeExport(): void {
    this.exportOpen = false;
  }

  async exportAs(format: string): Promise<void> {
    this.exportOpen = false;
    if (this.exporting) return;
    const baseName =
      (this.reportName || 'report').replace(/[^a-z0-9-_ ]/gi, '_').trim() || 'report';

    this.exporting = true;
    this.cdr.detectChanges();
    // Give the browser a tick to paint the spinner before we kick off the
    // potentially heavy fetch / file-build. Without this yield, a fast
    // local-cached fetch + synchronous XLSX write can run in a single
    // microtask and the spinner never visibly appears.
    await new Promise((r) => setTimeout(r, 0));
    try {
      // CSV / XLSX / PDF need full data — refetch every row regardless of
      // pagination. PNG is a visual screenshot (chart image) so the visible
      // canvas is enough; no fetch needed.
      const needsAllData = format !== 'png';
      const rows = needsAllData ? await this.fetchAllForExport() : this.reportData;

      // Yield once more before the synchronous file-write step so the
      // spinner repaints between "fetching" and "writing" instead of the
      // UI thread blocking through the whole sequence.
      await new Promise((r) => setTimeout(r, 0));

      if (format === 'csv') {
        this.exportCsv(baseName, rows);
        return;
      }
      if (format === 'xlsx') {
        this.exportXlsx(baseName, rows);
        return;
      }
      if (format === 'pdf') {
        await this.exportPdf(baseName, rows);
        return;
      }
      if (format === 'png') {
        await this.exportPng(baseName);
        return;
      }
    } catch (err) {
      console.error('[CustomReports] Export failed:', err);
    } finally {
      this.exporting = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Refetch every row for the active sheet, ignoring on-screen pagination.
   * A single request with `limit: null` instructs the service to emit an
   * empty `limit` field on the wire — the backend treats that as "return
   * everything". No client-side chunking; the backend handles whatever
   * size the result set is.
   *
   * Coerces numeric columns and applies calculated fields the same way
   * `fetchReportData` does, so consumers see the same shape as the preview.
   */
  private async fetchAllForExport(): Promise<any[]> {
    const sheet = this.activeSheet;
    if (!sheet || sheetColumns(sheet).length === 0) return [];
    // No limit = every row (the backend refuses more than 100,000).
    const spec = sheetToSpec(sheet, { index: this.catalogIndex, limit: null, page: 1 });
    const result = await this.reportsV2.run(spec);
    return this.shapeRunResult(result, sheet).rows;
  }

  // ─── Build tabular rows from supplied data ──
  //
  // Pre-formats every cell using the same pipeline as chart-preview's
  // table render: column-format override → boolean / date → numberFormat
  // (currency / integer / decimal) → fallback string. The result is a row
  // shape where every value is already a display string, so CSV / XLSX /
  // PDF writers just stringify whatever they get.
  private buildExportRows(rowsIn: any[]): {
    headers: { key: string; label: string }[];
    rows: any[];
  } {
    if (!rowsIn?.length) return { headers: [], rows: [] };
    const keys = this.orderedColumns.length
      ? this.orderedColumns.filter((k) => Object.prototype.hasOwnProperty.call(rowsIn[0], k))
      : Object.keys(rowsIn[0]);
    const allKeys = [...keys];
    Object.keys(rowsIn[0]).forEach((k) => {
      if (!allKeys.includes(k)) allKeys.push(k);
    });

    // Same label resolver as the on-screen preview — `SUM(guests)`,
    // `yearmonth(documentDate)`, custom aliases, etc.
    const headers = allKeys.map((k) => ({ key: k, label: this.labelForKey(k) }));

    // Pre-format every cell using the shared formatter so consumers don't
    // have to know about company settings / numberFormat / boolean etc.
    const ctx = {
      columnFormats: this.columnFormats,
      columnTypes: this.columnTypes,
      columnNumberFormats: this.columnNumberFormats,
      companySettings: (CompanyService as any).companySettings,
    };
    const rows = rowsIn.map((row) => {
      const out: any = {};
      for (const h of headers) {
        out[h.key] = formatCellValue(row[h.key], h.key, ctx);
      }
      return out;
    });

    return { headers, rows };
  }

  private exportCsv(baseName: string, rowsIn: any[]): void {
    const { headers, rows } = this.buildExportRows(rowsIn);
    if (!headers.length) return;
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push(headers.map((h) => esc(h.label)).join(','));
    for (const row of rows) lines.push(headers.map((h) => esc(row[h.key])).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${baseName}.csv`);
  }

  private exportXlsx(baseName: string, rowsIn: any[]): void {
    const { headers, rows } = this.buildExportRows(rowsIn);
    if (!headers.length) return;
    const aoa: any[][] = [headers.map((h) => h.label)];
    for (const row of rows) aoa.push(headers.map((h) => row[h.key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (this.activeSheet?.name || 'Report').slice(0, 31));
    XLSX.writeFile(wb, `${baseName}.xlsx`);
  }

  /**
   * PDF export.
   *
   * For Table chart-type: render a real data table via `jspdf-autotable`
   * — selectable text, multi-page automatic, every row included.
   *
   * For chart visualisations (Bar / Line / Area / Pie / Donut / KPI): the
   * point of the PDF is the chart image, so we keep the html2canvas
   * snapshot. Includes a title + a small data preview table below the
   * chart so the export isn't just an unlabelled image.
   */
  private async exportPdf(baseName: string, rowsIn: any[]): Promise<void> {
    const { headers, rows } = this.buildExportRows(rowsIn);
    const chartType = this.activeSheet?.chartType || 'table';
    const isTable = chartType === 'table';

    if (isTable) {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      // Title row.
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(this.reportName || 'Report', 40, 36);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(120);
      pdf.text(
        `${rows.length} row${rows.length === 1 ? '' : 's'} · exported ${new Date().toLocaleString()}`,
        40,
        52,
      );
      pdf.setTextColor(0);

      autoTable(pdf, {
        startY: 64,
        head: [headers.map((h) => h.label)],
        body: rows.map((row) =>
          headers.map((h) => {
            const v = row[h.key];
            return v == null ? '' : String(v);
          }),
        ),
        styles: {
          fontSize: 9,
          cellPadding: 6,
          overflow: 'linebreak',
          textColor: [31, 35, 40],
          lineColor: [240, 240, 240],
        },
        // Header: #e0e0e0 fill with bold dark text + thin bottom rule.
        headStyles: {
          fillColor: [224, 224, 224],
          textColor: [17, 24, 39],
          fontStyle: 'bold',
          fontSize: 9,
          lineWidth: { bottom: 0.75, top: 0, left: 0, right: 0 } as any,
          lineColor: [60, 60, 60],
        },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        margin: { top: 64, left: 24, right: 24, bottom: 24 },
      });
      pdf.save(`${baseName}.pdf`);
      return;
    }

    // Chart visualisation — snapshot the canvas card, then add a header.
    const node = document.querySelector('.canvas-card') as HTMLElement | null;
    if (!node) return;
    const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    // Reserve a bit of top space for the title.
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(this.reportName || 'Report', 40, 36);
    const reserved = 56;
    const availH = pageH - reserved - 24;
    const ratio = Math.min((pageW - 48) / canvas.width, availH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(imgData, 'PNG', (pageW - w) / 2, reserved, w, h);
    pdf.save(`${baseName}.pdf`);
  }

  /**
   * PNG export — chart-area screenshot. Appropriate for chart
   * visualisations (Bar / Line / Pie / KPI) where the user wants the
   * picture for a presentation. For Table chart-type the PNG will only
   * contain the currently-visible page; use PDF / Excel for full data.
   */
  private async exportPng(baseName: string): Promise<void> {
    const node = document.querySelector('.canvas-card') as HTMLElement | null;
    if (!node) return;
    const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    canvas.toBlob((blob) => {
      if (blob) saveAs(blob, `${baseName}.png`);
    }, 'image/png');
  }

  toggleFullscreen(): void {
    this.canvasFullscreen = !this.canvasFullscreen;
  }

  // ─── Column Picker (legacy) ───────────────────────

  openColumnPicker(): void {
    const sheet = this.activeSheet;
    if (!sheet) return;
    const allCols = [...sheet.columnsShelf, ...sheet.rowsShelf];
    // Converted from NgbModal to invo-portal2's ModalService: inputs go through
    // `data`, and the result arrives via `afterClosed()` (undefined on dismiss).
    const ref = this.modal.open<ColumnPickerComponent, ColumnPickerData, ReportColumn[]>(
      ColumnPickerComponent,
      {
        size: 'lg',
        closeOnBackdrop: false,
        data: { allFields: this.allFields, columns: allCols },
      },
    );

    ref.afterClosed().then((result?: ReportColumn[]) => {
      if (!result) return;
      this.pushHistory();
      const dims = result.filter((c) => !c.agg);
      const meas = result.filter((c) => !!c.agg);
      this.sheets = this.sheets.map((s) =>
        s.id === sheet.id ? { ...s, columnsShelf: dims, rowsShelf: meas } : s,
      );
      if (this.autoRefresh) this.fetchReportData();
    });
  }

  // ─── Helper ───────────────────────────────────────

  getFieldLabel(col: string): string {
    const f = this.allFields.find((x) => x.fullId === col);
    return f ? f.label : col;
  }
}
