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
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { EmployeeService } from '../../services/employee.service';

/** The InvoCloud user resolved from an email lookup (invite flow). */
interface InvitedUser {
  employeeId: string;
  employeeName: string;
  branches: Array<{ id?: string; name?: string; [k: string]: any }>;
}

/**
 * Employee → Invitation form
 * ──────────────────────────
 * Routes via `/employees/invitation/:id` (`0` = new invite, else edit an
 * already-invited user).
 *
 * Two sections mirror the legacy page:
 *
 *   1. **Invitation Details** — enter the email of an existing InvoCloud
 *      user and click "Click here to invite" to resolve them via
 *      {@link EmployeeService.getEmployeeByEmail}. The resolved name and
 *      the branches they belong to are shown read-only.
 *
 *   2. **Invitation Schedule** — a start date plus an end date that is
 *      either "Never" (open-ended) or a specific date, toggled with the
 *      shared `<app-toggle>` (no native checkbox).
 *
 * On save the payload is sent to {@link EmployeeService.saveInvitedEmployee}.
 */
@Component({
  selector: 'app-employee-invitation',
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
    DatePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-invitation.component.html',
  styleUrl: './employee-invitation.component.scss',
})
export class EmployeeInvitationComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private service    = inject(EmployeeService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  loading    = signal<boolean>(false);
  saving     = signal<boolean>(false);
  lookingUp  = signal<boolean>(false);

  /** Route id — `'0'` for a brand-new invite, else the invited user's id. */
  inviteId = signal<string | null>(null);
  isEdit   = computed<boolean>(() => {
    const id = this.inviteId();
    return !!id && id !== '0';
  });

  /** The resolved InvoCloud user (from the email lookup or the loaded
   *  record). `null` until an email is successfully resolved. */
  invitedUser = signal<InvitedUser | null>(null);

  /** Error key shown under the email field when a lookup fails / finds no
   *  matching InvoCloud user. */
  lookupError = signal<string | null>(null);

  /** The full payload from the server (edit mode) — kept so save can
   *  round-trip unknown fields untouched. */
  private original = signal<any | null>(null);

  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ─── Form ───────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    email:     ['', [Validators.required, Validators.email]],
    // `Date | null` on the form; mapped to/from ISO 'yyyy-MM-dd' strings
    // (the wire format) at the load/save boundary.
    startAt:   [null as Date | null],
    // `endNever` true → invitation never expires; false → `endAt` is used.
    endNever:  [true],
    endAt:     [null as Date | null],
  });

  // ─── Derived ────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('EMPLOYEES.TITLE'), routerLink: '/employees' },
      { label: this.translate.instant('EMPLOYEES.INVITE.TITLE') },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('EMPLOYEES.INVITE.TITLE');
  });

  savingLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  /** Save is enabled once we have a resolved user and (when a specific end
   *  date is chosen) a date to go with it. */
  private formTick = signal(0);
  canSave = computed<boolean>(() => {
    this.formTick();
    if (this.saving() || this.loading()) return false;
    if (!this.invitedUser()) return false;
    const v = this.form.getRawValue();
    if (this.form.invalid) return false;
    if (!v.endNever && !v.endAt) return false;
    return true;
  });

  constructor() {
    withTranslations('employees');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    // FormControl values aren't tracked by signals — bump a tick on every
    // change so `canSave` re-evaluates.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    this.inviteId.set(id);

    if (!this.isEdit()) return;

    // Edit an existing invited user — prefill from the loaded record.
    this.loading.set(true);
    try {
      const data: any = await this.service.getOne(id as string);
      if (!data) return;
      this.original.set(data);
      this.invitedUser.set({
        employeeId:   data.id ?? data.employeeId ?? '',
        employeeName: data.name ?? data.employeeName ?? '',
        branches:     Array.isArray(data.branches) ? data.branches : [],
      });
      const endAt = data.inventionEndAt ?? null;
      this.form.patchValue({
        email:    data.email ?? '',
        startAt:  this.toDate(data.inventionStartAt),
        endNever: !endAt,
        endAt:    this.toDate(endAt),
      });
      // Email is immutable when editing an existing invitation.
      this.form.controls['email'].disable();
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Email lookup ────────────────────────────────────────────────────────
  /** Resolve the entered email to an existing InvoCloud user. */
  async lookupEmail(): Promise<void> {
    const email = String(this.form.controls['email'].value ?? '').trim();
    this.lookupError.set(null);
    this.invitedUser.set(null);

    if (!email || this.form.controls['email'].invalid) {
      this.form.controls['email'].markAsTouched();
      return;
    }

    this.lookingUp.set(true);
    try {
      const res = await this.service.getEmployeeByEmail(email);
      const data: any = res?.data ?? null;
      if (res?.success === false || !data || data.error || !data.employeeId) {
        this.lookupError.set('EMPLOYEES.INVITE.USER_NOT_FOUND');
        return;
      }
      this.invitedUser.set({
        employeeId:   data.employeeId,
        employeeName: data.employeeName ?? '',
        branches:     Array.isArray(data.branches) ? data.branches : [],
      });
      this.form.markAsDirty();
    } catch (e: any) {
      console.error('[employee-invitation] lookup failed', e);
      this.lookupError.set('EMPLOYEES.INVITE.USER_NOT_FOUND');
    } finally {
      this.lookingUp.set(false);
    }
  }

  /** Clear a resolved user when the email is edited so a stale name/branches
   *  can't be saved against a different address. */
  onEmailInput(): void {
    if (this.invitedUser()) this.invitedUser.set(null);
    if (this.lookupError()) this.lookupError.set(null);
  }

  // ─── Save / cancel ─────────────────────────────────────────────────────
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (!this.canSave()) return;

    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const user = this.invitedUser();
      const payload: any = {
        ...(this.original() ?? {}),
        id:              this.isEdit() ? this.inviteId() : (user?.employeeId ?? null),
        type:            this.original()?.type ?? 'cloud',
        email:           v.email,
        branches:        user?.branches ?? [],
        inventionStartAt: this.toIso(v.startAt),
        inventionEndAt:  v.endNever ? null : this.toIso(v.endAt),
      };

      const res = await this.service.saveInvitedEmployee(payload);
      if (res?.success !== false) {
        this.form.markAsPristine();
        this.toast.success('EMPLOYEES.INVITE.SENT');
        this.router.navigate(['/employees']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res?.msg);
      }
    } catch (e: any) {
      console.error('[employee-invitation] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/employees']);
  }

  /** CanDeactivate hook — guard prompts when there are unsaved edits. */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  // ─── Date <-> ISO 'yyyy-MM-dd' helpers (date-only) ───────────────────────
  /** Coerce whatever date shape the backend returns into a local `Date`
   *  (midnight). Parses y/m/d parts directly when present so the calendar
   *  day never shifts across timezones. Returns `null` on empty/parse
   *  failure so the picker stays blank. */
  private toDate(raw: any): Date | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** `Date` → ISO 'yyyy-MM-dd' string using the local date parts. Returns
   *  `null` for a null date. */
  private toIso(d: Date | null): string | null {
    if (!d) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
