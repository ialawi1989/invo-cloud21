export interface BranchRow {
  id: string;
  name: string;
}

export interface BranchListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' };
}

export interface BranchListResult {
  list: BranchRow[];
  count: number;
  pageCount: number;
}
