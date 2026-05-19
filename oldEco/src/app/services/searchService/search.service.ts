import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '../app-config.service';
import { Product } from '../../models/product.model';
import { AppServices } from '../appServices';

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  private searchQuerySubject = new BehaviorSubject<string>('');
  searchQuery$ = this.searchQuerySubject.asObservable();

  // Create a signal
  private _showSearchInMobile = signal(false);

  // Public readonly signal
  public showSearchInMobile = this._showSearchInMobile.asReadonly();

  // Methods to update the signal
  showMobileSearch(): void {
    this._showSearchInMobile.set(true);
  }

  hideMobileSearch(): void {
    this._showSearchInMobile.set(false);
  }

  toggleMobileSearch(): void {
    this._showSearchInMobile.update(current => !current);
  }
    setSearchQuery(query: string): void {
    this.searchQuerySubject.next(query);
  }

  private searchResultsSubject = new BehaviorSubject<any[]>([]);
  searchResults$ = this.searchResultsSubject.asObservable();

  setSearchResults(results: any[]): void {
    this.searchResultsSubject.next(results);
  }

  constructor(private http: HttpClient, private config: AppConfigService, private appService: AppServices) { }

  searchProducts(param: any): Observable<any[]> {
    return this.http
      .post<{ success: boolean; data: { list: any[], count: Number, pageCount: number, startIndex: number, lastIndex: number, types: string[] } }>(
        `${this.config.baseUrl}shop/generalSearch`,
        param,
        { headers: this.appService.getHeaders() }
      )
      .pipe(
        map(response => {
          if (response.success) {
            return [response.data.list.map(item => { const _inst = new Product(); _inst.ParseJson(item); return _inst; }), response.data.count, response.data.pageCount, response.data.startIndex, response.data.lastIndex, response.data.types]; // Use fromJson for Product model
          }
          return [];
        })
      );
  }

}
