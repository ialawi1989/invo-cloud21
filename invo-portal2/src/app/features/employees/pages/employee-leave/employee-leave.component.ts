import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { HrError, describeError } from '../../hr-error';
import { portalKey } from '../../hr-labels';
import { hrGrantFor } from '../../hr-privilege';
import { FileCatalog, HrFile } from '../../services/employee-file.service';
import {
  EmployeeLeaveService,
  LeaveBalance,
  LeaveCatalog,
  LeaveProfile,
  LeaveRequest,
  LeaveStatusDescriptor,
  LeaveTypeDescriptor,
} from '../../services/employee-leave.service';
import {
  LeaveActor,
  isSelf,
  mayCreateRequest,
  mayDecideRequest,
  mayDeleteRequest,
  mayEditRequest,
} from './leave-permissions';

/**
 * The leave tab — entitlement, balance and requests.
 *
 * ── THREE THINGS THIS TAB DOES THAT THE OTHERS DO NOT ────────────────────────
 *
 * 1. THE BALANCE IS NEVER SHOWN WITHOUT ITS WINDOW. Every figure is qualified
 *    by `yearStart`–`yearEnd` and by `basis`. `HireAnniversaryUnavailable` is
 *    called out loudly: it means the profile asked for a hire-anniversary year,
 *    the record has no hire date, and the numbers beside it silently cover the
 *    calendar year instead. That is a fallback, not an answer, and it is exactly
 *    the bug the server was fixed for.
 *
 * 2. THE DAY COUNT IS A SUGGESTION. The server says so in
 *    `suggestionExcludesPublicHolidays`, because no holiday calendar exists
 *    (spec 4.5 is not built). The form offers the suggestion, says what it
 *    leaves out, and lets the decided figure differ from it — the stored number
 *    is what the balance deducts, and it must stay stable when a calendar
 *    eventually lands.
 *
 * 3. THE EMPLOYEE IS THE AUTHOR. Self and privilege are different questions here
 *    and both are asked, per request rather than per screen. See
 *    leave-permissions.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-employee-leave',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-leave.component.html',
  styleUrls: ['./employee-leave.component.scss'],
})
export class EmployeeLeaveComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EmployeeLeaveService);
  private readonly privileges = inject(PrivilegeService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly employeeId =
    this.route.parent?.snapshot.paramMap.get('id')
    ?? this.route.snapshot.paramMap.get('id')
    ?? '0';

  readonly loading = signal(true);
  readonly busy = signal<string | null>(null);
  readonly error = signal<HrError | null>(null);
  readonly warnings = signal<string[]>([]);

  readonly requests = signal<LeaveRequest[]>([]);
  readonly balance = signal<LeaveBalance | null>(null);
  readonly profile = signal<LeaveProfile | null>(null);
  readonly catalog = signal<LeaveCatalog>({
    types: [], statuses: [], yearStarts: [],
    suggestedDays: null,
    // Assume the disclaimer applies until the server says otherwise.
    suggestionExcludesPublicHolidays: true,
  });
  readonly fileCatalog = signal<FileCatalog | null>(null);

  /**
   * Everything the permission rules need, in one object.
   *
   * A signal so it re-evaluates when the privilege payload hydrates, and a
   * single value so the rules cannot be asked with a half-built context.
   */
  readonly actor = computed<LeaveActor>(() => ({
    actorEmployeeId: (this.auth.currentEmployee as any)?.id ?? null,
    subjectEmployeeId: this.employeeId,
    canView: hrGrantFor(this.privileges, this.auth, 'employeeLeaveSecurity', 'view'),
    canEdit: hrGrantFor(this.privileges, this.auth, 'employeeLeaveSecurity', 'edit'),
    canApprove: hrGrantFor(this.privileges, this.auth, 'employeeLeaveSecurity', 'approve'),
  }));

  readonly isOwnRecord = computed(() => isSelf(this.actor()));
  readonly canCreate = computed(() => mayCreateRequest(this.actor()));
  /**
   * Setting entitlement is HR's act and HR's alone.
   *
   * The server requires `employeeLeaveSecurity.edit` on `saveLeaveProfile` and
   * — unlike a leave request — does NOT fall back to `isSelf`. Nobody sets
   * their own entitlement.
   */
  readonly canEditProfile = computed(() => this.actor().canEdit);
  readonly canUpload = computed(() => this.fileCatalog()?.storageConfigured === true);

  /** Per-request, not per-screen — the rules differ by status and by author. */
  mayEdit = (r: LeaveRequest) => mayEditRequest(r, this.actor());
  mayDelete = (r: LeaveRequest) => mayDeleteRequest(r, this.actor());
  mayDecide = (r: LeaveRequest) => mayDecideRequest(r, this.actor());

  /**
   * Is this a request the viewer could decide but for it being their own?
   *
   * Shown as a note rather than silence. An approver who sees no buttons on
   * their own request would otherwise assume the screen is broken; saying "you
   * cannot approve your own leave" is the server's actual reason.
   */
  isOwnPending = (r: LeaveRequest) =>
    this.actor().canApprove
    && r.status === 'Pending'
    && r.employeeId === this.actor().actorEmployeeId;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [requests, balance, profile, catalog, fileCatalog] = await Promise.all([
        this.service.requests(this.employeeId),
        // No window is supplied — the server resolves it from the profile. See
        // the service; sending one from here would be a second implementation
        // of the leave-year rule.
        this.service.balance(this.employeeId).catch(() => null),
        this.service.profile(this.employeeId).catch(() => null),
        this.service.catalog().catch(() => this.catalog()),
        this.service.fileCatalog().catch(() => null),
      ]);
      this.requests.set(requests);
      this.balance.set(balance);
      this.profile.set(profile);
      this.catalog.set(catalog);
      this.fileCatalog.set(fileCatalog);
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── The balance, and how far it can be trusted ────────────────────────

  /**
   * Is the displayed window a fallback rather than the profile's real one?
   *
   * True only for `HireAnniversaryUnavailable`. A null basis is separately
   * unknown — see `basisKnown` — and is not treated as fine.
   */
  readonly balanceIsFallback = computed(() =>
    this.balance()?.basis === 'HireAnniversaryUnavailable');

  readonly basisKnown = computed(() => this.balance()?.basis != null);

  basisKey(): string {
    switch (this.balance()?.basis) {
      case 'CompanyYear': return 'EMPLOYEES.LEAVE.BASIS.COMPANY_YEAR';
      case 'HireAnniversary': return 'EMPLOYEES.LEAVE.BASIS.HIRE_ANNIVERSARY';
      case 'HireAnniversaryUnavailable': return 'EMPLOYEES.LEAVE.BASIS.HIRE_UNAVAILABLE';
      case 'Explicit': return 'EMPLOYEES.LEAVE.BASIS.EXPLICIT';
      default: return 'EMPLOYEES.LEAVE.BASIS.UNKNOWN';
    }
  }

  // ─── The leave profile — what makes the balance mean anything ──────────
  //
  // Until this exists the balance panel reads 0 of 0 for every employee, which
  // is why the screen was not honest without it.

  readonly editingProfile = signal(false);

  readonly profileForm = this.fb.group({
    policyName: this.fb.control<string | null>(null),
    leaveYearStart: this.fb.control<string>('CompanyYear', Validators.required),
    annualEntitlementDays: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    openingBalance: this.fb.control<number | null>(null),
    carryOverDays: this.fb.control<number | null>(null),
    carryOverExpiry: this.fb.control<string | null>(null),
    accrualRateDays: this.fb.control<number | null>(null),
    accrualOverrideReason: this.fb.control<string | null>(null),
    encashmentEligible: this.fb.control<boolean>(false),
    delegateEmployeeId: this.fb.control<string | null>(null),
  });

  /**
   * Frozen after the first leave-year close.
   *
   * The server keeps the stored value and ignores whatever is sent, so an
   * editable box here would accept a number and silently discard it — the
   * write-only-columns shape. Shown read-only with the reason instead.
   */
  readonly openingBalanceLocked = computed(() => !!this.profile()?.openingBalanceLockedAt);

  /** The server refuses an accrual override with no reason. So does the form. */
  readonly accrualNeedsReason = computed(() => {
    this.profileTick();
    const rate = this.profileForm.controls.accrualRateDays.value;
    const reason = this.profileForm.controls.accrualOverrideReason.value;
    return rate !== null && rate !== undefined && !String(reason ?? '').trim();
  });

  readonly profileTick = signal(0);
  onProfileInput(): void { this.profileTick.update(n => n + 1); }

  startEditProfile(): void {
    const p = this.profile();
    this.profileForm.reset({
      policyName: p?.policyName ?? null,
      leaveYearStart: p?.leaveYearStart ?? 'CompanyYear',
      annualEntitlementDays: p?.annualEntitlementDays ?? null,
      openingBalance: p?.openingBalance ?? null,
      carryOverDays: p?.carryOverDays ?? null,
      carryOverExpiry: p?.carryOverExpiry ?? null,
      accrualRateDays: p?.accrualRateDays ?? null,
      accrualOverrideReason: p?.accrualOverrideReason ?? null,
      encashmentEligible: p?.encashmentEligible ?? false,
      delegateEmployeeId: p?.delegateEmployeeId ?? null,
    });
    if (this.openingBalanceLocked()) this.profileForm.controls.openingBalance.disable();
    this.onProfileInput();
    this.error.set(null);
    this.editingProfile.set(true);
  }

  cancelProfile(): void { this.editingProfile.set(false); }

  async submitProfile(): Promise<void> {
    if (this.profileForm.invalid || this.accrualNeedsReason()) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.busy.set('profile');
    this.error.set(null);
    try {
      // getRawValue() so a disabled (locked) opening balance is still sent —
      // the server ignores it when locked, and omitting it entirely would look
      // like a deliberate clear on a profile that is not locked yet.
      await this.service.saveProfile({
        employeeId: this.employeeId,
        ...this.profileForm.getRawValue(),
      });
      this.editingProfile.set(false);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  /** Year-start options come from the catalogue, never a local list. */
  readonly yearStartOptions = computed(() => this.catalog().yearStarts);

  /** The catalogue's label for a year-start key, falling back to the raw key. */
  yearStartLabel(key: string | null): string {
    const found = this.catalog().yearStarts.find(y => y.key === key);
    return found?.labelKey ? portalKey(found.labelKey) : (key ?? '');
  }

  // ─── Requests ──────────────────────────────────────────────────────────

  readonly editing = signal<string | null>(null);

  readonly form = this.fb.group({
    leaveType: this.fb.control<string | null>(null, Validators.required),
    startDate: this.fb.control<string | null>(null, Validators.required),
    endDate: this.fb.control<string | null>(null, Validators.required),
    halfDay: this.fb.control<string>('none'),
    // The DECIDED figure. Pre-filled from the suggestion, editable on purpose —
    // the suggestion excludes public holidays and this is the number stored.
    days: this.fb.control<number | null>(null, Validators.required),
    reason: this.fb.control<string | null>(null),
    /**
     * Draft or Pending only. Approve and reject go through `decide`, so that
     * saving a request can never approve it in passing — mirroring the server,
     * which refuses `Approved`/`Rejected` from this endpoint outright.
     */
    status: this.fb.control<string>('Draft', Validators.required),
  });

  /** The server's count for the range currently in the form. */
  readonly suggestion = signal<number | null>(null);
  readonly suggestionPending = signal(false);

  /**
   * Ask the SERVER what the range comes to.
   *
   * Not counted here. One implementation of "how many days is that" — the
   * portal's own would disagree the moment rest days become configurable, and
   * the disagreement would show up as a balance nobody could reconcile.
   */
  async refreshSuggestion(): Promise<void> {
    const { startDate, endDate, halfDay } = this.form.getRawValue();
    if (!startDate || !endDate) {
      this.suggestion.set(null);
      return;
    }
    this.suggestionPending.set(true);
    try {
      const catalog = await this.service.catalog({
        startDate, endDate, halfDay: halfDay ?? 'none',
      });
      this.suggestion.set(catalog.suggestedDays);
      // Keep the disclaimer in step with what the server just said.
      this.catalog.set({ ...this.catalog(), suggestionExcludesPublicHolidays: catalog.suggestionExcludesPublicHolidays });
      // Offered, not imposed: an empty days field takes the suggestion, a
      // figure someone has already decided is left alone.
      if (this.form.controls.days.value === null && catalog.suggestedDays !== null) {
        this.form.controls.days.setValue(catalog.suggestedDays);
      }
    } catch {
      // A failed suggestion is not a failed form. Null renders as "could not
      // be calculated" and the user types the figure themselves.
      this.suggestion.set(null);
    } finally {
      this.suggestionPending.set(false);
    }
  }

  /** Does the stored figure differ from what the server suggested? */
  readonly daysDifferFromSuggestion = computed(() => {
    const s = this.suggestion();
    const d = this.form.controls.days.value;
    return s !== null && d !== null && Number(s) !== Number(d);
  });

  useSuggestion(): void {
    const s = this.suggestion();
    if (s !== null) this.form.controls.days.setValue(s);
  }

  startAdd(): void {
    this.form.reset({
      leaveType: null, startDate: null, endDate: null, halfDay: 'none',
      days: null, reason: null, status: 'Draft',
    });
    this.suggestion.set(null);
    this.warnings.set([]);
    this.error.set(null);
    this.editing.set('new');
  }

  startEdit(r: LeaveRequest): void {
    this.form.reset({
      leaveType: r.leaveType || null,
      startDate: r.startDate,
      endDate: r.endDate,
      halfDay: r.halfDay ?? 'none',
      days: r.days,
      reason: r.reason,
      status: r.status ?? 'Draft',
    });
    this.suggestion.set(null);
    this.warnings.set([]);
    this.error.set(null);
    this.editing.set(r.id);
    void this.refreshSuggestion();
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.warnings.set([]);
  }

  async submit(): Promise<void> {
    const editing = this.editing();
    if (!editing) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(editing);
    this.error.set(null);
    try {
      const { warnings } = await this.service.saveRequest({
        ...(editing === 'new' ? {} : { id: editing }),
        employeeId: this.employeeId,
        ...this.form.getRawValue(),
      });
      // The sick-leave evidence rule. Advice, not a refusal — it cannot be
      // enforced until uploads are proven, and refusing would make sick leave
      // unrecordable rather than merely undocumented.
      this.warnings.set(warnings);
      this.editing.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  /** Move a request along its lifecycle without opening the editor. */
  async setStatus(r: LeaveRequest, status: string): Promise<void> {
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.saveRequest({
        id: r.id,
        employeeId: r.employeeId,
        leaveType: r.leaveType,
        startDate: r.startDate,
        endDate: r.endDate,
        halfDay: r.halfDay ?? 'none',
        // Resent unchanged. The decided figure must survive a status change —
        // recomputing it here would restate the balance on a cancellation.
        days: r.days,
        reason: r.reason,
        status,
      });
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async decide(r: LeaveRequest, decision: 'Approved' | 'Rejected'): Promise<void> {
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.decide(r.id, decision, this.decisionComment() || null);
      this.decisionComment.set('');
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  readonly decisionComment = signal('');

  onCommentInput(event: Event): void {
    this.decisionComment.set((event.target as HTMLInputElement).value);
  }

  async remove(r: LeaveRequest): Promise<void> {
    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.removeRequest(r.id);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Attachments ───────────────────────────────────────────────────────

  async onFilePicked(r: LeaveRequest, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const catalog = this.fileCatalog();
    if (catalog) {
      if (catalog.accepted.length && !catalog.accepted.includes(file.type)) {
        this.error.set({ titleKey: 'EMPLOYEES.HR.ERR.TYPE_REJECTED', detail: file.type || file.name, hintKey: null });
        return;
      }
      if (file.size > catalog.maxBytes) {
        this.error.set({ titleKey: 'EMPLOYEES.HR.ERR.TOO_LARGE', detail: `${Math.round(file.size / 1024 / 1024)}MB`, hintKey: null });
        return;
      }
    }

    this.busy.set(r.id);
    this.error.set(null);
    try {
      await this.service.upload(r.id, file);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  /** A fresh signed URL every time. Sick-leave evidence is medical, so audited. */
  async download(file: HrFile): Promise<void> {
    this.busy.set(file.id);
    this.error.set(null);
    try {
      const { url } = await this.service.downloadUrl(file.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Display helpers ───────────────────────────────────────────────────

  typeLabel(r: LeaveRequest): string {
    const found = this.catalog().types.find(t => t.key === r.leaveType);
    return found?.labelKey ? portalKey(found.labelKey) : r.leaveType;
  }

  statusLabel(r: LeaveRequest): string {
    const found = this.catalog().statuses.find(s => s.key === r.status);
    return found?.labelKey ? portalKey(found.labelKey) : (r.status ?? '');
  }

  statusClass(r: LeaveRequest): string {
    switch (r.status) {
      case 'Approved': return 'leave-badge leave-badge--approved';
      case 'Pending': return 'leave-badge leave-badge--pending';
      case 'Rejected': return 'leave-badge leave-badge--rejected';
      case 'Cancelled': return 'leave-badge leave-badge--cancelled';
      case 'Draft': return 'leave-badge leave-badge--draft';
      default: return 'leave-badge leave-badge--unknown';
    }
  }

  /** Does this request's type come out of the entitlement? Null if unknown. */
  deducts(r: LeaveRequest): boolean | null {
    const found = this.catalog().types.find(t => t.key === r.leaveType);
    return found ? found.deductsBalance === true : null;
  }

  /**
   * Does this request currently count against the balance?
   *
   * Read from the status catalogue, which marks Pending as consuming — the same
   * definition the server's balance query uses. Never a local list of statuses.
   */
  consumes(r: LeaveRequest): boolean | null {
    const found = this.catalog().statuses.find(s => s.key === r.status);
    return found ? found.consumesBalance === true : null;
  }

  /** Statuses this request may move to, per the transitions the server permits. */
  nextStatuses(r: LeaveRequest): string[] {
    if (!this.mayEdit(r)) return [];
    switch (r.status) {
      case 'Draft': return ['Pending', 'Cancelled'];
      case 'Pending': return ['Cancelled', 'Draft'];
      // Approved → Cancelled is permitted server-side, but only for someone
      // holding the edit grant: `mayEditOwnRequest` stops at Pending, so the
      // subject cannot cancel their own approved leave from here.
      case 'Approved': return this.actor().canEdit ? ['Cancelled'] : [];
      default: return [];
    }
  }

  statusActionKey(status: string): string {
    return `EMPLOYEES.LEAVE.ACTION.${status.toUpperCase()}`;
  }

  /**
   * The half-day options, spelled as the server's `HALF_DAY_OPTIONS`.
   *
   * Local because they are three fixed strings the catalogue does not carry —
   * unlike types and statuses, which always come from the server.
   */
  readonly halfDayOptions = [
    { key: 'none', labelKey: 'EMPLOYEES.LEAVE.HALF_DAY.NONE' },
    { key: 'first', labelKey: 'EMPLOYEES.LEAVE.HALF_DAY.FIRST' },
    { key: 'last', labelKey: 'EMPLOYEES.LEAVE.HALF_DAY.LAST' },
  ];

  /**
   * The statuses the editor may set.
   *
   * Draft and Pending only. Approved and Rejected have their own endpoint, and
   * the server refuses them from this one outright — offering them here would
   * produce a form whose save is rejected for a reason the user cannot see.
   */
  readonly draftStatusOptions = [
    { key: 'Draft', labelKey: 'EMPLOYEES.LEAVE.STATUS.DRAFT' },
    { key: 'Pending', labelKey: 'EMPLOYEES.LEAVE.STATUS.PENDING' },
  ];

  optionKey = (o: { key: string }) => o.key;
  optionName = (o: LeaveTypeDescriptor | LeaveStatusDescriptor | { key: string; labelKey: string }) =>
    o?.labelKey ? this.translate.instant(portalKey(o.labelKey)) : String(o ?? '');
  optionMatches = (a: any, b: any) => (a?.key ?? a) === (b?.key ?? b);

  fileSize(file: HrFile): string {
    if (file.sizeBytes === null) return '';
    if (file.sizeBytes < 1024) return `${file.sizeBytes} B`;
    if (file.sizeBytes < 1024 * 1024) return `${Math.round(file.sizeBytes / 1024)} KB`;
    return `${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  trackRequest = (_: number, r: LeaveRequest) => r.id;
  trackFile = (_: number, f: HrFile) => f.id;
}
