import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CdkDragDrop,
  CdkDragEnd,
  CdkDragMove,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { DesktopOnlyNoticeComponent } from '@shared/components/desktop-only-notice/desktop-only-notice.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import {
  BranchSettingsService,
  BranchSummary,
} from '../../services/branch-settings.service';
import {
  DECOR_ASPECT,
  DecorObject,
  DecorObjectType,
  PATTERN_SLUGS,
  RestaurantTable,
  TABLE_DIMENSIONS,
  TableGroup,
  TableManagementService,
  TableShape,
  TableSize,
  defaultPatternSize,
} from '../../services/table-management.service';
import {
  PickUnassignedModalData,
  PickUnassignedTablesModalComponent,
} from './pick-unassigned-tables-modal.component';

// Canvas dimensions roughly match a real restaurant floor plan — big
// enough to lay out 30-50 tables in a realistic spread without feeling
// cramped. The wrapper acts as a viewport (overflow: auto + pan/zoom)
// so the user navigates around it like a real workspace, matching the
// legacy pinch-zoom builder.
const CANVAS_W = 1800;
const CANVAS_H = 1200;

const DEFAULT_TABLE: Omit<RestaurantTable, 'id' | 'name'> = {
  maxSeat: 4,
  properties: {
    type:      'circle',
    size:      'medium',
    angle:     0,
    position:  { x: 60, y: 60 },
    visible:   true,
    hideSeats: false,
  },
  settings: { minimumCharge: 0, chargePerHour: 0, chargeAfter: 0 },
};

const GROUP_COLORS = ['#32acc1', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#0ea5e9', '#6366f1', '#14b8a6'];

/** Tabs in the right-hand panel — same trio the legacy form had. */
type PanelTab = 'settings' | 'tables' | 'objects';

/** Right-click menu state — `null` when closed. */
interface CtxMenu {
  x: number;
  y: number;
  /** Canvas-relative point we'd add a new table/object at. */
  canvasX: number;
  canvasY: number;
}

/**
 * Settings → Table Management
 * ───────────────────────────
 * Visual floor-plan editor — full-page port of the legacy feature.
 *
 * Header: branch picker.
 * Group tabs: horizontal strip across the top, drag-reorderable, with
 *   inline rename + delete. The "+" tab opens a small menu of inactive
 *   groups for the branch (re-activate) plus an "Add new" entry.
 * Canvas: drag-drop tables and decor objects on a coloured floor plan
 *   with optional pattern background. Right-click anywhere on the
 *   canvas opens a context menu (Add table / Pick unassigned / Add
 *   object / Group settings).
 * Right panel: three tabs — Settings (group color, pattern, size),
 *   Tables (selected-table edit form), Objects (selected-object edit
 *   form). Tables/Objects auto-switch when the user clicks one on the
 *   canvas; Settings is the default empty-selection target.
 *
 * One sticky save commits every group at once via
 * `tables/saveTable`, matching the legacy POST shape.
 */
@Component({
  selector: 'app-table-management',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    DragDropModule,
    LoadingOverlayComponent,
    DesktopOnlyNoticeComponent,
    SearchDropdownComponent,
    ColorPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table-management.component.html',
  styleUrl: './table-management.component.scss',
})
export class TableManagementComponent implements OnInit, CanLeaveComponent {
  private service       = inject(TableManagementService);
  private branchService = inject(BranchSettingsService);
  private translate     = inject(TranslateService);
  private destroyRef    = inject(DestroyRef);
  private router        = inject(Router);
  private modal         = inject(ModalService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  // ─── Branches ──────────────────────────────────────────────────────────
  branches       = signal<BranchSummary[]>([]);
  selectedBranch = signal<BranchSummary | null>(null);

  // ─── Groups + selection ────────────────────────────────────────────────
  groups          = signal<TableGroup[]>([]);
  selectedGroupId = signal<string | null>(null);

  /**
   * Selection model — sets so multi-select works for tables AND
   * decor objects. Plain click replaces the set with `{id}`,
   * Ctrl/Cmd+click toggles `id` in/out (additive). The single-id
   * `selectedTableId` / `selectedObjectId` signals below are the
   * "primary" selection (the one whose properties show in the form
   * panel) — set to the *last clicked* id.
   */
  selectedTableIds  = signal<Set<string>>(new Set());
  selectedObjectIds = signal<Set<string>>(new Set());
  selectedTableId   = signal<string | null>(null);
  selectedObjectId  = signal<string | null>(null);

  /** Active tab on the right-hand panel. */
  panelTab = signal<PanelTab>('settings');

  /** Right-hand panel collapsed → slides off the canvas so the
   *  workspace reclaims the full width. Toggled by the chevron tab
   *  on the panel's outer edge (matches the legacy `›` collapse). */
  panelCollapsed = signal<boolean>(false);

  /** Canvas zoom (0.5 → 1.5). */
  zoom = signal<number>(1);

  /** Open inactive-groups dropdown beside the "+" tab. */
  showAddGroupMenu  = signal<boolean>(false);
  inactiveGroups    = signal<TableGroup[]>([]);

  /** Right-click context menu — `null` when closed. */
  ctxMenu = signal<CtxMenu | null>(null);

  /** Snapshot of `groups` taken on each load — drives `isDirty`. */
  private snapshot = signal<string>('[]');

  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  canvasEl   = viewChild<ElementRef<HTMLElement>>('canvas');
  canvasWrap = viewChild<ElementRef<HTMLElement>>('canvasWrap');

  /** True while the user is mid-pan — drives the cursor + disables pointer
   *  events on tables/objects so the drag doesn't accidentally pick one up. */
  panning = signal<boolean>(false);
  /** Captured at panStart — used by document:mousemove to compute deltas. */
  private panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

  // ─── Constants for templates ───────────────────────────────────────────
  readonly canvasW = CANVAS_W;
  readonly canvasH = CANVAS_H;
  readonly groupColors = GROUP_COLORS;
  readonly patternSlugs = PATTERN_SLUGS;
  readonly shapes: TableShape[] = ['circle', 'square', 'rectangle'];
  readonly sizes:  TableSize[]  = ['small', 'medium', 'large'];
  readonly decorTypes: DecorObjectType[] = [
    'TV', 'Sofa', 'Couch', 'GlassTable', 'Plant', 'WallTable', 'Divider',
  ];

  // ─── Derived ───────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.TABLE_MANAGEMENT') },
    ];
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  selectedGroup = computed<TableGroup | null>(() => {
    const id = this.selectedGroupId();
    if (!id) return null;
    return this.groups().find((g) => idOf(g) === id) ?? null;
  });

  selectedTable = computed<RestaurantTable | null>(() => {
    const g = this.selectedGroup();
    const id = this.selectedTableId();
    if (!g || !id) return null;
    return g.tables.find((t) => idOf(t) === id) ?? null;
  });

  selectedObject = computed<DecorObject | null>(() => {
    const g = this.selectedGroup();
    const id = this.selectedObjectId();
    if (!g || !id) return null;
    return g.objects.find((o) => idOf(o) === id) ?? null;
  });

  isDirty = computed<boolean>(() => {
    return JSON.stringify(this.serialise()) !== this.snapshot();
  });

  /** Used by the canvas styling to draw the selected pattern. */
  patternClass = computed<string>(() => {
    const p = this.selectedGroup()?.properties.defaultPattern ?? '1';
    return `tm-pattern--p${p}`;
  });

  patternSize = computed<number>(() => this.selectedGroup()?.properties.patternSize ?? 20);

  /** Pre-computed list rendered in the right-panel "Tables" tab. */
  panelTables = computed<RestaurantTable[]>(() => this.selectedGroup()?.tables ?? []);

  /** Pre-computed list rendered in the right-panel "Objects" tab. */
  panelObjects = computed<DecorObject[]>(() => this.selectedGroup()?.objects ?? []);

  constructor() {
    withTranslations('settings');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));

    // Wheel-to-zoom on the canvas wrapper. Has to be a non-passive
    // listener so we can call `preventDefault()` and stop the page
    // (or the wrapper) from scrolling on every tick. Re-attaches
    // automatically when the wrapper element appears/disappears via
    // the @if guards in the template.
    effect((onCleanup) => {
      const wrap = this.canvasWrap()?.nativeElement;
      if (!wrap) return;
      const handler = (e: WheelEvent) => {
        e.preventDefault();
        // 5% per tick — feels right between trackpad fine-grain and
        // mouse wheel coarse ticks. clamp to the same 0.5–1.5 range
        // the toolbar buttons use so behaviour stays consistent.
        const dz = e.deltaY > 0 ? -0.05 : 0.05;
        this.zoom.set(clamp(this.zoom() + dz, 0.5, 1.5));
      };
      wrap.addEventListener('wheel', handler, { passive: false });
      onCleanup(() => wrap.removeEventListener('wheel', handler));
    });

    // Centre the canvas inside the wrap whenever a group becomes
    // active. The stage adds 1500 px of padding on each side so the
    // user can pan the canvas off any edge — but that means the
    // initial scroll position (0, 0) lands on empty padding. Scroll
    // so the canvas's top-left sits at the wrap's centre, matching
    // the legacy "canvas opens visible" feel.
    effect(() => {
      const groupId = this.selectedGroupId();
      const wrap = this.canvasWrap()?.nativeElement;
      if (!groupId || !wrap) return;
      // Defer one frame so the browser has measured the new layout
      // (group switch triggers re-render of the canvas inside).
      queueMicrotask(() => {
        const z = this.zoom();
        wrap.scrollLeft = 1500 - Math.max(0, (wrap.clientWidth  - this.canvasW * z) / 2);
        wrap.scrollTop  = 1500 - Math.max(0, (wrap.clientHeight - this.canvasH * z) / 2);
      });
    });
  }

  // ─── Pan-by-drag (click anywhere on the canvas background) ────────────
  onPanStart(ev: MouseEvent): void {
    // Only start a pan if the click landed on the canvas/wrapper itself,
    // not on a draggable table or decor object — those have their own
    // CDK drag and would otherwise fight the pan handler.
    const target = ev.target as HTMLElement;
    if (target.closest('.tm-table, .tm-decor')) return;
    // Right-click is reserved for the context menu.
    if (ev.button !== 0) return;
    const wrap = this.canvasWrap()?.nativeElement;
    if (!wrap) return;
    ev.preventDefault();
    this.panning.set(true);
    this.panStart = {
      x: ev.clientX,
      y: ev.clientY,
      scrollLeft: wrap.scrollLeft,
      scrollTop:  wrap.scrollTop,
    };
  }

  @HostListener('document:mousemove', ['$event'])
  onPanMove(ev: MouseEvent): void {
    if (!this.panning()) return;
    const wrap = this.canvasWrap()?.nativeElement;
    if (!wrap) return;
    wrap.scrollLeft = this.panStart.scrollLeft - (ev.clientX - this.panStart.x);
    wrap.scrollTop  = this.panStart.scrollTop  - (ev.clientY - this.panStart.y);
  }

  @HostListener('document:mouseup')
  onPanEnd(): void {
    if (this.panning()) this.panning.set(false);
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.branchService.getList({ page: 1, limit: 100 });
      this.branches.set(res.list);
      const first = res.list[0] ?? null;
      this.selectedBranch.set(first);
      if (first) await this.loadGroups(first.id);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Branch ────────────────────────────────────────────────────────────
  async onBranchChange(b: BranchSummary | null): Promise<void> {
    if (!b) return;
    if (this.isDirty()) {
      const ok = await this.confirm({
        title:   this.translate.instant('COMMON.UNSAVED_TITLE'),
        message: this.translate.instant('SETTINGS.TABLES.CONFIRM_BRANCH_SWITCH'),
        confirm: this.translate.instant('COMMON.LEAVE'),
        danger:  true,
      });
      if (!ok) return;
    }
    this.selectedBranch.set(b);
    await this.loadGroups(b.id);
  }

  branchLabel  = (b: BranchSummary) => b.name || b.id;
  branchValue  = (b: BranchSummary) => b;
  branchEquals = (a: BranchSummary | null, b: BranchSummary | null) => (a?.id ?? a) === (b?.id ?? b);

  // ─── Groups ────────────────────────────────────────────────────────────
  async loadGroups(branchId: string): Promise<void> {
    this.loading.set(true);
    try {
      const groups = await this.service.getGroups(branchId);
      // Stamp a `__tempId` on every entity that came back without a
      // server id. Without this, `idOf` falls through to '' for them,
      // so multiple id-less entities share the same key — clicking
      // one decor object would select every id-less object in the
      // group. The temp id rides through subsequent `{...spread}`
      // patches so the identity stays stable.
      for (const g of groups) {
        if (!g.id) (g as any).__tempId = tempId();
        for (const t of g.tables)  if (!t.id) (t as any).__tempId = tempId();
        for (const o of g.objects) if (!o.id) (o as any).__tempId = tempId();
      }
      this.groups.set(groups);
      this.selectedGroupId.set(groups[0] ? idOf(groups[0]) : null);
      this.selectedTableId.set(null);
      this.selectedObjectId.set(null);
      this.selectedTableIds.set(new Set());
      this.selectedObjectIds.set(new Set());
      this.snapshot.set(JSON.stringify(this.serialise()));
    } finally {
      this.loading.set(false);
    }
  }

  selectGroup(id: string): void {
    this.selectedGroupId.set(id);
    this.selectedTableId.set(null);
    this.selectedObjectId.set(null);
    this.selectedTableIds.set(new Set());
    this.selectedObjectIds.set(new Set());
    this.panelTab.set('settings');
  }

  addGroup(seed?: TableGroup): void {
    const id = tempId();
    const branchId = this.selectedBranch()?.id ?? '';
    const fresh: TableGroup = seed
      ? { ...seed, id: seed.id ?? null, branchId }
      : {
          id:        null,
          name:      this.translate.instant('SETTINGS.TABLES.NEW_GROUP_DEFAULT'),
          branchId,
          properties: {
            color:          GROUP_COLORS[this.groups().length % GROUP_COLORS.length],
            defaultPattern: '1',
            patternSize:    defaultPatternSize('1'),
          },
          tables:  [],
          objects: [],
        };
    (fresh as any).__tempId = id;
    this.groups.update((list) => [...list, fresh]);
    this.selectedGroupId.set(idOf(fresh));
    this.selectedTableId.set(null);
    this.selectedObjectId.set(null);
    this.panelTab.set('settings');
    this.showAddGroupMenu.set(false);
  }

  patchGroup<K extends keyof TableGroup>(id: string, key: K, value: TableGroup[K]): void {
    this.groups.update((list) =>
      list.map((g) => (idOf(g) === id ? { ...g, [key]: value } : g)),
    );
  }

  patchGroupProps<K extends keyof TableGroup['properties']>(id: string, key: K, value: TableGroup['properties'][K]): void {
    this.groups.update((list) =>
      list.map((g) => (idOf(g) === id ? { ...g, properties: { ...g.properties, [key]: value } } : g)),
    );
  }

  /**
   * Set both `defaultPattern` and `patternSize` at once. Switching the
   * pattern resets the slider to that pattern's legacy default — same
   * behaviour as the old builder's `changePattern()`. Done in a single
   * `update` so isDirty observers don't see a half-applied state.
   */
  setPattern(id: string, pattern: string): void {
    const size = defaultPatternSize(pattern);
    this.groups.update((list) =>
      list.map((g) =>
        idOf(g) === id
          ? { ...g, properties: { ...g.properties, defaultPattern: pattern, patternSize: size } }
          : g,
      ),
    );
  }

  reorderGroups(event: CdkDragDrop<TableGroup[]>): void {
    const list = [...this.groups()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.groups.set(list);
  }

  async removeGroup(id: string): Promise<void> {
    const g = this.groups().find((x) => idOf(x) === id);
    if (!g) return;
    const ok = await this.confirm({
      title:   this.translate.instant('COMMON.DELETE'),
      message: this.translate.instant('SETTINGS.TABLES.CONFIRM_DELETE_GROUP', { name: g.name || '—' }),
      confirm: this.translate.instant('COMMON.DELETE'),
      danger:  true,
    });
    if (!ok) return;
    if (g.id) await this.service.deleteGroup(g.id);
    const next = this.groups().filter((x) => idOf(x) !== id);
    this.groups.set(next);
    this.selectedGroupId.set(next[0] ? idOf(next[0]) : null);
    this.selectedTableId.set(null);
    this.selectedObjectId.set(null);
    this.snapshot.set(JSON.stringify(this.serialise()));
  }

  /** Open the dropdown beside "+" — fetches inactive groups lazily. */
  async toggleAddGroupMenu(): Promise<void> {
    if (this.showAddGroupMenu()) {
      this.showAddGroupMenu.set(false);
      return;
    }
    const branchId = this.selectedBranch()?.id;
    if (!branchId) return;
    try {
      const inactive = await this.service.getInactiveGroups(branchId);
      // Filter out groups already in the editor (by id).
      const existing = new Set(this.groups().map((g) => g.id).filter(Boolean));
      this.inactiveGroups.set(inactive.filter((g) => !existing.has(g.id)));
    } catch {
      this.inactiveGroups.set([]);
    }
    this.showAddGroupMenu.set(true);
  }

  // ─── Tables ────────────────────────────────────────────────────────────
  addTable(at?: { x: number; y: number }): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    const id = tempId();
    const next: RestaurantTable = {
      ...JSON.parse(JSON.stringify(DEFAULT_TABLE)),
      id:   null,
      name: this.nextTableName(),
    };
    if (at) next.properties.position = { x: clamp(at.x, 0, this.canvasW - 100), y: clamp(at.y, 0, this.canvasH - 100) };
    (next as any).__tempId = id;
    this.groups.update((list) =>
      list.map((g) => idOf(g) === groupId
        ? { ...g, tables: [...g.tables, next] }
        : g,
      ),
    );
    this.selectedTableId.set(id);
    this.selectedTableIds.set(new Set([id]));
    this.selectedObjectId.set(null);
    this.selectedObjectIds.set(new Set());
    this.panelTab.set('tables');
  }

  /**
   * Click → select just this one. Ctrl/Cmd+click → toggle in the set
   * (multi-select). The "primary" `selectedTableId` always reflects
   * the most recently-clicked id, so the right-panel form continues
   * to show the relevant table's properties.
   */
  selectTable(id: string, additive: boolean = false): void {
    if (additive) {
      this.selectedTableIds.update((s) => {
        const next = new Set(s);
        if (next.has(id)) {
          next.delete(id);
          if (this.selectedTableId() === id) {
            const fallback = next.values().next();
            this.selectedTableId.set(fallback.done ? null : fallback.value);
          }
        } else {
          next.add(id);
          this.selectedTableId.set(id);
        }
        return next;
      });
    } else {
      this.selectedTableIds.set(new Set([id]));
      this.selectedTableId.set(id);
    }
    this.selectedObjectIds.set(new Set());
    this.selectedObjectId.set(null);
    this.panelTab.set('tables');
  }

  patchTable<K extends keyof RestaurantTable>(id: string, key: K, value: RestaurantTable[K]): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    this.groups.update((list) =>
      list.map((g) => idOf(g) === groupId
        ? { ...g, tables: g.tables.map((t) => idOf(t) === id ? { ...t, [key]: value } : t) }
        : g,
      ),
    );
  }

  patchTableProps<K extends keyof RestaurantTable['properties']>(id: string, key: K, value: RestaurantTable['properties'][K]): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    this.groups.update((list) =>
      list.map((g) => idOf(g) === groupId
        ? {
            ...g,
            tables: g.tables.map((t) => idOf(t) === id
              ? { ...t, properties: { ...t.properties, [key]: value } }
              : t),
          }
        : g,
      ),
    );
  }

  patchTableSettings<K extends keyof RestaurantTable['settings']>(id: string, key: K, value: RestaurantTable['settings'][K]): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    this.groups.update((list) =>
      list.map((g) => idOf(g) === groupId
        ? {
            ...g,
            tables: g.tables.map((t) => idOf(t) === id
              ? { ...t, settings: { ...t.settings, [key]: value } }
              : t),
          }
        : g,
      ),
    );
  }

  /**
   * Local-only helper that drops the table from the current group's
   * array. Always called from a flow that's already confirmed with
   * the user (the unassign-modal, or the new-table local delete) —
   * no built-in confirm of its own.
   */
  removeTable(id: string): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    this.groups.update((list) =>
      list.map((g) => idOf(g) === groupId
        ? { ...g, tables: g.tables.filter((t) => idOf(t) !== id) }
        : g,
      ),
    );
    if (this.selectedTableId() === id) this.selectedTableId.set(null);
    if (this.selectedTableIds().has(id)) {
      this.selectedTableIds.update((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  /**
   * Unassign one table.
   *   - **Already-saved table** (`t.id` set) → confirm, then call
   *     `tables/unassignTable/:id` so the row drops out of every
   *     group server-side. The table itself stays in the branch and
   *     can be brought back via "Re-attach unassigned tables".
   *   - **New, never-saved table** (`t.id == null`) → just drop it
   *     locally. No API call, no confirm — there are no orders for
   *     it yet so nothing to protect.
   * `skipConfirm` is set by the bulk-action path so we ask once for
   * the whole batch instead of per row.
   */
  async unassignTable(id: string, skipConfirm = false): Promise<void> {
    const t = this.selectedGroup()?.tables.find((x) => idOf(x) === id);
    if (!t) return;
    if (!t.id) {
      this.removeTable(id);
      return;
    }
    if (!skipConfirm) {
      const ok = await this.confirm({
        title:   this.translate.instant('SETTINGS.TABLES.UNASSIGN'),
        message: this.translate.instant('SETTINGS.TABLES.CONFIRM_UNASSIGN', { name: t.name }),
        confirm: this.translate.instant('SETTINGS.TABLES.UNASSIGN'),
        danger:  true,
      });
      if (!ok) return;
    }
    const success = await this.service.unassignTable(t.id);
    if (success) this.removeTable(id);
  }

  /** Bulk-unassign every selected table. Asks once for the batch and
   *  then routes per-row through `unassignTable` (server call for
   *  saved rows, local delete for unsaved ones). */
  async unassignSelectedTables(): Promise<void> {
    const ids = [...this.selectedTableIds()];
    if (ids.length === 0) return;
    const ok = await this.confirm({
      title:   this.translate.instant('SETTINGS.TABLES.UNASSIGN'),
      message: this.translate.instant('SETTINGS.TABLES.CONFIRM_UNASSIGN_MANY', { n: ids.length }),
      confirm: this.translate.instant('SETTINGS.TABLES.UNASSIGN'),
      danger:  true,
    });
    if (!ok) return;
    for (const id of ids) await this.unassignTable(id, true);
  }

  duplicateTable(id: string): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    const g = this.selectedGroup();
    const t = g?.tables.find((x) => idOf(x) === id);
    if (!t) return;
    const newId = tempId();
    const dup: RestaurantTable = {
      ...JSON.parse(JSON.stringify(t)),
      id:   null,
      name: `${t.name} (copy)`,
      properties: {
        ...t.properties,
        position: {
          x: clamp(t.properties.position.x + 24, 0, CANVAS_W - 80),
          y: clamp(t.properties.position.y + 24, 0, CANVAS_H - 80),
        },
      },
    };
    (dup as any).__tempId = newId;
    this.groups.update((list) =>
      list.map((g2) => idOf(g2) === groupId
        ? { ...g2, tables: [...g2.tables, dup] }
        : g2,
      ),
    );
    this.selectedTableId.set(newId);
    this.panelTab.set('tables');
  }

  rotateTable(id: string, delta: 45 | -45): void {
    const t = this.selectedGroup()?.tables.find((x) => idOf(x) === id);
    if (!t) return;
    const angle = (((t.properties.angle + delta) % 360) + 360) % 360;
    this.patchTableProps(id, 'angle', angle);
  }

  // ─── Decor objects ─────────────────────────────────────────────────────
  addObject(type: DecorObjectType, at?: { x: number; y: number }): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    const id = tempId();
    const aspect = DECOR_ASPECT[type];
    const next: DecorObject = {
      id:    null,
      type,
      position: at
        ? { x: clamp(at.x, 0, this.canvasW - aspect.w), y: clamp(at.y, 0, this.canvasH - aspect.h) }
        : { x: 80, y: 80 },
      angle:  0,
      width:  aspect.w,
      height: aspect.h,
      color:  type === 'Divider' ? '#94a3b8' : undefined,
    };
    (next as any).__tempId = id;
    this.groups.update((list) =>
      list.map((g) => idOf(g) === groupId
        ? { ...g, objects: [...g.objects, next] }
        : g,
      ),
    );
    this.selectedObjectId.set(id);
    this.selectedObjectIds.set(new Set([id]));
    this.selectedTableId.set(null);
    this.selectedTableIds.set(new Set());
    this.panelTab.set('objects');
  }

  selectObject(id: string, additive: boolean = false): void {
    if (additive) {
      this.selectedObjectIds.update((s) => {
        const next = new Set(s);
        if (next.has(id)) {
          next.delete(id);
          if (this.selectedObjectId() === id) {
            const fallback = next.values().next();
            this.selectedObjectId.set(fallback.done ? null : fallback.value);
          }
        } else {
          next.add(id);
          this.selectedObjectId.set(id);
        }
        return next;
      });
    } else {
      this.selectedObjectIds.set(new Set([id]));
      this.selectedObjectId.set(id);
    }
    this.selectedTableIds.set(new Set());
    this.selectedTableId.set(null);
    this.panelTab.set('objects');
  }

  patchObject<K extends keyof DecorObject>(id: string, key: K, value: DecorObject[K]): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    this.groups.update((list) =>
      list.map((g) => idOf(g) === groupId
        ? { ...g, objects: g.objects.map((o) => idOf(o) === id ? { ...o, [key]: value } : o) }
        : g,
      ),
    );
  }

  /** Resize one dimension and lock the other to the type's aspect ratio. */
  resizeObject(id: string, dim: 'width' | 'height', raw: number): void {
    const o = this.selectedGroup()?.objects.find((x) => idOf(x) === id);
    if (!o) return;
    const aspect = DECOR_ASPECT[o.type];
    const ratio = aspect.w / aspect.h;
    const v = Math.max(20, Math.round(raw));
    if (dim === 'width') {
      this.patchObject(id, 'width', v);
      // Divider has a free-form height (it's a thin line).
      if (o.type !== 'Divider') this.patchObject(id, 'height', Math.round(v / ratio));
    } else {
      this.patchObject(id, 'height', v);
      if (o.type !== 'Divider') this.patchObject(id, 'width', Math.round(v * ratio));
    }
  }

  resetObjectSize(id: string): void {
    const o = this.selectedGroup()?.objects.find((x) => idOf(x) === id);
    if (!o) return;
    const aspect = DECOR_ASPECT[o.type];
    this.patchObject(id, 'width',  aspect.w);
    this.patchObject(id, 'height', aspect.h);
  }

  rotateObject(id: string, delta: 45 | -45): void {
    const o = this.selectedGroup()?.objects.find((x) => idOf(x) === id);
    if (!o) return;
    const angle = (((o.angle + delta) % 360) + 360) % 360;
    this.patchObject(id, 'angle', angle);
  }

  removeObject(id: string): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    this.groups.update((list) =>
      list.map((g) => idOf(g) === groupId
        ? { ...g, objects: g.objects.filter((o) => idOf(o) !== id) }
        : g,
      ),
    );
    if (this.selectedObjectId() === id) this.selectedObjectId.set(null);
    if (this.selectedObjectIds().has(id)) {
      this.selectedObjectIds.update((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  // ─── Drag-drop position ────────────────────────────────────────────────
  /**
   * Live drag-offset signals so the *other* multi-selected items
   * visually follow the actively-dragged item during the drag (CDK
   * only applies its translate to the one being dragged). Without
   * these, only the dragged element moves on screen and the rest of
   * the selection appears to teleport on drop.
   *
   * `dragOriginKind` + `dragOriginId` identify which item is the
   * drag source; `dragOffset` tracks its delta in *canvas* pixels
   * (CDK reports screen-px → divide by zoom). Non-origin items in
   * the same selection get this offset bound to their wrap's
   * `transform: translate(...)` via `extraTransformFor*` below.
   */
  dragOriginKind = signal<'table' | 'object' | null>(null);
  dragOriginId   = signal<string | null>(null);
  dragOffset     = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  /** True only while a multi-selection bulk drag is in progress. */
  private isBulkDragging(kind: 'table' | 'object', id: string): boolean {
    if (this.dragOriginKind() !== kind || this.dragOriginId() === null) return false;
    if (this.dragOriginId() === id) return false; // origin uses CDK's translate
    return kind === 'table'
      ? this.selectedTableIds().has(this.dragOriginId()!) && this.selectedTableIds().has(id) && this.selectedTableIds().size > 1
      : this.selectedObjectIds().has(this.dragOriginId()!) && this.selectedObjectIds().has(id) && this.selectedObjectIds().size > 1;
  }

  /** Inline `transform` for a non-origin selected table during a bulk
   *  drag. Returns `null` when no bulk drag is in progress so the
   *  wrap renders at its plain `[style.left/top.px]`. */
  extraTransformForTable(t: RestaurantTable): string | null {
    if (!this.isBulkDragging('table', idOf(t))) return null;
    const o = this.dragOffset();
    return `translate(${o.x}px, ${o.y}px)`;
  }

  extraTransformForObject(o: DecorObject): string | null {
    if (!this.isBulkDragging('object', idOf(o))) return null;
    const off = this.dragOffset();
    return `translate(${off.x}px, ${off.y}px)`;
  }

  /** Wired to `(cdkDragStarted)`. If the dragged item is part of a
   *  multi-selection, arm bulk-drag mode so its siblings begin
   *  tracking the live offset. */
  onTableDragStart(t: RestaurantTable): void {
    const id = idOf(t);
    if (this.selectedTableIds().has(id) && this.selectedTableIds().size > 1) {
      this.dragOriginKind.set('table');
      this.dragOriginId.set(id);
      this.dragOffset.set({ x: 0, y: 0 });
    }
  }

  onObjectDragStart(o: DecorObject): void {
    const id = idOf(o);
    if (this.selectedObjectIds().has(id) && this.selectedObjectIds().size > 1) {
      this.dragOriginKind.set('object');
      this.dragOriginId.set(id);
      this.dragOffset.set({ x: 0, y: 0 });
    }
  }

  /** Wired to `(cdkDragMoved)`. Live-update the offset siblings track. */
  onBulkDragMove(ev: CdkDragMove): void {
    if (!this.dragOriginId()) return;
    const z = this.zoom();
    this.dragOffset.set({ x: ev.distance.x / z, y: ev.distance.y / z });
  }

  /** Wipe bulk-drag tracking after the drop is committed. */
  private clearBulkDrag(): void {
    if (this.dragOriginId() !== null) {
      this.dragOriginKind.set(null);
      this.dragOriginId.set(null);
      this.dragOffset.set({ x: 0, y: 0 });
    }
  }

  /**
   * On drag end, CDK leaves a `transform: translate3d(dx, dy, 0)` on
   * the wrap that represents the cumulative drag offset. We want the
   * position in `[style.left/top.px]` instead, so:
   *   1. Read `getFreeDragPosition()` to get the drag delta.
   *   2. Compute the new position in canvas coords (delta is in
   *      screen pixels — divide by zoom).
   *   3. Patch the model so `[style.left/top.px]` re-bind.
   *   4. Call `ev.source.reset()` to clear CDK's transform AND its
   *      internal `_passiveTransform` so the next drag starts from
   *      `(0, 0)` instead of accumulating.
   *
   * `cdkDragEnded` (rather than `cdkDragReleased`) is used because it
   * fires *after* CDK's full end-drag persistence — `reset()` here
   * is the final word. Reading the bounding rect would be wrong on
   * rotated tables (rect grows to fit the rotated quad); the drag
   * delta is precise regardless.
   */
  onTableDragEnd(table: RestaurantTable, ev: CdkDragEnd): void {
    const id = idOf(table);
    const delta = ev.source.getFreeDragPosition();
    const z = this.zoom();
    const dx = delta.x / z;
    const dy = delta.y / z;
    const ids = this.selectedTableIds();
    // Multi-drag: if the dragged table is part of the multi-selection,
    // apply the same delta to every selected table so they move as a
    // rigid group. Otherwise just move the dragged one (and keep the
    // existing selection untouched).
    if (ids.has(id) && ids.size > 1) {
      this.translateSelection({ tables: true, objects: false }, dx, dy);
    } else {
      const w = this.tableW(table);
      const h = this.tableH(table);
      const x = clamp(Math.round(table.properties.position.x + dx), 0, this.canvasW - w);
      const y = clamp(Math.round(table.properties.position.y + dy), 0, this.canvasH - h);
      this.patchTableProps(id, 'position', { x, y });
    }
    this.clearBulkDrag();
    ev.source.reset();
  }

  onObjectDragEnd(obj: DecorObject, ev: CdkDragEnd): void {
    const id = idOf(obj);
    const delta = ev.source.getFreeDragPosition();
    const z = this.zoom();
    const dx = delta.x / z;
    const dy = delta.y / z;
    const ids = this.selectedObjectIds();
    if (ids.has(id) && ids.size > 1) {
      this.translateSelection({ tables: false, objects: true }, dx, dy);
    } else {
      const x = clamp(Math.round(obj.position.x + dx), 0, this.canvasW - obj.width);
      const y = clamp(Math.round(obj.position.y + dy), 0, this.canvasH - obj.height);
      this.patchObject(id, 'position', { x, y });
    }
    this.clearBulkDrag();
    ev.source.reset();
  }

  /**
   * Apply `(dx, dy)` to every selected table or object's stored
   * position — single canvas-coordinate delta, clamped to the canvas.
   * Used for multi-drag so a Ctrl-selected group of items moves as
   * one rigid block.
   */
  private translateSelection(which: { tables: boolean; objects: boolean }, dx: number, dy: number): void {
    const groupId = this.selectedGroupId();
    if (!groupId) return;
    const tableIds = which.tables ? this.selectedTableIds() : new Set<string>();
    const objIds = which.objects ? this.selectedObjectIds() : new Set<string>();
    this.groups.update((list) =>
      list.map((g) => {
        if (idOf(g) !== groupId) return g;
        return {
          ...g,
          tables: g.tables.map((t) => {
            if (!tableIds.has(idOf(t))) return t;
            const w = this.tableW(t);
            const h = this.tableH(t);
            return {
              ...t,
              properties: {
                ...t.properties,
                position: {
                  x: clamp(Math.round(t.properties.position.x + dx), 0, this.canvasW - w),
                  y: clamp(Math.round(t.properties.position.y + dy), 0, this.canvasH - h),
                },
              },
            };
          }),
          objects: g.objects.map((o) => {
            if (!objIds.has(idOf(o))) return o;
            return {
              ...o,
              position: {
                x: clamp(Math.round(o.position.x + dx), 0, this.canvasW - o.width),
                y: clamp(Math.round(o.position.y + dy), 0, this.canvasH - o.height),
              },
            };
          }),
        };
      }),
    );
  }

  /**
   * Plain click on the canvas's empty floor → drop any active
   * selection and switch the right-panel back to the Settings tab
   * (the only one that's relevant when nothing is selected). Tables
   * and decor objects stop propagation in their own click handlers,
   * so this only fires for clicks on the bare floor.
   */
  onCanvasClick(_ev: MouseEvent): void {
    if (!this.selectedGroup()) return;
    this.clearSelection();
    this.panelTab.set('settings');
  }

  /** Reset both the primary and multi-select stores in one call. */
  clearSelection(): void {
    this.selectedTableId.set(null);
    this.selectedObjectId.set(null);
    this.selectedTableIds.set(new Set());
    this.selectedObjectIds.set(new Set());
  }


  /** Bulk-delete every selected decor object. */
  async removeSelectedObjects(): Promise<void> {
    const ids = [...this.selectedObjectIds()];
    if (ids.length === 0) return;
    const ok = await this.confirm({
      title:   this.translate.instant('COMMON.DELETE'),
      message: this.translate.instant('SETTINGS.TABLES.CONFIRM_DELETE_MANY', { n: ids.length }),
      confirm: this.translate.instant('COMMON.DELETE'),
      danger:  true,
    });
    if (!ok) return;
    for (const id of ids) this.removeObject(id);
  }

  // ─── Context menu ──────────────────────────────────────────────────────
  /** Right-click on the canvas — anchor the menu and stash the canvas-relative point. */
  onCanvasContextMenu(ev: MouseEvent): void {
    if (!this.selectedGroup()) return;
    ev.preventDefault();
    const canvas = this.canvasEl()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const z = this.zoom();
    this.ctxMenu.set({
      x: ev.clientX,
      y: ev.clientY,
      canvasX: Math.round((ev.clientX - rect.left) / z),
      canvasY: Math.round((ev.clientY - rect.top ) / z),
    });
  }

  ctxAddTable(): void {
    const c = this.ctxMenu();
    if (c) this.addTable({ x: c.canvasX, y: c.canvasY });
    this.ctxMenu.set(null);
  }

  ctxAddObject(type: DecorObjectType): void {
    const c = this.ctxMenu();
    if (c) this.addObject(type, { x: c.canvasX, y: c.canvasY });
    this.ctxMenu.set(null);
  }

  ctxPickUnassigned(): void {
    this.ctxMenu.set(null);
    this.openPickUnassigned();
  }

  /** Click anywhere else — close the context menu and any popmenus. */
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.ctxMenu()) this.ctxMenu.set(null);
    if (this.showAddGroupMenu()) this.showAddGroupMenu.set(false);
  }

  // ─── Pick-unassigned modal ─────────────────────────────────────────────
  async openPickUnassigned(): Promise<void> {
    const branchId = this.selectedBranch()?.id;
    const groupId  = this.selectedGroupId();
    if (!branchId || !groupId) return;
    const ref = this.modal.open<
      PickUnassignedTablesModalComponent,
      PickUnassignedModalData,
      RestaurantTable[]
    >(PickUnassignedTablesModalComponent, {
      size: 'md',
      data: { branchId },
      closeOnBackdrop: false,
    });
    const picked = await ref.afterClosed();
    if (!picked || picked.length === 0) return;
    // Drop them straight into the active group.
    this.groups.update((list) =>
      list.map((g) => idOf(g) === groupId
        ? { ...g, tables: [...g.tables, ...picked.map((t) => ({ ...t }))] }
        : g,
      ),
    );
  }

  // ─── Zoom ──────────────────────────────────────────────────────────────
  zoomIn():  void { this.zoom.set(clamp(this.zoom() + 0.1, 0.5, 1.5)); }
  zoomOut(): void { this.zoom.set(clamp(this.zoom() - 0.1, 0.5, 1.5)); }
  zoomFit(): void { this.zoom.set(1); }
  zoomPercent = computed<number>(() => Math.round(this.zoom() * 100));

  // ─── Geometry helpers used in the template ─────────────────────────────
  tableW(t: RestaurantTable): number { return TABLE_DIMENSIONS[t.properties.type][t.properties.size].w; }
  tableH(t: RestaurantTable): number { return TABLE_DIMENSIONS[t.properties.type][t.properties.size].h; }

  /**
   * Chair size — legacy uses a fixed 61px chair on every table (see
   * the `.chair { width: 61px; height: 61px }` rule in each shape
   * SCSS), so we do the same. The relative chair-to-table ratio
   * naturally grows on smaller tables, exactly matching the legacy
   * proportions.
   */
  chairSize(_t: RestaurantTable): number {
    return 61;
  }

  /**
   * Where to place each chair around a table. Coordinates are absolute
   * px relative to the wrap (chair's top-left corner). `angle` is
   * applied via `transform: rotate(...)` on the chair element — the
   * legacy chair PNG faces "right" by default (back on the left), so
   *   left edge   → 0°
   *   top edge    → 90°
   *   right edge  → 180°
   *   bottom edge → 270°
   * Chairs anchored to a wrap edge sit just inside the wrap (chair box
   * inside the 0..W bounds), matching the legacy `vertical-centering`
   * / `horizontal-centering` / corner placements.
   */
  seatPositions(t: RestaurantTable): { leftPx: number; topPx: number; angle: number }[] {
    if (t.properties.hideSeats) return [];
    const n = Math.min(t.maxSeat ?? 0, 10);
    if (n <= 0) return [];
    const dims = TABLE_DIMENSIONS[t.properties.type][t.properties.size];
    const W = dims.w, H = dims.h;
    const c = this.chairSize(t);
    const out: { leftPx: number; topPx: number; angle: number }[] = [];

    if (t.properties.type === 'rectangle') {
      // Even spacing along each long edge: count + 1 gaps, chair-center
      // at gap k (k=1..count). Since `leftPx` is the chair's top-left,
      // subtract half the chair width.
      const distrib = (i: number, count: number) =>
        Math.round((W * (i + 1)) / (count + 1) - c / 2);
      const topN = Math.min(4, n);
      for (let i = 0; i < topN; i++) {
        out.push({ leftPx: distrib(i, topN), topPx: 0, angle: 90 });
      }
      const botN = Math.min(4, Math.max(0, n - 4));
      for (let i = 0; i < botN; i++) {
        out.push({ leftPx: distrib(i, botN), topPx: H - c, angle: 270 });
      }
      if (n >= 9)  out.push({ leftPx: 0,        topPx: Math.round((H - c) / 2), angle: 0   });
      if (n >= 10) out.push({ leftPx: W - c,    topPx: Math.round((H - c) / 2), angle: 180 });
      return out;
    }

    // Circle / square — 4 cardinal slots first, then 4 corners. The
    // corner offset differs by shape:
    //   - SQUARE: corners sit at the bounding-box corners (0/0, W/0, …)
    //     because the table top *is* a square — chairs hug the corner.
    //   - CIRCLE: legacy CSS uses `top: 25px; left: 25px` on a 228 frame
    //     (~11%) so chairs sit on the circular perimeter rather than the
    //     bounding-box corner. Without this, corner chairs visibly drift
    //     away from the round table.
    const midX = Math.round((W - c) / 2);
    const midY = Math.round((H - c) / 2);
    const cornerInset = t.properties.type === 'circle'
      ? Math.round(W * 0.11)
      : 0;
    const cardinal = [
      { leftPx: 0,     topPx: midY,  angle: 0   }, // left
      { leftPx: W - c, topPx: midY,  angle: 180 }, // right
      { leftPx: midX,  topPx: 0,     angle: 90  }, // top
      { leftPx: midX,  topPx: H - c, angle: 270 }, // bottom
    ];
    const corners = [
      { leftPx: cornerInset,         topPx: cornerInset,         angle: 45  }, // top-left
      { leftPx: W - c - cornerInset, topPx: cornerInset,         angle: 135 }, // top-right
      { leftPx: W - c - cornerInset, topPx: H - c - cornerInset, angle: 225 }, // bottom-right
      { leftPx: cornerInset,         topPx: H - c - cornerInset, angle: 315 }, // bottom-left
    ];
    for (let i = 0; i < Math.min(4, n); i++) out.push(cardinal[i]);
    for (let i = 0; i < Math.min(4, Math.max(0, n - 4)); i++) out.push(corners[i]);
    return out;
  }

  /** identity for `@for (s of seatPositions(t); track trackSeat(...))` */
  trackSeat = (i: number) => i;

  // Identity helpers used by the template.
  trackTable  = (_: number, t: RestaurantTable) => idOf(t);
  trackGroup  = (_: number, g: TableGroup) => idOf(g);
  trackObject = (_: number, o: DecorObject) => idOf(o);
  idOf = (e: TableGroup | RestaurantTable | DecorObject) => idOf(e);

  // ─── Save / cancel ─────────────────────────────────────────────────────
  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const ok = await this.service.save(this.serialise());
      if (ok.success) {
        const branchId = this.selectedBranch()?.id;
        if (branchId) {
          const refreshed = await this.service.getGroups(branchId);
          for (const g of refreshed) {
            if (!g.id) (g as any).__tempId = tempId();
            for (const t of g.tables)  if (!t.id) (t as any).__tempId = tempId();
            for (const o of g.objects) if (!o.id) (o as any).__tempId = tempId();
          }
          this.groups.set(refreshed);
          this.selectedGroupId.set(refreshed[0] ? idOf(refreshed[0]) : null);
          this.selectedTableId.set(null);
          this.selectedObjectId.set(null);
          this.selectedTableIds.set(new Set());
          this.selectedObjectIds.set(new Set());
        }
        this.snapshot.set(JSON.stringify(this.serialise()));
      }
    } catch (e) {
      console.error('[table-management] save failed', e);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/settings']);
  }

  hasUnsavedChanges(): boolean {
    return this.isDirty() && !this.saving();
  }

  /**
   * Open the project's standard confirm modal and resolve to true if
   * the user clicks the confirm button. Wraps `modal.open` so the rest
   * of the component reads `await this.confirm({...})` instead of
   * dropping into raw `window.confirm` (which can't be styled or
   * translated cleanly and breaks RTL).
   */
  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }

  // ─── Internal ──────────────────────────────────────────────────────────
  private serialise(): TableGroup[] {
    return this.groups().map((g) => ({
      id:         g.id,
      name:       g.name,
      branchId:   g.branchId,
      properties: { ...g.properties },
      tables:     g.tables.map((t) => ({
        id:         t.id,
        name:       t.name,
        maxSeat:    t.maxSeat,
        properties: { ...t.properties, position: { ...t.properties.position } },
        settings:   { ...t.settings },
      })),
      objects:    g.objects.map((o) => ({
        id:       o.id,
        type:     o.type,
        position: { ...o.position },
        angle:    o.angle,
        width:    o.width,
        height:   o.height,
        color:    o.color,
      })),
    }));
  }

  private nextTableName(): string {
    const g = this.selectedGroup();
    const taken = new Set((g?.tables ?? []).map((t) => t.name.toLowerCase()));
    let n = 1;
    while (taken.has(`table ${n}`)) n += 1;
    return `Table ${n}`;
  }
}

// ─── Free helpers ────────────────────────────────────────────────────────
function tempId(): string { return 'tmp_' + Math.random().toString(36).slice(2, 10); }

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function idOf(entity: any): string {
  return entity?.id ?? entity?.__tempId ?? '';
}
