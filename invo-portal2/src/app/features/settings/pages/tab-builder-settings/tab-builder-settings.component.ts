import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { TabTemplateBuilderComponent } from '@shared/components/tab-builder/tab-template-builder/tab-template-builder.component';
import { TabTemplate } from '@shared/components/tab-builder/tab-builder.types';
import { TabBuilderSettingsService } from '../../services/tab-builder.service';

/**
 * Settings → Tab Builder (Settings Level)
 *
 * Edits the company-wide `{ templates: TabTemplate[] }` stored under
 * Customization(type='product', key='tabBuilder'). Uses the shared
 * `TabTemplateBuilderComponent` for the two-column UI and the shared
 * `LoadingOverlayComponent` for save feedback.
 */
@Component({
  selector: 'app-tab-builder-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    TabTemplateBuilderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tab-builder-page">
      <header class="page-header">
        <div class="page-header__titles">
          <app-breadcrumbs [items]="breadcrumbs()" separator="chevron"/>
          <h1 class="page-title">{{ 'SETTINGS.ITEMS.PRODUCTS_TAB_BUILDER' | translate }}</h1>
          <p class="page-sub">{{ 'SETTINGS.ITEMS.PRODUCTS_TAB_BUILDER_DESC' | translate }}</p>
        </div>
        <div class="page-header__actions">
          <button type="button" class="btn btn-primary" (click)="save()" [disabled]="saving() || loading()">
            {{ 'COMMON.SAVE' | translate }}
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="loading"><span class="spinner spinner--lg"></span></div>
      } @else {
        <div class="hint-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8"/>
          </svg>
          <div>
            <p class="hint-banner__title">{{ 'TAB_BUILDER.SETTINGS_BANNER_TITLE' | translate }}</p>
            <p class="hint-banner__sub">{{ 'TAB_BUILDER.SETTINGS_BANNER_SUB' | translate }}</p>
          </div>
        </div>

        <app-tab-template-builder
          [templates]="templates()"
          (templatesChange)="templates.set($event)"
        />
      }

      <app-loading-overlay
        [show]="saving()"
        [message]="saveLabel()"
      />
    </div>
  `,
  styles: [`
    .tab-builder-page { max-width: 1200px; padding: 0 0 40px; position: relative; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 16px; margin-bottom: 20px;
    }
    .page-header__titles { min-width: 0; flex: 1; }
    .page-header__actions { flex-shrink: 0; }

    .page-title { font-size: 20px; font-weight: 700; color: #1e293b; margin: 6px 0 0; }
    .page-sub   { font-size: 13px; color: #64748b; margin: 2px 0 0; }

    .btn {
      padding: 8px 18px; border-radius: 8px; border: none;
      font-size: 14px; font-weight: 500; cursor: pointer;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .btn-primary { background: #32acc1; color: #fff;
      &:disabled { opacity: .5; cursor: not-allowed; }
      &:not(:disabled):hover { background: #2a93a6; }
    }

    .hint-banner {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 14px 16px; margin-bottom: 16px;
      background: #eff9fb; border: 1px solid #a6d8df; border-radius: 10px;
      color: #0f172a;

      svg   { color: #32acc1; flex-shrink: 0; margin-top: 2px; }
      &__title { margin: 0; font-size: 13px; font-weight: 600; color: #0f172a; }
      &__sub   { margin: 3px 0 0; font-size: 12px; color: #64748b; }
    }

    .loading { display: flex; justify-content: center; padding: 60px 0; }

    .spinner {
      width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid #e2e8f0; border-top-color: #32acc1;
      display: inline-block; animation: spin .8s linear infinite;

      &--lg { width: 32px; height: 32px; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class TabBuilderSettingsComponent implements OnInit {
  private service    = inject(TabBuilderSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  templates = signal<TabTemplate[]>([]);
  loading   = signal<boolean>(false);
  saving    = signal<boolean>(false);

  /**
   * Ticks on every translation load / language switch. `withTranslations`
   * fetches feature i18n asynchronously, so `translate.instant()` returns
   * raw keys on the very first render — this tick makes labels recompute
   * once the bundles arrive.
   */
  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings', icon: 'settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.PRODUCTS_TAB_BUILDER') },
    ];
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  constructor() {
    // `settings` covers the page chrome; `products` provides PRODUCTS.TYPES.*
    // labels used by the template builder's "Applies to" chips.
    withTranslations('settings', 'products');

    // Re-resolve translated strings whenever the bundle lands or the
    // language changes — ngx-translate caches the merged map per language,
    // but `instant()` called before merge returns the key literally.
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
      this.templates.set(await this.service.getTemplates());
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.service.saveTemplates(this.templates());
    } catch (e) {
      console.error('[tab-builder-settings] save failed', e);
    } finally {
      this.saving.set(false);
    }
  }
}
