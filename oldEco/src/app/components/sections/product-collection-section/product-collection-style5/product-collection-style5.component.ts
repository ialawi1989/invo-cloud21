import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';
import { CarouselModule, OwlOptions } from 'ngx-owl-carousel-o';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-product-collection-style5',
  imports: [RouterLink, CarouselModule],
  templateUrl: './product-collection-style5.component.html',
  styleUrl: './product-collection-style5.component.css',
})
export class ProductCollectionStyle5Component {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';
  @Input() products1: any[] = [];
  @Input() products2: any[] = [];
  @Input() products3: any[] = [];

  // ── Outputs ───────────────────────────────────────────────────────────────
  @Output() collectionNav = new EventEmitter<string>();

  customOptions: OwlOptions = {
    loop: false, autoWidth: false, dots: true, rewind: true,
    navSpeed: 700, navText: [], nav: false, margin: 20, autoHeight: false,
    responsive: { 0: { items: 1 }, 400: { items: 2 }, 740: { items: 3 }, 940: { items: 4 } },
  };

  constructor(public appService: AppServices) {}

  /** Compatibility shim */
  getBackground(): string { return this.background; }

  /** Compatibility shim — template calls gotoCollection(slug) */
  gotoCollection(slug: string): void { this.collectionNav.emit(slug); }
}
