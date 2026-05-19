import { Component, inject, OnDestroy} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Category } from 'src/app/models/category.model';
import { PageData } from 'src/app/models/page-data/pageData';
import { Invoice } from 'src/app/models/invoice-model';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { ShopService } from 'src/app/services/shopServices/shop.service';
import { Location } from '@angular/common';
import { AppServices } from 'src/app/services/appServices';
import { Company } from 'src/app/models/company.model';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-categories',
  imports: [
    RouterLink,
    TranslateModule
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css'
})
export class CategoriesComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);

  categories: Category[] = [];
  loading: boolean = true;
  invoiceData!: Invoice;
  pageData: PageData | any = new PageData();
  canGoBack: boolean = false;
  companyData: Company = new Company();

  constructor(
    private cartService: CartService,
    private shopService: ShopService,
    private companyService: CompanyServices,
    private pageBuilderServices: PageBuilderService,
    private location: Location,
    public appService: AppServices,
    private router: Router,
  ) {
    this.canGoBack = !!this.router.getCurrentNavigation()?.previousNavigation;
  }

  async ngOnInit() {
    this.getCompanyData();
    await this.getPageData();
    //console.log("!!!ngOnInit");
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: any) => {
        if (invoiceData) this.invoiceData = invoiceData;
      },
    });
    let branchId = this.invoiceData.branchId;
    this.loadCompanyCategories(branchId)
  }

  loadCompanyCategories(branchId?: string) {
    //console.log("!!!! loadCompanyCategories")
    this.shopService.getCompanyCategories(branchId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        //console.log("!!!! loadCompanyCategories > data", data);
        this.categories = data
      },
      error: this.handleError.bind(this),
    });
  }

  handleError(err: any) {
    this.logger.error(err?.message, { stack: err?.stack, context: 'CategoriesComponent.loadCompanyCategories' });
    this.loading = false;
  }

  goToCategory(departmentId: string, categoryId?: string,) {
    this.router.navigate(['/shop'], { queryParams: { page: 1, categoryId, departmentId } });
    window.scrollTo({ top: 0 });
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }
  
  async getPageData() {
    let data = await this.pageBuilderServices.getPage('categories');

    if (data) {
      this.pageData = data;
    }
  }

  getHeaderBackground(subheader_settings: any) {
    if (subheader_settings) {
      if (subheader_settings.style == 'Color' && subheader_settings.defaultColor) {
        return subheader_settings.defaultColor || "gray";
      }
      else
        if (subheader_settings.style == 'Pattern' && subheader_settings.defaultPattern) {
          return `url(assets/images/page-builder/patterns/ ${subheader_settings.defaultPattern} .png)`;
        }
        else
          if (subheader_settings.style == 'Image' && subheader_settings.defaultImage && subheader_settings.defaultImage.defaultUrl) {
            return `url( ${subheader_settings.defaultImage.defaultUrl})`;
          }
      return "gray";
    } else {
      return "gray";
    }
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
