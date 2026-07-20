import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef,
  HostListener, inject, Injector, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem,
} from '@angular/cdk/drag-drop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { WIDGETS, WidgetDef, WidgetGroup, WidgetView } from '../../models/widget-registry';

/** A row of placed widgets, mirroring the saved layout's `rowId` grouping. */
export interface EditorRow {
  id: string;
  widgets: PlacedEdit[];
}

/** A placed widget being edited: what, how wide, and shown as what. */
interface PlacedEdit { def: WidgetDef; colSpan: number; view?: WidgetView }

export interface CustomizeData {
  rows: { id: string; widgets: { slug: string; colSpan: number; view?: WidgetView }[] }[];
  /** Slugs the dashboard can actually render today. */
  supported: string[];
  /**
   * Runtime widgets not in the static catalogue — catalog reports registered as
   * custom dashboard widgets. Merged into the pickable pool.
   */
  extraWidgets?: WidgetDef[];
}

export interface CustomizeResult {
  rows: { id: string; widgets: { slug: string; colSpan: number; view?: WidgetView }[] }[];
}

/** Icons are clearer than words for a form choice; the label is the tooltip. */
export const VIEW_LABELS: Record<WidgetView, string> = {
  bar:   'DASHBOARD.VIEW.BAR',
  hbar:  'DASHBOARD.VIEW.HBAR',
  area:  'DASHBOARD.VIEW.AREA',
  pie:   'DASHBOARD.VIEW.PIE',
  donut: 'DASHBOARD.VIEW.DONUT',
  table: 'DASHBOARD.VIEW.TABLE',
};

/** Widths as twelfths, labelled the way the legacy editor did. */
const SPANS = [
  { value: 3,  short: '1/4' },
  { value: 4,  short: '1/3' },
  { value: 6,  short: '1/2' },
  { value: 8,  short: '2/3' },
  { value: 9,  short: '3/4' },
  { value: 12, short: 'Full' },
];

const ROW_CAPACITY = 12;

/** Width of the "Available Widgets" rail, remembered between visits. */
const RAIL_KEY = 'dashboard.customize.rail';
const DEFAULT_RAIL = 340;

function readRail(): number {
  const n = Number(localStorage.getItem(RAIL_KEY));
  return Number.isFinite(n) && n >= 240 && n <= 560 ? n : DEFAULT_RAIL;
}

type SourceTab = 'all' | 'standard' | 'custom';

/**
 * Customize the dashboard: which widgets appear, in which row, at what width.
 *
 * Rows are explicit — matching the legacy editor — because a flowing grid can't
 * express "these two belong side by side, and the next one starts a new line".
 * With spans alone that grouping is emergent and shifts as soon as a widget is
 * added or resized; with rows the user's grouping is the thing that's stored.
 *
 * Each row holds 12 columns. The meter shows what's used, and a widget can be
 * dragged within its row or across to another.
 */
@Component({
  selector: 'app-dashboard-customize-modal',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, DragDropModule,
    ModalHeaderComponent, ModalFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customize-modal.component.html',
  styleUrl: './customize-modal.component.scss',
})
export class DashboardCustomizeModalComponent {
  private modalRef = inject<ModalRef<CustomizeResult>>(MODAL_REF);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private injector = inject(Injector);
  private translate = inject(TranslateService);
  data = inject<CustomizeData>(MODAL_DATA);

  /** Row to flash after it was just added or received a widget. */
  readonly justAdded = signal<string | null>(null);

  readonly SPANS = SPANS;
  readonly CAPACITY = ROW_CAPACITY;
  readonly search = signal('');
  readonly sourceTab = signal<SourceTab>('all');

  // ─── resizable rail ───────────────────────────────────────────────
  readonly MIN_RAIL = 240;
  readonly MAX_RAIL = 560;
  readonly railWidth = signal(readRail());
  readonly dragging = signal(false);

  startResize(event: PointerEvent): void {
    event.preventDefault();
    const el = event.target as HTMLElement;
    const startX = event.clientX;
    const startW = this.railWidth();
    // In RTL the rail sits on the right, so dragging left must widen it.
    const dir = getComputedStyle(el).direction === 'rtl' ? -1 : 1;

    this.dragging.set(true);
    el.setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => this.setRail(startW + (e.clientX - startX) * dir);
    const up = () => {
      this.dragging.set(false);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      localStorage.setItem(RAIL_KEY, String(this.railWidth()));
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** Keyboard parity — a splitter that only responds to a mouse isn't operable. */
  onSplitterKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowLeft')       this.setRail(this.railWidth() - step);
    else if (event.key === 'ArrowRight') this.setRail(this.railWidth() + step);
    else if (event.key === 'Home')       this.setRail(this.MIN_RAIL);
    else if (event.key === 'End')        this.setRail(this.MAX_RAIL);
    else return;
    event.preventDefault();
    localStorage.setItem(RAIL_KEY, String(this.railWidth()));
  }

  resetRail(): void {
    this.setRail(DEFAULT_RAIL);
    localStorage.setItem(RAIL_KEY, String(DEFAULT_RAIL));
  }

  private setRail(px: number): void {
    this.railWidth.set(Math.round(Math.min(this.MAX_RAIL, Math.max(this.MIN_RAIL, px))));
  }

  readonly tabs: { value: SourceTab; label: string }[] = [
    { value: 'all',      label: 'DASHBOARD.TAB_ALL' },
    { value: 'standard', label: 'DASHBOARD.TAB_STANDARD' },
    { value: 'custom',   label: 'DASHBOARD.TAB_CUSTOM' },
  ];

  /**
   * Only offer widgets the dashboard can render — no dead entries. The static
   * catalogue plus any runtime custom widgets (catalog reports), de-duplicated
   * by slug in case a report is somehow also declared statically.
   */
  private readonly available = (() => {
    const bySlug = new Map<string, WidgetDef>();
    for (const w of [...WIDGETS, ...(this.data.extraWidgets ?? [])]) {
      if (this.data.supported.includes(w.slug)) bySlug.set(w.slug, w);
    }
    return [...bySlug.values()];
  })();

  readonly rows = signal<EditorRow[]>(
    this.data.rows.map((r) => ({
      id: r.id,
      widgets: r.widgets
        .map((w): PlacedEdit | null => {
          const def = this.available.find((d) => d.slug === w.slug);
          return def ? { def, colSpan: w.colSpan, view: w.view } : null;
        })
        .filter((w): w is PlacedEdit => w !== null),
    })),
  );

  /** Drop-list ids so CDK can move widgets between rows. */
  readonly listIds = computed(() => this.rows().map((r) => r.id));

  readonly VIEW_LABELS = VIEW_LABELS;

  /** The form a placed widget is currently showing. */
  viewOf(w: PlacedEdit): WidgetView {
    return w.view ?? w.def.defaultView ?? w.def.views?.[0] ?? 'bar';
  }

  /** Only offer a choice where the widget's data supports more than one form. */
  viewsFor(def: WidgetDef): WidgetView[] {
    return (def.views?.length ?? 0) > 1 ? def.views! : [];
  }

  setView(slug: string, view: WidgetView): void {
    this.rows.update((rows) =>
      rows.map((r) => ({
        ...r,
        widgets: r.widgets.map((w) => (w.def.slug === slug ? { ...w, view } : w)),
      })));
  }

  private readonly placedSlugs = computed(
    () => new Set(this.rows().flatMap((r) => r.widgets.map((w) => w.def.slug))));

  private readonly remaining = computed(
    () => this.available.filter((w) => !this.placedSlugs().has(w.slug)));

  readonly availableCount = computed(() => this.remaining().length);
  readonly placedCount = computed(() => this.placedSlugs().size);

  countFor(tab: SourceTab): number {
    const pool = this.remaining();
    if (tab === 'standard') return pool.filter((w) => !w.custom).length;
    if (tab === 'custom')   return pool.filter((w) => !!w.custom).length;
    return pool.length;
  }

  readonly groups = computed(() => {
    const term = this.search().trim().toLowerCase();
    const tab = this.sourceTab();
    const pool = this.remaining().filter((w) => {
      if (tab === 'standard' && w.custom) return false;
      if (tab === 'custom' && !w.custom) return false;
      // `title` is an i18n key; match on the resolved label so a search for
      // "sales" finds a report titled that, not just its key.
      const label = this.translate.instant(w.title).toLowerCase();
      return !term || label.includes(term) || w.slug.toLowerCase().includes(term);
    });
    const order: WidgetGroup[] = ['overview', 'sales', 'finance', 'inventory', 'custom'];
    return order
      .map((g) => ({ group: g, items: pool.filter((w) => w.group === g) }))
      .filter((s) => s.items.length > 0);
  });

  // ─── row maths ────────────────────────────────────────────────────
  used(row: EditorRow): number {
    return row.widgets.reduce((sum, w) => sum + w.colSpan, 0);
  }
  free(row: EditorRow): number {
    return Math.max(0, ROW_CAPACITY - this.used(row));
  }
  /** Over 12 still renders — the grid wraps — but the meter warns. */
  isOver(row: EditorRow): boolean {
    return this.used(row) > ROW_CAPACITY;
  }

  // ─── row ops ──────────────────────────────────────────────────────
  addRow(): void {
    const id = newRowId(this.rows().length);
    this.rows.update((rows) => [...rows, { id, widgets: [] }]);
    // A row appended below the fold is invisible feedback — bring it into view.
    this.revealRow(id);
  }

  /** Scrolls a row into view once it has rendered, and flashes it briefly. */
  private revealRow(id: string): void {
    this.justAdded.set(id);
    afterNextRender(
      () => {
        const el = this.host.nativeElement.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Long enough to register, short enough not to linger as decoration.
        setTimeout(() => this.justAdded.set(null), 900);
      },
      { injector: this.injector },
    );
  }

  removeRow(id: string): void {
    this.rows.update((rows) => rows.filter((r) => r.id !== id));
  }

  moveRow(id: string, delta: number): void {
    this.rows.update((rows) => {
      const i = rows.findIndex((r) => r.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= rows.length) return rows;
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  /** Lands in the first row with room, else starts a new one. */
  /** Widget whose row-picker is open. */
  readonly picking = signal<string | null>(null);

  // A menu that only closes by choosing something traps the user — close it on
  // Escape and on any click that lands outside a widget card.
  @HostListener('document:keydown.escape')
  closePicker(): void { this.picking.set(null); }

  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(event: PointerEvent): void {
    if (!this.picking()) return;
    if (!(event.target as HTMLElement).closest('.cm__cardWrap')) this.picking.set(null);
  }

  openPicker(slug: string): void {
    // No rows yet — nothing to choose between, so just make the first one.
    if (this.rows().length === 0) {
      const def = this.available.find((w) => w.slug === slug);
      if (def) this.addTo(def, null);
      return;
    }
    this.picking.update((cur) => (cur === slug ? null : slug));
  }

  /** Adds to `rowId`, or to a brand-new row when null. */
  addTo(def: WidgetDef, rowId: string | null): void {
    this.picking.set(null);
    const span = def.defaultSpan;
    const rows = this.rows();

    if (rowId) {
      this.rows.set(rows.map((r) =>
        r.id === rowId ? { ...r, widgets: [...r.widgets, { def, colSpan: span }] } : r));
      this.revealRow(rowId);
      return;
    }
    const id = newRowId(rows.length);
    this.rows.set([...rows, { id, widgets: [{ def, colSpan: span }] }]);
    this.revealRow(id);
  }

  remove(slug: string): void {
    this.rows.update((rows) =>
      rows.map((r) => ({ ...r, widgets: r.widgets.filter((w) => w.def.slug !== slug) })));
  }

  setSpan(slug: string, span: number): void {
    this.rows.update((rows) =>
      rows.map((r) => ({
        ...r,
        widgets: r.widgets.map((w) => (w.def.slug === slug ? { ...w, colSpan: span } : w)),
      })));
  }

  /** Within a row, or across to another. */
  drop(event: CdkDragDrop<PlacedEdit[]>): void {
    const rows = this.rows().map((r) => ({ ...r, widgets: [...r.widgets] }));
    const from = rows.find((r) => r.id === event.previousContainer.id);
    const to = rows.find((r) => r.id === event.container.id);
    if (!from || !to) return;

    if (from === to) {
      moveItemInArray(to.widgets, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(from.widgets, to.widgets, event.previousIndex, event.currentIndex);
    }
    this.rows.set(rows);
  }

  reset(): void {
    const pick = (slug: string) => this.available.find((w) => w.slug === slug);
    const mk = (slugs: string[]) => ({
      id: newRowId(Math.random()),
      widgets: slugs
        .map((s) => { const def = pick(s); return def ? { def, colSpan: def.defaultSpan } : null; })
        .filter((w): w is PlacedEdit => w !== null),
    });
    this.rows.set([
      mk(['business-summary']),
      mk(['sales-by-day', 'sales-by-source']),
      mk(['top-10-item-by-sales', 'top-customers']),
      mk(['expense-income', 'low-quantity-products']),
    ].filter((r) => r.widgets.length > 0));
  }

  apply(): void {
    this.modalRef.close({
      // Empty rows are dropped — they'd render as invisible gaps.
      rows: this.rows()
        .filter((r) => r.widgets.length > 0)
        .map((r) => ({
          id: r.id,
          widgets: r.widgets.map((w) => ({ slug: w.def.slug, colSpan: w.colSpan, view: w.view })),
        })),
    });
  }

  cancel(): void { this.modalRef.close(undefined); }
}

/** Legacy shape (`row_xxxxxxxxx`) so a layout stays readable to the old app. */
function newRowId(seed: number): string {
  return `row_${Date.now().toString(36)}${Math.floor(seed).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
