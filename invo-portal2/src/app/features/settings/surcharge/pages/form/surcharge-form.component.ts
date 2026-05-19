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
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import type {
  DropdownLoadFn,
  DropdownLoadResult,
} from '@shared/components/dropdown/search-dropdown.types';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

import { SurchargeService } from '../../services/surcharge.service';
import { Surcharge, emptySurcharge } from '../../services/surcharge.types';
import { TaxSettingsService } from '../../../services/tax-settings.service';

interface TaxOption { id: string; name: string; }

/**
 * Surcharge editor (`/settings/surcharge/:id`). Uses `id === 'new'`
 * for creates so the URL is meaningful before save.
 *
 * Mirrors the price-label form's chrome — fixed save bar, Cmd/Ctrl+S
 * shortcut, snapshot-based unsaved-changes guard, Toast on save
 * result. The amount field is a paired input + Fixed/Percent toggle
 * (legacy `discount-field` equivalent, inlined here).
 */
@Component({
  selector: 'app-surcharge-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './surcharge-form.component.html',
  styleUrl:    './surcharge-form.component.scss',
})
export class SurchargeFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(SurchargeService);
  private taxService = inject(TaxSettingsService);
  private translate  = inject(TranslateService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  surcharge = signal<Surcharge>(emptySurcharge());

  /** Snapshot of the last clean state — used by the unsaved-changes
   *  guard to compare against the current edit state. */
  cleanSnapshot = signal<string>('');

  taxes = signal<TaxOption[]>([]);

  private i18nTick = signal(0);

  isExisting = computed<boolean>(() => !!this.surcharge().id);

  pageTitle = computed<string>(() => {
    this.i18nTick();
    const s = this.surcharge();
    return s.id
      ? this.translate.instant('SURCHARGE.FORM.EDIT_TITLE', { name: s.name || '—' })
      : this.translate.instant('SURCHARGE.FORM.NEW_TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),         routerLink: '/settings' },
      { label: this.translate.instant('SURCHARGE.LIST.TITLE'),   routerLink: '/settings/surcharge' },
      { label: this.pageTitle() },
    ];
  });

  /** Load handler for the tax dropdown — server-paginates by
   *  forwarding the dropdown's page/pageSize/searchTerm. Caches
   *  the first page so the selected-tax `displayWith` resolves
   *  on first render without an extra round-trip. */
  loadTaxes: DropdownLoadFn<TaxOption> = async (params) => {
    const res = await this.taxService.getTaxesList({
      page:       params.page,
      limit:      params.pageSize,
      searchTerm: params.search || '',
    });
    const list: any[] = Array.isArray(res?.list) ? res.list : (Array.isArray(res) ? res : []);
    const mapped: TaxOption[] = list
      .map(t => ({ id: String(t?.id ?? ''), name: String(t?.name ?? '') }))
      .filter(t => t.id);
    if (params.page === 1) this.taxes.set(mapped);
    const total = Number(res?.count ?? mapped.length) || 0;
    const hasMore = params.page * params.pageSize < total;
    return { items: mapped, hasMore } satisfies DropdownLoadResult<TaxOption>;
  };

  /** One-shot pre-load so `selectedTax` can resolve the current
   *  surcharge's `taxId` to a name on first render. */
  private async preloadTaxes(): Promise<void> {
    if (this.taxes().length > 0) return;
    const res = await this.taxService.getTaxesList({ page: 1, limit: 200 });
    const list: any[] = Array.isArray(res?.list) ? res.list : (Array.isArray(res) ? res : []);
    this.taxes.set(
      list.map(t => ({ id: String(t?.id ?? ''), name: String(t?.name ?? '') }))
          .filter(t => t.id),
    );
  }

  /** SearchDropdown adapters. */
  display    = (t: TaxOption | null) => t?.name ?? '';
  compare    = (a: TaxOption | null, b: TaxOption | null) => (a?.id ?? '') === (b?.id ?? '');
  toValue    = (t: TaxOption | null) => t?.id ?? '';
  selectedTax = computed<TaxOption | null>(() => {
    const id = this.surcharge().taxId;
    if (!id) return null;
    const found = this.taxes().find(t => t.id === id);
    return found ?? { id, name: id };  // best-effort while taxes haven't loaded
  });

  constructor() {
    withTranslations('settings/surcharge');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.loading.set(true);
      try {
        const fresh = await this.service.getById(id);
        if (fresh) this.surcharge.set(fresh);
      } finally {
        this.loading.set(false);
      }
    }
    // Pre-load taxes so the dropdown can resolve the current
    // selection's display name on first render.
    await this.preloadTaxes();
    this.cleanSnapshot.set(this.snapshot());
  }

  // ─── Field setters ──────────────────────────────────────────────
  setName(v: string): void {
    this.surcharge.update(s => ({ ...s, name: v }));
  }
  setAmount(v: number | string): void {
    const n = Number(v);
    this.surcharge.update(s => ({ ...s, amount: Number.isFinite(n) ? n : 0 }));
  }
  setPercentage(percentage: boolean): void {
    this.surcharge.update(s => ({ ...s, percentage }));
  }

  /** Bridge between the boolean `percentage` flag on the model and
   *  the segmented toggle's `'fixed' | 'percent'` value space. */
  readonly amountKindOptions: SegmentedToggleOption<'fixed' | 'percent'>[] = [
    { value: 'fixed',   label: 'SURCHARGE.FORM.FIXED' },
    { value: 'percent', label: 'SURCHARGE.FORM.PERCENT' },
  ];
  amountKind = computed<'fixed' | 'percent'>(() => this.surcharge().percentage ? 'percent' : 'fixed');
  onAmountKindChange(kind: 'fixed' | 'percent'): void {
    this.setPercentage(kind === 'percent');
  }
  /** Tax dropdown is configured for single-select but its
   *  `valueChange` is typed as `T | T[] | null`. Narrow at the
   *  edge so the rest of the form doesn't have to. */
  setTaxId(t: TaxOption | TaxOption[] | null): void {
    const picked = Array.isArray(t) ? t[0] ?? null : t;
    this.surcharge.update(s => ({ ...s, taxId: picked?.id ?? null }));
  }

  // ─── Validation ─────────────────────────────────────────────────
  nameError = computed<string | null>(() => {
    if (!this.surcharge().name.trim()) return 'SURCHARGE.FORM.ERR_NAME_REQUIRED';
    return null;
  });
  amountError = computed<string | null>(() => {
    const a = this.surcharge().amount;
    if (!Number.isFinite(a) || a < 0) return 'SURCHARGE.FORM.ERR_AMOUNT_INVALID';
    return null;
  });
  /** Tracks whether the in-memory form differs from the last
   *  saved/loaded snapshot. Drives the Save button's disabled
   *  state and the unsaved-changes guard. Computed (not a method)
   *  so the template's `[disabled]` binding stays reactive without
   *  manual change detection. */
  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());

  canSave = computed<boolean>(() =>
    !this.nameError() && !this.amountError() && !this.saving() && this.isDirty(),
  );

  // ─── Save / Cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.surcharge());
      if (res?.id) {
        this.surcharge.update(s => ({ ...s, id: res.id }));
        this.cleanSnapshot.set(this.snapshot());
        // Replace URL so refresh lands back on the saved record
        // instead of `/new`.
        if (this.route.snapshot.paramMap.get('id') === 'new') {
          void this.router.navigate(['/settings/surcharge', res.id], { replaceUrl: true });
        }
        this.toast.success('COMMON.SAVED_OK');
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/settings/surcharge']);
  }

  // ─── Unsaved-changes guard ──────────────────────────────────────
  private snapshot(): string { return JSON.stringify(this.surcharge()); }
  hasUnsavedChanges(): boolean {
    return this.snapshot() !== this.cleanSnapshot();
  }

  // Cmd/Ctrl + S → save
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }
}
