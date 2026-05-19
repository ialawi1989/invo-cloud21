import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '../app-config.service';
import { Menu } from '../../models/menu.model';
import { MenuSection } from '../../models/menu-section.model';
import { map, Observable } from 'rxjs';
import { ProductTag } from '../../models/product-tage.model';
import { Product } from '../../models/product.model';
import { AppServices } from '../appServices';
import { MenuSectionProducts } from 'src/app/models/menu-sections-products';


@Injectable({
  providedIn: 'root',
})

export class MenuService {

  constructor(private http: HttpClient, private config: AppConfigService, private appService: AppServices) {}

  loadMenus(branchId: string): Observable<Menu[]> {

    return this.http
      .get<{ success: boolean; data: any[] }>(`${this.config.baseUrl}menu/getMenuList/${branchId}`, { headers: this.appService.getHeaders() })
      .pipe(
        map(response => {
          if (response.success) {
            return response.data.map(item => { const _inst = new Menu(); _inst.ParseJson(item); return _inst; }); // Use fromJson for Menu model
          }
          return [];
        })
      );
  }

  getMenu(menuId: string): Observable<MenuSection[]> {
    return this.http
      .get<{ success: boolean; data: any }>(`${this.config.baseUrl}menu/getMenu/${menuId}`, { headers: this.appService.getHeaders() })
      .pipe(
        map(response => {
          if (response.success && response.data?.sections) {
            return response.data.sections.map((section: any) => { const _inst = new MenuSection(); _inst.ParseJson(section); return _inst; }); // Use fromJson for MenuSection model
          }
          return [];
        })
      );
  }

  getMenuProducts(param: any): Observable<any[]> {
    return this.http
      .post<{ success: boolean; data: { list: any[], count:Number, pageCount: number, startIndex: number, lastIndex: number, sessionId:string } }>(
        `${this.config.baseUrl}shop/menu/getMenuProducts`,
        param,
        { headers: this.appService.getHeaders() }
      )
      .pipe(
        map(response => {
          if (response.success) {
            return [response.data.list.map(item => { const _inst = new Product(); _inst.ParseJson(item); return _inst; }), response.data.count, response.data.pageCount, response.data.startIndex, response.data.lastIndex ]; // Use fromJson for Product model
          }
          return [];
        })
      );
  }

 

  getMenuSections(param: any): Observable<MenuSection[]> {
    return this.http
      .post<{ success: boolean; data: any[] }>(`${this.config.baseUrl}shop/menu/getMenuSections`, param, { headers: this.appService.getHeaders() })
      .pipe(
        map(response => {
          if (response.success) {
            const menus = [
              ...response.data.map(item => { const _inst = new MenuSection(); _inst.ParseJson(item); return _inst; }), // Use fromJson for MenuSection model
            ];
            return menus;
          }
          throw new Error('Failed to load menu sections');
        })
      );
  }

  getCompanyMenu(param: any): Observable<MenuSectionProducts[]> {
    return this.http
      .post<{ success: boolean; data: any[] }>(`${this.config.baseUrl}shop/menu/getCompanyMenu`, param, { headers: this.appService.getHeaders() })
      .pipe(
        map(response => {
          try {
            if (response.success) {
              const menuSectionsProducts = [
                ...response.data.map(item => { const _inst = new MenuSectionProducts(); _inst.ParseJson(item); return _inst; }), 
              ];
              return menuSectionsProducts;
            }
            return [];
          } catch (error) {
            return [];
          }
        })
      );
  }

  getProductTags(branchId?: string): Observable<ProductTag[]> {
    return this.http
      .post<{ success: boolean; data: any[] }>(`${this.config.baseUrl}shop/menu/getProductTags`, { branchId }, { headers: this.appService.getHeaders() })
      .pipe(
        map(response => {
          if (response.success) {
            return response.data.map(item => { const _inst = new ProductTag(); _inst.ParseJson(item); return _inst; }); // Use fromJson for ProductTag model
          }
          return [];
        })
      );
  }
}
