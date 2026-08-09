import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { HrError, describeError } from '../../hr-error';
import { portalKey } from '../../hr-labels';
import { hrGrantFor } from '../../hr-privilege';
import { FileCatalog, HrFile } from '../../services/employee-file.service';
import {
  AssetAssignment,
  AssetCatalog,
  AssetOptionDescriptor,
  AssetStatusDescriptor,
  EmployeeAssetService,
} from '../../services/employee-asset.service';
import { ReturnFieldsMode, isOpenStatus, returnFieldsMode } from './asset-return-rules';

/**
 * The assets tab — company property issued to this employee.
 *
 * ── NOTHING COMPUTED IS RECOMPUTED ───────────────────────────────────────────
 * `isOverdue` and `daysUntilReturn` come from the server and are rendered
 * exactly as sent. Both are typed nullable and null renders as unknown, not as
 * "fine" — the same decision as the documents tab's status, for the same
 * reason: a laptop three weeks late that shows as on-time because a field went
 * missing is indistinguishable from working software.
 *
 * There is a second reason here that documents did not have. The server's
 * overdue rule has a subtlety this side does not know: only OPEN assignments
 * can be overdue, so an item returned late is history rather than an
 * outstanding action. A client-side recomputation would disagree with that, and
 * with the EOS clearance gate that shares the definition.
 *
 * ── THE CONDITIONAL RULES COME FROM THE CATALOGUE ────────────────────────────
 * Which statuses require a return date and an inbound condition, and which
 * forbid them, is read from `closesAssignment` / `expectsReturn` on the
 * server's own status list — never hardcoded here. See asset-return-rules.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-employee-assets',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    SearchDropdownComponent, MycurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-assets.component.html',
  styleUrls: ['./employee-assets.component.scss'],
})
export class EmployeeAssetsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EmployeeAssetService);
  private readonly privileges = inject(PrivilegeService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  /** `:id` lives on the parent route — this component is a tab child. */
  readonly employeeId =
    this.route.parent?.snapshot.paramMap.get('id')
    ?? this.route.snapshot.paramMap.get('id')
    ?? '0';

  readonly loading = signal(true);
  readonly busy = signal<string | null>(null);
  readonly error = signal<HrError | null>(null);
  readonly assignments = signal<AssetAssignment[]>([]);
  readonly catalog = signal<AssetCatalog>({ categories: [], statuses: [], conditions: [] });
  readonly fileCatalog = signal<FileCatalog | null>(null);

  readonly canEdit = computed(() =>
    hrGrantFor(this.privileges, this.auth, 'employeeAssetSecurity', 'edit'));

  readonly canUpload = computed(() =>
    this.canEdit() && this.fileCatalog()?.storageConfigured === true);

  /**
   * Whether the catalogue arrived.
   *
   * Surfaced rather than hidden: without it the pickers are empty and the
   * conditional rules cannot be enforced, so the form still works but the
   * server does all the refusing. Saying so beats a form that silently behaves
   * differently.
   */
  readonly catalogMissing = computed(() => this.catalog().statuses.length === 0);

  // ─── Editor ────────────────────────────────────────────────────────────

  readonly editing = signal<string | null>(null);

  readonly form = this.fb.group({
    assetTag: this.fb.control<string>('', Validators.required),
    category: this.fb.control<string | null>(null, Validators.required),
    description: this.fb.control<string>('', Validators.required),
    serialNumber: this.fb.control<string | null>(null),
    value: this.fb.control<number | null>(null),
    assignedDate: this.fb.control<string | null>(null, Validators.required),
    conditionOut: this.fb.control<string | null>(null, Validators.required),
    expectedReturnDate: this.fb.control<string | null>(null),
    status: this.fb.control<string>('Assigned', Validators.required),
    returnDate: this.fb.control<string | null>(null),
    conditionIn: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
  });

  /** The status currently selected in the form, as a signal the template can read. */
  private readonly statusValue = signal<string | null>(this.form.controls.status.value);

  /**
   * What the chosen status says about the return fields.
   *
   * The single place the form asks that question — the template hides the
   * fields, the validators follow it, and the tests exercise the pure function
   * behind it.
   */
  readonly returnMode = computed<ReturnFieldsMode>(() =>
    returnFieldsMode(this.statusValue(), this.catalog().statuses));

  /**
   * The asset-tag clash, surfaced next to the field that caused it.
   *
   * The server's message names who currently holds the tag — "Asset tag is
   * already assigned to Sara Ahmed" — which is the answer the person entering
   * it actually wants. It is put beside the input as well as in the banner
   * because that is where they are looking, and shown verbatim because no
   * paraphrase could carry the name.
   */
  readonly tagError = signal<string | null>(null);

  constructor() {
    void this.load();

    // Keep the status signal in step with the control, and apply the rule the
    // catalogue states whenever either side changes.
    this.form.controls.status.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(v => this.statusValue.set(v));
    effect(() => this.applyReturnRule(this.returnMode()));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [assignments, catalog, fileCatalog] = await Promise.all([
        this.service.list(this.employeeId),
        this.service.catalog().catch(() => ({ categories: [], statuses: [], conditions: [] })),
        this.service.fileCatalog().catch(() => null),
      ]);
      this.assignments.set(assignments);
      this.catalog.set(catalog);
      this.fileCatalog.set(fileCatalog);
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Enforce the catalogue's rule on the return fields.
   *
   * `forbidden` clears them as well as hiding them: a status changed from
   * Returned to Lost after a date was typed would otherwise submit that date
   * and be refused, with the offending field no longer on screen to correct.
   *
   * `unknown` enforces nothing. The portal could not read the rule, so it does
   * not invent one — the server still refuses, with the real reason.
   */
  private applyReturnRule(mode: ReturnFieldsMode): void {
    const { returnDate, conditionIn } = this.form.controls;

    if (mode === 'required') {
      returnDate.addValidators(Validators.required);
      conditionIn.addValidators(Validators.required);
    } else {
      returnDate.removeValidators(Validators.required);
      conditionIn.removeValidators(Validators.required);
      if (mode === 'forbidden') {
        returnDate.setValue(null, { emitEvent: false });
        conditionIn.setValue(null, { emitEvent: false });
      }
    }
    returnDate.updateValueAndValidity({ emitEvent: false });
    conditionIn.updateValueAndValidity({ emitEvent: false });
  }

  startAdd(): void {
    this.form.reset({
      assetTag: '', category: null, description: '', serialNumber: null, value: null,
      assignedDate: null, conditionOut: null, expectedReturnDate: null,
      status: 'Assigned', returnDate: null, conditionIn: null, notes: null,
    });
    this.statusValue.set('Assigned');
    this.tagError.set(null);
    this.error.set(null);
    this.editing.set('new');
  }

  startEdit(a: AssetAssignment): void {
    this.form.reset({
      assetTag: a.assetTag,
      category: a.category || null,
      description: a.description,
      serialNumber: a.serialNumber,
      value: a.value,
      assignedDate: a.assignedDate,
      conditionOut: a.conditionOut,
      expectedReturnDate: a.expectedReturnDate,
      status: a.status ?? 'Assigned',
      returnDate: a.returnDate,
      conditionIn: a.conditionIn,
      notes: a.notes,
    });
    this.statusValue.set(a.status ?? 'Assigned');
    this.tagError.set(null);
    this.error.set(null);
    this.editing.set(a.id);
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.tagError.set(null);
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
    this.tagError.set(null);
    try {
      await this.service.save({
        ...(editing === 'new' ? {} : { id: editing }),
        employeeId: this.employeeId,
        ...this.form.getRawValue(),
      });
      this.editing.set(null);
      await this.load();
    } catch (e) {
      const described = describeError(e);
      this.error.set(described);
      // Company-wide uniqueness, so the clash is very often with an assignment
      // that is not on this screen at all — the message is the only way to find
      // out where the tag went.
      if (described.detail && /asset tag/i.test(described.detail)) {
        this.tagError.set(described.detail);
      }
    } finally {
      this.busy.set(null);
    }
  }

  async remove(a: AssetAssignment): Promise<void> {
    this.busy.set(a.id);
    this.error.set(null);
    try {
      await this.service.remove(a.id);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Attachments ───────────────────────────────────────────────────────

  async onFilePicked(a: AssetAssignment, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const catalog = this.fileCatalog();
    if (catalog) {
      if (catalog.accepted.length && !catalog.accepted.includes(file.type)) {
        this.error.set({
          titleKey: 'EMPLOYEES.HR.ERR.TYPE_REJECTED',
          detail: file.type || file.name,
          hintKey: null,
        });
        return;
      }
      if (file.size > catalog.maxBytes) {
        this.error.set({
          titleKey: 'EMPLOYEES.HR.ERR.TOO_LARGE',
          detail: `${Math.round(file.size / 1024 / 1024)}MB`,
          hintKey: null,
        });
        return;
      }
    }

    this.busy.set(a.id);
    this.error.set(null);
    try {
      await this.service.upload(a.id, file);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  /** A fresh signed URL every time, opened as issued. Never cached or rewritten. */
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

  async removeFile(file: HrFile): Promise<void> {
    this.busy.set(file.id);
    this.error.set(null);
    try {
      await this.service.removeFile(file.id);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Display helpers ───────────────────────────────────────────────────

  /**
   * The badge for the server's overdue flag.
   *
   * Three states, not two. `null` is its own — the server did not send a flag,
   * so nothing is claimed either way.
   */
  overdueClass(a: AssetAssignment): string {
    if (a.isOverdue === true) return 'asset-badge asset-badge--overdue';
    if (a.isOverdue === false) return 'asset-badge asset-badge--ontime';
    return 'asset-badge asset-badge--unknown';
  }

  overdueKey(a: AssetAssignment): string {
    if (a.isOverdue === true) return 'EMPLOYEES.ASSETS.OVERDUE';
    if (a.isOverdue === false) return 'EMPLOYEES.ASSETS.ON_TIME';
    return 'EMPLOYEES.ASSETS.OVERDUE_UNKNOWN';
  }

  /** Whether the item is still out, per the catalogue. Null when it cannot say. */
  isOpen(a: AssetAssignment): boolean | null {
    return isOpenStatus(a.status, this.catalog().statuses);
  }

  statusLabel(a: AssetAssignment): string {
    const found = this.catalog().statuses.find(s => s.key === a.status);
    return found?.labelKey ? portalKey(found.labelKey) : (a.status ?? '');
  }

  categoryLabel(a: AssetAssignment): string {
    const found = this.catalog().categories.find(c => c.key === a.category);
    return found?.labelKey ? portalKey(found.labelKey) : a.category;
  }

  conditionLabel(key: string | null): string {
    if (!key) return '';
    const found = this.catalog().conditions.find(c => c.key === key);
    return found?.labelKey ? portalKey(found.labelKey) : key;
  }

  optionKey = (o: AssetOptionDescriptor | AssetStatusDescriptor) => o.key;
  optionName = (o: AssetOptionDescriptor | AssetStatusDescriptor) =>
    o?.labelKey ? this.translate.instant(portalKey(o.labelKey)) : String(o ?? '');
  optionMatches = (a: any, b: any) => (a?.key ?? a) === (b?.key ?? b);

  fileSize(file: HrFile): string {
    if (file.sizeBytes === null) return '';
    if (file.sizeBytes < 1024) return `${file.sizeBytes} B`;
    if (file.sizeBytes < 1024 * 1024) return `${Math.round(file.sizeBytes / 1024)} KB`;
    return `${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /** Ids, so a reload after an upload does not rebuild every card. */
  trackAssignment = (_: number, a: AssetAssignment) => a.id;
  trackFile = (_: number, f: HrFile) => f.id;
}
