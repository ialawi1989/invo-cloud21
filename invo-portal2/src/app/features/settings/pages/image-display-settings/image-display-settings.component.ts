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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-display-settings.component.html',
  styleUrl: './image-display-settings.component.scss',
})
export class ImageDisplaySettingsComponent implements OnInit {
  private service    = inject(MediaSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

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

  /** Nine-position grid for the position picker (3x3). */
  readonly positionGrid: ImageDisplaySettings['position'][][] = [
    ['top-left',    'top-center',    'top-right'],
    ['center-left', 'center-center', 'center-right'],
    ['bottom-left', 'bottom-center', 'bottom-right'],
  ];

  /** Sample images used in the preview — span tall / square / wide so the
   *  user can see the chosen settings against varied aspect ratios. */
  /** Sample images used in the preview — span tall / square / wide so the
   *  user sees the chosen settings against varied aspect ratios. Files
   *  are bundled with the app under `public/assets/images/preview/` so
   *  the page works fully offline / behind firewalls. */
  readonly previewSamples = [
    { id: 'tall',   label: 'Tall (3:4)',   src: 'assets/images/preview/tall.jpg' },
    { id: 'square', label: 'Square (1:1)', src: 'assets/images/preview/square.jpg' },
    { id: 'wide',   label: 'Wide (16:9)',  src: 'assets/images/preview/wide.jpg' },
  ];

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

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const next: ImageDisplaySettings = { fit: this.fit(), position: this.position() };
      await this.service.saveImageDisplay(next);
      this.original.set(next);
    } catch (e) {
      console.error('[image-display-settings] save failed', e);
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
