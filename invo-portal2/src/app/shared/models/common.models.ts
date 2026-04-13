export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  [key: string]: any;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface SelectOption<T = string> {
  label: string;
  value: T;
}
