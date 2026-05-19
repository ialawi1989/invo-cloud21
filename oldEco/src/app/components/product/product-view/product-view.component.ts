import { Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, HostListener, Inject, Injectable, Input, Output, PLATFORM_ID, ViewChild, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { Product } from '../../../models/product.model';
import { FormsModule } from '@angular/forms';
import { OptionGroupsSelectorComponent } from "./option-groups-selector/option-groups-selector.component";
import { SelectionsSelectorComponent } from "./selections-selector/selections-selector.component";
import { CartService } from '../../../services/cartServices/cart.service';
import { Location, isPlatformBrowser } from '@angular/common';
import { CompanyServices } from '../../../services/companyServices/company.service';
import { CurrencyService } from '../../../services/currencyService/currency.service';
import { ShopService } from '../../../services/shopServices/shop.service';
import { PackageSelectorComponent } from "./package-selector/package-selector.component";
import { CommonModule } from '@angular/common';
import { TaxData } from '../../../models/taxData.model';
import { Company } from '../../../models/company.model';
import { AlertService } from '../../../services/alertService/alert.service';
import { Invoice } from '../../../models/invoice-model';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingService } from '../../../services/loadingService/loading.service';
import { CarouselModule, OwlOptions } from 'ngx-owl-carousel-o';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import 'photoswipe/style.css';
import { Meta } from '@angular/platform-browser';
import { MeasurementsOptionsComponent } from "./measurements-options/measurements-options.component";
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';
import { MenuService } from 'src/app/services/menuServices/menu.service';
import { Category } from 'src/app/models/category.model';
import { MenuSection } from 'src/app/models/menu-section.model';
import { PageData } from 'src/app/models/page-data/pageData';
import { MatrixOptionsComponent } from "./matrix-options/matrix-options.component";
import { DefaultOptionsComponent } from './default-options/default-options.component';
import { ProductUtilityService } from '../../../services/productUtilityService/product-utility.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';


@Component({
  selector: 'app-product-view',
  imports: [
    CommonModule,
    FormsModule,
    OptionGroupsSelectorComponent,
    SelectionsSelectorComponent,
    PackageSelectorComponent,
    CarouselModule,
    TranslateModule,
    MeasurementsOptionsComponent,
    MatrixOptionsComponent,
    DefaultOptionsComponent
  ],
  templateUrl: './product-view.component.html',
  styleUrl: './product-view.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})

export class ProductViewComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  @Input() productId: any;
  @Input() pageData: PageData | any = new PageData();
  @Output() close = new EventEmitter<void>();

  @ViewChild('carousel') carousel: any;
  @ViewChild('thumbnailCarousel') thumbnailCarousel: any;
  @ViewChild('mobileThumbnailCarousel') mobileThumbnailCarousel: any;
  noback = false;

  mainImageOptions: OwlOptions = {
    loop: false,
    autoWidth: false,
    dots: false,
    nav: false,
    rewind: true,
    navSpeed: 300,
    smartSpeed: 300,
    slideBy: 1,
    autoHeight: false,
    mouseDrag: true,
    touchDrag: true,
    pullDrag: false,
    freeDrag: false,
    margin: 0,
    stagePadding: 0,
    responsive: {
      0: { items: 1 },
      400: { items: 1 },
      740: { items: 1 },
      940: { items: 1 }
    }
  };

  thumbnailOptionsDesktop: OwlOptions = {
    loop: false,
    autoWidth: false,
    dots: false,
    nav: true,
    rewind: false,
    navSpeed: 300,
    smartSpeed: 300,
    slideBy: 1,
    autoHeight: false,
    mouseDrag: true,
    touchDrag: true,
    pullDrag: false,
    freeDrag: false,
    margin: 0,
    stagePadding: 0,
    merge: false,
    mergeFit: true,
    startPosition: 0,
    rtl: false,
    center: false,
    items: 4,
    navText: ['', ''],
    responsive: {
      0: { items: 4 },
      400: { items: 4 },
      740: { items: 4 },
      940: { items: 4 }
    }
  };

  thumbnailOptionsMobile: OwlOptions = {
    loop: false,
    autoWidth: false,
    dots: false,
    nav: false,
    rewind: false,
    navSpeed: 300,
    smartSpeed: 300,
    slideBy: 1,
    autoHeight: false,
    mouseDrag: true,
    touchDrag: true,
    pullDrag: false,
    freeDrag: false,
    margin: 0,
    stagePadding: 0,
    merge: false,
    mergeFit: true,
    startPosition: 0,
    rtl: false,
    center: false,
    navText: ['', ''],
    responsive: {
      0: { items: 4, margin: 0 },
      400: { items: 4, margin: 0 },
      600: { items: 6, margin: 0 }
    }
  };

  slug: string = '';
  type: string = '';
  sectionId?: string;
  showArrows = false;

  isTransitioning: boolean = false;
  slideDirection: 'left' | 'right' | '' = '';

  selectedImageIndex: number = 0;
  zoomedIndex: number = -1;
  transformOrigin: string = 'center center';
  currentThumbPage: number = 0;
  maxVisibleThumbs: number = 4;

  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private minSwipeDistance: number = 50;

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
      0: { items: 1 },
      400: { items: 1 },
      740: { items: 1 },
      940: { items: 1 }
    },
  };

  customOptions2: OwlOptions = {
    loop: false,
    autoWidth: false,
    dots: false,
    rewind: true,
    navSpeed: 700,
    navText: [],
    nav: false,
    margin: 20,
    autoHeight: false,
    responsive: {
      0: { items: 1 },
      400: { items: 2 },
      740: { items: 4 },
      940: { items: 4 }
    },
  };

  loading: boolean = true;
  isProductReady: boolean = false;
  productNotFound: boolean = false;
  product: Product | any = new Product;
  qty: number = 1;
  note: string = "";
  selectedTab: string = "description";
  productOptionsTab: string = "default";

  chosenOptions: any = {};
  slideImages: any = [];

  companyData: Company = new Company();
  invoiceData!: Invoice;

  currentUrl = this.location.path();
  viewOnly = false;
  headerTitle = "Product Details";
  canGoBack: any = true;

  isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    public productUtilityService: ProductUtilityService,
    protected cartService: CartService,
    protected companyService: CompanyServices,
    private shopService: ShopService,
    private router: Router,
    public alertService: AlertService,
    private loadingService: LoadingService,
    private location: Location,
    public appService: AppServices,
    private meta: Meta,
    private pageBuilderServices: PageBuilderService,
    private route: ActivatedRoute,
    private menuService: MenuService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.initlizer();
  }

  get currentCurrency() {
    return this.productUtilityService.currentCurrency;
  }

  get selectedProduct() {
    return this.productUtilityService.selectedProduct;
  }

  addItemToCart(param: any): Promise<Invoice | null> {
    return this.productUtilityService.addItemToCart(param);
  }

  isInWishList(productId: string): boolean {
    return this.productUtilityService.isInWishList(productId);
  }

  addItemToWishlist(product: Product): void {
    this.productUtilityService.addItemToWishlist(product);
  }

  isMobile(): boolean {
    return this.productUtilityService.isMobile();
  }

  ngOnInit(): void {
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    this.resetProductOptions();
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: any) {
    this.resetProductOptions();
  }

  async ngOnChanges() {
    if (typeof window !== 'undefined') {
      await import('@google/model-viewer');
    }
    this.loading = true;
    this.isProductReady = false;
    this.productOptionsTab = "default";
    // this.loadingService.showLoadingSpinner();
    this.loadData();
  }

  page: string = "";
  departments: Category[] = [];
  department?: Category;
  categoryName?: string;

  handleError(err: any) {
    this.logger.error(err?.message, { stack: err?.stack, context: 'ProductViewComponent.fetchData' });
  }

  loadCompanyCategories(branchId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.shopService.getCompanyCategories(branchId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          this.departments = data;
          resolve();
        },
        error: (err) => {
          this.handleError(err);
          reject(err);
        },
      });
    });
  }

  onMouseMove(event: MouseEvent, index: number): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.transformOrigin = `${x}% ${y}%`;
    this.zoomedIndex = index;
  }

  onMouseLeave(index: number): void {
    if (this.zoomedIndex === index) {
      this.zoomedIndex = -1;
    }
  }

  backToListQueryParams: any = {};
  backToDepartment: any = {};

  async initlizer() {
    const urlSegments = this.router.url.split('/');
    const currentPage = urlSegments[1];
    const id = urlSegments[2];

    this.getCartInvoiceData();
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(async params => {
      if (params.get('noback')) {
        this.noback = true;
      } else {
        this.noback = false;
      }
      const menuStyle = params.get('style');
      if (currentPage.includes("menu")) {
        try {
          this.sectionId = id;
        } catch (error) { }
      }

      const departmentId = params.get('departmentId');
      const categoryId = params.get('categoryId');

      if (currentPage.includes("shop")) {
        await this.loadCompanyCategories(this.invoiceData.branchId);
        this.department = this.departments.filter((department) => departmentId == department.id)[0];
        if (categoryId) {
          this.categoryName = this.department?.categories.filter(category => category.id == categoryId)[0].name;
        }
      }

      if (currentPage.includes("wishlist")) {
        this.page = "wishlist";
      } else if (currentPage.includes("cart")) {
        this.page = "cart";
      } else if (currentPage.includes("collections")) {
        this.page = "collections";
      } else if (currentPage.includes("shop")) {
        if (departmentId) {
          this.backToDepartment.departmentId = departmentId;
          this.backToListQueryParams.departmentId = departmentId;
        }
        if (categoryId) {
          this.backToListQueryParams.categoryId = categoryId;
        }
        this.page = "shop";
      } else if (id && !menuStyle) {
        this.page = "menu";
      } else {
        this.backToListQueryParams = {};
        this.backToListQueryParams.section_id = id;
        this.page = "shop";
      }
    });
  }

  async loadData() {
    this.getCompanyData();
    this.viewOnly = this.companyData.oldThemeSettings.viewOnly;

    let branchId = this.invoiceData.branchId;
    if (this.productId) {
      const loaded = await this.getProduct(this.productId!.toString(), branchId, this.invoiceData.onlineData.sessionId);

      // FIX: If the API returned no product (null/404/error), show not-found state
      // instead of leaving the page blank with no feedback to the user.
      if (!loaded || !this.product?.id) {
        this.productNotFound = true;
        this.loading = false;
        // this.loadingService.hideLoadingSpinner();
        return;
      }

      this.product.slideImages = [];
      let images = (this.product.medias || []).filter((f: any) => !f['3dUrl']);
      let threeDImage = this.product.threeDModelUrl;
      if (threeDImage) {
        this.product.file3dUrl = threeDImage;
        if (this.product.file3dUrl) {
          this.product.file3dType = this.getFileType(this.product.file3dUrl);
        }
      }

      if (images?.length > 0) {
        for (let i = 0; i < images.length; i++) {
          this.product.slideImages.push({
            id: i + 1,
            src: this.product.medias[i].defaultUrl,
            w: 1200,
            h: 800,
            thumb: this.product.medias[i].defaultUrl
          });
        }
      } else {
        this.product.slideImages.push({
          id: 0,
          src: this.product.mediaUrl,
          w: 1200,
          h: 800,
          thumb: this.product.mediaUrl
        });
      }

      // ─── Auto Add-to-Cart via query param ───────────────────────────────────
      // Triggered when URL contains ?addToCart=true
      // Only proceeds if the product has NO required options that need user input
      this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(async (params) => {
        const autoAdd = params.get('addToCart');
        if (autoAdd === 'true') {
          await this.handleAutoAddToCart();
        }
      });
      // ────────────────────────────────────────────────────────────────────────
    }

    this.loading = false;
    // Defer enabling the Add-to-Cart button by one change-detection cycle.
    // This guarantees child option components have rendered and the product
    // state maps are fully populated before the button becomes clickable.
    setTimeout(() => { this.isProductReady = true; }, 0);
    // this.loadingService.hideLoadingSpinner();
  }

  /**
   * Checks whether the product can be added to cart without any user interaction.
   * Returns true only if there are no required options, selections, packages,
   * measurements, or matrix variants that must be chosen by the user.
   */
  private productRequiresUserInput(): boolean {
    // Has required option groups (minSelectable > 0)
    if (this.product.optionGroups?.length > 0) {
      const hasRequired = this.product.optionGroups.some(
        (group: any) => group.minSelectable > 0
      );
      if (hasRequired) return true;
    }

    // Has menu selections (always require user to pick items)
    if (this.product.selection?.length > 0) return true;
    if (this.product.fixedSelection?.length > 0) return true;

    // Has package (always require user to pick items)
    if (this.product.package?.length > 0) return true;
    if (this.product.fixedPackage?.length > 0) return true;

    // Has tailoring measurements (all fields are required)
    if (this.product.type === 'tailoring' && this.product.measurements) return true;

    // Has matrix/variant dimensions (user must pick a variant)
    if (this.product.dimensions?.length > 0) return true;

    return false;
  }

  /**
   * Handles the ?addToCart=true query param.
   * If the product is a simple item with no required inputs, it is added
   * to the cart automatically and the user is redirected to checkout.
   * Otherwise, the param is silently ignored and the product page is shown normally.
   */
  private async handleAutoAddToCart(): Promise<void> {
    // Wait until product data is fully loaded
    if (!this.product || !this.product.id) return;

    // If the product needs user interaction, just show the page normally
    if (this.productRequiresUserInput()) {
      return;
    }

    // Also block if product is out of stock
    if (this.product.quantity !== null && this.product.quantity <= 0) {
      this.alertService.showAlert({ title: 'This item is currently out of stock.' });
      return;
    }

    try {
      const data = await this.addItemToCart({
        productId: this.product.id,
        qty: 1,
        options: [],
        selectedItems: [],
        note: '',
        measurements: {},
        showCart: false   // suppress the cart dropdown; we navigate to checkout instead
      });

      if (!data) {
        this.alertService.showAlert({ title: 'Could not add item to cart. Please try again.' });
        return;
      }

      // Show success alert then navigate to checkout
      this.alertService.showAlert({ title: 'Item added to your cart!' });

      // Small delay so the alert is visible before navigation
      setTimeout(() => {
        this.router.navigate(['/cart']);
      }, 800);

    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'ProductViewComponent.autoAddToCart' });
      this.alertService.showAlert({ title: 'An error occurred while adding the item.' });
    }
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }

  getCartInvoiceData() {
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) {
          this.invoiceData = invoiceData;
        }
      },
    });
  }

  getProduct(productId: string, branchId?: string, sessionId?: string) {
    return new Promise(response => {
      this.shopService.getProductData({ productId, branchId, sessionId }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Product | any) => {
          if (data) {
            if (data.type == "menuItem" || data.type == "service" || data.type == "menuSelection" || data.type == "tailoring") {
              data.quantity = null;
            } else {
              if (branchId || data.quantity === 'undefined') {
                data.quantity = 0;
                if (data.branchProduct) {
                  data.quantity = data.branchProduct[0]?.onHand || 0;
                }
              } else {
                if (data.branchProduct) {
                  data.quantity = Math.max(...data.branchProduct?.map((branch: any) => branch.onHand)) || 0;
                }
              }
            }

            let tempPrice = 0;
            if (branchId) {
              tempPrice = data.price ? data.price : data.branchProduct[0]?.price ? data.branchProduct[0]?.price : data.defaultPrice || 0;
            } else {
              tempPrice = data.price ? data.price : data.defaultPrice;
            }
            data.price = tempPrice;

            if (data.optionGroups?.length) {
              data.optionGroups?.forEach((group: any) => {
                if (group.options?.length) {
                  group.options = group.options?.sort((a: any, b: any) => a.index - b.index) || [];
                }
              });
            }

            if (data.measurements) {
              data.measurementsArray = Object.keys(data.measurements)
                .filter(key => data.measurements[key])
                .map(key => ({
                  key: key,
                  value: null,
                  type: 'cm'
                }));
            }

            if (data.defaultOptions) {
              data.defaultOptions.forEach((option: any) => {
                option.tempQty = option.qty || 0;
              });
            }

            if (data.package && data.package.length > 0) {
              data.package.forEach((pkg: any) => {
                if (pkg.defaultOptions && pkg.defaultOptions.length > 0) {
                  pkg.defaultOptions.forEach((option: any) => {
                    option.tempQty = option.qty || 0;
                  });
                }

                if (pkg.packageGroups && pkg.packageGroups.length > 0) {
                  pkg.packageGroups.forEach((packageGroup: any) => {
                    if (packageGroup.defaultOptions && packageGroup.defaultOptions.length > 0) {
                      packageGroup.defaultOptions.forEach((option: any) => {
                        option.tempQty = option.qty || 0;
                      });
                    }
                  });
                }
              });
            }

            if (
              !(data.optionGroups?.length > 0) &&
              !(data.selection?.length > 0) &&
              !(data.package?.length > 0) &&
              (data.type == 'tailoring')
            ) {
              this.productOptionsTab = "measurements";
            }

            this.product = data;
            // Ensure selection-state maps are always initialized so validators
            // never operate on undefined and the button stays disabled until
            // the user actually makes their required choices.
            if (!this.product.selectedMenuSelectionOptions) {
              this.product.selectedMenuSelectionOptions = {};
            }
            if (!this.product.selectedPackageOptions) {
              this.product.selectedPackageOptions = {};
            }
            response(true);
          } else {
            // FIX: Product was null/not found — resolve false so loadData can show not-found UI
            response(false);
          }
        },
        error: (err: any) => {
          this.logger.error(err?.message, { stack: err?.stack, context: 'ProductViewComponent.fetchProduct' });
          // FIX: Resolve false on error so loadData can show not-found UI instead of blank page
          response(false);
        },
      });
    });
  }

  selectTap(value: string) {
    this.selectedTab = value;
  }

  changeQty(qty: number) {
    if (qty >= 1) {
      this.qty = qty;
    }
  }

  selectTab(value: string) {
    this.selectedTab = value;
  }

  increaseQty() {
    if (this.product.selectedVariant) {
      if (this.qty >= this.product.selectedVariant?.inventory?.onHand && this.product.selectedVariant?.inventory?.onHand) {
        this.qty = this.product.selectedVariant?.inventory?.onHand;
        return;
      }
    }
    this.qty++;
  }

  decreaseQty() {
    if (this.qty > 1) {
      this.qty--;
    }
  }

  shareTo(value: string, product: Product) {
    const url = new URL(window.location.href);
    url.searchParams.set('noback', 'true');
    const shareData = {
      title: product.name,
      url: url.toString()
    };
    const message = `Check out this product: ${shareData.title}. Visit the link: ${shareData.url}`;
    switch (value) {
      case 'whatsapp':
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank');
        break;
      default:
        this.logger.error('Unsupported share option', { context: 'ProductViewComponent.share' });
    }
  }

  isValidAddButton() {
    // Block until product data AND child components are fully ready
    if (this.loading || !this.isProductReady || !this.product?.id) {
      return false;
    }

    // selections-selector and package-selector build fixedSelection / fixedPackage
    // inside a setTimeout(1000ms). Until that fires, the arrays don't exist and
    // validation would vacuously pass — so keep the button disabled until they're ready.
    if (this.product.selection?.length > 0 && !this.product.fixedSelection?.length) {
      return false;
    }
    if (this.product.package?.length > 0 && !this.product.fixedPackage?.length) {
      return false;
    }

    if (this.isValidProductOptions() && this.isValidMeasurements() && this.isValidMatrixOptions()) {
      return true;
    } else {
      return false;
    }
  }

  isValidProductOptions() {
    let isValid = true;
    isValid = this.validateOptionGroups(this.product.optionGroups);
    if (this.product.fixedSelection?.length) {
      this.product.fixedSelection?.forEach((select: any) => {
        select.selectionGroups?.forEach((selectionGroup: any, selectionGroupIndex: any) => {
          if (!this.isMenuSelectionSelected(select.name, selectionGroupIndex)) {
            isValid = false;
          }
          if (!this.isMenuSelectionItemsValid(select.name, selectionGroupIndex, selectionGroup.items)) {
            isValid = false;
          }
        });
      });
    }
    if (this.product.fixedPackage?.length) {
      this.product.fixedPackage?.forEach((packge: any) => {
        packge.packageGroups.forEach((packageGroup: any, packageGroupIndex: any) => {
          if (!this.isPackageItemsValid(packge.name, packageGroupIndex, packge.packageGroups)) {
            isValid = false;
          }
        });
      });
    }
    return isValid;
  }

  isValidMeasurements() {
    let isValid = true;
    if (this.product.type == "tailoring" && this.product.measurementsArray) {
      this.product.measurementsArray.forEach((m: any) => {
        if (!m.value) {
          isValid = false;
        }
      });
    }
    return isValid;
  }

  isValidMatrixOptions() {
    let isValid = true;
    if (this.product.dimensions?.length > 0 && !this.product.selectedVariant) {
      isValid = false;
    }
    return isValid;
  }

  validateOptionGroups(optionGroups: any) {
    let isValid = true;
    if (optionGroups?.length > 0) {
      optionGroups.forEach((group: any) => {
        if (group.minSelectable > 0) {
          let totalSelected = group.options.filter((f: any) => f.isSelected).length;
          if (totalSelected < Math.min(group.minSelectable, group.options?.length) || totalSelected > group.maxSelectable) {
            isValid = false;
          }
        }
      });
    }
    return isValid;
  }

  isMenuSelectionSelected(selectName: any, selectionGroupIndex: any) {
    return this.organizeSelectedMenuSelectionData(this.product.selectedMenuSelectionOptions)?.some((selectionData: any) => {
      if (selectionData.selectName === selectName) {
        return selectionData.selectionGroups?.some((selectionGroupData: any) => {
          return selectionGroupData.selectionGroupName === selectionGroupIndex && selectionGroupData.productId;
        });
      }
      return false;
    }) || false;
  }

  isMenuSelectionItemsValid(select: any, selectionGroupIndex: any, items: any) {
    let isValid = true;
    items?.forEach((item: any) => {
      const selectionData = this.organizeSelectedMenuSelectionData(this.product.selectedMenuSelectionOptions)?.find((selectData: any) =>
        selectData.selectName === select &&
        selectData.selectionGroups.some((selectGroup: any) =>
          selectGroup.productId === item.productId &&
          selectGroup.selectionGroupName === selectionGroupIndex
        )
      );
      if (selectionData) {
        const selectionGroup = selectionData.selectionGroups.find((selectGroup: any) =>
          selectGroup.productId === item.productId &&
          selectGroup.selectionGroupName === selectionGroupIndex
        );
        item.optionGroups?.forEach((optionGroup: any) => {
          if (optionGroup.minSelectable > 0) {
            const correspondingOptionGroup = selectionGroup.optionGroups?.find((group: any) => group.optionGroupId === optionGroup.optionGroupId);
            if (correspondingOptionGroup) {
              if (Math.min(optionGroup.minSelectable, selectionGroup.optionGroups?.length) > correspondingOptionGroup.options?.length) {
                isValid = false;
              }
            } else {
              isValid = false;
            }
          }
        });
      }
    });
    return isValid;
  }

  isPackageItemsValid(packge: any, packageGroupIndex: any, items: any) {
    let isValid = true;
    items?.forEach((item: any) => {
      item.optionGroups?.forEach((optionGroup: any) => {
        if (optionGroup.minSelectable > 0) {
          const packageData = this.organizeSelectedPackageData(this.product.selectedPackageOptions)?.find((packageData: any) =>
            packageData.packageName === packge &&
            packageData.packageGroups.some((packageGroup: any) =>
              packageGroup.productId === item.productId &&
              packageGroup.packageGroupName === packageGroupIndex
            )
          );
          if (packageData) {
            const packageGroup = packageData.packageGroups?.find((packageGroup: any) =>
              packageGroup.productId === item.productId &&
              packageGroup.packageGroupName === packageGroupIndex
            );
            if (packageGroup) {
              const correspondingOptionGroup = packageGroup.optionGroups?.find((group: any) => group.optionGroupId === optionGroup.optionGroupId);
              if (correspondingOptionGroup) {
                if (Math.min(optionGroup.minSelectable, packageGroup.optionGroups?.length) > (correspondingOptionGroup.options?.length || 0)) {
                  isValid = false;
                }
              } else {
                isValid = false;
              }
            } else {
              isValid = false;
            }
          } else {
            isValid = false;
          }
        }
      });
    });
    return isValid;
  }

  organizeSelectedPackageData(data: any) {
    let tempData: any = [];
    Object.keys(data).forEach(key => {
      if (data[key] === true) {
        tempData.push(key);
      } else {
        tempData.push(data[key]);
      }
    });

    const result = tempData.reduce((acc: any, queryString: any) => {
      const params: any = new URLSearchParams(queryString);
      const packageName = params.get('packageName');
      const packageGroup = parseInt(params.get('packageGroup'));
      const productId = params.get('productId');
      const optionPrice = params.get('optionPrice');
      let optionGroupId = params.get('optionGroupId');
      let optionId = params.get('optionId');

      let packageNameData = acc.find((item: any) => item.packageName === packageName);
      if (!packageNameData) {
        packageNameData = { packageName: packageName, packageGroups: [] };
        acc.push(packageNameData);
      }

      let packageGroupData = packageNameData.packageGroups.find((item: any) => item.packageGroupName === packageGroup);
      if (!packageGroupData) {
        packageGroupData = { packageGroupName: packageGroup, productId: productId, optionGroups: [] };
        packageNameData.packageGroups.push(packageGroupData);
      }

      if (optionGroupId) {
        let optionGroupData = packageGroupData.optionGroups.find((group: any) => group.optionGroupId === optionGroupId);
        if (!optionGroupData) {
          optionGroupData = { optionGroupId: optionGroupId, options: [] };
          packageGroupData.optionGroups.push(optionGroupData);
        }
        if (optionId) {
          optionGroupData.options.push({ optionGroupId, optionId, optionPrice, qty: 1 });
        }
      }

      return acc;
    }, []);

    return result;
  }

  organizeSelectedMenuSelectionData(data: any) {
    let tempData: any = [];
    Object.keys(data).forEach(key => {
      if (data[key] === true) {
        tempData.push(key);
      } else {
        tempData.push(data[key]);
      }
    });

    const result = tempData.reduce((acc: any, queryString: any) => {
      const params: any = new URLSearchParams(queryString);
      const selectName = params.get('selectName');
      const selectionGroup = parseInt(params.get('selectionGroup'));
      const productId = params.get('productId');
      const optionPrice = params.get('optionPrice');
      let optionGroupId = params.get('optionGroupId');
      let optionId = params.get('optionId');

      let selectNameData = acc.find((item: any) => item.selectName === selectName);
      if (!selectNameData) {
        selectNameData = { selectName: selectName, selectionGroups: [] };
        acc.push(selectNameData);
      }

      let selectionGroupData = selectNameData.selectionGroups.find((item: any) => item.selectionGroupName === selectionGroup);
      if (!selectionGroupData) {
        selectionGroupData = { selectionGroupName: selectionGroup, productId: productId, optionGroups: [] };
        selectNameData.selectionGroups.push(selectionGroupData);
      }

      if (optionGroupId) {
        let optionGroupData = selectionGroupData.optionGroups.find((group: any) => group.optionGroupId === optionGroupId);
        if (!optionGroupData) {
          optionGroupData = { optionGroupId: optionGroupId, options: [] };
          selectionGroupData.optionGroups.push(optionGroupData);
        }
        if (optionId) {
          optionGroupData.options.push({ optionGroupId, optionId, optionPrice, qty: 1 });
        }
      }

      return acc;
    }, []);

    return result;
  }

  showAddCartButton() {
    if (
      (this.product.type == 'package' && this.product.package) ||
      (this.product.type == 'menuSelection' && this.product.selection) ||
      (this.product.type == 'menuItem' && this.product.hasOptions == false) ||
      (this.product.type == "tailoring" && this.product.measurements) ||
      (this.product.quantity > 0 || this.product.quantity == null) &&
      !this.product.selection?.length
    ) {
      return true;
    } else {
      return false;
    }
  }

  calculateTotalPrice() {
    let total = 0;
    let discount = 0;

    if (this.product.type == 'menuSelection' || this.product.type == 'package') {
      if (this.product.priceModel.model == "fixedPrice") {
        total = this.product.price;
      } else if (this.product.priceModel.model == "fixedPriceWOption") {
        total = this.product.price
          + this.calculateProductOptionsPrice()
          + this.calculateDefaultOptionsPrice()
          + this.calculateMenuSelectionOptions2Price()
          + this.calculateMenuSelectionDefaultOptionsPrice()
          + this.calculatePackageOptionsPrice();
        + this.calculatePackageDefaultOptionsPrice();
      } else if (this.product.priceModel.model == "totalPrice") {
        total = this.calculateMenuSelectionOptions1Price()
          + this.calculateMenuSelectionOptions2Price()
          + this.calculateMenuSelectionDefaultOptionsPrice()
          + this.calculatePackageOptionsPrice()
          + this.calculatePackageDefaultOptionsPrice();
      } else if (this.product.priceModel.model == "totalPriceWithDiscount") {
        total = this.calculateMenuSelectionOptions1Price()
          + this.calculateMenuSelectionOptions2Price()
          + this.calculateMenuSelectionDefaultOptionsPrice()
          + this.calculatePackageOptionsPrice()
          + this.calculatePackageDefaultOptionsPrice()
          - this.calculateDiscountPrice();
      } else {
        total = this.product.price
          + this.calculateProductOptionsPrice()
          + this.calculateDefaultOptionsPrice()
          + this.calculatePackageOptionsPrice();
      }
    } else {
      total = this.product.price
        + this.calculateProductOptionsPrice()
        + this.calculateDefaultOptionsPrice();
    }

    discount = this.calculateProductDiscount(total);
    let totalWithOutDiscount = total > 0 ? total : 0;
    total = total - discount;

    if (total < 0) total = 0;

    if (!this.companyData.isInclusiveTax) {
      let taxTotal = this.calculateProductTax(total, this.product.productTaxes);
      let taxTotalWithOutDiscount = this.calculateProductTax(totalWithOutDiscount, this.product.productTaxes);
      let taxDiscount = this.calculateProductTax(discount, this.product.productTaxes);
      total += taxTotal;
      totalWithOutDiscount += taxTotalWithOutDiscount;
      discount += taxDiscount;
    }

    return {
      totalWithOutDiscount: totalWithOutDiscount,
      total: total,
      discount: discount + this.calculateDiscountPrice()
    };
  }

  calculateDiscountPrice() {
    return this.product.priceModel && this.product.priceModel.discount > 0 ? this.product.priceModel.discount : 0;
  }

  calculateProductTax(price: number, taxData: any) {
    let tax = new TaxData();
    const afterDecimal = this.currentCurrency.afterDecimal;
    const isInclusiveTax = this.companyData.isInclusiveTax;
    let taxTotal = 0;
    tax.ParseJson(taxData);
    if (tax.id != '' && tax.id != null) {
      if (tax.taxes != null && tax.taxes.length > 0 && JSON.stringify(tax.taxes) != '[]' && Array.isArray(tax.taxes)) {
      } else {
        taxTotal = isInclusiveTax ? +Number((price * tax.taxPercentage) / (100 + tax.taxPercentage)) : +Number((price) * (tax.taxPercentage / 100));
      }
    }
    return taxTotal;
  }

  calculateProductOptionsPrice() {
    let price = 0;
    if (this.product.optionGroups?.length) {
      this.product.optionGroups.forEach((group: any) => {
        group.options.forEach((option: any) => {
          if (option.isSelected) {
            price += option.optionPrice;
          }
        });
      });
    }
    return price;
  }

  calculateDefaultOptionsPrice() {
    let price = 0;
    if (this.product.defaultOptions?.length) {
      this.product.defaultOptions.forEach((option: any) => {
        if (option.optionPrice > 0 && option.tempQty > 0) {
          price += (option.optionPrice * option.tempQty);
        }
      });
    }
    return price;
  }

  calculateMenuSelectionOptions2Price() {
    let price = 0;
    let data = this.organizeSelectedMenuSelectionData(this.product.selectedMenuSelectionOptions);
    data?.forEach((element: any) => {
      element.selectionGroups?.forEach((selectionGroup: any) => {
        selectionGroup.optionGroups?.forEach((options: any) => {
          options.options?.forEach((option: any) => {
            price += Number(option.optionPrice);
          });
        });
      });
    });
    return price;
  }

  calculateMenuSelectionDefaultOptionsPrice() {
    let price = 0;
    if (this.product.fixedSelection?.length) {
      this.product.fixedSelection?.forEach((select: any) => {
        let selectionGroupIndex = 0;
        select.selectionGroups?.forEach((selectionGroup: any) => {
          selectionGroup.items?.forEach((item: any) => {
            if (this.isMenuSelectionOption1IsSelected(select, selectionGroupIndex, item)) {
              if (item.defaultOptions && item.defaultOptions.length > 0) {
                item.defaultOptions.forEach((option: any) => {
                  if (option.optionPrice > 0 && option.tempQty > 0) {
                    price += (option.optionPrice * option.tempQty);
                  }
                });
              }
            }
          });
          selectionGroupIndex++;
        });
      });
    }
    return price;
  }

  calculatePackageOptionsPrice() {
    let price = 0;
    let data = this.organizeSelectedPackageData(this.product.selectedPackageOptions);
    data?.forEach((element: any) => {
      element.packageGroups?.forEach((packageGroup: any) => {
        packageGroup.optionGroups?.forEach((optionGroup: any) => {
          optionGroup.options?.forEach((option: any) => {
            price += Number(option.optionPrice) || 0;
          });
        });
      });
    });
    return price;
  }

  calculatePackageDefaultOptionsPrice() {
    let price = 0;
    if (this.product.fixedPackage?.length) {
      this.product.fixedPackage?.forEach((pkg: any) => {
        if (pkg.defaultOptions && pkg.defaultOptions.length > 0) {
          pkg.defaultOptions.forEach((option: any) => {
            if (option.optionPrice > 0 && option.tempQty > 0) {
              price += (option.optionPrice * option.tempQty);
            }
          });
        }
        pkg.packageGroups?.forEach((packageGroup: any) => {
          if (packageGroup.defaultOptions && packageGroup.defaultOptions.length > 0) {
            packageGroup.defaultOptions.forEach((option: any) => {
              if (option.optionPrice > 0 && option.tempQty > 0) {
                price += (option.optionPrice * option.tempQty);
              }
            });
          }
        });
      });
    }
    return price;
  }

  calculateMenuSelectionOptions1Price() {
    let price = 0;
    if (this.product.fixedSelection?.length) {
      this.product.fixedSelection?.forEach((select: any) => {
        let selectionGroupIndex = 0;
        select.selectionGroups?.forEach((selectionGroup: any) => {
          selectionGroup.items?.forEach((item: any) => {
            if (this.isMenuSelectionOption1IsSelected(select, selectionGroupIndex, item)) {
              if (item.price) {
                price += item.price;
              }
            }
          });
          selectionGroupIndex++;
        });
      });
    }
    return price;
  }

  isMenuSelectionOption1IsSelected(select: any, selectionGroupIndex: any, product: any) {
    const selectedData = this.organizeSelectedMenuSelectionData(this.product.selectedMenuSelectionOptions);
    if (selectedData) {
      for (const selectData of selectedData) {
        if (selectData.selectName === select.name) {
          if (selectData.selectionGroups) {
            for (const selectionGroup of selectData.selectionGroups) {
              if (
                selectionGroup.selectionGroupName === selectionGroupIndex &&
                selectionGroup.productId === product.productId
              ) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  calculateProductDiscount(total: any) {
    let isDiscountable = this.product.isDiscountable;
    let discountAmount = this.product.discountAmount;
    let discountPercentage = this.product.discountPercentage;
    if (isDiscountable) {
      if (discountPercentage) {
        return total * (discountAmount / 100);
      } else {
        return discountAmount ? discountAmount : 0;
      }
    }
    return 0;
  }

  async addToCart(event: Event) {
    // Hard guard: reject any click that arrives before product data is ready
    if (this.loading || !this.isProductReady || !this.product?.id) {
      return;
    }
    if (this.isValidAddButton()) {
      if (this.product.maxItemPerTicket > 0) {
        if (this.isItemMax()) {
          this.alertService.showAlert({ title: "You can't add this product more than" + " " + this.product.maxItemPerTicket });
          return;
        }
      }
      if (this.product.quantity > 0) {
        if (this.isItemOutOfStock()) {
          this.alertService.showAlert({ title: "No more stock to add this product" });
          return;
        }
      }

      let options: any = [];
      if (this.product.optionGroups && this.product.optionGroups.length > 0) {
        this.product.optionGroups.forEach((group: any) => {
          group.options.forEach((option: any) => {
            if (option.isSelected) {
              options.push({ id: option.optionId, qty: 1, optionGroupId: group.optionGroupId });
            }
          });
        });
      }
      if (this.product.defaultOptions && this.product.defaultOptions.length > 0) {
        this.product.defaultOptions.forEach((option: any) => {
          if (option.tempQty > 0) {
            options.push({ id: option.optionId, qty: option.tempQty });
          }
        });
      }

      let selectedItems: any = [];
      if (this.product.selection && this.product.selection.length > 0) {
        this.organizeSelectedMenuSelectionData(this.product.selectedMenuSelectionOptions)?.forEach((select: any) => {
          select.selectionGroups?.forEach((selectionGroup: any) => {
            if (selectionGroup.optionGroups?.length) {
              let options: any = [];
              selectionGroup.optionGroups?.forEach((group: any) => {
                group.options?.forEach((option: any) => {
                  if (option.optionId) {
                    options.push({ optionId: option.optionId, optionGroupId: option.optionGroupId, qty: 1 });
                  }
                });
              });
              if (selectionGroup.productId) {
                selectedItems.push({ productId: selectionGroup.productId, options: options });
              }
            } else {
              if (selectionGroup.productId) {
                selectedItems.push({ productId: selectionGroup.productId, options: [] });
              }
            }
          });
        });
      } else if (this.product.package && this.product.package.length > 0) {
        selectedItems = [];
        this.organizeSelectedPackageData(this.product.selectedPackageOptions)?.forEach((select: any) => {
          select.packageGroups?.forEach((packageGroup: any) => {
            if (packageGroup.optionGroups?.length) {
              let options: any = [];
              packageGroup.optionGroups?.forEach((group: any) => {
                group.options?.forEach((option: any) => {
                  if (option.optionId) {
                    options.push({ optionId: option.optionId, optionGroupId: option.optionGroupId, qty: 1 });
                  }
                });
              });
              if (packageGroup.productId) {
                selectedItems.push({ productId: packageGroup.productId, options: options });
              }
            } else {
              if (packageGroup.productId) {
                selectedItems.push({ productId: packageGroup.productId, options: [] });
              }
            }
          });
        });
        this.product.package.forEach((packge: any) => {
          if (!packge.optionGroups) {
            selectedItems.push({ productId: packge.productId, qty: packge.qty });
          }
        });
      }

      let measurements: any = {};
      if (this.product.type == "tailoring" && this.product.measurements) {
        if (this.product.measurementsArray) {
          this.product.measurementsArray.forEach((m: any) => {
            measurements[m.key] = m.value;
          });
        }
      }

      const element = document.querySelector('.mfp-container');
      let data = await this.addItemToCart({
        productId: this.product.id,
        qty: this.qty,
        options: options,
        note: this.note,
        measurements: measurements,
        selectedItems: selectedItems,
        showCart: true
      });

      if (!data) return;

      this.qty = 1;
      this.note = "";

      if (element && element.classList.contains('mfp-container')) {
        this.close.emit();
      } else {
        this.resetProductOptions();
        if (this.noback) {
          if (this.router.url.includes('menu')) {
            this.router.navigate(['/menu']);
          } else if (this.router.url.includes('shop')) {
            this.router.navigate(['/shop']);
          } else {
            this.router.navigate(['/cart']);
          }
        } else {
          if (this.canGoBack) {
            this.location.back();
          } else {
            if (this.router.url.includes('menu')) {
              this.router.navigate(['/menu']);
            } else if (this.router.url.includes('shop')) {
              this.router.navigate(['/shop']);
            } else {
              this.router.navigate(['/']);
            }
          }
        }
      }
    } else {
      if (!this.isValidProductOptions()) {
        this.productOptionsTab = "default";
        this.alertService.showAlert({ title: "Please fill required product options" });
        return;
      }
      if (!this.isValidMeasurements()) {
        this.alertService.showAlert({ title: "Please fill required product measurements" });
        this.productOptionsTab = "measurements";
        return;
      }
      if (!this.isValidMatrixOptions()) {
        this.productOptionsTab = "default";
        this.alertService.showAlert({ title: "Please fill required product options" });
        return;
      }
    }
  }

  resetProductOptions() {
    if (this.product.optionGroups?.length > 0) {
      this.product.optionGroups.forEach((group: any) => {
        group.options.forEach((option: any) => {
          option.isSelected = false;
        });
      });
    }
    if (this.product.defaultOptions?.length > 0) {
      this.product.defaultOptions.forEach((option: any) => {
        option.tempQty = option.qty;
      });
    }
    if (this.product.selectedMenuSelectionOptions) {
      this.product.selectedMenuSelectionOptions = {};
    }
    if (this.product.selectedPackageOptions) {
      this.product.selectedPackageOptions = {};
    }
    if (this.product.type === "tailoring" && this.product.measurementsArray) {
      this.product.measurementsArray.forEach((measurement: any) => {
        measurement.value = null;
      });
    }
    this.qty = 1;
    this.note = "";
    this.chosenOptions = {};
    this.isProductReady = false;
    if (
      !(this.product.optionGroups?.length > 0) &&
      !(this.product.selection?.length > 0) &&
      !(this.product.package?.length > 0) &&
      (this.product.type == 'tailoring')
    ) {
      this.productOptionsTab = "measurements";
    } else {
      this.productOptionsTab = "default";
    }
    this.selectedTab = "description";
  }

  isItemMax() {
    let count = this.qty - 1 || 0;
    if (this.invoiceData.lines && this.invoiceData.lines.length) {
      this.invoiceData.lines.forEach(line => {
        if (line.productId == this.product.id) {
          count += line.qty;
        }
      });
    }
    return count >= this.product.maxItemPerTicket;
  }

  isItemOutOfStock() {
    let count = 0;
    if (this.invoiceData.lines && this.invoiceData.lines.length) {
      this.invoiceData.lines.forEach(line => {
        if (line.productId == this.product.id) {
          count += line.qty;
        }
      });
    }
    return count >= this.product.quantity;
  }

  isMobile2(): boolean {
    return window.innerWidth < 770;
  }

  onSlideChanged(event: any): void {
    if (event.startPosition !== undefined) {
      this.selectedImageIndex = event.startPosition;
      if (this.thumbnailCarousel && this.slideImages.length > 4) {
        const visibleThumbs = 4;
        const targetThumbIndex = Math.floor(this.selectedImageIndex / visibleThumbs) * visibleThumbs;
        this.thumbnailCarousel.to(`thumb${targetThumbIndex}`);
      }
    }
  }

  selectImage(index: number): void {
    this.selectedImageIndex = index;
    this.zoomedIndex = -1;
    if (this.carousel) {
      this.carousel.to(`slide${index}`);
    }
    if (this.thumbnailCarousel && this.slideImages.length > 4) {
      this.thumbnailCarousel.to(`thumb${index}`);
    }
  }

  navigateImage(direction: 'prev' | 'next'): void {
    if (this.carousel) {
      if (direction === 'prev') {
        this.carousel.prev();
      } else {
        this.carousel.next();
      }
    }
  }

  getNextImageSrc(): string | null {
    if (!this.isTransitioning || this.slideImages.length === 0) return null;
    let nextIndex: number;
    if (this.slideDirection === 'left') {
      nextIndex = this.selectedImageIndex === this.slideImages.length - 1 ? 0 : this.selectedImageIndex + 1;
    } else {
      nextIndex = this.selectedImageIndex === 0 ? this.slideImages.length - 1 : this.selectedImageIndex - 1;
    }
    return this.slideImages[nextIndex]?.large || this.slideImages[nextIndex]?.thumb || 'assets/images/default-blank-image.png';
  }

  onImageMouseMove(event: MouseEvent, index: number): void {
    if (this.zoomedIndex === index) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      this.transformOrigin = `${x}% ${y}%`;
    }
  }

  fullscreenImage: string | null = null;
  fullscreenImageIndex: number | null = null;

  openGallery(index: number): void {
    this.fullscreenImageIndex = index;
    document.body.style.overflow = 'hidden';
  }

  closeGallery(): void {
    this.fullscreenImageIndex = null;
    document.body.style.overflow = '';
  }

  prevImage(event: MouseEvent): void {
    event.stopPropagation();
    if (this.fullscreenImageIndex !== null) {
      if (this.fullscreenImageIndex == 0) {
        this.fullscreenImageIndex = this.product.slideImages.length - 1;
      } else {
        this.fullscreenImageIndex = this.fullscreenImageIndex - 1;
      }
    }
  }

  nextImage(event: MouseEvent): void {
    event.stopPropagation();
    if (this.fullscreenImageIndex !== null) {
      if (this.fullscreenImageIndex == this.product.slideImages.length - 1) {
        this.fullscreenImageIndex = 0;
      } else {
        this.fullscreenImageIndex = this.fullscreenImageIndex + 1;
      }
    }
  }

  getImageSize(url: string): Promise<{ w: number, h: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
    });
  }

  goBack() {
    this.resetProductOptions();
    if (this.noback) {
      if (this.router.url.includes('menu')) {
        this.router.navigate(['/menu']);
      } else if (this.router.url.includes('shop')) {
        this.router.navigate(['/shop']);
      } else {
        this.router.navigate(['/']);
      }
    } else {
      if (this.canGoBack) {
        this.location.back();
      } else {
        if (this.router.url.includes('menu')) {
          this.router.navigate(['/menu']);
        } else if (this.router.url.includes('shop')) {
          this.router.navigate(['/shop']);
        } else {
          this.router.navigate(['/']);
        }
      }
    }
  }

  onChangeProductOptionsTab(value: string) {
    this.productOptionsTab = value;
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }

  isIosPlatform(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  getFileType(url: any) {
    const lastDotIndex = url.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === url.length - 1) {
      return 'No file extension found';
    }
    const fileType = url.substring(lastDotIndex + 1);
    return fileType.toLowerCase();
  }

  open3dUrl(url: string): void {
    if (this.isIosPlatform()) {
      window.open(url, '_blank');
    }
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== 'assets/images/default-blank-image.png') {
      img.src = 'assets/images/default-blank-image.png';
    }
  }

  private setupTouchListeners(): void {
    document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
    document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
  }

  private removeTouchListeners(): void {
    document.removeEventListener('touchstart', this.onTouchStart.bind(this));
    document.removeEventListener('touchend', this.onTouchEnd.bind(this));
  }

  private onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.touchStartX || !this.touchStartY) return;
    const touch = event.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;
    const deltaX = this.touchStartX - touchEndX;
    const deltaY = this.touchStartY - touchEndY;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.minSwipeDistance) {
      if (deltaX > 0) {
        this.navigateImage('next');
      } else {
        this.navigateImage('prev');
      }
    }
    this.touchStartX = 0;
    this.touchStartY = 0;
  }

  getCurrentImageAlt(): string {
    const currentImage = this.slideImages[this.selectedImageIndex];
    return currentImage?.alt || this.product?.name || 'Product image';
  }

  private preloadAdjacentImages(): void {
    const preloadImage = (src: string) => {
      if (src) {
        const img = new Image();
        img.src = src;
      }
    };
    const nextIndex = (this.selectedImageIndex + 1) % this.slideImages.length;
    if (this.slideImages[nextIndex]) {
      preloadImage(this.slideImages[nextIndex].large || this.slideImages[nextIndex].thumb);
    }
    const prevIndex = this.selectedImageIndex === 0 ? this.slideImages.length - 1 : this.selectedImageIndex - 1;
    if (this.slideImages[prevIndex]) {
      preloadImage(this.slideImages[prevIndex].large || this.slideImages[prevIndex].thumb);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.navigateImage('prev');
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.navigateImage('next');
        break;
      case 'Escape':
        this.zoomedIndex = -1;
        break;
    }
  }

  toggleZoom(index?: number): void {
    const targetIndex = index !== undefined ? index : this.selectedImageIndex;
    this.zoomedIndex = this.zoomedIndex === targetIndex ? -1 : targetIndex;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}