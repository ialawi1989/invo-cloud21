import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Invoice } from 'src/app/models/invoice-model';
import { Order } from 'src/app/models/order.model';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { SpinnerComponent } from "../../../components/spinner/spinner.component";
import { AppServices } from 'src/app/services/appServices';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-order-complete',
  imports: [
    RouterLink,
    TranslateModule,
    SpinnerComponent
],
  templateUrl: './order-complete.component.html',
  styleUrl: './order-complete.component.css'
})
export class OrderCompleteComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);

  loading: boolean = true;
  isBrowser: boolean;
  sessionId: any;
  isAppointment:boolean = false;
  tempOrderData:any = {};

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private cartService: CartService,
    private router: Router,
    private appService: AppServices
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    window.scrollTo({ top: 0 });
    this.getAndSetData();
  }

  onViewLastOrderClick() {
    this.sessionId = null
  }

  async getAndSetData() {
    if (this.isBrowser) {
      let tempAppointmentSessionId = localStorage.getItem('appointmentSessionId');
      let tempSessionId:any = localStorage.getItem('sessionId');
      if(tempAppointmentSessionId){
        this.sessionId = tempAppointmentSessionId;
        this.isAppointment = true;
        this.setOrderToLocalStorage(tempAppointmentSessionId);
        this.tempOrderData = await this.getOrderData(tempAppointmentSessionId);
        localStorage.removeItem('appointmentSessionId');
        if(this.tempOrderData.id){
          //this.sessionId = tempAppointmentSessionId;
        }else{
          this.getAndSetData();
        }
      }else{
        this.sessionId = tempSessionId;
        this.setOrderToLocalStorage(tempSessionId);
        this.tempOrderData = await this.getOrderData(tempSessionId);
        if(this.tempOrderData.id){
          //this.sessionId = tempSessionId;
          this.reCreateCart();
        }else{
          this.router.navigate(['/']);
        }
      }
      this.loading = false;
    }
  }

  getOrderData(sessionId:string) {
    return new Promise(response => {
      this.cartService.getOrderData(sessionId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Order | null) => {
          response(data);
        }, error(err) {
          response(null);
        },
      });
    });
  }

  async reCreateCart() {
    return new Promise((resolve, reject) => {
      this.cartService.createCart({}).pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Invoice | any) => {
          this.cartService.setCartInvoiceData(data);
          localStorage.removeItem('sessionId');
          localStorage.setItem('sessionId', data.onlineData.sessionId);
          resolve(true);
        },
        error: (err: any) => {
          this.logger.error(err?.message, { stack: err?.stack, context: 'OrderCompleteComponent.reCreateCart' });
          reject(err); // Reject promise on error
        }
      });
    });
  }

  setOrderToLocalStorage(orderId: string): void {
    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const index = orders.findIndex((item: any) => item === orderId);
    if (index !== -1) {
      // Order is in the orderList, remove it
      orders.splice(index, 1);
    } else {
      // Order is not in the orderList, add it
      orders.push({
        id: orderId,
        date: new Date()
      });
    }
    if (this.isBrowser) {
      localStorage.setItem('orders', JSON.stringify(orders));
    }
  }



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
