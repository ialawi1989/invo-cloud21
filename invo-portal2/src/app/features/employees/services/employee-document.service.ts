import { Injectable, inject } from '@angular/core';

import { ApiService } from '@core/http/api.service';
import {
  FILE_ENTITY,
  FileCatalog,
  HrFile,
  EmployeeFileService,
  mapHrFiles,
} from './employee-file.service';

/**
 * Employee documents and their attachments.
 *
 * ── RESPONSE SHAPES ARE ASSUMED, NOT PROVEN ──────────────────────────────────
 * None of these endpoints has ever run against a database. The migrations have
 * never been executed by the runner, and the `files` aggregate has never
 * returned a real row. So every mapper here treats missing fields as missing —
 * `??` and empty arrays throughout — rather than trusting the documented shape.
 *
 * The specific things that could be absent and must not throw:
 *   • `files` — a correlated aggregate that has never produced a row
 *   • `status` / `daysRemaining` — computed server-side, never executed
 *   • `data` itself — every wrapper is `{ success, msg, data }` and `data` is
 *     null on failure
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * A file attached to a document.
 *
 * The same shape every HR entity's attachments have — the server serves them
 * all through one file layer. Re-exported under the old name so the documents
 * tab keeps reading in its own vocabulary.
 */
export type DocumentFile = HrFile;

/** Server-computed expiry state. Never recomputed client-side — see below. */
export type DocumentStatus = 'Valid' | 'Expiring' | 'Expired';

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: string;
  number: string;
  issueDate: string | null;
  expiryDate: string | null;
  issuingCountry: string | null;
  reminderDays: number[];
  visaType: string | null;
  workPermitNumber: string | null;
  workPermitExpiry: string | null;
  sponsor: string | null;
  licenceCategories: string[];
  gosiNumber: string | null;
  cprNumber: string | null;
  isVerified: boolean;
  verifiedBy: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  notes: string | null;
  /**
   * Computed by the server from `expiryDate`.
   *
   * **Never recomputed here.** Two implementations of "expiring" disagree the
   * moment one of them changes its window, and the server's is the one the
   * reminder engine acts on — a badge saying Valid next to an email saying
   * "expires in 7 days" is worse than no badge.
   *
   * Null when the server did not send it, which is treated as "unknown" rather
   * than defaulted to Valid.
   */
  status: DocumentStatus | null;
  daysRemaining: number | null;
  files: DocumentFile[];
}

export interface DocumentTypeDescriptor {
  key: string;
  labelKey: string;
  expiryRequired: boolean;
  issuingCountryRequired?: boolean;
  conditionalFields?: string[];
}

export type { FileCatalog };

/** The entity key the file endpoints use for a document attachment. */
export const DOCUMENT_ENTITY = FILE_ENTITY.document;

@Injectable({ providedIn: 'root' })
export class EmployeeDocumentService {
  private api = inject(ApiService);
  private files = inject(EmployeeFileService);

  // ─── Documents ─────────────────────────────────────────────────────────

  async list(employeeId: string): Promise<EmployeeDocument[]> {
    const res = await this.api.request<any>(
      this.api.get(`employee/getDocuments/${employeeId}`),
    );
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(r => this.mapDocument(r));
  }

  async save(payload: Record<string, unknown>): Promise<{ id: string; warnings: string[] }> {
    const res = await this.api.request<any>(this.api.post('employee/saveDocument', payload));
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the document');
    return {
      id: res?.data?.id ?? '',
      // The server returns warnings rather than refusing — the required-file
      // rules are not enforced yet. Surfaced, not acted on.
      warnings: Array.isArray(res?.data?.warnings) ? res.data.warnings : [],
    };
  }

  async remove(documentId: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.get(`employee/deleteDocument/${documentId}`),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the document');
  }

  async setVerified(documentId: string, isVerified: boolean): Promise<void> {
    const res = await this.api.request<any>(
      this.api.post('employee/verifyDocument', { documentId, isVerified }),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not update verification');
  }

  async types(): Promise<DocumentTypeDescriptor[]> {
    const res = await this.api.request<any>(this.api.get('employee/documentTypes'));
    return Array.isArray(res?.data) ? res.data : [];
  }

  // ─── Attachments ───────────────────────────────────────────────────────
  //
  // Delegated to EmployeeFileService. The entity key is the only thing
  // documents-specific about any of it; the transport, the never-cache rule
  // and the defensive mapping belong to the file layer, which four tabs share.

  /** What may be attached, and whether storage is configured at all. */
  fileCatalog(): Promise<FileCatalog> {
    return this.files.catalog();
  }

  upload(parentId: string, file: File): Promise<void> {
    return this.files.upload(DOCUMENT_ENTITY, parentId, file);
  }

  /**
   * A download URL, fresh every time.
   *
   * Documents are a CONFIDENTIAL entity server-side, so every issuance also
   * writes an audit row naming who asked. Caching the URL would detach the
   * download from the person who performed it as well as outliving its 300
   * seconds.
   */
  downloadUrl(fileId: string): Promise<{ url: string; fileName: string }> {
    return this.files.downloadUrl(DOCUMENT_ENTITY, fileId);
  }

  removeFile(fileId: string): Promise<void> {
    return this.files.remove(DOCUMENT_ENTITY, fileId);
  }

  // ─── Mapping ───────────────────────────────────────────────────────────

  /**
   * Normalise one row.
   *
   * Every field is defaulted. The aggregates in particular have never returned
   * a real row, so `files` being absent, null or a non-array must all produce
   * an empty list rather than a template error.
   */
  private mapDocument(r: any): EmployeeDocument {
    return {
      id: r?.id ?? '',
      employeeId: r?.employeeId ?? '',
      type: r?.type ?? '',
      number: r?.number ?? '',
      issueDate: r?.issueDate ?? null,
      expiryDate: r?.expiryDate ?? null,
      issuingCountry: r?.issuingCountry ?? null,
      reminderDays: Array.isArray(r?.reminderDays) ? r.reminderDays : [],
      visaType: r?.visaType ?? null,
      workPermitNumber: r?.workPermitNumber ?? null,
      workPermitExpiry: r?.workPermitExpiry ?? null,
      sponsor: r?.sponsor ?? null,
      licenceCategories: Array.isArray(r?.licenceCategories) ? r.licenceCategories : [],
      gosiNumber: r?.gosiNumber ?? null,
      cprNumber: r?.cprNumber ?? null,
      isVerified: r?.isVerified === true,
      verifiedBy: r?.verifiedBy ?? null,
      verifiedByName: r?.verifiedByName ?? null,
      verifiedAt: r?.verifiedAt ?? null,
      notes: r?.notes ?? null,
      // Taken as sent. Not recomputed, and not defaulted to 'Valid' — an
      // unknown status must not read as a good one.
      status: (r?.status as DocumentStatus) ?? null,
      daysRemaining: typeof r?.daysRemaining === 'number' ? r.daysRemaining : null,
      files: mapHrFiles(r?.files),
    };
  }
}
