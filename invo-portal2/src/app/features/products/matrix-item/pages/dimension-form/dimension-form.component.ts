import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import {
  TranslationModalComponent,
  TranslationModalData,
  TranslationLang,
} from '@shared/components/translation-modal/translation-modal.component';

import { ProductsService } from '../../../services/products.service';
import { MatrixItemService } from '../../services/matrix-item.service';
import {
  Dimension,
  DimensionAttribute,
  DimensionDisplayType,
  emptyDimension,
  emptyTranslation,
} from '../../services/matrix-item.types';
import {
  AddAttributeModalComponent,
  AddAttributeModalData,
} from '../../components/add-attribute-modal/add-attribute-modal.component';

/**
 * Dimension editor (`/dimensions/:id`, `:id === 'new'` → create).
 *
 * Same chrome as the settings forms: signal model, snapshot-based dirty
 * tracking + unsaved-changes guard, Cmd/Ctrl+S save, toast + navigate on
 * success. Attributes are edited through the shared add-attribute modal;
 * the translate button reuses the shared translation modal.
 */
import { TranslateLinkComponent } from '@shared/components/translate-link/translate-link.component';

@Component({
  selector: 'app-dimension-form',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SegmentedToggleComponent,
    TranslateLinkComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dimension-form.component.html',
  styleUrl: './dimension-form.component.scss',
})
export class DimensionFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(MatrixItemService);
  private products = inject(ProductsService);
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);

  dimension = signal<Dimension>(emptyDimension());

  /** True when the route was `/dimensions/new` — nulls the id on save so
   *  the backend mints its own. */
  private isCreate = signal<boolean>(true);

  cleanSnapshot = signal<string>('');

  nameValidating = signal<boolean>(false);
  nameDuplicate = signal<boolean>(false);
  private nameCheckDebounce?: ReturnType<typeof setTimeout>;
  private nameCheckToken = 0;

  private i18nTick = signal(0);

  readonly displayTypeOptions: SegmentedToggleOption<DimensionDisplayType>[] = [
    { value: 'buttons', label: 'MATRIX.DIMENSION.BUTTONS' },
    { value: 'radio', label: 'MATRIX.DIMENSION.RADIO' },
    { value: 'dropdown', label: 'MATRIX.DIMENSION.DROPDOWN' },
  ];

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.dimension().id && !this.isCreate()
      ? this.translate.instant('DIMENSIONS.FORM.EDIT_TITLE')
      : this.translate.instant('DIMENSIONS.FORM.NEW_TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('DIMENSIONS.LIST.TITLE'), routerLink: '/dimensions' },
      { label: this.pageTitle() },
    ];
  });

  nameError = computed<string | null>(() => {
    if (!this.dimension().name.trim()) return 'DIMENSIONS.FORM.NAME_REQUIRED';
    if (this.nameDuplicate()) return 'DIMENSIONS.FORM.NAME_DUPLICATE';
    return null;
  });

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());

  canSave = computed<boolean>(
    () => !this.nameError() && !this.saving() && this.isDirty(),
  );

  constructor() {
    withTranslations('products/matrix-item');
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));

    // Debounced async name-uniqueness — mirrors discount-form. Skips when the
    // value matches the saved snapshot so a freshly-loaded record doesn't
    // ping the backend about a name it already owns.
    effect(() => {
      const d = this.dimension();
      const name = d.name.trim();
      const isPristine = untracked(() => this.snapshotMatches(d));

      clearTimeout(this.nameCheckDebounce);
      if (!name || isPristine) {
        this.nameValidating.set(false);
        this.nameDuplicate.set(false);
        return;
      }

      this.nameValidating.set(true);
      const myToken = ++this.nameCheckToken;
      this.nameCheckDebounce = setTimeout(async () => {
        try {
          const res = await this.products.validateName({
            tableName: 'dimension',
            id: d.id || '',
            name,
          });
          if (myToken !== this.nameCheckToken) return;
          this.nameDuplicate.set(!res.success);
        } catch {
          if (myToken === this.nameCheckToken) this.nameDuplicate.set(false);
        } finally {
          if (myToken === this.nameCheckToken) this.nameValidating.set(false);
        }
      }, 500);
    });
  }

  private snapshotMatches(d: Dimension): boolean {
    return JSON.stringify(d) === this.cleanSnapshot();
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isCreate.set(false);
      this.loading.set(true);
      try {
        const fresh = await this.service.getDimension(id);
        if (fresh) {
          this.cleanSnapshot.set(JSON.stringify(fresh));
          this.dimension.set(fresh);
        }
      } finally {
        this.loading.set(false);
      }
    }
    // Baseline the dirty-check against the initial (loaded or empty) state.
    if (this.isCreate()) this.cleanSnapshot.set(this.snapshot());
  }

  // ── Field setters ─────────────────────────────────────────────────
  setName(v: string): void {
    this.dimension.update((d) => ({
      ...d,
      name: v,
      type: v.toLowerCase().replace(/\s+/g, ''),
    }));
  }

  setDisplayType(t: DimensionDisplayType): void {
    this.dimension.update((d) => ({ ...d, displayType: t }));
  }

  // ── Attribute helpers ─────────────────────────────────────────────
  isHex(v: string | null | undefined): boolean {
    return !!v && v.startsWith('#');
  }

  /** Only unsaved attributes can be dropped inline — persisted ones (with
   *  an `id`) map to real child products and must go through regeneration. */
  canRemoveAttr(attr: DimensionAttribute): boolean {
    return !attr.id;
  }

  removeAttr(index: number): void {
    this.dimension.update((d) => ({
      ...d,
      attributes: d.attributes.filter((_, i) => i !== index),
    }));
  }

  async openAttributes(): Promise<void> {
    // Ensure a type is set so the modal can resolve presets for an unsaved dim.
    const dim = this.dimension();
    if (!dim.type) {
      this.dimension.update((d) => ({
        ...d,
        type: d.name.toLowerCase().replace(/\s+/g, ''),
      }));
    }
    const ref = this.modal.open<
      AddAttributeModalComponent,
      AddAttributeModalData,
      DimensionAttribute[] | null
    >(AddAttributeModalComponent, {
      size: 'lg',
      data: { dimension: this.dimension() },
    });
    const result = await ref.afterClosed();
    if (result) {
      this.dimension.update((d) => ({ ...d, attributes: result }));
    }
  }

  // ── Translate ─────────────────────────────────────────────────────
  async openTranslate(): Promise<void> {
    const d = this.dimension();
    const ref = this.modal.open<
      TranslationModalComponent,
      TranslationModalData,
      TranslationLang | null
    >(TranslationModalComponent, {
      size: 'md',
      data: {
        initial: { ...(d.translation?.name ?? {}), en: d.translation?.name?.en || d.name },
        label: this.translate.instant('DIMENSIONS.FORM.NAME'),
      },
    });
    const result = await ref.afterClosed();
    if (result) {
      this.dimension.update((dim) => {
        const translation = emptyTranslation();
        translation.name = { ...result };
        return {
          ...dim,
          translation,
          name: result.en,
          type: result.en.toLowerCase().replace(/\s+/g, ''),
        };
      });
    }
  }

  // ── Save / cancel ─────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const payload: Dimension = { ...this.dimension() };
      if (this.isCreate()) (payload as any).id = null;

      const res = await this.service.saveDimension(payload);
      if (res.success) {
        this.toast.success('DIMENSIONS.FORM.SAVED_OK');
        this.cleanSnapshot.set(this.snapshot());
        void this.router.navigate(['/dimensions']);
      } else {
        this.toast.error('DIMENSIONS.FORM.SAVE_FAILED', res.msg);
      }
    } catch (err: any) {
      this.toast.error('DIMENSIONS.FORM.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/dimensions']);
  }

  // ── Unsaved-changes guard ─────────────────────────────────────────
  private snapshot(): string {
    return JSON.stringify(this.dimension());
  }
  hasUnsavedChanges(): boolean {
    return this.snapshot() !== this.cleanSnapshot();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }
}
