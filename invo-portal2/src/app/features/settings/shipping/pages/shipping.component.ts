import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { CompanyService } from '@core/auth/company.service';
import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';

import { ShippingService } from '../services/shipping.service';
import {
  Gap,
  Overlap,
  Rate,
  RateGroup,
  RateService,
  RateType,
  Zone,
  emptyRate,
  emptyZone,
} from '../services/shipping.types';
import {
  CountryPickerModalComponent,
  CountryPickerModalData,
  CountryPickerModalResult,
} from '../components/country-picker-modal/country-picker-modal.component';

import { TooltipDirective } from '@shared/directives/tooltip.directive';
/**
 * Shipping settings page (`/settings/shipping`).
 *
 * One page, one save endpoint. Each zone groups countries +
 * rate ranges; rates are visually grouped client-side by
 * `name + type`, with gap/overlap detection per group. Save
 * is gated by per-zone validation.
 *
 * The drag-and-drop "move rate between groups" feature from
 * the legacy page is intentionally deferred — moving a rate
 * is the same as renaming its group, which the user can do
 * via the inline group-edit form.
 */
@Component({
  selector: 'app-shipping',
  standalone: true,
  imports: [TooltipDirective, 
    CommonModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    DragDropModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shipping.component.html',
  styleUrl:    './shipping.component.scss',
})
export class ShippingComponent implements OnInit, CanLeaveComponent {
  private service    = inject(ShippingService);
  private translate  = inject(TranslateService);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);
  private company    = inject(CompanyService);

  /** Currency symbol from company settings — shown as the unit
   *  adornment on `Price` inputs and on `From/To` for `total` rate
   *  groups. Falls back to empty string when settings haven't loaded. */
  currencySymbol = computed<string>(() => this.company.settings()?.settings?.currencySymbol ?? '');
  /** Weight UOM (e.g. `KG`) from company settings — adornment for
   *  `From/To` inputs of `weight` rate groups. */
  weightUOM      = computed<string>(() => this.company.settings()?.weightUOM ?? this.company.settings()?.settings?.weightUOM ?? '');
  /** Theme-owned, so it can't be read off the company settings cache like
   *  weightUOM — fetched alongside the zones on load. */
  dimensionUOM   = signal<string>('cm');

  /** Adornment for a group's `from`/`to` cells: weight UOM for
   *  `weight` groups, currency symbol for `total` groups. */
  /** Unit shown beside a range's From/To inputs. Dimension ranges are
   *  volumetric (L×W×H), hence the cubed unit. */
  unitFor(type: RateType): string {
    switch (type) {
      case 'weight':    return this.weightUOM();
      case 'dimension': return `${this.dimensionUOM()}³`;
      default:          return this.currencySymbol();
    }
  }

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  zones    = signal<Zone[]>([]);
  countries = signal<string[]>([]);

  cleanSnapshot = signal<string>('');

  private i18nTick = signal(0);
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),   routerLink: '/settings' },
      { label: this.translate.instant('SHIPPING.TITLE') },
    ];
  });

  // ─── Derived: rate groups + validation ──────────────────────────
  /** Per-zone, group rates by `name + type` and compute gap/
   *  overlap diagnostics. The result is a single signal so the
   *  template binds with @for once and gets the whole picture. */
  groupedZones = computed<Array<Zone & { groups: RateGroup[]; services: RateService[] }>>(() => {
    return this.zones().map(z => {
      const groups = this.groupRates(z.rates);
      return { ...z, groups, services: this.toServices(groups) };
    });
  });

  /** The legacy page's outer level: every type group that shares a rate name is one "service". */
  private toServices(groups: RateGroup[]): RateService[] {
    const byName = new Map<string, RateGroup[]>();
    for (const g of groups) {
      if (!byName.has(g.name)) byName.set(g.name, []);
      byName.get(g.name)!.push(g);
    }
    return Array.from(byName, ([name, list]) => ({ name, groups: list }));
  }

  /** Rows the server refused on the last save, by rate id (cleared when that row is edited). */
  rowErrors = signal<Record<number, string>>({});

  /** Aggregate "is the page invalid" flag — rolls per-zone, per-
   *  group, per-rate state into a single boolean for the save
   *  button's `[disabled]`. */
  hasErrors = computed<boolean>(() => {
    for (const z of this.groupedZones()) {
      // Empty country list per zone is invalid.
      if (z.countries.length === 0) return true;
      for (const g of z.groups) {
        if (!g.name?.trim()) return true;
        for (const r of g.ranges) {
          if (!this.validateRange(r, g)) return true;
        }
        // Ranges must touch exactly ([from, to)): an overlap cannot be saved (a gap is only a warning).
        if (g.overlaps.length > 0) return true;
      }
    }
    // Duplicate zone names
    const names = new Set<string>();
    for (const z of this.zones()) {
      const k = (z.name || '').trim().toLowerCase();
      if (!k) return true;
      if (names.has(k)) return true;
      names.add(k);
    }
    return false;
  });

  /** Per-group editing state, keyed by `${zoneId}:${groupKey}`.
   *  Living outside the group object means re-grouping on every
   *  rate change doesn't lose the edit panel. */
  editingGroup = signal<string | null>(null);
  /** Per-edit draft so the user can cancel without mutating the
   *  rates underneath. */
  editingDraft = signal<{ name: string; type: RateType; note: string } | null>(null);

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed<boolean>(() =>
    !this.hasErrors() && this.isDirty() && !this.saving() && this.editingGroup() === null,
  );

  // ─── Type-picker (rate group) ───────────────────────────────────
  /** Pre-translated options for the rate-group "Type" picker.
   *  `<app-search-dropdown>` renders `displayWith` verbatim — no
   *  translate pipe inside its row template — so we resolve the
   *  i18n keys here, with `i18nTick` as a dep to refresh on
   *  language change. */
  typeOptions = computed<{ value: RateType; label: string }[]>(() => {
    this.i18nTick();
    return [
      { value: 'weight',    label: this.translate.instant('SHIPPING.RATES.TYPE_WEIGHT') },
      { value: 'total',     label: this.translate.instant('SHIPPING.RATES.TYPE_TOTAL') },
      { value: 'dimension', label: this.translate.instant('SHIPPING.RATES.TYPE_DIMENSION') },
    ];
  });

  /** Resolve the draft's `type` string to its option object so
   *  the dropdown's `[value]` binding can show the current pick. */
  selectedTypeOption(): { value: RateType; label: string } | null {
    const t = this.editingDraft()?.type;
    if (!t) return null;
    return this.typeOptions().find(o => o.value === t) ?? null;
  }

  /** Dropdown emits `T | T[] | null` — narrow at the edge so the
   *  edit-draft setter stays terse. */
  onEditTypeChange(v: { value: RateType } | { value: RateType }[] | null): void {
    const opt = Array.isArray(v) ? v[0] ?? null : v;
    if (opt) this.setEditDraft('type', opt.value);
  }

  // SearchDropdown adapters — generic over `{ value, label }`.
  optDisplay = (o: { label?: string } | null) => o?.label ?? '';
  optCompare = (a: { value?: string } | null, b: { value?: string } | null) => (a?.value ?? null) === (b?.value ?? null);
  optToValue = (o: { value?: string } | null) => o?.value ?? '';

  constructor() {
    withTranslations('settings/shipping');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [zones, countries, options] = await Promise.all([
        this.service.loadZones(),
        this.service.loadCountries(),
        this.service.loadOptions(),
      ]);
      this.zones.set(zones);
      this.countries.set(countries.map(c => c.name).sort());
      this.dimensionUOM.set(options.dimensionUOM);
      this.cleanSnapshot.set(this.snapshot());
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Zone CRUD ──────────────────────────────────────────────────
  async addZone(): Promise<void> {
    const picked = await this.openCountryPicker({
      title:    this.translate.instant('SHIPPING.PICKER.TITLE_NEW'),
      selected: [],
      takenByOthers: this.countriesUsedExcept(null),
    });
    if (!picked || picked.length === 0) return;
    const z: Zone = { ...emptyZone(), countries: picked };
    this.zones.update(list => [...list, z]);
  }

  setZoneTaxExempt(zoneId: number, taxExempt: boolean): void {
    this.zones.update(list => list.map(z => z.id === zoneId ? { ...z, taxExempt } : z));
  }

  setZoneName(zoneId: number, name: string): void {
    this.zones.update(list => list.map(z => z.id === zoneId ? { ...z, name } : z));
  }

  async editCountries(zoneId: number): Promise<void> {
    const z = this.zones().find(x => x.id === zoneId);
    if (!z) return;
    const picked = await this.openCountryPicker({
      title:         this.translate.instant('SHIPPING.PICKER.TITLE_EDIT', { name: z.name || '—' }),
      selected:      z.countries,
      takenByOthers: this.countriesUsedExcept(zoneId),
    });
    if (!picked) return;
    this.zones.update(list => list.map(x => x.id === zoneId ? { ...x, countries: picked } : x));
  }

  async deleteZone(zoneId: number): Promise<void> {
    const z = this.zones().find(x => x.id === zoneId);
    if (!z) return;
    const ok = await this.confirm({
      title:   this.translate.instant('SHIPPING.ZONE.DELETE'),
      message: this.translate.instant('SHIPPING.ZONE.CONFIRM_DELETE', { name: z.name || '—' }),
      confirm: this.translate.instant('COMMON.DELETE'),
      danger:  true,
    });
    if (!ok) return;
    this.zones.update(list => list.filter(x => x.id !== zoneId));
  }

  /** Set of country names used by every zone except `exceptZoneId`.
   *  Used to mark countries as "Taken" in the picker. */
  private countriesUsedExcept(exceptZoneId: number | null): string[] {
    return this.zones()
      .filter(z => z.id !== exceptZoneId)
      .flatMap(z => z.countries);
  }

  /** Detect a duplicate zone name for inline error rendering. */
  isDuplicateZoneName(z: Zone): boolean {
    const k = (z.name || '').trim().toLowerCase();
    if (!k) return false;
    return this.zones().some(x => x.id !== z.id && (x.name || '').trim().toLowerCase() === k);
  }

  // ─── Rate-group editing ─────────────────────────────────────────
  /** Compute the unique key for a group within a zone — used by
   *  `editingGroup()` to track which one is open for edit. */
  groupKey(zoneId: number, g: { name: string; type: string }): string {
    return `${zoneId}:${g.name}:${g.type}`;
  }

  /** Open the inline edit form for a group. Closing any other
   *  open form is implicit since `editingGroup` is a single
   *  string — only one can be in flight at a time. */
  startEditGroup(zoneId: number, g: RateGroup): void {
    this.editingGroup.set(this.groupKey(zoneId, g));
    this.editingDraft.set({ name: g.name, type: g.type, note: g.note });
  }

  setEditDraft<K extends 'name' | 'type' | 'note'>(key: K, value: string): void {
    this.editingDraft.update(d => d ? { ...d, [key]: key === 'type' ? (value as RateType) : value } : d);
  }

  /** Apply the draft back to every rate in the group — that's
   *  what the legacy page does, since rate-grouping is purely
   *  derived from `name + type`. */
  saveEditGroup(zoneId: number, g: RateGroup): void {
    const draft = this.editingDraft();
    if (!draft) return;
    const cleanName = draft.name.trim();
    if (!cleanName) {
      this.toast.error('SHIPPING.RATES.ERR_NAME_REQ');
      return;
    }

    this.zones.update(list => list.map(z => {
      if (z.id !== zoneId) return z;
      return {
        ...z,
        rates: z.rates.map(r =>
          r.name === g.name && r.type === g.type
            ? { ...r, name: cleanName, type: draft.type, note: draft.note }
            : r,
        ),
      };
    }));
    this.editingGroup.set(null);
    this.editingDraft.set(null);
  }

  cancelEditGroup(): void {
    this.editingGroup.set(null);
    this.editingDraft.set(null);
  }

  /** Start a brand-new rate group inside a zone. The new range
   *  appears blank and the edit panel opens automatically so the
   *  user can pick a name + type before continuing. */
  addRateGroup(zoneId: number): void {
    const newRate = { ...emptyRate('', 'weight', ''), to: '0' };
    this.zones.update(list => list.map(z =>
      z.id === zoneId ? { ...z, rates: [...z.rates, newRate] } : z,
    ));
    // Open the edit panel for the just-created (empty-name) group.
    this.editingGroup.set(`${zoneId}::weight`);
    this.editingDraft.set({ name: '', type: 'weight', note: '' });
  }

  /** Append another range to an existing group — uses the group's
   *  current name/type/note so the new range joins automatically. */
  addRangeToGroup(zoneId: number, g: RateGroup): void {
    this.zones.update(list => list.map(z =>
      z.id === zoneId
        ? { ...z, rates: [...z.rates, { ...emptyRate(g.name, g.type, g.note), to: '0' }] }
        : z,
    ));
  }

  setRange<K extends keyof Rate>(zoneId: number, rateId: number, key: K, value: Rate[K]): void {
    if (this.rowErrors()[rateId]) this.rowErrors.update(({ [rateId]: _gone, ...rest }) => rest);
    this.zones.update(list => list.map(z => {
      if (z.id !== zoneId) return z;
      return { ...z, rates: z.rates.map(r => r.id === rateId ? { ...r, [key]: value } : r) };
    }));
  }

  deleteRange(zoneId: number, rateId: number): void {
    this.zones.update(list => list.map(z =>
      z.id === zoneId ? { ...z, rates: z.rates.filter(r => r.id !== rateId) } : z,
    ));
  }

  // ─── Validation primitives ──────────────────────────────────────
  // THE RULE (the same one the backend enforces in `validateShippingSetting`): the lower bound is inclusive and the upper bound
  // exclusive, [from, to). An empty `to` means "no upper limit" and is only valid on the tier with the highest `from` in its group.
  // Sorted by `from`, a valid group has next.from === prev.to for every neighbouring pair.

  /** The one place a typed string becomes a number. */
  toNumber(v: string | number | null | undefined): number {
    if (v === '' || v === null || v === undefined) return NaN;
    return typeof v === 'number' ? v : parseFloat(v);
  }

  isUnbounded(r: Rate): boolean { return r.to === '' || r.to === null || r.to === undefined; }

  /** No OTHER range in the group has a strictly greater valid `from`. */
  private isHighestFromTier(r: Rate, g: RateGroup): boolean {
    const from = this.toNumber(r.from);
    if (Number.isNaN(from)) return false;
    return g.ranges.every(o => o === r || Number.isNaN(this.toNumber(o.from)) || this.toNumber(o.from) <= from);
  }

  validateRange(r: Rate, g: RateGroup): boolean {
    const from = this.toNumber(r.from);
    if (Number.isNaN(from) || from < 0) return false;
    if (this.isUnbounded(r)) return this.isHighestFromTier(r, g);
    const to = this.toNumber(r.to);
    return !Number.isNaN(to) && to > from;
  }
  isRangeValid(r: Rate, g: RateGroup): boolean { return this.validateRange(r, g); }

  /** Translation key explaining why a range is invalid. */
  rangeErrorKey(r: Rate, g: RateGroup): string {
    const from = this.toNumber(r.from);
    if (Number.isNaN(from) || from < 0) return 'SHIPPING.RATES.ERR_FROM';
    if (this.isUnbounded(r)) return 'SHIPPING.RATES.ERR_UNBOUNDED';
    if (Number.isNaN(this.toNumber(r.to))) return 'SHIPPING.RATES.ERR_TO_NUMBER';
    return 'SHIPPING.RATES.ERR_TO_GREATER';
  }

  /** "No upper limit" checkbox. Unchecking seeds `to` with `from`: a real number, so the field becomes editable, and deliberately
   *  invalid (to === from) until a real upper bound is typed. */
  toggleUnbounded(zoneId: number, r: Rate, checked: boolean): void {
    this.setRange(zoneId, r.id, 'to', checked ? '' : r.from);
  }

  /** True when this range participates in any overlap detected for
   *  its group — used to mark the row's inputs with the error
   *  border so the chip message points to the offending rows. */
  isOverlapping(group: RateGroup, r: Rate): boolean {
    for (const o of group.overlaps) {
      if (o.range1.id === r.id || o.range2.id === r.id) return true;
    }
    return false;
  }

  // ─── Save / Cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) {
      if (this.editingGroup() !== null) this.toast.warning('SHIPPING.ERR_UNSAVED_GROUP');
      else if (this.hasErrors())        this.toast.warning('SHIPPING.ERR_VALIDATION');
      return;
    }
    this.rowErrors.set({});
    this.saving.set(true);
    try {
      const res = await this.service.saveZones(this.zones());
      if (res.success) {
        this.rowErrors.set({});
        this.cleanSnapshot.set(this.snapshot());
        this.toast.success('COMMON.SAVED_OK');
      } else {
        // Mark each refused row with its own message (rowIndex = position in that zone's flat rate list).
        const marks: Record<number, string> = {};
        for (const v of res.violations ?? []) {
          const rate = this.zones().find(z => z.name === v.zone)?.rates[v.rowIndex];
          if (rate) marks[rate.id] = v.message;
        }
        this.rowErrors.set(marks);
        const detail = (res.violations ?? []).map(v => `${v.zone} / ${v.name} (#${v.rowIndex + 1}): ${v.message}`).join('\n') || res.msg;
        this.toast.error('COMMON.SAVE_FAILED', detail);
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/settings']);
  }

  // ─── Snapshot / dirty guard ─────────────────────────────────────
  private snapshot(): string {
    return JSON.stringify(
      this.zones().map(z => ({
        name:      z.name,
        countries: [...z.countries].sort(),
        taxExempt: !!z.taxExempt,
        rates:     z.rates.map(r => ({
          name:  r.name,
          type:  r.type,
          from:  r.from,
          to:    r.to,
          price: r.price,
          note:  r.note,
        })),
      })),
    );
  }
  hasUnsavedChanges(): boolean { return this.isDirty(); }

  // ─── Keyboard ───────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────
  /** Group rates by `name + type`. Sorts ranges within a group
   *  by `from`. Computes gaps + overlaps for inline diagnostics. */
  private groupRates(rates: Rate[]): RateGroup[] {
    const map = new Map<string, RateGroup>();
    for (const r of rates) {
      const k = `${r.name}::${r.type}`;
      const existing = map.get(k);
      if (existing) {
        existing.ranges.push(r);
      } else {
        map.set(k, {
          name:        r.name,
          type:        r.type,
          note:        r.note,
          ranges:      [r],
          gaps:        [],
          overlaps:    [],
          isEditing:   false,
          editingData: { name: r.name, type: r.type, note: r.note },
        });
      }
    }
    for (const g of map.values()) {
      // Honour the user's drag-reorder; gaps/overlaps are computed
      // against the visible order so warnings track what they see.
      g.gaps     = this.detectGaps(g.ranges);
      g.overlaps = this.detectOverlaps(g.ranges);
    }
    return Array.from(map.values());
  }

  // ─── Drag & drop reorder ────────────────────────────────────────
  /** Reorder ranges within a single rate group. Rebuilds `z.rates`
   *  so the *interleaved* order across groups stays stable: we only
   *  permute the slice that belongs to this group. */
  dropRange(zoneId: number, group: RateGroup, ev: CdkDragDrop<Rate[]>): void {
    if (ev.previousIndex === ev.currentIndex) return;
    this.zones.update(list => list.map(z => {
      if (z.id !== zoneId) return z;
      const inGroup = (r: Rate) => r.name === group.name && r.type === group.type;
      const groupRates = z.rates.filter(inGroup);
      moveItemInArray(groupRates, ev.previousIndex, ev.currentIndex);
      // Splice the reordered slice back into the original positions.
      let i = 0;
      const next = z.rates.map(r => inGroup(r) ? groupRates[i++] : r);
      return { ...z, rates: next };
    }));
  }

  /** One pass over the ranges sorted by `from`: next.from === prev.to is valid, a larger next.from is a gap, a smaller one an overlap. */
  private classifyBoundaries(ranges: Rate[]): { gaps: Gap[]; overlaps: Overlap[] } {
    const gaps: Gap[] = [];
    const overlaps: Overlap[] = [];
    const sorted = [...ranges].sort((a, b) => this.toNumber(a.from) - this.toNumber(b.from));
    for (let i = 0; i < sorted.length - 1; i++) {
      const prev = sorted[i];
      const next = sorted[i + 1];
      if (this.isUnbounded(prev)) continue; // nothing to compare with an infinite upper bound
      const prevTo = this.toNumber(prev.to);
      const nextFrom = this.toNumber(next.from);
      if (Number.isNaN(prevTo) || Number.isNaN(nextFrom) || nextFrom === prevTo) continue;
      if (nextFrom > prevTo) gaps.push({ from: prevTo, to: nextFrom, afterRange: i });
      else overlaps.push({ range1: prev, range2: next });
    }
    return { gaps, overlaps };
  }
  private detectGaps(ranges: Rate[]): Gap[] { return this.classifyBoundaries(ranges).gaps; }
  private detectOverlaps(ranges: Rate[]): Overlap[] { return this.classifyBoundaries(ranges).overlaps; }

  // ─── Services (the legacy page's outer level) ───────────────────
  /** Types not yet configured for this rate name in this zone: what "Add another type" can offer. */
  availableTypes(zone: { rates: Rate[] }, serviceName: string): RateType[] {
    const used = new Set(zone.rates.filter(r => r.name === serviceName).map(r => r.type));
    return (['weight', 'total', 'dimension'] as RateType[]).filter(t => !used.has(t));
  }

  /** Adds the next unused type to an existing service, with its name filled in, and opens its edit panel. */
  addTypeToService(zoneId: number, serviceName: string): void {
    const zone = this.zones().find(z => z.id === zoneId);
    if (!zone) return;
    const [type] = this.availableTypes(zone, serviceName);
    if (!type) return;
    const rate = { ...emptyRate(serviceName, type, ''), to: '0' };
    this.zones.update(list => list.map(z => (z.id === zoneId ? { ...z, rates: [...z.rates, rate] } : z)));
    this.editingGroup.set(this.groupKey(zoneId, { name: serviceName, type }));
    this.editingDraft.set({ name: serviceName, type, note: '' });
  }

  /** On a service with several types the storefront shows the note of the type that wins, so a type left without a note
   *  silently drops the explanation: flagged as a hint, not an error. */
  hasMixedNotes(groups: RateGroup[]): boolean {
    if (groups.length < 2) return false;
    const withNote = groups.some(g => !!g.note?.trim());
    const withoutNote = groups.some(g => !g.note?.trim());
    return withNote && withoutNote;
  }

  /** Reorder services within a zone (a service keeps its type groups together). */
  dropService(zoneId: number, ev: CdkDragDrop<RateService[]>): void {
    if (ev.previousIndex === ev.currentIndex) return;
    this.zones.update(list => list.map(z => {
      if (z.id !== zoneId) return z;
      const services = this.toServices(this.groupRates(z.rates));
      moveItemInArray(services, ev.previousIndex, ev.currentIndex);
      return { ...z, rates: services.flatMap(s => s.groups.flatMap(g => g.ranges)) };
    }));
  }

  /** Helper takes everything the picker needs *except* the
   *  countries list — the page already has it loaded, so we
   *  inject it here to keep the call sites short. */
  private async openCountryPicker(
    data: Omit<CountryPickerModalData, 'countries'>,
  ): Promise<string[] | undefined> {
    const ref = this.modal.open<
      CountryPickerModalComponent,
      CountryPickerModalData,
      CountryPickerModalResult
    >(CountryPickerModalComponent, {
      drawer: true, drawerWidth: '650px', drawerResizable: true, drawerMinWidth: 650,
      data: { ...data, countries: this.countries() },
      closeOnBackdrop: false,
    });
    return await ref.afterClosed();
  }

  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }

  trackZone  = (_: number, z: Zone) => z.id;
  trackGroup = (_: number, g: RateGroup) => `${g.name}::${g.type}`;
  trackService = (_: number, s: RateService) => s.name;
  trackRate  = (_: number, r: Rate) => r.id;
}
