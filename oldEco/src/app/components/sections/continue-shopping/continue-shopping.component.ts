import { Component, inject, Inject, PLATFORM_ID, OnDestroy} from '@angular/core';
import { Order } from '../../../models/order.model';
import { isPlatformBrowser } from '@angular/common';
import { CartService } from '../../../services/cartServices/cart.service';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { Invoice } from 'src/app/models/invoice-model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-continue-shopping',
  imports: [
    RouterLink,
    TranslateModule
  ],
  templateUrl: './continue-shopping.component.html',
  styleUrl: './continue-shopping.component.css'
})
export class ContinueShoppingSectionComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  isBrowser: boolean;
  public appService = inject(AppServices);
  invoiceData!: Invoice | any;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private cartService: CartService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: Invoice | null) => {
        if (invoiceData) {
          this.invoiceData = invoiceData;
        }
      },
    });
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
