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
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
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
} from '../../../products/pages/product-form/components/pick-product-modal/pick-product-modal.component';

import {
  KitchenProduct,
  KitchenSectionDetails,
  KitchenSectionService,
} from '../../services/kitchen-section.service';

/**
 * Settings → Kitchen Section (form, create + edit)
 *
 * Edits a single kitchen section: a translatable name plus the list
 * of products that route work to this section. Reuses the generic
 * `<app-pf-pick-product-modal>` for the multi-select picker so the
 * UX matches recipe / kit / package builders elsewhere in the app.
 */
@Component({
  selector: 'app-kitchen-section-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kitchen-section-form.component.html',
  styleUrl: './kitchen-section-form.component.scss',
})
export class KitchenSectionFormComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private service    = inject(KitchenSectionService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private modal      = inject(ModalService);
  private toast      = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Section id from the route — `null` for the create flow. */
  sectionId = signal<string | null>(null);

  /** Captured server payload — kept so save can round-trip unknown
   *  fields (companyId, updatedDate, …) untouched. */
  private original = signal<KitchenSectionDetails | null>(null);

  /** Current product list (mutated as the user picks/unpicks). */
  products = signal<KitchenProduct[]>([]);

  /** Local search inside the assigned products. */
  productSearch = signal<string>('');

  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ─── Form ──────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
  });

  get nameCtrl(): FormControl { return this.form.controls['name'] as FormControl; }

  // ─── Derived ───────────────────────────────────────────────────────────
  isNew = computed<boolean>(() => this.sectionId() === null);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.KITCHEN_SECTION'), routerLink: '/settings/kitchen' },
      { label: this.original()?.name || this.translate.instant(this.isNew() ? 'SETTINGS.KITCHEN.ADD_NEW' : 'COMMON.EDIT') },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    if (this.isNew()) return this.translate.instant('SETTINGS.KITCHEN.ADD_NEW');
    return this.original()?.name || this.translate.instant('SETTINGS.KITCHEN.EDIT');
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  /** Filtered products based on the local search box. */
  filteredProducts = computed<KitchenProduct[]>(() => {
    const q = this.productSearch().trim().toLowerCase();
    const all = this.products();
    if (!q) return all;
    return all.filter((p) =>
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q),
    );
  });

  constructor() {
    withTranslations('settings');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new' || id === '0') {
      // Create flow — leave id null, form starts empty.
      this.sectionId.set(null);
      return;
    }
    this.sectionId.set(id);

    this.loading.set(true);
    try {
      const data = await this.service.getOne(id);
      if (!data) return;
      this.original.set(data);
      this.form.patchValue({ name: data.name }, { emitEvent: false });
      this.products.set([...(data.products ?? [])]);
      this.form.markAsPristine();
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Products ──────────────────────────────────────────────────────────
  async openPickProducts(): Promise<void> {
    const ref = this.modal.open<
      PickProductModalComponent,
      PickProductModalData,
      PickProductResult
    >(PickProductModalComponent, {
      size: 'lg',
      data: {
        excludedIds: this.products().map((p) => p.id).filter(Boolean) as string[],
        multiple:    true,
        title:       this.translate.instant('SETTINGS.KITCHEN.PICK_PRODUCTS_TITLE'),
      },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;

    // Apply removals first, then additions — matches PickProductResult shape.
    if (result.removed?.length) {
      const drop = new Set(result.removed);
      this.products.update((list) => list.filter((p) => !drop.has(String(p.id))));
    }
    if (result.added?.length) {
      const seen = new Set(this.products().map((p) => String(p.id)));
      const fresh: KitchenProduct[] = result.added
        .filter((p) => !seen.has(String(p.id)))
        .map(this.toKitchenProduct);
      this.products.update((list) => [...list, ...fresh]);
    }
    this.form.markAsDirty();
  }

  removeProduct(id: string): void {
    this.products.update((list) => list.filter((p) => String(p.id) !== String(id)));
    this.form.markAsDirty();
  }

  // ─── Translation modal ────────────────────────────────────────────────
  async openNameTranslationModal(): Promise<void> {
    const currentEn = String(this.nameCtrl.value ?? '').trim();
    const currentAr = this.original()?.translation?.name?.ar ?? '';

    const ref = this.modal.open<
      TranslationModalComponent,
      TranslationModalData,
      TranslationLang | null
    >(TranslationModalComponent, {
      size: 'sm',
      data: {
        initial: { en: currentEn, ar: currentAr },
        label:   this.translate.instant('SETTINGS.KITCHEN.NAME'),
      },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;

    this.form.patchValue({ name: result.en });
    const orig = this.original() ?? { id: '', name: result.en, products: [] } as KitchenSectionDetails;
    orig.translation = {
      ...(orig.translation ?? {}),
      name: { en: result.en, ar: result.ar },
    };
    this.original.set({ ...orig });
    this.form.markAsDirty();
  }

  // ─── Save / cancel ─────────────────────────────────────────────────────
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue() as { name: string };
      const original = this.original();
      const payload: Partial<KitchenSectionDetails> = {
        ...(original ?? {}),
        id:       original?.id ?? null,
        name:     v.name.trim(),
        products: this.products(),
      };
      const res = await this.service.save(payload);
      if (res.success) {
        // Clear dirty BEFORE navigation so the leave-confirm guard
        // doesn't fire on the post-save navigate (see branch-form for
        // the same pattern + the race-condition rationale).
        this.form.markAsPristine();
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/settings/kitchen']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[kitchen-section-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/settings/kitchen']);
  }

  // ─── CanDeactivate hook ────────────────────────────────────────────────
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  // ─── Internal ──────────────────────────────────────────────────────────
  /** Project a `PickedProduct` from the picker into our wire shape. */
  private toKitchenProduct = (p: PickedProduct): KitchenProduct => ({
    id:           String(p.id),
    name:         p.name ?? '',
    type:         p.type,
    barcode:      p.barcode,
    sku:          p.sku,
    UOM:          p.UOM,
    unitCost:     p.unitCost,
    defaultPrice: p.price,
    price:        p.price,
    thumbnailUrl: p.thumbnailUrl,
  });
}
