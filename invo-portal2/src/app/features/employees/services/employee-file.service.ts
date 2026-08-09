import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '@core/http/api.service';
import { environment } from '../../../../environments/environment';

/**
 * Attachments, for every HR entity that has them.
 *
 * ── ONE LAYER, MANY PARENTS ──────────────────────────────────────────────────
 * The server registers the entity types in `employeeFileTypes.ts` —
 * `employeeDocument`, `employeeAsset`, `employeeDisciplinary`,
 * `employeePerformance` — and serves them all through the same three
 * endpoints, keyed on `entityType`. So this is one service the tabs pass their
 * entity to, not a copy per tab: the upload transport, the signed-URL rule and
 * the never-cache rule are properties of the file layer, and four copies would
 * differ within a month.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A file attached to an HR record. Never carries the storage key — by design. */
export interface HrFile {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
}

export interface FileCatalog {
  maxBytes: number;
  accepted: string[];
  storageConfigured: boolean;
}

/** Entity keys, spelled as the server's FILE_ENTITIES registry spells them. */
export const FILE_ENTITY = {
  document: 'employeeDocument',
  asset: 'employeeAsset',
  disciplinary: 'employeeDisciplinary',
  performance: 'employeePerformance',
} as const;

export type FileEntity = (typeof FILE_ENTITY)[keyof typeof FILE_ENTITY];

/**
 * Normalise one file row.
 *
 * The `files` aggregate has never returned a real row, so absent, null and
 * non-array must all survive.
 */
export function mapHrFile(f: any): HrFile {
  return {
    id: f?.id ?? '',
    fileName: f?.fileName ?? 'file',
    contentType: f?.contentType ?? '',
    sizeBytes: typeof f?.sizeBytes === 'number' ? f.sizeBytes : null,
    uploadedAt: f?.uploadedAt ?? null,
    uploadedBy: f?.uploadedBy ?? null,
  };
}

export function mapHrFiles(value: any): HrFile[] {
  return Array.isArray(value) ? value.map(mapHrFile) : [];
}

@Injectable({ providedIn: 'root' })
export class EmployeeFileService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private baseUrl = environment.backendUrl;

  /**
   * What may be attached, and whether storage is configured at all.
   *
   * `storageConfigured: false` means the documents bucket is unset on the
   * server. Upload controls are hidden with that reason stated, rather than
   * left to fail on submit.
   */
  async catalog(): Promise<FileCatalog> {
    const res = await this.api.request<any>(this.api.get('employee/fileCatalog'));
    return {
      maxBytes: res?.data?.maxBytes ?? 10 * 1024 * 1024,
      accepted: Array.isArray(res?.data?.accepted) ? res.data.accepted : [],
      // Defaults to false: if the catalogue cannot be read, assume storage is
      // not available rather than offering an upload that will fail.
      storageConfigured: res?.data?.storageConfigured === true,
    };
  }

  /**
   * Upload an attachment.
   *
   * multipart/form-data via `HttpClient.post` with a `FormData` body — the
   * portal's established upload path, and what the server's `express-fileupload`
   * middleware expects. `ApiService` is bypassed deliberately: it sets a JSON
   * content type, and a multipart request must let the browser set its own
   * boundary.
   */
  async upload(entity: FileEntity, parentId: string, file: File): Promise<void> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('entityType', entity);
    form.append('parentId', parentId);

    const res: any = await firstValueFrom(
      this.http.post<any>(`${this.baseUrl}employee/uploadFile`, form),
    );
    // The HR API refuses with HTTP 200 and a body that says no — see hr-error.ts.
    if (res?.success === false) throw new Error(res?.msg || 'Upload failed');
  }

  /**
   * Get a download URL for one attachment.
   *
   * **The URL is used exactly as issued and never stored.** It is valid for 300
   * seconds, and for confidential entities every issuance writes an audit row
   * naming who asked — caching it would both outlive its validity and detach
   * the download from the person who performed it. A fresh call per download is
   * the point, not an inefficiency.
   */
  async downloadUrl(entity: FileEntity, fileId: string): Promise<{ url: string; fileName: string }> {
    const res = await this.api.request<any>(
      this.api.get(`employee/getFileUrl/${entity}/${fileId}`),
    );
    if (res?.success === false || !res?.data?.url) {
      throw new Error(res?.msg || 'Could not get a download link');
    }
    return { url: res.data.url, fileName: res.data.fileName ?? 'file' };
  }

  async remove(entity: FileEntity, fileId: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.get(`employee/deleteFile/${entity}/${fileId}`),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not remove the file');
  }
}
