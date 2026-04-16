import { Params } from '@angular/router';
import { FilterState, ListPageState, TableColumn } from '../interfaces/list-page.types';

/**
 * URL State Management Utilities
 */
export class ListUrlStateHelper {
  /**
   * Serialize state to URL query params
   */
  static toQueryParams(state: Partial<ListPageState>): Params {
    const params: Params = {};

    params['page'] = (state.page && state.page > 1) ? state.page : null;

    if (state.pageSize) {
      params['limit'] = state.pageSize;
    }

    params['search'] = state.searchTerm || null;

    if (state.sortBy) {
      params['sortBy'] = state.sortBy.sortValue;
      params['sortDir'] = state.sortBy.sortDirection;
    }

    if (state.filters) {
      Object.entries(state.filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '' &&
            !(Array.isArray(value) && value.length === 0)) {
          if (Array.isArray(value)) {
            params[`filter_${key}`] = value.join(',');
          } else if (typeof value === 'object') {
            params[`filter_${key}`] = JSON.stringify(value);
          } else {
            params[`filter_${key}`] = value;
          }
        } else {
          params[`filter_${key}`] = null;
        }
      });
    }

    if (state.visibleColumns && state.visibleColumns.length > 0) {
      params['columns'] = state.visibleColumns.join(',');
    }

    return params;
  }

  /**
   * Deserialize query params to state
   */
  static fromQueryParams(params: Params, defaultState: Partial<ListPageState>): Partial<ListPageState> {
    const state: Partial<ListPageState> = { ...defaultState };

    if (params['page']) {
      state.page = parseInt(params['page'], 10);
    }

    if (params['limit']) {
      state.pageSize = parseInt(params['limit'], 10);
    }

    if (params['search']) {
      state.searchTerm = params['search'];
    }

    if (params['sortBy']) {
      state.sortBy = {
        sortValue: params['sortBy'],
        sortDirection: params['sortDir'] || 'asc'
      };
    }

    // Extract filters
    const filters: FilterState = {};
    Object.keys(params).forEach(key => {
      if (key.startsWith('filter_')) {
        const filterKey = key.replace('filter_', '');
        const value = params[key];
        
        // Try to parse as array
        if (value.includes(',')) {
          filters[filterKey] = value.split(',');
        } else {
          // Try to parse as JSON
          try {
            filters[filterKey] = JSON.parse(value);
          } catch {
            filters[filterKey] = value;
          }
        }
      }
    });

    if (Object.keys(filters).length > 0) {
      state.filters = filters;
    }

    if (params['columns']) {
      state.visibleColumns = params['columns'].split(',');
    }

    return state;
  }
}

/**
 * Column Utilities
 */
export class ColumnHelper {
  /**
   * Get visible columns
   */
  static getVisibleColumns<T>(columns: TableColumn<T>[]): TableColumn<T>[] {
    return columns
      .filter(col => col.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get searchable columns
   */
  static getSearchableColumns<T>(columns: TableColumn<T>[]): TableColumn<T>[] {
    return columns.filter(col => col.searchable !== false);
  }

  /**
   * Get sortable columns
   */
  static getSortableColumns<T>(columns: TableColumn<T>[]): TableColumn<T>[] {
    return columns.filter(col => col.sortable === true);
  }

  /**
   * Get column keys for API request
   */
  static getColumnKeys<T>(columns: TableColumn<T>[]): string[] {
    return columns.filter(col => col.visible !== false).map(col => col.key);
  }

  /**
   * Get nested value from object using dot notation
   */
  static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  /**
   * Apply column formatter
   */
  static formatCellValue<T>(value: any, column: TableColumn<T>, row: T): string {
    // Custom formatter
    if (column.formatter) {
      return column.formatter(value, row);
    }

    // Pipe formatters
    if (column.pipe) {
      switch (column.pipe) {
        case 'currency':
          return this.formatCurrency(value, column.pipeArgs);
        case 'date':
          return this.formatDate(value, column.pipeArgs);
        case 'number':
          return this.formatNumber(value, column.pipeArgs);
        case 'percent':
          return this.formatPercent(value, column.pipeArgs);
        default:
          return value?.toString() || '';
      }
    }

    return value?.toString() || '';
  }

  private static formatCurrency(value: number, args?: any): string {
    const currency = args?.currency || 'USD';
    const locale = args?.locale || 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency
    }).format(value);
  }

  private static formatDate(value: Date | string, args?: any): string {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    const format = args?.format || 'short';
    return date.toLocaleDateString('en-US', { 
      ...(format === 'short' ? { month: 'short', day: 'numeric', year: 'numeric' } : {})
    });
  }

  private static formatNumber(value: number, args?: any): string {
    const locale = args?.locale || 'en-US';
    return new Intl.NumberFormat(locale).format(value);
  }

  private static formatPercent(value: number, args?: any): string {
    const locale = args?.locale || 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: args?.decimals || 0
    }).format(value);
  }
}

/**
 * Filter Utilities
 */
export class FilterHelper {
  /**
   * Check if filters have active values
   */
  static hasActiveFilters(filters: FilterState): boolean {
    return Object.values(filters).some(value => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== null && value !== undefined && value !== '';
    });
  }

  /**
   * Count active filters
   */
  static countActiveFilters(filters: FilterState): number {
    return Object.values(filters).filter(value => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== null && value !== undefined && value !== '';
    }).length;
  }

  /**
   * Clear all filters
   */
  static clearFilters(): FilterState {
    return {};
  }

  /**
   * Remove a specific filter
   */
  static removeFilter(filters: FilterState, key: string): FilterState {
    const newFilters = { ...filters };
    delete newFilters[key];
    return newFilters;
  }
}

/**
 * Selection Utilities
 */
export class SelectionHelper {
  /**
   * Check if all rows are selected
   */
  static allSelected<T>(rows: T[], selectedRows: T[], idField = 'id'): boolean {
    if (rows.length === 0) return false;
    return rows.every(row => 
      selectedRows.some(selected => (selected as any)[idField] === (row as any)[idField])
    );
  }

  /**
   * Check if some (but not all) rows are selected
   */
  static someSelected<T>(rows: T[], selectedRows: T[], idField = 'id'): boolean {
    if (selectedRows.length === 0) return false;
    const allSelected = this.allSelected(rows, selectedRows, idField);
    return !allSelected && selectedRows.length > 0;
  }

  /**
   * Toggle all rows selection
   */
  static toggleAll<T>(rows: T[], selectedRows: T[], idField = 'id'): T[] {
    const allSelected = this.allSelected(rows, selectedRows, idField);
    
    if (allSelected) {
      // Deselect all
      return selectedRows.filter(selected => 
        !rows.some(row => (row as any)[idField] === (selected as any)[idField])
      );
    } else {
      // Select all
      const newSelections = rows.filter(row =>
        !selectedRows.some(selected => (selected as any)[idField] === (row as any)[idField])
      );
      return [...selectedRows, ...newSelections];
    }
  }

  /**
   * Toggle single row selection
   */
  static toggleRow<T>(row: T, selectedRows: T[], idField = 'id'): T[] {
    const isSelected = selectedRows.some(selected => 
      (selected as any)[idField] === (row as any)[idField]
    );

    if (isSelected) {
      return selectedRows.filter(selected => 
        (selected as any)[idField] !== (row as any)[idField]
      );
    } else {
      return [...selectedRows, row];
    }
  }

  /**
   * Check if a row is selected
   */
  static isRowSelected<T>(row: T, selectedRows: T[], idField = 'id'): boolean {
    return selectedRows.some(selected => 
      (selected as any)[idField] === (row as any)[idField]
    );
  }
}

/**
 * Highlight/Search Utilities
 */
export class HighlightHelper {
  /**
   * Highlight search term in text
   */
  static highlightText(text: string, searchTerm: string): string {
    if (!searchTerm || !text) return text;

    const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
