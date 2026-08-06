import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
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
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownLoadFn } from '@shared/components/dropdown/search-dropdown.types';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  MediaPickerModalComponent,
  MediaPickerConfig,
} from '@features/settings/media/components/media-picker/media-picker-modal.component';
import { Media } from '@features/settings/media/models/media.model';
import { toDateOnly, toIsoDateOnly } from '@shared/utils';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeFieldManifestService } from '../../services/employee-field-manifest.service';
import {
  employeeEmailValidator,
  passcodeUniqueValidator,
} from '../../services/employee-validators';
import {
  applyManifestRules,
  buildGroupControl,
  extractGroupValue,
  patchGroupValue,
} from '../../services/manifest-form.util';
import { EmployeeDetails } from '../../models/employee.types';
import {
  FieldManifest,
  FieldOption,
  RequiredMode,
} from '../../models/field-manifest.types';
import { countryOptions, languageOptions } from '../../models/employee-catalogs';
import { hrFieldsEnabled } from '../../employee-feature-flags';
import { GuidedTourService } from '@shared/services/guided-tour.service';
import { EMPLOYEE_FORM_TOUR, EMPLOYEE_TOUR_KEY } from './employee-form.tour';
import { FieldRendererComponent } from './components/field-renderer/field-renderer.component';
// Branch list source — the settings service already wraps `branch/getBranches`
// and normalises the wire shape. CompanyService carries no branch collection,
// so we reuse the (root-provided) BranchSettingsService here.
import { BranchSettingsService } from '../../../settings/services/branch-settings.service';

/** Minimal option shape used by both the privilege and branch dropdowns. */
interface Option {
  id: string;
  name: string;
}

/**
 * Employee add/edit form
 * ──────────────────────
 * `/employees/:id` — `:id === '0'` creates, anything else edits.
 *
 * Migrated from the legacy `employee-form` (InvoCloudFront2). Modernised to
 * the invo-portal2 form conventions: standalone + OnPush + signals, a reactive
 * form via FormBuilder, shared chrome (breadcrumbs / sticky footer / loading
 * overlay / toast) and the shared `<app-toggle>` / `<app-search-dropdown>`
 * controls instead of native checkboxes / `<select>`.
 *
 * The loaded record is captured in `original` and spread into the save payload
 * so unknown fields round-trip untouched. The heavy `privileges` blob is
 * dropped from the payload (mirrors the legacy `delete this.employeeData.privileges`).
 */
@Component({
  selector: 'app-employee-form',
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
    SearchDropdownComponent,
    DatePickerComponent,
    FieldRendererComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.scss',
})
export class EmployeeFormComponent implements OnInit, OnDestroy, CanLeaveComponent {
  private fb          = inject(FormBuilder);
  private service     = inject(EmployeeService);
  private manifestSvc = inject(EmployeeFieldManifestService);
  private branchSvc   = inject(BranchSettingsService);
  private privilegeSvc = inject(PrivilegeService);
  private translate   = inject(TranslateService);
  private destroyRef  = inject(DestroyRef);
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private toast       = inject(ToastService);
  private modal       = inject(ModalService);
  private tour        = inject(GuidedTourService);

  /** Credential rules (legacy: password >= 8, pass code >= 4 digits). */
  readonly passwordMinLength = 8;
  readonly passcodeMinLength = 4;

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Route id — `'0'` (or null) means we're creating a new employee. */
  employeeId = signal<string | null>(null);
  isCreate   = computed<boolean>(() => {
    const id = this.employeeId();
    return id === null || id === '0';
  });

  /** Loaded record — spread into the save payload so unknown fields survive. */
  private original = signal<EmployeeDetails | null>(null);

  // ── Dropdown data ──────────────────────────────────────────────────────
  privileges = signal<Option[]>([]);
  branches   = signal<Option[]>([]);

  // ── Image (media-library picker, as in the legacy form) ────────────────
  private mediaUrl    = signal<{ defaultUrl: string }>({ defaultUrl: '' });
  private mediaId     = signal<string | null>(null);
  avatarPreview = computed<string>(() => this.mediaUrl().defaultUrl || '');

  // ── Edit-mode "change secret" reveals ──────────────────────────────────
  changePassword = signal<boolean>(false);
  changePassCode = signal<boolean>(false);
  changeMSR      = signal<boolean>(false);

  /** True once the initial load/patch is done — gates the dirty flag so the
   *  seeding `patchValue` doesn't immediately mark the form dirty. */
  private loaded = false;
  /** Unsaved-changes flag consumed by the CanDeactivate guard. */
  dirty = signal<boolean>(false);

  /** Bumped on every form valueChange so signal-based computeds that read
   *  raw control values (roles / branch selection) stay reactive. */
  private formTick = signal(0);
  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ── Reactive form ───────────────────────────────────────────────────────
  // The 13 original controls, unchanged. `hasSystemAccess` joins them; the
  // manifest groups (`profile`, `employment`) are added in ngOnInit once their
  // descriptors are known.
  form: FormGroup = this.fb.group({
    // D1 — does this employee sign in at all? Default true, so every existing
    // record behaves exactly as before.
    hasSystemAccess: [true],
    name:            ['', [Validators.required]],
    email:           ['', [Validators.required, Validators.email]],
    password:        [''],
    passcode:        [''],
    msr:             [''],
    // Roles
    admin:           [false],
    user:            [true],
    isDriver:        [false],
    superAdmin:      [false],
    // Access
    privilegeId:     [null as string | null],
    // Branch assignment
    branchIds:       [[] as string[]],
    branchId:        [''], // primary branch id
    // Employment — held as `Date | null` on the form; mapped to/from ISO
    // 'yyyy-MM-dd' strings (the stored/wire format) at the load/save boundary.
    hireDate:        [null as Date | null],
    terminationDate: [null as Date | null],
  });

  // ── Manifest-driven HR groups (phase 1: profile + employment) ──────────
  /**
   * Gated on `EMPLOYEE_HR_FIELDS`, off by default. While it's off the manifest
   * is never fetched, no controls are built, and the two cards don't render —
   * so nothing can collect data that `saveEmployee`'s fixed column list would
   * silently drop. A record that already carries the groups still round-trips
   * untouched through the `...original` spread.
   */
  hrFields = hrFieldsEnabled();

  manifest = signal<FieldManifest | null>(null);

  /** Distinct department / position values in use, for the free-text
   *  autocomplete on those two fields. */
  private departmentSuggestions = signal<string[]>([]);
  private positionSuggestions = signal<string[]>([]);

  /** The current line manager, resolved to `{ id, name }` so the "reports to"
   *  trigger shows a name rather than a raw id when the record loads. The
   *  dropdown pages server-side, so the manager needn't be on the first page. */
  private resolvedManager = signal<{ id: string; name: string } | null>(null);

  /** Whole-form raw value, re-read on every change — the renderer evaluates
   *  `visibleWhen` / `requiredWhen` against this. */
  formValues = computed<Record<string, any>>(() => {
    this.formTick();
    return this.form.getRawValue();
  });

  /**
   * How hard `required` bites.
   *
   * A new record is validated as specified. An existing one is lenient: it
   * predates every field in this manifest, so demanding a nationality before
   * an admin can change someone's pass code would be a regression. A field
   * that *does* hold a value still can't be blanked.
   */
  requiredMode = computed<RequiredMode>(() => (this.isCreate() ? 'strict' : 'lenient'));

  profileGroup = computed<FormGroup | null>(() => {
    this.manifest();
    return (this.form.get('profile') as FormGroup) ?? null;
  });
  employmentGroup = computed<FormGroup | null>(() => {
    this.manifest();
    return (this.form.get('employment') as FormGroup) ?? null;
  });

  profileFields = computed(() => this.manifest()?.groups.find((g) => g.key === 'profile')?.fields ?? []);
  employmentFields = computed(() => this.manifest()?.groups.find((g) => g.key === 'employment')?.fields ?? []);

  /** Dynamic option lists the renderer resolves by name. Country and language
   *  labels come from `Intl.DisplayNames`, so they follow the active language
   *  rather than needing ~500 translation keys. */
  optionSources = computed<Record<string, FieldOption[]>>(() => {
    this.i18nTick();
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    return {
      countries: countryOptions(lang),
      languages: languageOptions(lang),
    };
  });

  /**
   * Paged option loaders. "Reports to" searches the employee table server-side
   * rather than pulling a fixed slice of it: the list endpoint is paginated,
   * so any in-memory copy silently loses everyone past the limit.
   *
   * Page 1 with no search is prefixed with the currently selected manager, so
   * the trigger resolves to a name even when they're on page 7.
   * Nobody reports to themselves; a deeper cycle check needs the whole graph
   * and belongs on the backend at save time.
   */
  optionLoaders = computed<Record<string, DropdownLoadFn<FieldOption>>>(() => {
    const selfId = this.employeeId();
    const manager = this.resolvedManager();
    return {
      employees: async ({ page, pageSize, search }) => {
        const res = await this.service.searchEmployees({
          page,
          limit: pageSize,
          searchTerm: search ?? '',
        });
        const items = res.items
          .filter((e) => e.id !== selfId)
          .map((e) => ({ value: e.id, label: e.name }));
        if (page === 1 && !search && manager && !items.some((i) => i.value === manager.id)) {
          items.unshift({ value: manager.id, label: manager.name });
        }
        return { items, hasMore: res.hasMore };
      },
    };
  });

  suggestionSources = computed<Record<string, string[]>>(() => ({
    departments: this.departmentSuggestions(),
    positions: this.positionSuggestions(),
  }));

  /** Read-only values for `computed` descriptors, keyed by full path. */
  computedValues = computed<Record<string, string>>(() => {
    const values = this.formValues();
    const out: Record<string, string> = {};
    const hire = values['hireDate'] as Date | null;
    const months = Number(values['employment']?.probationMonths ?? NaN);
    if (hire instanceof Date && Number.isFinite(months)) {
      const end = new Date(hire.getFullYear(), hire.getMonth() + months, hire.getDate());
      out['employment.probationEndDate'] = toIsoDateOnly(end) ?? '';
    }
    return out;
  });

  // ── Derived ────────────────────────────────────────────────────────────
  /** D1 — when off, this record is a person without a login. */
  hasSystemAccess = computed<boolean>(() => {
    this.formTick();
    return !!this.form.controls['hasSystemAccess'].value;
  });

  /**
   * True when this edit is *restoring* access to a record that was saved
   * without it.
   *
   * Revocation deliberately leaves the stored credentials alone: they live on
   * the shared `Employees` identity row, so nulling them would cut this person
   * off at every other company they work for. Access is ended by the
   * per-company role flags instead.
   *
   * That makes the old pass code *dormant*, not gone — and a dormant
   * credential is exactly the one that gets shared or written down while
   * nobody is using the account. So restoring access retires it: new
   * credentials are entered and required, as on a create, and the previous
   * value is overwritten rather than reinstated.
   */
  accessBeingRestored = computed<boolean>(() =>
    !this.isCreate() && this.hasSystemAccess() && this.original()?.hasSystemAccess === false);

  /** Credentials must be entered from scratch: a new record, or one whose
   *  access is being restored. Used everywhere the credential fields used to
   *  ask `isCreate()`. */
  credentialsRequired = computed<boolean>(() => this.isCreate() || this.accessBeingRestored());

  isSuperAdmin = computed<boolean>(() => {
    this.formTick();
    return !!this.form.controls['superAdmin'].value;
  });

  isAdmin = computed<boolean>(() => {
    this.formTick();
    return !!this.form.controls['admin'].value;
  });
  isUser = computed<boolean>(() => {
    this.formTick();
    return !!this.form.controls['user'].value;
  });

  /**
   * Role-driven field visibility (mirrors the legacy form's role blocks):
   *  • Cloud accounts (Cloud Admin / Super Admin) sign in with Email + Password.
   *  • POS accounts (POS User) sign in with a Pass Code.
   * `isDriver` is an independent flag and does not change which fields show.
   * The MSR swipe id lives with Access & Permissions and is offered for every
   * account (legacy parity — it was never gated on the POS role).
   *
   * All of it is additionally gated on `hasSystemAccess`: an employee with no
   * login has no credentials to show, and none to validate.
   */
  showEmailPassword = computed<boolean>(() => this.hasSystemAccess() && (this.isAdmin() || this.isSuperAdmin()));
  showPassCodeMsr   = computed<boolean>(() => this.hasSystemAccess() && this.isUser() && !this.isSuperAdmin());

  /** Email the record was loaded with — an unchanged address skips the
   *  uniqueness probe (legacy `tempEmail`). */
  private originalEmail = signal<string>('');

  /** Set when the typed address belongs to an existing InvoCloud user; the
   *  form then offers the invitation flow instead of a plain create. */
  emailExistsAsUser = computed<boolean>(() => {
    this.formTick();
    return !!this.form.controls['email'].errors?.['emailExists'];
  });

  /**
   * Jump to the invitation form pre-filled with the typed address — the legacy
   * "Click here to invite" shortcut shown when the email resolves to an
   * existing InvoCloud user who isn't in this company yet.
   */
  inviteEmployee(): void {
    const email = String(this.form.controls['email'].value ?? '').trim();
    void this.router.navigate(['/employees/invitation', 0], {
      queryParams: { email },
    });
  }

  // ── Secret placeholders (edit mode: empty = keep the current value) ──────
  passwordPlaceholder = computed<string>(() => {
    this.i18nTick();
    return this.credentialsRequired() ? '' : this.translate.instant('EMPLOYEES.FORM.KEEP_EMPTY_PASSWORD');
  });
  passcodePlaceholder = computed<string>(() => {
    this.i18nTick();
    return this.credentialsRequired() ? '' : this.translate.instant('EMPLOYEES.FORM.KEEP_EMPTY_PASSCODE');
  });
  msrPlaceholder = computed<string>(() => {
    this.i18nTick();
    return this.credentialsRequired() ? '' : this.translate.instant('EMPLOYEES.FORM.KEEP_EMPTY_MSR');
  });

  /** Selected branches (full option objects) for the chip list + primary star. */
  selectedBranches = computed<Option[]>(() => {
    this.formTick();
    const ids: string[] = this.form.controls['branchIds'].value ?? [];
    const all = this.branches();
    return all.filter((b) => ids.includes(b.id));
  });

  primaryBranchId = computed<string>(() => {
    this.formTick();
    return String(this.form.controls['branchId'].value ?? '');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('EMPLOYEES.TITLE'), routerLink: '/employees' },
      {
        label: this.isCreate()
          ? this.translate.instant('EMPLOYEES.FORM.ADD_TITLE')
          : this.translate.instant('EMPLOYEES.FORM.EDIT_TITLE'),
      },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.original()?.name || (this.isCreate()
      ? this.translate.instant('EMPLOYEES.FORM.ADD_TITLE')
      : this.translate.instant('EMPLOYEES.FORM.EDIT_TITLE'));
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  // ── Dropdown adapters ──────────────────────────────────────────────────
  optionDisplay = (o: Option): string => o?.name ?? '';
  optionToValue = (o: Option): string => o?.id ?? (o as unknown as string);
  optionCompare = (a: any, b: any): boolean =>
    (a?.id ?? a) === (b?.id ?? b);

  constructor() {
    withTranslations('employees');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formTick.update((n) => n + 1);
        if (this.loaded) this.dirty.set(true);
        // Manifest conditions are re-evaluated on every change, exactly like
        // the hand-written role rules. Validator updates below don't emit, so
        // this can't feed back into itself.
        this.syncSeniorityDefault();
        this.applyManifestRules();
      });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    this.employeeId.set(id);

    this.loading.set(true);
    try {
      // Fire the reference-data loads and (on edit) the record load together.
      // With the HR fields flagged off there's nothing to fetch and nothing to
      // build: the form is exactly the pre-phase-1 form plus the access flag.
      const hr = this.hrFields();
      const [, , data, manifest, lookups] = await Promise.all([
        this.loadPrivileges(),
        this.loadBranches(),
        this.isCreate() ? Promise.resolve(null) : this.service.getOne(id!),
        hr ? this.manifestSvc.getManifest() : Promise.resolve(null),
        hr ? this.service.getEmploymentLookups() : Promise.resolve({ departments: [], positions: [] }),
      ]);

      this.departmentSuggestions.set(lookups.departments);
      this.positionSuggestions.set(lookups.positions);

      // Controls for the manifest groups must exist before anything is patched
      // into them — and all of it happens before `loaded` flips, so seeding
      // never marks the form dirty.
      // HR data belongs to the employee's home company. The API says whether
      // this caller is that company (`isHrDataOwner`, set by the UNION arm that
      // answered) — the client must not re-derive it, because a second
      // discriminator can disagree with the query that enforces the rule.
      // When it says no, the cards aren't rendered at all: the groups come back
      // null and any write is ignored, so showing them empty would mean HR
      // typing into fields that are silently dropped.
      if (manifest && data?.isHrDataOwner !== false) {
        this.installManifestControls(manifest);
        this.manifest.set(manifest);
      }

      if (data) {
        this.original.set(data);
        this.patchFromRecord(data);
        if (hr) void this.resolveManagerName(data.employment?.reportsTo ?? null);
      }

      // Apply role-scoped field visibility + validators for the loaded roles.
      this.applyFieldRules();
      this.syncSeniorityDefault();
      this.applyManifestRules();
      if (this.form.controls['superAdmin'].value) this.setSuperAdminLock(true);
    } finally {
      this.loading.set(false);
      this.loaded = true;
    }
  }

  // ── Manifest groups ────────────────────────────────────────────────────
  /** Add one `FormGroup` per manifest group. Defaults (notice period, weekly
   *  hours) are seeded on create only — an existing record must not have
   *  values invented for it on load. */
  private installManifestControls(manifest: FieldManifest): void {
    for (const group of manifest.groups) {
      this.form.setControl(
        group.key,
        buildGroupControl(this.fb, group.fields, { seedDefaults: this.isCreate() }),
        { emitEvent: false },
      );
    }
  }

  /** Look up the stored line manager's name so the picker shows it. Fire and
   *  forget: a failure just leaves the id showing until the user opens the
   *  dropdown, which isn't worth blocking the form load over. */
  private async resolveManagerName(managerId: string | null): Promise<void> {
    if (!managerId) return;
    try {
      const manager = await this.service.getOne(managerId);
      if (manager) this.resolvedManager.set({ id: managerId, name: manager.name ?? '' });
    } catch {
      this.resolvedManager.set(null);
    }
  }

  /** Recompute validators for the manifest-driven controls. */
  private applyManifestRules(): void {
    const manifest = this.manifest();
    if (manifest) applyManifestRules(this.form, manifest.groups, this.requiredMode());
  }

  /** Last hire date this component seeded seniority from — so the default is
   *  applied on load and when the hire date changes, and a seniority date the
   *  user deliberately cleared isn't immediately refilled. */
  private lastHireDate: string | null = null;

  /**
   * Seniority defaults to the hire date (they differ only on a rehire or a
   * transfer, which the user then sets explicitly).
   *
   * Only ever seeded from a *user* change to the hire date — never during the
   * initial load. Seeding on load would give a legacy record an `employment`
   * group it never had, so opening it and pressing Save would silently write
   * HR data nobody entered. Same rule as `defaultValue`: nothing is invented
   * for a record that already exists.
   */
  private syncSeniorityDefault(): void {
    if (!this.loaded) {
      // Remember the loaded hire date so it doesn't read as a change later.
      this.lastHireDate = toIsoDateOnly(this.form.controls['hireDate'].value as Date | null);
      return;
    }

    const seniority = this.form.get('employment.seniorityDate');
    if (!seniority) return;

    const hireDate = this.form.controls['hireDate'].value as Date | null;
    const iso = toIsoDateOnly(hireDate);
    const hireChanged = iso !== this.lastHireDate;
    this.lastHireDate = iso;

    if (hireDate && hireChanged && !seniority.value) {
      seniority.setValue(hireDate, { emitEvent: false });
    }
  }

  // ── Loaders ────────────────────────────────────────────────────────────
  private async loadPrivileges(): Promise<void> {
    try {
      const res = await this.privilegeSvc.getPrivilegeList({
        page: 1, limit: 1000, searchTerm: '', sortBy: {},
      });
      const list = Array.isArray(res) ? res : res.list;
      this.privileges.set(list.map((p: any) => ({ id: p.id ?? '', name: p.name ?? '' })));
    } catch {
      this.privileges.set([]);
    }
  }

  private async loadBranches(): Promise<void> {
    try {
      const res = await this.branchSvc.getList({ page: 1, limit: 1000, searchTerm: '' });
      this.branches.set(res.list.map((b) => ({ id: b.id, name: b.name })));
    } catch {
      this.branches.set([]);
    }
  }

  private patchFromRecord(data: EmployeeDetails): void {
    this.form.patchValue({
      // Absent on every record predating the flag — those are accounts.
      hasSystemAccess: data.hasSystemAccess ?? true,
      name:            data.name ?? '',
      email:           data.email ?? '',
      admin:           !!data.admin,
      user:            !!data.user,
      isDriver:        !!data.isDriver,
      superAdmin:      !!data.superAdmin,
      privilegeId:     data.privilegeId ?? null,
      branchIds:       (data.branches ?? []).map((b: any) => b.id),
      branchId:        data.branchId ?? '',
      hireDate:        toDateOnly(data.hireDate ?? null),
      terminationDate: toDateOnly(data.terminationDate ?? null),
      // Secrets are never pre-filled — the user re-enters them to change.
      password:        '',
      passcode:        '',
      msr:             '',
    });
    this.mediaUrl.set(data.mediaUrl ?? { defaultUrl: '' });
    this.mediaId.set(data.mediaId ?? null);
    this.originalEmail.set(data.email ?? '');

    // HR groups. A record without them patches to empty controls and stays
    // empty — nothing is written back unless the user fills something in.
    const manifest = this.manifest() ?? null;
    for (const group of manifest?.groups ?? []) {
      const control = this.form.get(group.key);
      if (control instanceof FormGroup) {
        patchGroupValue(this.fb, control, group.fields, (data as any)[group.key]);
      }
    }
  }

  // ── Roles ──────────────────────────────────────────────────────────────
  /** Keep the legacy invariant: at least one of Cloud-Admin / POS-User is on
   *  (unless the account is a Super Admin, which supersedes both). */
  private enforceRoleInvariant(): void {
    // An employee with no system access has no roles at all — the invariant
    // is what used to force a POS credential onto every record, which is
    // exactly what `hasSystemAccess` exists to stop. Guarded here and again in
    // save(), since either path can be reached without the other.
    if (!this.form.controls['hasSystemAccess'].value) return;
    const admin = !!this.form.controls['admin'].value;
    const user  = !!this.form.controls['user'].value;
    const superAdmin = !!this.form.controls['superAdmin'].value;
    if (!superAdmin && !admin && !user) {
      this.form.controls['user'].setValue(true);
    }
  }

  onAdminChange(): void { this.enforceRoleInvariant(); this.applyFieldRules(); }
  onUserChange(): void  { this.enforceRoleInvariant(); this.applyFieldRules(); }

  /**
   * Toggle whether this employee signs in (D1).
   *
   * Turning it back on restores the role invariant, so an account never ends
   * up with no role; turning it off just stops validating credentials — the
   * typed values stay put until save, which drops them.
   */
  toggleSystemAccess(value: boolean): void {
    this.form.controls['hasSystemAccess'].setValue(value);
    if (value) this.enforceRoleInvariant();
    this.applyFieldRules();
    this.dirty.set(true);
  }

  /**
   * POS User is the last remaining role (Cloud Admin off) — it must stay on,
   * so its card is locked (mirrors the legacy
   * `[disabled]="admin == false && user == true"`).
   */
  posLocked = computed<boolean>(() => this.isUser() && !this.isAdmin());

  /** Clickable role-card toggle. Honors the disable rules (locked last role /
   *  super-admin lock) so a card can't be flipped when it shouldn't be. */
  toggleRole(role: 'admin' | 'user' | 'isDriver'): void {
    if (this.isSuperAdmin()) return;              // super-admin accounts are locked
    if (role === 'user' && this.posLocked()) return; // can't drop the last role
    const ctrl = this.form.controls[role];
    ctrl.setValue(!ctrl.value);
    if (role === 'admin') this.onAdminChange();
    else if (role === 'user') this.onUserChange();
    this.dirty.set(true);
  }

  /** Super admins bypass privilege / branch / employment scoping — mirror the
   *  legacy `[disabled]="employeeData.superAdmin"` bindings by disabling the
   *  affected controls (kept in the payload via `getRawValue`).
   *
   *  The manifest groups are deliberately **not** in this list. The lock exists
   *  because access scoping is meaningless for an account that bypasses it; a
   *  super admin still has a date of birth, an address and a line manager, and
   *  HR still has to be able to record them. */
  private setSuperAdminLock(locked: boolean): void {
    const names = ['admin', 'user', 'privilegeId', 'branchIds', 'branchId', 'hireDate', 'terminationDate'];
    for (const n of names) {
      const ctrl = this.form.controls[n];
      if (locked) ctrl.disable({ emitEvent: false });
      else ctrl.enable({ emitEvent: false });
    }
  }

  // ── Branch assignment ──────────────────────────────────────────────────
  setPrimaryBranch(id: string): void {
    if (this.isSuperAdmin()) return;
    this.form.controls['branchId'].setValue(id);
  }

  // ── Image ──────────────────────────────────────────────────────────────
  /** Open the shared media library (legacy used the same picker modal rather
   *  than a bare file input, so uploads land in the library and can be reused). */
  async chooseImage(): Promise<void> {
    const ref = this.modal.open<MediaPickerModalComponent, MediaPickerConfig, Media | Media[] | undefined>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image'],
          title: this.translate.instant('EMPLOYEES.FORM.CHOOSE_IMAGE'),
          preSelectedIds: this.mediaId() ? [this.mediaId()!] : [],
        },
      },
    );
    const result = await ref.afterClosed();
    const media = Array.isArray(result) ? result[0] : result;
    if (media) {
      this.mediaId.set(media.id);
      this.mediaUrl.set({ defaultUrl: media.imageUrl ?? media.thumbUrl ?? '' });
      this.dirty.set(true);
    }
  }

  removeImage(): void {
    this.mediaUrl.set({ defaultUrl: '' });
    this.mediaId.set(null);
    this.dirty.set(true);
  }

  // ── Secret "change" toggles (edit mode) ─────────────────────────────────
  toggleChangePassword(value: boolean): void {
    this.changePassword.set(value);
    if (!value) this.form.controls['password'].setValue('');
    this.applyFieldRules();
  }

  toggleChangePassCode(value: boolean): void {
    this.changePassCode.set(value);
    if (!value) this.form.controls['passcode'].setValue('');
    this.applyFieldRules();
  }

  toggleChangeMSR(value: boolean): void {
    this.changeMSR.set(value);
    if (!value) this.form.controls['msr'].setValue('');
    this.applyFieldRules();
  }

  /** Whether each secret input is currently editable (always on create;
   *  on edit only when the matching "change" toggle is on). */
  showPassword = computed<boolean>(() => this.credentialsRequired() || this.changePassword());
  showPassCode = computed<boolean>(() => this.credentialsRequired() || this.changePassCode());
  showMSR      = computed<boolean>(() => this.credentialsRequired() || this.changeMSR());

  /** Recompute validators for the role-scoped credential fields. Only the
   *  fields visible for the selected role(s) are validated, so a POS-only
   *  account isn't blocked by an empty (hidden) email/password and a
   *  cloud-only account isn't blocked by an empty pass code.
   *  Legacy rules: email valid+required, password >= 6, passcode numeric >= 4,
   *  MSR present. */
  private applyFieldRules(): void {
    const email = this.form.controls['email'];
    const pw    = this.form.controls['password'];
    const pc    = this.form.controls['passcode'];
    const msr   = this.form.controls['msr'];

    // Both are already false when the employee has no system access, so a
    // person without a login is never blocked by an empty credential field.
    const cloud = this.showEmailPassword();
    const pos   = this.showPassCodeMsr();

    if (cloud) {
      email.setValidators([Validators.required, Validators.email]);
      // Uniqueness / "already an InvoCloud user" probe — legacy parity.
      email.setAsyncValidators([
        employeeEmailValidator(this.service, {
          getEmployeeId:    () => this.employeeId(),
          getOriginalEmail: () => this.originalEmail(),
        }),
      ]);
    } else {
      email.clearValidators();
      email.clearAsyncValidators();
    }

    if (cloud && (this.credentialsRequired() || this.changePassword())) {
      pw.setValidators([Validators.required, Validators.minLength(this.passwordMinLength)]);
    } else {
      pw.clearValidators();
    }
    if (pos && (this.credentialsRequired() || this.changePassCode())) {
      pc.setValidators([
        Validators.required,
        Validators.pattern(/^\d+$/),
        Validators.minLength(this.passcodeMinLength),
      ]);
      // Pass codes must be unique company-wide (legacy `passCode` table probe).
      pc.setAsyncValidators([
        passcodeUniqueValidator(this.service, { getEmployeeId: () => this.employeeId() }),
      ]);
    } else {
      pc.clearValidators();
      pc.clearAsyncValidators();
    }
    // MSR is optional for every role — it only needs to be well-formed when
    // the user actually chose to change it.
    msr.clearValidators();
    email.updateValueAndValidity({ emitEvent: false });
    pw.updateValueAndValidity({ emitEvent: false });
    pc.updateValueAndValidity({ emitEvent: false });
    msr.updateValueAndValidity({ emitEvent: false });
  }

  // ── Save / cancel ──────────────────────────────────────────────────────
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    // The email / pass-code probes are async — let any in-flight check settle
    // before deciding, otherwise a fast save would slip past them.
    if (this.form.pending) await this.whenSettled();
    if (this.form.invalid) return;

    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const original = this.original();

      // Branch reconciliation (mirrors the legacy invariant):
      //  - no branches   → branchId must be ''
      //  - has branches  → branchId must be one of them, else fall back to first
      const branches = this.selectedBranches().map((b) => ({ id: b.id, name: b.name }));
      let branchId = String(v.branchId ?? '');
      if (branches.length === 0) {
        branchId = '';
      } else if (!branches.some((b) => b.id === branchId)) {
        branchId = branches[0].id;
      }

      // Role invariant — never save an *account* with no role. An employee
      // with no system access has no roles by definition, so the invariant is
      // skipped for them (the same guard as in enforceRoleInvariant()).
      const hasAccess = !!v.hasSystemAccess;
      let admin = hasAccess && !!v.admin;
      let user = hasAccess && !!v.user;
      const superAdmin = hasAccess && !!v.superAdmin;
      if (hasAccess && !superAdmin && !admin && !user) user = true;

      const payload: any = {
        ...(original ?? {}),
        id:              this.isCreate() ? null : this.employeeId(),
        formStatus:      this.isCreate() ? 'new' : 'edit',
        hasSystemAccess: hasAccess,
        name:            v.name,
        // Email belongs to cloud accounts only; a POS-only account has none.
        email:           this.showEmailPassword() ? v.email : '',
        admin,
        user,
        isDriver:        !!v.isDriver,
        superAdmin,
        // No login, no privilege set to resolve.
        privilegeId:     hasAccess ? (v.privilegeId || null) : null,
        branches,
        branchId,
        hireDate:        toIsoDateOnly(v.hireDate),
        terminationDate: toIsoDateOnly(v.terminationDate),
        base64Image:     '',
        mediaId:         this.mediaId(),
        mediaUrl:        this.mediaUrl(),
        // Secrets: send the typed value only when the field is BOTH visible
        // for the selected role AND editable; otherwise '' (backend keeps the
        // existing secret). Cloud → password; POS → passcode; MSR is offered
        // for every role.
        password: (this.showEmailPassword() && (this.credentialsRequired() || this.changePassword())) ? (v.password ?? '') : '',
        passCode: (this.showPassCodeMsr()   && (this.credentialsRequired() || this.changePassCode())) ? (v.passcode ?? '') : '',
        MSR:      (hasAccess && (this.credentialsRequired() || this.changeMSR())) ? (v.msr ?? '') : '',
      };

      // Drop the heavy privilege tree — the backend rebuilds it from
      // `privilegeId`; posting it back would bloat the request (legacy did
      // `delete this.employeeData.privileges`).
      delete payload.privileges;

      // Don't post back values this form was never given.
      //
      // `getEmployee` doesn't return `hireDate`, `terminationDate` or
      // `branchId` today, so the form loads them empty and would post null
      // over whatever is stored — wiping a hire date nobody touched. A field
      // is only sent when the user actually edited it (`dirty`, which the
      // seeding patchValue does not set) or when the loaded record carried it,
      // so a future API that returns the value keeps working unchanged.
      // See docs/incidents/2026-08-05-employee-write-only-columns.md.
      const sendOnlyIfKnown = (payloadKey: string, controlName: string, recordKey: string) => {
        const known = !!original && original[recordKey as keyof EmployeeDetails] != null;
        const edited = this.form.controls[controlName]?.dirty ?? false;
        if (!known && !edited) delete payload[payloadKey];
      };
      sendOnlyIfKnown('hireDate', 'hireDate', 'hireDate');
      sendOnlyIfKnown('terminationDate', 'terminationDate', 'terminationDate');
      // The primary branch follows the branch selection, so either control
      // being touched counts as the user having set it.
      if (!this.form.controls['branchIds'].dirty && !this.form.controls['branchId'].dirty
          && !(original?.branchId)) {
        delete payload.branchId;
      }

      // HR groups — skipped entirely while the flag is off, so a record that
      // already carries them keeps them via the `...original` spread instead
      // of being cleared by a form that never rendered them.
      // `extractGroupValue` returns undefined when nothing was
      // filled in, and the key is then left off entirely — saving an untouched
      // record must not decorate it with `profile: {}`. A group the record
      // already had, emptied by the user, is sent as null: that's an explicit
      // clear, not an absence.
      for (const group of this.manifest()?.groups ?? []) {
        const control = this.form.get(group.key);
        const value = control instanceof FormGroup
          ? extractGroupValue(control, group.fields)
          : undefined;
        if (value !== undefined) payload[group.key] = value;
        else if (original && group.key in original) payload[group.key] = null;
        else delete payload[group.key];
      }

      const res = await this.service.save(payload);
      if (res?.success) {
        this.dirty.set(false);
        this.form.markAsPristine();
        this.toast.success(this.translate.instant('EMPLOYEES.FORM.SAVED'));
        this.router.navigate(['/employees']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED', res?.msg);
      }
    } catch (e: any) {
      console.error('[employee-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/employees']);
  }

  // ── Guided tour ────────────────────────────────────────────────────────
  /**
   * Walk through the form's cards. Triggered only by the header button —
   * never automatically: this form is where someone is mid-task, and on a new
   * employee the steps most worth seeing (email / password) don't exist yet
   * because no role has been chosen.
   *
   * Steps whose anchor isn't rendered — the flagged HR cards, the credential
   * fields for a POS-only account, the primary-branch star before any branch
   * is picked — are dropped by the service rather than pointing at nothing.
   */
  async startTour(): Promise<void> {
    const shown = await this.tour.run(EMPLOYEE_FORM_TOUR, { tourKey: EMPLOYEE_TOUR_KEY });
    if (shown === 0) this.toast.error('EMPLOYEES.TOUR.NOTHING_TO_SHOW');
  }

  ngOnDestroy(): void {
    this.tour.stop();
  }

  /** Resolves once the form leaves the PENDING state (async validators done). */
  private whenSettled(): Promise<void> {
    return new Promise<void>((resolve) => {
      const sub = this.form.statusChanges.subscribe((status) => {
        if (status !== 'PENDING') { sub.unsubscribe(); resolve(); }
      });
    });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.saving();
  }

  // Date <-> ISO 'yyyy-MM-dd' conversion lives in `@shared/utils`
  // (`toDateOnly` / `toIsoDateOnly`), so the manifest fields convert exactly
  // the same way these two do. Behaviour is unchanged from the private copies
  // this form used to carry: the y/m/d parts are parsed and written directly,
  // so the calendar day never shifts across timezones.
}
