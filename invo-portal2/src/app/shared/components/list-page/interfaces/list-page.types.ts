import { TemplateRef } from "@angular/core";
import { Observable } from "rxjs";

/**
 * Table Column Interface (matches existing src/app/core/interfaces/table_columns.ts)
 */
export interface TableColumn<T = any> {
  key: string;
  label: string;
  /** Display label for grouped children (when multiple columns share the same label) */
  headerLabel?: string;
  display?: boolean;
  displayLabel?: boolean;
  pipe?: 'currency' | 'date' | 'number' | 'percent' | 'custom';
  pipeArgs?: any;
  locked?: boolean;
  visible?: boolean;
  order?: number;
  width?: string;
  sortable?: boolean;
  searchable?: boolean;
  highlight?: boolean;
  customTemplate?: boolean;
  cellClass?: string | ((row: T) => string);
  isCustomField?: boolean;

  // Clickable navigation config
  clickable?: {
    enabled: boolean;
    route: string | ((row: T) => string);
    queryParams?: Record<string, any> | ((row: T) => Record<string, any>);
    target?: '_self' | '_blank';
  };

  // Badge configuration
  badge?: {
    enabled: boolean;
    field?: string; // nested field path e.g. 'status.name'
    colorField?: string; // field containing color
    colorMap?: Record<string, string>; // map value to color
    textMap?: Record<string, string>; // map value to display text
    arrayField?: boolean; // if true, renders multiple badges
    condition?: (row: T) => boolean; // conditional display
  };

  // Sub-fields (additional rows under main cell)
  subFields?: {
    key: string;
    label?: string;
    formatter?: (value: any, row: T) => string;
    class?: string;
    visible?: boolean;
  }[];

  // Formatter function
  formatter?: (value: any, row: T) => string;

  /**
   * Marks this column as a primary/identifying column. The table header
   * renders a flag icon next to its label so users can distinguish the
   * primary column(s) from supplementary data at a glance.
   */
  primary?: boolean;

  /**
   * Marks the cell value in this column as interactive (pointer cursor +
   * hover color/underline). Purely visual — the click still bubbles to
   * `rowClicked` where the consumer can read `event.column.key` to decide
   * what to do (drawer, modal, navigation, etc). Defaults to `false`.
   *
   * For columns that use a custom template, add the shared
   * `list-interactive-cell` class on your template's leaf element (or bind
   * `[class.list-interactive-cell]="col.interactive"`) to get the same
   * styling while keeping the custom markup.
   */
  interactive?: boolean;

  /**
   * Rendering style when this column is grouped with siblings (i.e. another
   * column shares its `label`). `'newLine'` stacks vertically (default);
   * `'inline'` renders side-by-side within the same cell.
   */
  displayStyle?: 'inline' | 'newLine';

  /**
   * Populated internally by the list-page when columns are grouped by label.
   * The "leader" column (first in the group) carries the siblings here so the
   * template can render them inside a single cell.
   */
  groupedItems?: TableColumn<T>[];

  /**
   * Populated internally: `groupedItems` split into layout rows. A row ends
   * at the next sibling whose `displayStyle` is not `'inline'`. So
   * `[name(newLine), barcode(inline)]` → one row `[name, barcode]`;
   * `[name, barcode(newLine)]` → two rows.
   */
  groupedRows?: TableColumn<T>[][];
}

/**
 * List Query Parameters
 */
export interface ListQueryParams {
  page: number;
  limit: number;
  searchTerm?: string;
  sortBy?: {
    sortValue: string;
    sortDirection: 'asc' | 'desc';
  };
  filter?: Record<string, any>;
  columns?: string[];
}

/**
 * List Response
 */
export interface ListResponse<T = any> {
  list: T[];
  pageCount: number;
  count?: number;
}

/**
 * Filter Configuration Types
 */
export type FilterConfig =
  | StatusFilterConfig
  | DropdownFilterConfig
  | SearchDropdownFilterConfig
  | DateRangeFilterConfig
  | CheckboxGroupFilterConfig
  | MultiSelectFilterConfig;

export interface BaseFilterConfig {
  key: string;
  label: string;
  defaultValue?: any;
}

export interface StatusFilterConfig extends BaseFilterConfig {
  type: 'status';
  options: FilterOption[];
}

export interface DropdownFilterConfig extends BaseFilterConfig {
  type: 'dropdown';
  options?: FilterOption[] | Observable<FilterOption[]>;
  /** Async loader — called when dropdown opens. Takes precedence over static options. */
  loadFn?: (params: { page: number; pageSize: number; search: string }) => Promise<{ items: FilterOption[]; hasMore: boolean }>;
  placeholder?: string;
  /** Enable multi-select with checkboxes */
  multiple?: boolean;
  /** Preferred dropdown position */
  position?: 'bottom' | 'top';
}

export interface SearchDropdownFilterConfig extends BaseFilterConfig {
  type: 'search-dropdown';
  loadFn: (term: string, page: number) => Observable<any[]>;
  displayField: string;
  valueField: string;
  placeholder?: string;
}

export interface DateRangeFilterConfig {
  type: 'date-range';
  keyFrom: string;
  keyTo: string;
  label: string;
  defaultFrom?: Date;
  defaultTo?: Date;
}

export interface CheckboxGroupFilterConfig extends BaseFilterConfig {
  type: 'checkbox-group';
  options: FilterOption[];
}

export interface MultiSelectFilterConfig extends BaseFilterConfig {
  type: 'multi-select';
  options: FilterOption[] | Observable<FilterOption[]>;
  placeholder?: string;
}

export interface FilterOption {
  value: any;
  label: string;
  icon?: string;
  color?: string;
}

/**
 * Action Configuration
 */
export interface ActionConfig {
  id: string;
  label: string;
  icon?: string;
  color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  permission?: string;
  disabled?: boolean | ((context?: any) => boolean);
  handler?: (context?: any) => void;
}

/**
 * Bulk Action Configuration
 */
export interface BulkActionConfig extends ActionConfig {
  confirmMessage?: string;
  requiresSelection?: boolean;
}

/**
 * Pagination Configuration
 */
export interface PaginationConfig {
  enabled: boolean;
  pageLimits?: number[];
  default?: number;
  showInfo?: boolean;
  showPageSize?: boolean;
  showJumpToPage?: boolean;
  showFirstLast?: boolean;
}

/**
 * Search Configuration
 */
export interface SearchConfig {
  enabled: boolean;
  debounceMs?: number;
  placeholder?: string;
  minLength?: number;
}

/**
 * Sorting Configuration
 */
export interface SortingConfig {
  enabled: boolean;
  defaultSort?: {
    key: string;
    direction: 'asc' | 'desc';
  };
  multiColumn?: boolean;
}

/**
 * Empty State Configuration
 */
export interface EmptyStateConfig {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  actionHandler?: () => void;
}

/**
 * List Page Configuration
 */
export interface ListPageConfig<T = any> {
  // Data
  columns: TableColumn<T>[];
  dataSource: (params: ListQueryParams) => Observable<ListResponse<T>>;

  // Features
  pagination?: PaginationConfig;
  search?: SearchConfig;
  sorting?: SortingConfig;
  filters?: FilterConfig[];

  // Actions
  headerActions?: ActionConfig[];
  bulkActions?: BulkActionConfig[];
  rowActions?: ActionConfig[];

  // Behavior
  syncToUrl?: boolean;
  entityType?: string;
  permissions?: Record<string, string>;
  selectable?: boolean;
  rowClass?: string | ((row: T) => string);

  // UI
  emptyState?: EmptyStateConfig;
  loading?: boolean;

  // Custom Templates
  customCellTemplates?: Record<string, TemplateRef<any>>;
  customHeaderTemplate?: TemplateRef<any>;
  customFooterTemplate?: TemplateRef<any>;
}

/**
 * Filter State
 */
export interface FilterState {
  [key: string]: any;
}

/**
 * List Page State
 */
export interface ListPageState {
  page: number;
  pageSize: number;
  searchTerm: string;
  sortBy?: {
    sortValue: string;
    sortDirection: 'asc' | 'desc';
  };
  filters: FilterState;
  selectedRows: any[];
  visibleColumns: string[];
}

/**
 * Event Payloads
 */
export interface RowClickEvent<T = any> {
  row: T;
  column?: TableColumn<T>;
  event: MouseEvent;
}

export interface ActionClickEvent {
  action: ActionConfig;
  selectedRows?: any[];
  row?: any;
}

export interface SelectionChangeEvent<T = any> {
  selectedRows: T[];
  allSelected: boolean;
}

export interface SortChangeEvent {
  column: string;
  direction: 'asc' | 'desc' | null;
}

export interface FilterChangeEvent {
  filters: FilterState;
  hasActiveFilters: boolean;
}

export interface PageChangeEvent {
  page: number;
  pageSize: number;
}
