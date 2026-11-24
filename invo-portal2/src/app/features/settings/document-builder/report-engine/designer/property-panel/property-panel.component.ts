import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
import {
  FontOption,
  fontOptionsIncluding,
  normalizeSeedFontFamily,
  themeFontOptionsIncluding,
} from '../../utils/fonts.utils';
import { BindingPickerService } from '../../services/binding-picker.service';
import { BindingDialogComponent } from '../binding-dialog/binding-dialog.component';
import { DesignerColorPickerComponent } from '../style-controls/designer-color-picker.component';
import { AlignmentButtonsComponent } from '../style-controls/alignment-buttons.component';
import { FontStyleButtonsComponent } from '../style-controls/font-style-buttons.component';
import { SearchDropdownComponent } from '../../../../../../shared/components/dropdown/search-dropdown.component';
import { DropdownLoadParams } from '../../../../../../shared/components/dropdown/search-dropdown.types';
import { InvoicesService } from '@features/account/invoices/services/invoices.service';

type VisibleEval = { kind: 'ok'; truthy: boolean; display: string } | { kind: 'error'; message: string };

type RowVisibleEval = { kind: 'ok'; matched: number; total: number } | { kind: 'error'; message: string };

type ExprValidation = { kind: 'empty' } | { kind: 'ok'; display: string } | { kind: 'error'; message: string };

type WatermarkKind = 'none' | 'text' | 'image';

/** Returns `style` with `font.<key>` removed, so it stops overriding the
 *  inherited value. Drops the whole `font` object once empty, and `style`
 *  becomes `undefined` once both `font` and every other field are empty. */
function dropFontKey<K extends keyof NonNullable<BlockStyle['font']>>(
  style: BlockStyle | undefined,
  key: K,
): BlockStyle | undefined {
  if (!style?.font || !(key in style.font)) return style;
  const font = { ...style.font };
  delete font[key];
  const hasFont = Object.keys(font).length > 0;
  const next: BlockStyle = { ...style };
  if (hasFont) next.font = font;
  else delete next.font;
  return Object.keys(next).length > 0 ? next : undefined;
}

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
  imports: [TooltipDirective, CommonModule, FormsModule, SearchDropdownComponent, BindingDialogComponent, DesignerColorPickerComponent, AlignmentButtonsComponent, FontStyleButtonsComponent, TranslateModule],
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

  /** Lets the sample-data modal offer "import lines from a real invoice"
   *  instead of hand-typing rows. */
  private readonly _invoicesService = inject(InvoicesService);

  private readonly translate = inject(TranslateService);

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
      // setDefaultRowSource writes a signal — see the note in BindingDialog.
    }, { allowSignalWrites: true });

    // Mirror the template's sample data into the JSON editor draft whenever
    // it changes from outside this panel (host `[data]`, Apply below, or
    // Reset to default) — but never while the user is mid-edit, so typing
    // a comma to start a new row doesn't get clobbered by a re-render.
    effect(() => {
      const data = this.state.template()?.sampleData;
      if (data === this._lastSyncedSampleData) return;
      this._lastSyncedSampleData = data;
      this.sampleDataDraft.set(JSON.stringify(data ?? {}, null, 2));
      this.sampleDataError.set(null);
      this.syncSampleDataTextarea();
    }, { allowSignalWrites: true });
  }

  // ─── Static option lists ────────────────────────────────────────

  readonly PAPER_SIZES: PaperSize[] = ['A3', 'A4', 'A5', 'Letter', 'Legal', 'Thermal80', 'Thermal58', 'Custom'];
  readonly WATERMARK_KINDS: WatermarkKind[] = ['none', 'text', 'image'];
  readonly IMAGE_FITS = ['contain', 'cover', 'fill', 'none'] as const;
  readonly BARCODE_SYMBOLOGIES = ['code128', 'code39', 'ean13', 'ean8', 'upca', 'qrcode', 'datamatrix'] as const;
  readonly BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double'] as const;
  readonly PAYMENT_COLUMN_CATALOG = PAYMENT_COLUMN_CATALOG;

  readonly DIVIDER_PATTERNS = [
    { value: 'solid', label: 'DOCUMENT_BUILDER.SOLID' },
    { value: 'dashed', label: 'DOCUMENT_BUILDER.DASHED' },
    { value: 'dotted', label: 'DOCUMENT_BUILDER.DOTTED' },
  ] as const;

  /** Block alignment includes `justify`, which the shared
   *  app-alignment-buttons component doesn't model — hence a local
   *  segmented control styled to match it. */
  readonly ALIGNMENTS = [
    { value: 'left', label: 'DOCUMENT_BUILDER.ALIGN_LEFT', icon: 'mdi-format-align-left' },
    { value: 'center', label: 'DOCUMENT_BUILDER.ALIGN_CENTER', icon: 'mdi-format-align-center' },
    { value: 'right', label: 'DOCUMENT_BUILDER.ALIGN_RIGHT', icon: 'mdi-format-align-right' },
    { value: 'justify', label: 'DOCUMENT_BUILDER.JUSTIFY', icon: 'mdi-format-align-justify' },
  ] as const;

  /** Table columns don't support justify. */
  readonly ALIGNMENTS_3 = this.ALIGNMENTS.slice(0, 3);

  /** Blocks offered by the repeater's "Add child" grid. Leaf blocks only —
   *  containers (table, nested repeater) inside a card aren't supported by
   *  the renderers. */
  readonly REPEATER_CHILD_KINDS: ReadonlyArray<{ type: BlockType; label: string; icon: string }> = [
    { type: 'text', label: 'DOCUMENT_BUILDER.CHILD_TEXT', icon: 'mdi-format-text' },
    { type: 'rich-text', label: 'DOCUMENT_BUILDER.CHILD_RICH', icon: 'mdi-format-color-text' },
    { type: 'image', label: 'DOCUMENT_BUILDER.IMAGE', icon: 'mdi-image-outline' },
    { type: 'dynamic-field', label: 'DOCUMENT_BUILDER.CHILD_FIELD', icon: 'mdi-function-variant' },
    { type: 'line', label: 'DOCUMENT_BUILDER.CHILD_LINE', icon: 'mdi-minus' },
    { type: 'rectangle', label: 'DOCUMENT_BUILDER.CHILD_RECT', icon: 'mdi-rectangle-outline' },
    { type: 'divider', label: 'DOCUMENT_BUILDER.DIVIDER', icon: 'mdi-drag-horizontal-variant' },
    { type: 'qr-code', label: 'DOCUMENT_BUILDER.CHILD_QR', icon: 'mdi-qrcode' },
    { type: 'barcode', label: 'DOCUMENT_BUILDER.BARCODE', icon: 'mdi-barcode' },
  ];

  // ─── Selection / template ───────────────────────────────────────

  readonly template = this.state.template;

  // ─── Sample data (JSON) ─────────────────────────────────────────

  /** Editable draft of `template().sampleData`, kept separate from state so
   *  typing doesn't apply until the user confirms. */
  readonly sampleDataDraft = signal<string>('{}');
  readonly sampleDataError = signal<string | null>(null);
  readonly sampleDataModalOpen = signal(false);
  /** Reference the draft was last synced from — lets the mirroring effect
   *  tell "the host/Apply/Reset changed it" apart from "we're the one who
   *  just wrote it", without re-serializing on every keystroke. */
  private _lastSyncedSampleData: unknown = undefined;

  /**
   * Deliberately NOT bound via `[ngModel]`/`[value]` — see `(input)` in the
   * template. Angular re-writing a textarea's `.value` from a signal on
   * every keystroke resets the browser's own selection to the end of the
   * text, so what you typed lands wherever the caret was last reset to
   * rather than where you're actually looking. Typing goes straight to the
   * DOM and only reads back into the signal for the highlight/gutter layers;
   * this ref exists purely so Format/Apply/Import/open — the few places that
   * change the draft from OUTSIDE typing — can push their result back in.
   */
  @ViewChild('sdTextarea') private _sdTextareaRef?: ElementRef<HTMLTextAreaElement>;

  private syncSampleDataTextarea(): void {
    const el = this._sdTextareaRef?.nativeElement;
    if (el) el.value = this.sampleDataDraft();
  }

  openSampleDataModal(): void {
    this.sampleDataModalOpen.set(true);
    // The textarea doesn't exist until the *ngIf's change detection pass
    // actually runs and creates it — a microtask can still fire before that
    // pass, leaving `_sdTextareaRef` unset and the sync a silent no-op
    // (exactly what happened: gutter showed real line numbers from the
    // signal, textarea stayed empty). A macrotask reliably lands after CD.
    setTimeout(() => this.syncSampleDataTextarea(), 0);
  }

  /** Discards any unapplied edits by re-seeding the draft from state, same
   *  as the mirroring effect would once the modal reopens — done eagerly
   *  here so a stale draft isn't visible if the modal is reopened first. */
  cancelSampleDataModal(): void {
    const data = this.state.template()?.sampleData;
    this.sampleDataDraft.set(JSON.stringify(data ?? {}, null, 2));
    this.sampleDataError.set(null);
    this.sampleDataModalOpen.set(false);
  }

  /** Parse the draft and write it back — the only path that touches
   *  `state.setSampleData`, so a syntax error never reaches the template. */
  applySampleData(): void {
    try {
      const parsed = JSON.parse(this.sampleDataDraft());
      this.state.setSampleData(parsed);
      this.sampleDataError.set(null);
      this.sampleDataModalOpen.set(false);
    } catch (err) {
      this.sampleDataError.set(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }

  /** Re-indent the draft in place — doesn't apply it, just cleans up the text
   *  the same way Apply's JSON.parse/stringify round-trip would. */
  formatSampleData(): void {
    try {
      const parsed = JSON.parse(this.sampleDataDraft());
      this.sampleDataDraft.set(JSON.stringify(parsed, null, 2));
      this.sampleDataError.set(null);
      this.syncSampleDataTextarea();
    } catch (err) {
      this.sampleDataError.set(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }

  /** Tab inserts two spaces instead of jumping focus — the one behavior a
   *  plain textarea needs help with to feel like a code editor. Edits the
   *  DOM directly (see the ViewChild note above) so the caret move is
   *  synchronous instead of racing a signal-triggered re-render. */
  onSampleDataKeydown(ev: KeyboardEvent): void {
    if (ev.key !== 'Tab') return;
    ev.preventDefault();
    const el = ev.target as HTMLTextAreaElement;
    const { selectionStart, selectionEnd, value } = el;
    el.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    el.selectionStart = el.selectionEnd = selectionStart + 2;
    this.sampleDataDraft.set(el.value);
  }

  /** Keeps the line-number gutter's vertical scroll under the textarea's in
   *  lockstep — see the template's scroll handler. */
  syncEditorScroll(source: HTMLTextAreaElement, gutter: HTMLElement): void {
    gutter.scrollTop = source.scrollTop;
  }

  /** 1..N for the gutter — recomputed from line count only, not the whole
   *  highlighted markup. */
  readonly sampleDataLineNumbers = computed<number[]>(() => {
    const count = this.sampleDataDraft().split('\n').length;
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  // ─── Sample data: import lines from a real invoice ──────────────

  readonly importingInvoiceLines = signal(false);
  /** Page loader for the invoice picker (server-side search + paging). */
  loadInvoicePage = async (p: DropdownLoadParams): Promise<{ items: any[]; hasMore: boolean }> => {
    const res = await this._invoicesService.getInvoiceList({
      page: p.page,
      limit: p.pageSize,
      searchTerm: p.search,
    });
    const items = (res?.list ?? []) as any[];
    return { items, hasMore: items.length >= p.pageSize };
  };
  invoiceLabel = (i: any): string =>
    i?.invoiceNumber ? `${i.invoiceNumber}${i.customerName ? ' — ' + i.customerName : ''}` : '';
  invoiceCompare = (a: any, b: any): boolean => (a?.id ?? a) === (b?.id ?? b);

  // Font pickers: items are FontOption, value is the CSS stack string.
  fontLabel = (o: any): string => o?.label ?? '';
  fontGroup = (o: any): string => o?.group ?? '';
  fontCompare = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);

  /** Fetches the picked invoice and splices its real `lines` into the draft
   *  — everything else in the draft (header fields, other arrays) is left
   *  alone, matching "import lines", not "replace the whole document". */
  async importInvoiceLines(invoiceId: string): Promise<void> {
    if (!invoiceId) return;
    this.importingInvoiceLines.set(true);
    try {
      const invoice = await this._invoicesService.getInvoice(invoiceId);
      let draft: Record<string, unknown>;
      try {
        draft = JSON.parse(this.sampleDataDraft());
      } catch {
        draft = {};
      }
      draft['lines'] = ((invoice?.lines ?? []) as any[]).map((line) => ({
        ...line,
        // Mirrors how the real invoice paper resolves a line's display name
        // (delivery-note.component.html): selectedItem's localized name
        // first, `note` when selectedItem has none — productName alone is
        // often blank on real rows, so the default table column (which binds
        // row.productName) would otherwise read empty for an imported line.
        productName:
          line.productName ||
          line.selectedItem?.translation?.name?.en ||
          line.selectedItem?.name ||
          line.note ||
          '',
      }));
      this.sampleDataDraft.set(JSON.stringify(draft, null, 2));
      this.sampleDataError.set(null);
      this.syncSampleDataTextarea();
    } finally {
      this.importingInvoiceLines.set(false);
    }
  }

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
      [this.translate.instant('DOCUMENT_BUILDER.PRIMARY'), theme.primaryColor],
      [this.translate.instant('DOCUMENT_BUILDER.ON_PRIMARY'), theme.onPrimaryColor],
      [this.translate.instant('DOCUMENT_BUILDER.ACCENT'), theme.accentColor],
      [this.translate.instant('DOCUMENT_BUILDER.TEXT'), theme.textColor],
      [this.translate.instant('DOCUMENT_BUILDER.MUTED'), theme.mutedColor],
      [this.translate.instant('DOCUMENT_BUILDER.SURFACE'), theme.surfaceColor],
    ];
    return slots
      .filter((s): s is [string, string] => !!s[1])
      .map(([label, color]) => ({ label, color }));
  });

  // Bound appliers for the shared `swatchRow` template. Arrow properties so
  // `this` survives being passed through ngTemplateOutlet context — one
  // markup block then serves every color slot instead of six copies.
  /**
   * The selected block's own family, as a bare string.
   *
   * Exists so `fontOptions` below can be keyed on the family alone. Reading
   * the block object there instead would recompute on every unrelated edit
   * — a drag changes `position`, which replaces the block — and hand
   * ng-select a fresh array each time. See `fontOptions` for why that breaks
   * the picker outright.
   */
  private readonly selectedFontFamily = computed<string>(
    () => this.block()?.style?.font?.family ?? '',
  );

  /**
   * The font picker's options: the standard families, plus whatever the block
   * already uses when that isn't one of them — so a family this build
   * doesn't offer isn't silently dropped from a design authored elsewhere.
   *
   * A computed, NOT a method, and this matters. ng-select rebuilds its whole
   * option list whenever the `items` array identity changes, and tracks the
   * rendered rows by the object identity of the items it built — so a new
   * array means every option row in the open dropdown is destroyed and
   * recreated. A method call here returned a new array on every change
   * detection pass, including the one Angular runs on the search input's
   * `blur` when you press the mouse down on an option: the row under the
   * cursor was replaced between mousedown and mouseup, so the browser
   * dispatched `click` on their common ancestor — the panel, which has no
   * handler — and the choice was silently dropped. Keyed on the family
   * string, the array identity now survives every edit that isn't a font
   * change.
   */
  readonly fontOptions = computed<FontOption[]>(
    () => fontOptionsIncluding(this.selectedFontFamily()),
  );

  /** The template's font as the renderers resolve it, so the picker can't
   *  show a legacy seed value the canvas has already normalised away. */
  readonly themeFontFamily = computed<string>(
    () => normalizeSeedFontFamily(this.template()?.theme?.fontFamily) ?? '',
  );

  /** Same list for the document-wide picker in the Theme group, where the
   *  empty option is the DEFAULT_FONT_STACK fallback rather than "inherit".
   *  Computed for the same reason as `fontOptions`. */
  readonly themeFontOptions = computed<FontOption[]>(
    () => themeFontOptionsIncluding(this.themeFontFamily()),
  );

  /**
   * True when the selected block's family survives a PDF export — i.e. it
   * names a font the exporter has registered (see `resolvePdfFontName`).
   * "Inherit" counts as safe: it resolves to the theme font, which the Theme
   * group flags on its own. Everything else gets a warning under the picker,
   * because the group heading alone is easy to miss once the dropdown is
   * closed.
   */
  readonly fontIsPdfSafe = computed<boolean>(() => {
    const family = this.selectedFontFamily().trim();
    if (!family) return true;
    return this.fontOptions().some((o) => o.value === family && o.pdfSafe);
  });

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
    const next = Math.max(1, Number(value) || 1);
    this.state.patchBlock(b.id, (cur) => {
      const sized = { ...cur, size: { ...cur.size, [axis]: next } };
      // A card list's box IS one card: the renderers lay out N cards of
      // `itemHeight`, so a box height that disagrees with it is a lie the
      // canvas tells. The resize handle and the Item height field both keep
      // the two in step already — this field was the one way to drift them
      // apart, and the drift showed up as a gap under the card list that the
      // real document didn't have (pagination anchors the blocks below on
      // the designed box, the renderer ends the cards at `itemHeight`).
      return axis === 'height' && sized.type === 'repeater'
        ? { ...sized, itemHeight: next }
        : sized;
    });
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
    this.state.patchBlock(b.id, (cur) => {
      const next = {
        ...cur,
        style: { ...(cur.style ?? {}), font: { ...(cur.style?.font ?? {}), [key]: value } },
      };
      // Table columns carry their own headerStyle/cellStyle.font, which
      // there's no per-column UI to edit — on most tables (esp. ones
      // migrated from the classic builder) every column has the same value
      // baked in, which then silently shadows this block-level control via
      // CSS specificity. Since the user has no other way to touch it,
      // clear the field being edited here from every column so the new
      // block-level value actually takes effect.
      if (next.type === 'table') {
        return {
          ...next,
          columns: next.columns.map((col) => ({
            ...col,
            headerStyle: dropFontKey(col.headerStyle, key),
            cellStyle: dropFontKey(col.cellStyle, key),
          })),
        };
      }
      return next;
    });
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

  /** Untouched border defaults to 0.5pt (see setUniformBorder's own seed
   *  value) — not 0. A bare `?? 0` here would show "0" for a table that's
   *  actually still rendering its default border, so typing nothing looked
   *  identical to explicitly asking for no border at all. */
  borderWidth(): number {
    const side = this.borderSide();
    return side?.width ?? 0.5;
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

  /** Every editor here patches immutably, so a fresh object comes back on each
   *  keystroke. Without a stable key ngFor would drop the row's DOM mid-edit,
   *  blurring the input and jumping the panel's scroll. */
  trackColumn(_i: number, col: { id: string }): string {
    return col.id;
  }

  /** Same, for lists whose items carry no id (totals rows). */
  trackIndex(i: number): number {
    return i;
  }

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
      rows: [...cur.rows, { label: 'Total', expression: '0', format: 'Currency' }],
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
