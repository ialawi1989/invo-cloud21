import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';
import { CarouselModule, OwlOptions } from 'ngx-owl-carousel-o';

@Component({
  selector: 'app-category-collection-style3',
  imports: [
    CarouselModule,
  ],
  templateUrl: './category-collection-style3.component.html',
  styleUrl: './category-collection-style3.component.css'
})
export class CategoryCollectionStyle3Component {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';

  customOptions: OwlOptions = {
    loop: false, autoWidth: false, dots: true, rewind: true,
    navSpeed: 700, navText: [], nav: false, margin: 20, autoHeight: false,
    responsive: { 0: { items: 1 }, 480: { items: 2 }, 860: { items: 3 }, 1100: { items: 4 } },
  };

  // ── Outputs ───────────────────────────────────────────────────────────────
  @Output() shopNav = new EventEmitter<any>();

  constructor(public appService: AppServices) {}

  /** Compatibility shim — templates still call getBackground() */
  getBackground(): string { return this.background; }

  /** Compatibility shim — templates still call gotoShop(category) */
  gotoShop(category: any): void { this.shopNav.emit(category); }
}
