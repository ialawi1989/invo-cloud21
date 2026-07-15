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
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ModalService } from '@shared/modal/modal.service';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '../../../media/components/media-picker/media-picker-modal.component';
import type { Media } from '../../../media/models/media.model';

import {
  BranchSettingsService,
  BranchSummary,
} from '../../../services/branch-settings.service';
import { BranchTabsComponent } from '../../../../products/pages/product-form/components/branch-product-section/branch-tabs/branch-tabs.component';
import {
  BranchTabRef,
  provideBranchTabs,
} from '../../../../products/pages/product-form/components/branch-product-section/branch-tabs/branch-tabs.service';

import { ServiceManagementService } from '../../services/service.service';
import {
  Service,
  ServiceType,
  SERVICE_TYPES,
  CREATABLE_SERVICE_TYPES,
  BranchServiceModel,
  SurchargeOption,
  PriceLabelOption,
  MenuOption,
  emptyService,
  emptyBranchServiceModel,
} from '../../services/service.types';

import { DineinSettingsComponent }   from './components/dinein-settings.component';
import { DeliverySettingsComponent } from './components/delivery-settings.component';
import { PickupSettingsComponent }   from './components/pickup-settings.component';
import { CarhopSettingsComponent }   from './components/carhop-settings.component';
import { SalonSettingsComponent }    from './components/salon-settings.component';
import { CateringSettingsComponent } from './components/catering-settings.component';
import { RetailSettingsComponent }   from './components/retail-settings.component';

/** Static option list for the Type dropdown — i18n labels resolve in
 *  the template via the `translate` pipe. `<app-search-dropdown>`
 *  declares `items` as mutable, so we spread the readonly registry
 *  into a fresh array. The list is constant at runtime; the spread
 *  exists purely for type compatibility. */
type TypeOption = { id: ServiceType; labelKey: string };
/** Dropdown items — only the three POS service types that can be
 *  picked for a brand-new service. The full `SERVICE_TYPES`
 *  registry is still used below for resolving labels on existing
 *  records whose type is one of the legacy variants. */
const TYPE_OPTIONS: TypeOption[] = [...CREATABLE_SERVICE_TYPES];
const ALL_TYPES:    TypeOption[] = [...SERVICE_TYPES];

/**
 * Service-management form (`/settings/services/:id`).
 *
 * Two-column layout (matches the discount / payment-method form):
 *   • Main column — Details (Name + Type) and Per-branch settings
 *     (one tab per branch, rendering the type-specific sub-component).
 *   • Side column — Image + Options (default menu + lock toggles).
 *
 * Sub-components for each service type are wired here statically;
 * the template picks the right one based on `service().type` and
 * passes the active branch row + the loaded surcharge / price-label
 * lists for any dropdowns the sub-component renders.
 */
@Component({
  selector: 'app-service-management-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    ToggleComponent,
    BranchTabsComponent,
    DineinSettingsComponent,
    DeliverySettingsComponent,
    PickupSettingsComponent,
    CarhopSettingsComponent,
    SalonSettingsComponent,
    CateringSettingsComponent,
    RetailSettingsComponent,
  ],
  // Each instance of the BranchTabsComponent needs its own state slice;
  // namespacing the persisted prefs under `serviceManagement.branches`
  // keeps it isolated from the product-form usage.
  providers: [
    provideBranchTabs('serviceManagement.branches'),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-management-form.component.html',
  styleUrl:    './service-management-form.component.scss',
})
export class ServiceManagementFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(ServiceManagementService);
  private branchSvc  = inject(BranchSettingsService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private translate  = inject(TranslateService);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  service$ = signal<Service>(emptyService());

  /** Available branches — drives the per-branch tab strip. Loaded
   *  once on init; merged with `service.branches` so every branch
   *  shows up regardless of whether the service has saved settings
   *  for it yet. */
  branches = signal<BranchSummary[]>([]);

  /** Active branch tab — index into `service.branches`. */
  activeBranchIndex = signal<number>(0);

  // Sources for the per-branch sub-component dropdowns.
  surcharges  = signal<SurchargeOption[]>([]);
  priceLabels = signal<PriceLabelOption[]>([]);
  menus       = signal<MenuOption[]>([]);

  cleanSnapshot = signal<string>('');
  private i18nTick = signal(0);

  readonly typeOptions: TypeOption[] = TYPE_OPTIONS;

  isExisting = computed<boolean>(() => !!this.service$().id);

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.isExisting()
      ? this.translate.instant('SERVICE_MANAGEMENT.FORM.EDIT_TITLE', { name: this.service$().name || '—' })
      : this.translate.instant('SERVICE_MANAGEMENT.FORM.NEW_TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),                routerLink: '/settings' },
      { label: this.translate.instant('SERVICE_MANAGEMENT.LIST.TITLE'), routerLink: '/settings/service-management' },
      { label: this.pageTitle() },
    ];
  });

  /** Resolved active branch row. The template addresses this so the
   *  sub-component receives a stable reference that mutates via
   *  `patchBranch` instead of free-form binding. */
  activeBranch = computed<BranchServiceModel | null>(() => {
    const idx = this.activeBranchIndex();
    return this.service$().branches[idx] ?? null;
  });

  /** Branch directory in the `BranchTabRef` shape the shared
   *  `<app-pf-branch-tabs>` expects. The `isOnline` flag drives the
   *  green status dot — we re-purpose it to reflect the per-branch
   *  `setting.enabled` state, so a glance at the tab strip shows
   *  which branches have the service turned on. */
  branchDirectory = computed<BranchTabRef[]>(() =>
    this.service$().branches.map(b => ({
      id:       b.branchId,
      name:     b.branchName,
      isOnline: !!b.setting?.enabled,
    })),
  );

  /** Sync the tab strip's active branch id back into our index-based
   *  `activeBranchIndex`. The sub-components address the active row
   *  by index because `service.branches` is the source of truth. */
  onBranchTabChange(id: string): void {
    const idx = this.service$().branches.findIndex(b => b.branchId === id);
    if (idx >= 0) this.activeBranchIndex.set(idx);
  }

  // ─── Type dropdown adapters ─────────────────────────────────────
  typeDisplay   = (t: typeof TYPE_OPTIONS[number] | null) => t ? this.translate.instant(t.labelKey) : '';
  typeCompare   = (a: any, b: any) => (a?.id ?? '') === (b?.id ?? '');
  typeToValue   = (t: any) => t?.id ?? '';
  // Resolve against the FULL type set so legacy records (DineIn /
  // Salon / Catering / Retail) still surface the right label, even
  // though those entries aren't pickable in the dropdown anymore.
  selectedType  = computed(() => ALL_TYPES.find(t => t.id === this.service$().type) ?? null);

  // ─── Menu dropdown adapters ─────────────────────────────────────
  menuDisplay  = (m: MenuOption | null) => m?.name ?? '';
  menuCompare  = (a: MenuOption | null, b: MenuOption | null) => (a?.id ?? '') === (b?.id ?? '');
  menuToValue  = (m: MenuOption | null) => m?.id ?? '';
  selectedMenu = computed<MenuOption | null>(() => {
    const id = this.service$().menuId;
    if (!id) return null;
    return this.menus().find(m => m.id === id) ?? { id, name: id };
  });

  // ─── Validation ─────────────────────────────────────────────────
  nameError = computed<string | null>(() => {
    const n = this.service$().name?.trim();
    if (!n) return 'SERVICE_MANAGEMENT.FORM.ERR_NAME_REQUIRED';
    return null;
  });
  typeError = computed<string | null>(() => {
    if (!this.service$().type) return 'SERVICE_MANAGEMENT.FORM.ERR_TYPE_REQUIRED';
    return null;
  });
  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed<boolean>(() =>
    !this.nameError() && !this.typeError() && !this.saving() && this.isDirty(),
  );

  constructor() {
    withTranslations('settings/service-management');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? 'new';
    this.loading.set(true);
    try {
      // Branch list drives the per-branch tab strip. Load it first so
      // the merge step below has the canonical list of branches.
      const branchRes = await this.branchSvc.getList({ page: 1, limit: 500 });
      this.branches.set(branchRes.list);

      // Surcharge + price-label + menu lists feed the sub-component
      // dropdowns. Kicked off in parallel since they're independent.
      void this.service.getSurcharges().then(r => this.surcharges.set(r)).catch(() => { /* empty */ });
      void this.service.getPriceLabels().then(r => this.priceLabels.set(r)).catch(() => { /* empty */ });
      void this.service.getMenus().then(r => this.menus.set(r)).catch(() => { /* empty */ });

      if (id && id !== 'new' && id !== '0') {
        const loaded = await this.service.getById(id);
        if (loaded) {
          this.service$.set(this.mergeBranches(loaded));
        }
      } else {
        this.service$.set(this.mergeBranches(emptyService()));
      }
    } finally {
      this.loading.set(false);
      this.cleanSnapshot.set(this.snapshot());
    }
  }

  /** Ensure every branch from `BranchSettingsService.getList` has a
   *  corresponding `BranchServiceModel` on the service. Missing
   *  branches get a fresh empty row appended; existing rows keep
   *  their saved settings. Mirrors the legacy merge-on-load logic. */
  private mergeBranches(s: Service): Service {
    const byId = new Map<string, BranchServiceModel>();
    for (const b of s.branches) byId.set(b.branchId, b);
    const merged: BranchServiceModel[] = this.branches().map(b =>
      byId.get(b.id) ?? emptyBranchServiceModel(b.id, b.name),
    );
    return { ...s, branches: merged };
  }

  // ─── Field setters ──────────────────────────────────────────────
  setName(name: string): void {
    this.service$.update(s => ({
      ...s,
      name,
      translation: { name: { ...(s.translation?.name ?? {}), en: name } },
    }));
  }
  setType(t: { id: ServiceType } | { id: ServiceType }[] | null): void {
    const picked = Array.isArray(t) ? t[0] ?? null : t;
    this.service$.update(s => ({ ...s, type: picked?.id ?? '' }));
  }
  setMenu(m: MenuOption | MenuOption[] | null): void {
    const picked = Array.isArray(m) ? m[0] ?? null : m;
    this.service$.update(s => ({ ...s, menuId: picked?.id ?? '' }));
  }
  setLockMenu(on: boolean): void {
    this.service$.update(s => ({ ...s, options: { ...s.options, lockMenu: on } }));
  }
  setLockChangeService(on: boolean): void {
    this.service$.update(s => ({ ...s, options: { ...s.options, locKChangeService: on } }));
  }
  setActiveBranch(i: number): void {
    this.activeBranchIndex.set(i);
  }
  /** Apply a partial patch to the active branch row. Sub-components
   *  emit `(branchChange)` with the next `BranchServiceModel` after
   *  any internal mutation; we splice it into the array here. */
  patchActiveBranch(next: BranchServiceModel): void {
    const idx = this.activeBranchIndex();
    this.service$.update(s => ({
      ...s,
      branches: s.branches.map((b, i) => i === idx ? next : b),
    }));
  }

  // ─── Translation modal ──────────────────────────────────────────
  async openNameTranslation(): Promise<void> {
    const s = this.service$();
    const initial: TranslationLang = {
      ...(s.translation?.name ?? {}),
      en: s.translation?.name?.['en'] || s.name || '',
    } as TranslationLang;
    const ref = this.modal.open<
      TranslationModalComponent,
      TranslationModalData,
      TranslationLang | null
    >(TranslationModalComponent, {
      size: 'sm',
      data: {
        initial,
        label: this.translate.instant('SERVICE_MANAGEMENT.FORM.NAME'),
      },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;
    this.service$.update(prev => ({
      ...prev,
      name: result.en || prev.name,
      translation: { name: { ...(prev.translation?.name ?? {}), ...result } },
    }));
  }

  // ─── Icon picker ────────────────────────────────────────────────
  async openIconPicker(): Promise<void> {
    const ref = this.modal.open<
      MediaPickerModalComponent,
      MediaPickerConfig,
      Media | Media[] | null
    >(MediaPickerModalComponent, {
      size: 'lg',
      data: { multiple: false } as MediaPickerConfig,
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result || Array.isArray(result)) return;
    this.service$.update(s => ({
      ...s,
      mediaId:  String((result as any).id ?? ''),
      mediaUrl: {
        defaultUrl:   String((result as any).url?.defaultUrl ?? (result as any).defaultUrl ?? ''),
        thumbnailUrl: String((result as any).url?.thumbnailUrl ?? (result as any).thumbnailUrl ?? ''),
      },
    }));
  }
  removeIcon(): void {
    this.service$.update(s => ({
      ...s,
      mediaId:  null,
      mediaUrl: { defaultUrl: '', thumbnailUrl: '' },
    }));
  }

  // ─── Save / Cancel ──────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.service$());
      if (res?.id) {
        this.service$.update(s => ({ ...s, id: res.id }));
        this.cleanSnapshot.set(this.snapshot());
        if (this.route.snapshot.paramMap.get('id') === 'new' || this.route.snapshot.paramMap.get('id') === '0') {
          void this.router.navigate(['/settings/service-management', res.id], { replaceUrl: true });
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
    void this.router.navigate(['/settings/service-management']);
  }

  // ─── Unsaved-changes guard ──────────────────────────────────────
  private snapshot(): string { return JSON.stringify(this.service$()); }
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
