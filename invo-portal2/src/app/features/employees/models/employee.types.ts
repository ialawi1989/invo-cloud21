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

// ─── HR groups (phase 1) ────────────────────────────────────────────────────
// New employee data is namespaced under `profile` / `employment` so every
// existing top-level key keeps its name, casing and position on the wire.
// All of it is optional: a record saved before this shipped has none of it,
// and the form must render cleanly against that.

/** Postal address. Block / road / building are the Bahraini address parts and
 *  are required only when `country === 'BH'`. */
export interface EmployeeAddress {
  country?: string;
  city?: string;
  block?: string;
  road?: string;
  building?: string;
  flat?: string;
  postalCode?: string;
}

export interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
  isPrimary?: boolean;
}

/** A dependant — feeds insurance and family visas in later phases. */
export interface EmployeeDependent {
  name?: string;
  relationship?: string;
  dateOfBirth?: string | null;
  cprNumber?: string;
  isInsured?: boolean;
  isOnVisa?: boolean;
}

export interface EmployeeEducation {
  level?: string;
  institution?: string;
  graduationYear?: number | null;
  fieldOfStudy?: string;
}

/** The person, as distinct from the account. */
export interface EmployeeProfile {
  nameAr?: string;
  /** HR's own number for this employee — **not** `passCode`, which is a POS
   *  credential. */
  employeeNumber?: string;
  mobile?: string;
  /** Survives offboarding, unlike the account `email`. */
  personalEmail?: string;
  gender?: string;
  dateOfBirth?: string | null;
  /** ISO 3166-1 alpha-2. */
  nationality?: string;
  maritalStatus?: string;
  languages?: string[];
  address?: EmployeeAddress;
  emergencyContacts?: EmergencyContact[];
  dependents?: EmployeeDependent[];
  education?: EmployeeEducation[];
  [k: string]: any;
}

/** One appended job-history entry. Written by the backend, read-only here. */
export interface EmploymentHistoryEntry {
  date?: string;
  field?: string;
  from?: string;
  to?: string;
  reason?: string;
  actor?: string;
}

/**
 * Employment terms. `hireDate` and `terminationDate` stay top-level and stay
 * authoritative — nothing in here shadows them.
 *
 * `department` / `position` are free text in phase 1 (the lookup entities
 * don't exist yet) and become `departmentId` / `positionId` later.
 */
export interface EmployeeEmployment {
  /** Gratuity is calculated from this, not from `hireDate` — they differ on a
   *  rehire or a transfer. */
  seniorityDate?: string | null;
  employmentType?: string;
  status?: string;
  department?: string;
  position?: string;
  jobGrade?: string;
  reportsTo?: string | null;
  isDepartmentHead?: boolean;
  costCenter?: string;
  probationMonths?: number | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  noticePeriodDays?: number | null;
  weeklyHours?: number | null;
  history?: EmploymentHistoryEntry[];
  [k: string]: any;
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

  /**
   * Whether this employee signs in at all (D1). Absent means `true`, so every
   * record that existed before this flag is unaffected. When `false` the
   * credential block, role cards and privilege picker are hidden and cleared —
   * the record still has an id, so attendance and (later) payroll and
   * documents attach to it normally.
   */
  hasSystemAccess?: boolean;
  /**
   * Whether *this* company owns the employee's HR data — i.e. whether it may
   * read and write `profile` / `employment`.
   *
   * Decided by the API, by which arm of the employee UNION answered: the home
   * company gets `true`, a company that merely invited the person gets `false`
   * along with nulled groups. Absent means true (a record answered before the
   * field existed, or a single-company employee).
   *
   * Never re-derive this from `isInvitedUser` or anything else client-side: a
   * second discriminator can disagree with the query that enforces the rule,
   * and the failure mode is a cross-tenant read.
   */
  isHrDataOwner?: boolean;
  /** Present only once HR data has been entered — never defaulted to `{}`.
   *  Always absent for a caller that isn't the HR-data owner. */
  profile?: EmployeeProfile;
  employment?: EmployeeEmployment;
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
