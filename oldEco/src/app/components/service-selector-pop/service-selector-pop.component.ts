import { Component, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AppServices } from 'src/app/services/appServices';
import { DeliverySelectorPopComponent } from '../delivery-selector-pop/delivery-selector-pop.component';
import { PickupSelectorPopComponent } from '../pickup-selector-pop/pickup-selector-pop.component';
import { ShippingSelectorPopComponent } from '../shipping-selector-pop/shipping-selector-pop.component';
import { ModalService } from 'src/app/services/modal.service';
import { PageBuilderService } from 'src/app/services/pageBuilderServices/page-builder.service';

@Component({
  selector: 'app-service-selector-pop',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule
  ],
  templateUrl: './service-selector-pop.component.html',
  styleUrls: ['./service-selector-pop.component.css']
})
export class ServiceSelectorPopComponent {

  private logger = inject(LoggerService);
  isLoadedData: boolean = false;
  checkoutPageData: any = null;
  disableDelivery: boolean = false;
  disablePickup: boolean = false;
  disablePayLater: boolean = false;
  disablePayLaterFor: any = [];
  disableImmediateORder: boolean = false;
  page: string = '';

  constructor(
    public activeModal: NgbActiveModal,
    public appService: AppServices,
    private modalService: ModalService,
    private pageBuilderServices: PageBuilderService,
  ) {
    this.appService.showSelectMenuServicePop = false;
  }

  async loadData(data: any): Promise<void> {
    if (data) {
      this.isLoadedData = data;
      this.page = data.page || '';
    }
    await this.getCheckoutPageData();

    // Auto-select if only one service is available
    const available = this.getAvailableServices();
    if (available.length === 1) {
      // this.selectService(available[0]);
    }
  }

  async getCheckoutPageData() {
    let data = await this.pageBuilderServices.getPage('checkout');
    if (data) {
      this.checkoutPageData = data;
      this.loadDisabilitySettings();
    }
  }

  /**
   * Returns a list of currently available (non-disabled) service keys.
   */
  getAvailableServices(): string[] {
    const services: string[] = [];

    if (!this.isServiceDisabled('pickup')) {
      services.push('pickup');
    }

    if (this.appService.shippingType === 'shipping' && !this.isServiceDisabled('delivery')) {
      services.push('shipping');
    } else if (!this.isServiceDisabled('delivery')) {
      services.push('delivery');
    }

    return services;
  }

  /**
   * Returns true when no services are available to display.
   */
  get hasNoServices(): boolean {
    return this.getAvailableServices().length === 0;
  }

  /**
   * Load service disability settings from page data or appService.
   * Mirrors the logic from CheckoutComponent.ngOnInit()
   */
  loadDisabilitySettings(): void {
    if (this.checkoutPageData?.template?.settings) {
      this.disableDelivery = this.checkoutPageData.template.settings.disable_delivery || false;
      this.disablePickup = this.checkoutPageData.template.settings.disable_pickup || false;
      this.disablePayLater = this.checkoutPageData.template.settings.disable_pay_later || false;
      this.disablePayLaterFor = this.checkoutPageData.template.settings.disable_pay_later_for || [];
      this.disableImmediateORder = this.checkoutPageData.template.settings.disable_immediate_order || false;
    } else {
      this.disableDelivery = this.appService.disableDelivery || false;
      this.disablePickup = this.appService.disablePickup || false;
      this.disablePayLater = this.appService.disablePayLater || false;
    }
  }

  /**
   * Check if a service should be displayed.
   * @param service - The service to check ('pickup', 'delivery', 'shipping')
   * @returns true if the service should be hidden, false if it should be shown
   */
  isServiceDisabled(service: string): boolean {
    switch (service) {
      case 'pickup':
        return this.disablePickup;
      case 'delivery':
        return this.disableDelivery;
      case 'shipping':
        // Shipping is only available if shippingType is 'shipping' and delivery is not disabled
        return this.appService.shippingType !== 'shipping' || this.disableDelivery;
      default:
        return false;
    }
  }

  closePop(): void {
    this.activeModal.dismiss();
  }

  /**
   * FIX: Do NOT close this modal before opening the sub-modal.
   * Instead, open the sub-modal, await its result, then close THIS modal
   * with the full result so checkout's editService() handler receives everything.
   */
  selectService(service: string): void {
    // Validate service is not disabled before proceeding
    if (this.isServiceDisabled(service)) {
      console.warn(`Service ${service} is disabled and cannot be selected`);
      return;
    }

    const isCheckout = this.page === 'checkout';
    const subModalData = isCheckout
      ? { context: 'checkout', page: 'checkout' }
      : {};

    let modalRef: any;

    if (service === 'pickup') {
      modalRef = this.modalService.openWithData(PickupSelectorPopComponent, subModalData, {
        centered: true,
        windowClass: 'modal-md modal-fullscreen-md-down',
        backdrop: 'static',
        keyboard: false
      });
    } else if (service === 'shipping') {
      modalRef = this.modalService.openWithData(ShippingSelectorPopComponent, subModalData, {
        centered: true,
        windowClass: 'modal-md modal-fullscreen-md-down',
        backdrop: 'static',
        keyboard: false
      });
    } else if (service === 'delivery') {
      modalRef = this.modalService.openWithData(DeliverySelectorPopComponent, subModalData, {
        centered: true,
        windowClass: 'modal-md modal-fullscreen-md-down',
        backdrop: 'static',
        keyboard: false
      });
    }

    if (modalRef) {
      modalRef.result
        .then(
          (data: any) => {
            // Sub-modal closed successfully — close THIS modal and bubble the full
            // result up to whoever opened the service selector (e.g. checkout).
            setTimeout(() => {
              this.activeModal.close({ success: true, ...data });
            }, 75);
          },
          (reason: any) => {
            // Sub-modal was dismissed — just dismiss this modal too without a result
            // so the checkout handler knows nothing changed.
            this.activeModal.dismiss(reason);
          }
        )
        .catch((error: any) => {
          this.logger.error(error?.message, { stack: error?.stack, context: 'ServiceSelectorPopComponent.subModalResult' });
          this.activeModal.dismiss(error);
        });
    }
  }
}