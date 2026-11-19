import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ModalService } from '@shared/modal/modal.service';
import { MediaPickerModalComponent, MediaPickerConfig } from '@features/settings/media/components/media-picker/media-picker-modal.component';
import { Media } from '@features/settings/media/models/media.model';
import { LanguageService } from '@core/i18n/language.service';
import { EmployeePreferences } from '@core/layout/services/employee-options.service';
import { DATE_FORMATS, UserPreferencesService } from '@core/preferences/user-preferences.service';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeDetails } from '../../models/employee.types';

import { FormSkeletonComponent } from '@shared/components/skeleton/form-skeleton.component';
import { NotificationPreferencesComponent } from '../../components/notification-preferences/notification-preferences.component';
import { DeviceUsageComponent } from '../../components/device-usage/device-usage.component';
import { QrCodeTwoFaComponent, TwoFaModalData, TwoFaResult } from '@features/login/components/qr-code-two-fa.component';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
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
type MyAccountTab = 'profile' | 'security' | 'preferences' | 'notifications' | 'devices' | 'info';

@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [FormSkeletonComponent, 
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    ToggleComponent,
    SearchDropdownComponent,
    SegmentedToggleComponent,
    NotificationPreferencesComponent,
    DeviceUsageComponent,
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
  private route      = inject(ActivatedRoute);
  private toast      = inject(ToastService);
  private userPrefs  = inject(UserPreferencesService);
  private lang       = inject(LanguageService);
  private modal      = inject(ModalService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** The full payload from the server — kept so save can round-trip
   *  unknown fields (privileges, branches, mediaId, …) untouched. */
  protected original = signal<EmployeeDetails | null>(null);

  /** "Change …" security toggles. Off = leave the existing secret alone;
   *  the matching control stays empty and is excluded from the payload. */
  changePassword = signal<boolean>(false);
  changePasscode = signal<boolean>(false);
  changeMSR      = signal<boolean>(false);

  /** Preview data-URL for a freshly picked avatar (before save). Falls
   *  back to the server `mediaUrl.defaultUrl` in the template. */
  avatarPreview = signal<string | null>(null);
  /** Media-library id of a freshly picked avatar (sent as `mediaId`); null = unchanged. */
  private pickedMediaId = signal<string | null>(null);

  /** Non-form dirtiness — avatar pick or a change-toggle flip — so the
   *  unsaved-changes guard fires even when no FormControl is touched. */
  private dirtyExtra = signal<boolean>(false);

  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ─── Tabs (kept in the URL, so a link or a refresh lands on the same tab) ───
  readonly tabs: SegmentedToggleOption<MyAccountTab>[] = [
    { value: 'profile',     label: 'EMPLOYEES.MY_ACCOUNT.TAB_PROFILE' },
    { value: 'security',    label: 'EMPLOYEES.MY_ACCOUNT.TAB_SECURITY' },
    { value: 'preferences', label: 'EMPLOYEES.MY_ACCOUNT.TAB_PREFERENCES' },
    { value: 'notifications', label: 'EMPLOYEES.MY_ACCOUNT.TAB_NOTIFICATIONS' },
    { value: 'devices',     label: 'EMPLOYEES.MY_ACCOUNT.TAB_DEVICES' },
    { value: 'info',        label: 'EMPLOYEES.MY_ACCOUNT.TAB_INFO' },
  ];
  tab = signal<MyAccountTab>(
    (['profile', 'security', 'preferences', 'notifications', 'devices', 'info'] as const).find(t => t === this.route.snapshot.queryParamMap.get('tab')) ?? 'profile',
  );
  setTab(t: MyAccountTab): void {
    this.tab.set(t);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: t === 'profile' ? null : t }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // ─── Two-factor banner (the same set-up / turn-off flow as the legacy My Account) ───
  /** Whether 2FA is on for this employee; the banner offers the opposite action. */
  twoFaOn = signal(false);
  canChangeTwoFa = computed(() => !!this.original()?.hasPermissionToChange2fa);

  /** Asks first, then starts the set-up: the server returns the QR code to scan, and a 6-digit code from the app confirms it. */
  async setupTwoFa(): Promise<void> {
    const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant('EMPLOYEES.MY_ACCOUNT.TWO_FACTOR_TITLE'),
        message: this.translate.instant('EMPLOYEES.MY_ACCOUNT.TWO_FACTOR_ASK'),
        confirm: this.translate.instant('EMPLOYEES.MY_ACCOUNT.TWO_FACTOR_YES'),
        cancel: this.translate.instant('EMPLOYEES.MY_ACCOUNT.TWO_FACTOR_LATER'),
      },
    }).afterClosed();
    if (!ok) return;
    const token = this.auth.getAccessToken() ?? '';
    try {
      const res = await this.auth.set2FA(token, true);
      if (!res?.success) { this.toast.error(res?.msg || 'COMMON.SAVE_FAILED'); return; }
      await this.openTwoFaModal('setup', res.data?.qrCode ?? '', res.data?.code ?? '');
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  async unsetTwoFa(): Promise<void> {
    await this.openTwoFaModal('unset', '', '');
  }

  private async openTwoFaModal(action: 'setup' | 'unset', qrCode: string, codeStr: string): Promise<void> {
    const token = this.auth.getAccessToken() ?? '';
    const result = await this.modal.open<QrCodeTwoFaComponent, TwoFaModalData, TwoFaResult>(QrCodeTwoFaComponent, {
      size: 'sm', closeOnBackdrop: false,
      data: { accessToken: token, email: this.original()?.email ?? '', qrCode, codeStr, action },
    }).afterClosed();
    if (!result?.pincode) return;
    if (action === 'setup') {
      this.setTwoFaState(true);
      this.toast.success('EMPLOYEES.MY_ACCOUNT.TWO_FACTOR_ENABLED');
      return;
    }
    try {
      const res = await this.auth.set2FA(token, false, result.pincode);
      if (res?.success) {
        this.setTwoFaState(false);
        this.toast.success('EMPLOYEES.MY_ACCOUNT.TWO_FACTOR_DISABLED');
      } else {
        this.toast.error(res?.msg || 'COMMON.SAVE_FAILED');
      }
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  /** Keeps the form's flag (and the loaded record) in step, so saving the page does not undo the change. */
  private setTwoFaState(on: boolean): void {
    this.twoFaOn.set(on);
    this.form.patchValue({ apply2fa: on }, { emitEvent: false });
    const orig = this.original();
    if (orig) this.original.set({ ...orig, apply2fa: on });
  }

  // ─── Preferences (saved with the employee's options, not with the employee record) ───
  /** The draft being edited; written on Save. */
  prefs = signal<EmployeePreferences>({});

  /** `{ value: '' }` is "not set": the browser's timezone / the device's language. */
  readonly timezoneItems: { value: string }[] = [
    { value: '' },
    ...(((Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined) ?? ['UTC', 'Asia/Bahrain', 'Asia/Riyadh', 'Asia/Dubai']).map(value => ({ value })),
  ];
  /** `{ value: '' }` = not chosen: dates keep the pattern each screen was built with. */
  readonly dateFormatItems = [{ value: '' }, ...DATE_FORMATS.map(value => ({ value }))];
  readonly languageItems = [{ value: '' }, ...this.lang.available.map(l => ({ value: l.code }))];
  readonly timeFormatOptions: SegmentedToggleOption<'12h' | '24h'>[] = [
    { value: '24h', label: 'EMPLOYEES.MY_ACCOUNT.PREF_24H' },
    { value: '12h', label: 'EMPLOYEES.MY_ACCOUNT.PREF_12H' },
  ];
  readonly themeOptions: SegmentedToggleOption<'light' | 'dark' | 'system'>[] = [
    { value: 'light', label: 'EMPLOYEES.MY_ACCOUNT.PREF_THEME_LIGHT' },
    { value: 'dark', label: 'EMPLOYEES.MY_ACCOUNT.PREF_THEME_DARK' },
    { value: 'system', label: 'EMPLOYEES.MY_ACCOUNT.PREF_THEME_SYSTEM' },
  ];
  readonly densityOptions: SegmentedToggleOption<'comfortable' | 'compact'>[] = [
    { value: 'comfortable', label: 'EMPLOYEES.MY_ACCOUNT.PREF_DENSITY_COMFORTABLE' },
    { value: 'compact', label: 'EMPLOYEES.MY_ACCOUNT.PREF_DENSITY_COMPACT' },
  ];
  readonly weekStartOptions: SegmentedToggleOption<string>[] = [
    { value: '0', label: 'EMPLOYEES.MY_ACCOUNT.PREF_SUNDAY' },
    { value: '1', label: 'EMPLOYEES.MY_ACCOUNT.PREF_MONDAY' },
    { value: '6', label: 'EMPLOYEES.MY_ACCOUNT.PREF_SATURDAY' },
  ];

  timezoneLabel = (i: { value: string }): string => i.value || this.translate.instant('EMPLOYEES.MY_ACCOUNT.PREF_BROWSER_DEFAULT');
  languageLabel = (i: { value: string }): string =>
    i.value ? (this.lang.available.find(l => l.code === i.value)?.nativeLabel ?? i.value) : this.translate.instant('EMPLOYEES.MY_ACCOUNT.PREF_DEVICE_DEFAULT');
  /** The pattern shown with today's date, so the choice is obvious. */
  dateFormatLabel = (i: { value: string }): string =>
    i.value ? `${formatDate(new Date(), i.value, 'en')}  (${i.value})` : this.translate.instant('EMPLOYEES.MY_ACCOUNT.PREF_APP_DEFAULT');
  sameItem = (a: { value: string }, b: { value: string }): boolean => a?.value === b?.value;

  setPref<K extends keyof EmployeePreferences>(key: K, value: EmployeePreferences[K]): void {
    this.prefs.update(p => ({ ...p, [key]: value }));
    if (key === 'theme') this.userPrefs.previewTheme(value as EmployeePreferences['theme']);
    if (key === 'density') this.userPrefs.previewDensity(value as EmployeePreferences['density']);
    this.dirtyExtra.set(true);
  }

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
    // Leaving the page by any route drops unsaved previews (a saved value has already replaced them).
    this.destroyRef.onDestroy(() => { this.userPrefs.previewTheme(null); this.userPrefs.previewDensity(null); });
    void this.userPrefs.load().then(() => this.prefs.set({ ...this.userPrefs.prefs() }));
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
      this.twoFaOn.set(!!data.apply2fa);
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
  /** Pick the avatar from the shared media library (uploads land there and can be reused), like the employee form. */
  async chooseAvatar(): Promise<void> {
    const currentId = this.pickedMediaId() ?? this.original()?.mediaId ?? null;
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image'],
          title: this.translate.instant('EMPLOYEES.FORM.CHOOSE_IMAGE'),
          preSelectedIds: currentId ? [currentId] : [],
        },
      },
    );
    const result = await ref.afterClosed();
    const media = Array.isArray(result) ? result[0] : result;
    if (!media) return;
    this.pickedMediaId.set(media.id);
    this.avatarPreview.set(media.imageUrl ?? media.thumbUrl ?? null);
    this.dirtyExtra.set(true);
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
      if (this.pickedMediaId())                payload.mediaId = this.pickedMediaId();

      const res = await this.service.save(payload);
      if (res?.success === false) {
        this.toast.error('COMMON.SAVE_FAILED');
        return;
      }

      // Success — stay on the page (self-service). Reset the change
      // toggles/secret fields and clear dirty state before the guard
      // could see it.
      await this.userPrefs.save(this.prefs());
      // The top bar / account menu show this employee's name and picture: update the signed-in copy too.
      this.auth.patchEmployee({
        name: v.name, email: v.email,
        ...(this.pickedMediaId() && this.avatarPreview() ? { mediaId: this.pickedMediaId(), mediaUrl: { defaultUrl: this.avatarPreview() } } : {}),
      } as any);
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
        mediaId:  this.pickedMediaId() ?? orig.mediaId,
        mediaUrl: this.avatarPreview() ? { defaultUrl: this.avatarPreview()! } : orig.mediaUrl,
      });
    }
    this.toggleChangePassword(false);
    this.toggleChangePasscode(false);
    this.toggleChangeMSR(false);
    this.pickedMediaId.set(null);
    this.avatarPreview.set(null);
    this.dirtyExtra.set(false);
    this.form.markAsPristine();
  }

  cancel(): void {
    // Unsaved appearance / density previews are discarded with the rest of the draft.
    this.userPrefs.previewTheme(null);
    this.userPrefs.previewDensity(null);
    this.router.navigate(['/dashboard']);
  }

  /** CanDeactivate hook — guard prompts when there are pending edits. */
  hasUnsavedChanges(): boolean {
    return (this.form.dirty || this.dirtyExtra()) && !this.saving();
  }
}
