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
import { RouterModule } from '@angular/router';
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
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ModalService } from '@shared/modal/modal.service';

import { BusinessSettingsService } from '../../services/business-settings.service';
import type { MediaPickerModalComponent as MediaPickerType } from '../../../media/components/media-picker/media-picker-modal.component';

/**
 * Settings → Business Settings
 *
 * Edits company-wide identity, locale and tax fields. Reads/writes via
 * `BusinessSettingsService` which wraps `getCompanySetting` / `saveCompany`
 * and re-pushes the cached `CompanyService.settings` signal on save so
 * sidebar names / logos / breadcrumbs refresh immediately.
 *
 * Page chrome (header + breadcrumb + save button + loading overlay)
 * mirrors `TabBuilderSettingsComponent` so all settings detail pages share
 * the same visual contract.
 */
@Component({
  selector: 'app-business-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-settings.component.html',
  styleUrl: './business-settings.component.scss',
})
export class BusinessSettingsComponent implements OnInit {
  private fb         = inject(FormBuilder);
  private service    = inject(BusinessSettingsService);
  private translate  = inject(TranslateService);
  private modal      = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Mirror of the loaded company payload — kept so logo info, IDs, and
   *  any extra fields the server returned but we don't edit are preserved
   *  on save (we send a merged payload, not just form values). */
  private company = signal<any | null>(null);

  /** Re-translates labels when ngx-translate finishes loading bundles. */
  private i18nTick = signal(0);

  // ─── Form ───────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    name:             ['', [Validators.required]],
    slug:             [{ value: '', disabled: true }],
    country:          [{ value: '', disabled: true }],
    contryCode:       [{ value: '', disabled: true }],
    currencySymbol:   [{ value: '', disabled: true }],
    afterDecimal:     [{ value: 0, disabled: true }],
    smallestCurrency: [0, [Validators.min(0), Validators.max(0.99)]],
    roundingType:     ['normal' as 'normal' | 'negative' | 'positive'],
    vatNumber:        [''],
    isInclusiveTax:   [false],
  });

  /** Logo state lives outside the form because it goes through the media
   *  picker modal rather than a regular control. */
  mediaId  = signal<string | null>(null);
  mediaUrl = signal<string | null>(null);

  // ─── Derived ────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.BUSINESS_SETTINGS') },
    ];
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  /** Options for the Rounding Type dropdown — i18n-aware via i18nTick. */
  roundingOptions = computed<{ id: string; label: string }[]>(() => {
    this.i18nTick();
    return [
      { id: 'normal',   label: this.translate.instant('SETTINGS.BUSINESS.ROUNDING_NORMAL') },
      { id: 'negative', label: this.translate.instant('SETTINGS.BUSINESS.ROUNDING_NEGATIVE') },
      { id: 'positive', label: this.translate.instant('SETTINGS.BUSINESS.ROUNDING_POSITIVE') },
    ];
  });

  constructor() {
    withTranslations('settings');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.service.getCompany();
      if (!data) return;
      this.company.set(data);
      this.form.patchValue({
        name:             data.name ?? '',
        slug:             data.slug ?? '',
        country:          data.country ?? '',
        contryCode:       data.settings?.contryCode ?? '',
        currencySymbol:   data.settings?.currencySymbol ?? '',
        afterDecimal:     data.settings?.afterDecimal ?? 0,
        smallestCurrency: data.smallestCurrency ?? 0,
        roundingType:     data.roundingType ?? 'normal',
        vatNumber:        data.vatNumber ?? '',
        isInclusiveTax:   !!data.isInclusiveTax,
      });
      this.mediaId.set(data.mediaId ?? null);
      this.mediaUrl.set(data.mediaUrl?.defaultUrl ?? data.mediaUrl?.thumbnailUrl ?? null);
    } finally {
      this.loading.set(false);
    }
  }

  async pickLogo(): Promise<void> {
    // Lazy-load the media picker so we don't pull it into the settings
    // chunk for users who never click "Choose logo".
    const { MediaPickerModalComponent } =
      await import('../../../media/components/media-picker/media-picker-modal.component');
    const ref = this.modal.open<MediaPickerType, any, any>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image'],
          title: this.translate.instant('SETTINGS.BUSINESS.CHOOSE_LOGO'),
          multiple: false,
          preSelectedIds: this.mediaId() ? [this.mediaId()!] : [],
        },
        closeOnBackdrop: true,
      },
    );
    const picked = await ref.afterClosed();
    const item = Array.isArray(picked) ? picked[0] : picked;
    if (!item) return;
    // The Media object's `url` is itself an object — `{ defaultUrl, original,
    // thumbnail, ... }`. The `imageUrl` getter (when present) picks the best
    // available; fall back to the same chain manually for plain objects.
    const url =
      item.imageUrl ||
      item.url?.defaultUrl ||
      item.url?.original ||
      item.url?.thumbnail ||
      item.defaultUrl ||
      item.thumbnailUrl ||
      null;
    this.mediaId.set(item.id ?? item._id ?? null);
    this.mediaUrl.set(url);
    this.form.markAsDirty();
  }

  removeLogo(): void {
    this.mediaId.set(null);
    this.mediaUrl.set(null);
    this.form.markAsDirty();
  }

  // Adapters for app-search-dropdown — items are `{ id, label }` but the
  // form stores just the `id` string. `toValue` strips down to the id on
  // selection; `compareWith` matches the stored id back to its full item
  // object for highlighting; `displayWith` renders the label, but the
  // dropdown calls it on the *raw* stored value (the id string) — so we
  // look the label up from the items list when we get a primitive.
  roundingDisplay = (v: any) => {
    if (v && typeof v === 'object') return v.label ?? '';
    return this.roundingOptions().find(o => o.id === v)?.label ?? '';
  };
  roundingCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  roundingToValue = (item: { id: string; label: string }) => item.id;

  setRoundingType(value: any): void {
    // The dropdown's `valueChange` model emits the *full item* (not the
    // result of `toValue`). Unwrap to the id so the form / payload stay
    // primitive.
    const id = (value && typeof value === 'object' ? value.id : value) ?? 'normal';
    this.form.patchValue({ roundingType: id });
    this.form.markAsDirty();
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const current = this.company() ?? {};
      // Merge over the existing payload so we don't drop server-set fields.
      const payload = {
        ...current,
        name:             v.name,
        smallestCurrency: Number(v.smallestCurrency ?? 0),
        roundingType:     v.roundingType,
        vatNumber:        v.vatNumber ?? '',
        isInclusiveTax:   !!v.isInclusiveTax,
        mediaId:          this.mediaId(),
      };
      await this.service.saveCompany(payload);
      // Refresh the in-memory snapshot so subsequent edits diff correctly.
      this.company.set(await this.service.getCompany(true));
      this.form.markAsPristine();
    } catch (e) {
      console.error('[business-settings] save failed', e);
    } finally {
      this.saving.set(false);
    }
  }
}
