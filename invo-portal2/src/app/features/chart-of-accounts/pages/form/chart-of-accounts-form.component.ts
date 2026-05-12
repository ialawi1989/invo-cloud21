import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { AccountService } from '../../services/account.service';
import { Account, emptyAccount } from '../../services/account.types';
import { AccountFormFieldsComponent } from '../../components/account-form-fields/account-form-fields.component';

/**
 * Chart-of-Accounts editor — full-page form for adding or editing
 * a single account. Wires the shared `<app-account-form-fields>`
 * to the service, owns the unsaved-changes guard, and surfaces
 * save/cancel in the standard sticky save-bar.
 */
@Component({
  selector: 'app-chart-of-accounts-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    AccountFormFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chart-of-accounts-form.component.html',
  styleUrl:    './chart-of-accounts-form.component.scss',
})
export class ChartOfAccountsFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(AccountService);
  private translate  = inject(TranslateService);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  account = signal<Account>(emptyAccount());
  cleanSnapshot = signal<string>('');

  private i18nTick = signal(0);

  isExisting = computed<boolean>(() => !!this.account().id);

  pageTitle = computed<string>(() => {
    this.i18nTick();
    const a = this.account();
    return a.id
      ? this.translate.instant('CHART_OF_ACCOUNTS.FORM.EDIT_TITLE', { name: a.name || '—' })
      : this.translate.instant('CHART_OF_ACCOUNTS.FORM.NEW_TITLE');
  });

  /** Edit-gating for the shared fields component. Default accounts
   *  lock both name and type; saved-but-not-default accounts lock
   *  type only; new records are fully editable. */
  fieldsLocked = computed<'none' | 'type' | 'all'>(() => {
    const a = this.account();
    if (a.default)  return 'all';
    if (a.id)       return 'type';
    return 'none';
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),                routerLink: '/settings' },
      { label: this.translate.instant('CHART_OF_ACCOUNTS.LIST.TITLE'),  routerLink: '/account/chart-of-accounts' },
      { label: this.pageTitle() },
    ];
  });

  // ─── Validation ─────────────────────────────────────────────────
  nameError = computed<string | null>(() => {
    if (!this.account().name.trim()) return 'CHART_OF_ACCOUNTS.FORM.ERR_NAME_REQUIRED';
    return null;
  });
  typeError = computed<string | null>(() => {
    if (!this.account().type.trim()) return 'CHART_OF_ACCOUNTS.FORM.ERR_TYPE_REQUIRED';
    return null;
  });

  isDirty = computed<boolean>(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed<boolean>(() =>
    !this.nameError() && !this.typeError() && !this.saving() && this.isDirty(),
  );

  constructor() {
    withTranslations('chart-of-accounts');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!id || id === 'new') {
      this.account.set(emptyAccount());
      this.cleanSnapshot.set(this.snapshot());
      return;
    }
    this.loading.set(true);
    try {
      const a = await this.service.getById(id);
      if (a) this.account.set(a);
      this.cleanSnapshot.set(this.snapshot());
    } finally {
      this.loading.set(false);
    }
  }

  onValueChange(a: Account): void { this.account.set(a); }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save(this.account());
      if (res?.id) {
        this.account.update(a => ({ ...a, id: res.id }));
        this.cleanSnapshot.set(this.snapshot());
        this.toast.success('COMMON.SAVED_OK');
        void this.router.navigate(['/account/chart-of-accounts']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } catch (err: any) {
      this.toast.error('COMMON.SAVE_FAILED', err?.message);
      throw err;
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { void this.router.navigate(['/account/chart-of-accounts']); }

  // ─── Unsaved-changes guard ────────────────────────────────────
  private snapshot(): string { return JSON.stringify(this.account()); }
  hasUnsavedChanges(): boolean { return this.snapshot() !== this.cleanSnapshot(); }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }
}
