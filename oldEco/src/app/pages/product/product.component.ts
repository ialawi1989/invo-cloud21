import { Component, Input, Inject, PLATFORM_ID, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../../models/product.model';
import { ShopService } from '../../services/shopServices/shop.service';
import { ActivatedRoute } from '@angular/router';
import { Invoice } from 'src/app/models/invoice-model';
import { CartService } from '../../services/cartServices/cart.service';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { OwlOptions } from 'ngx-owl-carousel-o';
import { PageData } from 'src/app/models/page-data/pageData';
import { catchError, of } from 'rxjs';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrl: './product.component.css',
  standalone: false,
})
export class ProductComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  loading: boolean = true;
  alternativeProducts: Product[] = [];
  invoiceData!: Invoice;
  productId: any = "";
  scrollTop = 0;
  @Input({ required: true }) product!: Product;

  pageData: PageData | any = new PageData();

  customOptions: OwlOptions = {
    loop: false,
    autoWidth: false,
    dots: true,
    rewind: true,
    navSpeed: 700,
    navText: [],
    nav: false,
    margin: 20,
    autoHeight: false,
    responsive: {
      0: { items: 2 },
      400: { items: 3 },
      740: { items: 4 },
      940: { items: 5 }
    },
  };

  constructor(
    private shopService: ShopService,
    private route: ActivatedRoute,
    private pageBuilderServices: PageBuilderService,
    private cartService: CartService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  get useCarousel(): boolean {
    return this.alternativeProducts?.length > 3;
  }

  async ngOnInit() {
    await this.getPageData();

    if (isPlatformBrowser(this.platformId)) {
      this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: any) => {
        if (invoiceData) this.invoiceData = invoiceData;
      },
    });
    }

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(async () => {
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          window.scrollTo({ top: 0 });
        }, 250);
      }

      this.productId = this.route.snapshot.paramMap.get('id');
      await this.loadAlternativeProducts(this.productId!.toString(), this.invoiceData.branchId);
      this.loading = false;
    });
  }

  loadAlternativeProducts(productId: string, branchId?: string) {
    return new Promise(response => {
      if (isPlatformBrowser(this.platformId)) {
        this.shopService.getAlternativeProductsList({ productId, branchId, sessionId: this.invoiceData.onlineData.sessionId }).pipe(
          catchError((error: any) => {
            this.logger.error(error?.message, { stack: error?.stack, context: 'ProductComponent.getAlternativeProductsList' });
            return of([]);
          })
        ).pipe(takeUntil(this.destroy$)).subscribe({
          next: (data: Product[]) => {
            this.processAlternativeProducts(data, branchId);
            response(true);
          },
          error: (err: any) => {
            this.logger.error(err?.message, { stack: err?.stack, context: 'ProductComponent.fetchData' });
            response(true);
          },
        });
      } else {
        this.alternativeProducts = [];
        response(true);
      }
    });
  }

  private processAlternativeProducts(data: Product[], branchId?: string) {
    if (data) {
      this.alternativeProducts = [];
      if (data && data.length > 0) {
        data.forEach((element: any) => {
          element.edited = true;
          if (
            element.type == "menuItem" ||
            element.type == "service" ||
            element.type == "menuSelection" ||
            element.type == "tailoring"
          ) {
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
            if (element.branches) {
              tempPrice = element.price ? element.price : element.branches[0]?.price ? element.branches[0]?.price : element.defaultPrice || 0;
            } else {
              tempPrice = element.price ? element.price : element.defaultPrice;
            }
          } else {
            tempPrice = element.price ? element.price : element.defaultPrice;
          }
          element.price = tempPrice;
          this.alternativeProducts.push(element);
        });
      }
    }
  }

  async getPageData() {
    let data = await this.pageBuilderServices.getPage('product');
    if (data) {
      this.pageData = data;
    } else {
      this.pageData = new PageData();
    }
  }

  getHeaderBackground(subheader_settings: any) {
    if (subheader_settings) {
      if (subheader_settings.style == 'Color' && subheader_settings.defaultColor) {
        return subheader_settings.defaultColor || "gray";
      } else if (subheader_settings.style == 'Pattern' && subheader_settings.defaultPattern) {
        return `url(assets/images/page-builder/patterns/${subheader_settings.defaultPattern}.png)`;
      } else if (subheader_settings.style == 'Image' && subheader_settings.defaultImage?.defaultUrl) {
        return `url(${subheader_settings.defaultImage.defaultUrl})`;
      }
      return "gray";
    } else {
      return "gray";
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}