import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { FilterConfig, FilterOption, FilterState } from '../../interfaces/list-page.types';
import { SearchDropdownComponent } from '../../../dropdown';
import { DatePickerComponent } from '../../../datepicker/date-picker.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

/** What the bar hands back to the list whenever the user edits a chip. */
export interface ListFilterChange {
  filters: FilterState;
  labels: Record<string, string>;
}

type PopKind = 'add' | 'field' | 'value';
interface Pop { kind: PopKind; key: string | null; origin: HTMLElement; }

/** A filter field the user can build a chip from. Only types the list API can express are offered. */
type EditableFilter = Exclude<FilterConfig, { type: 'search-dropdown' }>;

interface Chip {
  key: string;
  cfg: EditableFilter;
  draft: boolean;
  opLabel: string;
  valueText: string;
}

const PRESETS = [
  { code: 'all',    labelKey: 'COMMON.PERIOD_ALL' },
  { code: 'last7',  labelKey: 'COMMON.PERIOD_LAST_7' },
  { code: 'last14', labelKey: 'COMMON.PERIOD_LAST_14' },
  { code: 'last30', labelKey: 'COMMON.PERIOD_LAST_30' },
  { code: 'custom', labelKey: 'COMMON.PERIOD_CUSTOM' },
];

/**
 * Inline filter-builder bar for `<app-list-page>`.
 *
 * Each active filter is a segmented chip `[Field] | [operator] | [value] | [x]`. The field segment opens a field
 * picker, the value segment opens an editor suited to the field's type, and the x removes the chip. The bar only
 * edits the list's existing filter state (`FilterState` keyed exactly as the filter modal wrote it), so API
 * params are unchanged.
 *
 * The operator segment is informational: the list API only expresses equality / "any of" / ranges, so there is no
 * "is not", "greater than" or "less than" to offer yet (adding them needs a backend contract per field).
 *
 * The component is always instantiated (it hosts the popovers) but renders nothing, and takes no space, while no
 * filter is active or being built.
 */
@Component({
  selector: 'app-list-filter-bar',
  standalone: true,
  imports: [CommonModule, TranslateModule, OverlayModule, SearchDropdownComponent, DatePickerComponent, TooltipDirective],
  templateUrl: './list-filter-bar.component.html',
  styleUrl: './list-filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListFilterBarComponent {
  private host = inject(ElementRef<HTMLElement>);
  private translate = inject(TranslateService);
  private injector = inject(Injector);

  readonly filters = input.required<FilterConfig[]>();
  readonly active = input.required<FilterState>();
  /** Display labels the list stored for async dropdown values (id -> name). */
  readonly labels = input<Record<string, string>>({});
  /** Resolves the human text of an active filter key (the list's own formatter). */
  readonly valueTextFn = input.required<(key: string) => string>();

  readonly changed = output<ListFilterChange>();
  readonly cleared = output<void>();

  readonly presets = PRESETS;
  /** Fallback overlay origin while no popover is open. */
  readonly anchor: HTMLElement = this.host.nativeElement;

  /** Keys of the chips, in the order they were added (drafts included). */
  private readonly order = signal<string[]>([]);
  readonly pop = signal<Pop | null>(null);
  private readonly valueDropdown = viewChild(SearchDropdownComponent);

  /** Selected items for async dropdowns, so a chip can show names instead of ids (same trick the modal used). */
  private readonly picked: Record<string, Record<string, FilterOption>> = {};

  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  ];

  /** Filters the bar can build chips for. */
  readonly fields = computed<EditableFilter[]>(() => this.filters().filter((f): f is EditableFilter => f.type !== 'search-dropdown'));

  private fieldKey(cfg: FilterConfig): string {
    return 'key' in cfg ? cfg.key : (cfg as any).keyFrom;
  }

  private isActive(cfg: FilterConfig): boolean {
    const a = this.active();
    if (cfg.type === 'date-range') return !!(a[cfg.keyFrom] || a[cfg.keyTo]);
    const v = a[(cfg as any).key];
    return Array.isArray(v) ? v.length > 0 : v != null && v !== '';
  }

  readonly chips = computed<Chip[]>(() => {
    const fields = this.fields();
    const byKey = new Map(fields.map(f => [this.fieldKey(f), f] as const));
    const keys = this.order().filter(k => byKey.has(k));
    // Filters that arrive from the URL / a quick view / saved state are appended in config order.
    for (const f of fields) {
      const k = this.fieldKey(f);
      if (!keys.includes(k) && this.isActive(f)) keys.push(k);
    }
    return keys.map(k => {
      const cfg = byKey.get(k)!;
      const draft = !this.isActive(cfg);
      return {
        key: k, cfg, draft,
        opLabel: this.operatorLabel(cfg),
        valueText: draft ? '' : this.valueTextFn()(k),
      };
    });
  });

  /** The bar is shown while there is any chip (active or being built). */
  readonly visible = computed(() => this.chips().length > 0);

  private operatorLabel(cfg: EditableFilter): string {
    const multi = cfg.type === 'checkbox-group' || cfg.type === 'multi-select' || (cfg.type === 'dropdown' && !!cfg.multiple);
    if (cfg.type === 'date-range') return this.translate.instant('COMMON.LP_OP_BETWEEN');
    return this.translate.instant(multi ? 'COMMON.LP_OP_ANY_OF' : 'COMMON.LP_OP_IS');
  }

  chipAria(c: Chip): string {
    return `${c.cfg.label} ${c.opLabel} ${c.draft ? this.translate.instant('COMMON.LP_CHOOSE_VALUE') : c.valueText}`;
  }

  // ── Opening / closing popovers ──────────────────────────────────────────────

  /** Public entry for the toolbar "Filter" button: pick a field anchored under `origin`. */
  startAdd(origin: HTMLElement): void {
    this.pop.set({ kind: 'add', key: null, origin });
    this.focusPanel();
  }

  /** Moves keyboard focus to the first chip segment (toolbar button when filters already exist). */
  focusFirstChip(): void {
    (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.fb-seg, .fb-add')?.focus();
  }

  openField(c: Chip, ev: Event): void {
    this.pop.set({ kind: 'field', key: c.key, origin: this.originOf(ev) });
    this.focusPanel();
  }

  openValue(c: Chip, ev: Event | HTMLElement): void {
    const origin = ev instanceof HTMLElement ? ev : this.originOf(ev);
    this.pop.set({ kind: 'value', key: c.key, origin });
    this.focusPanel();
    if (c.cfg.type === 'dropdown' && c.cfg.loadFn) {
      afterNextRender(() => this.valueDropdown()?.open(), { injector: this.injector });
    }
  }

  openAdd(ev: Event): void {
    this.pop.set({ kind: 'add', key: null, origin: this.originOf(ev) });
    this.focusPanel();
  }

  private originOf(ev: Event): HTMLElement {
    return (ev.currentTarget as HTMLElement).closest('.fb-chip, .fb-add') as HTMLElement ?? (ev.currentTarget as HTMLElement);
  }

  closePop(restoreFocus = true): void {
    const p = this.pop();
    if (!p) return;
    this.pop.set(null);
    // A chip left without a value is a leftover draft: drop it so it never lingers as an invisible "filter".
    this.dropIdleDrafts();
    if (restoreFocus && p.origin?.isConnected) afterNextRender(() => p.origin.querySelector<HTMLElement>('.fb-seg, .fb-add')?.focus?.() ?? p.origin.focus?.(), { injector: this.injector });
  }

  private dropIdleDrafts(): void {
    const idle = new Set(this.chips().filter(c => c.draft).map(c => c.key));
    if (idle.size) this.order.update(o => o.filter(k => !idle.has(k)));
  }

  private focusPanel(): void {
    afterNextRender(() => {
      const panel = document.querySelector<HTMLElement>('.fb-pop');
      (panel?.querySelector<HTMLElement>('[data-autofocus], button:not([disabled]), input') ?? panel)?.focus();
    }, { injector: this.injector });
  }

  /** Arrow keys move through the popover's options (Tab still works). */
  onPopKeydown(ev: KeyboardEvent): void {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    const items = Array.from((ev.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role^="menuitem"], [role="option"]:not([disabled])'));
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = ev.key === 'ArrowDown' ? items[(i + 1) % items.length] : items[(i - 1 + items.length) % items.length];
    next.focus();
    ev.preventDefault();
  }

  // ── Chip actions ────────────────────────────────────────────────────────────

  /** Backspace / Delete on a focused chip removes it (Enter on a segment is a normal button click). */
  onChipKeydown(ev: KeyboardEvent, c: Chip): void {
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();
      const chips = this.chips();
      const idx = chips.findIndex(x => x.key === c.key);
      this.remove(c);
      // Keep focus inside the bar: next chip, else previous, else the add button.
      afterNextRender(() => {
        const segs = (this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.fb-chip');
        const target = segs[Math.min(idx, segs.length - 1)];
        (target?.querySelector<HTMLElement>('.fb-seg') ?? (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.fb-add'))?.focus();
      }, { injector: this.injector });
    }
  }

  remove(c: Chip): void {
    this.order.update(o => o.filter(k => k !== c.key));
    if (c.draft) return;
    this.commit(this.without(this.active(), c.cfg), this.dropLabel(c.key));
  }

  clearAll(): void {
    this.order.set([]);
    this.cleared.emit();
  }

  // ── Field picker ────────────────────────────────────────────────────────────

  /** Fields offered for the open picker: everything not already a chip (a field change may keep its own). */
  pickableFields(): EditableFilter[] {
    const used = new Set(this.order());
    const own = this.pop()?.kind === 'field' ? this.pop()!.key : null;
    return this.fields().filter(f => {
      const k = this.fieldKey(f);
      return k === own || (!used.has(k) && !this.isActive(f));
    });
  }

  pickField(cfg: EditableFilter): void {
    const p = this.pop();
    const key = this.fieldKey(cfg);
    if (!p) return;
    if (p.kind === 'field' && p.key && p.key !== key) {
      const oldCfg = this.fields().find(f => this.fieldKey(f) === p.key);
      this.order.update(o => o.map(k => (k === p.key ? key : k)));
      if (oldCfg && this.isActive(oldCfg)) this.commit(this.without(this.active(), oldCfg), this.dropLabel(p.key));
    } else if (p.kind === 'add') {
      this.order.update(o => [...o, key]);
    }
    this.pop.set(null);
    // Open the value editor on the (new) chip as soon as it has rendered.
    afterNextRender(() => {
      const el = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`.fb-chip[data-key="${CSS.escape(key)}"]`);
      const chip = this.chips().find(c => c.key === key);
      if (el && chip) this.openValue(chip, el);
    }, { injector: this.injector });
  }

  // ── Value editors ───────────────────────────────────────────────────────────

  options(cfg: EditableFilter): FilterOption[] {
    const o = (cfg as any).options;
    return Array.isArray(o) ? o : [];
  }

  isMulti(cfg: EditableFilter): boolean {
    return cfg.type === 'checkbox-group' || cfg.type === 'multi-select' || (cfg.type === 'dropdown' && !!cfg.multiple);
  }

  /** Static option lists render as a menu; async (`loadFn`) dropdowns embed the shared search dropdown. */
  isStaticList(cfg: EditableFilter): boolean {
    return cfg.type === 'checkbox-group' || cfg.type === 'multi-select' || cfg.type === 'status' || (cfg.type === 'dropdown' && !cfg.loadFn);
  }

  isChecked(cfg: EditableFilter, value: any): boolean {
    const v = this.active()[this.fieldKey(cfg)];
    return Array.isArray(v) ? v.includes(value) : v === value;
  }

  toggleOption(cfg: EditableFilter, opt: FilterOption): void {
    const key = this.fieldKey(cfg);
    const cur = this.active()[key];
    if (this.isMulti(cfg)) {
      const arr: any[] = Array.isArray(cur) ? cur : cur != null && cur !== '' ? [cur] : [];
      const next = arr.includes(opt.value) ? arr.filter(v => v !== opt.value) : [...arr, opt.value];
      this.setValue(cfg, next.length ? next : undefined, this.joinLabels(cfg, next));
    } else {
      this.setValue(cfg, opt.value, opt.label);
      this.closePop();
    }
  }

  // async dropdown (loadFn) bridge
  dropdownValue(cfg: EditableFilter): any {
    const key = this.fieldKey(cfg);
    const v = this.active()[key];
    const cache = this.picked[key] ?? {};
    const labelOf = (x: any): FilterOption => cache[String(x)] ?? { value: x, label: this.labels()[key] && !Array.isArray(v) ? this.labels()[key] : String(x) };
    if ((cfg as any).multiple) return Array.isArray(v) ? v.map(labelOf) : [];
    return v == null || v === '' ? null : labelOf(v);
  }

  onDropdownPick(cfg: EditableFilter, item: any): void {
    const key = this.fieldKey(cfg);
    if ((cfg as any).multiple) {
      const arr: FilterOption[] = Array.isArray(item) ? item : [];
      this.picked[key] = Object.fromEntries(arr.map(i => [String(i.value), i]));
      this.setValue(cfg, arr.length ? arr.map(i => i.value) : undefined, arr.map(i => i.label).join(', '));
    } else {
      this.picked[key] = item ? { [String(item.value)]: item } : {};
      this.setValue(cfg, item?.value ?? undefined, item?.label ?? '');
      this.closePop();
    }
  }

  optionLabel = (i: any): string => i?.label ?? String(i);
  optionCompare = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);

  // date range
  rangeFrom(cfg: EditableFilter): Date | null { return this.toDate(this.active()[(cfg as any).keyFrom]); }
  rangeTo(cfg: EditableFilter): Date | null { return this.toDate(this.active()[(cfg as any).keyTo]); }

  setRange(cfg: EditableFilter, side: 'from' | 'to', d: unknown): void {
    const c = cfg as Extract<FilterConfig, { type: 'date-range' }>;
    const next = { ...this.active() };
    const v = this.fromDate(d);
    const k = side === 'from' ? c.keyFrom : c.keyTo;
    if (v) next[k] = v; else delete next[k];
    this.commit(next, this.labels());
  }

  // date preset
  presetChoice(cfg: EditableFilter): string {
    const v = this.active()[this.fieldKey(cfg)];
    if (v == null || v === '') return 'all';
    const s = String(v);
    return s.startsWith('custom:') ? 'custom' : s;
  }

  setPreset(cfg: EditableFilter, code: string): void {
    const key = this.fieldKey(cfg);
    if (code === 'all') { this.setValue(cfg, undefined, ''); this.closePop(); return; }
    if (code === 'custom') {
      const cur = String(this.active()[key] ?? '');
      // 'custom:..' counts as "no value yet" until a date is chosen, so the chip stays a draft.
      if (!cur.startsWith('custom:')) this.keepDraftOpen(key, 'custom:..');
      return;
    }
    this.setValue(cfg, code, this.translate.instant(PRESETS.find(p => p.code === code)!.labelKey));
    this.closePop();
  }

  private customParts(cfg: EditableFilter): { from: string; to: string } {
    const s = String(this.active()[this.fieldKey(cfg)] ?? '');
    if (!s.startsWith('custom:')) return { from: '', to: '' };
    const [from, to] = s.slice(7).split('..');
    return { from: from || '', to: to || '' };
  }
  customFrom(cfg: EditableFilter): Date | null { return this.toDate(this.customParts(cfg).from); }
  customTo(cfg: EditableFilter): Date | null { return this.toDate(this.customParts(cfg).to); }

  setCustom(cfg: EditableFilter, side: 'from' | 'to', d: unknown): void {
    const parts = this.customParts(cfg);
    const v = this.fromDate(d);
    const from = side === 'from' ? v : parts.from;
    const to = side === 'to' ? v : parts.to;
    const fmt = (x: string) => (x ? new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '…');
    this.setValue(cfg, from || to ? `custom:${from}..${to}` : undefined, from || to ? `${fmt(from)} – ${fmt(to)}` : '');
  }

  /** Keeps a not-yet-complete value (custom range with no dates) as UI state only: the list never sees it. */
  private customDraft = signal<string | null>(null);
  private keepDraftOpen(key: string, _v: string): void { this.customDraft.set(key); }
  showCustom(cfg: EditableFilter): boolean {
    return this.presetChoice(cfg) === 'custom' || this.customDraft() === this.fieldKey(cfg);
  }

  // ── State emission ──────────────────────────────────────────────────────────

  private setValue(cfg: EditableFilter, value: any, label: string): void {
    const key = this.fieldKey(cfg);
    const next = { ...this.active() };
    if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) delete next[key];
    else next[key] = value;
    const labels = { ...this.labels() };
    if (label && next[key] !== undefined) labels[key] = label; else delete labels[key];
    this.customDraft.set(null);
    this.commit(next, labels);
  }

  private without(state: FilterState, cfg: EditableFilter): FilterState {
    const next = { ...state };
    if (cfg.type === 'date-range') { delete next[cfg.keyFrom]; delete next[cfg.keyTo]; }
    else delete next[(cfg as any).key];
    return next;
  }

  private dropLabel(key: string): Record<string, string> {
    const l = { ...this.labels() };
    delete l[key];
    return l;
  }

  private joinLabels(cfg: EditableFilter, values: any[]): string {
    const opts = this.options(cfg);
    const cache = this.picked[this.fieldKey(cfg)] ?? {};
    return values.map(v => opts.find(o => o.value === v)?.label ?? cache[String(v)]?.label ?? String(v)).join(', ');
  }

  private commit(filters: FilterState, labels: Record<string, string>): void {
    this.changed.emit({ filters, labels });
  }

  // ── Date helpers (yyyy-MM-dd <-> Date), same contract as the filter modal ───
  toDate(v: unknown): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  fromDate(v: unknown): string {
    if (!(v instanceof Date) || isNaN(v.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
}
