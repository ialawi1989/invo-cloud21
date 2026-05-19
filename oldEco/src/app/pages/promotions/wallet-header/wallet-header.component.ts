import { AfterViewInit, Component, ViewEncapsulation, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/authService/auth.service';
import { ModalService } from 'src/app/services/modal.service';
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { LoginPopComponent } from 'src/app/components/auth/login-pop/login-pop.component';
import { WalletServiceService } from '../wallet-service/wallet-service.service';
import { WalletSettings } from '../modal/promotion.modal';
import { AlertService } from 'src/app/services/alertService/alert.service';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-wallet-header',
  standalone: false,
  templateUrl: './wallet-header.component.html',
  styleUrl: './wallet-header.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class WalletHeaderComponent implements AfterViewInit , OnDestroy{
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  async ngAfterViewInit() {}

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private modalService: ModalService,
    public walletServiceService: WalletServiceService,
    private alertService: AlertService,
    private translate: TranslateService
  ) {}
  walletSettings!: WalletSettings;
  redirectToWalletAfterLogin = false;
  userData: any = {};
  handleWalletClick() {
    if (this.userData?.id) {
      this.openWallet();
    } else {
      this.openLoginPop();
      this.redirectToWalletAfterLogin = true;
    }
  }
  async openWallet() {
    this.walletSettings = await this.walletServiceService.getWalletSettings();
    //{{'PROMOTIONS.THIS_FEATURE_NOT_AVAILABLE'| translate}}
    if (!this.walletSettings.enabled)
      this.alertService.showAlert({
        title: this.translate.instant('PROMOTIONS.THIS_FEATURE_NOT_AVAILABLE'),
      });
    else this.router.navigate(['/wallet']);
  }
  openLoginPop() {
    try {
      // Check if modal service is available
      if (!this.modalService) {
        this.logger.error('Modal service not available', { context: 'WalletHeaderComponent.openLoginPop' });
        return;
      }

      // Open the modal using the ModalService
      const modalRef = this.modalService.openWithData(
        LoginPopComponent,
        {},
        {
          centered: true,
          windowClass: 'modal-md',
          backdrop: 'static', // Prevent closing on backdrop click
          keyboard: false, // Prevent closing on escape
        }
      );

      // Handle modal result
      this.handleModalResult(modalRef);
    } catch (error: any) {
      this.logger.error(error?.message, { stack: error?.stack, context: 'WalletHeaderComponent.openLoginPop' });
    }
  }

  // Helper method to handle modal results
  private handleModalResult(modalRef: NgbModalRef): void {
    modalRef.result
      .then(
        (data: any) => {
          if (data && data.success) {
            // Handle success
          }
        },
        (reason: any) => {
          // Handle dismissal
        }
      )
      .catch((error: any) => {
        this.logger.error(error?.message, { stack: error?.stack, context: 'WalletHeaderComponent.handleModalResult' });
      });
  }

  async ngOnInit() {
    this.authService.userData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: any) => {
        this.userData = data;
        if (data?.id && this.redirectToWalletAfterLogin) {
          this.openWallet();
          this.redirectToWalletAfterLogin = false;
        }
      },
    });
    this.walletSettings = await this.walletServiceService.getWalletSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
