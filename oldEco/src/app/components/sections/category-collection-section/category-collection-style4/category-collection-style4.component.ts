import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';
import { CarouselModule, OwlOptions } from 'ngx-owl-carousel-o';

@Component({
  selector: 'app-category-collection-style4',
  imports: [
    CarouselModule,
  ],
  templateUrl: './category-collection-style4.component.html',
  styleUrl: './category-collection-style4.component.css'
})
export class CategoryCollectionStyle4Component {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';

  customOptions: OwlOptions = {
    loop: false, autoWidth: false, dots: true, rewind: true,
    navSpeed: 700, navText: [], nav: false, margin: 20, autoHeight: false,
    responsive: { 0: { items: 1 }, 400: { items: 2 }, 740: { items: 3 }, 940: { items: 4 }, 1100: { items: 5 }, 1300: { items: 6 } },
  };

  // ── Outputs ───────────────────────────────────────────────────────────────
  @Output() shopNav = new EventEmitter<any>();

  constructor(public appService: AppServices) {}

  /** Compatibility shim — templates still call getBackground() */
  getBackground(): string { return this.background; }

  /** Compatibility shim — templates still call gotoShop(category) */
  gotoShop(category: any): void { this.shopNav.emit(category); }
}
