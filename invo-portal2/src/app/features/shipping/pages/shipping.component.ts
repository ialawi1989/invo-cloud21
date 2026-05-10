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

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
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
  Zone,
  emptyRate,
  emptyZone,
} from '../services/shipping.types';
import {
  CountryPickerModalComponent,
  CountryPickerModalData,
  CountryPickerModalResult,
} from '../components/country-picker-modal/country-picker-modal.component';

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
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
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
  groupedZones = computed<Array<Zone & { groups: RateGroup[] }>>(() => {
    return this.zones().map(z => ({
      ...z,
      groups: this.groupRates(z.rates),
    }));
  });

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
          if (!this.isRangeValid(r)) return true;
        }
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
  editingDraft = signal<{ name: string; type: 'weight' | 'total'; note: string } | null>(null);

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed<boolean>(() =>
    !this.hasErrors() && this.isDirty() && !this.saving() && this.editingGroup() === null,
  );

  constructor() {
    withTranslations('shipping');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [zones, countries] = await Promise.all([
        this.service.loadZones(),
        this.service.loadCountries(),
      ]);
      this.zones.set(zones);
      this.countries.set(countries.map(c => c.name).sort());
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
    this.editingDraft.update(d => d ? { ...d, [key]: key === 'type' ? (value as 'weight' | 'total') : value } : d);
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
    const newRate = emptyRate('', 'weight', '');
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
        ? { ...z, rates: [...z.rates, emptyRate(g.name, g.type, g.note)] }
        : z,
    ));
  }

  setRange<K extends keyof Rate>(zoneId: number, rateId: number, key: K, value: Rate[K]): void {
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
  isRangeValid(r: Rate): boolean {
    const from = parseFloat(r.from);
    const to   = parseFloat(r.to);
    return Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from;
  }

  // ─── Save / Cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) {
      if (this.editingGroup() !== null) this.toast.warning('SHIPPING.ERR_UNSAVED_GROUP');
      else if (this.hasErrors())        this.toast.warning('SHIPPING.ERR_VALIDATION');
      return;
    }
    this.saving.set(true);
    try {
      const res = await this.service.saveZones(this.zones());
      if (res.success) {
        this.cleanSnapshot.set(this.snapshot());
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res.msg);
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
      g.ranges.sort((a, b) => parseFloat(a.from || '0') - parseFloat(b.from || '0'));
      g.gaps     = this.detectGaps(g.ranges);
      g.overlaps = this.detectOverlaps(g.ranges);
    }
    return Array.from(map.values());
  }

  private detectGaps(ranges: Rate[]): Gap[] {
    const out: Gap[] = [];
    for (let i = 0; i < ranges.length - 1; i++) {
      const cTo = parseFloat(ranges[i].to);
      const nFrom = parseFloat(ranges[i + 1].from);
      if (Number.isFinite(cTo) && Number.isFinite(nFrom) && cTo < nFrom) {
        out.push({ from: cTo, to: nFrom, afterRange: i });
      }
    }
    return out;
  }

  private detectOverlaps(ranges: Rate[]): Overlap[] {
    const out: Overlap[] = [];
    for (let i = 0; i < ranges.length - 1; i++) {
      const cTo = parseFloat(ranges[i].to);
      const nFrom = parseFloat(ranges[i + 1].from);
      if (Number.isFinite(cTo) && Number.isFinite(nFrom) && cTo > nFrom) {
        out.push({ range1: ranges[i], range2: ranges[i + 1] });
      }
    }
    return out;
  }

  private async openCountryPicker(data: CountryPickerModalData): Promise<string[] | undefined> {
    const ref = this.modal.open<
      CountryPickerModalComponent,
      CountryPickerModalData,
      CountryPickerModalResult
    >(CountryPickerModalComponent, {
      size: 'md',
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
  trackRate  = (_: number, r: Rate) => r.id;
}
