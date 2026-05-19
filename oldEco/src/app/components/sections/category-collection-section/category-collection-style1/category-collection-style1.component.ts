import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Section } from '../../../../models/page-data/pageData';
import { AppServices } from '../../../../services/appServices';

@Component({
  selector: 'app-category-collection-style1',
  imports: [
  ],
  templateUrl: './category-collection-style1.component.html',
  styleUrl: './category-collection-style1.component.css'
})
export class CategoryCollectionStyle1Component {

  // ── Inputs ────────────────────────────────────────────────────────────────
  @Input() section!: Section;
  @Input() themeBuilder: any = {};
  @Input() background: string = 'white';

  // ── Outputs ───────────────────────────────────────────────────────────────
  @Output() shopNav = new EventEmitter<any>();

  constructor(public appService: AppServices) {}

  /** Compatibility shim — templates still call getBackground() */
  getBackground(): string { return this.background; }

  /** Compatibility shim — templates still call gotoShop(category) */
  gotoShop(category: any): void { this.shopNav.emit(category); }
}
