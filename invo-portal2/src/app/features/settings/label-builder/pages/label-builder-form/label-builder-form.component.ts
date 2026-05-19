import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CdkDragDrop,
  CdkDragMove,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { DesktopOnlyNoticeComponent } from '@shared/components/desktop-only-notice/desktop-only-notice.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
// Cross-feature import — `RbfWidgetComponent` is a self-contained
// stackable panel (collapse caret, drag handle, header strip). Sharing
// it avoids duplicating the "Adobe-style card" pattern, and the
// coordinator service is `providedIn: 'root'` so no NgModule wiring
// is needed. Long-term we'd promote this to `shared/`.
import { RbfWidgetComponent } from '@features/settings/receipt-builder/pages/receipt-builder-form/components/rbf-widget/rbf-widget.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { CompanyService } from '@core/auth/company.service';
import { CustomFieldsService } from '@features/settings/services/custom-fields.service';
import { ProductListService } from '@features/products/services/product-list.service';
import { ProductCrudService } from '@features/products/services/product-crud.service';

import { LabelBuilderService } from '../../services/label-builder.service';
import {
  DPI_PRESETS,
  generateZpl,
  LabelElement,
  LabelElementType,
  LabelTemplate,
  LabelTemplateType,
  parseElement,
  ZplBarcode,
  ZplCircle,
  ZplHorizontalLine,
  ZplImageElement,
  ZplLogoElement,
  ZplQrCode,
  ZplRectangle,
  ZplTextBox,
  ZplVerticalLine,
} from '../../services/label-template.types';
import { defaultPreviewData, LabelDataMap, resolveTokens } from '../../services/token-resolver';
import { generatePng } from '../../services/png-export';
import { BindingGroup, getBindingGroups } from '../../services/bindings.catalog';
import { BarcodePreviewComponent } from '../../components/barcode-preview/barcode-preview.component';
import { QrcodePreviewComponent } from '../../components/qrcode-preview/qrcode-preview.component';
import { BindableInputComponent } from '../../components/bindable-input/bindable-input.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

/** Plain-object snapshot of the persisted-shape fields for undo /
 *  redo. Element instances rehydrate via `parseElement` on restore. */
interface TemplateSnapshot {
  name:         string;
  labelHeight:  number;
  labelWidth:   number;
  dpi:          number;
  source:       string;
  templateType: LabelTemplateType | '';
  elements:     any[];
}

/** Palette entry — what shows up in the left rail. The `Logo` entry
 *  is folded under the Image icon in this phase to keep the palette
 *  compact; users still get distinct elements via the inspector type
 *  hint after dropping. */
interface PaletteItem {
  type: LabelElementType;
  i18nKey: string;
  iconPath: string;   // SVG path data, single path so the markup is
                      // tight — every element type uses an outline icon.
}

const PALETTE: PaletteItem[] = [
  { type: 'Textbox',        i18nKey: 'LABEL_BUILDER.FORM.ITEM.TEXTBOX',
    iconPath: 'M4 7V5h16v2M9 5v14M15 5v14M5 19h14' },
  { type: 'Barcode',        i18nKey: 'LABEL_BUILDER.FORM.ITEM.BARCODE',
    iconPath: 'M4 6v12M7 6v12M10 6v12M13 6v12M16 6v12M19 6v12' },
  { type: 'QrCode',         i18nKey: 'LABEL_BUILDER.FORM.ITEM.QRCODE',
    iconPath: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z' },
  { type: 'Rectangle',      i18nKey: 'LABEL_BUILDER.FORM.ITEM.RECTANGLE',
    iconPath: 'M4 6h16v12H4z' },
  { type: 'Circle',         i18nKey: 'LABEL_BUILDER.FORM.ITEM.CIRCLE',
    iconPath: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z' },
  { type: 'HorizontalLine', i18nKey: 'LABEL_BUILDER.FORM.ITEM.HORIZONTAL_LINE',
    iconPath: 'M3 12h18' },
  { type: 'VerticalLine',   i18nKey: 'LABEL_BUILDER.FORM.ITEM.VERTICAL_LINE',
    iconPath: 'M12 3v18' },
  { type: 'Image',          i18nKey: 'LABEL_BUILDER.FORM.ITEM.IMAGE',
    iconPath: 'M4 5h16v14H4zM4 16l4-4 4 4 4-6 4 4' },
  { type: 'Logo',           i18nKey: 'LABEL_BUILDER.FORM.ITEM.LOGO',
    iconPath: 'M4 4h16v16H4zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
];

/**
 * LabelBuilderFormComponent
 * ─────────────────────────
 * Phase-1 form shell. Renders the three-pane editor (palette, canvas,
 * inspector) with drag-from-palette + drag-to-position on the canvas,
 * a working save flow, and per-element inspector stubs that already
 * mutate the right fields. ZPL export, image rasterization, and the
 * `!product.*` token system land in the next phase.
 */
@Component({
  selector: 'app-label-builder-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    DragDropModule,
    LoadingOverlayComponent,
    TooltipDirective,
    BarcodePreviewComponent,
    QrcodePreviewComponent,
    BindableInputComponent,
    SearchDropdownComponent,
    RbfWidgetComponent,
    DesktopOnlyNoticeComponent,
    DropdownMenuBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './label-builder-form.component.html',
  styleUrl: './label-builder-form.component.scss',
})
export class LabelBuilderFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(LabelBuilderService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private route      = inject(ActivatedRoute);
  private modal      = inject(ModalService);
  private company    = inject(CompanyService);
  private customFs   = inject(CustomFieldsService);
  private productList = inject(ProductListService);
  private productCrud = inject(ProductCrudService);

  constructor() { withTranslations('settings/label-builder'); }

  // ─── State ────────────────────────────────────────────────────────
  loading       = signal<boolean>(false);
  saving        = signal<boolean>(false);
  // The template is mutated in place (every patch/drag/drop flips
  // a field on the existing instance) — `equal: () => false` so the
  // signal re-emits on every `set()` even when the reference hasn't
  // changed, so OnPush canvas/inspector views re-render reliably.
  template      = signal<LabelTemplate>(this.makeBlank('label'), { equal: () => false });
  selectedIndex = signal<number | null>(null);

  /** Pixel dimensions of the canvas, derived from labelWidth/Height
   *  (inches) × DPI. Updates whenever the template's size signals do. */
  canvasPx = computed(() => {
    const t = this.template();
    return {
      width:  Math.round(t.labelWidth  * t.dpi),
      height: Math.round(t.labelHeight * t.dpi),
    };
  });

  /** The element currently being inspected. `null` means the user is
   *  looking at the label-level settings. */
  selectedElement = computed<LabelElement | null>(() => {
    const idx = this.selectedIndex();
    if (idx === null) return null;
    return this.template().template[idx] ?? null;
  });

  /** Is the form dirty? Flipped to true on any mutation that should
   *  count as a change. Drives the unsaved-changes guard + the Save
   *  button's disabled state. */
  isDirty = computed<boolean>(() => !!this.template().isChanged);

  /** Snap-to-grid toggle. When on, drag-drop positions and resize
   *  dimensions round to the nearest `SNAP_PX` so elements line up
   *  cleanly. Off by default to match the legacy free-form feel. */
  snapEnabled = signal<boolean>(false);
  private readonly SNAP_PX = 5;

  /** Read-only / "preview" mode — toolbar toggle that hides every
   *  editing affordance (palette, inspector, layers, drag/resize
   *  handles) and just renders the canvas. Useful for design
   *  reviews + screenshots without the editor chrome. The dirty
   *  flag is preserved across the toggle so the user can keep
   *  editing where they left off. */
  previewMode = signal<boolean>(false);

  /** Items rendered by the header Download `<app-dropdown-menu-btn>`.
   *  Three export formats: PNG, JSON, ZPL. The shared component
   *  owns its own open/close state — we just declare what's in
   *  the menu. */
  downloadMenuItems(): DropdownMenuBtnItem[] {
    return [
      { label: 'LABEL_BUILDER.FORM.GENERATE_PNG',   click: () => this.downloadPng()  },
      { label: 'LABEL_BUILDER.FORM.GENERATE_JSON',  click: () => this.downloadJson() },
      { label: 'LABEL_BUILDER.FORM.GENERATE_LABEL', click: () => this.downloadZpl() },
    ];
  }

  togglePreview(): void {
    // Drop selection on entry — handles + inspector content depend
    // on a selected element, and we hide both anyway.
    if (!this.previewMode()) this.selectedIndex.set(null);
    this.previewMode.set(!this.previewMode());
  }

  // ─── Right-rail splitter ─────────────────────────────────────────
  // Drives the `--lbf-right-rail-w` CSS variable so the user can
  // drag the inspector wider when they need more room (long token
  // strings, dense panels). Width clamped + persisted to
  // localStorage so the choice survives reloads. Same shape as the
  // receipt-builder's splitter so the gesture is identical between
  // editors.
  private static readonly RAIL_MIN = 280;
  private static readonly RAIL_MAX = 640;
  private static readonly RAIL_KEY = 'lbf:right-rail-w';

  splitterDragging = signal<boolean>(false);
  private splitterMoveHandler: ((e: MouseEvent) => void) | null = null;
  private splitterEndHandler:  (() => void) | null = null;

  /** Pulled out so both the restore path (called from `ngOnInit`)
   *  and the drag handler share one code path. */
  private applyRailWidth(w: number): void {
    document.documentElement.style.setProperty('--lbf-right-rail-w', `${w}px`);
    try { localStorage.setItem(LabelBuilderFormComponent.RAIL_KEY, String(w)); }
    catch { /* swallow — quota / private mode etc. */ }
  }

  /** Read any persisted rail width and apply it on first paint. */
  private restoreRailWidth(): void {
    try {
      const raw = localStorage.getItem(LabelBuilderFormComponent.RAIL_KEY);
      if (!raw) return;
      const w = Number(raw);
      if (!Number.isFinite(w)) return;
      const clamped = Math.min(
        LabelBuilderFormComponent.RAIL_MAX,
        Math.max(LabelBuilderFormComponent.RAIL_MIN, w),
      );
      this.applyRailWidth(clamped);
    } catch { /* swallow */ }
  }

  onSplitterMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.splitterDragging.set(true);

    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';

    // RTL flips the rail to the visual LEFT of the workspace, so the
    // width grows as the cursor moves *right* from the rail edge.
    // Capturing direction at drag-start avoids re-querying every
    // mousemove.
    const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';

    this.splitterMoveHandler = (e: MouseEvent) => {
      const raw = isRtl
        ? e.clientX - 16
        : window.innerWidth - e.clientX - 16;
      const w = Math.min(
        LabelBuilderFormComponent.RAIL_MAX,
        Math.max(LabelBuilderFormComponent.RAIL_MIN, raw),
      );
      this.applyRailWidth(w);
    };
    this.splitterEndHandler = () => {
      this.splitterDragging.set(false);
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      if (this.splitterMoveHandler) {
        window.removeEventListener('mousemove', this.splitterMoveHandler);
        this.splitterMoveHandler = null;
      }
      if (this.splitterEndHandler) {
        window.removeEventListener('mouseup', this.splitterEndHandler);
        this.splitterEndHandler = null;
      }
    };

    window.addEventListener('mousemove', this.splitterMoveHandler);
    window.addEventListener('mouseup',   this.splitterEndHandler);
  }

  /** Round a pixel value to the snap grid when snapping is on. */
  private snap(v: number): number {
    if (!this.snapEnabled()) return v;
    return Math.round(v / this.SNAP_PX) * this.SNAP_PX;
  }

  // ─── Alignment guides ─────────────────────────────────────────────
  //
  // While the user drags an element, compare its edges + center to
  // every other element's matching axis and emit guide lines for
  // any that match within `GUIDE_TOLERANCE`. Lines render as thin
  // CSS-positioned strips inside the canvas. Soft-snap pulls the
  // dragging element to the matched coordinate when within
  // `GUIDE_SNAP_PULL` so the user feels the alignment.
  //
  // Performance: recomputed on every cdkDragMoved event for the
  // active element, which is at most ~once per frame. The candidate
  // list is the rest of `template.template` so even on 100-element
  // labels the inner loop is O(n).

  private readonly GUIDE_TOLERANCE = 3;
  private readonly GUIDE_SNAP_PULL = 4;

  /** Active guide lines while dragging. Each entry is a vertical
   *  (`x` set) or horizontal (`y` set) line with a length defined
   *  by the canvas width/height. Empty when not dragging. */
  guides = signal<Array<{ x?: number; y?: number }>>([]);

  /** Floating "x: 145, y: 220" chip while dragging — anchored to
   *  the lower-right of the element so it doesn't occlude the
   *  position the user is aiming for. `null` means no chip is
   *  visible. */
  positionChip = signal<{ x: number; y: number } | null>(null);

  /** Reset guides — called when a drag ends so they don't linger. */
  private clearGuides(): void {
    if (this.guides().length) this.guides.set([]);
  }

  /** Compute alignment guides for the dragging element at its
   *  current viewport position. Returns the snap-adjusted position
   *  (which the caller can apply via `cdkDragRef.setFreeDragPosition`
   *  to feel the pull) and updates the `guides` signal. */
  private computeGuides(idx: number, dragX: number, dragY: number): { x: number; y: number } {
    const t = this.template();
    const me = t.template[idx];
    if (!me) return { x: dragX, y: dragY };

    // Element's bounding box at the drag-target position. Pull
    // the live DOM size for the dragged element AND the others —
    // the canvas auto-sizes barcodes / textboxes, so reading the
    // model fields alone produces wrong centre lines.
    const myW = this.elWidth(me,  idx) || 0;
    const myH = this.elHeight(me, idx) || 0;
    const myEdges = {
      x: [dragX, dragX + myW / 2, dragX + myW],         // left, center, right
      y: [dragY, dragY + myH / 2, dragY + myH],         // top, middle, bottom
    };

    let snapX = dragX;
    let snapY = dragY;
    let bestX = Infinity;
    let bestY = Infinity;
    const out: Array<{ x?: number; y?: number }> = [];

    // Anchor lines for the canvas itself — left/centre/right and
    // top/middle/bottom. The user expects the same magnet snap
    // when an element lines up with the canvas centre as when it
    // lines up with another element. Without this they had to drag
    // by eye to centre on the label.
    const canvas = this.canvasPx();
    const canvasOx = [0, canvas.width  / 2, canvas.width];
    const canvasOy = [0, canvas.height / 2, canvas.height];
    const checkX = (oX: number) => {
      for (const myX of myEdges.x) {
        const d = Math.abs(myX - oX);
        if (d <= this.GUIDE_TOLERANCE) {
          out.push({ x: oX });
          if (d < bestX) {
            bestX = d;
            snapX = dragX + (oX - myX);
          }
        }
      }
    };
    const checkY = (oY: number) => {
      for (const myY of myEdges.y) {
        const d = Math.abs(myY - oY);
        if (d <= this.GUIDE_TOLERANCE) {
          out.push({ y: oY });
          if (d < bestY) {
            bestY = d;
            snapY = dragY + (oY - myY);
          }
        }
      }
    };
    for (const oX of canvasOx) checkX(oX);
    for (const oY of canvasOy) checkY(oY);

    for (let i = 0; i < t.template.length; i++) {
      if (i === idx) continue;
      const other = t.template[i];
      const ow = this.elWidth(other,  i) || 0;
      const oh = this.elHeight(other, i) || 0;
      const ox = [other.position.x, other.position.x + ow / 2, other.position.x + ow];
      const oy = [other.position.y, other.position.y + oh / 2, other.position.y + oh];

      // Vertical guides — match my X edges with other's X edges.
      for (const oX of ox) checkX(oX);
      // Horizontal guides — same idea, Y axis.
      for (const oY of oy) checkY(oY);
    }

    // De-dupe the guide lines so we only render unique coordinates.
    const seenX = new Set<number>();
    const seenY = new Set<number>();
    const dedup: Array<{ x?: number; y?: number }> = [];
    for (const g of out) {
      if (g.x !== undefined && !seenX.has(g.x)) { seenX.add(g.x); dedup.push(g); }
      if (g.y !== undefined && !seenY.has(g.y)) { seenY.add(g.y); dedup.push(g); }
    }
    this.guides.set(dedup);

    // Only soft-pull when the alignment is within the stricter pull
    // window — we don't want every distant edge to drag the cursor.
    const finalX = bestX <= this.GUIDE_SNAP_PULL ? snapX : dragX;
    const finalY = bestY <= this.GUIDE_SNAP_PULL ? snapY : dragY;
    return { x: finalX, y: finalY };
  }

  // ─── Undo / redo ─────────────────────────────────────────────────
  //
  // Each mutation entry-point pushes a snapshot of the *previous*
  // state onto `undoStack` before applying the change, and clears
  // `redoStack` (the new edit branches off the current state).
  //
  // Snapshots store just the persisted-shape fields — the canvas
  // re-derives everything else (selectedIndex, dirty flag) from the
  // restored state. We rebuild element instances via `parseElement`
  // so the snapshot can be a plain JSON-cloneable object.
  //
  // Stack depth is capped at MAX_HISTORY so a long editing session
  // doesn't grow memory unbounded.

  private undoStack = signal<TemplateSnapshot[]>([]);
  private redoStack = signal<TemplateSnapshot[]>([]);
  private readonly MAX_HISTORY = 50;
  /** Set while applying an undo / redo so `pushUndo()` doesn't fire
   *  recursively from inside the restore. */
  private restoring = false;

  canUndo = computed(() => this.undoStack().length > 0);
  canRedo = computed(() => this.redoStack().length > 0);

  /** Capture the current template state into a JSON-cloneable
   *  snapshot. Cheap (no element-class instantiation, just a
   *  property dump). */
  private snapshot(): TemplateSnapshot {
    const t = this.template();
    return {
      name:         t.name,
      labelHeight:  t.labelHeight,
      labelWidth:   t.labelWidth,
      dpi:          t.dpi,
      source:       t.source,
      templateType: t.templateType,
      elements:     t.template.map(el => JSON.parse(JSON.stringify(el))),
    };
  }

  /** Restore a snapshot into the template signal. Element instances
   *  are rebuilt via `parseElement` so methods like `toLABEL()` and
   *  `rasterize()` work after a restore. */
  private restoreSnapshot(snap: TemplateSnapshot): void {
    const t = this.template();
    t.name         = snap.name;
    t.labelHeight  = snap.labelHeight;
    t.labelWidth   = snap.labelWidth;
    t.dpi          = snap.dpi;
    t.source       = snap.source;
    t.templateType = snap.templateType;
    t.template     = snap.elements.map(parseElement);
    t.isChanged    = true;
    this.template.set(t);

    // Drop any selection that's no longer valid after the restore.
    const idx = this.selectedIndex();
    if (idx !== null && idx >= t.template.length) this.selectedIndex.set(null);
  }

  /** Push a snapshot of *current* state onto the undo stack. Called
   *  by every mutation entry-point BEFORE applying its change. */
  private pushUndo(): void {
    if (this.restoring) return;
    const next = [...this.undoStack(), this.snapshot()];
    if (next.length > this.MAX_HISTORY) next.shift();
    this.undoStack.set(next);
    // Any new edit invalidates the redo branch.
    if (this.redoStack().length) this.redoStack.set([]);
  }

  undo(): void {
    if (!this.canUndo()) return;
    const stack = [...this.undoStack()];
    const snap = stack.pop()!;
    // Stash current state on the redo stack before reverting so a
    // subsequent redo can land back here.
    const redo = [...this.redoStack(), this.snapshot()];
    if (redo.length > this.MAX_HISTORY) redo.shift();

    this.restoring = true;
    try { this.restoreSnapshot(snap); } finally { this.restoring = false; }

    this.undoStack.set(stack);
    this.redoStack.set(redo);
  }

  redo(): void {
    if (!this.canRedo()) return;
    const stack = [...this.redoStack()];
    const snap = stack.pop()!;
    const undo = [...this.undoStack(), this.snapshot()];
    if (undo.length > this.MAX_HISTORY) undo.shift();

    this.restoring = true;
    try { this.restoreSnapshot(snap); } finally { this.restoring = false; }

    this.undoStack.set(undo);
    this.redoStack.set(stack);
  }

  /** Wipe history — used after load + after save so the user can't
   *  undo past the last persisted state. */
  private clearHistory(): void {
    this.undoStack.set([]);
    this.redoStack.set([]);
  }

  /** True when the route is `/0` — first-save creates a new row and
   *  redirects to its real id. */
  isNew = signal<boolean>(true);

  /** Palette is fixed at module-init time; expose it to the template
   *  so the *ngFor doesn't re-evaluate the array literal each cycle. */
  readonly palette: ReadonlyArray<PaletteItem> = PALETTE;
  readonly dpiPresets: ReadonlyArray<number>  = DPI_PRESETS;

  // ─── DPI dropdown wiring (app-search-dropdown) ────────────────────
  // The dropdown's `items` input expects a mutable array (its
  // generic `T = { id: number }` infers off the literal we pass),
  // so this is a plain `Array` not `ReadonlyArray`. The current-
  // value projection (`dpiSelected`) maps the template's numeric
  // dpi onto the object shape the dropdown stores internally.
  dpiItems: Array<{ id: number; label: string }> =
    DPI_PRESETS.map(d => ({ id: d, label: `${d} DPI` }));
  dpiDisplay = (v: any) => this.dpiItems.find(o => o.id === Number(v?.id ?? v))?.label ?? `${v?.id ?? v}`;
  dpiCompare = (a: any, b: any) => Number(a?.id ?? a) === Number(b?.id ?? b);
  dpiToValue = (item: { id: number }) => item.id;
  /** Map the template's numeric DPI into the object shape the
   *  dropdown carries. Recomputes when `template()` changes. */
  dpiSelected = computed(() =>
    this.dpiItems.find(o => o.id === this.template().dpi) ?? null);

  /** Dummy product / invoiceLine context for the live canvas preview.
   *  Fed into `resolveTokens()` so a textbox showing `!product.name`
   *  renders representative content instead of the literal token. */
  previewData = signal<LabelDataMap>(defaultPreviewData());

  /** Custom-field defs loaded via `CustomFieldsService.getByType('product')`
   *  — used to assemble the "Custom fields" group in the binding
   *  picker AND to seed dummy values into the canvas preview. */
  customFieldDefs = signal<ReadonlyArray<{ abbr: string; label: string; type: string }>>([]);

  /** Binding groups for the picker. Recomputes when the template
   *  type flips (label vs kitchen) or the custom-field set changes
   *  — both happen via signals so the popover stays in sync. */
  bindingGroups = computed<ReadonlyArray<BindingGroup>>(() => {
    const type = this.template().templateType || '';
    return getBindingGroups(type, this.customFieldDefs());
  });

  /** Resolve the user-typed text against the preview data — used by
   *  textbox / barcode / QR canvas previews so the token system works
   *  end-to-end without leaving the editor. */
  resolve = (raw: string): string => resolveTokens(raw, this.previewData(), {
    decimals:       3,
    currencySymbol: this.company.settings()?.currencySymbol ?? '$',
  });

  // ─── Sample-product picker ───────────────────────────────────────
  //
  // Lets the user bind a real product from the catalog to the canvas
  // preview so they can see what the template looks like with actual
  // data instead of dummy values. Search-as-you-type with a 300 ms
  // debounce, results limited to 8 rows. Picking a product fetches
  // the full record (the list endpoint omits some fields we render
  // through tokens) and merges it into `previewData`.
  //
  // The picker only shows when no element is selected (i.e. on the
  // label-settings panel) — it's a preview-data concern, not an
  // element style concern.

  sampleQuery   = signal<string>('');
  sampleResults = signal<Array<{ id: string; name: string; barcode?: string }>>([]);
  sampleBoundName = signal<string>('');
  private sampleSearchTimer: ReturnType<typeof setTimeout> | null = null;

  onSampleSearch(q: string): void {
    this.sampleQuery.set(q);
    if (this.sampleSearchTimer) clearTimeout(this.sampleSearchTimer);
    if (!q.trim()) { this.sampleResults.set([]); return; }
    this.sampleSearchTimer = setTimeout(() => { void this.runSampleSearch(q); }, 300);
  }

  private async runSampleSearch(q: string): Promise<void> {
    try {
      const res = await this.productList.getProductList({
        page: 1, limit: 8,
        searchTerm: q,
        sortBy: { sortValue: 'name', sortDirection: 'asc' },
        filter: {},
      });
      this.sampleResults.set(
        (res.list || []).map((p: any) => ({
          id: String(p.id ?? ''),
          name: String(p.name ?? ''),
          barcode: p.barcode ? String(p.barcode) : undefined,
        })).filter(r => r.id),
      );
    } catch {
      // Network / auth failures fall through to "no results"; the
      // picker stays usable — the user can clear and dummy data is
      // already showing.
      this.sampleResults.set([]);
    }
  }

  async selectSample(id: string): Promise<void> {
    try {
      const product = await this.productCrud.getProduct(id);
      if (!product) return;
      // Preserve `customFields` map / current invoiceLine — only the
      // product slot is being swapped.
      this.previewData.update(d => ({ ...d, product }));
      this.sampleBoundName.set(String(product.name ?? ''));
      this.sampleQuery.set('');
      this.sampleResults.set([]);
    } catch { /* swallow — preview just stays on the previous data */ }
  }

  /** Restore the dummy preview data and clear the picker. */
  resetSample(): void {
    this.previewData.set(defaultPreviewData());
    this.sampleBoundName.set('');
    this.sampleQuery.set('');
    this.sampleResults.set([]);
    // Re-load custom fields so their dummy values are present again
    // — `defaultPreviewData()` doesn't know about them.
    void this.loadCustomFields();
  }

  /** Pixel size mapping for QR preview — matches the legacy factor
   *  → pixel table so existing templates render at the same visual
   *  size as they did before the port. */
  qrPixel(factor: number): number {
    const map: Record<number, number> = {
      1: 30, 2: 55, 3: 80, 4: 105, 5: 135, 6: 165, 7: 185, 8: 210, 9: 235, 10: 260,
    };
    return map[factor] ?? 80;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    // Restore the user's previously-chosen rail width before the
    // first paint so the inspector doesn't visibly snap from 320 px
    // to its persisted size on load.
    this.restoreRailWidth();

    const id = this.route.snapshot.paramMap.get('id') ?? '0';
    const seedType = (this.route.snapshot.queryParamMap.get('type') ?? 'label') as LabelTemplateType;

    // Fire-and-forget — custom-field tokens become available once
    // the network round-trips, but the user can keep editing in the
    // meantime. Preview data is augmented on success.
    void this.loadCustomFields();

    if (id === '0') {
      this.isNew.set(true);
      const blank = this.makeBlank(seedType);
      this.template.set(blank);
      return;
    }

    this.isNew.set(false);
    this.loading.set(true);
    try {
      const t = await this.service.getById(id);
      if (!t) {
        // Bad id — bounce back to the list.
        void this.router.navigate(['/settings/label-builder']);
        return;
      }
      // Logo elements persisted by older clients may have an empty
      // `src` because the legacy front-end resolved the logo at
      // render time from `companyData.mediaUrl.defaultUrl`. Mirror
      // that behavior on load so existing templates show the right
      // thing immediately. Doesn't dirty the template — this is a
      // runtime-only enrichment.
      const logoUrl = this.resolveCompanyLogo();
      if (logoUrl) {
        for (const el of t.template) {
          if (el.type === 'Logo' && !(el as any).src) {
            (el as any).src = logoUrl;
          }
        }
      }
      // Loaded templates are clean by definition — clear any flag the
      // server might have sent through.
      t.isChanged = false;
      this.template.set(t);
      // Loaded state is the new "origin" — drop any history left
      // over from the previous template.
      this.clearHistory();
    } finally {
      this.loading.set(false);
    }
  }

  /** Pull product custom fields once and merge their abbrs into
   *  the preview model + the binding catalog so tokens like
   *  `!product.custom.{abbr}` resolve to placeholder strings on the
   *  canvas AND show up as a "Custom fields" group in the picker. */
  private async loadCustomFields(): Promise<void> {
    try {
      const fields = await this.customFs.getByType('product');
      if (!fields?.length) {
        this.customFieldDefs.set([]);
        return;
      }

      // Map abbr → id for the resolver, and seed dummy values. The
      // product bag is typed as `Record<string, any>`; bracket
      // access satisfies strict tsconfig's
      // `noPropertyAccessFromIndexSignature`.
      const map = new Map<string, string>();
      const data = this.previewData();
      const product = data.product ?? {};
      product['custom']       = product['custom']       ?? {};
      product['customFields'] = product['customFields'] ?? {};

      const defs: { abbr: string; label: string; type: string }[] = [];
      for (const f of fields) {
        if (!f.abbr) continue;
        map.set(f.abbr, f.id);
        product['custom'][f.abbr] = `${f.type.replace(/\s+/g, '_').toUpperCase()} VALUE`;
        defs.push({ abbr: f.abbr, label: f.name || f.abbr, type: f.type });
      }
      this.previewData.set({ ...data, product, customFieldsMap: map });
      this.customFieldDefs.set(defs);
    } catch {
      this.customFieldDefs.set([]);
    }
  }

  // ─── Unsaved-changes guard ────────────────────────────────────────

  /** Hooked by the route's `canDeactivate: [unsavedChangesGuard]`.
   *  Returns `true` when there are unsaved edits so the guard knows
   *  to show its confirm prompt. The guard handles the prompt
   *  itself; this component only owns the dirty signal. */
  hasUnsavedChanges(): boolean { return this.isDirty(); }

  // ─── Mutation helpers ─────────────────────────────────────────────

  /** Mark the template dirty. Keeps the dirty flag in one place so we
   *  don't sprinkle `template().isChanged = true` across handlers. */
  private markDirty(): void {
    const t = this.template();
    if (!t.isChanged) {
      t.isChanged = true;
      this.template.set(t);   // re-emit so signal consumers re-render
    } else {
      this.template.set(t);
    }
  }

  /** Patch a top-level scalar on the template (used by the label-
   *  settings inspector). */
  patchTemplate<K extends keyof LabelTemplate>(key: K, value: LabelTemplate[K]): void {
    this.pushUndo();
    const t = this.template();
    (t as any)[key] = value;
    t.isChanged = true;
    this.template.set(t);
  }

  /** Patch a field on the currently-selected element. The element is
   *  a class instance so we mutate in place, then re-emit the template
   *  signal so OnPush views re-render. */
  patchElement(field: string, value: any): void {
    const el = this.selectedElement() as any;
    if (!el) return;
    this.pushUndo();
    el[field] = value;
    this.markDirty();
  }

  /** Patch a nested field path like `size.factor` on the selected
   *  element. Used by the QR size slider where `size` is an object. */
  patchElementPath(path: string, value: any): void {
    const el = this.selectedElement() as any;
    if (!el) return;
    this.pushUndo();
    const parts = path.split('.');
    let cur = el;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = value;
    this.markDirty();
  }

  // ─── Palette → canvas drop ────────────────────────────────────────

  /** Dropping a palette tile onto the canvas. CDK gives us the drop
   *  point in viewport coordinates — translate to canvas-relative
   *  pixels using the canvas's bounding rect. */
  onDropToCanvas(event: CdkDragDrop<PaletteItem[]>): void {
    if (event.previousContainer === event.container) return;

    const paletteItem = event.item.data as PaletteItem;
    const canvas = (event.container.element.nativeElement as HTMLElement);
    const rect = canvas.getBoundingClientRect();
    const x = this.snap(Math.max(0, Math.round(event.dropPoint.x - rect.left)));
    const y = this.snap(Math.max(0, Math.round(event.dropPoint.y - rect.top)));

    this.addElement(paletteItem.type, { x, y });
  }

  /** Click-to-add — places at the origin so users without a pointer
   *  surface (or who accidentally drag outside the canvas) can still
   *  build labels. */
  onPaletteClick(item: PaletteItem): void {
    this.addElement(item.type, { x: 0, y: 0 });
  }

  private addElement(type: LabelElementType, position: { x: number; y: number }): void {
    this.pushUndo();
    const t = this.template();
    let el: LabelElement;
    switch (type) {
      case 'Textbox':         el = new ZplTextBox(position); break;
      case 'Barcode':         el = new ZplBarcode(position); break;
      case 'QrCode':          el = new ZplQrCode(position); break;
      case 'Rectangle':       el = new ZplRectangle(position); break;
      case 'Circle':          el = new ZplCircle(position); break;
      case 'HorizontalLine':  el = new ZplHorizontalLine(position); break;
      case 'VerticalLine':    el = new ZplVerticalLine(position); break;
      case 'Image':           el = new ZplImageElement(`img${t.template.length}`, position, ''); break;
      case 'Logo': {
        // Auto-fill the logo's `src` from the company settings so the
        // user doesn't have to upload it manually. Falls back to an
        // empty string (showing the placeholder) when no logo is set.
        const logoUrl = this.resolveCompanyLogo();
        el = new ZplLogoElement(`logo${t.template.length}`, position, logoUrl);
        break;
      }
    }
    t.template = [...t.template, el!];
    t.isChanged = true;
    this.template.set(t);
    this.selectedIndex.set(t.template.length - 1);
  }

  /** Read the current company's logo URL out of the cached settings.
   *  Falls back through both fields the API uses (`logoUrl` → `logo`)
   *  and replaces a localhost URL with the configured backend host so
   *  the image actually loads when the app runs against a remote
   *  server (same trick used by the product detail drawer). */
  private resolveCompanyLogo(): string {
    const settings = this.company.settings();
    const raw = (settings?.logoUrl ?? settings?.logo ?? '') as string;
    if (!raw) return '';
    return raw;
  }

  /** Image picker handler — wired to the file input in the inspector.
   *  Reads the file as a DataURL into the selected element's `src`,
   *  matching the legacy behavior. The DataURL embeds the bitmap in
   *  the saved template so it round-trips cleanly. */
  onImageFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const el = this.selectedElement() as ZplImageElement | ZplLogoElement | null;
      if (!el) return;
      this.pushUndo();
      el.src = dataUrl;
      this.markDirty();
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-picked (browsers won't fire
    // `change` again on identical filenames otherwise).
    input.value = '';
  }

  // ─── Canvas-element interactions ──────────────────────────────────

  // ─── Multi-select for the layers panel ──────────────────────────
  //
  // `selectedIndices` is a Set keyed by element index; the existing
  // single-element `selectedIndex` continues to drive the inspector
  // and resize handles. The set is updated whenever selection changes:
  //   - plain click: replace selection with [idx]
  //   - shift / cmd / ctrl click: toggle idx in the set
  //   - drag-to-reorder, delete, etc. update the set when indices
  //     shift around.
  selectedIndices = signal<Set<number>>(new Set());

  /** True when 2+ layers are selected — flips the layers panel into
   *  bulk mode (visible action bar at the foot). */
  hasMultiSelection = computed<boolean>(() => this.selectedIndices().size > 1);

  /** Helper used by the layer template to highlight any row that's
   *  in the multi-selection. The single-element selection ring
   *  (`selectedIndex`) still wins visually for the focused element. */
  isLayerSelected(idx: number): boolean {
    return this.selectedIndices().has(idx) || this.selectedIndex() === idx;
  }

  selectElement(idx: number, event?: Event): void {
    const e = event as MouseEvent | undefined;
    const additive = !!e && (e.shiftKey || e.metaKey || e.ctrlKey);
    if (event) event.stopPropagation();

    if (additive) {
      // Toggle this layer into / out of the multi-selection.
      const next = new Set(this.selectedIndices());
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      this.selectedIndices.set(next);
      // Inspector follows the most-recently-clicked element so the
      // user sees its controls, even when multi-selection is active.
      this.selectedIndex.set(idx);
      return;
    }

    // Plain click — replace the selection with just this one.
    this.selectedIndices.set(new Set([idx]));
    this.selectedIndex.set(idx);
  }

  /** Bulk delete every layer currently in the multi-selection.
   *  Iterates in descending order so each splice doesn't disturb
   *  the indices still queued. Pushes a single undo entry up front
   *  so the whole batch reverts atomically. */
  deleteSelectedLayers(): void {
    const indices = Array.from(this.selectedIndices()).sort((a, b) => b - a);
    if (indices.length === 0) return;
    this.pushUndo();
    const t = this.template();
    for (const i of indices) t.template.splice(i, 1);
    t.template = [...t.template];
    t.isChanged = true;
    this.template.set(t);
    this.selectedIndices.set(new Set());
    this.selectedIndex.set(null);
  }

  /** Click on empty canvas → deselect (so the inspector flips back to
   *  label-level settings). */
  onCanvasClick(): void {
    this.selectedIndex.set(null);
  }

  // ─── Manual pointer-based element drag ───────────────────────────
  //
  // We hand-roll element drag instead of using `cdkDrag` because a
  // `cdkDrag` placed inside a `cdkDropList` (which we need on the
  // canvas to receive palette drops) always behaves like a list
  // child — it gets a placeholder + preview clone and fights any
  // free-position transform we set. The document-builder designer
  // canvas uses the same hand-rolled pattern for the same reason.
  //
  // Lifecycle:
  //   1. `startElementDrag(idx, event)` on pointerdown — captures
  //      origin coordinates and registers document-level move / up
  //      listeners. We pushUndo eagerly here so the user can revert
  //      a single drag with one Ctrl+Z.
  //   2. Document `pointermove` — translates pointer delta into a
  //      new `el.position`, runs alignment guides + position chip.
  //   3. Document `pointerup` — applies snap-to-grid + alignment
  //      soft-snap, clears the chip/guides, marks dirty if anything
  //      moved.

  /** Drag state captured at pointerdown. `null` when no drag is
   *  active. Stored as a private field (not a signal) because
   *  pointermove fires at high frequency and we don't want the
   *  template re-evaluating just for the drag state itself — only
   *  `el.position` mutations + `markDirty()` should re-render.
   *
   *  When the drag picks up an element that's part of a multi-
   *  selection, every selected (non-locked) layer is captured as a
   *  group member. They move in lockstep with the primary so a
   *  user can rearrange a sub-layout in one gesture.
   *
   *  Per-member `elW` / `elH` are read from the rendered DOM at
   *  pointerdown so bounds clamping keeps the whole element inside
   *  the canvas — including textboxes whose width is content-
   *  driven and not tracked on the model. */
  private dragState: {
    primaryIdx: number;
    startX:     number;
    startY:     number;
    members: Array<{
      idx:   number;
      origX: number;
      origY: number;
      elW:   number;
      elH:   number;
    }>;
    moved:      boolean;
  } | null = null;

  startElementDrag(idx: number, event: PointerEvent): void {
    // Stop the canvas's own click-to-deselect from also firing,
    // and prevent the browser from kicking off its native text /
    // image drag while we own the pointer.
    event.stopPropagation();
    event.preventDefault();

    const t = this.template();
    const el = t.template[idx];
    if (!el) return;

    // If the user clicks an element that ISN'T part of the current
    // multi-selection, replace selection with just this one. Clicks
    // inside an existing multi-selection preserve the group so the
    // user can drag it together.
    const sel = this.selectedIndices();
    const inGroup = sel.has(idx) && sel.size > 1;
    if (!inGroup) this.selectedIndices.set(new Set([idx]));
    this.selectedIndex.set(idx);

    // Locked layers can't move — selection still happened above so
    // the user can unlock from the inspector.
    if (el.locked) return;

    this.pushUndo();

    // Build the member list — every non-locked element that should
    // move with the primary. The primary's DOM node gives a precise
    // measurement; other members fall back to model-derived sizes
    // (`elWidth` / `elHeight`) which are accurate for shapes /
    // images and reasonable defaults for text.
    const node = event.currentTarget as HTMLElement;
    const primaryW = node?.offsetWidth  ?? Math.max(20, this.elWidth(el)  || 60);
    const primaryH = node?.offsetHeight ?? Math.max(16, this.elHeight(el) || 24);

    const indices = inGroup ? Array.from(sel) : [idx];
    const members = indices
      .map((i) => ({ i, e: t.template[i] }))
      .filter(({ e }) => e && !e.locked)
      .map(({ i, e }) => ({
        idx:   i,
        origX: e!.position.x,
        origY: e!.position.y,
        elW:   i === idx ? primaryW : Math.max(20, this.elWidth(e!)  || 60),
        elH:   i === idx ? primaryH : Math.max(16, this.elHeight(e!) || 24),
      }));

    this.dragState = {
      primaryIdx: idx,
      startX:     event.clientX,
      startY:     event.clientY,
      members,
      moved:      false,
    };
    document.addEventListener('pointermove', this.onElementPointerMove);
    document.addEventListener('pointerup',   this.onElementPointerUp);
  }

  /** Compute the most-restrictive dx/dy the group can take given
   *  the canvas bounds. Each member's left/top can't go negative
   *  and its right/bottom can't push past the canvas edge —
   *  whichever member binds first caps the group's movement so the
   *  relative layout stays intact. */
  private clampGroupDelta(
    members: Array<{ origX: number; origY: number; elW: number; elH: number }>,
    dx: number, dy: number,
  ): { dx: number; dy: number } {
    const { width, height } = this.canvasPx();
    let minDx = -Infinity, maxDx = Infinity;
    let minDy = -Infinity, maxDy = Infinity;
    for (const m of members) {
      // Allowed dx range so this member stays in [0, width - elW]:
      //   origX + dx >= 0          → dx >= -origX
      //   origX + dx + elW <= w    → dx <=  w - elW - origX
      minDx = Math.max(minDx, -m.origX);
      maxDx = Math.min(maxDx, Math.max(0, width - m.elW) - m.origX);
      minDy = Math.max(minDy, -m.origY);
      maxDy = Math.min(maxDy, Math.max(0, height - m.elH) - m.origY);
    }
    return {
      dx: Math.min(maxDx, Math.max(minDx, dx)),
      dy: Math.min(maxDy, Math.max(minDy, dy)),
    };
  }

  private onElementPointerMove = (event: PointerEvent): void => {
    const s = this.dragState;
    if (!s || !s.members.length) return;
    const t = this.template();

    const rawDx = event.clientX - s.startX;
    const rawDy = event.clientY - s.startY;
    if (!s.moved && (rawDx !== 0 || rawDy !== 0)) s.moved = true;

    // Clamp once for the whole group so members move in lockstep.
    // Without this, an edge-bound member would lag behind while the
    // primary kept moving, breaking the relative arrangement.
    const { dx, dy } = this.clampGroupDelta(s.members, rawDx, rawDy);

    for (const m of s.members) {
      const el = t.template[m.idx];
      if (!el) continue;
      el.position.x = m.origX + dx;
      el.position.y = m.origY + dy;
    }

    // Alignment guides + position chip track the PRIMARY only —
    // group drags don't need per-member guides, and the chip
    // reads as the dragged element's coordinates.
    const primary = s.members.find(m => m.idx === s.primaryIdx) ?? s.members[0];
    const px = primary.origX + dx;
    const py = primary.origY + dy;
    this.computeGuides(s.primaryIdx, px, py);
    this.positionChip.set({ x: Math.round(px), y: Math.round(py) });
    this.markDirty();
  };

  private onElementPointerUp = (_event: PointerEvent): void => {
    const s = this.dragState;
    document.removeEventListener('pointermove', this.onElementPointerMove);
    document.removeEventListener('pointerup',   this.onElementPointerUp);
    this.clearGuides();
    this.positionChip.set(null);
    this.dragState = null;
    if (!s || !s.moved || !s.members.length) return;

    const t = this.template();
    const primary = s.members.find(m => m.idx === s.primaryIdx) ?? s.members[0];
    const primaryEl = t.template[primary.idx];
    if (!primaryEl) return;

    // Compute snap/alignment adjustment based on the primary's
    // current position; apply the same delta to every member so
    // the group stays cohesive after snap.
    const aligned = this.computeGuides(primary.idx, primaryEl.position.x, primaryEl.position.y);
    let finalX = this.snap(aligned.x);
    let finalY = this.snap(aligned.y);
    // Re-clamp after snap so a soft-snap can't push past the edge.
    const adjustedDx = finalX - primary.origX;
    const adjustedDy = finalY - primary.origY;
    const clamped = this.clampGroupDelta(s.members, adjustedDx, adjustedDy);
    for (const m of s.members) {
      const el = t.template[m.idx];
      if (!el) continue;
      el.position.x = m.origX + clamped.dx;
      el.position.y = m.origY + clamped.dy;
    }
    this.clearGuides();
    this.markDirty();
  };

  // ─── Resize handles ──────────────────────────────────────────────
  //
  // We track a single pointer-drag at a time. The selected element
  // is mutated in place; `markDirty()` re-emits the template signal
  // on each pointermove so the inspector + canvas stay in sync.
  //
  // Handles are placed by the template based on `resizeHandles(el)`
  // — different element types expose different sets:
  //   - Rectangle / Image / Logo: corners + edges (8 handles)
  //   - Circle:         single SE handle (uniform diameter)
  //   - Barcode:        S handle (height only)
  //   - HorizontalLine: E handle (width only)
  //   - VerticalLine:   S handle (height only)
  //   - Textbox / QR:   none — sized via inspector inputs
  //
  // Handle codes mirror the CSS-direction acronyms:
  //   nw n ne   (top row)
  //    w    e   (sides)
  //   sw s se   (bottom row)

  private resizeStart: {
    side: string;
    el: any;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null = null;

  startResize(side: string, event: PointerEvent, idx: number): void {
    event.stopPropagation();
    event.preventDefault();
    const el = this.template().template[idx] as any;
    if (!el) return;
    // Locked layers stay put — resize handles render but we don't
    // act on them. Selecting still works so the user can unlock
    // from the inspector.
    if (el.locked) {
      this.selectedIndex.set(idx);
      return;
    }
    this.selectedIndex.set(idx);
    // Snapshot once at the start of the resize, not on every
    // pointermove — otherwise dragging a corner would flood the undo
    // stack with intermediate states.
    this.pushUndo();
    this.resizeStart = {
      side,
      el,
      startX: event.clientX,
      startY: event.clientY,
      startW: this.elWidth(el),
      startH: this.elHeight(el),
    };
    document.addEventListener('pointermove', this.onResizeMove);
    document.addEventListener('pointerup',   this.onResizeEnd);
  }

  private onResizeMove = (event: PointerEvent): void => {
    const r = this.resizeStart;
    if (!r) return;
    const dx = event.clientX - r.startX;
    const dy = event.clientY - r.startY;
    const minSize = 4;

    // Map handle side → which axis to scale + sign. Edge handles only
    // affect one axis; corner handles (nw/ne/sw/se) affect both.
    const grow = {
      e:  { dw:  dx, dh:   0 },
      w:  { dw: -dx, dh:   0 },
      n:  { dw:   0, dh: -dy },
      s:  { dw:   0, dh:  dy },
      ne: { dw:  dx, dh: -dy },
      nw: { dw: -dx, dh: -dy },
      se: { dw:  dx, dh:  dy },
      sw: { dw: -dx, dh:  dy },
    }[r.side] ?? { dw: 0, dh: 0 };

    const newW = Math.max(minSize, this.snap(Math.round(r.startW + grow.dw)));
    const newH = Math.max(minSize, this.snap(Math.round(r.startH + grow.dh)));

    // Circle is uniform — pick the bigger axis so corner drags grow
    // naturally without locking aspect.
    if (r.el.type === 'Circle') {
      r.el.circleDiameter = Math.max(newW, newH);
    } else if (r.el.type === 'HorizontalLine') {
      r.el.width = newW;
    } else if (r.el.type === 'VerticalLine') {
      r.el.height = newH;
    } else if (r.el.type === 'Barcode') {
      r.el.height = newH;
    } else {
      // Rectangle / Image / Logo
      r.el.width = newW;
      r.el.height = newH;
    }

    this.markDirty();
  };

  private onResizeEnd = (): void => {
    document.removeEventListener('pointermove', this.onResizeMove);
    document.removeEventListener('pointerup',   this.onResizeEnd);
    this.resizeStart = null;
  };

  /** Resolve the element's logical width — varies by type because
   *  Circle uses a single diameter and the line elements only carry
   *  one axis. Used by the resize-start snapshot so deltas operate
   *  off the right baseline. */
  /** Effective on-canvas width for layout maths (drag clamping,
   *  alignment guides, align/centre actions). When an `idx` is
   *  supplied we read the live `offsetWidth` from the canvas DOM
   *  — the only source of truth for elements whose rendered size
   *  doesn't match a single data-model field (Barcode auto-fits
   *  to its data length, Textbox depends on font + glyph
   *  metrics, etc.). Falls back to a model-derived estimate when
   *  the DOM isn't ready or the caller doesn't have an index. */
  private elWidth(el: any, idx?: number): number {
    if (!el) return 0;
    if (idx != null) {
      const node = document.querySelector<HTMLElement>(`.lbf-el[data-el-idx="${idx}"]`);
      const w = node?.offsetWidth ?? 0;
      if (w > 0) return w;
    }
    switch (el.type) {
      case 'Textbox':        return Math.max(20, Math.round((el.fontSize ?? 14) * ((el.data?.length ?? 4) || 4) * 0.55));
      case 'Barcode':        return 200;
      case 'QrCode':         return el.size?.pixel ?? 80;
      case 'Circle':         return el.circleDiameter ?? 0;
      case 'VerticalLine':   return el.thick ?? 0;
      case 'HorizontalLine': return el.width ?? 0;
      default:               return el.width ?? 0;
    }
  }
  private elHeight(el: any, idx?: number): number {
    if (!el) return 0;
    if (idx != null) {
      const node = document.querySelector<HTMLElement>(`.lbf-el[data-el-idx="${idx}"]`);
      const h = node?.offsetHeight ?? 0;
      if (h > 0) return h;
    }
    switch (el.type) {
      case 'Textbox':        return Math.round((el.fontSize ?? 14) * 1.2);
      case 'QrCode':         return el.size?.pixel ?? 80;
      case 'Circle':         return el.circleDiameter ?? 0;
      case 'HorizontalLine': return el.thick ?? 0;
      case 'VerticalLine':   return el.height ?? 0;
      case 'Barcode':        return el.height ?? 0;
      default:               return el.height ?? 0;
    }
  }

  /** Which handles to render for an element. Empty array hides them. */
  resizeHandles(el: LabelElement | null): string[] {
    if (!el) return [];
    switch (el.type) {
      case 'Rectangle':
      case 'Image':
      case 'Logo':            return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
      case 'Circle':          return ['se'];
      case 'HorizontalLine':  return ['e'];
      case 'VerticalLine':    return ['s'];
      case 'Barcode':         return ['s'];
      default:                return [];
    }
  }

  // ─── Z-order controls ─────────────────────────────────────────────
  //
  // Elements stack in array order — `template[0]` paints first
  // (back-most), `template[length-1]` paints last (front). All four
  // ops mutate the selected element's position in the array, then
  // re-emit the template signal so the canvas reflows.

  /** Move the selected element to the very front (last in array). */
  bringToFront(): void { this.moveSelected('front'); }
  /** Move the selected element forward by one step. */
  bringForward(): void { this.moveSelected('forward'); }
  /** Move the selected element backward by one step. */
  sendBackward(): void { this.moveSelected('backward'); }
  /** Move the selected element to the very back (first in array). */
  sendToBack():  void { this.moveSelected('back'); }

  private moveSelected(direction: 'front' | 'back' | 'forward' | 'backward'): void {
    const idx = this.selectedIndex();
    if (idx === null) return;
    const t = this.template();
    const last = t.template.length - 1;
    if (last < 1) return;
    this.pushUndo();

    let target = idx;
    switch (direction) {
      case 'front':    target = last;            break;
      case 'back':     target = 0;               break;
      case 'forward':  target = Math.min(last, idx + 1); break;
      case 'backward': target = Math.max(0,    idx - 1); break;
    }
    if (target === idx) return;

    const next = [...t.template];
    const [el] = next.splice(idx, 1);
    next.splice(target, 0, el);
    t.template = next;
    t.isChanged = true;
    this.template.set(t);
    this.selectedIndex.set(target);
  }

  /** Boundary helpers for the inspector to disable un-actionable
   *  z-order buttons (e.g. "bring forward" on a top-most element). */
  canBringForward(): boolean {
    const idx = this.selectedIndex();
    return idx !== null && idx < this.template().template.length - 1;
  }
  canSendBackward(): boolean {
    const idx = this.selectedIndex();
    return idx !== null && idx > 0;
  }

  // ─── Layer-panel actions ─────────────────────────────────────────
  //
  // Pure toggles on the persisted `locked` / `hidden` flags. Each
  // pushes an undo entry so layer-state changes are reversible like
  // every other mutation.

  /** Drop handler for the layers panel. The panel iterates the
   *  template array in reverse so the visual order matches z-order
   *  (front → back); we translate the panel-relative indices back
   *  to the array's natural order before calling `moveItemInArray`.
   *
   *  Pushes a single undo entry per reorder so a stray drag is
   *  always reversible. */
  onLayerDrop(event: CdkDragDrop<unknown[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const t = this.template();
    const len = t.template.length;
    // Reverse-index → array-index mapping. Visual top (panel idx 0)
    // is the LAST array entry.
    const fromArray = len - 1 - event.previousIndex;
    const toArray   = len - 1 - event.currentIndex;
    if (fromArray === toArray) return;

    this.pushUndo();
    const next = [...t.template];
    moveItemInArray(next, fromArray, toArray);
    t.template = next;
    t.isChanged = true;
    this.template.set(t);

    // Keep the moved row selected so the inspector reflects the
    // post-move state without the user having to re-click.
    if (this.selectedIndex() === fromArray) {
      this.selectedIndex.set(toArray);
    } else if (this.selectedIndex() !== null) {
      // Selection at a stable array index whose position relative
      // to the moved row may have changed — recompute.
      const sel = this.selectedIndex()!;
      if (fromArray < sel && toArray >= sel) this.selectedIndex.set(sel - 1);
      else if (fromArray > sel && toArray <= sel) this.selectedIndex.set(sel + 1);
    }
  }

  // ─── Context menu ────────────────────────────────────────────────
  //
  // Right-click on a canvas element or a layer row pops up a menu
  // anchored at the cursor. Houses every per-element action so the
  // user can find them without trawling the inspector. Closes on
  // outside-click + Escape (handled by HostListener `onKeyDown`).

  /** When non-null, a menu is open. Coordinates are page-relative
   *  so the rendered popover can sit at the cursor. */
  contextMenu = signal<{
    idx: number;
    x:   number;
    y:   number;
  } | null>(null);

  /** Right-click handler. Selects the targeted layer first, then
   *  positions the menu at the click coordinates. Replaces the
   *  browser's native context menu with our own. */
  openContextMenu(idx: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    // Right-click on an unselected layer → make it the selection
    // (matches Finder / Files / VS Code behavior). Right-click
    // inside an existing multi-selection preserves it so users can
    // bulk-act on the group.
    const sel = this.selectedIndices();
    if (!sel.has(idx)) {
      this.selectedIndices.set(new Set([idx]));
      this.selectedIndex.set(idx);
    } else if (this.selectedIndex() !== idx) {
      this.selectedIndex.set(idx);
    }
    this.contextMenu.set({ idx, x: event.clientX, y: event.clientY });
  }

  closeContextMenu(): void { this.contextMenu.set(null); }

  /** True when the menu's actionable element supports a given
   *  z-order direction. Mirrors the inspector's button states. */
  ctxCanForward(): boolean  { return this.canBringForward(); }
  ctxCanBackward(): boolean { return this.canSendBackward(); }

  /** Per-row Duplicate trigger — selects the clicked layer first
   *  so the existing `duplicateSelected()` (which operates on
   *  `selectedIndex()`) can target it. Re-uses the same undo /
   *  dirty pipeline so behaviour matches the inspector path. */
  duplicateLayer(idx: number, event: Event): void {
    event.stopPropagation();
    this.selectedIndex.set(idx);
    this.duplicateSelected();
  }

  /** Per-row Delete trigger — same pattern as `duplicateLayer`. */
  deleteLayer(idx: number, event: Event): void {
    event.stopPropagation();
    this.selectedIndex.set(idx);
    this.deleteSelected();
  }

  toggleLocked(idx: number, event?: Event): void {
    if (event) event.stopPropagation();
    const t = this.template();
    const el = t.template[idx];
    if (!el) return;
    this.pushUndo();
    el.locked = !el.locked;
    t.isChanged = true;
    this.template.set(t);
  }

  toggleHidden(idx: number, event?: Event): void {
    if (event) event.stopPropagation();
    const t = this.template();
    const el = t.template[idx];
    if (!el) return;
    this.pushUndo();
    el.hidden = !el.hidden;
    t.isChanged = true;
    this.template.set(t);
  }

  /** Layer label for the panel — shows a short, recognizable hint
   *  about the element's content (text excerpt for textboxes, value
   *  for barcode/QR, dimensions otherwise). Falls back to the type
   *  name. */
  layerLabel(el: LabelElement): string {
    const a = el as any;
    switch (el.type) {
      case 'Textbox': return a.data ? `“${this.truncate(String(a.data), 28)}”` : 'Text';
      case 'Barcode': return a.data ? `# ${this.truncate(String(a.data), 24)}` : 'Barcode';
      case 'QrCode':  return a.data ? `QR ${this.truncate(String(a.data), 22)}` : 'QR code';
      case 'Rectangle':      return `Rectangle ${a.width}×${a.height}`;
      case 'Circle':         return `Circle ⌀${a.circleDiameter}`;
      case 'HorizontalLine': return `H-line ${a.width}px`;
      case 'VerticalLine':   return `V-line ${a.height}px`;
      case 'Image':          return 'Image';
      case 'Logo':           return 'Logo';
      default:               return (el.type as string) ?? 'Element';
    }
  }

  /** Iconography for the layer rows — picks the same path as the
   *  palette tile so the visual mapping is consistent. */
  layerIconPath(type: LabelElementType): string {
    const tile = PALETTE.find(p => p.type === type);
    return tile ? tile.iconPath : 'M4 4h16v16H4z';
  }

  private truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
  }

  deleteSelected(): void {
    const idx = this.selectedIndex();
    if (idx === null) return;
    this.pushUndo();
    const t = this.template();
    t.template = t.template.filter((_, i) => i !== idx);
    t.isChanged = true;
    this.template.set(t);
    this.selectedIndex.set(null);
  }

  /** Clone the selected element and drop the copy 10 px down + right
   *  so the user can see it landed. The clone is inserted right
   *  after the original so subsequent z-order ops on the new element
   *  feel intuitive (the legacy default of "appended at the end" put
   *  copies of background elements in front of foreground ones,
   *  which surprised users). */
  duplicateSelected(): void {
    const idx = this.selectedIndex();
    if (idx === null) return;
    const t = this.template();
    const original = t.template[idx];
    if (!original) return;

    this.pushUndo();
    // Round-trip via JSON + parseElement so the clone is a fresh
    // class instance with no shared object references (position,
    // size, etc.). DataURL `src` on Image / Logo round-trips fine.
    const cloned = parseElement(JSON.parse(JSON.stringify(original)));
    cloned.position = {
      x: original.position.x + 10,
      y: original.position.y + 10,
    };
    // Image / Logo elements need a unique id so the ZPL `^XGR`
    // reference doesn't collide with the original's `~DG` block.
    if (cloned.type === 'Image' || cloned.type === 'Logo') {
      (cloned as any).id = `${cloned.type.toLowerCase()}${t.template.length}`;
    }

    const next = [...t.template];
    next.splice(idx + 1, 0, cloned);
    t.template = next;
    t.isChanged = true;
    this.template.set(t);
    this.selectedIndex.set(idx + 1);
  }

  // ─── Toolbar actions ──────────────────────────────────────────────

  async save(): Promise<void> {
    if (this.saving() || !this.isDirty()) return;
    this.saving.set(true);
    try {
      const t = this.template();
      const result = await this.service.save(t);
      if (!result) {
        // Surface a generic toast — the API service already logs
        // structured errors, no need to over-engineer here.
        return;
      }
      // Clear dirty + persist server-assigned id. Saved state is
      // the new origin — drop history so the user can't undo past
      // the persisted version.
      t.id = result.id;
      t.isChanged = false;
      this.template.set(t);
      this.clearHistory();

      if (this.isNew()) {
        this.isNew.set(false);
        // Replace the URL so a refresh re-loads the template via
        // `getById` instead of seeding a new blank one.
        void this.router.navigate(['/settings/label-builder', result.id], { replaceUrl: true });
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Download the current `template[]` as a JSON file — matches the
   *  legacy "Generate JSON" toolbar action so existing import flows
   *  keep working unchanged. */
  downloadJson(): void {
    const t = this.template();
    const blob = new Blob([JSON.stringify(t.template)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t.name || 'label'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Render the canvas to a PNG file the user can save / share.
   *  Useful for design reviews + Slack screenshots without having
   *  to send the printer-only ZPL or a screen capture. */
  async downloadPng(): Promise<void> {
    const t = this.template();
    const blob = await generatePng(t);
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t.name || 'label'}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Generate a full ZPL document for the current template and offer
   *  it as a `.zpl` download. Image / Logo elements are rasterized
   *  before stitching so the resulting file is self-contained. */
  async downloadZpl(): Promise<void> {
    const t = this.template();
    const zpl = await generateZpl(t);
    const blob = new Blob([zpl], { type: 'text/plain;charset=UTF-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t.name || 'label'}.zpl`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async cancel(): Promise<void> {
    if (!this.isDirty()) {
      void this.router.navigate(['/settings/label-builder']);
      return;
    }
    const ok = await this.confirm({
      title:   this.translate.instant('LABEL_BUILDER.FORM.DIRTY_DISCARD'),
      message: this.translate.instant('LABEL_BUILDER.FORM.DIRTY_HINT'),
      danger:  true,
    });
    if (ok) void this.router.navigate(['/settings/label-builder']);
  }

  // ─── Keyboard shortcuts ───────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const ctrlOrCmd = event.ctrlKey || event.metaKey;

    if (ctrlOrCmd && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void this.save();
      return;
    }

    // Escape — close the context menu first, then fall through to
    // single-element deselection if no menu was open.
    if (event.key === 'Escape') {
      if (this.contextMenu()) {
        this.closeContextMenu();
        event.preventDefault();
        return;
      }
    }

    // Ctrl/Cmd+A — select every layer. Skipped while editing in an
    // input/textarea so the browser's native text-select-all keeps
    // working there.
    if (ctrlOrCmd && event.key.toLowerCase() === 'a'
        && !this.isEditableTarget(event.target)) {
      event.preventDefault();
      const t = this.template();
      if (t.template.length === 0) return;
      const all = new Set<number>();
      for (let i = 0; i < t.template.length; i++) all.add(i);
      this.selectedIndices.set(all);
      // Inspector follows the last (frontmost) element so the user
      // sees something concrete in the editor panel.
      this.selectedIndex.set(t.template.length - 1);
      return;
    }

    // Undo / redo — Ctrl+Z is undo, Ctrl+Y or Ctrl+Shift+Z is redo.
    // Don't fight native text-edit undo when the user is in an
    // input/textarea — let the browser handle character-level undo
    // there.
    if (ctrlOrCmd && event.key.toLowerCase() === 'z' && !event.shiftKey
        && !this.isEditableTarget(event.target)) {
      event.preventDefault();
      this.undo();
      return;
    }
    if (ctrlOrCmd && (event.key.toLowerCase() === 'y'
        || (event.key.toLowerCase() === 'z' && event.shiftKey))
        && !this.isEditableTarget(event.target)) {
      event.preventDefault();
      this.redo();
      return;
    }

    // Ctrl+D — duplicate the selected element. Skipped while editing
    // input fields (lots of native browser-shortcut overlap).
    if (ctrlOrCmd && event.key.toLowerCase() === 'd'
        && !this.isEditableTarget(event.target)
        && this.selectedIndex() !== null) {
      event.preventDefault();
      this.duplicateSelected();
      return;
    }

    // Delete / Backspace removes the selected element — but only when
    // the user isn't focused inside an input/textarea (otherwise we'd
    // eat their typing).
    if ((event.key === 'Delete' || event.key === 'Backspace')
        && !this.isEditableTarget(event.target)
        && this.selectedIndex() !== null) {
      event.preventDefault();
      this.deleteSelected();
      return;
    }

    // Arrow-key nudging — moves the selected element by 1 px, or 10
    // px with shift held. Only fires when the user isn't editing an
    // input/textarea so this doesn't fight cursor movement inside
    // the inspector content fields.
    if (this.selectedIndex() !== null
        && !this.isEditableTarget(event.target)
        && (event.key === 'ArrowUp' || event.key === 'ArrowDown'
         || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp'   ? -step : event.key === 'ArrowDown'  ? step : 0;
      this.nudgeSelected(dx, dy);
    }
  }

  /** Move the selected element by `(dx, dy)` pixels, clamped to the
   *  canvas bounds. Used by arrow-key nudging. */
  private nudgeSelected(dx: number, dy: number): void {
    const idx = this.selectedIndex();
    if (idx === null) return;
    const t = this.template();
    const el = t.template[idx];
    if (!el || el.locked) return;
    this.pushUndo();
    const { width, height } = this.canvasPx();
    el.position.x = Math.max(0, Math.min(width  - 1, el.position.x + dx));
    el.position.y = Math.max(0, Math.min(height - 1, el.position.y + dy));
    this.markDirty();
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /** Build a brand-new blank template seeded with the requested type
   *  (label vs kitchen). Used both for the `/0` route and after the
   *  unsaved-changes prompt confirms a fresh start. */
  private makeBlank(type: LabelTemplateType): LabelTemplate {
    const t = new LabelTemplate();
    t.templateType = type;
    return t;
  }

  /** Resolves the i18n key for the inspector title — depends on the
   *  selected element's type, falls back to "Label settings" when
   *  nothing is selected. */
  inspectorTitleKey = computed<string>(() => {
    const el = this.selectedElement();
    if (!el) return 'LABEL_BUILDER.FORM.INSPECTOR.LABEL_SETTINGS';
    const item = PALETTE.find(p => p.type === el.type);
    return item ? item.i18nKey : 'LABEL_BUILDER.FORM.INSPECTOR.ELEMENT';
  });

  // ─── Inspector groups + tabs (Adobe-dock pattern) ────────────────
  //
  // Mirrors the receipt-builder element-editor: each element type
  // exposes a list of slots (content / style / size / options /
  // source / transform / properties / sample). Slots can be grouped
  // together so multiple show as tabs in one widget, or live as
  // separate widgets on their own. The user can drag a widget's
  // header up/down to reorder, drop one header on another to merge
  // them as tabs, or click × on a tab pill to ungroup that slot.
  //
  // State is per element-type-key:
  //   - `__label__` for the no-selection (label settings) view
  //   - `Textbox`, `Barcode`, `QrCode`, …, `Logo` for selections

  /** Default groups per element type — every slot starts in its own
   *  single-item group. Adding a slot here surfaces it for new users;
   *  saved layouts are merged with defaults via `groupsFor`. */
  private static readonly DEFAULT_GROUPS: Record<string, string[][]> = {
    __label__:      [['properties'], ['sample'], ['size']],
    Textbox:        [['content'], ['style'], ['transform']],
    Barcode:        [['content'], ['size'], ['options'], ['transform']],
    QrCode:         [['content'], ['size'], ['transform']],
    Rectangle:      [['size'], ['transform']],
    Circle:         [['size'], ['transform']],
    HorizontalLine: [['size'], ['transform']],
    VerticalLine:   [['size'], ['transform']],
    Image:          [['source'], ['size'], ['transform']],
    Logo:           [['size'], ['transform']],
  };

  /** Per-type groups signal — written by `onSlotReorder` /
   *  `ungroupTab` / `reorderTab`, read by `groupsFor`. Reads pull
   *  through the signal so the template re-renders on changes. */
  private groupsState = signal<Record<string, string[][]>>({});

  /** Active tab id per group, keyed by `<typeKey>:<groupIndex>`.
   *  Defaults to the group's first slot. Persisted to localStorage. */
  private activeTabState = signal<Record<string, string>>({});

  /** i18n keys per slot id. */
  readonly slotTitleKey: Record<string, string> = {
    content:    'LABEL_BUILDER.FORM.INSPECTOR.CONTENT',
    style:      'LABEL_BUILDER.FORM.INSPECTOR.STYLE',
    size:       'LABEL_BUILDER.FORM.INSPECTOR.SIZE',
    options:    'LABEL_BUILDER.FORM.INSPECTOR.OPTIONS',
    source:     'LABEL_BUILDER.FORM.INSPECTOR.SOURCE',
    transform:  'LABEL_BUILDER.FORM.INSPECTOR.TRANSFORM',
    properties: 'LABEL_BUILDER.FORM.INSPECTOR.PROPERTIES',
    sample:     'LABEL_BUILDER.FORM.INSPECTOR.SAMPLE_PRODUCT',
  };

  /** Resolve the type-key for the current selection. `__label__` for
   *  the no-selection view. */
  inspectorTypeKey = computed<string>(() => this.selectedElement()?.type ?? '__label__');

  /** Read the groups for a type. Pulls from in-memory state if set,
   *  otherwise from localStorage, otherwise defaults. Defensive about
   *  unknown / missing slots so a code-side change to the slot list
   *  doesn't strand existing users. */
  groupsFor(typeKey: string): string[][] {
    const cached = this.groupsState()[typeKey];
    if (cached) return this.filterRelevant(typeKey, cached);

    const def = LabelBuilderFormComponent.DEFAULT_GROUPS[typeKey] ?? [];
    const defFlat = def.flat();
    const known = new Set(defFlat);

    let stored: string[][] | null = null;
    try {
      const raw = localStorage.getItem('lbfw-groups:' + typeKey);
      if (raw) stored = JSON.parse(raw) as string[][];
    } catch { /* corrupt entry — ignore */ }

    let groups: string[][];
    if (Array.isArray(stored) && stored.every(g => Array.isArray(g))) {
      groups = stored
        .map(g => g.filter(s => known.has(s)))
        .filter(g => g.length > 0);
      // Append defaults the stored layout missed.
      const seen = new Set(groups.flat());
      defFlat.forEach(s => { if (!seen.has(s)) groups.push([s]); });
    } else {
      groups = def.map(g => [...g]);
    }
    return this.filterRelevant(typeKey, groups);
  }

  /** Drop slots that aren't meaningful for the current state. Right
   *  now: hide the `sample` slot on kitchen-ticket templates (no
   *  product preview makes sense). Drops empty groups. */
  private filterRelevant(typeKey: string, groups: string[][]): string[][] {
    if (typeKey !== '__label__') return groups;
    const isKitchen = this.template().templateType === 'kitchen';
    if (!isKitchen) return groups;
    return groups.map(g => g.filter(s => s !== 'sample')).filter(g => g.length > 0);
  }

  activeTab(typeKey: string, groupIndex: number, slots: string[]): string {
    if (slots.length === 0) return '';
    const key = `${typeKey}:${groupIndex}`;
    const stored = this.activeTabState()[key];
    if (stored && slots.includes(stored)) return stored;
    return slots[0];
  }

  setActiveTab(typeKey: string, groupIndex: number, id: string | undefined): void {
    if (!id) return;
    const key = `${typeKey}:${groupIndex}`;
    this.activeTabState.update(m => ({ ...m, [key]: id }));
    try { localStorage.setItem('lbfw-tab:' + key, id); } catch { /* swallow */ }
  }

  /** Build the tab descriptor list for a group — empty when the
   *  group has only one slot (the widget then shows its title). */
  buildTabs(group: string[]): { id: string; title: string }[] {
    if (group.length <= 1) return [];
    return group.map(id => ({
      id,
      title: this.translate.instant(this.slotTitleKey[id] ?? id),
    }));
  }

  /** Single-slot group title for the widget header. Falls back to
   *  the raw slot id capitalized so unknown slots still render
   *  something readable. */
  widgetTitle(group: string[]): string {
    const id = group?.[0];
    if (!id) return '';
    const key = this.slotTitleKey[id];
    if (key) return this.translate.instant(key);
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  /** Group-level drop handler. Either a vertical reorder or a drop-
   *  on-header merge depending on `event.dropPoint`. */
  onSlotReorder(typeKey: string, event: CdkDragDrop<string[][]>): void {
    const groups = this.groupsFor(typeKey).map(g => [...g]);
    const fromIdx = event.previousIndex;
    const targetGi = this.hitTestHeader(event.dropPoint);
    if (targetGi !== null && targetGi !== fromIdx) {
      // Merge: pull dragged group's slots into target group.
      const merged = [...groups[targetGi], ...groups[fromIdx]];
      const next = groups
        .map((g, i) => (i === targetGi ? merged : g))
        .filter((_, i) => i !== fromIdx);
      this.commitGroups(typeKey, next);
      return;
    }
    moveItemInArray(groups, event.previousIndex, event.currentIndex);
    this.commitGroups(typeKey, groups);
  }

  /** Reorder slots within a group (tabs drag inside the strip). */
  reorderTab(
    typeKey: string,
    groupIndex: number,
    event: { previousIndex: number; currentIndex: number },
  ): void {
    const groups = this.groupsFor(typeKey).map(g => [...g]);
    const group = groups[groupIndex];
    if (!group) return;
    moveItemInArray(group, event.previousIndex, event.currentIndex);
    this.commitGroups(typeKey, groups);
  }

  /** Pull a slot out of its group into a new single-slot group
   *  immediately above the source group. Triggered by × on a tab. */
  ungroupTab(typeKey: string, groupIndex: number, slotId: string | undefined): void {
    if (!slotId) return;
    const groups = this.groupsFor(typeKey).map(g => [...g]);
    const src = groups[groupIndex];
    if (!src || !src.includes(slotId)) return;
    const remaining = src.filter(s => s !== slotId);
    const next: string[][] = [];
    groups.forEach((g, i) => {
      if (i === groupIndex) {
        next.push([slotId]);
        if (remaining.length) next.push(remaining);
      } else {
        next.push(g);
      }
    });
    this.commitGroups(typeKey, next);
  }

  private commitGroups(typeKey: string, groups: string[][]): void {
    this.groupsState.update(m => ({ ...m, [typeKey]: groups }));
    try { localStorage.setItem('lbfw-groups:' + typeKey, JSON.stringify(groups)); }
    catch { /* swallow */ }
  }

  // ── Live drop-target highlight ────────────────────────────────────
  // Same pattern as receipt-builder: while a widget drag is in
  // flight, hit-test the cursor against sibling widget headers and
  // toggle a `--drop-target` class so the user sees which header
  // would receive a merge.
  private lastDropTarget: HTMLElement | null = null;

  onWidgetDragMoved(event: CdkDragMove): void {
    const point = event.pointerPosition;
    const header = this.findHeaderAt(point);
    if (header === this.lastDropTarget) return;
    if (this.lastDropTarget) this.lastDropTarget.classList.remove('rbfw__header--drop-target');
    if (header) header.classList.add('rbfw__header--drop-target');
    this.lastDropTarget = header;
  }
  onWidgetDragEnded(): void {
    if (this.lastDropTarget) {
      this.lastDropTarget.classList.remove('rbfw__header--drop-target');
      this.lastDropTarget = null;
    }
  }

  /** Hit-test `elementsFromPoint` for a sibling widget header. Skips
   *  the dragged element's own preview / placeholder so a widget
   *  can't be merged into itself. */
  private findHeaderAt(point: { x: number; y: number }): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const stack = document.elementsFromPoint(point.x, point.y) as HTMLElement[];
    for (const el of stack) {
      if (el.closest('.cdk-drag-preview')) continue;
      if (el.closest('.cdk-drag-placeholder')) continue;
      const header = el.closest<HTMLElement>('.rbfw__header');
      if (header) return header;
    }
    return null;
  }

  /** Translate a hovered header DOM node back to its group index. */
  private hitTestHeader(point: { x: number; y: number }): number | null {
    const header = this.findHeaderAt(point);
    if (!header) return null;
    const slot = header.closest<HTMLElement>('[data-lbfw-gi]');
    const giAttr = slot?.getAttribute('data-lbfw-gi');
    if (!giAttr) return null;
    const gi = parseInt(giAttr, 10);
    return Number.isFinite(gi) ? gi : null;
  }

  trackGroup = (_: number, group: string[]) => group.join('|');

  // ─── Single-widget compatibility shim ────────────────────────────
  // The template still uses one `app-rbf-widget` with a flat tab list
  // — `tabsForSelected()` returns the slots flattened across every
  // group, and `activeInspectorTab` is the single active slot id.
  // The new groups state machine sits underneath waiting for the
  // template to be migrated to render per-group widgets. This shim
  // keeps the existing UI working in the meantime.
  activeInspectorTab = signal<string>('properties');

  tabsForSelected = computed<{ id: string; title: string }[]>(() => {
    const typeKey = this.inspectorTypeKey();
    const groups = this.groupsFor(typeKey);
    const slots = groups.flat();
    return slots.map(id => ({
      id,
      title: this.translate.instant(this.slotTitleKey[id] ?? id),
    }));
  });

  /** Reset the active tab whenever the selection changes so the
   *  user always lands on the first relevant slot. */
  private syncActiveTabToSelection = effect(() => {
    const tabs = this.tabsForSelected();
    if (!tabs.length) return;
    const current = this.activeInspectorTab();
    if (!tabs.some(t => t.id === current)) {
      this.activeInspectorTab.set(tabs[0].id);
    }
  });

  /** Type-narrowing helpers used by the template's @switch blocks
   *  to keep the per-type inspector panels strongly typed. */
  asTextBox       = (e: LabelElement | null) => e as ZplTextBox | null;
  asBarcode       = (e: LabelElement | null) => e as ZplBarcode | null;
  asQrCode        = (e: LabelElement | null) => e as ZplQrCode | null;
  asRectangle     = (e: LabelElement | null) => e as ZplRectangle | null;
  asCircle        = (e: LabelElement | null) => e as ZplCircle | null;
  asHorizontal    = (e: LabelElement | null) => e as ZplHorizontalLine | null;
  asVertical      = (e: LabelElement | null) => e as ZplVerticalLine | null;
  asImage         = (e: LabelElement | null) => e as ZplImageElement | null;
  asLogo          = (e: LabelElement | null) => e as ZplLogoElement | null;

  trackByIndex = (i: number) => i;

  // ─── Photoshop-style Transform / Align ───────────────────────────
  // Returns the rendered W/H (canvas px) of an element, regardless of
  // type. Lets the Properties panel show a unified W/H field even
  // though every element class stores its size differently (Textbox =
  // computed from font; lines = `width`/`height` + `thick`; circle =
  // `circleDiameter`; barcode = `height` only with type-derived width).
  /** Effective on-canvas width, in px. Optionally takes an `idx`
   *  so the helper can read the live `offsetWidth` from the canvas
   *  DOM — matters for Barcode (auto-fits to data length) and
   *  Textbox (depends on font / glyph metrics). Without `idx` the
   *  caller gets a model-derived estimate. */
  elementWidth(e: LabelElement | null | undefined, idx?: number): number {
    return this.elWidth(e, idx);
  }

  /** Effective on-canvas height, in px. Same DOM-aware contract
   *  as `elementWidth`. */
  elementHeight(e: LabelElement | null | undefined, idx?: number): number {
    return this.elHeight(e, idx);
  }

  /** Index of an element on the active template, or `null` when
   *  it isn't present. Used by the align / distribute helpers to
   *  thread the DOM-aware size lookup through. */
  private indexOfElement(e: LabelElement): number | null {
    const list = this.template().template;
    const i = list.indexOf(e);
    return i >= 0 ? i : null;
  }

  /** True for types whose W and H can both be set. Drives the chain-
   *  link aspect-lock toggle's enabled state — Textbox/Barcode/QR/
   *  Circle scale via single fields, so the chain is hidden there. */
  resizableBoth(e: LabelElement | null | undefined): boolean {
    return !!e && (e.type === 'Rectangle' || e.type === 'Image' || e.type === 'Logo');
  }

  /** Whether the W input on the Photoshop XY grid is editable for
   *  this element type. Textbox/Barcode/QR/Circle auto-derive their
   *  width from another field (font, data length, factor, diameter)
   *  so letting the user type into W there is misleading. */
  canEditWidth(e: LabelElement | null | undefined): boolean {
    if (!e) return false;
    return e.type === 'Rectangle' || e.type === 'Image' || e.type === 'Logo'
        || e.type === 'HorizontalLine';
  }

  /** Whether the H input on the Photoshop XY grid is editable. */
  canEditHeight(e: LabelElement | null | undefined): boolean {
    if (!e) return false;
    return e.type === 'Rectangle' || e.type === 'Image' || e.type === 'Logo'
        || e.type === 'VerticalLine' || e.type === 'Barcode';
  }

  /** Lock-aspect chain. When on, editing W or H also scales the
   *  other axis to keep the original ratio. */
  aspectLocked = signal<boolean>(false);
  toggleAspectLock(): void { this.aspectLocked.set(!this.aspectLocked()); }

  /** Patch the width of the selected element. For types that don't
   *  expose a width field directly (Circle uses diameter, Textbox is
   *  derived) the call falls through with no effect — UI hides the
   *  field for those anyway. */
  setElementWidth(value: number): void {
    const el = this.selectedElement();
    if (!el) return;
    const w = Math.max(1, Math.round(+value || 0));
    const oldW = this.elementWidth(el);
    const oldH = this.elementHeight(el);
    const ratio = (oldW > 0 && oldH > 0) ? (oldH / oldW) : 1;
    switch (el.type) {
      case 'Rectangle':
      case 'Image':
      case 'Logo':
        this.patchElement('width', w);
        if (this.aspectLocked() && this.resizableBoth(el)) {
          this.patchElement('height', Math.max(1, Math.round(w * ratio)));
        }
        break;
      case 'HorizontalLine':
        this.patchElement('width', w); break;
      case 'Circle':
        this.patchElement('circleDiameter', w); break;
    }
  }

  setElementHeight(value: number): void {
    const el = this.selectedElement();
    if (!el) return;
    const h = Math.max(1, Math.round(+value || 0));
    const oldW = this.elementWidth(el);
    const oldH = this.elementHeight(el);
    const ratio = (oldW > 0 && oldH > 0) ? (oldW / oldH) : 1;
    switch (el.type) {
      case 'Rectangle':
      case 'Image':
      case 'Logo':
        this.patchElement('height', h);
        if (this.aspectLocked() && this.resizableBoth(el)) {
          this.patchElement('width', Math.max(1, Math.round(h * ratio)));
        }
        break;
      case 'VerticalLine':
        this.patchElement('height', h); break;
      case 'Barcode':
        this.patchElement('height', h); break;
      case 'Circle':
        this.patchElement('circleDiameter', h); break;
    }
  }

  setElementX(value: number): void { this.patchElementPath('position.x', Math.max(0, Math.round(+value || 0))); }
  setElementY(value: number): void { this.patchElementPath('position.y', Math.max(0, Math.round(+value || 0))); }

  /** Indices the Align/Distribute actions should affect — multi-
   *  selection if 2+ are picked, else just the focused element. */
  private alignTargets(): number[] {
    const sel = this.selectedIndices();
    if (sel.size > 1) return Array.from(sel);
    const i = this.selectedIndex();
    return i === null ? [] : [i];
  }

  /** Multi-select align/distribute predicates for the segmented
   *  buttons — distribute needs 3+ targets, the rest only need 1+. */
  hasAlignTargets   = computed<boolean>(() => this.alignTargets().length >= 1);
  hasDistribTargets = computed<boolean>(() => this.alignTargets().length >= 3);

  /** Align relative to the canvas (or to the bounding box of the
   *  multi-selection if 2+ targets). Mirrors Photoshop's Align panel:
   *  with one target it aligns to the document; with 2+ it aligns
   *  the targets among themselves to the leader's edge. */
  alignTo(edge: 'left' | 'h-center' | 'right' | 'top' | 'v-center' | 'bottom'): void {
    const idxs = this.alignTargets();
    if (idxs.length === 0) return;
    const t = this.template();
    const els = idxs.map(i => t.template[i]).filter(Boolean) as LabelElement[];
    if (!els.length) return;

    // Bounds we align to: canvas if 1 target, else the selection bbox.
    let refLeft = 0, refTop = 0, refRight = 0, refBottom = 0;
    if (els.length === 1) {
      refLeft = 0; refTop = 0;
      refRight  = this.canvasPx().width;
      refBottom = this.canvasPx().height;
    } else {
      refLeft   = Math.min(...els.map(e => e.position.x));
      refTop    = Math.min(...els.map(e => e.position.y));
      refRight  = Math.max(...idxs.map((i, k) => els[k].position.x + this.elementWidth(els[k], i)));
      refBottom = Math.max(...idxs.map((i, k) => els[k].position.y + this.elementHeight(els[k], i)));
    }

    this.pushUndo();
    for (let k = 0; k < els.length; k++) {
      const el = els[k];
      const i  = idxs[k];
      const w = this.elementWidth(el,  i);
      const h = this.elementHeight(el, i);
      switch (edge) {
        case 'left':     el.position.x = Math.round(refLeft); break;
        case 'right':    el.position.x = Math.round(refRight - w); break;
        case 'h-center': el.position.x = Math.round(refLeft + (refRight  - refLeft - w) / 2); break;
        case 'top':      el.position.y = Math.round(refTop); break;
        case 'bottom':   el.position.y = Math.round(refBottom - h); break;
        case 'v-center': el.position.y = Math.round(refTop + (refBottom - refTop  - h) / 2); break;
      }
    }
    this.markDirty();
  }

  /** Distribute spacing — equalise gaps between target edges along
   *  the chosen axis. Needs 3+ targets to be meaningful (with 2 the
   *  outer two are already the bounds). */
  distribute(axis: 'h' | 'v'): void {
    const idxs = this.alignTargets();
    if (idxs.length < 3) return;
    const t = this.template();
    const els = idxs.map(i => t.template[i]).filter(Boolean) as LabelElement[];
    if (els.length < 3) return;

    this.pushUndo();
    if (axis === 'h') {
      const sorted = [...els].sort((a, b) => a.position.x - b.position.x);
      const left   = sorted[0].position.x;
      const last   = sorted[sorted.length - 1];
      const right  = last.position.x + this.elementWidth(last);
      const innerW = sorted.slice(1, -1).reduce((s, e) => s + this.elementWidth(e), 0);
      const totalW = right - left;
      const totalElW = sorted.reduce((s, e) => s + this.elementWidth(e), 0);
      const gap = (totalW - totalElW) / (sorted.length - 1);
      let cursor = left + this.elementWidth(sorted[0]) + gap;
      for (let i = 1; i < sorted.length - 1; i++) {
        sorted[i].position.x = Math.round(cursor);
        cursor += this.elementWidth(sorted[i]) + gap;
      }
      void innerW;
    } else {
      const sorted = [...els].sort((a, b) => a.position.y - b.position.y);
      const top    = sorted[0].position.y;
      const last   = sorted[sorted.length - 1];
      const bottom = last.position.y + this.elementHeight(last);
      const totalH = bottom - top;
      const totalElH = sorted.reduce((s, e) => s + this.elementHeight(e), 0);
      const gap = (totalH - totalElH) / (sorted.length - 1);
      let cursor = top + this.elementHeight(sorted[0]) + gap;
      for (let i = 1; i < sorted.length - 1; i++) {
        sorted[i].position.y = Math.round(cursor);
        cursor += this.elementHeight(sorted[i]) + gap;
      }
    }
    this.markDirty();
  }

  /** Centre the focused element on the canvas — Photoshop's "centre
   *  on document" shortcut, exposed as a single button on the panel. */
  centerOnCanvas(): void {
    const el = this.selectedElement();
    if (!el) return;
    const idx = this.selectedIndex();
    this.pushUndo();
    const cw = this.canvasPx().width;
    const ch = this.canvasPx().height;
    el.position.x = Math.round((cw - this.elementWidth(el,  idx ?? undefined)) / 2);
    el.position.y = Math.round((ch - this.elementHeight(el, idx ?? undefined)) / 2);
    this.markDirty();
  }

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }
}
