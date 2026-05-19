import { Component, Input, OnDestroy} from '@angular/core';
import { ProductGridStyle1Component } from "./product-grid-style1/product-grid-style1.component";
import { ProductGridStyle2Component } from "./product-grid-style2/product-grid-style2.component";
import { Product } from '../../../models/product.model';
import { CompanyServices } from '../../../services/companyServices/company.service';
import { Company } from '../../../models/company.model';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductGridStyle3Component } from "./product-grid-style3/product-grid-style3.component";
import { ProductGridStyle4Component } from "./product-grid-style4/product-grid-style4.component";
import { ProductGridStyle5Component } from "./product-grid-style5/product-grid-style5.component";
import { ScrollPositionService } from '../../../services/scrollPositionService/scrollPositionService';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-product-grid',
  imports: [
    ProductGridStyle1Component,
    ProductGridStyle2Component,
    ProductGridStyle3Component,
    ProductGridStyle4Component,
    ProductGridStyle5Component
],
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.css'
})
export class ProductGridComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() style: string = "";
  @Input() slug: string = "";
  @Input() template: any;
  @Input() product: Product = new Product();
  @Input() currentParent: String = "";

  companyData: Company = new Company();
  id: string = '';

  departmentId?: string | null;
  categoryId?: string | null;
  menuStyle?: string | null;
  sectionId: string = '';

  constructor(
    private companyService: CompanyServices,
    private route: ActivatedRoute,
    private router: Router,
    private scrollService: ScrollPositionService,
  ) {
    this.getCompanyData();
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.id = params.get('id') || '';
    });
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }

  extractParam(): void {
    const params = this.route.snapshot.queryParamMap;
    this.departmentId = params.get('departmentId');
    this.categoryId = params.get('categoryId');

    if (params.get('section_id')) {
      this.sectionId = params.get('section_id')!;
      this.menuStyle = '1';
    }
  }

  gotoProductPage(product: Product) {
    this.extractParam();
    this.scrollService.save(this.router.url, window.scrollY);

    const urlSegments = this.router.url.split('/');
    const page = urlSegments[1];
    if (page.includes('collections') && this.slug) {
      this.router.navigate(['/collections/product', product.id], { queryParamsHandling: 'preserve' });
    } else if (page.includes('shop')) {
      this.router.navigate(['/shop/product', product.id], { queryParamsHandling: 'preserve' });
    } else if (page.includes('menu')) {
      this.router.navigate(['/menu/product', product.id], { queryParamsHandling: 'preserve' });
    } else if (page.includes('search')) {
      this.router.navigate(['/search/product', product.id], { queryParamsHandling: 'preserve' });
    } else {
      this.router.navigate(['/products/product', product.id], { queryParamsHandling: 'preserve' });
    }
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
