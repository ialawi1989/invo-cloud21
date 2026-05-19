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
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { CompanyService } from '@core/auth/company.service';
import { ErrorService } from '@core/http/error.service';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

import { InvoiceOptionsService } from '../../services/invoice-options.service';

/**
 * Settings → Invoice Options
 *
 * Manages company-wide invoice settings including default note, terms,
 * waste option, void reason, and option group visibility.
 */
@Component({
  selector: 'app-invoice-options',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-options.component.html',
  styleUrl: './invoice-options.component.scss',
})
export class InvoiceOptionsComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private service    = inject(InvoiceOptionsService);
  private translate  = inject(TranslateService);
  private companyService = inject(CompanyService);
  private errorService = inject(ErrorService);
  private router     = inject(Router);
  private location   = inject(Location);
  private destroyRef = inject(DestroyRef);
  private toast      = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  private i18nTick = signal(0);

  // ─── Form ───────────────────────────────────────────────────────────────
  form: FormGroup;

  constructor() {
    withTranslations('settings');
    this.form = this.fb.group({
      invoiceOptions: this.fb.group({
        note:                      [''],
        term:                      [''],
        enableWaste:               [false],
        enableVoidReason:          [false],
        isInvoiceOptionGroupVisible: [false],
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
      { label: this.translate.instant('SETTINGS.ITEMS.INVOICE_OPTIONS') },
    ];
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      // Use already-cached company settings (loaded on app boot)
      const data = this.companyService.settings();

      if (!data) {
        console.warn('No cached company settings');
        return;
      }

      // Extract invoice options from cached data
      const opts = data?.invoiceOptions ?? {};
      console.log('Loaded invoiceOptions:', opts);

      this.form.get('invoiceOptions')?.patchValue({
        note:                       opts.note ?? '',
        term:                       opts.term ?? '',
        enableWaste:                !!opts.enableWaste,
        enableVoidReason:           !!opts.enableVoidReason,
        isInvoiceOptionGroupVisible: !!opts.isInvoiceOptionGroupVisible,
      });

      this.form.markAsPristine();
      this.form.markAsUntouched();
    } catch (error) {
      console.error('Failed to load invoice options:', error);
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

      // Merge invoice options with existing payload
      const payload = {
        ...current,
        invoiceOptions: {
          ...current.invoiceOptions,
          note:                       v.invoiceOptions?.note ?? '',
          term:                       v.invoiceOptions?.term ?? '',
          enableWaste:                !!v.invoiceOptions?.enableWaste,
          enableVoidReason:           !!v.invoiceOptions?.enableVoidReason,
          isInvoiceOptionGroupVisible: !!v.invoiceOptions?.isInvoiceOptionGroupVisible,
        },
      };

      const res = await this.service.saveCompany(payload);
      if (res?.success) {
        // Refresh cached company settings so other pages see the updates
        await this.companyService.loadSettings(true);
        this.form.markAsPristine();
        this.toast.success('COMMON.SAVED_OK');
        this.router.navigate(['/settings']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      console.error('[invoice-options] save failed', e);
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
