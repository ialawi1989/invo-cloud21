import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@core/http/api.service';
import { environment } from '../../../../environments/environment';

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

/** A file attached to a document. Never carries the storage key — by design. */
export interface DocumentFile {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
}

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

export interface FileCatalog {
  maxBytes: number;
  accepted: string[];
  storageConfigured: boolean;
}

/** The entity key the file endpoints use for a document attachment. */
export const DOCUMENT_ENTITY = 'employeeDocument';

@Injectable({ providedIn: 'root' })
export class EmployeeDocumentService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private baseUrl = environment.backendUrl;

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

  /**
   * What may be attached, and whether storage is configured at all.
   *
   * `storageConfigured: false` means `AWS_HR_DOCUMENTS_BUCKET` is unset on the
   * server. The upload control is disabled with that reason rather than left
   * to fail on submit.
   */
  async fileCatalog(): Promise<FileCatalog> {
    const res = await this.api.request<any>(this.api.get('employee/fileCatalog'));
    return {
      maxBytes: res?.data?.maxBytes ?? 10 * 1024 * 1024,
      accepted: Array.isArray(res?.data?.accepted) ? res.data.accepted : [],
      // Defaults to false: if the catalog cannot be read, assume storage is not
      // available rather than offering an upload that will fail.
      storageConfigured: res?.data?.storageConfigured === true,
    };
  }

  /**
   * Upload an attachment.
   *
   * multipart/form-data via `HttpClient.post` with a `FormData` body — the
   * portal's established upload path (see `media.service.ts`), and what the
   * server's `express-fileupload` middleware expects. `ApiService` is bypassed
   * deliberately: it sets a JSON content type, and a multipart request must let
   * the browser set its own boundary.
   */
  async upload(parentId: string, file: File): Promise<void> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('entityType', DOCUMENT_ENTITY);
    form.append('parentId', parentId);

    const res: any = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}employee/uploadFile`, form),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Upload failed');
  }

  /**
   * Get a download URL for one attachment.
   *
   * **The URL is used exactly as issued and never stored.** It is valid for 300
   * seconds, and every issuance writes an audit row naming who asked — caching
   * it would both outlive its validity and detach the download from the person
   * who performed it. A fresh call per download is the point, not an
   * inefficiency.
   */
  async downloadUrl(fileId: string): Promise<{ url: string; fileName: string }> {
    const res = await this.api.request<any>(
      this.api.get(`employee/getFileUrl/${DOCUMENT_ENTITY}/${fileId}`),
    );
    if (res?.success === false || !res?.data?.url) {
      throw new Error(res?.msg || 'Could not get a download link');
    }
    return { url: res.data.url, fileName: res.data.fileName ?? 'document' };
  }

  async removeFile(fileId: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.get(`employee/deleteFile/${DOCUMENT_ENTITY}/${fileId}`),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not remove the file');
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
      files: Array.isArray(r?.files) ? r.files.map((f: any) => this.mapFile(f)) : [],
    };
  }

  private mapFile(f: any): DocumentFile {
    return {
      id: f?.id ?? '',
      fileName: f?.fileName ?? 'file',
      contentType: f?.contentType ?? '',
      sizeBytes: typeof f?.sizeBytes === 'number' ? f.sizeBytes : null,
      uploadedAt: f?.uploadedAt ?? null,
      uploadedBy: f?.uploadedBy ?? null,
    };
  }
}
