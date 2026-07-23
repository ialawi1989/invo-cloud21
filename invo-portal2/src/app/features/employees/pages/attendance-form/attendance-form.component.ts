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
  // `datetime-local` string values ("YYYY-MM-DDTHH:mm"). Empty = keep the
  // recorded time (no adjustment).
  form: FormGroup = this.fb.group({
    adjClockedIn:  [''],
    adjClockedOut: [''],
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
  minClockOut = computed<string>(() => {
    this.formTick();
    return String(this.form.controls['adjClockedIn'].value ?? '');
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
        adjClockedIn:  isoToLocalInput(data.adjClockedIn),
        adjClockedOut: isoToLocalInput(data.adjClockedOut),
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
      const payload: any = {
        ...(original ?? {}),
        id:            this.attendanceId() ?? null,
        adjClockedIn:  localInputToIso(v.adjClockedIn),
        adjClockedOut: localInputToIso(v.adjClockedOut),
      };
      const res = await this.service.adjust(payload);
      if (res?.success !== false) {
        // Clear the dirty flag before navigating so the unsaved-changes
        // guard doesn't fire during the route change.
        this.form.markAsPristine();
        this.toast.success('EMPLOYEES.ATTENDANCE.SAVED');
        this.router.navigate(['/employees/attendance']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res?.msg);
      }
    } catch (e: any) {
      console.error('[attendance-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/employees/attendance']);
  }

  /** CanDeactivate hook — guard prompts when the form is dirty. */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }
}

// ─── datetime-local <-> ISO helpers ─────────────────────────────────────────
/** ISO string → `datetime-local` value ("YYYY-MM-DDTHH:mm") in local time.
 *  Returns '' for null / unparseable input. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value → ISO string (UTC). Returns null for empty input. */
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
