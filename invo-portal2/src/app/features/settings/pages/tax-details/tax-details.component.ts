import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { FormSkeletonComponent } from '@shared/components/skeleton/form-skeleton.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { BusinessSettingsService } from '../../services/business-settings.service';

/**
 * Settings > Tax Setting > Tax Details
 *
 * The company-wide tax identity: the VAT / tax number and whether entered prices include tax. It was part of Business
 * Settings; it lives here next to the tax rates. Saves only these two fields, merged over the loaded company payload
 * (same `company/saveCompany` call as Business Settings) so nothing else the company holds is dropped.
 */
@Component({
  selector: 'app-tax-details',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule, TranslateModule, BreadcrumbsComponent, LoadingOverlayComponent,
    FormStickyFooterComponent, FormSkeletonComponent, ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tax-details.component.html',
  styleUrl: './tax-details.component.scss',
})
export class TaxDetailsComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private service    = inject(BusinessSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  loading = signal(false);
  saving  = signal(false);
  private company: any = null;
  private i18nTick = signal(0);

  form = this.fb.nonNullable.group({
    vatNumber:      [''],
    isInclusiveTax: [false],
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.TAX_SETTINGS'), routerLink: '/settings/tax' },
      { label: this.translate.instant('SETTINGS.ITEMS.TAX_DETAILS') },
    ];
  });

  constructor() {
    withTranslations('settings');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.company = await this.service.getCompany();
      this.form.patchValue({
        vatNumber: this.company?.vatNumber ?? '',
        isInclusiveTax: !!this.company?.isInclusiveTax,
      });
      this.form.markAsPristine();
    } finally {
      this.loading.set(false);
    }
  }

  hasUnsavedChanges(): boolean { return this.form.dirty && !this.saving(); }

  async save(): Promise<void> {
    if (!this.company) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      await this.service.saveCompany({ ...this.company, vatNumber: v.vatNumber ?? '', isInclusiveTax: !!v.isInclusiveTax });
      this.company = await this.service.getCompany(true);
      this.form.markAsPristine();
      this.toast.success('COMMON.SAVED_OK');
      this.router.navigate(['/settings']);
    } catch (e: any) {
      console.error('[tax-details] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
