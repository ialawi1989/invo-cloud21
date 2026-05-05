import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs/operators';
import {
  CdkDragDrop,
  CdkDragMove,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { CompanyService } from '@core/auth/company.service';

import {
  PrintElement,
  TableElement,
  TableGroup,
  TableInvoiceLinesOptions,
  TemplateType,
} from '../../../../services/receipt-builder.types';
import {
  ColumnSuggestion,
  TableColumnsEditorComponent,
} from '../table-columns-editor/table-columns-editor.component';
import { BindableInputComponent } from '../bindable-input/bindable-input.component';
import { AlignIconComponent } from '../align-icon/align-icon.component';
import { RbfWidgetComponent } from '../rbf-widget/rbf-widget.component';

interface Option { value: string; label: string }

/**
 * ElementEditorComponent
 * ──────────────────────
 * Right-side panel that exposes the editable fields for the currently-
 * selected receipt element. One component, one big `@switch` per type
 * — keeps the field set in one place where it can be diff'd against
 * the legacy models without hunting through 9 sibling files.
 *
 * Flow:
 *   form.selectedElement()  →  [element]  (input)
 *   edit a field            →  emits      (change)  { key, value }
 *   form.patchSelectedElement(key, value) folds it into the template
 *
 * The component never mutates the input directly; every edit goes
 * through the parent so isDirty + signal change-detection stay
 * deterministic (single source of truth).
 */
@Component({
  selector: 'app-element-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    SearchDropdownComponent,
    TableColumnsEditorComponent,
    BindableInputComponent,
    AlignIconComponent,
    RbfWidgetComponent,
    DragDropModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './element-editor.component.html',
  styleUrl: './element-editor.component.scss',
})
export class ElementEditorComponent {
  private translate = inject(TranslateService);
  private companies = inject(CompanyService);

  /** Currently-selected element. `null` when nothing's picked — the
   *  parent already shows a "select an element" hint in that case;
   *  this component just renders nothing. */
  element = input<PrintElement | null>(null);

  /** Template-type context (`'recieptType' | 'kitchen'`). Drives a
   *  handful of UI bits that differ between receipt and kitchen
   *  templates — currently the `option.kitchenName` toggle, which is
   *  kitchen-only per the legacy receipt-builder. Defaults to
   *  receipt so the editor is conservative when the parent doesn't
   *  specify. */
  templateType = input<TemplateType>('recieptType');

  /** Single emitter for every field edit. Parent funnels these into
   *  `patchSelectedElement(key, value)` so all per-element edits
   *  share one update path. */
  @Output() fieldChange = new EventEmitter<{ key: string; value: unknown }>();

  /** Strongly-typed accessors for the template — `[ngModel]` reads
   *  through these so we don't need to repeat the type-narrowing in
   *  the HTML. Each accessor returns the *element-specific* shape
   *  for a given type, falling back to `null` for the wrong type so
   *  conditional rendering stays clean. */
  asText      = (e: PrintElement | null) => (e?.type === 'Text'      ? e : null);
  asSideText  = (e: PrintElement | null) => (e?.type === 'SideText'  ? e : null);
  asLine      = (e: PrintElement | null) => (e?.type === 'Line'      ? e : null);
  asSpacer    = (e: PrintElement | null) => (e?.type === 'Spacer'    ? e : null);
  asLogo      = (e: PrintElement | null) => (e?.type === 'Logo'      ? e : null);
  asImage     = (e: PrintElement | null) => (e?.type === 'Image'     ? e : null);
  asQrCode    = (e: PrintElement | null) => (e?.type === 'QrCode'    ? e : null);
  asBarcode   = (e: PrintElement | null) => (e?.type === 'Barcode'   ? e : null);
  asTable     = (e: PrintElement | null) => (e?.type === 'Table'     ? e : null);

  emit(key: string, value: unknown): void {
    this.fieldChange.emit({ key, value });
  }

  // ─── Widget slot groups (drag-to-reorder + tab-merge) ────────────────
  // Each element type has a list of "groups". A group is one or more
  // slot ids that share a single widget container; multi-slot groups
  // render as tabs. The user can:
  //   - drag a group into a different vertical position (reorder)
  //   - drop a group onto another group's header to merge them as tabs
  //   - close a tab to ungroup it back to its own widget
  // Persisted per type in localStorage as JSON `string[][]`.

  /** Default groups per element type — every slot starts in its own
   *  single-item group. Adding a new slot here surfaces it for users
   *  who haven't customised; users with a saved layout get the new
   *  slot appended (see `groupsFor`). */
  private static readonly DEFAULT_GROUPS: Record<string, string[][]> = {
    Text:     [['content'], ['alignment'], ['typography'], ['visibility']],
    SideText: [['content'], ['typography'], ['visibility']],
    Line:     [['line-style'], ['padding']],
    Spacer:   [['size'], ['padding']],
    Logo:     [['size'], ['alignment']],
    Image:    [['content'], ['size'], ['alignment']],
    QrCode:   [['content'], ['size'], ['visibility']],
    Barcode:  [['content'], ['size'], ['visibility']],
    Table:    [['columns'], ['line-options']],
  };

  /** Per-type groups signal. Updated by `onSlotReorder` (drag-merge or
   *  drag-reorder) and `ungroupTab` (× on tab pill). Reads pull through
   *  the signal so the template re-renders on changes. */
  private groupsState = signal<Record<string, string[][]>>({});

  /** Active tab id per group, keyed by `<Type>:<groupIndex>`. Defaults
   *  to the group's first slot. Persisted in localStorage so the user's
   *  active tab choice survives reloads. */
  private activeTabState = signal<Record<string, string>>({});

  /** Localised translation keys per slot id. */
  readonly slotTitleKey: Record<string, string> = {
    'content':       'RECEIPT_BUILDER.EDITOR.WIDGET_CONTENT',
    'alignment':     'RECEIPT_BUILDER.EDITOR.ALIGNMENT',
    'typography':    'RECEIPT_BUILDER.EDITOR.WIDGET_TYPOGRAPHY',
    'visibility':    'RECEIPT_BUILDER.EDITOR.VISIBILITY',
    'line-style':    'RECEIPT_BUILDER.EDITOR.LINE_STYLE',
    'padding':       'RECEIPT_BUILDER.EDITOR.PADDING',
    'size':          'RECEIPT_BUILDER.EDITOR.WIDGET_SIZE',
    'columns':       'RECEIPT_BUILDER.EDITOR.TABLE_COLUMNS',
    'line-options':  'RECEIPT_BUILDER.EDITOR.LINES_OPTIONS',
  };

  /** Read the groups for a type. Pure read; `onSlotReorder` and
   *  `ungroupTab` are the only writers. Pulls from in-memory state if
   *  set, otherwise from localStorage, otherwise defaults. Defensive:
   *  - drops unknown slot ids,
   *  - appends any default-only slots that aren't already in any group
   *    (so code-side additions land for existing users),
   *  - drops empty groups. */
  groupsFor(type: string): string[][] {
    const cached = this.groupsState()[type];
    if (cached) return cached;

    const defGroups = ElementEditorComponent.DEFAULT_GROUPS[type] ?? [];
    const defFlat   = defGroups.flat();
    const known     = new Set(defFlat);

    let stored: string[][] | null = null;
    try {
      const raw = localStorage.getItem('rbfw-groups:' + type);
      if (raw) stored = JSON.parse(raw) as string[][];
    } catch { /* corrupt entry — ignore */ }

    let groups: string[][];
    if (Array.isArray(stored) && stored.every((g) => Array.isArray(g))) {
      groups = stored
        .map((g) => g.filter((s) => known.has(s)))
        .filter((g) => g.length > 0);
      // Append any defaults the stored layout missed. Each missing
      // slot becomes its own group (conservative — don't auto-merge).
      const seen = new Set(groups.flat());
      defFlat.forEach((s) => {
        if (!seen.has(s)) groups.push([s]);
      });
    } else {
      groups = defGroups.map((g) => [...g]);
    }
    return groups;
  }

  /** Active tab for a group. Falls back to the first slot when nothing
   *  is stored. Reads from a signal so template bindings re-render
   *  when the user switches tab. */
  activeTab(type: string, groupIndex: number, slots: string[]): string {
    if (slots.length === 0) return '';
    const key = `${type}:${groupIndex}`;
    const stored = this.activeTabState()[key];
    if (stored && slots.includes(stored)) return stored;
    return slots[0];
  }

  /** Setter wired through (activeTabIdChange) on the rbf-widget. Also
   *  persists so the choice survives reloads. */
  setActiveTab(type: string, groupIndex: number, id: string | undefined): void {
    if (!id) return;
    const key = `${type}:${groupIndex}`;
    this.activeTabState.update((m) => ({ ...m, [key]: id }));
    try { localStorage.setItem('rbfw-tab:' + key, id); }
    catch { /* swallow */ }
  }

  /** Drop handler — covers both vertical reorder and drop-on-header
   *  merging. CDK gives us source/target indices; we additionally
   *  inspect `event.dropPoint` to detect "did the user drop on
   *  another widget's header?" — if so, merge the dragged group's
   *  slots into the target group as tabs. Otherwise plain reorder. */
  onSlotReorder(type: string, event: CdkDragDrop<string[][]>): void {
    const groups = this.groupsFor(type).map((g) => [...g]);
    const fromIdx = event.previousIndex;

    // Detect drop-on-header: hit-test the drop point against every
    // widget header in the editor. We mark headers with a data-attr
    // so we can look them up cheaply via document.elementsFromPoint.
    const targetHeaderGi = this.hitTestHeader(event.dropPoint);
    if (targetHeaderGi !== null && targetHeaderGi !== fromIdx) {
      // Merge: pull the dragged group's slots into the target's tabs.
      // Adjust the target index for the upcoming splice if the source
      // sits before it.
      const merged = [...groups[targetHeaderGi], ...groups[fromIdx]];
      const next   = groups
        .map((g, i) => (i === targetHeaderGi ? merged : g))
        .filter((_, i) => i !== fromIdx);
      this.commitGroups(type, next);
      return;
    }

    // Plain reorder of groups.
    moveItemInArray(groups, event.previousIndex, event.currentIndex);
    this.commitGroups(type, groups);
  }

  /** Reorder slots within a group — fired when the user drags a tab
   *  to a new position in the strip. The indices come from CDK's
   *  drop event and are applied to the group's slot array. */
  reorderTab(
    type: string,
    groupIndex: number,
    event: { previousIndex: number; currentIndex: number },
  ): void {
    const groups = this.groupsFor(type).map((g) => [...g]);
    const group  = groups[groupIndex];
    if (!group) return;
    moveItemInArray(group, event.previousIndex, event.currentIndex);
    this.commitGroups(type, groups);
  }

  /** Pull a slot out of its group, putting it back into its own group
   *  immediately above. Called when the user clicks × on a tab pill. */
  ungroupTab(type: string, groupIndex: number, slotId: string): void {
    const groups = this.groupsFor(type).map((g) => [...g]);
    const src    = groups[groupIndex];
    if (!src || !src.includes(slotId)) return;

    const remaining = src.filter((s) => s !== slotId);
    const next: string[][] = [];
    groups.forEach((g, i) => {
      if (i === groupIndex) {
        next.push([slotId]);
        if (remaining.length > 0) next.push(remaining);
      } else {
        next.push(g);
      }
    });
    this.commitGroups(type, next);
  }

  /** Persist a fresh groups array — both in-memory signal and storage
   *  so the layout survives reloads. */
  private commitGroups(type: string, groups: string[][]): void {
    this.groupsState.update((m) => ({ ...m, [type]: groups }));
    try { localStorage.setItem('rbfw-groups:' + type, JSON.stringify(groups)); }
    catch { /* swallow storage errors */ }
  }

  // ─── Live drop-target highlight ──────────────────────────────────────
  // While a widget drag is in flight, hit-test the cursor against
  // sibling widget headers and apply a `--drop-target` class so the
  // user can see *which* header would receive the merge if they
  // release. We track the previously highlighted header so we only
  // toggle the class when the target changes — keeps DOM writes
  // minimal during the high-frequency `cdkDragMoved` stream.
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

  /** Walk the elementsFromPoint stack and find the header DOM node
   *  the cursor currently sits on. Skips the floating drag preview
   *  (CDK overlays it on the cursor) and the source's own placeholder
   *  (you can't merge a widget into itself). Returns null when the
   *  cursor isn't over any other widget's header — the drop becomes
   *  a plain reorder in that case. */
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

  /** Hit-test a screen point against widget headers in the editor.
   *  Returns the group index whose header the point lies inside, or
   *  null. The CDK drag preview floats with the cursor and may be
   *  on top of the stack; we skip any element inside the preview so
   *  we read the underlying DOM. The "header" zone is identified by
   *  walking up to a `.rbfw__header` ancestor and reading its
   *  parent's `data-rbfw-gi` attribute. */
  private hitTestHeader(point: { x: number; y: number }): number | null {
    if (typeof document === 'undefined') return null;
    const stack = document.elementsFromPoint(point.x, point.y) as HTMLElement[];
    for (const el of stack) {
      if (el.closest('.cdk-drag-preview')) continue;
      if (el.closest('.cdk-drag-placeholder')) continue;
      const header = el.closest('.rbfw__header');
      if (!header) continue;
      const wrapper = (header as HTMLElement).closest<HTMLElement>('[data-rbfw-gi]');
      if (!wrapper) continue;
      const gi = Number(wrapper.dataset['rbfwGi']);
      return Number.isFinite(gi) ? gi : null;
    }
    return null;
  }

  /** track-fn for the group @for — group identity is the joined slot
   *  ids so a re-grouped layout still re-keys cleanly. */
  trackGroup(_: number, group: string[]): string { return group.join('|'); }

  /** Tab descriptors for a group. Returns `[]` for single-slot groups
   *  (the widget then renders its title instead of a tab strip).
   *  Cached by group identity so OnPush widgets don't see fresh
   *  references on every render. */
  private tabsCache = new Map<string, { id: string; title: string }[]>();

  buildTabs(group: string[]): { id: string; title: string }[] {
    if (group.length <= 1) return [];
    const key = group.join('|');
    let cached = this.tabsCache.get(key);
    if (!cached) {
      cached = group.map((id) => ({
        id,
        title: this.translate.instant(this.slotTitleKey[id] ?? id),
      }));
      this.tabsCache.set(key, cached);
    }
    return cached;
  }

  /** Safe title lookup for the widget header — falls back to the
   *  raw slot id (capitalized) if the translation key is missing or
   *  the group ended up empty. Without this fallback a stale /
   *  unknown slot id would render an empty header strip. */
  widgetTitle(group: string[]): string {
    const id = group?.[0];
    if (!id) return '';
    const key = this.slotTitleKey[id];
    if (key) return this.translate.instant(key);
    // Capitalize the raw id as a last resort (e.g. 'kitchen-name'
    // → 'Kitchen-name') so the header isn't blank.
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  /** Table-specific groups — strips `line-options` for taxes / payments
   *  tables since that slot has no body content for those sources. The
   *  filter keeps drag-index parity with the rendered DOM (cdkDropList
   *  reorders by rendered children). Source can't change mid-edit so
   *  there's no risk of stranded preferences. */
  groupsForTable(source: string): string[][] {
    const all = this.groupsFor('Table');
    if (source === '!invoice.lines') return all;
    return all
      .map((g) => g.filter((s) => s !== 'line-options'))
      .filter((g) => g.length > 0);
  }

  /** Patch one half of the `condition` pair (`data` or `equals`) while
   *  preserving the other half. `condition` is a single field on the
   *  element so we emit a fresh object — the parent's spread-merge in
   *  `patchSelectedElement` would otherwise replace the whole pair. */
  emitCondition(
    current: { data: string; equals: string } | undefined,
    key: 'data' | 'equals',
    value: string,
  ): void {
    const safe = current ?? { data: '', equals: '' };
    this.emit('condition', { ...safe, [key]: value });
  }

  /** Patch one toggle on a Table element's `options` block while
   *  preserving every other toggle. Same shape-preserving pattern as
   *  `emitCondition` — without it, flipping any single switch would
   *  wipe the rest of the options when the parent spreads. Generic
   *  on `K` so we keep the per-option type narrowing
   *  (`showOptions: boolean` etc.) instead of widening to `unknown`. */
  emitOption<K extends keyof TableInvoiceLinesOptions>(
    current: TableInvoiceLinesOptions | undefined,
    key: K,
    value: TableInvoiceLinesOptions[K],
  ): void {
    this.emit('options', { ...(current ?? {}), [key]: value });
  }

  // ── Per-cell modifier attributes ───────────────────────────────────────
  // The legacy "Attributes" list mixes per-options-block flags with
  // per-cell modifiers (`qty.hideIfOne()`, `price.hideIfZero()`). We
  // surface those modifiers as eye-icon attribute rows in the same
  // section so the editor reads as one panel — but the wire encoding
  // stays per-cell: toggling rewrites every matching cell's `key` to
  // append/strip the suffix. Keeps the wire format identical to legacy.

  /** Strip the formatter (`.numberTrim()`, `.number()`, `.percentage()`)
   *  AND any hide-suffix off a key so we can match its base name. */
  private baseFieldName(key: string): string {
    return (key || '')
      .replace(/\.hideIfOne\(\)$/,   '')
      .replace(/\.hideIfZero\(\)$/,  '')
      .replace(/\.numberTrim\(\)$/,  '')
      .replace(/\.number\(\)$/,      '')
      .replace(/\.percentage\(\)$/,  '');
  }

  /** True when at least one cell across the table has the given base
   *  key with the given modifier suffix already applied. */
  hasCellModifier(t: TableElement, base: string, modifier: 'hideIfOne' | 'hideIfZero'): boolean {
    return this.eachMatchingCell(t, base).some(
      (c) => (c.key || '').endsWith(`.${modifier}()`),
    );
  }

  /** Toggle the `.hideIfOne()` / `.hideIfZero()` suffix on every cell
   *  whose base name matches `base`. Emits a fresh `groups` array
   *  through the parent's standard patch path so undo / redo /
   *  isDirty all keep working unchanged. No-op when no matching
   *  cell exists (e.g. user removed the qty column). */
  toggleCellModifier(
    t: TableElement,
    base: string,
    modifier: 'hideIfOne' | 'hideIfZero',
  ): void {
    const turningOn = !this.hasCellModifier(t, base, modifier);
    const suffixRe = new RegExp(`\\.${modifier}\\(\\)$`);
    const suffix   = `.${modifier}()`;

    const next: TableGroup[] = (t.groups ?? []).map((g) => ({
      ...g,
      rows: g.rows.map((r) => ({
        ...r,
        cells: r.cells.map((c) => {
          if (this.baseFieldName(c.key || '') !== base) return c;
          const stripped = (c.key || '').replace(suffixRe, '');
          return { ...c, key: turningOn ? stripped + suffix : stripped };
        }),
      })),
    }));
    this.emit('groups', next);
  }

  /** Walks the table and returns every cell whose base key matches
   *  `base`. Used by both the modifier-state check and the toggle —
   *  same traversal for consistency. */
  private eachMatchingCell(t: TableElement, base: string) {
    const out: { key: string }[] = [];
    (t.groups ?? []).forEach((g) =>
      g.rows.forEach((r) =>
        r.cells.forEach((c) => {
          if (this.baseFieldName(c.key || '') === base) out.push({ key: c.key || '' });
        }),
      ),
    );
    return out;
  }

  /** True when the table actually carries a cell with the given base
   *  key — drives whether we render the corresponding attribute row.
   *  If the user removed the qty column, the `qty.hideIfOne()`
   *  attribute is moot and shouldn't show. */
  hasCellWithBase(t: TableElement, base: string): boolean {
    return this.eachMatchingCell(t, base).length > 0;
  }

  /** True when a QR's `value` references the ZATCA tax-compliance
   *  binding. Drives the green hint shown under the QR editor's value
   *  field so the user knows the POS will encode this slot specially. */
  isZatcaQr(value: string | undefined): boolean {
    if (!value) return false;
    return /!invoice\.zatca(Code|Qr)\b/i.test(value);
  }

  /** True when the QR's value is a feedback-link URL — recognised by
   *  the `/feedback?invoice=` segment that the legacy preset writes. */
  isFeedbackQr(value: string | undefined): boolean {
    if (!value) return false;
    return /\/feedback\?invoice=/i.test(value);
  }

  /** Canonical ZATCA binding token, exposed so the editor can offer a
   *  one-click "Use ZATCA QR" action for Saudi Arabia merchants who'd
   *  otherwise have to remember the spelling. */
  readonly ZATCA_BINDING = '!invoice.zatcaCode';

  /**
   * Build the customer-feedback URL the QR encodes when the user picks
   * the "Use Feedback link" preset. Mirrors the legacy `getBaseURL()`:
   * pick the storefront host from the current page's URL (so dev /
   * test / prod each map to their own shop subdomain), interpolate the
   * tenant slug from `CompanyService`, and append the invoice-id
   * binding. The POS swaps `!invoice.id` for the real id at print time.
   *
   * If the slug isn't loaded yet (rare — company is loaded at boot)
   * we fall back to the bare path so the user still gets *something*
   * useful in the QR; they can edit it manually.
   */
  feedbackUrl(): string {
    const slug = this.companies.currentCompany()?.slug ?? '';
    const url = typeof window !== 'undefined' ? window.location.href : '';
    let base = '';

    if (url.includes('dev.invopos.co'))       base = `https://${slug}.dev.invopos.shop`;
    else if (url.includes('test.invopos.co')) base = `https://${slug}.test.invopos.shop`;
    else if (url.includes('invopos.co'))      base = `https://${slug}.invopos.shop`;
    else if (url.includes('localhost') || url.includes('10.2.2.75')) base = 'http://10.2.2.75:3000';
    else if (slug)                            base = `https://${slug}.invopos.shop`;

    return `${base}/feedback?invoice=!invoice.id`;
  }

  /** SearchDropdown emits the *whole option object* via `valueChange`,
   *  not the `toValue` projection — so we map back to the primitive
   *  before forwarding the change up to the form. */
  onSelect(key: string, item: Option | null): void {
    this.emit(key, item?.value ?? null);
  }

  // Catalogues that don't need translation (segmented controls).
  readonly alignments     = ['Left', 'Center', 'Right'] as const;
  readonly alignmentsLow  = ['left', 'center', 'right'] as const;
  readonly lineStyles     = ['solid', 'dashed', 'dotted'] as const;

  // ── Reactive option lists ────────────────────────────────────────────
  // Re-emit when the language changes so the dropdown trigger stays in
  // the user's current language even after the panel is closed.
  private langSignal = toSignal(
    this.translate.onLangChange.pipe(startWith({ lang: this.translate.currentLang })),
    { initialValue: { lang: this.translate.currentLang ?? 'en' } },
  );

  fontWeightOptions = computed<Option[]>(() => {
    this.langSignal();
    const t = this.translate;
    return [
      { value: 'normal', label: t.instant('RECEIPT_BUILDER.EDITOR.WEIGHT_NORMAL') },
      { value: 'bold',   label: t.instant('RECEIPT_BUILDER.EDITOR.WEIGHT_BOLD') },
    ];
  });

  fontStyleOptions = computed<Option[]>(() => {
    this.langSignal();
    const t = this.translate;
    return [
      { value: 'normal', label: t.instant('RECEIPT_BUILDER.EDITOR.STYLE_NORMAL') },
      { value: 'italic', label: t.instant('RECEIPT_BUILDER.EDITOR.STYLE_ITALIC') },
    ];
  });

  textDecorOptions = computed<Option[]>(() => {
    this.langSignal();
    const t = this.translate;
    return [
      { value: 'none',      label: t.instant('RECEIPT_BUILDER.EDITOR.DECOR_NONE') },
      { value: 'underline', label: t.instant('RECEIPT_BUILDER.EDITOR.DECOR_UNDERLINE') },
    ];
  });

  /** Hand-curated source bindings — the legacy POS only carries one
   *  logo binding (`!preferences.logo`). Kept as a single-entry list
   *  so the editor's dropdown still works as a chooser if future POS
   *  versions add more logo slots. */
  logoBindingOptions = computed<Option[]>(() => {
    this.langSignal();
    const t = this.translate;
    return [
      { value: '!preferences.logo', label: t.instant('RECEIPT_BUILDER.EDITOR.LOGO_PRIMARY') },
    ];
  });

  tableSourceOptions = computed<Option[]>(() => {
    this.langSignal();
    const t = this.translate;
    return [
      { value: '!invoice.lines',    label: t.instant('RECEIPT_BUILDER.EDITOR.TABLE_LINES') },
      { value: '!invoice.taxes',    label: t.instant('RECEIPT_BUILDER.EDITOR.TABLE_TAXES') },
      { value: '!invoice.payments', label: t.instant('RECEIPT_BUILDER.EDITOR.TABLE_PAYMENTS') },
    ];
  });

  // ── Add-column catalogs per table source ─────────────────────────────
  // Each catalog mirrors the column keys the legacy POS knows how to
  // resolve for a given collection. Surfacing them as a one-click
  // menu spares the user from typing keys like `subTotalWithoutTax
  // .number()` by hand. Empty-key entry (`{ key: '', label: 'Empty
  // column' }`) lives at the bottom so a blank scratch column is
  // always one click away.
  // Canonical column catalog for invoice-lines tables — order +
  // entries verbatim from the legacy `headerCellList()`. This is the
  // source of truth: rows should only contain columns from this list,
  // and the dropdown only offers entries from it.
  private readonly LINES_CATALOG: ColumnSuggestion[] = [
    { key: 'qty.numberTrim()',              label: 'Qty' },
    { key: 'product.name',                  label: 'Product name' },
    { key: 'total.number()',                label: 'Total' },
    { key: 'taxPercentage',                 label: 'Tax %' },
    { key: 'taxTotal.number()',             label: 'Tax total' },
    { key: 'price.number()',                label: 'Price' },
    { key: 'discountAmount.number()',       label: 'Discount amount' },
    { key: 'discountAmount.percentage()',   label: 'Discount %' },
    { key: 'UOM',                           label: 'UOM' },
    { key: 'serialNo',                      label: 'Serial #' },
    { key: 'subTotal',                      label: 'Subtotal' },
    { key: 'subTotalWithoutTax.number()',   label: 'Subtotal (excl. tax)' },
    { key: 'product.barcode',               label: 'Barcode' },
    { key: 'product.secondaryName',         label: 'Secondary name' },
    { key: 'product.kitchenName',           label: 'Kitchen name' },
    { key: '',                              label: 'Empty column' },
  ];

  private readonly TAXES_CATALOG: ColumnSuggestion[] = [
    { key: 'name',           label: 'Name' },
    { key: 'total.number()', label: 'Total' },
    { key: '',               label: 'Empty column' },
  ];

  private readonly PAYMENTS_CATALOG: ColumnSuggestion[] = [
    { key: 'paymentMethod', label: 'Payment method' },
    { key: 'amount',        label: 'Amount' },
    { key: '',              label: 'Empty column' },
  ];

  /** Pick the right "+ Add column" catalog for the table's `source`.
   *  Falls back to a single empty-column entry so unknown sources
   *  still let the user add scratch columns. */
  catalogFor(source: string | undefined): ColumnSuggestion[] {
    switch (source) {
      case '!invoice.lines':    return this.LINES_CATALOG;
      case '!invoice.taxes':    return this.TAXES_CATALOG;
      case '!invoice.payments': return this.PAYMENTS_CATALOG;
      default:                  return [{ key: '', label: 'Empty column' }];
    }
  }

  // ── Shared dropdown adapters ─────────────────────────────────────────
  // The label/value projections are the same for every option list, and
  // `optionEquals` tolerates either a primitive or a full option on either
  // side (matches the priceLabel pattern in menu-builder).
  optionLabel = (o: Option) => o.label;
  optionValue = (o: Option) => o.value;
  optionEquals = (a: Option | string | null, b: Option | string | null): boolean => {
    const av = typeof a === 'string' ? a : a?.value;
    const bv = typeof b === 'string' ? b : b?.value;
    return av === bv;
  };

  /** Resolve the stored primitive into the full option row so the
   *  dropdown's `[value]` always receives the same shape it returns
   *  via `(valueChange)`. */
  resolveOption(list: Option[], v: string | undefined | null): Option | null {
    if (v == null) return null;
    return list.find((o) => o.value === v) ?? null;
  }
}
