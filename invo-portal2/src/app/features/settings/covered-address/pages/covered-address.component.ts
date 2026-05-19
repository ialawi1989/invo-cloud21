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
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import {
  ImportSummaryCounts,
  ImportWizardConfig,
} from '@shared/components/import-wizard/import-wizard.types';

import { CoveredAddressService } from '../services/covered-address.service';
import {
  BulkAssignFields,
  CountryAddress,
  CoveredAddressRow,
  emptyBulkAssign,
  emptyRow,
  emptyTranslation,
  TranslationLang,
} from '../services/covered-address.types';
import { BranchSettingsService } from '../../services/branch-settings.service';
import {
  TranslationModalComponent,
  TranslationModalData,
} from '../components/translation-modal/translation-modal.component';

interface BranchOption { id: string; name: string; }
interface TypeOption   { value: string; label: string; }

/** Built-in types are auto-generated from the country list. Anything
 *  else is treated as a free-form custom type — the user types one
 *  in the search input and rows become user-managed. */
const BUILT_IN_TYPES = ['Governorate', 'City', 'Block'] as const;
type BuiltInType = typeof BUILT_IN_TYPES[number];

/** What's the parent-type for each built-in? Drives the auto-
 *  generation's `parent` column. Block → City → Governorate;
 *  Governorate has no parent. */
const PARENT_OF: Record<string, string> = {
  Block: 'City',
  City:  'Governorate',
};

/**
 * Covered Addresses page (`/settings/covered-address`). Single
 * configuration per company — type picker drives auto-generation
 * from the country list, then the user fills in per-row delivery
 * economics (charge, minimum order, free threshold, branch, note).
 *
 * Mirrors the legacy InvoCloudFront2 page but uses modern signals
 * + standalone components, the shared `<app-search-dropdown>`,
 * `<app-toast>`, `<app-dropdown-menu-btn>`, and the unsaved-changes
 * guard. Save bar is fixed; Cmd/Ctrl+S saves; outside-click does
 * not trigger anything destructive.
 */
@Component({
  selector: 'app-covered-address',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './covered-address.component.html',
  styleUrl:    './covered-address.component.scss',
})
export class CoveredAddressComponent implements OnInit, CanLeaveComponent {
  private service       = inject(CoveredAddressService);
  private branchService = inject(BranchSettingsService);
  private translate     = inject(TranslateService);
  private modal         = inject(ModalService);
  private toast         = inject(ToastService);
  private router        = inject(Router);
  private destroyRef    = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Country-supplied addresses — used to auto-generate rows for
   *  built-in types and to resolve translations on save. */
  countryAddresses = signal<CountryAddress[]>([]);

  /** The currently-selected address type. Drives auto-generation. */
  type = signal<string>('');

  /** Editable rows. Always the source of truth — bulk operations,
   *  search, etc. update this via signal mutations. */
  rows = signal<CoveredAddressRow[]>([]);

  /** Branches for the per-row + bulk Branch picker. Loaded once
   *  on init (this page edits a single company-wide config; we
   *  don't need pagination). */
  branches = signal<BranchOption[]>([]);

  /** Free-form search inside the table. Filters via `showInSearch`. */
  search = signal<string>('');

  /** Bulk-assign panel — mirrors the legacy "Set value to all" +
   *  "Apply to selected" pair. Empty fields are skipped on apply. */
  bulkOpen = signal<boolean>(false);
  bulk     = signal<BulkAssignFields>(emptyBulkAssign());

  /** Snapshot of the last-saved/loaded state. Drives the dirty
   *  guard + Save button enable. */
  cleanSnapshot = signal<string>('');

  // ─── i18n re-render hook ────────────────────────────────────────
  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),         routerLink: '/settings' },
      { label: this.translate.instant('COVERED_ADDRESS.TITLE') },
    ];
  });

  /** Type-picker options. Pre-translated at compute time because
   *  `<app-search-dropdown>` renders the option's `displayWith`
   *  result verbatim — there's no translate pipe inside the
   *  dropdown's row template. `i18nTick` re-runs this when the
   *  language changes so the menu doesn't go stale. */
  typeOptions = computed<TypeOption[]>(() => {
    this.i18nTick();
    return [
      { value: 'Governorate', label: this.translate.instant('COVERED_ADDRESS.TYPE_GOVERNORATE') },
      { value: 'City',        label: this.translate.instant('COVERED_ADDRESS.TYPE_CITY') },
      { value: 'Block',       label: this.translate.instant('COVERED_ADDRESS.TYPE_BLOCK') },
    ];
  });

  // SearchDropdown adapters used by both the type picker and
  // the branch pickers. Generic over `{ id, name }`.
  display = (o: any) => o?.label ?? o?.name ?? '';
  compare = (a: any, b: any) => (a?.id ?? a?.value ?? null) === (b?.id ?? b?.value ?? null);
  toValue = (o: any) => o?.id ?? o?.value ?? '';

  selectedTypeOption = computed<TypeOption | null>(() => {
    const t = this.type();
    if (!t) return null;
    return this.typeOptions().find(o => o.value === t)
      // Custom type — surface verbatim so the dropdown can display it.
      ?? { value: t, label: t };
  });

  /** Resolve a branch id to its `BranchOption` so the dropdown's
   *  `[value]` binding can show the current selection's label.
   *  Falls through with a placeholder option (`name === id`) while
   *  branches are still loading so the dropdown doesn't blank
   *  out and re-render. */
  branchById = (id: string): BranchOption | null => {
    if (!id) return null;
    return this.branches().find(b => b.id === id) ?? { id, name: id };
  };

  /** Bulk-panel branch picker has its own resolver so a `null`
   *  selection (no override) round-trips cleanly through the
   *  search-dropdown's `[value]`. */
  bulkBranchValue = computed<BranchOption | null>(() =>
    this.branchById(this.bulk().branchId),
  );

  /** SearchDropdown's `valueChange` is `T | T[] | null`. Tighten
   *  to a single `BranchOption | null` once at the edge so the
   *  callers stay terse. */
  private pickedBranch(v: BranchOption | BranchOption[] | null): string {
    const b = Array.isArray(v) ? v[0] ?? null : v;
    return b?.id ?? '';
  }
  onRowBranchChange(idx: number, v: BranchOption | BranchOption[] | null): void {
    this.setRow(idx, { branchId: this.pickedBranch(v) });
  }
  onBulkBranchChange(v: BranchOption | BranchOption[] | null): void {
    this.setBulk('branchId', this.pickedBranch(v));
  }

  /** Filtered view used by the table. Honours the search box and
   *  hides nothing else — selection state is independent of the
   *  current filter. */
  filteredRows = computed<CoveredAddressRow[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(r =>
      (r.address  || '').toLowerCase().includes(q) ||
      (r.parent   || '').toLowerCase().includes(q) ||
      (r.note     || '').toLowerCase().includes(q),
    );
  });

  /** Group the filtered rows by parent so the table can show a
   *  "Southern" / "Capital" / etc. header above each cluster.
   *  Returns a single ungrouped bucket (parent = '') for types
   *  that don't have a parent (Governorate, custom). Groups are
   *  sorted alphabetically; rows inside a group preserve the
   *  source order so the user's manual additions stay where they
   *  expect. */
  groupedRows = computed<{ parent: string; rows: CoveredAddressRow[] }[]>(() => {
    const list = this.filteredRows();
    const t    = this.type();
    // No-parent types render flat — single bucket, no header.
    if (!t || t === 'Governorate' || !this.isBuiltIn(t)) {
      return list.length ? [{ parent: '', rows: list }] : [];
    }
    const map = new Map<string, CoveredAddressRow[]>();
    for (const r of list) {
      const k = r.parent || '';
      const bucket = map.get(k);
      if (bucket) bucket.push(r);
      else        map.set(k, [r]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([parent, rows]) => ({ parent, rows }));
  });

  /** Group-level select-all helpers — checked when every row in
   *  the group is selected; click toggles the group as a unit. */
  isGroupAllSelected(rows: CoveredAddressRow[]): boolean {
    return rows.length > 0 && rows.every(r => r.isSelected);
  }
  toggleGroupSelection(rows: CoveredAddressRow[], checked: boolean): void {
    const lookup = new Set(rows);
    this.rows.update(list => list.map(r => lookup.has(r) ? { ...r, isSelected: checked } : r));
  }

  selectedCount = computed<number>(() =>
    this.rows().filter(r => r.isSelected).length,
  );

  selectAll = computed<boolean>(() => {
    const rs = this.rows();
    return rs.length > 0 && rs.every(r => r.isSelected);
  });

  /** Validation + Save-button gate. Surface errors on the page
   *  instead of an alert so the user can fix while seeing the
   *  rule. Single string keeps the UI dead simple. */
  validationError = computed<string | null>(() => {
    const rs = this.rows();
    if (rs.length === 0) return 'COVERED_ADDRESS.ERR_NO_ROWS';

    // Duplicate names
    const seen = new Set<string>();
    for (const r of rs) {
      const k = (r.address || '').trim().toLowerCase();
      if (k && seen.has(k)) return 'COVERED_ADDRESS.ERR_DUPLICATE_NAMES';
      if (k) seen.add(k);
    }

    // Missing name or branch (Governorate type doesn't require a branch)
    if (this.type() !== 'Governorate') {
      for (const r of rs) {
        if (!r.address?.trim() || !r.branchId) {
          return 'COVERED_ADDRESS.ERR_MISSING_NAME_OR_BRANCH';
        }
      }
    }
    return null;
  });

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed<boolean>(() =>
    !this.validationError() && this.isDirty() && !this.saving(),
  );

  constructor() {
    withTranslations('settings/covered-address');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      // Branches in parallel with the address payload — the page
      // can't render meaningfully without either, so fan-out
      // beats serial.
      const [payload, branchRes] = await Promise.all([
        this.service.load(),
        this.branchService.getList({ page: 1, limit: 200 }),
      ]);

      this.countryAddresses.set(payload.countryAddresses);
      this.type.set(payload.coveredAddresses.type ?? '');
      this.rows.set(payload.coveredAddresses.coveredAddresses);

      this.branches.set(
        (branchRes?.list ?? [])
          .map(b => ({ id: String((b as any).id ?? ''), name: String((b as any).name ?? '') }))
          .filter(b => b.id),
      );

      this.cleanSnapshot.set(this.snapshot());
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Type picker ────────────────────────────────────────────────
  /** User picked a different type. If they had any rows in flight,
   *  confirm before reseeding so we don't silently nuke their
   *  unsaved edits. */
  async onTypeChange(picked: TypeOption | TypeOption[] | null): Promise<void> {
    const opt = Array.isArray(picked) ? picked[0] ?? null : picked;
    const next = opt?.value ?? '';
    if (next === this.type()) return;

    if (this.rows().length > 0) {
      const ok = await this.confirm({
        title:   this.translate.instant('COVERED_ADDRESS.TYPE'),
        message: this.translate.instant('COVERED_ADDRESS.TYPE_CONFIRM'),
        confirm: this.translate.instant('COMMON.YES'),
        danger:  true,
      });
      if (!ok) return;
    }

    this.type.set(next);
    this.regenerateRows();
  }

  /** Repopulate `rows` from the country list for built-in types,
   *  or clear them for custom types (user adds manually). */
  private regenerateRows(): void {
    const t = this.type();
    if (this.isBuiltIn(t)) {
      const seen = new Set<string>();
      const out: CoveredAddressRow[] = [];
      for (const c of this.countryAddresses()) {
        const name = (c as any)[t] as string | undefined;
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const parentName = PARENT_OF[t] ? String((c as any)[PARENT_OF[t]] ?? '') : '';
        out.push({
          ...emptyRow(),
          newlyAdded:  false,
          address:     name,
          parent:      parentName,
          translation: { ...c.translation },
        });
      }
      this.rows.set(out);
    } else {
      this.rows.set([]);
    }
  }

  isBuiltIn(t: string): t is BuiltInType {
    return (BUILT_IN_TYPES as readonly string[]).includes(t);
  }

  // ─── Row mutation helpers ───────────────────────────────────────
  /** Generic field setter — keeps the rows array immutable so
   *  signal change-detection fires consistently. */
  setRow(idx: number, patch: Partial<CoveredAddressRow>): void {
    this.rows.update(list =>
      list.map((r, i) => (i === idx ? { ...r, ...this.normalizePatch(patch) } : r)),
    );
  }

  /** Numeric fields can't go negative. Anything else passes
   *  through. Centralised so every input doesn't have to repeat
   *  this rule. */
  private normalizePatch(patch: Partial<CoveredAddressRow>): Partial<CoveredAddressRow> {
    const out: any = { ...patch };
    for (const k of ['deliveryCharge', 'minimumOrder', 'freeDeliveryOver'] as const) {
      if (k in out) {
        const v = out[k];
        if (v === '' || v == null) {
          out[k] = k === 'freeDeliveryOver' ? null : 0;
        } else {
          const n = Number(v);
          out[k] = Number.isFinite(n) && n >= 0 ? n : 0;
        }
      }
    }
    return out;
  }

  /** Select-all toggles every row's `isSelected` based on the
   *  current state — shared with the row-level checkbox via
   *  the `selectAll()` computed. */
  toggleSelectAll(checked: boolean): void {
    this.rows.update(list => list.map(r => ({ ...r, isSelected: checked })));
  }

  toggleRowSelection(idx: number, checked: boolean): void {
    this.setRow(idx, { isSelected: checked });
  }

  addRow(): void {
    // Prepend so the user sees the new (empty) row immediately
    // without scrolling.
    this.rows.update(list => [{ ...emptyRow() }, ...list]);
  }

  async removeRow(idx: number): Promise<void> {
    const ok = await this.confirm({
      title:   this.translate.instant('COMMON.DELETE'),
      message: this.translate.instant('COMMON.CONFIRM_DELETE'),
      confirm: this.translate.instant('COMMON.DELETE'),
      danger:  true,
    });
    if (!ok) return;
    this.rows.update(list => list.filter((_, i) => i !== idx));
  }

  /** Delete every selected row. Acts on `rows()` directly (not
   *  the filtered view) so a hidden-but-selected row still gets
   *  removed. The dirty guard then catches the change so Save
   *  reflects the new state. */
  async removeSelected(): Promise<void> {
    const count = this.selectedCount();
    if (count === 0) return;
    const ok = await this.confirm({
      title:   this.translate.instant('COMMON.DELETE'),
      message: this.translate.instant('COVERED_ADDRESS.CONFIRM_DELETE_SELECTED', { count }),
      confirm: this.translate.instant('COMMON.DELETE'),
      danger:  true,
    });
    if (!ok) return;
    this.rows.update(list => list.filter(r => !r.isSelected));
    this.toast.success(this.translate.instant('COVERED_ADDRESS.DELETED_COUNT', { count }));
  }

  /** Find the original index in `rows()` for a row in the filtered
   *  view. The table loops over `filteredRows()` for display but
   *  mutations target the source array. */
  indexOfRow(row: CoveredAddressRow): number {
    return this.rows().indexOf(row);
  }

  // ─── Bulk apply ─────────────────────────────────────────────────
  resetBulk(): void {
    this.bulk.set(emptyBulkAssign());
  }

  setBulk<K extends keyof BulkAssignFields>(key: K, value: BulkAssignFields[K]): void {
    this.bulk.update(b => ({ ...b, [key]: value }));
  }

  /** Returns true if at least one bulk-assign field has a usable
   *  value. Empty strings / nulls don't count. */
  private hasBulkValue(): boolean {
    const b = this.bulk();
    return (
      b.deliveryCharge   != null ||
      b.minimumOrder     != null ||
      b.freeDeliveryOver != null ||
      !!b.branchId ||
      !!b.note
    );
  }

  async applyBulk(target: 'selected' | 'all'): Promise<void> {
    if (!this.hasBulkValue()) {
      this.toast.warning('COVERED_ADDRESS.BULK.NO_FIELDS');
      return;
    }

    const total = this.rows().length;
    const selectedCount = this.selectedCount();
    if (target === 'selected' && selectedCount === 0) {
      this.toast.warning('COVERED_ADDRESS.BULK.NO_SELECTION');
      return;
    }

    const count = target === 'selected' ? selectedCount : total;
    const messageKey = target === 'selected'
      ? 'COVERED_ADDRESS.BULK.CONFIRM_BODY_SEL'
      : 'COVERED_ADDRESS.BULK.CONFIRM_BODY_ALL';
    const ok = await this.confirm({
      title:   this.translate.instant('COVERED_ADDRESS.BULK.CONFIRM_TITLE'),
      message: this.translate.instant(messageKey, { count }),
      confirm: this.translate.instant('COMMON.YES'),
    });
    if (!ok) return;

    const b = this.bulk();
    this.rows.update(list => list.map(r => {
      if (target === 'selected' && !r.isSelected) return r;
      const next: CoveredAddressRow = { ...r };
      if (b.deliveryCharge   != null) next.deliveryCharge   = b.deliveryCharge;
      if (b.minimumOrder     != null) next.minimumOrder     = b.minimumOrder;
      if (b.freeDeliveryOver != null) next.freeDeliveryOver = b.freeDeliveryOver;
      if (b.branchId)                  next.branchId         = b.branchId;
      if (b.note)                      next.note             = b.note;
      return next;
    }));

    this.resetBulk();
    this.toast.success(this.translate.instant('COVERED_ADDRESS.BULK.DONE', { count }));
  }

  // ─── Translation editor ─────────────────────────────────────────
  /** Open the en/ar editor for one of the row's translation
   *  buckets. The bucket the user edits depends on the current
   *  type — Governorate vs. City. */
  async editTranslation(idx: number): Promise<void> {
    const row = this.rows()[idx];
    if (!row) return;
    const t = this.type();
    const bucket: 'City' | 'Governorate' = t === 'City' ? 'City' : 'Governorate';

    const ref = this.modal.open<
      TranslationModalComponent,
      TranslationModalData,
      TranslationLang | undefined
    >(TranslationModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant(
          bucket === 'City'
            ? 'COVERED_ADDRESS.TRANSLATION_CITY'
            : 'COVERED_ADDRESS.TRANSLATION_GOVERNORATE',
        ),
        value: row.translation?.[bucket] ?? { en: '', ar: '' },
      },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;

    this.setRow(idx, {
      translation: {
        ...(row.translation ?? emptyTranslation()),
        [bucket]: result,
      },
      // Keep the visible name in sync with the chosen English
      // translation — matches the legacy behaviour.
      address: result.en || row.address,
    });
  }

  /** Some auto-generated rows (rows whose name appears in the
   *  country list for any type) shouldn't have their name edited
   *  inline. The legacy app encodes this as `isShouldDisabled`. */
  isNameLocked(row: CoveredAddressRow): boolean {
    if (row.newlyAdded) return false;
    return this.countryAddresses().some(c =>
      c.Governorate === row.address ||
      c.City        === row.address ||
      c.Block       === row.address,
    );
  }

  // ─── Save / Cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      // Re-resolve translations from the country list right before
      // save — covers the case where the user edited a row's name
      // back to a known address after switching types.
      const merged = this.rows().map(r => {
        const t = this.type();
        if (!this.isBuiltIn(t)) return r;
        const match = this.countryAddresses().find(c => (c as any)[t] === r.address);
        return match ? { ...r, translation: { ...match.translation } } : r;
      });

      const res = await this.service.save({
        type: this.type(),
        coveredAddresses: merged,
      });

      if (res.success) {
        this.rows.set(merged);
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

  // ─── Import (CSV / XLSX) ────────────────────────────────────────
  /** Open the shared `<app-import-wizard>` with the covered-
   *  addresses column schema. On apply the wizard hands us back
   *  the validated rows; we replace the in-memory `rows` array
   *  (the user still has to click Save to persist). */
  async openImport(): Promise<void> {
    // Snapshot the branches at open-time so the wizard's row
    // validators don't have to read signals each time.
    const branchByName = new Map<string, string>();
    for (const b of this.branches()) branchByName.set(b.name.trim().toLowerCase(), b.id);

    // Country list lookup so we can re-attach translation when
    // an imported address matches a known city/governorate.
    const t = this.type();
    const countryByName = new Map<string, CountryAddress>();
    for (const c of this.countryAddresses()) {
      const k = (c as any)[t];
      if (k) countryByName.set(String(k), c);
    }

    const config: ImportWizardConfig = {
      title: this.translate.instant('COVERED_ADDRESS.IMPORT.TITLE'),
      hint:  'COVERED_ADDRESS.IMPORT.HINT',
      columns: [
        { key: 'address',           label: 'COVERED_ADDRESS.TABLE.ADDRESS' },
        { key: 'deliveryCharge',    label: 'COVERED_ADDRESS.TABLE.DELIVERY_CHARGE' },
        { key: 'minimumOrder',      label: 'COVERED_ADDRESS.TABLE.MIN_ORDER' },
        { key: 'freeDeliveryOver',  label: 'COVERED_ADDRESS.TABLE.FREE_OVER' },
        { key: 'branch',            label: 'COVERED_ADDRESS.TABLE.BRANCH' },
        { key: 'note',              label: 'COVERED_ADDRESS.TABLE.NOTE' },
      ],
      templateRows: [
        ['address', 'deliveryCharge', 'minimumOrder', 'freeDeliveryOver', 'branch', 'note'],
        ['Manama',  1,                5,              20,                 'Main',   ''],
      ],
      templateName: 'covered-address-template',
      validate: (cells) => {
        const errs: string[] = [];
        if (!cells['address']?.trim()) {
          errs.push(this.translate.instant('COVERED_ADDRESS.IMPORT.ERR_NAME_REQUIRED'));
        }
        // Numeric fields — empty is fine (defaults to 0); a
        // non-numeric string isn't.
        for (const k of ['deliveryCharge', 'minimumOrder', 'freeDeliveryOver'] as const) {
          const v = cells[k];
          if (v != null && v !== '' && !Number.isFinite(Number(v))) {
            errs.push(this.translate.instant('COVERED_ADDRESS.IMPORT.ERR_NUMERIC', { field: k }));
            break;
          }
        }
        // Branch name must resolve to an existing branch (only
        // when one was provided — Governorate-type rows can omit it).
        const branch = cells['branch']?.trim();
        if (branch && !branchByName.has(branch.toLowerCase())) {
          errs.push(this.translate.instant('COVERED_ADDRESS.IMPORT.ERR_UNKNOWN_BRANCH', { branch }));
        }
        return { errors: errs };
      },
      duplicateKey: (cells) => (cells['address'] ?? '').trim().toLowerCase(),
      modes: [
        {
          value:       'add_update',
          label:       'COVERED_ADDRESS.IMPORT.MODE_ADD_UPDATE',
          description: 'COVERED_ADDRESS.IMPORT.MODE_ADD_UPDATE_DESC',
        },
        {
          value:       'override',
          label:       'COVERED_ADDRESS.IMPORT.MODE_OVERRIDE',
          description: 'COVERED_ADDRESS.IMPORT.MODE_OVERRIDE_DESC',
          warn:        true,
        },
        {
          value:       'add_only',
          label:       'COVERED_ADDRESS.IMPORT.MODE_ADD_ONLY',
          description: 'COVERED_ADDRESS.IMPORT.MODE_ADD_ONLY_DESC',
        },
      ],
      defaultMode: 'add_update',
      submit: async (rows, opts) => {
        const num = (v: string | undefined): number => {
          const n = Number(v ?? 0);
          return Number.isFinite(n) && n >= 0 ? n : 0;
        };
        const numOrNull = (v: string | undefined): number | null => {
          if (v == null || v === '') return null;
          const n = Number(v);
          return Number.isFinite(n) && n >= 0 ? n : null;
        };
        const parentKey = ({ Block: 'City', City: 'Governorate' } as Record<string, string>)[t] ?? '';

        // Materialise each incoming CSV/XLSX row into a fully-
        // typed `CoveredAddressRow`. Branch-name → id resolution
        // and country-list re-attach happen here so the merge
        // step below can compare apples to apples with what's
        // already in `rows()`.
        const incoming: CoveredAddressRow[] = rows.map(r => {
          const addr = (r['address'] ?? '').trim();
          const branchName = (r['branch'] ?? '').trim();
          const branchId = branchByName.get(branchName.toLowerCase()) ?? '';
          const country = countryByName.get(addr);
          const translation = country ? { ...country.translation } : emptyTranslation();
          const parent = country && this.isBuiltIn(t) && parentKey
            ? String((country as any)[parentKey] ?? '')
            : '';

          return {
            branchId,
            address:          addr,
            parent,
            note:             r['note'] ?? '',
            deliveryCharge:   num(r['deliveryCharge']),
            minimumOrder:     num(r['minimumOrder']),
            freeDeliveryOver: numOrNull(r['freeDeliveryOver']),
            translation,
            // Name-lock still applies if the address matches a
            // country entry; otherwise it's user-managed.
            newlyAdded:   !country,
            isSelected:   false,
            showInSearch: true,
          };
        });

        // Pick the merge strategy by mode. `address` (lower-cased)
        // is the primary key for matching against existing rows.
        const keyOf = (r: { address: string }) => r.address.trim().toLowerCase();
        const existing = this.rows();
        let merged: CoveredAddressRow[];
        let added = 0, updated = 0, skipped = 0;

        switch (opts.mode) {
          case 'override': {
            // Replace All — drop existing entirely, keep only
            // what was just imported.
            merged = incoming;
            added  = incoming.length;
            break;
          }
          case 'add_only': {
            // Keep existing exactly as-is; append only incoming
            // rows whose address isn't already covered.
            const taken = new Set<string>(existing.map(keyOf));
            const newOnes = incoming.filter(r => !taken.has(keyOf(r)));
            skipped = incoming.length - newOnes.length;
            added   = newOnes.length;
            merged  = [...existing, ...newOnes];
            break;
          }
          case 'add_update':
          default: {
            // Merge by address — incoming wins on conflict.
            const map = new Map<string, CoveredAddressRow>();
            for (const r of existing) map.set(keyOf(r), r);
            for (const r of incoming) {
              const k = keyOf(r);
              if (map.has(k)) updated++;
              else            added++;
              map.set(k, r);
            }
            merged = Array.from(map.values());
            break;
          }
        }

        // Stage the result. The user still has to click Save to
        // persist — surface counts so the Complete screen tells
        // them what landed.
        this.rows.set(merged);
        return {
          ok: true,
          result: {
            total:      incoming.length,
            successful: added + updated,
            failed:     0,
            skipped,
          },
        };
      },
      notes: {
        sections: [
          {
            title: 'COMMON.IMPORT_WIZARD.REQUIRED_FIELDS',
            items: [
              'COVERED_ADDRESS.IMPORT.REQ_FIELD_ADDRESS',
              'COVERED_ADDRESS.IMPORT.REQ_FIELD_BRANCH',
              'COVERED_ADDRESS.IMPORT.REQ_FIELD_NUMBERS',
            ],
          },
          {
            title: 'COMMON.IMPORT_WIZARD.IMPORT_MODES',
            items: [
              'COVERED_ADDRESS.IMPORT.MODE_HINT_ADD_UPDATE',
              'COVERED_ADDRESS.IMPORT.MODE_HINT_OVERRIDE',
              'COVERED_ADDRESS.IMPORT.MODE_HINT_ADD_ONLY',
            ],
          },
        ],
        tip: 'COVERED_ADDRESS.IMPORT.TIP',
      },
    };

    const ref = this.modal.open<
      ImportWizardComponent,
      ImportWizardConfig,
      ImportSummaryCounts | undefined
    >(ImportWizardComponent, {
      size: 'lg',
      data: config,
      closeOnBackdrop: false,
    });
    await ref.afterClosed();
  }

  // ─── Unsaved-changes guard plumbing ─────────────────────────────
  private snapshot(): string {
    return JSON.stringify({
      type: this.type(),
      rows: this.rows().map(r => ({
        branchId:         r.branchId,
        address:          r.address,
        parent:           r.parent,
        note:             r.note,
        deliveryCharge:   r.deliveryCharge,
        minimumOrder:     r.minimumOrder,
        freeDeliveryOver: r.freeDeliveryOver,
        translation:      r.translation,
      })),
    });
  }

  hasUnsavedChanges(): boolean {
    return this.isDirty();
  }

  // ─── Keyboard ───────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }

  // ─── Confirm helper ─────────────────────────────────────────────
  private async confirm(data: ConfirmModalData): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      { size: 'sm', data, closeOnBackdrop: false },
    );
    return (await ref.afterClosed()) === true;
  }

  trackRow = (_: number, r: CoveredAddressRow) => r.address + ':' + r.parent;
}
