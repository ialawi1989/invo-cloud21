import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, from, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { TranslateLinkComponent } from '@shared/components/translate-link/translate-link.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';

import {
  PickProductModalComponent,
  PickProductModalData,
  PickProductResult,
  PickedProduct,
} from '../../product-form/components/pick-product-modal/pick-product-modal.component';
import {
  InventoryLocation,
  InventoryLocationProduct,
  InventoryLocationService,
} from '../../../services/inventory-location.service';

interface BranchOption { id: string; name: string; }

/**
 * Inventory locations → form (create + edit). Translatable name, branch
 * (unique name per branch), and the products stored at the location.
 * Ported from the legacy `inventory-locations-form.component` in InvoCloudFront2.
 */
@Component({
  selector: 'app-inventory-locations-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    TranslateLinkComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory-locations-form.component.html',
  styleUrl: './inventory-locations-form.component.scss',
})
export class InventoryLocationsFormComponent implements OnInit, CanLeaveComponent {
  private fb = inject(FormBuilder);
  private service = inject(InventoryLocationService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);

  /** Location id from the route — `null` for create. */
  locationId = signal<string | null>(null);

  /** Captured server payload — round-trips unknown fields untouched. */
  private original = signal<InventoryLocation | null>(null);

  /** Products as first loaded — removed ones are re-sent with `isDeleted`. */
  private originalProducts: InventoryLocationProduct[] = [];

  products = signal<InventoryLocationProduct[]>([]);
  productSearch = signal<string>('');

  branches = signal<BranchOption[]>([]);
  /** Bumped whenever the picked branch changes (or a change is cancelled) so
   *  the dropdown re-renders at the committed value. */
  branchTick = signal(0);
  selectedBranch = computed<BranchOption | null>(() => {
    this.branchTick();
    const id = this.branchCtrl.value;
    return this.branches().find((b) => b.id === id) ?? null;
  });

  private i18nTick = signal(0);

  /** List query params to hand back when returning to the list. */
  private returnParams: Record<string, any> = {};

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required], [this.nameUniqueValidator()]],
    branchId: [null as string | null, [Validators.required]],
  });

  get nameCtrl(): FormControl { return this.form.controls['name'] as FormControl; }
  get branchCtrl(): FormControl { return this.form.controls['branchId'] as FormControl; }

  isNew = computed<boolean>(() => this.locationId() === null);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.INVENTORY_LOCATIONS.TITLE'), routerLink: '/inventory/locations' },
      { label: this.original()?.name || this.translate.instant(this.isNew() ? 'PRODUCTS.INVENTORY_LOCATIONS.ADD_NEW' : 'COMMON.EDIT') },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    if (this.isNew()) return this.translate.instant('PRODUCTS.INVENTORY_LOCATIONS.ADD_NEW');
    return this.original()?.name || this.translate.instant('COMMON.EDIT');
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  filteredProducts = computed<InventoryLocationProduct[]>(() => {
    const q = this.productSearch().trim().toLowerCase();
    const all = this.products();
    if (!q) return all;
    return all.filter((p) =>
      (p.name ?? '').toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q),
    );
  });

  constructor() {
    withTranslations('products');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.returnParams = { ...this.route.snapshot.queryParams };

    const id = this.route.snapshot.paramMap.get('id');
    const isCreate = !id || id === 'new' || id === '0';
    this.loading.set(true);
    try {
      const [, data] = await Promise.all([
        this.loadBranches(),
        isCreate ? Promise.resolve(null) : this.service.getOne(id!),
      ]);
      if (isCreate) {
        this.locationId.set(null);
        return;
      }
      this.locationId.set(id!);
      if (!data) return;
      this.original.set(data);
      this.originalProducts = [...data.products];
      this.products.set([...data.products]);
      this.form.patchValue({ name: data.name, branchId: data.branchId }, { emitEvent: false });
      this.branchTick.update((n) => n + 1);
      this.form.markAsPristine();
    } finally {
      this.loading.set(false);
    }
  }

  private async loadBranches(): Promise<void> {
    const res = await this.service.getBranches({ page: 1, limit: 1000, searchTerm: '' });
    this.branches.set(res.list);
  }

  // ─── Async validators ──────────────────────────────────────────────────
  /** Name must be unique within the selected branch (`company/validateName`). */
  private nameUniqueValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const value = (control.value ?? '').toString().trim();
      if (!value || !control.dirty) return of(null);
      return timer(500).pipe(
        switchMap(() => from(this.service.isNameFree(value, this.locationId(), this.form?.get('branchId')?.value ?? null))),
        map((free) => (free ? null : { exist: true })),
        catchError(() => of(null)),
      );
    };
  }

  // ─── Branch ────────────────────────────────────────────────────────────
  readonly branchLabel = (b: BranchOption): string => b?.name ?? '';
  readonly branchCompare = (a: BranchOption, b: BranchOption): boolean => a?.id === b?.id;

  async onBranchPicked(b: BranchOption | null): Promise<void> {
    if (!b || b.id === this.branchCtrl.value) return;
    // The first pick on an empty form needs no confirmation.
    if (this.branchCtrl.value) {
      const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
        ConfirmModalComponent,
        {
          size: 'sm',
          data: {
            title: this.translate.instant('PRODUCTS.INVENTORY_LOCATIONS.CHANGE_BRANCH_TITLE'),
            message: this.translate.instant('PRODUCTS.INVENTORY_LOCATIONS.CHANGE_BRANCH_MESSAGE'),
            confirm: this.translate.instant('PRODUCTS.INVENTORY_LOCATIONS.CHANGE_BRANCH_CONFIRM'),
          },
        },
      );
      if (!(await ref.afterClosed())) {
        this.branchTick.update((n) => n + 1); // snap the dropdown back to the old value
        return;
      }
    }
    this.branchCtrl.setValue(b.id);
    this.branchCtrl.markAsDirty();
    this.branchTick.update((n) => n + 1);
    // Uniqueness is per branch — re-check the name against the new one.
    this.nameCtrl.updateValueAndValidity();
  }

  // ─── Products ──────────────────────────────────────────────────────────
  async openPickProducts(): Promise<void> {
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult>(
      PickProductModalComponent,
      {
        drawer: true, drawerWidth: '650px', drawerResizable: true, drawerMinWidth: 650,
        data: {
          excludedIds: this.products().map((p) => p.id).filter(Boolean),
          multiple: true,
          title: this.translate.instant('PRODUCTS.INVENTORY_LOCATIONS.PICK_PRODUCTS_TITLE'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;

    if (result.removed?.length) {
      const drop = new Set(result.removed.map(String));
      this.products.update((list) => list.filter((p) => !drop.has(String(p.id))));
    }
    if (result.added?.length) {
      const seen = new Set(this.products().map((p) => String(p.id)));
      const fresh = result.added.filter((p) => !seen.has(String(p.id))).map(this.toLocationProduct);
      this.products.update((list) => [...list, ...fresh]);
    }
    this.form.markAsDirty();
  }

  removeProduct(id: string): void {
    this.products.update((list) => list.filter((p) => String(p.id) !== String(id)));
    this.form.markAsDirty();
  }

  private toLocationProduct = (p: PickedProduct): InventoryLocationProduct => ({
    id: String(p.id),
    name: p.name ?? '',
    barcode: p.barcode,
    type: p.type,
  });

  // ─── Translation modal ────────────────────────────────────────────────
  async openNameTranslationModal(): Promise<void> {
    const currentEn = String(this.nameCtrl.value ?? '').trim();
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      {
        size: 'sm',
        data: {
          initial: { ...(this.original()?.translation?.name ?? {}), en: currentEn },
          label: this.translate.instant('PRODUCTS.INVENTORY_LOCATIONS.NAME'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    this.form.patchValue({ name: result.en });
    const orig = this.original() ?? ({ id: null, name: result.en, branchId: null, products: [] } as InventoryLocation);
    orig.translation = { ...(orig.translation ?? {}), name: { ...result } };
    this.original.set({ ...orig });
    this.form.markAsDirty();
  }

  // ─── Save / cancel ─────────────────────────────────────────────────────
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue() as { name: string; branchId: string };
      const original = this.original();
      const current = this.products();
      const keptIds = new Set(current.map((p) => String(p.id)));
      // Products assigned on load and removed since: the backend only clears
      // a product's location when it is sent back with `isDeleted`.
      const removed = this.originalProducts
        .filter((p) => !keptIds.has(String(p.id)))
        .map((p) => ({ ...p, isDeleted: true }));
      const name = v.name.trim();
      const payload: Partial<InventoryLocation> = {
        ...(original ?? {}),
        id: original?.id ?? null,
        name,
        branchId: v.branchId,
        products: [...current, ...removed],
      };
      if (payload.translation?.name) {
        payload.translation = { ...payload.translation, name: { ...payload.translation.name, en: name } };
      }
      const res = await this.service.save(payload);
      if (res.success) {
        this.form.markAsPristine();
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/inventory/locations'], { queryParams: this.returnParams });
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[inventory-locations-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/inventory/locations'], { queryParams: this.returnParams });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }
}
