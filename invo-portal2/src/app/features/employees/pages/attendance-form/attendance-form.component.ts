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
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { EmployeeAttendanceService } from '../../services/employee-attendance.service';
import { AttendanceSummary } from '../../models/employee.types';

/**
 * Attendance → adjust form (edit only)
 * ────────────────────────────────────
 * Loads via `/employees/attendance/:id`. Shows the read-only recorded
 * clock-in / clock-out times plus the employee + branch, and lets an admin
 * override them via two `datetime-local` inputs — the modern equivalent of
 * the legacy flatpickr modal, which adjusted one column at a time. Here both
 * adjustments live on one page and are submitted together.
 *
 * The full server record is captured in `original` so the save payload can
 * round-trip fields this UI doesn't touch.
 */
@Component({
  selector: 'app-attendance-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    DatePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance-form.component.html',
  styleUrl: './attendance-form.component.scss',
})
export class AttendanceFormComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private service    = inject(EmployeeAttendanceService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** The current attendance record id, or `null` while we wait for the param. */
  attendanceId = signal<string | null>(null);

  /** Full server record — kept so save round-trips unknown fields untouched. */
  private original = signal<AttendanceSummary | null>(null);

  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ─── Form ───────────────────────────────────────────────────────────────
  // `Date` values (carrying date + time). `null` = keep the recorded time
  // (no adjustment). Serialised to ISO strings on save.
  form: FormGroup = this.fb.group({
    adjClockedIn:  [null as Date | null],
    adjClockedOut: [null as Date | null],
  });

  // ─── Derived ────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('EMPLOYEES.ATTENDANCE.TITLE'), routerLink: '/employees/attendance' },
      { label: this.translate.instant('EMPLOYEES.ATTENDANCE.FORM_TITLE') },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.original()?.employeeName || this.translate.instant('EMPLOYEES.ATTENDANCE.FORM_TITLE');
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  /** Read-only recorded values for the summary card. */
  employeeName = computed<string>(() => this.original()?.employeeName || '—');
  branchName   = computed<string>(() => this.original()?.branchName   || '—');
  clockedIn    = computed<string | null>(() => this.original()?.clockedIn  ?? null);
  clockedOut   = computed<string | null>(() => this.original()?.clockedOut ?? null);

  /** Min for the adjusted clock-out — can't be earlier than the adjusted
   *  clock-in (mirrors the legacy flatpickr `minDate`). Bumped on form
   *  changes since form control values aren't tracked by signals. */
  private formTick = signal(0);
  minClockOut = computed<Date | null>(() => {
    this.formTick();
    return (this.form.controls['adjClockedIn'].value as Date | null) ?? null;
  });

  constructor() {
    withTranslations('employees');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    // Adjust-only page — there's no "new attendance" flow. Bounce to the list.
    if (!id || id === 'new') {
      this.router.navigate(['/employees/attendance']);
      return;
    }
    this.attendanceId.set(id);

    this.loading.set(true);
    try {
      const data = await this.service.getOne(id);
      if (!data) {
        this.router.navigate(['/employees/attendance']);
        return;
      }
      this.original.set(data);
      this.form.patchValue({
        adjClockedIn:  this.toDate(data.adjClockedIn),
        adjClockedOut: this.toDate(data.adjClockedOut),
      });
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const original = this.original();
      const id = this.attendanceId() ?? null;

      // Match the legacy contract: one request per adjusted column, carrying
      // only { id, adj<field>, type } — and a LOCAL datetime string (not a UTC
      // ISO with `Z`) so the saved time is exactly what the user picked.
      const jobs: Array<'adjClockedIn' | 'adjClockedOut'> = [];
      if (this.changed(v.adjClockedIn,  original?.adjClockedIn))  jobs.push('adjClockedIn');
      if (this.changed(v.adjClockedOut, original?.adjClockedOut)) jobs.push('adjClockedOut');

      if (jobs.length === 0) {
        this.form.markAsPristine();
        this.router.navigate(['/employees/attendance']);
        return;
      }

      for (const field of jobs) {
        const res = await this.service.adjust({
          id,
          [field]: this.toLocal(this.form.getRawValue()[field] as Date | null),
          type:    field,
        });
        if (res?.success === false) {
          this.toast.error('COMMON.SAVE_FAILED', res?.msg);
          return;
        }
      }

      // Clear the dirty flag before navigating so the unsaved-changes guard
      // doesn't fire during the route change.
      this.form.markAsPristine();
      this.toast.success('EMPLOYEES.ATTENDANCE.SAVED');
      this.router.navigate(['/employees/attendance']);
    } catch (e: any) {
      console.error('[attendance-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  /** True when the picked value differs from the originally-saved adjustment. */
  private changed(value: Date | null, original: string | null | undefined): boolean {
    const a = value ? value.getTime() : null;
    const b = original ? new Date(original).getTime() : null;
    return a !== b;
  }

  cancel(): void {
    this.router.navigate(['/employees/attendance']);
  }

  /** CanDeactivate hook — guard prompts when the form is dirty. */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  // ─── Date <-> ISO helpers (datetime — time preserved) ─────────────────────
  /** ISO string → `Date` (carrying date + time). Returns `null` for
   *  null / unparseable input. */
  private toDate(iso: string | null): Date | null {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** `Date` → local `"YYYY-MM-DD HH:mm"` string (matches the legacy payload).
   *  Uses local calendar parts — no UTC conversion — so the time is stored
   *  exactly as the user picked it. Returns `null` for a null date. */
  private toLocal(d: Date | null): string | null {
    if (!d) return null;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}
