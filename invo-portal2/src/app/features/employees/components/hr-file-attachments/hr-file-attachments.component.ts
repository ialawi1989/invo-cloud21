import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import {
  EmployeeFileService,
  FileCatalog,
  FileEntity,
  HrFile,
} from '../../services/employee-file.service';
import { describeError, HrError } from '../../hr-error';

/**
 * Attachments for one HR record — the upload control, the list, and the rules.
 *
 * ── WHY THIS IS A COMPONENT AND NOT COPIED MARKUP ────────────────────────────
 * The documents tab grew this behaviour first: pick a file, refuse the two
 * things the browser can know before a round trip (type and size, from the
 * SERVER's catalogue rather than a second hard-coded list), upload, reload,
 * download through a fresh signed URL, remove. The employee form now needs the
 * same thing, and assets, disciplinary and performance will.
 *
 * Copied, those five copies would diverge within a month, and the ones that
 * matter are the ones nobody would notice diverging: a cached signed URL, a
 * missing size check, an accepted-types list that drifts from the server's.
 * So the behaviour lives here once and the parent passes its entity and parent
 * id.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The component owns the transport and the rules; it does NOT own the list.
 * Files arrive as an input and `changed` fires after every mutation, because
 * the parent already reloads its own record and a second source of truth here
 * would show a stale count next to a fresh list.
 */

/** What a viewer may do with attachments, and why not. */
export interface AttachmentAccess {
  /** Render the section at all. */
  visible: boolean;
  /** Render the upload control as usable. */
  canUpload: boolean;
  /** i18n key explaining a visible-but-unusable control. Null when usable. */
  reasonKey: string | null;
}

/**
 * The gate, as a pure function so it can be tested without a browser.
 *
 * Extracted for the same reason `visibleTabs` was: it is the only place the
 * conditions combine, and testing it through the rendered component invites a
 * test that passes because the control was never reachable in the fixture.
 *
 * ── NEVER A CONTROL THAT FAILS ON SUBMIT ─────────────────────────────────────
 * A new employee has no record to attach to — the file layer keys on a parent
 * id that does not exist until the first save — so the control is shown
 * disabled with a reason rather than hidden (it tells the user the feature
 * exists) and never enabled (it would 400 on submit).
 *
 * An ungranted user gets nothing at all. The HR API is default-deny and would
 * refuse every request; an upload button whose every use is refused is worse
 * than an absent one.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function attachmentAccess(opts: {
  isNew: boolean;
  featureEnabled: boolean;
  canView: boolean;
  canEdit: boolean;
  storageConfigured: boolean;
}): AttachmentAccess {
  // Has the company bought the module at all?
  if (!opts.featureEnabled) return { visible: false, canUpload: false, reasonKey: null };
  // Explicit grant. NOT the default-allow check — see hr-privilege.ts.
  if (!opts.canView) return { visible: false, canUpload: false, reasonKey: null };

  if (opts.isNew) {
    return { visible: true, canUpload: false, reasonKey: 'EMPLOYEES.FILES.SAVE_EMPLOYEE_FIRST' };
  }
  if (!opts.canEdit) {
    return { visible: true, canUpload: false, reasonKey: 'EMPLOYEES.FILES.NO_UPLOAD_PERMISSION' };
  }
  if (!opts.storageConfigured) {
    // The server names no bucket. It is not "the bucket is missing" — that is
    // created on demand — it is that nobody configured where these go.
    return { visible: true, canUpload: false, reasonKey: 'EMPLOYEES.FILES.STORAGE_UNCONFIGURED' };
  }
  return { visible: true, canUpload: true, reasonKey: null };
}

@Component({
  selector: 'app-hr-file-attachments',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hr-file-attachments.component.html',
  styleUrl: './hr-file-attachments.component.scss',
})
export class HrFileAttachmentsComponent {
  private files = inject(EmployeeFileService);

  /** Entity key, spelled as the server's FILE_ENTITIES registry spells it. */
  entity = input.required<FileEntity>();
  /** The record these files hang off. Empty means nothing to attach to. */
  parentId = input.required<string>();
  attachments = input<HrFile[]>([]);
  /** Whether the upload control may be used at all — the parent owns the gate. */
  canUpload = input<boolean>(false);
  /** i18n key shown instead of the control when it is not usable. */
  disabledReasonKey = input<string | null>(null);

  /** Fires after an upload or a removal, so the parent reloads its record. */
  changed = output<void>();

  readonly catalog = signal<FileCatalog | null>(null);
  readonly busy = signal<string | null>(null);
  readonly error = signal<HrError | null>(null);

  /** Accepted types for the file input, from the server's own catalogue. */
  readonly acceptAttr = computed<string>(() => this.catalog()?.accepted.join(',') ?? '');

  constructor() {
    // Fetched once, up front: discovering the limits after the user has picked
    // a 30MB scan is too late to be useful.
    this.files.catalog().then(c => this.catalog.set(c)).catch(() => this.catalog.set(null));
  }

  async onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset immediately so picking the same file twice still fires a change.
    input.value = '';
    if (!file) return;

    const parent = this.parentId();
    if (!parent) return;

    const catalog = this.catalog();
    if (catalog) {
      if (catalog.accepted.length && !catalog.accepted.includes(file.type)) {
        this.error.set({ titleKey: 'EMPLOYEES.HR.ERR.TYPE_REJECTED', detail: file.type || file.name, hintKey: null });
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

    this.busy.set(parent);
    this.error.set(null);
    try {
      await this.files.upload(this.entity(), parent, file);
      this.changed.emit();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  /**
   * A fresh signed URL every time, opened as issued.
   *
   * Valid for 300 seconds and audited on issuance, so it is never cached or
   * stored — a cached URL would outlive its validity and detach the download
   * from whoever performed it. `noopener` because the URL is a bearer
   * credential for the next five minutes.
   */
  async download(file: HrFile): Promise<void> {
    this.busy.set(file.id);
    this.error.set(null);
    try {
      const { url } = await this.files.downloadUrl(this.entity(), file.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  async remove(file: HrFile): Promise<void> {
    this.busy.set(file.id);
    this.error.set(null);
    try {
      await this.files.remove(this.entity(), file.id);
      this.changed.emit();
    } catch (e) {
      this.error.set(describeError(e));
    } finally {
      this.busy.set(null);
    }
  }

  fileSize(file: HrFile): string {
    if (file.sizeBytes === null) return '';
    if (file.sizeBytes < 1024) return `${file.sizeBytes} B`;
    if (file.sizeBytes < 1024 * 1024) return `${Math.round(file.sizeBytes / 1024)} KB`;
    return `${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  }

  trackFile = (_: number, f: HrFile) => f.id;
}
