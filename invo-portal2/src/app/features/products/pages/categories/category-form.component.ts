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

import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import { withTranslations } from '@core/i18n/with-translations';
import { CollapsibleCardComponent } from '@shared/components/collapsible-card/collapsible-card.component';
import { EntityThumbComponent } from '@shared/components/entity-thumb/entity-thumb.component';
import {
  PickAssignedProductsModalComponent,
  PickAssignedProductsData,
  PickAssignedProductsResult,
} from '../../components/pick-assigned-products-modal/pick-assigned-products-modal.component';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { TranslateLinkComponent } from '@shared/components/translate-link/translate-link.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '@features/settings/media/components/media-picker/media-picker-modal.component';
import { Media } from '@features/settings/media/models/media.model';

import { Category, CategoryProduct, CategoryService } from '../../services/category.service';
import { DepartmentService } from '../../services/department.service';

interface DeptOption { id: string; name: string; }

/**
 * Categories → form (create + edit). Name + parent Department + cover image,
 * with a translatable name. Ported from InvoCloudFront2's `category-form`.
 * (Product assignment is edited from each product's Category field.)
 */
@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    SearchDropdownComponent,
    TranslateLinkComponent,
    CollapsibleCardComponent,
    EntityThumbComponent,
    DragDropModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss',
})
export class CategoryFormComponent implements OnInit, CanLeaveComponent {
  private fb = inject(FormBuilder);
  private service = inject(CategoryService);
  private departmentService = inject(DepartmentService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  categoryId = signal<string | null>(null);
  private original = signal<Category | null>(null);
  private i18nTick = signal(0);

  departments = signal<DeptOption[]>([]);
  mediaId = signal<string | null>(null);
  mediaUrl = signal<string>('');

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    departmentId: ['', [Validators.required]],
  });

  get nameCtrl(): FormControl { return this.form.controls['name'] as FormControl; }
  get deptCtrl(): FormControl { return this.form.controls['departmentId'] as FormControl; }

  isNew = computed<boolean>(() => this.categoryId() === null);

  selectedDepartment = computed<DeptOption | null>(() => {
    this.i18nTick();
    const id = this.deptCtrl.value;
    return this.departments().find((d) => d.id === id) ?? null;
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.CATEGORIES.TITLE'), routerLink: '/products/category' },
      { label: this.original()?.name || this.translate.instant(this.isNew() ? 'PRODUCTS.CATEGORIES.ADD_NEW' : 'COMMON.EDIT') },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    if (this.isNew()) return this.translate.instant('PRODUCTS.CATEGORIES.ADD_NEW');
    return this.original()?.name || this.translate.instant('COMMON.EDIT');
  });

  saveLabel = computed<string>(() => { this.i18nTick(); return this.translate.instant('COMMON.SAVING'); });

  displayDept = (d: DeptOption) => d?.name ?? '';
  compareDept = (a: DeptOption, b: DeptOption) => a?.id === b?.id;

  constructor() {
    withTranslations('products');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  /** Products assigned to this category, in saved order. */
  products = signal<CategoryProduct[]>([]);
  /** Tracked separately: assignments save through their own endpoint, so a
   *  name-only edit shouldn't trigger a second request. */
  private productsDirty = signal(false);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const depts = await this.departmentService.getDepartments();
      this.departments.set(depts.map((d) => ({ id: d.id, name: d.name })));

      const id = this.route.snapshot.paramMap.get('id');
      if (!id || id === 'new' || id === '0') {
        this.categoryId.set(null);
        // Default to the first department (matches the legacy behaviour).
        if (this.departments().length) {
          this.deptCtrl.setValue(this.departments()[0].id, { emitEvent: false });
        }
        this.form.markAsPristine();
        return;
      }
      this.categoryId.set(id);
      const data = await this.service.getOne(id);
      if (!data) return;
      this.original.set(data);
      this.form.patchValue({ name: data.name, departmentId: data.departmentId ?? '' }, { emitEvent: false });
      this.mediaId.set(data.mediaId);
      this.mediaUrl.set(data.mediaUrl?.defaultUrl ?? data.mediaUrl?.thumbnailUrl ?? '');
      this.products.set(await this.service.getCategoryProducts(id));
      this.form.markAsPristine();
    } finally {
      this.loading.set(false);
    }
  }

  onDepartmentChange(opt: DeptOption | DeptOption[] | null): void {
    const picked = Array.isArray(opt) ? opt[0] : opt;
    this.deptCtrl.setValue(picked?.id ?? '');
    this.form.markAsDirty();
  }

  // ── Cover image ────────────────────────────────────────────────────────
  async chooseImage(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image'],
          title: this.translate.instant('PRODUCTS.CATEGORIES.CHOOSE_IMAGE'),
          preSelectedIds: this.mediaId() ? [this.mediaId()!] : [],
        },
      },
    );
    const result = await ref.afterClosed();
    const media = Array.isArray(result) ? result[0] : result;
    if (media) {
      this.mediaId.set(media.id);
      this.mediaUrl.set(media.imageUrl ?? media.thumbUrl ?? '');
      this.form.markAsDirty();
    }
  }

  removeImage(): void {
    this.mediaId.set(null);
    this.mediaUrl.set('');
    this.form.markAsDirty();
  }

  // ── Translation ────────────────────────────────────────────────────────
  async openNameTranslationModal(): Promise<void> {
    const currentEn = String(this.nameCtrl.value ?? '').trim();
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      {
        size: 'sm',
        data: {
          initial: { ...(this.original()?.translation?.name ?? {}), en: currentEn },
          label: this.translate.instant('PRODUCTS.CATEGORIES.NAME'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    this.form.patchValue({ name: result.en });
    const orig = this.original() ?? ({ id: null, name: result.en, departmentId: this.deptCtrl.value || null, mediaId: null } as Category);
    orig.translation = { ...(orig.translation ?? {}), name: { ...result } };
    this.original.set({ ...orig });
    this.form.markAsDirty();
  }

  // ── Save / cancel ────────────────────────────────────────────────────────
  // ── Assigned products ─────────────────────────────────────────────────────
  async openProductPicker(): Promise<void> {
    const ref = this.modal.open<PickAssignedProductsModalComponent, PickAssignedProductsData, PickAssignedProductsResult>(
      PickAssignedProductsModalComponent,
      {
        size: 'lg',
        data: {
          load: ({ page, limit, searchTerm }) =>
            this.service.getUncategorizedProducts({ page, limit, searchTerm }),
          assignedIds: this.products().map((p) => p.id),
          title: 'PRODUCTS.CATEGORIES.SELECT_PRODUCTS',
          emptyKey: 'PRODUCTS.CATEGORIES.NO_UNASSIGNED',
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result?.added?.length) return;
    const seen = new Set(this.products().map((p) => p.id));
    const fresh = result.added.filter((p) => !seen.has(p.id));
    if (!fresh.length) return;
    this.products.update((list) => [...list, ...fresh]);
    this.productsDirty.set(true);
    this.form.markAsDirty();
  }

  removeProduct(id: string): void {
    this.products.update((list) => list.filter((p) => p.id !== id));
    this.productsDirty.set(true);
    this.form.markAsDirty();
  }

  onReorder(event: CdkDragDrop<CategoryProduct[]>): void {
    const list = [...this.products()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.products.set(list);
    this.productsDirty.set(true);
    this.form.markAsDirty();
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue() as { name: string; departmentId: string };
      const original = this.original();
      const payload: Partial<Category> = {
        ...(original ?? {}),
        id: original?.id ?? null,
        name: v.name.trim(),
        departmentId: v.departmentId || null,
        mediaId: this.mediaId(),
      };
      if (payload.translation?.name) {
        payload.translation = { ...payload.translation, name: { ...payload.translation.name, en: v.name.trim() } };
      }
      const res = await this.service.save(payload);
      if (!res.success) {
        this.toast.error('COMMON.SAVE_FAILED');
        return;
      }

      // Product assignments are a separate resource, so they need a second
      // call — and on create we only learn the new id from the save response.
      const categoryId = String(res.data?.id ?? payload.id ?? '');
      if (categoryId && this.productsDirty()) {
        const linked = await this.service.saveCategoryProducts(categoryId, this.products());
        if (!linked.success) {
          // The category itself saved; say so rather than implying nothing landed.
          this.toast.error('PRODUCTS.CATEGORIES.PRODUCTS_SAVE_FAILED');
          return;
        }
      }

      this.productsDirty.set(false);
      this.form.markAsPristine();
      this.toast.success('COMMON.SAVED_OK');
      this.router.navigate(['/products/category']);
    } catch (e: any) {
      console.error('[category-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/products/category']);
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }
}
