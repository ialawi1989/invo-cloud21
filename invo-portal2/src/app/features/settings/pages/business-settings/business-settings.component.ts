import { FormActionsComponent, FormActionPrimaryDirective } from '@shared/components/form-actions/form-actions.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
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
import { Router, RouterModule } from '@angular/router';
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
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { ModalService } from '@shared/modal/modal.service';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ImageEditorModalComponent, ImageEditorModalData, loadEditorImage, type EditorSourceIssue } from '@shared/components/image-editor';
import { MediaService } from '../../media/services/media.service';

import { BusinessSettingsService } from '../../services/business-settings.service';
import type { MediaPickerModalComponent as MediaPickerType } from '../../media/components/media-picker/media-picker-modal.component';

import { FormSkeletonComponent } from '@shared/components/skeleton/form-skeleton.component';
/**
 * Settings → Business Settings
 *
 * Edits company-wide identity and locale fields (tax lives in Tax Settings). Reads/writes via
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
  imports: [FormActionsComponent, FormActionPrimaryDirective, PageHeaderComponent, TooltipDirective, FormSkeletonComponent, 
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    LoadingOverlayComponent,
    SearchDropdownComponent,
    ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-settings.component.html',
  styleUrl: './business-settings.component.scss',
})
export class BusinessSettingsComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private service    = inject(BusinessSettingsService);
  private translate  = inject(TranslateService);
  private modal      = inject(ModalService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private media      = inject(MediaService);

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

  /** The rounding guide's rows: the example is a fixed illustration with a smallest currency of 0.05, not the company's own figures. */
  readonly roundingGuide = [
    { key: 'NORMAL',   example: '12.37 → 12.35' },
    { key: 'POSITIVE', example: '12.37 → 12.40' },
    { key: 'NEGATIVE', example: '12.37 → 12.35' },
  ];

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
      });
      this.mediaId.set(data.mediaId ?? null);
      this.mediaUrl.set(data.mediaUrl?.defaultUrl ?? data.mediaUrl?.thumbnailUrl ?? null);
      this.baseline.set(this.currentState());
    } finally {
      this.loading.set(false);
    }
  }

  async pickLogo(): Promise<void> {
    // Lazy-load the media picker so we don't pull it into the settings
    // chunk for users who never click "Choose logo".
    const { MediaPickerModalComponent } =
      await import('../../media/components/media-picker/media-picker-modal.component');
    const ref = this.modal.open<MediaPickerType, any, any>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image'],
          title: this.translate.instant('SETTINGS.BUSINESS.CHOOSE_LOGO'),
          multiple: false,
          preSelectedIds: this.mediaId() ? [this.mediaId()!] : [],
          // A file browsed from the computer opens the photo editor on the square crop BEFORE it is uploaded.
          editBeforeUpload: { cropPreset: 'r0' },
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
    // A logo prints and shows as a square. A file browsed from the computer was already cropped before upload (see
    // `editBeforeUpload`); a picture picked from the library is used as it is. The pen on the logo crops it later.
  }

  /** Why the last logo crop could only use the direct image address (null when a same-origin copy loaded). */
  readonly logoLoadIssue = signal<EditorSourceIssue | null>(null);

  /** Crop the current logo to a square (the editor opens on the 1:1 preset). The cropped picture is saved as a new media item. */
  async cropLogo(): Promise<void> {
    const id = this.mediaId();
    const current = this.mediaUrl();
    if (!id && !current) return;
    // Same-origin copy through the backend when possible; otherwise the direct URL and the real reason (logged, kept in
    // `logoLoadIssue`, and shown by the editor with a Retry button). See loadEditorImage.
    const load = () => loadEditorImage(this.media, id, current, 'business-settings.cropLogo');
    const source = await load();
    this.logoLoadIssue.set(source.issue);
    let blob: Blob | undefined;
    try {
      const ref = this.modal.open<ImageEditorModalComponent, ImageEditorModalData, Blob | undefined>(
        ImageEditorModalComponent,
        { size: 'fullscreen', closeable: false, data: { imageUrl: source.url, fileName: 'logo', initialCropPreset: 'r0', sourceIssue: source.issue, reloadSource: load } },
      );
      blob = await ref.afterClosed();
    } finally {
      if (source.objectUrl) URL.revokeObjectURL(source.objectUrl);
    }
    if (!blob) return;
    try {
      const type = blob.type || 'image/png';
      const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
      const result: any = await this.media.uploadFile(new File([blob], `logo.${ext}`, { type }));
      if (result?.success === false) throw new Error(result.error || result.message || 'Upload failed');
      const created = result?.data?.[0];
      if (!created?.id) throw new Error('Upload failed');
      this.mediaId.set(created.id);
      this.mediaUrl.set(created.imageUrl || created.url?.defaultUrl || created.url?.original || created.url?.thumbnail || this.mediaUrl());
      this.form.markAsDirty();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
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

  /** The editable values as last loaded / saved. Save stays off until the current values differ from this. */
  private baseline = signal('');

  private currentState(): string {
    const v = this.form.getRawValue();
    return JSON.stringify({ name: String(v.name ?? '').trim(), smallestCurrency: Number(v.smallestCurrency ?? 0), roundingType: v.roundingType, mediaId: this.mediaId(), mediaUrl: this.mediaUrl() });
  }

  /** True when something was actually changed (the name, the rounding fields or the logo). */
  hasChanges(): boolean {
    // Read both signals first, so the Save button always tracks the logo, even while the page is still loading.
    const now = this.currentState();
    const base = this.baseline();
    return base !== '' && now !== base;
  }

  /** Save is allowed when something changed, the name is valid and the smallest-currency rule (0 to 0.99) holds. A value already stored on the
   *  company that breaks that rule (older data, e.g. 10) does not block saving other changes; only a value the user typed does. */
  canSave(): boolean {
    const smallest = this.form.controls['smallestCurrency'];
    const smallestBlocks = smallest.invalid && smallest.dirty;
    return this.hasChanges() && this.form.controls['name'].valid && !smallestBlocks;
  }

  /** CanDeactivate hook — guard prompts when the form is dirty. */
  hasUnsavedChanges(): boolean {
    return this.hasChanges() && !this.saving();
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (!this.canSave()) return;
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
        mediaId:          this.mediaId(),
      };
      await this.service.saveCompany(payload);
      // Refresh the in-memory snapshot so subsequent edits diff correctly.
      this.company.set(await this.service.getCompany(true));
      this.form.markAsPristine();
      this.baseline.set(this.currentState());
      this.toast.success('COMMON.SAVED_OK');
      this.router.navigate(['/settings']);
    } catch (e: any) {
      console.error('[business-settings] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
