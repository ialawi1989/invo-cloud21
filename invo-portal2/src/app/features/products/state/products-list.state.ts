import { Injectable, inject, computed } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable()
export class ProductsListStateService {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private queryParams = toSignal(this.route.queryParams, { initialValue: {} as Params });

  page = computed(() => Number((this.queryParams() as any)['page']) || 1);
  limit = computed(() => Number((this.queryParams() as any)['limit']) || 15);
  search = computed(() => (this.queryParams() as any)['search'] || '');
  sortBy = computed(() => (this.queryParams() as any)['sortBy'] || '');
  sortDirection = computed(() => (this.queryParams() as any)['sortDirection'] || 'asc');
  filters = computed(() => {
    const f = (this.queryParams() as any)['filters'];
    return f ? JSON.parse(f) : {};
  });

  setPage(page: number): void {
    this.updateQueryParams({ page });
  }

  setLimit(limit: number): void {
    this.updateQueryParams({ limit, page: 1 });
  }

  setSearch(search: string): void {
    this.updateQueryParams({ search, page: 1 });
  }

  setSort(sortBy: string, sortDirection: 'asc' | 'desc'): void {
    this.updateQueryParams({ sortBy, sortDirection });
  }

  setFilters(filters: any): void {
    this.updateQueryParams({ filters: JSON.stringify(filters), page: 1 });
  }

  private updateQueryParams(params: any): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }
}
