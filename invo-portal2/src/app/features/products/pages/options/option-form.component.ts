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
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '@features/settings/media/components/media-picker/media-picker-modal.component';
import { Media } from '@features/settings/media/models/media.model';
import {
  PickProductModalComponent,
  PickProductModalData,
  PickProductResult,
  PickedProduct,
} from '../product-form/components/pick-product-modal/pick-product-modal.component';

import { Option, OptionRecipeItem, OptionService } from '../../services/option.service';

/**
 * Options → form (create + edit). Image, translatable Name + Display Name,
 * Kitchen name, price, "is multiple" / "is visible" toggles, shipping weight,
 * and a prep-recipe of ingredient products (each with a usage quantity).
 * Ported from the legacy `option-form.component` in InvoCloudFront2.
 */
@Component({
  selector: 'app-option-form',
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
  templateUrl: './option-form.component.html',
  styleUrl: './option-form.component.scss',
})
export class OptionFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(OptionService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  optionId = signal<string | null>(null);
  private original = signal<Option | null>(null);
  private i18nTick = signal(0);

  name = signal<string>('');
  displayName = signal<string>('');
  kitchenName = signal<string>('');
  price = signal<number>(0);
  isMultiple = signal<boolean>(false);
  isVisible = signal<boolean>(true);
  weight = signal<number>(0);
  mediaId = signal<string | null>(null);
  mediaUrl = signal<string>('');
  items = signal<OptionRecipeItem[]>([]);
  private translation = signal<Option['translation']>({});
  private dirty = signal<boolean>(false);

  isNew = computed<boolean>(() => this.optionId() === null);
  nameInvalid = computed<boolean>(() => !this.name().trim());
  priceInvalid = computed<boolean>(() => this.price() < 0);
  canSave = computed<boolean>(() => !this.nameInvalid() && !this.priceInvalid() && !this.saving());

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('PRODUCTS.OPTIONS.TITLE'), routerLink: '/products/option' },
      { label: this.original()?.name || this.translate.instant(this.isNew() ? 'PRODUCTS.OPTIONS.ADD_NEW' : 'COMMON.EDIT') },
    ];
  });
  pageTitle = computed<string>(() => {
    this.i18nTick();
    if (this.isNew()) return this.translate.instant('PRODUCTS.OPTIONS.ADD_NEW');
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
      this.optionId.set(null);
      return;
    }
    this.optionId.set(id);
    this.loading.set(true);
    try {
      const data = await this.service.getOne(id);
      if (!data) return;
      this.original.set(data);
      this.name.set(data.name);
      this.displayName.set(data.displayName);
      this.kitchenName.set(data.kitchenName);
      this.price.set(data.price);
      this.isMultiple.set(data.isMultiple);
      this.isVisible.set(data.isVisible);
      this.weight.set(data.weight);
      this.mediaId.set(data.mediaId);
      this.mediaUrl.set(data.mediaUrl?.defaultUrl ?? data.mediaUrl?.thumbnailUrl ?? '');
      this.items.set([...data.recipe]);
      this.translation.set(data.translation ?? {});
    } finally {
      this.loading.set(false);
    }
  }

  // ── Simple field setters ──────────────────────────────────────────────────
  onName(v: string): void { this.name.set(v); this.dirty.set(true); }
  onDisplayName(v: string): void { this.displayName.set(v); this.dirty.set(true); }
  onKitchenName(v: string): void { this.kitchenName.set(v); this.dirty.set(true); }
  onPrice(v: string): void { this.price.set(Number(v) || 0); this.dirty.set(true); }
  onWeight(v: string): void { this.weight.set(Number(v) || 0); this.dirty.set(true); }
  toggleMultiple(): void { this.isMultiple.update((x) => !x); this.dirty.set(true); }
  toggleVisible(): void { this.isVisible.update((x) => !x); this.dirty.set(true); }

  // ── Image ─────────────────────────────────────────────────────────────────
  async chooseImage(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image'],
          title: this.translate.instant('PRODUCTS.OPTIONS.CHOOSE_IMAGE'),
          preSelectedIds: this.mediaId() ? [this.mediaId()!] : [],
        },
      },
    );
    const result = await ref.afterClosed();
    const media = Array.isArray(result) ? result[0] : result;
    if (media) {
      this.mediaId.set(media.id);
      this.mediaUrl.set(media.imageUrl ?? media.thumbUrl ?? '');
      this.dirty.set(true);
    }
  }
  removeImage(): void { this.mediaId.set(null); this.mediaUrl.set(''); this.dirty.set(true); }

  // ── Prep recipe items ─────────────────────────────────────────────────────
  async openPickItems(): Promise<void> {
    const ref = this.modal.open<PickProductModalComponent, PickProductModalData, PickProductResult>(
      PickProductModalComponent,
      {
        size: 'lg',
        data: {
          excludedIds: this.items().map((i) => i.inventoryId).filter(Boolean),
          multiple: true,
          title: this.translate.instant('PRODUCTS.OPTIONS.SELECT_PRODUCTS'),
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
      const fresh = result.added.filter((p) => !seen.has(String(p.id))).map((p) => this.toItem(p));
      this.items.update((list) => [...list, ...fresh]);
    }
    this.dirty.set(true);
  }
  setUsage(inventoryId: string, value: string): void {
    const usages = Number(value);
    this.items.update((list) => list.map((i) => (i.inventoryId === inventoryId ? { ...i, usages: isNaN(usages) ? 0 : usages } : i)));
    this.dirty.set(true);
  }
  removeItem(inventoryId: string): void {
    this.items.update((list) => list.filter((i) => String(i.inventoryId) !== String(inventoryId)));
    this.dirty.set(true);
  }
  itemCost(i: OptionRecipeItem): number { return (Number(i.usages) || 0) * (Number(i.unitCost) || 0); }

  // ── Translation ────────────────────────────────────────────────────────────
  openNameTranslation(): void { void this.openTranslation('name', this.name()); }
  openDisplayNameTranslation(): void { void this.openTranslation('displayName', this.displayName()); }

  private async openTranslation(field: 'name' | 'displayName', currentEn: string): Promise<void> {
    const existing = (this.translation()?.[field] as Record<string, string>) ?? {};
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang | null>(
      TranslationModalComponent,
      {
        size: 'sm',
        data: {
          initial: { ...existing, en: currentEn },
          label: this.translate.instant(field === 'name' ? 'PRODUCTS.OPTIONS.NAME' : 'PRODUCTS.OPTIONS.DISPLAY_NAME'),
        },
        closeOnBackdrop: false,
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    this.translation.update((t) => ({ ...(t ?? {}), [field]: { ...result } }));
    if (field === 'name') this.name.set(result.en);
    else this.displayName.set(result.en);
    this.dirty.set(true);
  }

  // ── Save / cancel ────────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const original = this.original();
      const translation = { ...(this.translation() ?? {}) };
      translation['name'] = { ...(translation['name'] as Record<string, string> ?? {}), en: this.name().trim() };
      translation['displayName'] = { ...(translation['displayName'] as Record<string, string> ?? {}), en: this.displayName().trim() };
      const payload: Partial<Option> = {
        ...(original ?? {}),
        id: original?.id ?? null,
        name: this.name().trim(),
        displayName: this.displayName().trim(),
        kitchenName: this.kitchenName().trim(),
        price: this.price(),
        isMultiple: this.isMultiple(),
        isVisible: this.isVisible(),
        weight: this.weight(),
        mediaId: this.mediaId(),
        recipe: this.items(),
        translation,
      };
      const res = await this.service.save(payload);
      if (res.success) {
        this.dirty.set(false);
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/products/option']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[option-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { this.router.navigate(['/products/option']); }
  hasUnsavedChanges(): boolean { return this.dirty() && !this.saving(); }

  private toItem(p: PickedProduct): OptionRecipeItem {
    return {
      inventoryId: String(p.id),
      usages: 1,
      name: p.name ?? '',
      unitCost: p.unitCost,
      UOM: p.UOM,
      barcode: p.barcode,
      type: p.type,
      thumbnailUrl: p.thumbnailUrl,
    };
  }
}
