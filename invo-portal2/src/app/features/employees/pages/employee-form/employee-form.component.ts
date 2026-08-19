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
import { CollapsibleCardComponent } from '@shared/components/collapsible-card/collapsible-card.component';
import {
  FormStep,
  FormStepperComponent,
} from '@shared/components/form-stepper/form-stepper.component';
import {
  HR_PAYROLL,
  hrFieldsEnabled,
  hrDocumentsEnabled,
  hrModuleEnabled,
} from '../../employee-feature-flags';
import { EmployeePayrollService, PayrollRow } from '../../services/employee-payroll.service';
import { hrGrantFor } from '../../hr-privilege';
import { AuthService } from '@core/auth/auth.service';
import {
  AttachmentAccess,
  HrFileAttachmentsComponent,
  attachmentAccess,
} from '../../components/hr-file-attachments/hr-file-attachments.component';
import { EmployeeDocument, EmployeeDocumentService } from '../../services/employee-document.service';
import { EmployeeFileService, FILE_ENTITY } from '../../services/employee-file.service';
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
    CollapsibleCardComponent,
    HrFileAttachmentsComponent,
    FormStepperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.scss',
})
export class EmployeeFormComponent implements OnInit, OnDestroy, CanLeaveComponent {
  private fb          = inject(FormBuilder);
  private service     = inject(EmployeeService);
  private documentService = inject(EmployeeDocumentService);
  private fileService = inject(EmployeeFileService);
  private auth        = inject(AuthService);
  private manifestSvc = inject(EmployeeFieldManifestService);
  private branchSvc   = inject(BranchSettingsService);
  private privilegeSvc = inject(PrivilegeService);
  private payrollSvc  = inject(EmployeePayrollService);
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

  // ── Add-employee wizard ────────────────────────────────────────────────
  /**
   * Creating an employee is a four-step flow; editing one is not.
   *
   * The flag is captured ONCE, at load, and never recomputed — `isCreate()`
   * flips to false the moment step 1 persists the record, and a wizard that
   * dissolved under the user at that point would be worse than no wizard. The
   * remaining steps then run as ordinary edits against the id just returned,
   * which is also what makes the attachments step usable: there is finally a
   * record to hang a file off.
   *
   * Editing keeps the single long page. Someone who opened a record to change
   * a phone number should not have to walk four steps to reach Save.
   */
  readonly wizardActive = signal<boolean>(false);
  readonly step = signal<number>(0);
  /** Highest step reached, so the strip can navigate backwards but not ahead. */
  readonly furthestStep = signal<number>(0);

  /**
   * Which controls each step owns.
   *
   * This is the ONLY place the split is declared — `stepInvalid` and the
   * template both read it, so a control that moves between steps cannot end up
   * validated on one screen and rendered on another. A name missing here would
   * be silently unvalidated, so `allStepControlNames` is asserted against the
   * form in `ngOnInit`.
   */
  private readonly STEP_CONTROLS: Record<string, string[]> = {
    basic:      ['hasSystemAccess', 'name', 'email', 'password', 'passcode', 'msr',
                 'admin', 'user', 'isDriver', 'superAdmin', 'privilegeId',
                 'branchIds', 'branchId'],
    personal:   ['profile'],
    employment: ['hireDate', 'terminationDate', 'employment'],
    // Bank details live on their own form and their own endpoint — nothing in
    // `form` belongs to this step.
    payment:    [],
  };

  /**
   * Whether the payment step is offered at all.
   *
   * Bank details are a payroll record, not an employee column: they need the
   * module AND `editBank`, which is deliberately separate from `viewBank`
   * because the fraud is changing an account number, not reading one. Without
   * both, the wizard is three steps rather than four steps with a dead one.
   */
  private payrollFlag = hrModuleEnabled(HR_PAYROLL);
  readonly canEditBank = computed<boolean>(() =>
    this.payrollFlag() && hrGrantFor(this.privilegeSvc, this.auth, 'employeePayrollSecurity', 'editBank'));

  readonly steps = computed<FormStep[]>(() => {
    const out: FormStep[] = [
      { key: 'basic',      labelKey: 'EMPLOYEES.WIZARD.BASIC' },
      { key: 'personal',   labelKey: 'EMPLOYEES.WIZARD.PERSONAL' },
      { key: 'employment', labelKey: 'EMPLOYEES.WIZARD.EMPLOYMENT' },
    ];
    if (this.canEditBank()) out.push({ key: 'payment', labelKey: 'EMPLOYEES.WIZARD.PAYMENT' });
    return out;
  });

  readonly stepKey = computed<string>(() => this.steps()[this.step()]?.key ?? 'basic');
  readonly isLastStep = computed<boolean>(() => this.step() >= this.steps().length - 1);

  /**
   * Which single section this form was opened to edit, from `?section=`.
   *
   * Set by the overview's pencils. One section on screen, one Save — the
   * focused editor from the design, and the reason the record page can be
   * read-only without making a small correction a trip through a long form.
   * Null means the whole form, which is what the wizard and any direct link
   * still get.
   */
  readonly editSection = signal<string | null>(null);

  /**
   * Is a section on screen right now?
   *
   * The single question every card asks, so one template serves three shapes:
   * the four-step wizard, a focused single-section edit, and the full page.
   * Nothing here tests a step index directly — a card that did would have to
   * be updated again the next time a step moves.
   */
  showsSection(key: string): boolean {
    if (this.wizardActive()) return this.stepKey() === key;
    const only = this.editSection();
    return !only || only === key;
  }

  /** Heading for a focused edit — "Fatima's personal details". */
  readonly sectionTitle = computed<string>(() => {
    const key = this.editSection();
    if (!key) return this.pageTitle();
    return this.translate.instant(`EMPLOYEES.WIZARD.EDIT_${key.toUpperCase()}`, {
      name: this.original()?.name ?? '',
    });
  });

  /**
   * Bank details, step 4. Kept out of `form` because it posts to a different
   * endpoint with a different grant — merging them would make one Save button
   * responsible for two authorisations.
   */
  readonly bankForm = this.fb.group({
    paymentMethod:     ['BankTransfer' as 'BankTransfer' | 'Cash' | 'Cheque'],
    bankName:          [''],
    accountHolderName: [''],
    iban:              [''],
    swift:             [''],
  });

  readonly paysToBank = computed<boolean>(() => this.paymentMethod() === 'BankTransfer');
  private paymentMethod = signal<'BankTransfer' | 'Cash' | 'Cheque'>('BankTransfer');

  /**
   * The pay revision in force, if any.
   *
   * `paymentMethod` is a column on `EmployeePayrollProfiles`, NOT on
   * `EmployeeBankDetails` — the two are different tables behind different
   * endpoints, and the method is versioned WITH pay. So changing it means
   * writing a new revision carrying the existing figures forward, and with no
   * revision to carry there is nowhere to put the answer at all.
   *
   * The first version of this step posted the method to `saveBankDetails`,
   * which silently dropped it: the endpoint has no such field, and picking
   * Cash skipped the call entirely. The control looked like it saved and never
   * did.
   */
  readonly currentPay = signal<PayrollRow | null>(null);

  /** Can the chosen method actually be stored? Only atop an existing revision. */
  readonly canStoreMethod = computed<boolean>(() => !!this.currentPay());

  selectPaymentMethod(method: 'BankTransfer' | 'Cash' | 'Cheque'): void {
    this.paymentMethod.set(method);
    this.bankForm.controls.paymentMethod.setValue(method);
    this.bankForm.markAsDirty();
  }

  /** Load the pay revision the method rides on, once there is a record. */
  private async loadCurrentPay(): Promise<void> {
    const id = this.employeeId();
    if (!id || this.isCreate() || !this.canEditBank()) return;
    try {
      const row = await this.payrollSvc.current(id);
      this.currentPay.set(row);
      const method = row?.paymentMethod;
      if (method === 'BankTransfer' || method === 'Cash' || method === 'Cheque') {
        this.paymentMethod.set(method);
        this.bankForm.controls.paymentMethod.setValue(method, { emitEvent: false });
        // Seeded, not edited — a pristine form must not post a revision that
        // changes nothing.
        this.bankForm.controls.paymentMethod.markAsPristine();
      }
    } catch {
      this.currentPay.set(null);
    }
  }

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

  // ── Document attachments ───────────────────────────────────────────────
  /**
   * The employee's documents and their files, surfaced on the form itself so
   * an attachment does not require finding the Documents tab first.
   *
   * The upload path is `HrFileAttachmentsComponent` and
   * `EmployeeFileService` — the same ones the Documents tab uses. Nothing here
   * posts a file itself: a second upload path would be a second place for the
   * signed-URL and content-type rules to drift.
   */
  private documentsFlag = hrDocumentsEnabled();
  readonly documents = signal<EmployeeDocument[]>([]);
  private fileCatalogOk = signal<boolean>(false);

  /**
   * Whether the section renders, and whether its control is usable.
   *
   * Three gates, exactly the ones the tab strip applies: the company has the
   * module, the viewer holds the grant, and there is a record to attach to.
   * A new employee sees the section disabled with a reason rather than a
   * control that would fail on submit.
   */
  readonly attachAccess = computed<AttachmentAccess>(() => attachmentAccess({
    isNew: this.isCreate(),
    featureEnabled: this.documentsFlag(),
    canView: hrGrantFor(this.privilegeSvc, this.auth, 'employeeDocumentSecurity', 'view'),
    canEdit: hrGrantFor(this.privilegeSvc, this.auth, 'employeeDocumentSecurity', 'edit'),
    storageConfigured: this.fileCatalogOk(),
  }));

  /** Reload the document list after an upload or a removal. */
  async reloadDocuments(): Promise<void> {
    const id = this.employeeId();
    if (!id || this.isCreate()) { this.documents.set([]); return; }
    try {
      this.documents.set(await this.documentService.list(id));
    } catch {
      // A failed document list must not take the whole form down — the rest of
      // the record is still editable and still saveable.
      this.documents.set([]);
    }
  }

  trackDocument = (_: number, d: EmployeeDocument) => d.id;

  /** Entity key for the attachments component — documents, on this form. */
  readonly documentEntity = FILE_ENTITY.document;

  /**
   * Disclosure state for the two HR cards.
   *
   * Open by default. They hold most of the required fields, so starting them
   * closed would hide the work rather than organise it — collapsing is for
   * getting them OUT of the way once filled, on a record you opened to change
   * one thing.
   */
  personalOpen = signal(true);
  employmentOpen = signal(true);

  /**
   * Open whichever collapsible section holds an invalid control, then scroll to
   * the first one.
   *
   * This is the piece that makes collapsing safe. `save()` returns early on an
   * invalid form; without this, a control inside a closed card would fail
   * validation with nothing on screen changing — the same silent dead-end that
   * tabbed panes would have produced, which is the reason this form is not
   * tabbed.
   */
  private revealInvalidSections(): void {
    const profileInvalid = this.profileGroup()?.invalid === true;
    const employmentInvalid = this.employmentGroup()?.invalid === true;
    if (profileInvalid) this.personalOpen.set(true);
    if (employmentInvalid) this.employmentOpen.set(true);

    // After the sections have opened, put the first offending control on
    // screen — an opened card three screens down is still invisible.
    queueMicrotask(() => {
      const el = document.querySelector<HTMLElement>(
        '.ng-invalid[formControlName], .ng-invalid input, .ng-invalid select, .ng-invalid textarea',
      );
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

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
    // The id can live on EITHER route. `/employees/0` carries it itself, but
    // `/employees/:id/edit` carries it on the PARENT — the record shell owns
    // `:id` and this child declares no params of its own. Angular does not
    // inherit params down into a child of a component-bearing route, so
    // reading only `this.route` here returned null on every focused edit: the
    // form decided it was creating, loaded nothing, and rendered the wizard
    // over an existing employee. Same lookup order as `isOwnRecord`.
    const id = this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.snapshot.paramMap.get('id')
      ?? null;
    this.employeeId.set(id);
    // Captured before anything can save and flip `isCreate()`. See wizardActive.
    this.wizardActive.set(this.isCreate());
    // `?section=basic` — a focused edit launched from the record overview.
    // Ignored while creating: the wizard already decides what is on screen.
    // Optional chaining because a snapshot need not carry a query map — the
    // route stubs in the specs supply `paramMap` alone, and a form that only
    // loads under a fully-populated router is a form nothing can test.
    const section = this.route.snapshot.queryParamMap?.get('section')
      ?? this.route.parent?.snapshot.queryParamMap?.get('section')
      ?? null;
    this.editSection.set(this.isCreate() ? null : section);

    this.loading.set(true);
    try {
      // Fire the reference-data loads and (on edit) the record load together.
      // With the HR fields flagged off there's nothing to fetch and nothing to
      // build: the form is exactly the pre-phase-1 form plus the access flag.
      const hr = this.hrFields();
      // Documents and the file catalogue ride along with the rest rather than
      // waiting for the record: neither blocks the form, and both resolve
      // before the section can be interacted with. A failure in either leaves
      // the section empty and the form fully usable.
      const docsWanted = !this.isCreate() && this.documentsFlag();
      const [, , data, manifest, lookups, docs, catalog] = await Promise.all([
        this.loadPrivileges(),
        this.loadBranches(),
        this.isCreate() ? Promise.resolve(null) : this.service.getOne(id!),
        hr ? this.manifestSvc.getManifest() : Promise.resolve(null),
        hr ? this.service.getEmploymentLookups() : Promise.resolve({ departments: [], positions: [] }),
        docsWanted ? this.documentService.list(id!).catch(() => []) : Promise.resolve([]),
        this.documentsFlag() ? this.fileService.catalog().catch(() => null) : Promise.resolve(null),
      ]);

      this.documents.set(docs);
      this.fileCatalogOk.set(catalog?.storageConfigured === true);
      // The payment step's method rides on the pay revision, so the revision
      // has to be in hand before the step can seed or save it.
      void this.loadCurrentPay();

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

  // ── Wizard navigation ──────────────────────────────────────────────────
  /**
   * Is any control belonging to `stepIndex` currently invalid?
   *
   * Asks the step's OWN controls rather than `form.invalid`, which is what lets
   * step 1 save while the HR groups on later steps are still empty and
   * therefore failing their required rules.
   */
  private stepInvalid(stepIndex: number): boolean {
    const key = this.steps()[stepIndex]?.key;
    const names = key ? this.STEP_CONTROLS[key] ?? [] : [];
    return names.some((n) => this.form.get(n)?.invalid === true);
  }

  /** Touch a step's controls so their errors surface before we judge them. */
  private touchStep(stepIndex: number): void {
    const key = this.steps()[stepIndex]?.key;
    for (const name of (key ? this.STEP_CONTROLS[key] ?? [] : [])) {
      this.form.get(name)?.markAllAsTouched();
    }
  }

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps().length) return;
    this.step.set(index);
    this.furthestStep.set(Math.max(this.furthestStep(), index));
    // A step change is a page change as far as the reader is concerned; without
    // this the user lands mid-form on whatever the last step's scroll left.
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  back(): void {
    this.goToStep(this.step() - 1);
  }

  /**
   * Save what this step collected, then advance.
   *
   * Every step persists, so an interruption after step 2 leaves a real
   * employee with real personal details rather than nothing. That is also why
   * step 1 must succeed before the rest are reachable: steps 2–4 are edits of
   * a record that has to exist first.
   */
  async saveAndContinue(): Promise<void> {
    const index = this.step();
    this.touchStep(index);
    if (this.form.pending) await this.whenSettled();
    if (this.stepInvalid(index)) {
      this.revealInvalidSections();
      return;
    }

    const ok = this.stepKey() === 'payment' ? await this.saveBank() : await this.save({ stay: true });
    if (!ok) return;

    if (this.isLastStep()) {
      this.router.navigate(['/employees']);
      return;
    }
    this.goToStep(index + 1);
  }

  /**
   * Leave a step's fields empty and move on.
   *
   * Offered only where the server genuinely accepts the absence — the HR groups
   * are omitted from the payload when nothing was filled in, and bank details
   * are a separate record that simply doesn't get created. Step 1 has no Skip:
   * there is no employee without it.
   */
  skipStep(): void {
    if (this.isLastStep()) {
      this.router.navigate(['/employees']);
      return;
    }
    this.goToStep(this.step() + 1);
  }

  /**
   * The payment step: the method and, when it is a transfer, the account.
   *
   * TWO endpoints, because the data lives in two tables. The account goes to
   * `saveBankDetails`; the method is a column on the pay revision and goes to
   * `savePayroll`, carrying the existing figures forward unchanged so only the
   * method differs. Cash and cheque write no account at all — and used to write
   * nothing whatsoever, which is the bug this replaces.
   */
  private async saveBank(): Promise<boolean> {
    const id = this.employeeId();
    // Nothing to attach to yet: a clean skip, not a failure to dismiss.
    if (!id || this.isCreate()) return true;
    if (this.bankForm.pristine) return true;

    const v = this.bankForm.getRawValue();
    this.saving.set(true);
    try {
      // ── The account, only where one is used ──
      if (this.paysToBank() && (v.bankName || v.iban || v.accountHolderName || v.swift)) {
        await this.payrollSvc.saveBankDetails({
          employeeId:        id,
          bankName:          v.bankName || null,
          accountHolderName: v.accountHolderName || null,
          iban:              v.iban || null,
          swift:             v.swift || null,
        });
      }

      // ── The method, on a new pay revision ──
      const pay = this.currentPay();
      if (pay && v.paymentMethod && v.paymentMethod !== pay.paymentMethod) {
        await this.payrollSvc.recordChange({
          employeeId:    id,
          // Everything carried forward — this revision exists to change the
          // method and must not quietly restate someone's salary.
          basicSalary:   pay.basicSalary,
          currency:      pay.currency,
          payFrequency:  pay.payFrequency ?? 'Monthly',
          components:    pay.components ?? [],
          effectiveFrom: toIsoDateOnly(new Date()),
          // `Correction` is the honest reason: nothing about the pay changed.
          changeReason:  'Correction',
          changeNote:    this.translate.instant('EMPLOYEES.WIZARD.METHOD_CHANGE_NOTE'),
          paymentMethod: v.paymentMethod,
        });
      }

      this.bankForm.markAsPristine();
      return true;
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  // ── Save / cancel ──────────────────────────────────────────────────────
  /**
   * `stay: true` keeps the user on the form after a successful save — the
   * wizard's steps 1–3 need the record persisted without leaving the page.
   * Returns whether the save succeeded, which the wizard uses to decide
   * whether advancing is safe.
   */
  async save(options: { stay?: boolean } = {}): Promise<boolean> {
    // In the wizard only the steps already visited are judged: the later ones
    // hold required fields the user has not been shown yet.
    if (this.wizardActive()) {
      for (let i = 0; i <= this.step(); i++) this.touchStep(i);
    } else {
      this.form.markAllAsTouched();
    }
    // The email / pass-code probes are async — let any in-flight check settle
    // before deciding, otherwise a fast save would slip past them.
    if (this.form.pending) await this.whenSettled();
    const invalid = this.wizardActive()
      ? Array.from({ length: this.step() + 1 }, (_, i) => i).some((i) => this.stepInvalid(i))
      : this.form.invalid;
    if (invalid) {
      this.revealInvalidSections();
      return false;
    }

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
      if (!res?.success) {
        this.toast.error('COMMON.SAVE_FAILED', res?.msg);
        return false;
      }

      this.dirty.set(false);
      this.form.markAsPristine();
      this.toast.success(this.translate.instant('EMPLOYEES.FORM.SAVED'));

      // The id only comes back on a create, and the wizard's later steps are
      // edits of it — without adopting it here, step 2 would create a SECOND
      // employee. `original` is seeded too so the payload spread keeps working.
      // Outside the wizard nothing calls `saveBank` — the footer's single Save
      // posts the employee form and stopped there, so the payment section on a
      // focused edit (and on the full page) collected a method and an account
      // and then discarded both. The wizard routes through `saveAndContinue`
      // instead, which is why this only ever broke on the edit screens.
      if (!this.wizardActive() && this.showsSection('payment') && this.bankForm.dirty) {
        if (!(await this.saveBank())) return false;
      }

      const newId = res?.data?.id ?? null;
      if (this.isCreate() && newId) {
        this.employeeId.set(String(newId));
        this.original.set({ ...(this.original() ?? {}), id: String(newId) } as EmployeeDetails);
        await this.reloadDocuments();
        // `loadCurrentPay` bailed during ngOnInit because the record did not
        // exist yet. Now it does, so ask again — otherwise the payment step
        // would always believe there is no revision to hang the method on.
        await this.loadCurrentPay();
      }

      if (!options.stay) this.router.navigate(this.doneRoute());
      return true;
    } catch (e: any) {
      console.error('[employee-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Where Save and Cancel go.
   *
   * A focused edit returns to the record it was launched from — sending the
   * user back to the list would lose the record they were reading. Everything
   * else returns to the list, as before.
   */
  private doneRoute(): any[] {
    const id = this.employeeId();
    return this.editSection() && id ? ['/employees', id] : ['/employees'];
  }

  cancel(): void {
    this.router.navigate(this.doneRoute());
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
