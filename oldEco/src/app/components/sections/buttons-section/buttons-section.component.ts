import { Component, Input, OnChanges, SimpleChanges, OnDestroy} from '@angular/core';
import { Section } from '../../../models/page-data/pageData';
import { ButtonsSectionStyle1Component } from "./buttons-section-style1/buttons-section-style1.component";
import { ButtonsSectionStyle2Component } from "./buttons-section-style2/buttons-section-style2.component";
import { Invoice } from '../../../models/invoice-model';
import { CartService } from '../../../services/cartServices/cart.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-buttons-section',
  imports: [ButtonsSectionStyle1Component, ButtonsSectionStyle2Component],
  templateUrl: './buttons-section.component.html',
  styleUrl: './buttons-section.component.css'
})
export class ButtonsSectionComponent implements OnChanges , OnDestroy{
  private destroy$ = new Subject<void>();

  @Input() style = "Style 1";
  @Input() section!: Section;

  // ── Shared state passed down to style children ────────────────────────────
  background: string = 'white';
  invoiceData!: Invoice | any;

  constructor(private cartService: CartService) {
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) this.invoiceData = invoiceData;
      },
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['section'] && this.section) {
      this.background = this.getBackground();
      this.resolveButtonIcons();
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

  resolveButtonIcons() {
    const iconMap: Record<string, string> = {
      appointments:      '/assets/images/appointment.svg',
      shop:              '/assets/images/shop.svg',
      'table-reservation': '/assets/images/table-reservation.svg',
      'pickup-menu':     '/assets/images/pickup.svg',
      'delivery-menu':   '/assets/images/delivery.svg',
    };
    this.section?.sectionData?.buttons?.forEach((button: any) => {
      const abbr = button.buttonLink?.abbr;
      if (button.buttonLink?.type === 'services' && iconMap[abbr]) {
        button.image.defaultUrl = iconMap[abbr];
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
