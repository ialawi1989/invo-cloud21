/** One company of the group and whether the employee can currently work in it (invitation not ended, or super admin). */
export interface GroupEmployeeCompany {
  companyId: string;
  companyName: string;
  available: boolean;
}

/** A row of `employee/getCompanyGroupEmployees`. */
export interface GroupEmployeeRow {
  id: string;
  name: string;
  companyList: GroupEmployeeCompany[];
}

export interface GroupEmployeeListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' };
}

export interface GroupEmployeeListResult {
  list: GroupEmployeeRow[];
  count: number;
  pageCount: number;
}
