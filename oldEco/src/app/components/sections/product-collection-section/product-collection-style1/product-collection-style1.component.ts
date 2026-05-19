import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';
import { CarouselModule, OwlOptions } from 'ngx-owl-carousel-o';
import { ProductGridComponent } from "../../../product/product-grid/product-grid.component";

@Component({
  selector: 'app-product-collection-style1',
  imports: [CarouselModule, ProductGridComponent],
  templateUrl: './product-collection-style1.component.html',
  styleUrl: './product-collection-style1.component.css',
})
export class ProductCollectionStyle1Component {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';
  @Input() products: any[] = [];
  @Input() slug: string = '';

  // ── Outputs ───────────────────────────────────────────────────────────────
  @Output() collectionNav = new EventEmitter<void>();

  customOptions: OwlOptions = {
    loop: false, autoWidth: false, dots: true, rewind: true,
    navSpeed: 700, navText: [], nav: false, margin: 20, autoHeight: false,
    responsive: { 0: { items: 2 }, 400: { items: 2 }, 740: { items: 4 }, 940: { items: 5 } },
  };

  constructor(public appService: AppServices) {}

  get useCarousel(): boolean { return this.products?.length > 3; }

  /** Compatibility shim — templates still call getBackground() */
  getBackground(): string { return this.background; }

  /** Compatibility shim — templates still call gotoCollection() */
  gotoCollection(slug?: string): void { this.collectionNav.emit(); }
}
