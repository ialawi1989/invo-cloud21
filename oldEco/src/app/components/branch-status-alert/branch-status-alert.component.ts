import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { ModalService } from 'src/app/services/modal.service';
import { TranslateModule } from '@ngx-translate/core';
import { AppServices } from 'src/app/services/appServices';
import { ShopService } from 'src/app/services/shopServices/shop.service';
import { PickupSelectorPopComponent } from '../pickup-selector-pop/pickup-selector-pop.component';

@Component({
  selector: 'app-branch-status-alert',
  imports: [TranslateModule],
  templateUrl: './branch-status-alert.component.html',
  styleUrl: './branch-status-alert.component.css'
})
export class BranchStatusAlertComponent implements OnInit {

  private logger = inject(LoggerService);

  constructor(
    public appService: AppServices,
    private modalService: ModalService,
    @Inject(PLATFORM_ID) private platformId: any,
  ) {

  }

  ngOnInit(): void {
    // if(this.appService.getBranchStatusValue() == 'close' || this.appService.getBranchStatusValue() == 'busy'){
    //   this.alertService.showAlert({title:"⚠︎",subtitle:"Branch is " + this.appService.getBranchStatusValue()});
    // }
  }

  changeBranch() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      // Check if modal service is available
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'BranchStatusAlertComponent.changeBranch' });
        return;
      }
      // Create modal via ModalService so the browser back button dismisses it,
      // and stacked / repeated opens are handled correctly.
      const component = PickupSelectorPopComponent;
      const modalRef = this.modalService.openWithData(component, {}, {
        centered: true,
        // size: "lg",
        windowClass: "modal-md modal-fullscreen-md-down",
        backdrop: 'static', // Prevent closing on backdrop click
        keyboard: false     // Prevent closing on escape
      });
      // Check if modal was created successfully
      if (!modalRef) {
        this.logger.error('Failed to create modal', { context: 'BranchStatusAlertComponent.changeBranch' });
        return;
      }
      // Handle modal result
      modalRef.result.then(
        (data: any) => {
          if (data && data.success) {
            // Handle success
          }
        },
        (reason: any) => {
          // Handle dismissal
        }
      ).catch((error: any) => {
        this.logger.error(error?.message, { stack: error?.stack, context: 'BranchStatusAlertComponent.modalResult' });
      });
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'BranchStatusAlertComponent.changeBranch' });
    }
  }

}