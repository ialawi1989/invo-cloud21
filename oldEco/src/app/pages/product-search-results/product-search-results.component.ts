// product-search-results.component.ts
import { Component, HostListener, OnInit, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { SearchService } from '../../services/searchService/search.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

// Custom pipe for grouping
import { Pipe, PipeTransform } from '@angular/core';
import { Invoice } from 'src/app/models/invoice-model';
import { CartService } from '../../services/cartServices/cart.service';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { Location } from '@angular/common';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { PageData } from 'src/app/models/page-data/pageData';
import { Company } from 'src/app/models/company.model';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { PaginationComponent } from 'src/app/components/pagination-component/pagination-component.component';
import { ProductGridComponent } from 'src/app/components/product/product-grid/product-grid.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Pipe({
  name: 'groupBy'
})
export class GroupByPipe implements PipeTransform {
  transform(collection: any[], property: string, value: any): any[] {
    if (!collection) {
      return [];
    }
    return collection.filter(item => item[property] === value);
  }
}

@Component({
  selector: 'app-product-search-results',
  templateUrl: './product-search-results.component.html',
  styleUrls: ['./product-search-results.component.css'],
  imports: [ProductGridComponent, GroupByPipe, PaginationComponent, RouterModule, TranslateModule]
})
export class ProductSearchResultsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  products: any[] = [];
  types: any[] = []
  query: string = '';
  clean: boolean = true;

  totalProducts: number = 0;
  pageCount: number = 0;
  startIndex: number = 0;
  lastIndex: number = 0;

  invoiceData!: Invoice;

  loading = true;

  items: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  canGoBack: boolean = false;
  pageData: PageData | any = new PageData();
  companyData: Company = new Company();

  constructor(
    private searchService: SearchService,
    private router: Router,
    private cartService: CartService,
    private route: ActivatedRoute,
    private companyService: CompanyServices,
    private pageBuilderServices: PageBuilderService,
    public appService: AppServices,
    private location: Location,
  ) {
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    this.getCompanyData();
    await this.getPageData();
    this.searchService.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      this.query = query
    });

    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: any) => {
        if (invoiceData) this.invoiceData = invoiceData;
      },
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params: Record<string, any>) => {
      const page = +params['page'] || 1; // Get page from query params
      this.query = params['searchTerm']; // Get searchTerm from query params
      if (this.query) {
        this.onPageChange(page)
      }

    });
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('checkout');
    if (data) {
      this.pageData = data;
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }

  onPageChange(
    page: number,
  ): void {
    this.clean = false;
    this.loading = true;
    this.filterProducts(this.query, page)

  }

  prevQuery = ''

  filterProducts(query: string, page: number): void {
    let branchId = this.invoiceData.branchId
    if (this.prevQuery == this.query && page == 1) {
      this.loading = false
      return
    }
    this.searchService.searchProducts({ searchTerm: query, page, limit: null, branchId, sessionId: this.invoiceData.onlineData.sessionId }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any[]) => {
        this.prevQuery = this.query
        if (data[0] && data[0].length > 0) {
          data[0].forEach((element: any) => {
            element.edited = true;
            if (element.mediaUrl?.defaultUrl) {
              element.mediaUrl = element.mediaUrl?.defaultUrl;
            }
            if (element.type == "menuItem" || element.type == "service" || element.type == "menuSelection" || element.type == "tailoring") {
              element.quantity = null;
            } else {
              if (branchId || element.quantity === 'undefined') {
                element.quantity = 0;
                if (element.branches) {
                  element.quantity = element.branches[0]?.onHand || 0;
                }
              } else {
                if (element.branches) {
                  element.quantity = Math.max(...element.branches.map((branch: any) => branch.onHand)) || 0;
                }
              }
            }
            let tempPrice = 0;
            if (branchId) {
              if (element.branches.length > 0) {

                tempPrice = element.price ? element.price:  element.branches[0].price ? element.branches[0].price : element.defaultPrice || 0;
              } else {
                tempPrice = element.price ? element.price: element.defaultPrice;
              }
            } else {
              tempPrice = element.price ? element.price: element.defaultPrice;
            }
            element.price = tempPrice;
          });
        }
        this.loading = false;

        this.searchService.setSearchResults(data)
        this.products = data[0] ?? [];
        this.totalProducts = data[1];
        this.pageCount = data[2];
        this.startIndex = data[3]
        this.lastIndex = data[4]
        this.types = data[5]

      },
      error: (err: any) => {
        this.logger.error(err?.message, { stack: err?.stack, context: 'ProductSearchResultsComponent.search' });
      }
    });
  }

  isMobile(): boolean {
    return window.innerWidth < 991; // Adjust the width threshold as needed
  }

  goBack() {
    if (this.canGoBack) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}