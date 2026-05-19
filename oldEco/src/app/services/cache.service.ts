// pagination-cache.service.ts
import { Injectable } from '@angular/core';

export interface CachedPage {
  products: any[];
  totalProducts: number;
  pageCount: number;
  startIndex: number;
  lastIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaginationCacheService {
  private cache: { [key: string]: CachedPage } = {};

  // The key can be composed of all parameters that determine the result
  getCache(key: string): CachedPage | null {
    return this.cache[key] || null;
  }

  setCache(key: string, data: CachedPage): void {
    this.cache[key] = data;
  }
  
  // Optionally add a method to clear the cache if needed.
  clearCache(): void {
    this.cache = {};
  }
}
