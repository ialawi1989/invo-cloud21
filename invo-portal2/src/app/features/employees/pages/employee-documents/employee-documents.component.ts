import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { hrGrantFor } from '../../hr-privilege';
import {
  DocumentFile,
  DocumentTypeDescriptor,
  EmployeeDocument,
  EmployeeDocumentService,
  FileCatalog,
} from '../../services/employee-document.service';
import { HrError, describeError } from '../../hr-error';
import { portalKey } from '../../hr-labels';

/**
 * The documents tab — identity documents and their attachments.
 *
 * ── THIS IS THE FIRST END-TO-END PATH IN THE WHOLE FEATURE ───────────────────
 * Upload and download are the point; everything else here is secondary. The
 * first upload anyone performs is also the first execution of the migration's
 * delete trigger, the storage-key generation, the child row and the audit —
 * none of which has ever run. The error path is built to say what actually
 * failed (see ../../hr-error.ts) because it will be read a lot.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── COMPUTED FIELDS ARE SHOWN, NEVER RECOMPUTED ──────────────────────────────
 * `status`, `daysRemaining` and the file list all come from the server. If a
 * field is absent it renders as unknown, not as a good value: an expired
 * passport shown as "Valid" because the server sent nothing is indistinguishable
 * from working software.
 * ─────────────────────────────────────────────────────────────────────────────
 */
@Component({
  selector: 'app-employee-documents',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-documents.component.html',
  styleUrls: ['./employee-documents.component.scss'],
})
export class EmployeeDocumentsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EmployeeDocumentService);
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
  readonly documents = signal<EmployeeDocument[]>([]);
  readonly types = signal<DocumentTypeDescriptor[]>([]);
  readonly catalog = signal<FileCatalog | null>(null);

  /**
   * Warnings the server returned on save — the required-file rules, which are
   * NOT enforced yet.
   *
   * Shown, never acted on. Enforcing them in the UI ahead of the server would
   * make documents unrecordable while uploads are still being proven, and the
   * server is the thing that decides when the rule becomes a refusal.
   */
  readonly warnings = signal<string[]>([]);

  readonly canEdit = computed(() =>
    hrGrantFor(this.privileges, this.auth, 'employeeDocumentSecurity', 'edit'));
  readonly canVerify = computed(() =>
    hrGrantFor(this.privileges, this.auth, 'employeeDocumentSecurity', 'verify'));

  /** Uploads are impossible without a bucket; the control says so rather than failing. */
  readonly canUpload = computed(() =>
    this.canEdit() && this.catalog()?.storageConfigured === true);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      // The catalog is fetched alongside, not lazily: whether storage is
      // configured decides how the upload control renders, and discovering it
      // after the user picks a file is too late.
      const [documents, types, catalog] = await Promise.all([
        this.service.list(this.employeeId),
        this.service.types().catch(() => [] as DocumentTypeDescriptor[]),
        this.service.fileCatalog().catch(() => null),
      ]);
      this.documents.set(documents);
      this.types.set(types);
      this.catalog.set(catalog);
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Add / edit a document ─────────────────────────────────────────────

  /**
   * The record being edited, or `'new'`, or null when the editor is closed.
   *
   * Kept alongside the form rather than inside it: the id is not an editable
   * field, and putting it in the group makes it far too easy to send it back as
   * one.
   */
  readonly editing = signal<string | null>(null);

  readonly form = this.fb.group({
    type: this.fb.control<string | null>(null, Validators.required),
    number: this.fb.control<string>('', Validators.required),
    issueDate: this.fb.control<string | null>(null),
    expiryDate: this.fb.control<string | null>(null),
    issuingCountry: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
  });

  /** The descriptor for whatever type is currently selected, if the server sent one. */
  readonly selectedType = computed(() => {
    const key = this.form.controls.type.value;
    return key ? this.types().find(t => t.key === key) ?? null : null;
  });

  /** The dropdown persists the plain key, not the descriptor object. */
  typeKey = (t: DocumentTypeDescriptor) => t.key;
  typeName = (t: DocumentTypeDescriptor) =>
    t?.labelKey ? this.translate.instant(portalKey(t.labelKey)) : String(t ?? '');
  /** Selection may arrive as the descriptor or as the persisted key. */
  typeMatches = (a: any, b: any) => (a?.key ?? a) === (b?.key ?? b);

  startAdd(): void {
    this.form.reset({ type: null, number: '', issueDate: null, expiryDate: null, issuingCountry: null, notes: null });
    this.warnings.set([]);
    this.error.set(null);
    this.editing.set('new');
  }

  startEdit(document: EmployeeDocument): void {
    this.form.reset({
      type: document.type || null,
      number: document.number,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      issuingCountry: document.issuingCountry,
      notes: document.notes,
    });
    this.warnings.set([]);
    this.error.set(null);
    this.editing.set(document.id);
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
      const { warnings } = await this.service.save({
        // Omitted entirely when adding, rather than sent as 0 or '' — the
        // server decides insert vs update on the presence of an id.
        ...(editing === 'new' ? {} : { id: editing }),
        employeeId: this.employeeId,
        ...this.form.getRawValue(),
      });
      // Shown, not enforced. These are the required-file rules, which the
      // server still returns as advice rather than a refusal.
      this.warnings.set(warnings);
      this.editing.set(null);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Attachments ───────────────────────────────────────────────────────

  /**
   * Upload one file against a document.
   *
   * Refuses locally only on the two things the browser can know before the
   * round trip — type and size — using the server's own catalogue rather than a
   * second list. Everything else is the server's decision.
   */
  async onFilePicked(document: EmployeeDocument, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset immediately so picking the same file twice still fires a change.
    input.value = '';
    if (!file) return;

    const catalog = this.catalog();
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

    this.busy.set(document.id);
    this.error.set(null);
    try {
      await this.service.upload(document.id, file);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  /**
   * Download an attachment.
   *
   * A fresh signed URL every time, opened as issued. It is valid for 300
   * seconds and its issuance is audited, so it is never cached, rewritten or
   * stored — a cached URL would outlive its validity and detach the download
   * from whoever performed it.
   */
  async download(file: DocumentFile): Promise<void> {
    this.busy.set(file.id);
    this.error.set(null);
    try {
      const { url } = await this.service.downloadUrl(file.id);
      // `noopener` so the opened tab cannot reach back into this one; the URL
      // is a bearer credential for the next five minutes.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async removeFile(file: DocumentFile): Promise<void> {
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

  // ─── Documents ─────────────────────────────────────────────────────────

  async toggleVerified(document: EmployeeDocument): Promise<void> {
    this.busy.set(document.id);
    this.error.set(null);
    try {
      await this.service.setVerified(document.id, !document.isVerified);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async remove(document: EmployeeDocument): Promise<void> {
    this.busy.set(document.id);
    this.error.set(null);
    try {
      await this.service.remove(document.id);
      await this.load();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  // ─── Display helpers ───────────────────────────────────────────────────

  /**
   * The badge class for a server-computed status.
   *
   * `null` gets its own class rather than falling through to the healthy one.
   * An unknown expiry state must look unknown.
   */
  statusClass(document: EmployeeDocument): string {
    switch (document.status) {
      case 'Expired': return 'doc-badge doc-badge--expired';
      case 'Expiring': return 'doc-badge doc-badge--expiring';
      case 'Valid': return 'doc-badge doc-badge--valid';
      default: return 'doc-badge doc-badge--unknown';
    }
  }

  statusKey(document: EmployeeDocument): string {
    switch (document.status) {
      case 'Expired': return 'EMPLOYEES.DOCUMENTS.STATUS.EXPIRED';
      case 'Expiring': return 'EMPLOYEES.DOCUMENTS.STATUS.EXPIRING';
      case 'Valid': return 'EMPLOYEES.DOCUMENTS.STATUS.VALID';
      // Distinct from every real state, so nobody reads a missing value as good.
      default: return 'EMPLOYEES.DOCUMENTS.STATUS.UNKNOWN';
    }
  }

  /**
   * A document type's translation key.
   *
   * Falls back to the raw stored value when the catalogue did not come back —
   * `translate` returns an unknown key verbatim, so an unrecognised type shows
   * as `Passport` rather than as blank.
   */
  typeLabel(document: EmployeeDocument): string {
    const descriptor = this.types().find(t => t.key === document.type);
    return descriptor?.labelKey ? portalKey(descriptor.labelKey) : document.type;
  }

  fileSize(file: DocumentFile): string {
    if (file.sizeBytes === null) return '';
    if (file.sizeBytes < 1024) return `${file.sizeBytes} B`;
    if (file.sizeBytes < 1024 * 1024) return `${Math.round(file.sizeBytes / 1024)} KB`;
    return `${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /** Ids, so a reload after an upload does not rebuild every card. */
  trackDocument = (_: number, d: EmployeeDocument) => d.id;
  trackFile = (_: number, f: DocumentFile) => f.id;
}
