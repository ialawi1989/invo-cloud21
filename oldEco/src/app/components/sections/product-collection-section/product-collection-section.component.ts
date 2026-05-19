import { Component, HostListener, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { ProductCollectionStyle5Component } from "./product-collection-style5/product-collection-style5.component";
import { ProductCollectionStyle2Component } from "./product-collection-style2/product-collection-style2.component";
import { ProductCollectionStyle3Component } from './product-collection-style3/product-collection-style3.component';
import { ProductCollectionStyle4Component } from "./product-collection-style4/product-collection-style4.component";
import { Section } from '../../../models/page-data/pageData';
import { ProductCollectionStyle1Component } from './product-collection-style1/product-collection-style1.component';
import { ThemeService } from '../../../services/themeServices/theme.service';
import { Invoice } from 'src/app/models/invoice-model';
import { CartService } from '../../../services/cartServices/cart.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-product-collection-section',
  imports: [
    ProductCollectionStyle1Component,
    ProductCollectionStyle5Component,
    ProductCollectionStyle3Component,
    ProductCollectionStyle2Component,
    ProductCollectionStyle4Component
  ],
  templateUrl: './product-collection-section.component.html',
  styleUrl: './product-collection-section.component.css'
})
export class ProductCollectionSectionComponent implements OnChanges , OnDestroy{

  @Input() style = "1";
  @Input() section!: Section;

  // ── Shared state passed down to all style children ────────────────────────
  background: string = 'white';
  branchId: any = null;
  products: any[] = [];
  // Style 5 uses three separate collection slugs
  products1: any[] = [];
  products2: any[] = [];
  products3: any[] = [];

  isDataLoaded = false;
  invoiceData!: Invoice;
  // ── FIX: destroy subject to prevent memory leaks ──
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private cartService: CartService,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['section'] && this.section) {
      this.background = this.getBackground();
      this.isDataLoaded = false;
    }
  }

  // ── Initialise cart/branch and lazy-load products ─────────────────────────

  ngOnInit() {
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: any) => {
        if (invoiceData) {
          this.invoiceData = invoiceData;
          this.branchId = invoiceData.branchId;
        }
      },
    });
    this.checkVisibility();
  }


  @HostListener('window:scroll', [])
  @HostListener('window:resize', [])
  onWindowEvent(): void { this.checkVisibility(); }

  checkVisibility() {
    if (this.section?.show && !this.isDataLoaded) {
      this.isDataLoaded = true;
      if (this.style === '5') {
        this.loadCollectionData(this.section.sectionData.collectionSlug1, this.products1);
        this.loadCollectionData(this.section.sectionData.collectionSlug2, this.products2);
        this.loadCollectionData(this.section.sectionData.collectionSlug3, this.products3);
      } else {
        this.loadCollectionData(this.section.sectionData.collectionSlug, this.products);
      }
    }
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  getBackground(): string {
    const bg = this.section?.sectionBackground;
    if (!bg) return 'white';
    if (bg.style === 'Color' && bg.defaultColor) return bg.defaultColor;
    if (bg.style === 'Pattern' && bg.defaultPattern)
      return `url(assets/images/page-builder/patterns/ ${bg.defaultPattern} .png)`;
    if (bg.style === 'Image' && bg.defaultImage?.defaultUrl)
      return `url( ${bg.defaultImage.defaultUrl})`;
    return 'white';
  }

  gotoCollection(slug?: string) {
    this.router.navigate(['/collections/' + (slug || this.section.sectionData.collectionSlug)]);
    window.scrollTo({ top: 0 });
  }

  loadCollectionData(slug: string, target: any[]) {
    this.themeService.getCollectionProductList({
      sessionId: this.invoiceData.onlineData.sessionId,
      slug,
      branchId: this.branchId,
      page: 1,
      limit: 8,
      cache: true,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        if (data[0]?.length > 0) {
          data[0].forEach((element: any) => {
            element.edited = true;
            if (['menuItem', 'service', 'menuSelection', 'tailoring'].includes(element.type)) {
              element.quantity = null;
            } else {
              if (this.branchId || element.quantity === 'undefined') {
                element.quantity = element.branches?.[0]?.onHand || 0;
              } else {
                element.quantity = element.branches
                  ? Math.max(...element.branches.map((b: any) => b.onHand)) || 0
                  : 0;
              }
            }
            let tempPrice = 0;
            if (this.branchId) {
              tempPrice = element.price || element.branches?.[0]?.price || element.defaultPrice || 0;
            } else {
              tempPrice = element.price || element.defaultPrice;
            }
            element.price = tempPrice;
          });
          target.length = 0;
          target.push(...data[0]);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
