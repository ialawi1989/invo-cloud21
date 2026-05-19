import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { CheckoutComponent } from 'src/app/pages/checkout/checkout.component';

@Injectable({ providedIn: 'root' })
export class CheckoutDeactivateGuard implements CanDeactivate<CheckoutComponent> {
  canDeactivate(component: CheckoutComponent): boolean {
    if (component?.isPlacingOrder) {
      return window.confirm(
        'An order is being placed. Leaving now may interrupt the payment. Are you sure you want to leave?'
      );
    }
    return true;
  }
}
