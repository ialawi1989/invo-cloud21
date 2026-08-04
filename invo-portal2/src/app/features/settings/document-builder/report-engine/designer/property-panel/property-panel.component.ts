import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DesignerStateService } from '../../services/designer-state.service';
import { blockRegistry, PropertyGroup } from '../../core/registry/block-registry';
import {
  Block,
  BlockType,
  ColumnWidth,
  PAYMENT_COLUMN_CATALOG,
  DEFAULT_PAYMENT_COLUMNS,
  PaymentColumnId,
} from '../../core/types/block.types';
import { BlockStyle } from '../../core/types/style.types';
import { Orientation, PageMargins, PaperSize } from '../../core/types/template.types';
import { BindingPickerService } from '../../services/binding-picker.service';
import { BindingDialogComponent } from '../binding-dialog/binding-dialog.component';
import { DesignerColorPickerComponent } from '../style-controls/designer-color-picker.component';
import { AlignmentButtonsComponent } from '../style-controls/alignment-buttons.component';
import { FontStyleButtonsComponent } from '../style-controls/font-style-buttons.component';
import { NgSelectModule } from '@ng-select/ng-select';

type VisibleEval = { kind: 'ok'; truthy: boolean; display: string } | { kind: 'error'; message: string };

type RowVisibleEval = { kind: 'ok'; matched: number; total: number } | { kind: 'error'; message: string };

type ExprValidation = { kind: 'empty' } | { kind: 'ok'; display: string } | { kind: 'error'; message: string };

type WatermarkKind = 'none' | 'text' | 'image';

/**
 * Right rail. Shows one fieldset per property group declared by the selected
 * block's BlockDefinition, or page settings when nothing is selected.
 *
 * Every edit routes through DesignerStateService so HistoryService records it
 * — nothing mutates a block in place.
 *
 * Multi-select currently shows nothing; per-type editors (table columns,
 * totals rows) need a single selection to be meaningful, and the common
 * subset alone isn't worth a separate mode.
 */
@Component({
  selector: 'app-designer-property-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    BindingDialogComponent,
    DesignerColorPickerComponent,
    AlignmentButtonsComponent,
    FontStyleButtonsComponent,
  ],
  templateUrl: './property-panel.component.html',
  styleUrls: ['./property-panel.component.scss'],
})
export class PropertyPanelComponent {
  /** Public so the page-settings branch of the template can call state
   *  methods directly instead of going through proxy methods here. */
  readonly state = inject(DesignerStateService);

  /** Owns the binding dialog's open/close and text insertion. Each
   *  expression input pairs with a small fx button calling `openFor(ref)`. */
  readonly picker = inject(BindingPickerService);

  constructor() {
    // Keep the binding picker's implicit row-source aligned with the
    // selection. When the selected block is a repeater child, every
    // expression input opened from this panel should surface `row.x` paths
    // from the parent's dataSource — that's the context the child actually
    // renders in.
    effect(() => {
      const selected = this.state.selectedBlocks();
      if (selected.length !== 1) {
        this.picker.setDefaultRowSource(null);
        return;
      }
      const parent = this.state.findBlock(selected[0].id)?.parent;
      this.picker.setDefaultRowSource(parent?.type === 'repeater' ? parent.dataSource : null);
    });
  }

  // ─── Static option lists ────────────────────────────────────────

  readonly PAPER_SIZES: PaperSize[] = ['A3', 'A4', 'A5', 'Letter', 'Legal', 'Thermal80', 'Thermal58', 'Custom'];
  readonly WATERMARK_KINDS: WatermarkKind[] = ['none', 'text', 'image'];
  readonly IMAGE_FITS = ['contain', 'cover', 'fill', 'none'] as const;
  readonly BARCODE_SYMBOLOGIES = ['code128', 'code39', 'ean13', 'ean8', 'upca', 'qrcode', 'datamatrix'] as const;
  readonly BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double'] as const;
  readonly PAYMENT_COLUMN_CATALOG = PAYMENT_COLUMN_CATALOG;

  readonly DIVIDER_PATTERNS = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
  ] as const;

  /** Block alignment includes `justify`, which the shared
   *  app-alignment-buttons component doesn't model — hence a local
   *  segmented control styled to match it. */
  readonly ALIGNMENTS = [
    { value: 'left', label: 'Align left', icon: 'mdi-format-align-left' },
    { value: 'center', label: 'Align center', icon: 'mdi-format-align-center' },
    { value: 'right', label: 'Align right', icon: 'mdi-format-align-right' },
    { value: 'justify', label: 'Justify', icon: 'mdi-format-align-justify' },
  ] as const;

  /** Table columns don't support justify. */
  readonly ALIGNMENTS_3 = this.ALIGNMENTS.slice(0, 3);

  /** Blocks offered by the repeater's "Add child" grid. Leaf blocks only —
   *  containers (table, nested repeater) inside a card aren't supported by
   *  the renderers. */
  readonly REPEATER_CHILD_KINDS: ReadonlyArray<{ type: BlockType; label: string; icon: string }> = [
    { type: 'text', label: 'Text', icon: 'mdi-format-text' },
    { type: 'rich-text', label: 'Rich', icon: 'mdi-format-color-text' },
    { type: 'image', label: 'Image', icon: 'mdi-image-outline' },
    { type: 'dynamic-field', label: 'Field', icon: 'mdi-function-variant' },
    { type: 'line', label: 'Line', icon: 'mdi-minus' },
    { type: 'rectangle', label: 'Rect', icon: 'mdi-rectangle-outline' },
    { type: 'divider', label: 'Divider', icon: 'mdi-drag-horizontal-variant' },
    { type: 'qr-code', label: 'QR', icon: 'mdi-qrcode' },
    { type: 'barcode', label: 'Barcode', icon: 'mdi-barcode' },
  ];

  // ─── Selection / template ───────────────────────────────────────

  readonly template = this.state.template;

  readonly block = computed<Block | null>(() => {
    const sel = this.state.selectedBlocks();
    return sel.length === 1 ? sel[0] : null;
  });

  readonly groups = computed<ReadonlySet<PropertyGroup>>(() => {
    const b = this.block();
    if (!b) return new Set<PropertyGroup>();
    return new Set<PropertyGroup>(blockRegistry.get(b.type)?.propertyGroups ?? []);
  });

  hasGroup(g: PropertyGroup): boolean {
    return this.groups().has(g);
  }

  readonly headerHeight = computed<number>(
    () => this.template()?.sections.find((s) => s.type === 'page-header')?.height ?? 0,
  );
  readonly footerHeight = computed<number>(
    () => this.template()?.sections.find((s) => s.type === 'page-footer')?.height ?? 0,
  );

  /** Theme colors surfaced as one-click swatches above every color input, so
   *  authors stay on-palette without memorising hex codes.
   *
   *  Snapshot semantics: clicking writes the resolved hex into the block, so
   *  changing the theme later does NOT recolor existing blocks. */
  readonly themeSwatches = computed<Array<{ label: string; color: string }>>(() => {
    const theme = this.template()?.theme;
    if (!theme) return [];
    const slots: Array<[string, string | undefined]> = [
      ['Primary', theme.primaryColor],
      ['On primary', theme.onPrimaryColor],
      ['Accent', theme.accentColor],
      ['Text', theme.textColor],
      ['Muted', theme.mutedColor],
      ['Surface', theme.surfaceColor],
    ];
    return slots
      .filter((s): s is [string, string] => !!s[1])
      .map(([label, color]) => ({ label, color }));
  });

  // Bound appliers for the shared `swatchRow` template. Arrow properties so
  // `this` survives being passed through ngTemplateOutlet context — one
  // markup block then serves every color slot instead of six copies.
  readonly applyFontColor = (color: string, b: Block): void => this.setFont(b, 'color', color);
  readonly applyBackground = (color: string, b: Block): void => this.setStyle(b, 'background', color);
  readonly applyBorderColor = (color: string, b: Block): void => this.setUniformBorder(b, 'color', color);
  readonly applyDividerColor = (color: string, b: Block): void => this.patchTyped(b, { color });
  readonly applyPageBackground = (color: string): void => this.state.setPageBackground(color);

  // ─── Link toggles ───────────────────────────────────────────────

  /** When on, editing one margin writes all four sides. */
  readonly linkMargins = signal(false);
  /** Same, for block padding. */
  readonly linkPadding = signal(false);

  // ─── Watermark ──────────────────────────────────────────────────

  /** Pinned mode, kept separately from the data because "Image" mode with no
   *  image yet still has to show the upload button. Content in the template
   *  wins once it exists. */
  private readonly _watermarkKind = signal<WatermarkKind>('none');

  readonly watermarkKind = computed<WatermarkKind>(() => {
    const wm = this.template()?.page.watermark;
    if (wm?.image) return 'image';
    if (wm?.text) return 'text';
    return this._watermarkKind();
  });

  readonly watermarkOpacityPct = computed<number>(() =>
    Math.round((this.template()?.page.watermark?.opacity ?? 0.08) * 100),
  );

  setWatermarkKind(kind: WatermarkKind): void {
    this._watermarkKind.set(kind);
    if (kind === 'none') {
      this.state.updatePage({ watermark: undefined });
    } else if (kind === 'text') {
      // Drop the image; keep text/opacity/rotation if already set.
      this.state.patchWatermark({ image: undefined });
    } else {
      this.state.patchWatermark({ text: undefined });
    }
  }

  /** Store the chosen image as a data URL so both renderers can draw the
   *  watermark without a network fetch. */
  onWatermarkImageUpload(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) this.state.patchWatermark({ image: dataUrl });
    };
    reader.readAsDataURL(file);
    // Reset so re-picking the same file fires `change` again.
    input.value = '';
  }

  // ─── Live expression evaluation ─────────────────────────────────
  // These drive the inline ✓/⚠ feedback under expression inputs, so authors
  // can debug bindings without opening DevTools or exporting.

  /** Shared engine, so host-provided `extraFilters` apply to previews too. */
  private readonly previewBinding = computed(() => this.state.bindingEngine());

  readonly visibleWhenEval = computed<VisibleEval | null>(() => {
    const b = this.block();
    const t = this.template();
    if (!b?.visibleWhen || !t) return null;
    try {
      const ctx = this.previewBinding().createRoot((t.sampleData ?? {}) as Record<string, unknown>, t.locale, {});
      const v = this.previewBinding().evaluate(b.visibleWhen, ctx);
      return { kind: 'ok', truthy: Boolean(v), display: this.displayValue(v) };
    } catch (e) {
      return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  });

  /** Evaluate a Table/Payments `rowVisibleWhen` against every sample row and
   *  report the match count, so the filter can be tuned without exporting. */
  readonly rowVisibleWhenEval = computed<RowVisibleEval | null>(() => {
    const b = this.block();
    if (!b || (b.type !== 'table' && b.type !== 'payments')) return null;
    if (!b.rowVisibleWhen) return null;
    const t = this.template();
    if (!t) return null;
    try {
      const engine = this.previewBinding();
      const ctx = engine.createRoot((t.sampleData ?? {}) as Record<string, unknown>, t.locale, {});
      const rows = engine.resolveArray(b.dataSource ?? '', ctx);
      let matched = 0;
      for (let i = 0; i < rows.length; i++) {
        const rowCtx = engine.withRow(ctx, rows[i] as Record<string, unknown>, i);
        // evaluate(), not isTruthy() — parse errors must surface to the user
        // rather than being coerced into "0 matched".
        if (engine.evaluate(b.rowVisibleWhen, rowCtx)) matched++;
      }
      return { kind: 'ok', matched, total: rows.length };
    } catch (e) {
      return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  });

  /**
   * Validate any expression against the sample data, optionally scoped to
   * the first row of `dataSource`. Called per-input from the template, so it
   * has to stay cheap — the evaluator caches parsed ASTs by source, which
   * makes repeated calls on unchanged text nearly free.
   */
  validateExpr(expression: string | undefined, dataSource?: string): ExprValidation {
    if (!expression?.trim()) return { kind: 'empty' };
    const t = this.template();
    if (!t) return { kind: 'empty' };
    try {
      const engine = this.previewBinding();
      const root = engine.createRoot((t.sampleData ?? {}) as Record<string, unknown>, t.locale, {});
      let ctx = root;
      if (dataSource) {
        const arr = engine.resolveArray(dataSource, root);
        if (arr.length > 0) ctx = engine.withRow(root, arr[0] as Record<string, unknown>, 0);
      }
      return { kind: 'ok', display: this.displayValue(engine.evaluateCell(expression, ctx), 40) };
    } catch (e) {
      return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Render an evaluated value for inline feedback — strings quoted (and
   *  optionally truncated) so "" is distinguishable from null. */
  private displayValue(v: unknown, truncateAt?: number): string {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v !== 'string') return String(v);
    const s = truncateAt && v.length > truncateAt ? `${v.slice(0, truncateAt - 3)}…` : v;
    return `"${s}"`;
  }

  // ─── Page settings ──────────────────────────────────────────────

  onPaperSize(size: PaperSize): void {
    this.state.setPaperSize(size);
  }

  setOrientation(o: Orientation): void {
    this.state.setOrientation(o);
  }

  setMargin(side: keyof PageMargins, value: number): void {
    if (this.linkMargins()) {
      const v = Math.max(0, Number(value) || 0);
      this.state.updatePage({ margins: { top: v, right: v, bottom: v, left: v } });
    } else {
      this.state.setPageMargin(side, value);
    }
  }

  // ─── Position / size ────────────────────────────────────────────

  /**
   * Display rounding for the mm/pt number inputs. Page resizing keeps block
   * geometry at full precision so it round-trips exactly (A4 → A5 → A4 lands
   * back on 15mm, not 14.99mm) — the cost is values like 15.000000000000004,
   * which belong nowhere near a spinner. Two decimals is finer than anyone
   * positions by hand; typing in the field still writes the exact value.
   */
  disp(value: number | undefined | null, decimals = 2): number {
    const n = Number(value ?? 0);
    const p = Math.pow(10, decimals);
    return Math.round(n * p) / p;
  }

  setPos(b: Block, axis: 'x' | 'y', value: number): void {
    this.state.patchBlock(b.id, (cur) => ({
      ...cur,
      position: { ...cur.position, [axis]: Number(value) || 0 },
    }));
  }

  setSize(b: Block, axis: 'width' | 'height', value: number): void {
    this.state.patchBlock(b.id, (cur) => ({
      ...cur,
      size: { ...cur.size, [axis]: Math.max(1, Number(value) || 1) },
    }));
  }

  setAutoHeight(b: Block, on: boolean): void {
    this.state.patchBlock(b.id, (cur) => ({ ...cur, size: { ...cur.size, autoHeight: on } }));
  }

  // ─── Style ──────────────────────────────────────────────────────

  setStyle(b: Block, key: keyof BlockStyle, value: unknown): void {
    this.state.patchBlock(b.id, (cur) => ({
      ...cur,
      style: { ...(cur.style ?? {}), [key]: value } as BlockStyle,
    }));
  }

  setFont<K extends keyof NonNullable<BlockStyle['font']>>(
    b: Block,
    key: K,
    value: NonNullable<BlockStyle['font']>[K],
  ): void {
    this.state.patchBlock(b.id, (cur) => ({
      ...cur,
      style: { ...(cur.style ?? {}), font: { ...(cur.style?.font ?? {}), [key]: value } },
    }));
  }

  /** Write all four border sides at once. The panel only exposes a uniform
   *  border; per-side control would need four times the UI for a case
   *  invoice layouts almost never need. */
  setUniformBorder(b: Block, key: 'width' | 'color' | 'style', value: unknown): void {
    this.state.patchBlock(b.id, (cur) => {
      const existing = cur.style?.border ?? {};
      const side = existing.top ??
        existing.right ??
        existing.bottom ??
        existing.left ?? { width: 0.5, color: '#cbd5e1', style: 'solid' as const };
      const updated = { ...side, [key]: key === 'width' ? Number(value) || 0 : value };
      return {
        ...cur,
        style: {
          ...(cur.style ?? {}),
          border: { ...existing, top: updated, right: updated, bottom: updated, left: updated },
        },
      };
    });
  }

  borderWidth(): number {
    const side = this.borderSide();
    return side?.width ?? 0;
  }

  borderColor(): string {
    return this.borderSide()?.color ?? '#cbd5e1';
  }

  borderStyleVal(): string {
    return this.borderSide()?.style ?? 'solid';
  }

  private borderSide() {
    const b = this.block();
    return b?.style?.border?.top ?? b?.style?.border?.left;
  }

  setPadding(b: Block, side: 'top' | 'right' | 'bottom' | 'left', value: number): void {
    const v = Math.max(0, Number(value) || 0);
    this.state.patchBlock(b.id, (cur) => ({
      ...cur,
      style: {
        ...(cur.style ?? {}),
        padding: this.linkPadding()
          ? { top: v, right: v, bottom: v, left: v }
          : { ...(cur.style?.padding ?? {}), [side]: v },
      },
    }));
  }

  /** True when the font weight renders bold — covers both the string
   *  `'bold'` and numeric weights ≥ 600. */
  isBold(b: Block): boolean {
    const w = b.style?.font?.weight;
    return w === 'bold' || (typeof w === 'number' && w >= 600);
  }

  setBold(b: Block, on: boolean): void {
    this.setFont(b, 'weight', on ? 'bold' : 'normal');
  }

  setItalic(b: Block, on: boolean): void {
    this.setFont(b, 'italic', on);
  }

  setUnderline(b: Block, on: boolean): void {
    this.setFont(b, 'underline', on);
  }

  // ─── Visibility / lock ──────────────────────────────────────────

  setVisibleWhen(b: Block, value: string): void {
    this.state.patchBlock(b.id, (cur) => ({ ...cur, visibleWhen: value || undefined }));
  }

  setLocked(b: Block, on: boolean): void {
    this.state.patchBlock(b.id, (cur) => ({ ...cur, locked: on }));
  }

  // ─── Generic typed patch ────────────────────────────────────────

  patchTyped(b: Block, patch: Record<string, unknown>): void {
    this.state.patchBlock(b.id, (cur) => ({ ...cur, ...patch } as Block));
  }

  /** Coerce + clamp divider thickness; templates can't call Number(). */
  setDividerThickness(b: Block, value: unknown): void {
    const n = Number(value);
    this.patchTyped(b, { thickness: Math.max(0.1, Number.isFinite(n) ? n : 0.5) });
  }

  // ─── Repeater ───────────────────────────────────────────────────

  addRepeaterChild(parentId: string, type: BlockType): void {
    // (2,2) rather than the exact corner so the new child is visible without
    // clipping against the card's border.
    this.state.addChildBlock(parentId, type, 2, 2);
  }

  /** Card height writes BOTH `itemHeight` (read by the renderers and the
   *  pagination engine) and `size.height` (the on-canvas template card), so
   *  editing here matches dragging the resize handle. */
  setRepeaterItemHeight(b: Block, h: number): void {
    if (b.type !== 'repeater') return;
    const value = Number.isFinite(h) && h > 0 ? h : b.itemHeight;
    this.state.patchBlock(b.id, (cur) =>
      cur.type !== 'repeater' ? cur : { ...cur, itemHeight: value, size: { ...cur.size, height: value } },
    );
  }

  // ─── Payments columns ───────────────────────────────────────────

  paymentHasColumn(b: Block, id: PaymentColumnId): boolean {
    if (b.type !== 'payments') return false;
    return (b.columns ?? DEFAULT_PAYMENT_COLUMNS).includes(id);
  }

  /** Toggle a column. The stored array is canonicalised to catalog order, so
   *  re-enabling a column puts it back in its natural position rather than
   *  appending it to the end. */
  togglePaymentColumn(b: Block, id: PaymentColumnId, on: boolean): void {
    if (b.type !== 'payments') return;
    const current = new Set<PaymentColumnId>(b.columns ?? DEFAULT_PAYMENT_COLUMNS);
    if (on) current.add(id);
    else current.delete(id);
    this.patchTyped(b, { columns: PAYMENT_COLUMN_CATALOG.filter((c) => current.has(c.id)).map((c) => c.id) });
  }

  // ─── Table columns ──────────────────────────────────────────────

  updateColumn(b: Block, idx: number, patch: Record<string, unknown>): void {
    this.patchTable(b, (cur) => {
      const cols = cur.columns.slice();
      cols[idx] = { ...cols[idx], ...patch };
      return { ...cur, columns: cols };
    });
  }

  removeColumn(b: Block, idx: number): void {
    this.patchTable(b, (cur) => ({ ...cur, columns: cur.columns.filter((_, i) => i !== idx) }));
  }

  /** Switch a column's width kind, preserving its numeric value where the
   *  new kind has one. Defaults: fixed 20mm, fraction 1fr. */
  setColumnWidthKind(b: Block, idx: number, kind: 'fixed' | 'fraction' | 'auto'): void {
    this.patchTable(b, (cur) => {
      const col = cur.columns[idx];
      if (!col) return cur;
      let width: ColumnWidth;
      if (kind === 'fixed') width = { kind: 'fixed', mm: col.width.kind === 'fixed' ? col.width.mm : 20 };
      else if (kind === 'fraction') width = { kind: 'fraction', fr: col.width.kind === 'fraction' ? col.width.fr : 1 };
      else width = { kind: 'auto' };
      const cols = cur.columns.slice();
      cols[idx] = { ...col, width };
      return { ...cur, columns: cols };
    });
  }

  /** Update a sized column's numeric value. No-op on `auto` columns, which
   *  have no numeric slot. */
  setColumnWidthValue(b: Block, idx: number, value: number): void {
    this.patchTable(b, (cur) => {
      const col = cur.columns[idx];
      if (!col) return cur;
      let width: ColumnWidth;
      if (col.width.kind === 'fixed') width = { kind: 'fixed', mm: Math.max(1, Number(value) || 1) };
      else if (col.width.kind === 'fraction') width = { kind: 'fraction', fr: Math.max(0.1, Number(value) || 1) };
      else return cur;
      const cols = cur.columns.slice();
      cols[idx] = { ...col, width };
      return { ...cur, columns: cols };
    });
  }

  /** Shift a column by ±1. No-op at the array bounds. */
  moveColumn(b: Block, idx: number, delta: number): void {
    this.patchTable(b, (cur) => {
      const target = idx + delta;
      if (target < 0 || target >= cur.columns.length) return cur;
      const cols = cur.columns.slice();
      const [moved] = cols.splice(idx, 1);
      cols.splice(target, 0, moved);
      return { ...cur, columns: cols };
    });
  }

  addColumn(b: Block): void {
    this.patchTable(b, (cur) => {
      // Inherit styling from the last column so a new one doesn't stand out
      // unstyled beside the existing header band. Per-column overrides are
      // still available afterwards.
      const tmpl = cur.columns[cur.columns.length - 1];
      return {
        ...cur,
        columns: [
          ...cur.columns,
          {
            id: `c_${Math.random().toString(36).slice(2, 8)}`,
            header: 'New',
            expression: 'row.value',
            width: { kind: 'fraction', fr: 1 } as ColumnWidth,
            align: tmpl?.align,
            headerStyle: tmpl?.headerStyle,
            cellStyle: tmpl?.cellStyle,
          },
        ],
      };
    });
  }

  // ─── Table grouping ─────────────────────────────────────────────
  // Single-level only, matching the renderers — they read groups[0].

  hasGrouping(b: Block): boolean {
    return b.type === 'table' && !!b.groups && b.groups.length > 0;
  }

  groupBy(b: Block): string {
    return b.type === 'table' ? b.groups?.[0]?.by ?? '' : '';
  }

  groupHeader(b: Block): string {
    return b.type === 'table' ? b.groups?.[0]?.headerExpression ?? '' : '';
  }

  groupFooter(b: Block): string {
    return b.type === 'table' ? b.groups?.[0]?.footerExpression ?? '' : '';
  }

  groupShowHeader(b: Block): boolean {
    return b.type === 'table' ? b.groups?.[0]?.showHeader ?? true : false;
  }

  groupShowFooter(b: Block): boolean {
    return b.type === 'table' ? b.groups?.[0]?.showFooter ?? false : false;
  }

  toggleGrouping(b: Block, on: boolean): void {
    this.patchTable(b, (cur) => {
      if (on) {
        return {
          ...cur,
          groups:
            cur.groups && cur.groups.length > 0
              ? cur.groups
              : [{ by: 'row.category', headerExpression: '{{group.key}}', showHeader: true, showFooter: false }],
        };
      }
      const { groups: _drop, ...rest } = cur;
      return rest as typeof cur;
    });
  }

  /** Patch one field on the first group. No-op when grouping is off, so
   *  turning it back on later doesn't resurrect stale partial values. */
  setGroup(
    b: Block,
    key: 'by' | 'headerExpression' | 'footerExpression' | 'showHeader' | 'showFooter',
    value: unknown,
  ): void {
    this.patchTable(b, (cur) => {
      if (!cur.groups || cur.groups.length === 0) return cur;
      const next = [...cur.groups];
      next[0] = { ...next[0], [key]: value };
      return { ...cur, groups: next };
    });
  }

  // ─── Totals rows ────────────────────────────────────────────────

  updateTotalsRow(b: Block, idx: number, patch: Record<string, unknown>): void {
    this.patchTotals(b, (cur) => {
      const rows = cur.rows.slice();
      rows[idx] = { ...rows[idx], ...patch };
      return { ...cur, rows };
    });
  }

  removeTotalsRow(b: Block, idx: number): void {
    this.patchTotals(b, (cur) => ({ ...cur, rows: cur.rows.filter((_, i) => i !== idx) }));
  }

  addTotalsRow(b: Block): void {
    this.patchTotals(b, (cur) => ({
      ...cur,
      rows: [...cur.rows, { label: 'Total', expression: '0', format: 'currency:BHD' }],
    }));
  }

  // ─── internals ──────────────────────────────────────────────────

  private patchTable(b: Block, updater: (cur: Extract<Block, { type: 'table' }>) => Extract<Block, { type: 'table' }>): void {
    if (b.type !== 'table') return;
    this.state.patchBlock(b.id, (cur) => (cur.type === 'table' ? updater(cur) : cur));
  }

  private patchTotals(
    b: Block,
    updater: (cur: Extract<Block, { type: 'totals' }>) => Extract<Block, { type: 'totals' }>,
  ): void {
    if (b.type !== 'totals') return;
    this.state.patchBlock(b.id, (cur) => (cur.type === 'totals' ? updater(cur) : cur));
  }
}
