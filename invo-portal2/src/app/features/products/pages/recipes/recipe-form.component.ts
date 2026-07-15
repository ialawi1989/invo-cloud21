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
import { FormsModule } from '@angular/forms';
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
import {
  PickProductModalComponent,
  PickProductModalData,
  PickProductResult,
  PickedProduct,
} from '../product-form/components/pick-product-modal/pick-product-modal.component';

import { Recipe, RecipeItem, RecipeService } from '../../services/recipe.service';

/**
 * Recipes → form (create + edit). Translatable Name + Description, plus a list
 * of ingredient products each with a usage quantity. Ported from the legacy
 * `recipe-form.component` in InvoCloudFront2.
 */
@Component({
  selector: 'app-recipe-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    TranslateLinkComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recipe-form.component.html',
  styleUrl: './recipe-form.component.scss',
})
export class RecipeFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(RecipeService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  recipeId = signal<string | null>(null);
  private original = signal<Recipe | null>(null);
  private i18nTick = signal(0);

  name = signal<string>('');
  description = signal<string>('');
  items = signal<RecipeItem[]>([]);
  private translation = signal<Recipe['translation']>({});

  private dirty = signal<boolean>(false);

  isNew = computed<boolean>(() => this.recipeId() === null);
  nameInvalid = computed<boolean>(() => !this.name().trim());
  canSave = computed<boolean>(() => !this.nameInvalid() && this.items().length > 0 && !this.saving());

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.RECIPES.TITLE'), routerLink: '/products/recipe' },
      { label: this.original()?.name || this.translate.instant(this.isNew() ? 'PRODUCTS.RECIPES.ADD_NEW' : 'COMMON.EDIT') },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    if (this.isNew()) return this.translate.instant('PRODUCTS.RECIPES.ADD_NEW');
    return this.original()?.name || this.translate.instant('COMMON.EDIT');
  });

  saveLabel = computed<string>(() => { this.i18nTick(); return this.translate.instant('COMMON.SAVING'); });

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
      this.recipeId.set(null);
      return;
    }
    this.recipeId.set(id);
    this.loading.set(true);
    try {
      const data = await this.service.getOne(id);
      if (!data) return;
      this.original.set(data);
      this.name.set(data.name);
      this.description.set(data.description);
      this.items.set([...data.items]);
      this.translation.set(data.translation ?? {});
    } finally {
      this.loading.set(false);
    }
  }

  onNameChange(v: string): void { this.name.set(v); this.dirty.set(true); }
  onDescriptionChange(v: string): void { this.description.set(v); this.dirty.set(true); }

  // ── Ingredients ──────────────────────────────────────────────────────────
  async openPickItems(): Promise<void> {
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult>(
      PickProductModalComponent,
      {
        size: 'lg',
        data: {
          excludedIds: this.items().map((i) => i.inventoryId).filter(Boolean),
          multiple: true,
          title: this.translate.instant('PRODUCTS.RECIPES.SELECT_PRODUCTS'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    if (result.removed?.length) {
      const drop = new Set(result.removed.map(String));
      this.items.update((list) => list.filter((i) => !drop.has(String(i.inventoryId))));
    }
    if (result.added?.length) {
      const seen = new Set(this.items().map((i) => String(i.inventoryId)));
      const fresh: RecipeItem[] = result.added
        .filter((p) => !seen.has(String(p.id)))
        .map((p) => this.toItem(p));
      this.items.update((list) => [...list, ...fresh]);
    }
    this.dirty.set(true);
  }

  setUsage(inventoryId: string, value: string): void {
    const usage = Number(value);
    this.items.update((list) =>
      list.map((i) => (i.inventoryId === inventoryId ? { ...i, usage: isNaN(usage) ? 0 : usage } : i)),
    );
    this.dirty.set(true);
  }

  removeItem(inventoryId: string): void {
    this.items.update((list) => list.filter((i) => String(i.inventoryId) !== String(inventoryId)));
    this.dirty.set(true);
  }

  itemCost(i: RecipeItem): number {
    return (Number(i.usage) || 0) * (Number(i.unitCost) || 0);
  }

  // ── Translation ──────────────────────────────────────────────────────────
  openNameTranslation(): void {
    void this.openTranslation('name', this.name(), false);
  }
  openDescriptionTranslation(): void {
    void this.openTranslation('description', this.description(), true);
  }

  private async openTranslation(field: 'name' | 'description', currentEn: string, multiline: boolean): Promise<void> {
    const existing = (this.translation()?.[field] as Record<string, string>) ?? {};
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      {
        size: multiline ? 'md' : 'sm',
        data: {
          initial: { ...existing, en: currentEn },
          label: this.translate.instant(field === 'name' ? 'PRODUCTS.RECIPES.NAME' : 'PRODUCTS.RECIPES.DESCRIPTION'),
          multiline,
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    this.translation.update((t) => ({ ...(t ?? {}), [field]: { ...result } }));
    if (field === 'name') this.name.set(result.en);
    else this.description.set(result.en);
    this.dirty.set(true);
  }

  // ── Save / cancel ────────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const original = this.original();
      const translation = { ...(this.translation() ?? {}) };
      // Keep the English mirror aligned with the plain fields.
      translation['name'] = { ...(translation['name'] as Record<string, string> ?? {}), en: this.name().trim() };
      translation['description'] = { ...(translation['description'] as Record<string, string> ?? {}), en: this.description().trim() };
      const payload: Partial<Recipe> = {
        ...(original ?? {}),
        id: original?.id ?? null,
        name: this.name().trim(),
        description: this.description().trim(),
        items: this.items(),
        translation,
      };
      const res = await this.service.save(payload);
      if (res.success) {
        this.dirty.set(false);
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/products/recipe']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[recipe-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/products/recipe']);
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.saving();
  }

  private toItem(p: PickedProduct): RecipeItem {
    return {
      inventoryId: String(p.id),
      usage: 1,
      name: p.name ?? '',
      unitCost: p.unitCost,
      UOM: p.UOM,
      barcode: p.barcode,
      defaultPrice: p.price,
      type: p.type,
      thumbnailUrl: p.thumbnailUrl,
    };
  }
}
