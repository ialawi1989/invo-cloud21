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
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeDetails } from '../../models/employee.types';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.scss',
})
export class EmployeeFormComponent implements OnInit, CanLeaveComponent {
  private fb          = inject(FormBuilder);
  private service     = inject(EmployeeService);
  private branchSvc   = inject(BranchSettingsService);
  private privilegeSvc = inject(PrivilegeService);
  private translate   = inject(TranslateService);
  private destroyRef  = inject(DestroyRef);
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private toast       = inject(ToastService);

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

  // ── Image (simple base64 upload + preview) ─────────────────────────────
  private base64Image = signal<string>('');
  private mediaUrl    = signal<{ defaultUrl: string }>({ defaultUrl: '' });
  private mediaId     = signal<string | null>(null);
  avatarPreview = computed<string>(
    () => this.base64Image() || this.mediaUrl().defaultUrl || '',
  );

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
  form: FormGroup = this.fb.group({
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
    // Employment
    hireDate:        [null as string | null],
    terminationDate: [null as string | null],
  });

  // ── Derived ────────────────────────────────────────────────────────────
  isSuperAdmin = computed<boolean>(() => {
    this.formTick();
    return !!this.form.controls['superAdmin'].value;
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
      });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    this.employeeId.set(id);

    this.loading.set(true);
    try {
      // Fire the reference-data loads and (on edit) the record load together.
      const [, , data] = await Promise.all([
        this.loadPrivileges(),
        this.loadBranches(),
        this.isCreate() ? Promise.resolve(null) : this.service.getOne(id!),
      ]);

      if (data) {
        this.original.set(data);
        this.patchFromRecord(data);
      }

      // Secrets are required inputs when creating; on edit they stay hidden
      // behind the "change" toggles until the user opts in.
      this.applySecretValidators();
      if (this.form.controls['superAdmin'].value) this.setSuperAdminLock(true);
    } finally {
      this.loading.set(false);
      this.loaded = true;
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
      name:            data.name ?? '',
      email:           data.email ?? '',
      admin:           !!data.admin,
      user:            !!data.user,
      isDriver:        !!data.isDriver,
      superAdmin:      !!data.superAdmin,
      privilegeId:     data.privilegeId ?? null,
      branchIds:       (data.branches ?? []).map((b: any) => b.id),
      branchId:        data.branchId ?? '',
      hireDate:        data.hireDate ?? null,
      terminationDate: data.terminationDate ?? null,
      // Secrets are never pre-filled — the user re-enters them to change.
      password:        '',
      passcode:        '',
      msr:             '',
    });
    this.mediaUrl.set(data.mediaUrl ?? { defaultUrl: '' });
    this.mediaId.set(data.mediaId ?? null);
    this.base64Image.set('');
  }

  // ── Roles ──────────────────────────────────────────────────────────────
  /** Keep the legacy invariant: at least one of Cloud-Admin / POS-User is on
   *  (unless the account is a Super Admin, which supersedes both). */
  private enforceRoleInvariant(): void {
    const admin = !!this.form.controls['admin'].value;
    const user  = !!this.form.controls['user'].value;
    const superAdmin = !!this.form.controls['superAdmin'].value;
    if (!superAdmin && !admin && !user) {
      this.form.controls['user'].setValue(true);
    }
  }

  onAdminChange(): void { this.enforceRoleInvariant(); }
  onUserChange(): void  { this.enforceRoleInvariant(); }

  onSuperAdminChange(value: boolean): void {
    this.setSuperAdminLock(value);
  }

  /** Super admins bypass privilege / branch / employment scoping — mirror the
   *  legacy `[disabled]="employeeData.superAdmin"` bindings by disabling the
   *  affected controls (kept in the payload via `getRawValue`). */
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
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.base64Image.set(String(reader.result ?? ''));
      this.dirty.set(true);
    };
    reader.readAsDataURL(file);
    // Allow re-selecting the same file later.
    input.value = '';
  }

  removeImage(): void {
    this.base64Image.set('');
    this.mediaUrl.set({ defaultUrl: '' });
    this.mediaId.set(null);
    this.dirty.set(true);
  }

  // ── Secret "change" toggles (edit mode) ─────────────────────────────────
  toggleChangePassword(value: boolean): void {
    this.changePassword.set(value);
    if (!value) this.form.controls['password'].setValue('');
    this.applySecretValidators();
  }

  toggleChangePassCode(value: boolean): void {
    this.changePassCode.set(value);
    if (!value) this.form.controls['passcode'].setValue('');
    this.applySecretValidators();
  }

  toggleChangeMSR(value: boolean): void {
    this.changeMSR.set(value);
    if (!value) this.form.controls['msr'].setValue('');
    this.applySecretValidators();
  }

  /** Whether each secret input is currently editable (always on create;
   *  on edit only when the matching "change" toggle is on). */
  showPassword = computed<boolean>(() => this.isCreate() || this.changePassword());
  showPassCode = computed<boolean>(() => this.isCreate() || this.changePassCode());
  showMSR      = computed<boolean>(() => this.isCreate() || this.changeMSR());

  /** Recompute validators for the secret fields whenever their editability
   *  changes. Legacy rules: password >= 6, passcode numeric >= 4, MSR present. */
  private applySecretValidators(): void {
    const pw = this.form.controls['password'];
    const pc = this.form.controls['passcode'];
    const msr = this.form.controls['msr'];

    if (this.isCreate() || this.changePassword()) {
      pw.setValidators([Validators.required, Validators.minLength(6)]);
    } else {
      pw.clearValidators();
    }
    if (this.isCreate() || this.changePassCode()) {
      pc.setValidators([Validators.required, Validators.pattern(/^\d+$/), Validators.minLength(4)]);
    } else {
      pc.clearValidators();
    }
    if (this.isCreate() || this.changeMSR()) {
      msr.setValidators([Validators.required]);
    } else {
      msr.clearValidators();
    }
    pw.updateValueAndValidity({ emitEvent: false });
    pc.updateValueAndValidity({ emitEvent: false });
    msr.updateValueAndValidity({ emitEvent: false });
  }

  // ── Save / cancel ──────────────────────────────────────────────────────
  async save(): Promise<void> {
    this.form.markAllAsTouched();
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

      // Role invariant — never save an account with no role.
      let admin = !!v.admin;
      let user = !!v.user;
      if (!v.superAdmin && !admin && !user) user = true;

      const payload: any = {
        ...(original ?? {}),
        id:              this.isCreate() ? null : this.employeeId(),
        formStatus:      this.isCreate() ? 'new' : 'edit',
        name:            v.name,
        email:           v.email,
        admin,
        user,
        isDriver:        !!v.isDriver,
        superAdmin:      !!v.superAdmin,
        privilegeId:     v.privilegeId || null,
        branches,
        branchId,
        hireDate:        v.hireDate || null,
        terminationDate: v.terminationDate || null,
        base64Image:     this.base64Image() || '',
        mediaId:         this.mediaId(),
        mediaUrl:        this.mediaUrl(),
        // Secrets: send the typed value when the field was editable,
        // otherwise an empty string (backend keeps the existing secret).
        password: (this.isCreate() || this.changePassword()) ? (v.password ?? '') : '',
        passCode: (this.isCreate() || this.changePassCode()) ? (v.passcode ?? '') : '',
        MSR:      (this.isCreate() || this.changeMSR()) ? (v.msr ?? '') : '',
      };

      // Drop the heavy privilege tree — the backend rebuilds it from
      // `privilegeId`; posting it back would bloat the request (legacy did
      // `delete this.employeeData.privileges`).
      delete payload.privileges;

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

  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.saving();
  }
}
