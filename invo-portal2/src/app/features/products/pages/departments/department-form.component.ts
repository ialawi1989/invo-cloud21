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
import { TranslateLinkComponent } from '@shared/components/translate-link/translate-link.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';

import { Department, DepartmentService } from '../../services/department.service';

/**
 * Departments → form (create + edit). A single translatable Name.
 * Ported from the legacy `department-form.component` in InvoCloudFront2.
 */
@Component({
  selector: 'app-department-form',
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './department-form.component.html',
  styleUrl: './department-form.component.scss',
})
export class DepartmentFormComponent implements OnInit, CanLeaveComponent {
  private fb = inject(FormBuilder);
  private service = inject(DepartmentService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);

  /** Department id from the route — `null` for create. */
  departmentId = signal<string | null>(null);

  /** Captured server payload — round-trips unknown fields untouched. */
  private original = signal<Department | null>(null);

  private i18nTick = signal(0);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
  });

  get nameCtrl(): FormControl { return this.form.controls['name'] as FormControl; }

  isNew = computed<boolean>(() => this.departmentId() === null);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.DEPARTMENTS.TITLE'), routerLink: '/products/department' },
      { label: this.original()?.name || this.translate.instant(this.isNew() ? 'PRODUCTS.DEPARTMENTS.ADD_NEW' : 'COMMON.EDIT') },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    if (this.isNew()) return this.translate.instant('PRODUCTS.DEPARTMENTS.ADD_NEW');
    return this.original()?.name || this.translate.instant('COMMON.EDIT');
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
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
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new' || id === '0') {
      this.departmentId.set(null);
      return;
    }
    this.departmentId.set(id);
    this.loading.set(true);
    try {
      const data = await this.service.getOne(id);
      if (!data) return;
      this.original.set(data);
      this.form.patchValue({ name: data.name }, { emitEvent: false });
      this.form.markAsPristine();
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Translation modal ────────────────────────────────────────────────
  async openNameTranslationModal(): Promise<void> {
    const currentEn = String(this.nameCtrl.value ?? '').trim();
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      {
        size: 'sm',
        data: {
          initial: { ...(this.original()?.translation?.name ?? {}), en: currentEn },
          label: this.translate.instant('PRODUCTS.DEPARTMENTS.NAME'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    this.form.patchValue({ name: result.en });
    const orig = this.original() ?? ({ id: null, name: result.en } as Department);
    orig.translation = { ...(orig.translation ?? {}), name: { ...result } };
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
      const payload: Partial<Department> = {
        ...(original ?? {}),
        id: original?.id ?? null,
        name: v.name.trim(),
      };
      // Keep the English mirror of the translation in sync with the plain name.
      if (payload.translation?.name) {
        payload.translation = { ...payload.translation, name: { ...payload.translation.name, en: v.name.trim() } };
      }
      const res = await this.service.save(payload);
      if (res.success) {
        this.form.markAsPristine();
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/products/department']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[department-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/products/department']);
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }
}
