export interface SortInfo {
  sortValue?: string;
  sortDirection?: 'ASC' | 'DESC';
  onSort: (value: string) => void;
}