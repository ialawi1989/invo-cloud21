import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { AuthService } from '../../../services/authService/auth.service';
import { LoadingService } from '../../../services/loadingService/loading.service';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../../../services/alertService/alert.service';
import { HttpClient } from '@angular/common/http';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-phone-verification',
  imports: [
    FormsModule,
    NgSelectModule,
    TranslateModule
  ],
  templateUrl: './phone-verification.component.html',
  styleUrl: './phone-verification.component.css'
})
export class PhoneVerificationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private logger = inject(LoggerService);
  private readonly OTP_TIMER_KEY = 'phone_otp_timer_expiry';
  phoneVerification = {
    show: false,
    phone: ''
  };
  verificationData: any = { phoneCode: '' };
  otpTimer: any = 0;
  errorMsg = '';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private alertService: AlertService,
    private loadingService: LoadingService,
    public activeModal: NgbActiveModal
  ) {
  }

  startOtpTimer(timer: number) {
    const expiryTime = Date.now() + timer * 1000;
    localStorage.setItem(this.OTP_TIMER_KEY, expiryTime.toString());
    this.runTimer(timer);
  }

  private runTimer(timer: number) {
    timer--;
    this.otpTimer = timer;
    if (timer > 0) {
      setTimeout(() => this.runTimer(timer), 1000);
    } else {
      localStorage.removeItem(this.OTP_TIMER_KEY);
    }
  }

  private resumeTimerFromStorage() {
    const expiry = localStorage.getItem(this.OTP_TIMER_KEY);
    if (expiry) {
      const remaining = Math.round((+expiry - Date.now()) / 1000);
      if (remaining > 0) {
        this.runTimer(remaining);
      } else {
        localStorage.removeItem(this.OTP_TIMER_KEY);
      }
    }
  }

  ngOnInit() {
    this.resumeTimerFromStorage();
  }

  loadData(data: any) {
    if (data.phoneCode && data.phoneNumber) {
      this.verificationData.phoneCode = data.phoneCode || '';
      this.verificationData.phoneNumber = data.phoneNumber || '';
    }
    this.verifyStep1();
  }

  @HostListener('click', ['$event'])
  onClickOutside(event: Event) {
    if ((event.target as HTMLElement).classList.contains('mfp-container')) {
      this.closePop(); // Close when clicking outside
    }
  }

  closePop(validation?: boolean) {
    if (validation) {
      localStorage.removeItem(this.OTP_TIMER_KEY);
    }
    setTimeout(() => {
      this.activeModal.close({
        validation: validation,
        sessionId: this.verificationData.sessionId ?? null
      });
    }, 75);
  }

  verifyStep1() {
    if (this.otpTimer) {
      return;
    }
    if (!this.verificationData.phoneNumber) {
      this.alertService.showAlert({ title: "Please enter valid phone" });
      return;
    }
    this.loadingService.showLoadingSpinner();
    this.authService.getOtp({
      type: 'validate',
      phone: this.verificationData.phoneCode + this.verificationData.phoneNumber,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.startOtpTimer(30);
          this.verificationData.sessionId = responseData.data.sessionId;
        } else {
          this.alertService.showAlert({ title: responseData.msg || responseData.message });
          this.closePop();
        }
      },
      error: (err: any) => {
        this.loadingService.hideLoadingSpinner();
        this.alertService.showAlert({
          title: "Too many requests! Please try again after few seconds."
        });
        this.closePop();
      },
    });

  }

  verifyStep2() {
    if (!this.verificationData.otp) {
      this.alertService.showAlert({ title: "Please enter valid otp" });
      return;
    }
    if (!this.verificationData.sessionId) {
      return;
    }
    this.loadingService.showLoadingSpinner();
    this.authService.validateOtp({
      otp: this.verificationData.otp,
      sessionId: this.verificationData.sessionId
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.closePop(true);
        } else {
          if (responseData.data.registerationFailed) {
            this.otpTimer = 0;
            this.alertService.showAlert({ title: "Failed to verification" });
            this.closePop();
          } else {
            this.alertService.showAlert({ title: "Please enter valid otp" });
          }
        }
      },
      error: (err: any) => {
        this.loadingService.hideLoadingSpinner();
        this.logger.error(err?.message, { stack: err?.stack, context: 'PhoneVerificationComponent' });
      },
    });
  }

  resend() {
    this.verificationData.otp = '';
    this.verifyStep1();
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
