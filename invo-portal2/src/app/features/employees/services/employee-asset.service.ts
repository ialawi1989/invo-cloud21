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
 * Employee asset assignments — company property in someone's hands.
 *
 * ── RESPONSE SHAPES ARE ASSUMED, NOT PROVEN ──────────────────────────────────
 * Like documents, none of this has executed. Every field is defaulted, and the
 * two SERVER-COMPUTED fields — `isOverdue` and `daysUntilReturn` — are typed
 * nullable and taken exactly as sent.
 *
 * `isOverdue: boolean | null` is the important one. It would be trivial to
 * write `isOverdue: r?.isOverdue === true` and get a clean boolean, and that is
 * precisely the bug: an assignment whose overdue flag never arrived would
 * render as "not overdue", which is a claim the server never made. The server's
 * rule also has a subtlety this side does not know about — only OPEN
 * assignments can be overdue, so a laptop returned three months late is not
 * flagged — and a client-side recomputation would disagree with it and with the
 * EOS clearance gate that shares the definition.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type AssetFile = HrFile;

export interface AssetAssignment {
  id: string;
  employeeId: string;
  assetTag: string;
  category: string;
  description: string;
  serialNumber: string | null;
  value: number | null;
  assignedDate: string | null;
  expectedReturnDate: string | null;
  returnDate: string | null;
  conditionOut: string | null;
  conditionIn: string | null;
  status: string | null;
  notes: string | null;
  /**
   * Computed by the server from `status` and `expectedReturnDate`.
   *
   * Null means the server did not say — rendered as unknown, never as "fine".
   */
  isOverdue: boolean | null;
  /** Whole days until the expected return, negative once past. Null if unsent. */
  daysUntilReturn: number | null;
  files: AssetFile[];
}

/**
 * One status from the server's catalogue.
 *
 * ── THE TWO FLAGS ARE THE VALIDATION RULES ───────────────────────────────────
 * `expectsReturn` decides whether a status may carry a return date and an
 * inbound condition; `closesAssignment` decides whether the item is still out.
 *
 * **Read them from here, never hardcode which statuses need what.** The server
 * refuses on these exact flags (`employeeAsset.repo.validate`), and a second
 * copy of "Returned and Damaged need a return date" in the portal is a copy
 * that drifts the moment a status is added — leaving a form that either demands
 * a field the server rejects or omits one it requires, with no way to tell
 * which from the screen.
 */
export interface AssetStatusDescriptor {
  key: string;
  labelKey: string;
  closesAssignment: boolean;
  expectsReturn: boolean;
}

export interface AssetOptionDescriptor {
  key: string;
  labelKey: string;
}

export interface AssetCatalog {
  categories: AssetOptionDescriptor[];
  statuses: AssetStatusDescriptor[];
  conditions: AssetOptionDescriptor[];
}

/** The entity key the file endpoints use for a handover acknowledgement. */
export const ASSET_ENTITY = FILE_ENTITY.asset;

@Injectable({ providedIn: 'root' })
export class EmployeeAssetService {
  private api = inject(ApiService);
  private files = inject(EmployeeFileService);

  // ─── Assignments ───────────────────────────────────────────────────────

  async list(employeeId: string): Promise<AssetAssignment[]> {
    const res = await this.api.request<any>(this.api.get(`employee/getAssets/${employeeId}`));
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(r => this.mapAssignment(r));
  }

  /**
   * What the employee still holds.
   *
   * The server's definition of "outstanding", which EOS clearance keys on. Kept
   * as its own call rather than filtered from `list()` here — filtering client
   * -side would be a second definition, and the two would disagree the first
   * time a status is added.
   */
  async listOpen(employeeId: string): Promise<AssetAssignment[]> {
    const res = await this.api.request<any>(this.api.get(`employee/getOpenAssets/${employeeId}`));
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map(r => this.mapAssignment(r));
  }

  async save(payload: Record<string, unknown>): Promise<{ id: string }> {
    const res = await this.api.request<any>(this.api.post('employee/saveAsset', payload));
    // The HR API refuses with HTTP 200 and a body that says no — including the
    // asset-tag clash, whose message names who currently holds it. That message
    // is worth more than anything this layer could substitute, so it is thrown
    // as-is and shown verbatim.
    if (res?.success === false) throw new Error(res?.msg || 'Could not save the assignment');
    return { id: res?.data?.id ?? '' };
  }

  /**
   * Delete an assignment.
   *
   * For correcting a mistaken entry only. Recording that an item came back is a
   * status change — deleting a returned laptop erases the evidence it was ever
   * issued.
   */
  async remove(assignmentId: string): Promise<void> {
    const res = await this.api.request<any>(
      this.api.get(`employee/deleteAsset/${assignmentId}`),
    );
    if (res?.success === false) throw new Error(res?.msg || 'Could not delete the assignment');
  }

  /**
   * Categories, statuses and conditions.
   *
   * The single source for both the pickers and the conditional validation. An
   * empty catalogue is returned as empty rather than backfilled from a local
   * list: a form built on a guessed catalogue would submit values the server
   * rejects as unknown, and the guess would be invisible.
   */
  async catalog(): Promise<AssetCatalog> {
    const res = await this.api.request<any>(this.api.get('employee/assetCatalog'));
    return {
      categories: Array.isArray(res?.data?.categories) ? res.data.categories : [],
      statuses: Array.isArray(res?.data?.statuses) ? res.data.statuses : [],
      conditions: Array.isArray(res?.data?.conditions) ? res.data.conditions : [],
    };
  }

  // ─── Attachments ───────────────────────────────────────────────────────
  //
  // The signed handover acknowledgement. Registered server-side as a
  // NON-confidential entity — company property, not identity — so downloads are
  // not audited the way a passport's are.

  fileCatalog(): Promise<FileCatalog> {
    return this.files.catalog();
  }

  upload(assignmentId: string, file: File): Promise<void> {
    return this.files.upload(ASSET_ENTITY, assignmentId, file);
  }

  downloadUrl(fileId: string): Promise<{ url: string; fileName: string }> {
    return this.files.downloadUrl(ASSET_ENTITY, fileId);
  }

  removeFile(fileId: string): Promise<void> {
    return this.files.remove(ASSET_ENTITY, fileId);
  }

  // ─── Mapping ───────────────────────────────────────────────────────────

  private mapAssignment(r: any): AssetAssignment {
    return {
      id: r?.id ?? '',
      employeeId: r?.employeeId ?? '',
      assetTag: r?.assetTag ?? '',
      category: r?.category ?? '',
      description: r?.description ?? '',
      serialNumber: r?.serialNumber ?? null,
      // Null rather than 0 when not recorded — 0 reads as "worth nothing",
      // which is a different claim and feeds the loss-deduction estimate.
      value: typeof r?.value === 'number' ? r.value : (r?.value ? Number(r.value) : null),
      assignedDate: r?.assignedDate ?? null,
      expectedReturnDate: r?.expectedReturnDate ?? null,
      returnDate: r?.returnDate ?? null,
      conditionOut: r?.conditionOut ?? null,
      conditionIn: r?.conditionIn ?? null,
      status: r?.status ?? null,
      notes: r?.notes ?? null,
      // Taken as sent, and NOT coerced. `=== true` would turn an absent flag
      // into a confident "not overdue" — see the header note.
      isOverdue: typeof r?.isOverdue === 'boolean' ? r.isOverdue : null,
      daysUntilReturn: typeof r?.daysUntilReturn === 'number' ? r.daysUntilReturn : null,
      files: mapHrFiles(r?.files),
    };
  }
}
