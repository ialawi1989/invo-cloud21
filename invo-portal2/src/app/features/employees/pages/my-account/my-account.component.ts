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
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { AuthService } from '@core/auth/auth.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeDetails } from '../../models/employee.types';

/**
 * Employees → My Account (self-service)
 * ─────────────────────────────────────
 * The signed-in employee edits their own profile basics (name, email,
 * avatar) and security credentials (password / passcode / MSR — each
 * behind an explicit "change" toggle so a blank field never overwrites
 * an existing secret) plus the two-factor flag.
 *
 * The current employee id comes from the auth layer
 * ({@link AuthService.currentEmployee}), and the full record is (re)loaded
 * via {@link EmployeeService.getOne} so we round-trip every server field
 * the save endpoint expects (privileges, branches, mediaId, …). This
 * mirrors the legacy page, which read the logged-in employee from the
 * ngrx store and then re-fetched it by id.
 *
 * Save stays on the page (it's self-service) and just toasts, matching
 * the settings-form convention of an in-place confirmation.
 */
@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-account.component.html',
  styleUrl: './my-account.component.scss',
})
export class MyAccountComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private service    = inject(EmployeeService);
  private auth       = inject(AuthService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** The full payload from the server — kept so save can round-trip
   *  unknown fields (privileges, branches, mediaId, …) untouched. */
  private original = signal<EmployeeDetails | null>(null);

  /** "Change …" security toggles. Off = leave the existing secret alone;
   *  the matching control stays empty and is excluded from the payload. */
  changePassword = signal<boolean>(false);
  changePasscode = signal<boolean>(false);
  changeMSR      = signal<boolean>(false);

  /** Preview data-URL for a freshly picked avatar (before save). Falls
   *  back to the server `mediaUrl.defaultUrl` in the template. */
  avatarPreview = signal<string | null>(null);
  private base64Image = signal<string>('');

  /** Non-form dirtiness — avatar pick or a change-toggle flip — so the
   *  unsaved-changes guard fires even when no FormControl is touched. */
  private dirtyExtra = signal<boolean>(false);

  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ─── Form ───────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    name:     ['', [Validators.required]],
    email:    ['', [Validators.required, Validators.email]],
    password: [''],
    passCode: [''],
    MSR:      [''],
    apply2fa: [false],
  });

  // ─── Derived ────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [{ label: this.translate.instant('EMPLOYEES.MY_ACCOUNT.TITLE') }];
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  /** Read-only display name of the assigned privilege set, if any. */
  privilegeName = computed<string>(() => this.original()?.privileges?.name ?? '');

  /** Formatted "created at" for the read-only account-info card. */
  createdAt = computed<string>(() => this.original()?.createdAt ?? '');

  /** Employee role badges surfaced read-only (managed on the full edit
   *  form, not here). */
  roles = computed<{ key: string; on: boolean }[]>(() => {
    const e = this.original();
    if (!e) return [];
    return [
      { key: 'EMPLOYEES.FORM.SUPER_ADMIN', on: !!e.superAdmin },
      { key: 'EMPLOYEES.FORM.CLOUD_ADMIN', on: !!e.admin },
      { key: 'EMPLOYEES.FORM.POS_USER',    on: !!e.user },
      { key: 'EMPLOYEES.FORM.IS_DRIVER',   on: !!e.isDriver },
    ].filter(r => r.on);
  });

  constructor() {
    withTranslations('employees');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.auth.currentEmployee?.id;
    // No signed-in employee id → nothing to edit; bounce to the dashboard.
    if (!id) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loading.set(true);
    try {
      const data = await this.service.getOne(id);
      if (!data) return;
      this.original.set(data);
      this.form.patchValue({
        name:     data.name ?? '',
        email:    data.email ?? '',
        apply2fa: !!data.apply2fa,
      });
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Security "change" toggles ──────────────────────────────────────────
  /**
   * Flip a change-toggle and wire the matching control's validators. On:
   * the field becomes required (+ passcode numeric ≥4, password ≥6). Off:
   * validators clear and the value resets so a blank secret is never sent.
   */
  toggleChangePassword(on: boolean): void {
    this.changePassword.set(on);
    const c = this.form.controls['password'];
    if (on) {
      c.setValidators([Validators.required, Validators.minLength(6)]);
    } else {
      c.clearValidators();
      c.setValue('');
    }
    c.updateValueAndValidity();
    this.dirtyExtra.set(true);
  }

  toggleChangePasscode(on: boolean): void {
    this.changePasscode.set(on);
    const c = this.form.controls['passCode'];
    if (on) {
      c.setValidators([Validators.required, Validators.minLength(4), Validators.pattern(/^\d+$/)]);
    } else {
      c.clearValidators();
      c.setValue('');
    }
    c.updateValueAndValidity();
    this.dirtyExtra.set(true);
  }

  toggleChangeMSR(on: boolean): void {
    this.changeMSR.set(on);
    const c = this.form.controls['MSR'];
    if (on) {
      c.setValidators([Validators.required]);
    } else {
      c.clearValidators();
      c.setValue('');
    }
    c.updateValueAndValidity();
    this.dirtyExtra.set(true);
  }

  // ─── Avatar ─────────────────────────────────────────────────────────────
  onAvatarPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      this.avatarPreview.set(dataUrl);
      this.base64Image.set(dataUrl);
      this.dirtyExtra.set(true);
    };
    reader.readAsDataURL(file);
    // Allow re-picking the same file to fire `change` again.
    input.value = '';
  }

  // ─── Save ───────────────────────────────────────────────────────────────
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const original = this.original();
      const payload: Partial<EmployeeDetails> & { id?: string | null } = {
        ...(original ?? {}),
        formStatus: 'edit',
        id:         original?.id ?? this.auth.currentEmployee?.id ?? undefined,
        name:       v.name,
        email:      v.email,
        apply2fa:   !!v.apply2fa,
      };
      // Only send secrets the user explicitly opted to change — a blank
      // field must never wipe an existing password/passcode/MSR.
      if (this.changePassword() && v.password) payload.password = v.password;
      if (this.changePasscode() && v.passCode) payload.passCode = v.passCode;
      if (this.changeMSR()      && v.MSR)      payload.MSR      = v.MSR;
      if (this.base64Image())                  payload.base64Image = this.base64Image();

      const res = await this.service.save(payload);
      if (res?.success === false) {
        this.toast.error('COMMON.SAVE_FAILED');
        return;
      }

      // Success — stay on the page (self-service). Reset the change
      // toggles/secret fields and clear dirty state before the guard
      // could see it.
      this.toast.success('EMPLOYEES.MY_ACCOUNT.SAVED');
      this.applySavedState(v);
    } catch (e: any) {
      console.error('[my-account] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  /** Fold the just-saved values back into the `original` snapshot and
   *  reset transient edit state so the page reads as "clean". */
  private applySavedState(v: any): void {
    const orig = this.original();
    if (orig) {
      this.original.set({
        ...orig,
        name:     v.name,
        email:    v.email,
        apply2fa: !!v.apply2fa,
        mediaUrl: this.base64Image()
          ? { defaultUrl: this.base64Image() }
          : orig.mediaUrl,
      });
    }
    this.toggleChangePassword(false);
    this.toggleChangePasscode(false);
    this.toggleChangeMSR(false);
    this.base64Image.set('');
    this.avatarPreview.set(null);
    this.dirtyExtra.set(false);
    this.form.markAsPristine();
  }

  cancel(): void {
    this.router.navigate(['/dashboard']);
  }

  /** CanDeactivate hook — guard prompts when there are pending edits. */
  hasUnsavedChanges(): boolean {
    return (this.form.dirty || this.dirtyExtra()) && !this.saving();
  }
}
