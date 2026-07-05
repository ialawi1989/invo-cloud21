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
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { CompanyService } from '@core/auth/company.service';
import { ErrorService } from '@core/http/error.service';

import { EstimateOptionsService } from '../../services/estimate-options.service';

/**
 * Settings → Estimate Options
 *
 * Manages company-wide estimate settings: default note and terms. Mirrors
 * the Invoice Options page (which additionally has feature toggles); estimate
 * options carry only the default-content fields.
 */
@Component({
  selector: 'app-estimate-options',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estimate-options.component.html',
  styleUrl: './estimate-options.component.scss',
})
export class EstimateOptionsComponent implements OnInit, CanLeaveComponent {
  private fb             = inject(FormBuilder);
  private service        = inject(EstimateOptionsService);
  private translate      = inject(TranslateService);
  private companyService = inject(CompanyService);
  private errorService   = inject(ErrorService);
  private router         = inject(Router);
  private destroyRef     = inject(DestroyRef);
  private toast          = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  private i18nTick = signal(0);

  // ─── Form ───────────────────────────────────────────────────────────────
  form: FormGroup;

  constructor() {
    withTranslations('settings');
    this.form = this.fb.group({
      estimateOptions: this.fb.group({
        note: [''],
        term: [''],
      }),
    });

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  // ─── Derived ────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.ESTIMATE_OPTIONS') },
    ];
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const data = this.companyService.settings();
      if (!data) {
        console.warn('No cached company settings');
        return;
      }

      const opts = data?.estimateOptions ?? {};
      this.form.get('estimateOptions')?.patchValue({
        note: opts.note ?? '',
        term: opts.term ?? '',
      });

      this.form.markAsPristine();
      this.form.markAsUntouched();
    } catch (error) {
      console.error('Failed to load estimate options:', error);
    } finally {
      this.loading.set(false);
    }
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const current = this.companyService.settings() ?? {};

      const payload = {
        ...current,
        estimateOptions: {
          ...current.estimateOptions,
          note: v.estimateOptions?.note ?? '',
          term: v.estimateOptions?.term ?? '',
        },
      };

      const res = await this.service.saveCompany(payload);
      if (res?.success) {
        await this.companyService.loadSettings(true);
        this.form.markAsPristine();
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/settings']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[estimate-options] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      await this.errorService.handleError(e);
    } finally {
      this.saving.set(false);
    }
  }

  back(): void {
    this.router.navigate(['/settings']);
  }
}
