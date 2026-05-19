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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import {
  MediaSettingsService,
  ImageDisplaySettings,
  DEFAULT_IMAGE_DISPLAY,
} from '../../services/media-settings.service';

/**
 * Settings → Media → Image Display
 *
 * Edits the company-wide image-rendering defaults: CSS `object-fit` and
 * `object-position`. The chosen values are persisted as a Customization
 * (type='media', key='imageDisplay') and consumed by storefront / list
 * card components when they render a product image.
 *
 * UX is two controls + a live preview of three sample aspect ratios so
 * the user can see how a tall, square, and wide image will crop before
 * saving.
 */
@Component({
  selector: 'app-image-display-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    SegmentedToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-display-settings.component.html',
  styleUrl: './image-display-settings.component.scss',
})
export class ImageDisplaySettingsComponent implements OnInit, CanLeaveComponent {
  private service    = inject(MediaSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  // Editable settings — split into two signals so the preview re-renders
  // on every change without depending on a FormGroup.
  fit      = signal<ImageDisplaySettings['fit']>(DEFAULT_IMAGE_DISPLAY.fit);
  position = signal<ImageDisplaySettings['position']>(DEFAULT_IMAGE_DISPLAY.position);

  /** Snapshot of what was last loaded — drives the "dirty" check. */
  private original = signal<ImageDisplaySettings>({ ...DEFAULT_IMAGE_DISPLAY });

  /** Re-translates labels when ngx-translate finishes loading bundles. */
  private i18nTick = signal(0);

  readonly fitOptions: ImageDisplaySettings['fit'][] = ['cover', 'contain', 'fill'];

  /** Segmented-toggle wrapper around `fitOptions` — `i18nTick` is a
   *  signal read so the labels re-resolve whenever ngx-translate
   *  switches language. */
  readonly fitToggleOptions = (): SegmentedToggleOption<ImageDisplaySettings['fit']>[] => {
    this.i18nTick();
    return this.fitOptions.map((f) => ({
      value:     f,
      label:     this.translate.instant('SETTINGS.IMAGE_DISPLAY.FIT_' + f.toUpperCase()),
      translate: false,
    }));
  };

  /** Nine-position grid for the position picker (3x3). */
  readonly positionGrid: ImageDisplaySettings['position'][][] = [
    ['top-left',    'top-center',    'top-right'],
    ['center-left', 'center-center', 'center-right'],
    ['bottom-left', 'bottom-center', 'bottom-right'],
  ];

  /** Available demo source images. The user picks one and we render
   *  it into every preview frame so the cropping behaviour is
   *  comparable side-by-side. Files ship under
   *  `public/assets/images/preview/` for offline use. */
  readonly demoSources: { id: 'tall' | 'square' | 'wide'; label: string; src: string }[] = [
    { id: 'wide',   label: 'Wide source',   src: 'assets/images/preview/wide.jpg'   },
    { id: 'square', label: 'Square source', src: 'assets/images/preview/square.jpg' },
    { id: 'tall',   label: 'Tall source',   src: 'assets/images/preview/tall.jpg'   },
  ];

  /** Card aspect ratios the preview renders the chosen source into.
   *  These are the *target* shapes — what the user is configuring
   *  the storefront cards to look like. Showing the same source in
   *  all three makes the cropping effect of fit + focal point
   *  unambiguous. */
  readonly previewFrames = [
    { id: 'tall',   label: 'Tall (3:4)'   },
    { id: 'square', label: 'Square (1:1)' },
    { id: 'wide',   label: 'Wide (16:9)'  },
  ];

  /** Currently selected source image. Defaults to the wide one
   *  because its mismatch against the 3:4 / 1:1 frames produces the
   *  most visible cropping — instantly demonstrating the benefit of
   *  the focal-point setting. */
  demoSourceId = signal<'tall' | 'square' | 'wide'>('wide');
  demoSrc      = computed(() =>
    this.demoSources.find((s) => s.id === this.demoSourceId())?.src ?? this.demoSources[0].src,
  );

  // ─── Derived ────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.IMAGE_DISPLAY') },
    ];
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  isDirty = computed<boolean>(() => {
    const o = this.original();
    return o.fit !== this.fit() || o.position !== this.position();
  });

  /** Inline CSS for the preview tiles — the heart of the page. */
  previewStyle = computed<Record<string, string>>(() => ({
    'object-fit':      this.fit(),
    'object-position': this.cssPosition(this.position()),
  }));

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
      const data = await this.service.getImageDisplay();
      this.fit.set(data.fit);
      this.position.set(data.position);
      this.original.set({ fit: data.fit, position: data.position });
    } finally {
      this.loading.set(false);
    }
  }

  setFit(v: ImageDisplaySettings['fit']): void {
    this.fit.set(v);
  }

  setPosition(v: ImageDisplaySettings['position']): void {
    this.position.set(v);
  }

  /** CanDeactivate hook — guard prompts when settings have changed. */
  hasUnsavedChanges(): boolean {
    return this.isDirty() && !this.saving();
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const next: ImageDisplaySettings = { fit: this.fit(), position: this.position() };
      await this.service.saveImageDisplay(next);
      this.original.set(next);
      this.toast.success('COMMON.SAVED_OK');
      this.router.navigate(['/settings']);
    } catch (e: any) {
      console.error('[image-display-settings] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  /** Translates `'top-left'` → `'left top'` for CSS `object-position`. */
  private cssPosition(p: ImageDisplaySettings['position']): string {
    const [v, h] = p.split('-');
    const cssV = v === 'center' ? 'center' : v;
    const cssH = h === 'center' ? 'center' : h;
    return `${cssH} ${cssV}`;
  }

  // Used by the position grid for active highlighting.
  isPosition(p: ImageDisplaySettings['position']): boolean {
    return this.position() === p;
  }

  /** Nicely-formatted label for a fit option (translated). */
  fitLabel(f: ImageDisplaySettings['fit']): string {
    this.i18nTick();
    return this.translate.instant('SETTINGS.IMAGE_DISPLAY.FIT_' + f.toUpperCase());
  }
}
