/**
 * Employee feature — wire/UI types.
 *
 * Migrated from the legacy `core/models/employee/*` classes (which used a
 * `ParseJson()` mutation pattern). Here we keep them as plain interfaces and
 * let the services do the normalising, matching the invo-portal2 convention
 * (see BranchSettingsService).
 */

/** Avatar sub-object returned on an employee (`mediaUrl`). */
export interface EmployeeAvatar {
  defaultUrl: string;
}

/** Row shape for the employees list. */
export interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  avatar: string;
  admin: boolean;
  superAdmin: boolean;
  user: boolean;
  isDriver: boolean;
  isInvitedUser: boolean;
  branchId: string;
}

/** Full employee record for the add/edit form. Loosely typed where the
 *  legacy payload carried opaque blobs we only round-trip. */
export interface EmployeeDetails extends EmployeeSummary {
  formStatus?: 'new' | 'edit';
  password: string;
  passCode: string;
  MSR: string;
  base64Image: string;
  companyId: string;
  companyGroupId: string | null;
  createdAt: string;
  apply2fa: boolean | null;
  hasPermissionToChange2fa: boolean;
  branches: any[];
  privileges: any;
  privilegeId: string | null;
  mediaId: string | null;
  mediaUrl: EmployeeAvatar;
  resetPasswordDate: string | null;
  /** ISO date (YYYY-MM-DD). null = unspecified. */
  hireDate: string | null;
  /** ISO date (YYYY-MM-DD). null = currently employed. */
  terminationDate: string | null;
}

/** Standard list params accepted by the paginated employee endpoints. */
export interface EmployeeListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue?: string; sortDirection?: 'asc' | 'desc' };
}

/** Standard paginated envelope returned by the list endpoints. */
export interface PagedResult<T> {
  list: T[];
  count: number;
  pageCount: number;
  startIndex: number;
  lastIndex: number;
}

// ─── Privileges ────────────────────────────────────────────────────────────

/** A single privilege-group's `actions` map: { <action>: { access: boolean } }. */
export type PrivilegeActions = Record<string, { access: boolean; [k: string]: any }>;

/** The whole privilege tree — one entry per security group, kept loose since
 *  the catalog is large and driven by `getPrivilegesFile`. */
export type Privilege = Record<string, { actions?: PrivilegeActions; [k: string]: any }>;

export interface EmployeePrivilegeSummary {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface EmployeePrivilegeDetails extends EmployeePrivilegeSummary {
  privileges: Privilege;
  [k: string]: any;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export interface AttendanceSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  clockedIn: string | null;
  clockedOut: string | null;
  adjClockedIn: string | null;
  adjClockedOut: string | null;
  adjClockedInBy: string | null;
  adjClockedOutBy: string | null;
  adjClockedInByEmployee: string;
  adjClockedOutByEmployee: string;
  clockedInMediaUrl: string | null;
  clockedOutMediaUrl: string | null;
  clockedInImage: string | null;
  clockedOutImage: string | null;
  [k: string]: any;
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export interface EmployeeScheduleParams {
  branchId: string;
  from: string;
  to: string;
}
