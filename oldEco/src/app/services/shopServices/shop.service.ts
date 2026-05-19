import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { AppConfigService } from '../app-config.service';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { Injectable } from '@angular/core';
import { ProductTag } from '../../models/product-tage.model';
import { Brand } from '../../models/brand.model';
import { AppServices } from '../appServices';
import { AuthService } from '../authService/auth.service';


@Injectable({
  providedIn: 'root',
})

export class ShopService {


  auth_token:any;
  
  constructor(
    private http: HttpClient, 
    private config: AppConfigService,
    private auth: AuthService
  ) { 
    auth.currentToken.subscribe(v => {
      this.auth_token = v;
    });
  }

  getHeaders() {
    let params: any = {
      'Content-Type': 'application/json'
    }
    if (this.auth_token) {
      params["Auth-Token"] = this.auth_token
    }
    return new HttpHeaders(params);
  }

  getCatgorieProductsTags(branchId?: string): Observable<ProductTag[]> {
    const body = { branchId };
    return this.http
      .post<{ success: boolean; data: any[] }>(`${this.config.baseUrl}shop/getCatgorieProductsTags`, body, { headers:this.getHeaders() })
      .pipe(
        map(response => {
          if (response.success) {
            return response.data.map(item => { const _inst = new ProductTag(); _inst.ParseJson(item); return _inst; }); // Use fromJson for Product model
          }
          return [];
        })
      );
  }

   private shopCategoriesCache: Category[] | null = null;


  getCompanyCategories(branchId?: string): Observable<Category[]> {
    const body = { branchId };
    return this.http
      .post<{ success: boolean; data: any[] }>(`${this.config.baseUrl}shop/getCompanyCategories`, body, { headers:this.getHeaders() })
      .pipe(
        map(response => {
          if (response.success) {
            this.shopCategoriesCache = response.data.map(item => { const _inst = new Category(); _inst.ParseJson(item); return _inst; });
            return this.shopCategoriesCache
          }
          return [];
        })
      );
  }

   get cachedShopCategories(): Category[] | null {
    return this.shopCategoriesCache;
  }

  getCategoriesProducts(param: any): Observable<any> {
    return this.http
      .post<{ success: boolean; data: { list: any[], count: number, pageCount: number, startIndex: number, lastIndex: number } }>(`${this.config.baseUrl}shop/getCategoriesProducts`, param, { headers:this.getHeaders() })
      .pipe(
        map(response => {
          if (response.success) {
            return [response.data.list.map(item => { const _inst = new Product(); _inst.ParseJson(item); return _inst; }), response.data.count, response.data.pageCount, response.data.startIndex, response.data.lastIndex]; // Use fromJson for Product model
          }
          return null;
        })
      );
  }

  getAlternativeProductsList(param: any): Observable<Product[]> {
    return this.http
      .post<{ success: boolean; data: any[] }>(`${this.config.baseUrl}shop/getAlternativeProducts`, param)
      .pipe(
        map(response => {
          if (response.success) {
            return response.data.map(item => { const _inst = new Product(); _inst.ParseJson(item); return _inst; }); // Use fromJson for Product model
          }
          return [];
        })
      );
  }

  getProductData(param: any): Observable<Product | null> {
    return this.http
      .post<{ success: boolean; data: any }>(`${this.config.baseUrl}shop/getProduct`, param)
      .pipe(
        map(response => {
          if (response.success) {
            const _inst = new Product(); _inst.ParseJson(response.data); return _inst; // Use fromJson for Product model
          }
          return null;
        })
      );
  }

  getProductMedia(productId: string): Observable<Product | null> {
    return this.http
      .get<{ success: boolean; data: any }>(`${this.config.baseUrl}shop/getProductMedia/${productId}`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.data;
          }
          return null;
        })
      );
  }

  getBrands(): Observable<Brand[]> {
    return this.http
      .get<{ success: boolean; data: any }>(`${this.config.baseUrl}shop/getBrands`, { headers:this.getHeaders() })
      .pipe(
        map(response => {
          if (response.success) {
            // Assuming response.data is an array of brand objects
            return response.data.map((item: any) => { const _inst = new Brand(); _inst.ParseJson(item); return _inst; }); // Map each item to a Brand instance
          }
          return []; // Return an empty array if success is false
        })
      );
  }

}

