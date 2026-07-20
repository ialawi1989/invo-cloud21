import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { DriveStep, Side } from 'driver.js';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalService } from '@shared/modal/modal.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { CustomReportsService } from '../../services/custom-reports.service';
import { ReportTourService } from '../../services/report-tour.service';
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
  DataSourceRef,
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
  CustomReportRequest,
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
  buildValidFilterRules,
  flattenSheetFields,
  buildColumnMeta,
  legacySheetFromConfig,
} from '../../shared/models/custom-report.model';
import { DashboardRow, DashboardWidgets } from '../../models/dashboard-layout.model';
import { LayoutEditorComponent } from '../layout-editor/layout-editor.component';
import { BRANCH_TABLE, fkColumnForTarget, JOIN_BRIDGE, bridgeTableFor } from '../../shared/relations/join-map';

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
    CommonModule,
    FormsModule,
    NgSelectModule,
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
  autoRefresh = true;
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
    startX: number; startY: number;
    startVal: number;
  } | null = null;

  /**
   * The active chart type's definition (label + note). Drives the default
   * description shown in the Show Me popover when nothing is hovered.
   */
  get activeChartTile(): ChartTypeDef | null {
    return this.chartTypes.find(t => t.id === this.activeSheet?.chartType) || null;
  }

  /** Right-panel tabs (icon + label, replaces vertical rotated tabs) */
  rightTabs = [
    { id: 'general',    label: 'General',  icon: 'M4 6h16M4 12h16M4 18h10' },
    { id: 'datasource', label: 'Source',   icon: 'M4 7c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3zM4 7v10c0 1.66 3.58 3 8 3s8-1.34 8-3V7M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3' },
    // Chart type is now picked from the canvas-header "Show Me" popover and
    // Marks live in the shelves area, so the old "Visual" tab is gone.
    // "Data" tab — quick filters + color legend. Surfaces the colour mark's
    // legend and lets the user drill-down by picking a single value per
    // shelf dimension (backend has no `in` operator yet; multi-select is a
    // Phase 2 enhancement).
    { id: 'data',       label: 'Data',     icon: 'M3 6h18M3 12h18M3 18h18M9 3v18M15 3v18' },
    { id: 'settings',   label: 'Settings', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM19 12l2 1-1 3-2-1M5 12l-2 1 1 3 2-1M12 5V3M12 21v-2' },
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

  // ─── Data Sources ─────────────────────────────────
  dataSources: DataSourceTable[] = [];

  // ─── Sheets (setters auto-rebuild derived caches) ──
  private _sheets: SheetConfig[] = [];
  get sheets(): SheetConfig[] { return this._sheets; }
  set sheets(val: SheetConfig[]) { this._sheets = val; this.rebuildDerived(); }

  private _activeSheetId = '';
  get activeSheetId(): string { return this._activeSheetId; }
  set activeSheetId(val: string) { this._activeSheetId = val; this.rebuildDerived(); }

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
  get reportData(): any[] { return this._reportData; }
  set reportData(val: any[]) { this._reportData = val; this.rebuildDerived(); }
  totalRows = 0;
  /** Group by shelf: per-group metadata (value, full count, page-slice length,
   *  subtotals) passed to the chart preview. Null in normal (non-grouped) mode. */
  groupedMeta: { value: any; count: number; len: number; subtotals: { [key: string]: number } }[] | null = null;
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
    private modal: ModalService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private privileges: PrivilegeService,
    private tour: ReportTourService
  ) {
    this.canEdit = this.privileges.check(customReportsEditPrivilegeFullKey);
  }

  /**
   * Navigate back to the reports list. The builder is mounted at the
   * top-level full-screen route (no app sidebar), so we need an explicit
   * way out — the Reports crumb and the back button both call this.
   */
  goBackToReports(): void {
    this.router.navigate(['/reports']);
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
    if (this.canEdit && this.mode === 'edit' && !this.tour.hasSeen(ReportBuilderComponent.TOUR_KEY)) {
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
    setTimeout(() => this.tour.run(this.buildTourSteps(), {
      dontShowAgain: {
        isChecked: () => this.tour.hasSeen(key),
        onToggle: (checked) => checked ? this.tour.markSeen(key) : this.tour.clearSeen(key),
      },
    }), 60);
  }

  private step(selector: string, title: string, description: string, side: Side = 'right'): DriveStep {
    return {
      element: selector,
      popover: { title, description, side, align: 'start' },
    };
  }

  private buildTourSteps(): DriveStep[] {
    return [
      {
        popover: {
          title: '👋 Welcome to the Report Builder',
          description:
            'Build your own report by choosing fields, shaping them on shelves, and picking how to visualise the result. This quick tour points out each part — use ← / → or the buttons, and Esc to exit.',
          align: 'center',
        },
      },
      this.step('[data-tour="fields"]', '1. Data & Fields',
        'Pick your data source at the top, then browse its fields here. Double-click a field or drag it onto a shelf to add it to the report.'),
      this.step('[data-tour="shelves-toggle"]', '2. Shelves',
        'This bar shows/hides the shelves area where you arrange fields. It stays open while you build.'),
      this.step('[data-tour="shelves"]', '3. Columns, Rows & Filters',
        'Drop fields onto Columns and Rows to structure the report, and onto Filters to limit the data. Aggregations (sum, count, …) live on each field.'),
      this.step('[data-tour="marks"]', '4. Marks',
        'Encode extra meaning: set a Color field, and toggle data labels. For charts this controls how series are coloured.'),
      this.step('[data-tour="calc"]', '5. Calculated fields',
        'Create your own computed columns (e.g. margin = price − cost) to use like any other field.'),
      this.step('[data-tour="show-me"]', '6. Show Me — chart type',
        'Switch between a Table and chart types (bar, line, pie, …). Hover a type to see when to use it.', 'left'),
      this.step('[data-tour="run"]', '7. Run',
        'Fetch the latest data for your current setup. Turn on Auto-refresh in Settings to run as you edit.', 'bottom'),
      this.step('[data-tour="preview"]', '8. Live preview',
        'Your report renders here. In table view, click a column header to sort (fetched from the server) and reorder columns by dragging.'),
      this.step('[data-tour="pagination"]', '9. Pagination',
        'Large tables are paged — step through pages and change the page size without loading everything at once.', 'top'),
      this.step('[data-tour="sheets"]', '10. Sheets',
        'A report can hold multiple sheets (e.g. a table and a chart of the same data). Add, rename and switch between them here.', 'top'),
      this.step('[data-tour="save"]', '11. Save',
        'Save your report. Saved reports appear under the Custom Report tab in Reports.', 'bottom'),
      {
        element: '[data-tour="save"]',
        popover: {
          title: '12. Add it to your Dashboard',
          description:
            'Once saved, open Customize Dashboard → Available Widgets → the “Custom” filter, and drop your report onto the dashboard as a live widget — with its own records limit, sort and filters. You\'re all set! 🎉',
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
    if (target === 'field-list')      startVal = this.fieldListWidth;
    else if (target === 'marks')      startVal = this.marksWidth;
    else if (target === 'config')     startVal = this.configPanelWidth;
    else /* shelf-block */ {
      // If no override yet, capture the current rendered height
      const row = (event.target as HTMLElement)
        .closest('.builder-center')?.querySelector('.shelf-area-row') as HTMLElement | null;
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
      localStorage.setItem(this.LAYOUT_STORAGE_KEY, JSON.stringify({
        fieldListWidth: this.fieldListWidth,
        marksWidth: this.marksWidth,
        configPanelWidth: this.configPanelWidth,
        shelfHeight: this.shelfHeight,
      }));
    } catch {}
  }

  // ─── Active Sheet ─────────────────────────────────

  private _emptySheet = createDefaultSheet('');
  get activeSheet(): SheetConfig {
    return this.sheets.find(s => s.id === this.activeSheetId) || this.sheets[0] || this._emptySheet;
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
  dataKeys: string[] = [];  // keys from the current report data (for calculated field dropdown)

  /**
   * Flat map of `Table.fieldId` → backend field meta, derived from the
   * currently-joined `allFields`. Cheap to call per fetch — kept as a tiny
   * helper instead of cached state so we don't have to keep two copies in
   * sync with `rebuildDerived`.
   */
  private fieldMetaByFullId(): { [fullId: string]: { id?: string; type?: string; numberFormat?: string } } {
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
      this.joinedTableIds = [sheet.primaryTable, ...sheet.joins.map(j => j.tid)];
      // Predefined formulas surface as filter-only fields (Table.@key) so the
      // backend can resolve them by key. Shared with the dashboard widget.
      this.allFields = flattenSheetFields(this.dataSources, sheet);
      this.availableTables = this.getRelatedTables(this.joinedTableIds, sheet.primaryTable);
      const colorMark = sheet.marks.find(m => m.channel === 'color');
      this.colorField = colorMark ? colorMark.field.col : null;

      // Column metadata (labels / formats / types / number formats / order) —
      // shared helper so the view and dashboard widget render identically.
      const meta = buildColumnMeta(sheet, this.allFields);
      this.columnLabels = meta.columnLabels;
      this.columnFormats = meta.columnFormats;
      this.columnTypes = meta.columnTypes;
      this.columnNumberFormats = meta.columnNumberFormats;
      this.orderedColumns = meta.orderedColumns;

      // Current sort
      this.currentSort = sheet.sortBy.length > 0
        ? { key: sheet.sortBy[0].id, dir: sheet.sortBy[0].mod }
        : null;
    } else {
      this.joinedTableIds = [];
      this.allFields = [];
      this.availableTables = [];
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
      const dim = keys.find(k => !/^(sum|count|avg|max|min)\./.test(k) && k !== 'value');
      this.dimKey = dim || null;
      this.measKeys = this.dimKey ? keys.filter(k => k !== this.dimKey) : [...keys];
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
        rowsShelf:    sheet.rowsShelf,
        marks:        sheet.marks,
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

  async loadInitialData(moduleIdToLoad: string | null = null, seed: SeedConfig | null = null): Promise<void> {
    this.loading = true;
    try {
      const [dataSources, modules, queries] = await Promise.all([
        this.customReports.getDataSource(),
        this.customReports.getModules(),
        this.customReports.getQueries(),
      ]);
      this.dataSources = dataSources;
      this.modules = modules;
      this.queries = queries;

      if (dataSources.length > 0) {
        // Seed the first sheet on the requested data source when it exists,
        // otherwise fall back to the first available source.
        const seededTable = seed?.dataset && dataSources.some(d => d.id === seed.dataset)
          ? seed.dataset
          : dataSources[0].id;
        const defaultSheet = createDefaultSheet(seededTable);
        const seeded = seed && seededTable === seed.dataset;
        if (seeded) {
          this.applySeed(defaultSheet, seed!);
          // Pre-fill the report name from the source's display label so a
          // "Customise Report" launch opens as e.g. "Payouts (Customized)"
          // instead of the generic "Untitled report".
          const srcLabel = dataSources.find(d => d.id === seededTable)?.label || seededTable;
          this.reportName = `${srcLabel} (Customized)`;
        }
        this.sheets = [defaultSheet];
        this.activeSheetId = defaultSheet.id;

        // If we pre-placed columns, fetch immediately so the customised report
        // opens already showing data (mirrors the fixed report).
        if (seeded && defaultSheet.columnsShelf.length && this.mode === 'edit') {
          this.fetchReportData();
        }
      }

      // If a module id came in via the URL, load it. Prefer the copy already in
      // the modules list (known-good shape, avoids a second round-trip); fall
      // back to fetching it by id for deep-links that aren't in the list.
      if (moduleIdToLoad) {
        const mod = modules.find(m => m.id === moduleIdToLoad)
          ?? await this.customReports.getModule(moduleIdToLoad);
        if (mod) this.loadModule(mod);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
    this.loading = false;
  }

  /**
   * Seed a freshly created sheet from a fixed report's "Customise Report"
   * launch: carry the date-range / branch filters across and pre-place the
   * report's default columns (auto-resolving each column's join chain).
   */
  private applySeed(sheet: SheetConfig, seed: SeedConfig): void {
    // ── Filters ──
    if (seed.dateField && seed.fromDate && seed.toDate) {
      sheet.filterRules.push({
        field: `${seed.dataset}.${seed.dateField}`,
        type: 'date',
        condition: { type: 'between', filter: { start: seed.fromDate, end: seed.toDate } },
        includes: [],
      });
    }
    if (seed.branchField && seed.branchId) {
      sheet.filterRules.push({
        field: `${seed.dataset}.${seed.branchField}`,
        type: 'text',
        condition: { type: 'equal', filter: seed.branchId },
        includes: [],
      });
    }

    // ── Default columns ──
    // Each spec is "Table.field". Columns from related tables need their join
    // chain added first; a column whose table can't be linked is skipped so we
    // never emit a query the backend would reject. Seeded as raw columns
    // (no aggregation) so the builder opens as a detail list like the fixed report.
    seed.columns.forEach((spec, i) => {
      const tid = spec.split('.')[0];
      if (!tid) return;
      if (tid !== sheet.primaryTable && !sheet.joins.some(j => j.tid === tid)) {
        const chain = this.buildJoinChain(tid, sheet);
        if (!chain.length) return; // unreachable table — skip this column
        sheet.joins.push(...chain);
      }
      sheet.columnsShelf.push({
        col: spec,
        agg: '',
        datePart: '',
        key: `${Date.now()}-${i}-${spec}`,
      });
    });
  }

  /** Lazy-load options for a single field (called on demand when filter dropdown opens) */
  async loadFieldOptionsFor(fieldId: string): Promise<void> {
    // Already loaded or currently loading
    if (this.fieldOptions[fieldId] !== undefined) return;

    // Mark as loading (empty array prevents re-fetch)
    this.fieldOptions[fieldId] = [];
    try {
      const opts = await this.customReports.getOptions(fieldId);
      // Two passes:
      //   1. Normalise — for *direct* (non-FK) columns the backend returns
      //      `{id: <source row id>, value: <column value>}`, so each
      //      "Invoice" row is a separate entry with a unique id. That
      //      breaks both dedupe (different ids) AND filtering (filtering
      //      by row id matches one row, not all rows with that value).
      //      For direct columns we rewrite `id` to equal `value` so the
      //      filter key IS the display value.
      //   2. Dedupe — collapse identical entries so the UI groups them.
      const field = this.allFields.find(f => f.fullId === fieldId) as any;
      const isFk = !!(field?.ref);
      const normalised = isFk
        ? opts
        : opts.map((opt: any) => ({
            ...opt,
            id: opt?.value ?? opt?.name ?? opt?.id,
          }));
      this.fieldOptions = {
        ...this.fieldOptions,
        [fieldId]: this.dedupeOptions(normalised),
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
      const key = id !== undefined && id !== null && id !== ''
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
    if (s.mode === 'only')  return total > 0 ? `1 / ${total}` : '1';
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
  private _filteredOptionsCache = new Map<
    string,
    { term: string; source: any[]; result: any[] }
  >();

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
  private _legendColors = ['#00bcd4', '#26a69a', '#42a5f5', '#ffa726', '#ef5350', '#ab47bc', '#8d6e63', '#78909c'];

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
      .filter(c => !c.agg && !c.datePart)
      .filter(c => {
        const field = this.allFields.find(f => f.fullId === c.col) as any;
        if (!field) return true; // unknown field — keep it, fail-open
        const cls = classifyField(field);
        return cls.subtype !== 'identifier';
      })
      .map(c => ({ col: c.col, label: this.getFieldLabel(c.col) }));

    // Quick-filter state per column — derived from filterRules tagged with
    // `_quickFilter`. Three rule shapes are recognised:
    //   - `equal __quickFilter_none__` → mode 'none'
    //   - `equal <value>`              → mode 'only' (single selected)
    //   - `notEqual <value>` (1+)      → mode 'except' (some excluded)
    const nextState: { [col: string]: { mode: 'all' | 'none' | 'only' | 'except'; values: Set<string> } } = {};
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
    const colorMark = sheet.marks.find(m => m.channel === 'color');
    if (!colorMark || !this.reportData?.length) {
      this.legendItems = [];
      return;
    }
    const key = colorMark.field.col;
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
  quickFilterState: { [col: string]: { mode: 'all' | 'none' | 'only' | 'except'; values: Set<string> } } = {};

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
    const field = this.allFields.find(f => f.fullId === col);
    const type = field?.type || 'text';
    const otherRules = sheet.filterRules.filter(r =>
      !(r.field === col && (r as any)._quickFilter)
    );

    let generated: FilterRule[] = [];
    let nextState: { mode: 'all' | 'none' | 'only' | 'except'; values: Set<string> } | null = null;

    const makeEqual = (val: string): FilterRule => ({
      field: col,
      type,
      condition: { type: 'equal', filter: val },
      includes: [],
      _quickFilter: true,
    } as unknown as FilterRule);
    const makeNotEqual = (val: string): FilterRule => ({
      field: col,
      type,
      condition: { type: 'notEqual', filter: val },
      includes: [],
      _quickFilter: true,
    } as unknown as FilterRule);

    const allIds = allIdsIfKnown.length ? allIdsIfKnown : this.knownOptionIds(col);

    if (selected === null) {
      // 'all' — no rules
      generated = [];
      nextState = null;
    } else if (selected.size === 0) {
      // 'none' — single sentinel
      generated = [makeEqual(ReportBuilderComponent.QUICK_FILTER_NONE_SENTINEL)];
      nextState = { mode: 'none', values: new Set() };
    } else if (allIds.length > 0 && selected.size === allIds.length
               && allIds.every(v => selected.has(v))) {
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
      const excluded = new Set<string>(allIds.filter(v => !selected.has(v)));
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
    this.sheets = this.sheets.map(s =>
      s.id === sheet.id ? { ...s, filterRules: [...otherRules, ...generated] } : s
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
    return new Set(allIds.filter(v => !s.values.has(v)));
  }

  // ─── Fetch Report Data ────────────────────────────

  async fetchReportData(immediate = false): Promise<void> {
    const sheet = this.activeSheet;
    if (!sheet) return;

    // Clear any prior grouped view; the success path repopulates it when the
    // backend returns groups[]. Keeps stale group headers/subtotals from lingering.
    this.groupedMeta = null;
    this.groupFieldLabel = '';

    const { columns, groupBy } = shelvesToApiParams(sheet);
    if (columns.length === 0) {
      this.reportData = [];
      this.totalRows = 0;
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    // Reject a malformed payload before it hits the backend (bare formula, an
    // un-joined table, or an ungrouped column alongside an aggregate).
    const validationError = this.validateReportColumns(sheet, columns, groupBy);
    if (validationError) {
      this.setJoinNotice(validationError);
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
        const request: CustomReportRequest = {
          tableName: sheet.primaryTable,
          columns,
          joins: sheet.joins,
          sort: sheet.sortBy,
          group: groupBy,
          limit: sheet.pageSize,
          offset: (sheet.currentPage - 1) * sheet.pageSize,
        };

        // Group by shelf — display grouping with backend subtotals (Table only).
        if (sheet.groupBy) request.groupBy = sheet.groupBy;

        // Build filter query (shared validation — see buildValidFilterRules)
        const validRules = buildValidFilterRules(sheet.filterRules);
        if (validRules.length > 0) {
          request.query = { glue: sheet.filterGlue, rules: validRules };
        }

        const result = await this.customReports.getCustomizedReport(request);
        // Group by shelf: the backend returns groups[] (each with its own rows +
        // count + subtotals). Flatten the rows for the normal pipeline below and
        // keep the group metadata for the grouped renderer. Normal mode untouched.
        let rows = result.rows;
        let grouped: { value: any; count: number; len: number; subtotals: any }[] | null = null;
        if (sheet.groupBy && result.groups && result.groups.length) {
          rows = result.groups.flatMap((g: any) => g.rows || []);
          grouped = result.groups.map((g: any) => {
            const len = (g.rows || []).length;
            return { value: g.value, count: typeof g.count === 'number' ? g.count : len, len, subtotals: g.subtotals || {} };
          });
        }
        // Backend stringifies every number to preserve precision (see
        // docs/custom-reports-backend-api.md). Run two passes:
        //   1. coerceNumericMeasures — handles aggregation prefixes.
        //   2. coerceNumericRows    — handles plain numeric columns via
        //      DataSourceField.type + numberFormat, leaving identifiers
        //      (barcode/sku/phone/…) and booleans alone.
        coerceNumericMeasures(rows);
        coerceNumericRows(rows, sheet, this.fieldMetaByFullId());
        // Apply calculated fields to each row
        if (sheet.calculatedFields?.length) {
          applyCalculatedFields(rows, sheet.calculatedFields);
        }
        this.groupedMeta = grouped;
        this.groupFieldLabel = grouped && sheet.groupBy
          ? (this.allFields.find(f => f.fullId === sheet.groupBy)?.label || sheet.groupBy.split('.').pop() || '')
          : '';
        this.reportData = rows;
        // Use server totalCount if available, otherwise estimate
        if (result.totalCount >= 0) {
          this.totalRows = result.totalCount;
        } else {
          this.totalRows = result.rows.length < sheet.pageSize
            ? ((sheet.currentPage - 1) * sheet.pageSize + result.rows.length)
            : (sheet.currentPage * sheet.pageSize + 1);
        }
      } catch (err) {
        console.error('Failed to fetch report:', err);
        this.reportData = [];
        this.totalRows = 0;
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
    this.sheets = this.sheets.map(s => s.id === sheet.id ? {
      ...s,
      columnsShelf: proposal.columnsShelf,
      rowsShelf:    proposal.rowsShelf,
      marks:        proposal.marks,
    } : s);
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
    this.sheets = this.sheets.map(s => s.id === sheet.id ? {
      ...s,
      // Replace any existing color mark, preserve everything else.
      marks: [
        ...s.marks.filter(m => m.channel !== 'color'),
        { channel: 'color', field: next as any },
      ],
    } : s);
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

  toggleMode(): void {
    // Read-only users can't switch into edit mode.
    if (!this.canEdit) {
      this.mode = 'view';
      return;
    }
    this.mode = this.mode === 'edit' ? 'view' : 'edit';
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
    const existing = new Set(this.dashboard.sheets.map(ds => ds.sheetId));
    const additions = this.sheets
      .filter(s => !existing.has(s.id))
      .map((s, i) => ({
        sheetId: s.id,
        x: 0,
        y: 0,
        width: 6,
        height: 1,
      } as DashboardSheet));
    // Drop cards whose sheet was deleted, then append cards for new sheets.
    const live = this.dashboard.sheets.filter(ds => this.sheets.some(s => s.id === ds.sheetId));
    this.dashboard = { ...this.dashboard, sheets: [...live, ...additions] };
  }

  // ─── Sheet Management ─────────────────────────────

  onSelectSheet(sheetId: string): void {
    this.activeSheetId = sheetId;
    this.fieldOptions = {};
    // Clear the canvas so it doesn't show the previous sheet's data
    this.reportData = [];
    this.totalRows = 0;
    if (this.autoRefresh) this.fetchReportData();
  }

  onAddSheet(): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    const newSheet = createDefaultSheet(
      sheet?.primaryTable || this.dataSources[0]?.id || '',
      `Sheet ${this.sheets.length + 1}`
    );
    this.sheets = [...this.sheets, newSheet];
    this.activeSheetId = newSheet.id;

    // New sheet starts empty — clear previous sheet's data from the canvas
    this.reportData = [];
    this.totalRows = 0;
    this.fieldOptions = {};

    // Add to dashboard if in dashboard mode
    if (this.dashboard) {
      const row = Math.floor(this.dashboard.sheets.length / 2);
      const col = (this.dashboard.sheets.length % 2) * 6;
      this.dashboard.sheets = [...this.dashboard.sheets, {
        sheetId: newSheet.id,
        x: col, y: row, width: 6, height: 1,
      }];
    }

    if (this.autoRefresh) this.fetchReportData();
  }

  onRemoveSheet(sheetId: string): void {
    if (this.sheets.length <= 1) return;
    this.pushHistory();
    this.sheets = this.sheets.filter(s => s.id !== sheetId);
    if (this.activeSheetId === sheetId) {
      this.activeSheetId = this.sheets[0].id;
    }
    if (this.dashboard) {
      this.dashboard.sheets = this.dashboard.sheets.filter(ds => ds.sheetId !== sheetId);
    }
    if (this.autoRefresh) this.fetchReportData();
  }

  onRenameSheet(event: { id: string; name: string }): void {
    this.sheets = this.sheets.map(s =>
      s.id === event.id ? { ...s, name: event.name } : s
    );
  }

  // ─── Sheet Config Changes ────────────────────────

  onSheetChange(updated: SheetConfig): void {
    this.pushHistory();
    this.sheets = this.sheets.map(s => s.id === updated.id ? updated : s);
    if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
  }

  /** Mirror MarksCard's data-labels toggle into the active sheet config. */
  onShowLabelsChange(next: boolean): void {
    if (!this.canEdit) return;
    const sheet = this.activeSheet;
    if (!sheet) return;
    this.pushHistory();
    this.sheets = this.sheets.map(s =>
      s.id === sheet.id ? { ...s, showLabels: !!next } : s
    );
    // No re-fetch needed — labels are a pure render concern.
  }

  onMarksChange(marks: MarkEncoding[]): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    if (sheet) {
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, marks } : s
      );
      if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
    }
  }

  onCalculatedFieldsChange(calcFields: CalculatedField[]): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    if (!sheet) return;

    // Update sheet config (triggers rebuildDerived → updates columnLabels & orderedColumns)
    this.sheets = this.sheets.map(s =>
      s.id === sheet.id ? { ...s, calculatedFields: calcFields } : s
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
    if (existing.find(c => c.col === field.fullId)) return;

    // Auto-resolve the join chain so picking a field from any related table
    // "just works" — null means the table can't be linked, so don't add a
    // column the backend would reject.
    const addJoins = this.joinsToReach(field.fullId, sheet);
    if (addJoins === null) { this.flashJoinNotice(field.table); return; }

    this.pushHistory();
    const newCol: ReportColumn = {
      col: field.fullId,
      agg: field.type === 'number' ? 'sum' : '',
      datePart: field.type === 'date' ? 'yearmonth' : '',
      key: Date.now() + '-' + field.fullId,
    };

    // Measures go to rows (Y-axis), dimensions go to columns (X-axis)
    if (newCol.agg) {
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, joins: [...s.joins, ...addJoins], rowsShelf: [...s.rowsShelf, newCol] } : s
      );
    } else {
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, joins: [...s.joins, ...addJoins], columnsShelf: [...s.columnsShelf, newCol] } : s
      );
    }

    if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
  }

  onAddToShelf(event: { field: FlatField; target: 'columns' | 'rows' | 'filters' | 'group' }): void {
    const sheet = this.activeSheet;
    if (!sheet) return;

    if (event.target === 'group') {
      // Formulas can't be a grouping dimension.
      if (event.field.isFormula) { this.setJoinNotice("Formula fields can't be used as a group by."); return; }
      const addJoins = this.joinsToReach(event.field.fullId, sheet);
      if (addJoins === null) { this.flashJoinNotice(event.field.table); return; }
      this.pushHistory();
      // Single field — replaces any existing group-by.
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, joins: [...s.joins, ...addJoins], groupBy: event.field.fullId } : s
      );
      if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
      return;
    }

    if (event.target === 'filters') {
      const addJoins = this.joinsToReach(event.field.fullId, sheet);
      if (addJoins === null) { this.flashJoinNotice(event.field.table); return; }
      this.pushHistory();
      const newFilter: FilterRule = {
        field: event.field.fullId,
        type: event.field.type,
        condition: { type: 'equal', filter: '' },
        includes: [],
        ...(event.field.isFormula ? { isFormula: true } : {}),
      };
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, joins: [...s.joins, ...addJoins], filterRules: [...s.filterRules, newFilter] } : s
      );
      // Formula fields have no distinct-value option list; only real FK columns do.
      if (!event.field.isFormula && event.field.id.endsWith('Id')) {
        this.loadFieldOptionsFor(event.field.fullId);
      }
      if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
      return;
    }

    const existing = [...sheet.columnsShelf, ...sheet.rowsShelf];
    if (existing.find(c => c.col === event.field.fullId)) return;

    const addJoins = this.joinsToReach(event.field.fullId, sheet);
    if (addJoins === null) { this.flashJoinNotice(event.field.table); return; }

    this.pushHistory();
    const newCol: ReportColumn = {
      col: event.field.fullId,
      agg: event.field.type === 'number' ? 'sum' : '',
      datePart: event.field.type === 'date' ? 'yearmonth' : '',
      key: Date.now() + '-' + event.field.fullId,
    };

    if (event.target === 'columns') {
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, joins: [...s.joins, ...addJoins], columnsShelf: [...s.columnsShelf, newCol] } : s
      );
    } else {
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, joins: [...s.joins, ...addJoins], rowsShelf: [...s.rowsShelf, newCol] } : s
      );
    }
    if (this.autoRefresh && this.mode === 'edit') this.fetchReportData();
  }

  // ─── Chart Type ───────────────────────────────────

  setChartType(type: string): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    if (sheet) {
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, chartType: type } : s
      );
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
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, primaryTable: tableId, joins: [], columnsShelf: [], rowsShelf: [], marks: [], groupBy: undefined } : s
      );
      this.fieldOptions = {};
    }
  }

  // ─── Joins ────────────────────────────────────────

  /** True when `x` is a real table id in the loaded data sources. */
  private isTableId(x: string | undefined): boolean {
    return !!x && this.dataSources.some(t => t.id === x);
  }

  /** True when table `tableId` exposes a column with id `col`. */
  private hasColumn(tableId: string, col: string | undefined): boolean {
    if (!col) return false;
    const t = this.dataSources.find(d => d.id === tableId);
    return !!t?.data?.some(f => f.id === col);
  }

  /**
   * A ref is "column-shaped" (legacy) when `source`/`target` are column names
   * (FK on the owner, PK on the related table) rather than table names. When
   * either is a real table id the ref is "table-shaped" and carries no column
   * info — the FK column must be recovered from FK_COLUMN_BY_TARGET.
   */
  private refIsColumnShaped(ref: DataSourceRef): boolean {
    return !this.isTableId(ref.source) && !this.isTableId(ref.target);
  }

  /**
   * The table on the OTHER side of a ref, relative to `ownerId`. Handles both
   * shapes: prefers a real table id found in `source`/`target` (table-shaped),
   * else falls back to `name` (column-shaped, where `name` is the related table).
   */
  private linkedTable(ref: DataSourceRef, ownerId: string): string {
    for (const cand of [ref.source, ref.target]) {
      if (cand && cand !== ownerId && this.isTableId(cand)) return cand;
    }
    if (ref.name && ref.name !== ownerId) return ref.name;
    return '';
  }

  /**
   * Tables related (via a refs entry in either direction) to any already-joined
   * table. Already-joined tables stay in the list so users can uncheck them;
   * the primary is excluded.
   *
   * refs entry shape: { name: <relatedTable>, source: <fkColumn>, target: <pkColumn> }
   *  - the related table is `name`; `source` is the FK column on the table that
   *    OWNS the entry and `target` the PK column on `name` (usually "id").
   *  - forward: an anchor owns the entry → its `name` is reachable.
   *  - backward: the entry's `name` is an anchor → the owning table is reachable.
   */
  private getRelatedTables(anchorIds: string[], primaryTableId: string): DataSourceTable[] {
    const anchors = new Set(anchorIds);
    const related = new Set<string>();
    for (const t of this.dataSources) {
      const refs: DataSourceRef[] = t.refs || [];
      for (const r of refs) {
        const other = this.linkedTable(r, t.id);
        if (!other) continue;
        if (anchors.has(t.id) && !anchors.has(other)) related.add(other);   // forward
        if (anchors.has(other) && !anchors.has(t.id)) related.add(t.id);     // backward
      }
    }

    // Bridge-reachable tables: a transitive table (e.g. ProductBatches) becomes
    // offerable once its required bridge (BranchProducts) is reachable, even
    // before the bridge is actually joined — toggleJoin injects the bridge. Run
    // to a fixpoint so chained bridges resolve.
    let bridgeAdded = true;
    while (bridgeAdded) {
      bridgeAdded = false;
      for (const [t, bridge] of Object.entries(JOIN_BRIDGE)) {
        if (anchors.has(t) || related.has(t)) continue;
        if (anchors.has(bridge) || related.has(bridge)) { related.add(t); bridgeAdded = true; }
      }
    }
    // The backend auto-injects an INNER JOIN "Branches" for branch-scoped base
    // tables and silently drops any Branches join we send (see toggleJoin), so
    // don't offer it as a joinable table in that case.
    const primaryBranchScoped = this.tableHasBranchId(primaryTableId);
    return this.dataSources.filter(t => {
      if (t.id === primaryTableId) return false;
      if (t.id === BRANCH_TABLE && primaryBranchScoped) return false;
      if (anchors.has(t.id)) return true;
      return related.has(t.id);
    });
  }

  /**
   * Resolve the join columns connecting `tid` to an already-present `anchorId`.
   * Returns `{ sf, tf }` for the ON clause `"<anchorId>"."<sf>" = "<tid>"."<tf>"`,
   * or null when the two tables aren't related. Handles both ref shapes:
   *
   *  - **Column-shaped ref** — the columns are read straight from the ref
   *    (forward: anchor.<source>=tid.<target>; backward: anchor.<target>=tid.<source>).
   *  - **Table-shaped ref** — the ref carries no columns, so the FK column is
   *    recovered from FK_COLUMN_BY_TARGET keyed by whichever side is the PK
   *    (referenced) table. The FK column's actual presence in `data` decides the
   *    orientation; when columns aren't exposed we trust the map definition.
   */
  private resolveJoinColumns(anchorId: string, tid: string): { sf: string; tf: string } | null {
    const anchor = this.dataSources.find(t => t.id === anchorId);
    const added = this.dataSources.find(t => t.id === tid);

    // 1. Legacy column-shaped ref carries both join columns directly.
    const fwdCol = (anchor?.refs || []).find(r => this.refIsColumnShaped(r) && this.linkedTable(r, anchorId) === tid);
    if (fwdCol) return { sf: fwdCol.source || 'id', tf: fwdCol.target || 'id' };
    const backCol = (added?.refs || []).find(r => this.refIsColumnShaped(r) && this.linkedTable(r, tid) === anchorId);
    if (backCol) return { sf: backCol.target || 'id', tf: backCol.source || 'id' };

    // 2. Table-shaped ref — confirm a relationship exists, then derive the FK
    //    column from the map. id↔id is never emitted; an unmapped relation
    //    returns null so the caller can refuse the join.
    const linked =
      (anchor?.refs || []).some(r => this.linkedTable(r, anchorId) === tid) ||
      (added?.refs || []).some(r => this.linkedTable(r, tid) === anchorId);
    if (!linked) return null;

    // FK references `tid` (tid is the PK side) → FK column lives on the anchor.
    const fkOnAnchor = fkColumnForTarget(tid);
    if (fkOnAnchor && this.hasColumn(anchorId, fkOnAnchor)) return { sf: fkOnAnchor, tf: 'id' };
    // FK references `anchor` (anchor is the PK side) → FK column lives on tid.
    const fkOnTid = fkColumnForTarget(anchorId);
    if (fkOnTid && this.hasColumn(tid, fkOnTid)) return { sf: 'id', tf: fkOnTid };
    // Columns not exposed in `data` — fall back to the map definition.
    if (fkOnAnchor) return { sf: fkOnAnchor, tf: 'id' };
    if (fkOnTid) return { sf: 'id', tf: fkOnTid };
    return null;
  }

  /**
   * Build a single join attaching `tid` to the first of `anchorIds` it relates
   * to. Backend renders `LEFT JOIN "<tid>" ON "<sid>"."<sf>" = "<tid>"."<tf>"`.
   * `sf`/`tf` are always COLUMN names (see resolveJoinColumns). Returns null —
   * and logs — when no FK mapping/relation connects them.
   */
  private buildJoinForAmong(tid: string, anchorIds: string[]): ReportJoin | null {
    for (const anchorId of anchorIds) {
      const cols = this.resolveJoinColumns(anchorId, tid);
      if (cols) {
        const join: ReportJoin = { sid: anchorId, tid, sf: cols.sf, tf: cols.tf, type: 'LEFT' };
        this.assertValidJoin(join);
        return join;
      }
    }
    return null;
  }

  /**
   * Build the full set of joins needed to add `tid`, injecting any required
   * intermediate bridge tables first (see JOIN_BRIDGE). E.g. adding
   * ProductBatches on a Products base yields BOTH links, in order:
   *     Products → BranchProducts → ProductBatches
   * Each link attaches to a table already present *or added earlier in this
   * chain*, so a freshly-injected bridge can anchor the next link. All-or-
   * nothing: if any link can't be resolved, nothing is added (and we log why).
   */
  private buildJoinChain(tid: string, sheet: SheetConfig): ReportJoin[] {
    const present = new Set([sheet.primaryTable, ...sheet.joins.map(j => j.tid)]);

    // Expand required bridges, outermost-first (a bridge may itself need one).
    const chain: string[] = [];
    const visit = (t: string) => {
      const bridge = bridgeTableFor(t);
      if (bridge && !present.has(bridge) && !chain.includes(bridge)) {
        visit(bridge);
        chain.push(bridge);
      }
    };
    visit(tid);
    chain.push(tid);

    const result: ReportJoin[] = [];
    for (const t of chain) {
      if (present.has(t)) continue;
      // A bridged table (e.g. ProductBatches) must attach to its bridge
      // (BranchProducts), never straight to the base — this defends against a
      // stale direct ref (Products→ProductBatches) producing a wrong join.
      const bridge = bridgeTableFor(t);
      const anchors = bridge && present.has(bridge) ? [bridge] : [...present];
      const join = this.buildJoinForAmong(t, anchors);
      if (!join) {
        console.error(
          `[CustomReports] Could not resolve a join for "${t}" while adding "${tid}" ` +
          `(anchors: [${[...present].join(', ')}]). Nothing added — check FK_COLUMN_BY_TARGET / JOIN_BRIDGE.`,
        );
        return [];
      }
      result.push(join);
      present.add(t);
    }
    return result;
  }

  /**
   * Joins needed before a column from `fullId`'s table can be used in `sheet`.
   * Returns [] when the table is already present (it's the primary or already
   * joined), the resolved chain (incl. any bridge tables) when it can be
   * auto-joined, or null when no FK path connects it — letting callers refuse
   * to add a column that would only produce a database error.
   */
  private joinsToReach(fullId: string, sheet: SheetConfig): ReportJoin[] | null {
    const tid = this.tableOfColKey(fullId);
    if (!tid || tid === sheet.primaryTable || sheet.joins.some(j => j.tid === tid)) return [];
    const chain = this.buildJoinChain(tid, sheet);
    return chain.length ? chain : null;
  }

  /** Transient banner shown when a picked field's table can't be auto-joined. */
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

  /** Briefly surface that a table couldn't be linked to the current view. */
  private flashJoinNotice(tableId: string): void {
    const label = this.dataSources.find(d => d.id === tableId)?.label || tableId;
    this.setJoinNotice(
      `"${label}" can't be linked to this report automatically. ` +
      `Add it from the Data source tab and pick the relationship.`,
    );
  }

  /** Table id a built column/group entry projects from — handles agg/date
   *  prefixes ("sum.Table.col" → Table) and formulas ("Table.@key" → Table). */
  private tableOfColumnEntry(key: string): string {
    const parts = (key || '').split('.');
    const PREFIX = ['sum', 'count', 'avg', 'max', 'min', 'year', 'month', 'day', 'yearmonth', 'yearmonthday'];
    if (parts.length >= 3 && PREFIX.includes(parts[0])) return parts[1];
    return parts[0] || '';
  }

  /**
   * Pre-flight checks on the payload the backend will receive. Returns a
   * user-facing error message, or null when the request is safe to send:
   *  - a formula entry must carry its table prefix (never a bare "@key");
   *  - every column's table must be the base table or an active join;
   *  - when any aggregate is present, every non-aggregated entry must be grouped.
   */
  private validateReportColumns(sheet: SheetConfig, columns: string[], groupBy: string[]): string | null {
    const allowed = new Set([sheet.primaryTable, ...sheet.joins.map(j => j.tid)]);
    const AGG = ['sum', 'count', 'avg', 'max', 'min'];
    const isAgg = (c: string) => AGG.includes(c.split('.')[0] || '');

    for (const c of columns) {
      if (c.startsWith('@')) {
        return `Formula "${c.slice(1)}" is missing its table prefix.`;
      }
      const table = this.tableOfColumnEntry(c);
      if (table && !allowed.has(table)) {
        const label = this.dataSources.find(d => d.id === table)?.label || table;
        return `Add a join to "${label}" first.`;
      }
    }

    if (columns.some(isAgg)) {
      const grouped = new Set(groupBy);
      const missing = columns.find(c => !isAgg(c) && !grouped.has(c));
      if (missing) {
        return `"${this.labelForKey(missing)}" must be grouped when totals are shown.`;
      }
    }
    return null;
  }

  /** True when `tableId` has a `branchId` column (i.e. it is branch-scoped and
   *  the backend will auto-inject the Branches tenant join for it). */
  private tableHasBranchId(tableId: string): boolean {
    const t = this.dataSources.find(d => d.id === tableId);
    return !!t?.data?.some(f => f.id === 'branchId');
  }

  /**
   * Dev-only acceptance check for a built join. Logs (does not throw) so a wrong
   * join is visible before it's sent without blocking the user's click. Catches
   * the classic regression where `sf`/`tf` carry TABLE names instead of column
   * names (e.g. `ON "Products"."Products" = ...`), plus columns that don't exist
   * on their table. `id` is exempt from the column-existence check — it's the
   * conventional PK and isn't always exposed as a selectable field.
   */
  private assertValidJoin(join: ReportJoin): void {
    const problems: string[] = [];
    if (!this.isTableId(join.sid)) problems.push(`sid "${join.sid}" is not a real table`);
    if (!this.isTableId(join.tid)) problems.push(`tid "${join.tid}" is not a real table`);
    if (this.isTableId(join.sf)) problems.push(`sf "${join.sf}" looks like a table name, expected a column`);
    if (this.isTableId(join.tf)) problems.push(`tf "${join.tf}" looks like a table name, expected a column`);
    if (join.sf !== 'id' && !this.hasColumn(join.sid, join.sf)) problems.push(`sf "${join.sf}" is not a column on "${join.sid}"`);
    if (join.tf !== 'id' && !this.hasColumn(join.tid, join.tf)) problems.push(`tf "${join.tf}" is not a column on "${join.tid}"`);
    if (!['LEFT', 'RIGHT', 'INNER', 'FULL'].includes(join.type || '')) {
      problems.push(`type "${join.type}" is not a valid join type`);
    }
    if (problems.length) {
      console.error('[CustomReports] Invalid join (will likely produce wrong SQL):', problems.join('; '), join);
    }
  }

  /** Table id owning a column key — "Table.field" or "Table.@formulaKey". */
  private tableOfColKey(colKey: string): string {
    return (colKey || '').split('.')[0];
  }

  /** Table id referenced by a sort id — "Table.col" | "agg.Table.col" | "datepart.Table.col". */
  private tableOfSortId(id: string): string {
    const parts = (id || '').split('.');
    return parts.length >= 3 ? parts[1] : (parts[0] || '');
  }

  toggleJoin(tid: string): void {
    const sheet = this.activeSheet;
    if (!sheet) return;

    const alreadyJoined = sheet.joins.some(j => j.tid === tid);
    // The backend auto-joins Branches for branch-scoped base tables and drops
    // any Branches join we send, so adding one is a no-op — bail before
    // touching history.
    if (!alreadyJoined && tid === BRANCH_TABLE && this.tableHasBranchId(sheet.primaryTable)) {
      return;
    }

    if (alreadyJoined) {
      // Cascade: removing a table must also drop any join that hangs off it
      // (sid === removed table), transitively — otherwise a bridge removal
      // (e.g. BranchProducts) would leave an orphaned ProductBatches join
      // pointing at a table that's no longer in the query.
      const toRemove = new Set([tid]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const j of sheet.joins) {
          if (toRemove.has(j.sid) && !toRemove.has(j.tid)) { toRemove.add(j.tid); changed = true; }
        }
      }
      this.pushHistory();
      this.sheets = this.sheets.map(s => {
        if (s.id !== sheet.id) return s;
        // Drop the joins, then purge anything that referenced the removed
        // tables so the query never asks for a column on an un-joined table.
        const keepCol = (c: ReportColumn) => !toRemove.has(this.tableOfColKey(c.col));
        return {
          ...s,
          joins: s.joins.filter(j => !toRemove.has(j.tid)),
          rowsShelf: s.rowsShelf.filter(keepCol),
          columnsShelf: s.columnsShelf.filter(keepCol),
          marks: s.marks.filter(m => !toRemove.has(this.tableOfColKey(m.field.col))),
          filterRules: s.filterRules.filter(r => !toRemove.has(this.tableOfColKey(r.field))),
          sortBy: s.sortBy.filter(so => !toRemove.has(this.tableOfSortId(so.id))),
          groupBy: s.groupBy && toRemove.has(this.tableOfColKey(s.groupBy)) ? undefined : s.groupBy,
        };
      });
    } else {
      // Resolve the full join chain BEFORE mutating state — adding a transitive
      // table (e.g. ProductBatches) injects its bridge (BranchProducts) first.
      // An empty result means a link couldn't be resolved, so we add nothing
      // rather than send a payload that would only produce a database error.
      const newJoins = this.buildJoinChain(tid, sheet);
      if (!newJoins.length) return;
      this.pushHistory();
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, joins: [...s.joins, ...newJoins] } : s
      );
    }
    if (this.autoRefresh) this.fetchReportData();
  }

  isJoined(tid: string): boolean {
    return this.activeSheet?.joins.some(j => j.tid === tid) || false;
  }

  getJoin(tid: string): any {
    return this.activeSheet?.joins.find(j => j.tid === tid);
  }

  setJoinType(tid: string, type: string): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    if (!sheet) return;
    this.sheets = this.sheets.map(s =>
      s.id === sheet.id ? { ...s, joins: s.joins.map(j => j.tid === tid ? { ...j, type } : j) } : s
    );
    if (this.autoRefresh) this.fetchReportData();
  }

  // ─── Sort ─────────────────────────────────────────

  /**
   * Open the Add-sort picker modal. Pre-populates the choices with every
   * column currently on the shelves that isn't already in sortBy.
   */
  addSort(): void {
    const { columns } = shelvesToApiParams(this.activeSheet);
    if (columns.length === 0) return;
    const alreadySorted = new Set(this.activeSheet.sortBy.map(s => s.id));
    this.addSortChoices = columns
      .filter(k => !alreadySorted.has(k))
      .map(k => ({ key: k, label: this.labelForKey(k) }));
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
    this.sheets = this.sheets.map(s =>
      s.id === sheet.id ? { ...s, sortBy: [...s.sortBy, newEntry] } : s
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
    this.sheets = this.sheets.map(s => s.id === sheet.id ? { ...s, sortBy: list } : s);
    if (this.autoRefresh) this.fetchReportData();
  }

  removeSort(index: number): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    this.sheets = this.sheets.map(s =>
      s.id === sheet.id ? { ...s, sortBy: s.sortBy.filter((_, i) => i !== index) } : s
    );
  }

  toggleSortDir(index: number): void {
    this.pushHistory();
    const sheet = this.activeSheet;
    this.sheets = this.sheets.map(s =>
      s.id === sheet.id ? { ...s, sortBy: s.sortBy.map((sr, i) => i === index ? { ...sr, mod: sr.mod === 'ASC' ? 'DESC' : 'ASC' } : sr) } : s
    );
  }

  // ─── View Mode Run ────────────────────────────────

  onViewModeRun(event: { filters: FilterRule[]; glue: string; page: number; pageSize: number }): void {
    const sheet = this.activeSheet;
    if (sheet) {
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, filterRules: event.filters, filterGlue: event.glue, currentPage: event.page, pageSize: event.pageSize } : s
      );
      this.fetchReportData(true);
    }
  }

  // ─── Pagination ───────────────────────────────────

  onSortChange(event: { key: string; dir: 'ASC' | 'DESC' }): void {
    const sheet = this.activeSheet;
    if (!sheet) return;
    // Replace sort with the clicked column (server-side sort = single column)
    this.sheets = this.sheets.map(s =>
      s.id === sheet.id ? { ...s, sortBy: [{ id: event.key, mod: event.dir }], currentPage: 1 } : s
    );
    this.fetchReportData(true);
  }

  onPageChange(page: number): void {
    const sheet = this.activeSheet;
    if (sheet) {
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, currentPage: page } : s
      );
      this.fetchReportData(true);
    }
  }

  onPageSizeChange(size: number): void {
    const sheet = this.activeSheet;
    if (sheet) {
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, pageSize: size, currentPage: 1 } : s
      );
      this.fetchReportData(true);
    }
  }

  // ─── Dashboard ────────────────────────────────────

  onDashboardGlobalFilters(event: { filters: FilterRule[]; glue: string }): void {
    if (this.dashboard) {
      this.dashboard = { ...this.dashboard, globalFilters: event.filters, globalFilterGlue: event.glue };
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
    if (!this.dashboard) { this.arrangeOpen = false; return; }
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
      const sheet = this.sheets.find(s => s.id === ds.sheetId);
      if (!sheet) continue;
      const w = new DashboardWidgets();
      w.slug = ds.sheetId;
      w.title = sheet.name || 'Sheet';
      w.colSpan = ds.width || 6;
      w.isCustom = false;
      if (used + w.colSpan > 12 && row.widgets.length) {
        rows.push(row); row = new DashboardRow(); used = 0;
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
    rows.forEach(r => r.widgets.forEach(w => {
      out.push({ sheetId: w.slug, x: 0, y: 0, width: w.colSpan || 6, height: 1 });
    }));
    return out;
  }

  async onDashboardRunAll(): Promise<void> {
    if (!this.dashboard) return;
    this.dashboardSheetsLoading = new Set(this.dashboard.sheets.map(ds => ds.sheetId));
    this.cdr.detectChanges();

    const requests = this.dashboard.sheets.map(ds => {
      const sheet = this.sheets.find(s => s.id === ds.sheetId);
      if (!sheet) return null;
      const { columns, groupBy } = shelvesToApiParams(sheet);
      const mergedFilters = [...sheet.filterRules, ...(this.dashboard?.globalFilters || [])];
      const validRules = buildValidFilterRules(mergedFilters);
      const request: CustomReportRequest = {
        tableName: sheet.primaryTable,
        columns,
        joins: sheet.joins,
        sort: sheet.sortBy,
        group: groupBy,
        limit: sheet.pageSize,
      };
      if (validRules.length > 0) {
        request.query = { glue: sheet.filterGlue, rules: validRules };
      }
      return { sheetId: ds.sheetId, request };
    }).filter(Boolean) as { sheetId: string; request: CustomReportRequest }[];

    const results = await Promise.all(
      requests.map(async ({ sheetId, request }) => {
        try {
          const result = await this.customReports.getCustomizedReport(request);
          coerceNumericMeasures(result.rows);
          const dashSheet = this.sheets.find(s => s.id === sheetId) || null;
          coerceNumericRows(result.rows, dashSheet, this.fieldMetaByFullId());
          return { sheetId, data: result.rows };
        } catch {
          return { sheetId, data: [] };
        }
      })
    );

    const newMap = new Map<string, any[]>();
    results.forEach(r => newMap.set(r.sheetId, r.data));
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
    this.saving = true;
    this.saveError = null;
    try {
      const config: ReportConfig = {
        version: 2,
        type: this.reportType,
        activeSheetId: this.activeSheetId,
        sheets: this.sheets,
        dashboard: this.dashboard || undefined,
      };

      const text = JSON.stringify(config);

      let result: any;
      if (this.activeModuleId) {
        result = await this.customReports.updateModule(this.activeModuleId, { name: this.reportName, text });
      } else {
        result = await this.customReports.saveModule({ name: this.reportName, text });
      }

      // Defense in depth: the service is expected to reject on a contract-shape
      // failure ({ success:false } at HTTP 200), but guard here in case a raw
      // failure object slips through (e.g. a non-throwing service implementation).
      if (result && typeof result === 'object' && (result as any).success === false) {
        this.saveError = (result as any).msg || 'Save failed';
        this.saving = false;
        return;
      }

      const wasNew = !this.activeModuleId;
      if (wasNew && result?.id) {
        this.activeModuleId = result.id;
      }
      // Refresh the Recent list so the just-saved report appears in it.
      this.modules = await this.customReports.getModules();
      this.lastSavedAt = new Date();

      // First save of a brand-new report — move the URL from
      // `/custom-report/new` to `/custom-report/edit/<id>` so a reload or
      // shared link opens the saved module. `replaceUrl: true` so the
      // history stack doesn't get a stale `/new` entry behind us.
      if (wasNew && this.activeModuleId) {
        this.router.navigate(
          ['/custom-report', 'edit', this.activeModuleId],
          { replaceUrl: true },
        );
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      this.saveError = err?.message || err?.msg || 'Save failed';
    }
    this.saving = false;
  }

  // ─── New UI helpers (visual only — no data/service impact) ──

  get statusLabel(): string {
    return this.activeModuleId ? 'Published' : 'Draft';
  }

  get savedAgoText(): string {
    if (!this.lastSavedAt) return 'Not saved yet';
    const diff = Math.floor((Date.now() - this.lastSavedAt.getTime()) / 1000);
    if (diff < 5) return 'Saved just now';
    if (diff < 60) return 'Saved ' + diff + ' sec ago';
    const min = Math.floor(diff / 60);
    if (min < 60) return 'Saved ' + min + ' min ago';
    const hr = Math.floor(min / 60);
    if (hr < 24) return 'Saved ' + hr + ' hr ago';
    const day = Math.floor(hr / 24);
    return 'Saved ' + day + ' day ago';
  }

  commitName(): void {
    this.editingName = false;
    if (!this.reportName.trim()) this.reportName = 'Untitled report';
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
    if (q) list = list.filter(m => m.name.toLowerCase().includes(q));
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
    } catch { return ''; }
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
    this.reportName = 'Untitled report';
    this.lastSavedAt = null;
    this.reportData = [];
  }

  loadModule(mod: SavedModule): void {
    this.pushHistory();
    try {
      const cfg = JSON.parse(mod.text);

      if (cfg.version === 2) {
        this.loadV2Config(cfg as ReportConfig);
      } else {
        this.loadLegacyModule(cfg);
      }

      this.activeModuleId = mod.id;
      this.reportName = mod.name;
      this.fetchReportData(true);
      // Dashboard reports also need their per-card data populated on load.
      if (this.reportType === 'dashboard' && this.dashboard) {
        this.syncDashboardSheets();
        this.onDashboardRunAll();
      }
    } catch (e) {
      console.error('[CustomReports] Failed to load module:', e);
    }
  }

  private loadV2Config(cfg: ReportConfig): void {
    // Defensively backfill defaults for fields added after the saved module
    // was originally written. Old reports stay loadable; new toggles default
    // to safe values.
    this.sheets = (cfg.sheets || []).map(s => ({
      ...s,
      // showLabels was added later — older modules may not carry it. Default
      // is `true` to match createDefaultSheet().
      showLabels: typeof s.showLabels === 'boolean' ? s.showLabels : true,
      marks: Array.isArray(s.marks) ? s.marks : [],
      calculatedFields: Array.isArray(s.calculatedFields) ? s.calculatedFields : [],
    }));
    this.activeSheetId = cfg.activeSheetId;
    this.reportType = cfg.type;
    this.dashboard = cfg.dashboard || null;
  }

  private loadLegacyModule(cfg: any): void {
    // Shared with the dashboard widget so both render legacy reports identically.
    const sheet = legacySheetFromConfig(cfg, this.dataSources[0]?.id || '');
    this.sheets = [sheet];
    this.activeSheetId = sheet.id;
    this.reportType = 'sheet';
    this.dashboard = null;
  }

  loadQuery(q: SavedQuery): void {
    this.pushHistory();
    try {
      const cfg = JSON.parse(q.text);
      const sheet = this.activeSheet;
      if (sheet) {
        this.sheets = this.sheets.map(s =>
          s.id === sheet.id ? { ...s, filterRules: cfg.rules || [], filterGlue: cfg.glue || ' AND ' } : s
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
    this.reorderList = this.orderedColumns.length > 0
      ? this.orderedColumns.map(k => ({ key: k, label: this.getFieldLabel(k) || this.labelForKey(k) }))
      : this.dataKeys.map(k => ({ key: k, label: this.labelForKey(k) }));
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
    this.orderedColumns = this.reorderList.map(r => r.key);
    this.showReorderDialog = false;
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
    const f = this.allFields.find(x => x.fullId === fullId && x.isFormula);
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
    if (parts.length >= 3 && ['year', 'month', 'day', 'yearmonth', 'yearmonthday'].includes(parts[0])) {
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
    const baseName = (this.reportName || 'report').replace(/[^a-z0-9-_ ]/gi, '_').trim() || 'report';

    this.exporting = true;
    this.cdr.detectChanges();
    // Give the browser a tick to paint the spinner before we kick off the
    // potentially heavy fetch / file-build. Without this yield, a fast
    // local-cached fetch + synchronous XLSX write can run in a single
    // microtask and the spinner never visibly appears.
    await new Promise(r => setTimeout(r, 0));
    try {
      // CSV / XLSX / PDF need full data — refetch every row regardless of
      // pagination. PNG is a visual screenshot (chart image) so the visible
      // canvas is enough; no fetch needed.
      const needsAllData = format !== 'png';
      const rows = needsAllData ? await this.fetchAllForExport() : this.reportData;

      // Yield once more before the synchronous file-write step so the
      // spinner repaints between "fetching" and "writing" instead of the
      // UI thread blocking through the whole sequence.
      await new Promise(r => setTimeout(r, 0));

      if (format === 'csv')  { this.exportCsv(baseName, rows); return; }
      if (format === 'xlsx') { this.exportXlsx(baseName, rows); return; }
      if (format === 'pdf')  { await this.exportPdf(baseName, rows); return; }
      if (format === 'png')  { await this.exportPng(baseName); return; }
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
    if (!sheet) return [];
    const { columns, groupBy } = shelvesToApiParams(sheet);
    if (columns.length === 0) return [];

    // Build the filter query block — same logic as `fetchReportData`.
    const validRules = buildValidFilterRules(sheet.filterRules);
    const request: CustomReportRequest = {
      tableName: sheet.primaryTable,
      columns,
      joins: sheet.joins,
      sort: sheet.sortBy,
      group: groupBy,
      limit: null, // no-limit sentinel — service emits an empty `limit`
      offset: 0,
    };
    if (validRules.length > 0) {
      request.query = { glue: sheet.filterGlue, rules: validRules };
    }

    const result = await this.customReports.getCustomizedReport(request);
    const all = result.rows || [];
    coerceNumericMeasures(all);
    coerceNumericRows(all, sheet, this.fieldMetaByFullId());
    if (sheet.calculatedFields?.length) {
      applyCalculatedFields(all, sheet.calculatedFields);
    }
    return all;
  }

  // ─── Build tabular rows from supplied data ──
  //
  // Pre-formats every cell using the same pipeline as chart-preview's
  // table render: column-format override → boolean / date → numberFormat
  // (currency / integer / decimal) → fallback string. The result is a row
  // shape where every value is already a display string, so CSV / XLSX /
  // PDF writers just stringify whatever they get.
  private buildExportRows(rowsIn: any[]): { headers: { key: string; label: string }[]; rows: any[] } {
    if (!rowsIn?.length) return { headers: [], rows: [] };
    const keys = this.orderedColumns.length
      ? this.orderedColumns.filter(k => Object.prototype.hasOwnProperty.call(rowsIn[0], k))
      : Object.keys(rowsIn[0]);
    const allKeys = [...keys];
    Object.keys(rowsIn[0]).forEach(k => { if (!allKeys.includes(k)) allKeys.push(k); });

    // Same label resolver as the on-screen preview — `SUM(guests)`,
    // `yearmonth(documentDate)`, custom aliases, etc.
    const headers = allKeys.map(k => ({ key: k, label: this.labelForKey(k) }));

    // Pre-format every cell using the shared formatter so consumers don't
    // have to know about company settings / numberFormat / boolean etc.
    const ctx = {
      columnFormats: this.columnFormats,
      columnTypes: this.columnTypes,
      columnNumberFormats: this.columnNumberFormats,
      companySettings: (CompanyService as any).companySettings,
    };
    const rows = rowsIn.map(row => {
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
    lines.push(headers.map(h => esc(h.label)).join(','));
    for (const row of rows) lines.push(headers.map(h => esc(row[h.key])).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${baseName}.csv`);
  }

  private exportXlsx(baseName: string, rowsIn: any[]): void {
    const { headers, rows } = this.buildExportRows(rowsIn);
    if (!headers.length) return;
    const aoa: any[][] = [headers.map(h => h.label)];
    for (const row of rows) aoa.push(headers.map(h => row[h.key] ?? ''));
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
      pdf.text(`${rows.length} row${rows.length === 1 ? '' : 's'} · exported ${new Date().toLocaleString()}`, 40, 52);
      pdf.setTextColor(0);

      autoTable(pdf, {
        startY: 64,
        head: [headers.map(h => h.label)],
        body: rows.map(row => headers.map(h => {
          const v = row[h.key];
          return v == null ? '' : String(v);
        })),
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
    canvas.toBlob(blob => { if (blob) saveAs(blob, `${baseName}.png`); }, 'image/png');
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
      const dims = result.filter(c => !c.agg);
      const meas = result.filter(c => !!c.agg);
      this.sheets = this.sheets.map(s =>
        s.id === sheet.id ? { ...s, columnsShelf: dims, rowsShelf: meas } : s
      );
      if (this.autoRefresh) this.fetchReportData();
    });
  }

  // ─── Helper ───────────────────────────────────────

  getFieldLabel(col: string): string {
    const f = this.allFields.find(x => x.fullId === col);
    return f ? f.label : col;
  }
}
