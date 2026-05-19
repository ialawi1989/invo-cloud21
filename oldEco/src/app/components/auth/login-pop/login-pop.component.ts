import { Component, HostListener, Inject, OnInit, PLATFORM_ID, inject, OnDestroy} from '@angular/core';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { AuthService } from '../../../services/authService/auth.service';
import { LoadingService } from '../../../services/loadingService/loading.service';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../../../services/alertService/alert.service';
import { HttpClient } from '@angular/common/http';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { isPlatformBrowser } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Company } from 'src/app/models/company.model';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { AppServices } from 'src/app/services/appServices';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-login-pop',
  imports: [
    FormsModule,
    NgSelectModule,
    TranslateModule
  ],
  templateUrl: './login-pop.component.html',
  styleUrl: './login-pop.component.css'
})
export class LoginPopComponent implements OnInit , OnDestroy{
  private destroy$ = new Subject<void>();
  private logger = inject(LoggerService);
  countries: any[] = [];
  step = "login-by-phone";

  loginData: any = { phoneCode: '' };
  resetPasswordData: any = { phoneCode: '' };
  registerData: any = { phoneCode: '' };
  otpTimer: any = 0;

  companyData: Company | any = new Company();

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private http: HttpClient,
    private authService: AuthService,
    private alertService: AlertService,
    private loadingService: LoadingService,
    public activeModal: NgbActiveModal,
    private companyService: CompanyServices,
    private appService: AppServices
  ) {

  }

  startOtpTimer(timer: number) {
    timer--;
    this.otpTimer = timer;
    setTimeout(() => {
      if (timer > 0) {
        this.startOtpTimer(timer);
      }
    }, 1000)
  }

  async ngOnInit() {

    this.getCompanyData();
    this.loginData.phoneCode = "+" + this.companyData.settings.countryCode;
    this.resetPasswordData.phoneCode = "+" + this.companyData.settings.countryCode;
    this.registerData.phoneCode = "+" + this.companyData.settings.countryCode;
    this.countries = this.appService.allCountries;
  }

  @HostListener('click', ['$event'])
  onClickOutside(event: Event) {
    if ((event.target as HTMLElement).classList.contains('mfp-container')) {
      this.closePop(); // Close when clicking outside
    }
  }

  closePop() {
    this.selectStep("login-by-phone");
    setTimeout(() => {
      this.activeModal.close();
    }, 75);
  }

  selectStep(stepStr: string) {
    if (stepStr == 'reset-password-by-phone-step1' || stepStr == 'reset-password-by-email-step1') {
      this.loginData = { phoneCode: `+${this.companyData.settings.countryCode}` };
      this.registerData = { phoneCode: `+${this.companyData.settings.countryCode}` };
      this.resetPasswordData.otp = '';
      this.resetPasswordData.sessionId = '';
    } else if (stepStr == 'register-step1') {
      this.loginData = { phoneCode: `+${this.companyData.settings.countryCode}` };
      this.resetPasswordData = { phoneCode: `+${this.companyData.settings.countryCode}` };
    } else if (stepStr == 'login-by-phone') {
      this.loginData = { phoneCode: `+${this.companyData.settings.countryCode}` };
      this.registerData = { phoneCode: `+${this.companyData.settings.countryCode}` };
      this.resetPasswordData = { phoneCode: `+${this.companyData.settings.countryCode}` };
    } else if (stepStr == 'login-by-email') {
      this.loginData = { phoneCode: `+${this.companyData.settings.countryCode}` };
      this.registerData = { phoneCode: `+${this.companyData.settings.countryCode}` };
      this.resetPasswordData = { phoneCode: `+${this.companyData.settings.countryCode}` };
    }
    this.step = stepStr;
  }

  getCompanyData() {
    this.companyService.companyData$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Company) => {
        this.companyData = data;
      },
    });
  }

  resetPasswordByPhoneStep1() {
    if (this.otpTimer || !this.isValidPhoneNumber(this.resetPasswordData.phoneNumber)) {
      return
    }
    this.loadingService.showLoadingSpinner();
    this.authService.getOtp({
      type: 'resetPassword',
      phone: this.resetPasswordData.phoneCode + this.resetPasswordData.phoneNumber,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.startOtpTimer(30);
          this.resetPasswordData.sessionId = responseData.data.sessionId;
          this.selectStep('reset-password-by-phone-step2');
        } else {
          this.alertService.showAlert({ title: responseData.msg || responseData.message });
        }
      },
      error: (err: any) => {
        this.loadingService.hideLoadingSpinner();
        this.alertService.showAlert({
          title: "Too many requests! Please try again after few seconds."
        });
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      },
    });
  }

  resetPasswordByEmailStep1() {
    if (!this.isValidEmail(this.resetPasswordData.email)) {
      return;
    }
    this.loadingService.showLoadingSpinner();
    this.authService.getOtp({
      type: 'resetPassword',
      email: this.resetPasswordData.email,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.startOtpTimer(30);
          this.resetPasswordData.sessionId = responseData.data.sessionId;
          this.selectStep('reset-password-by-email-step2');
        } else {
          this.alertService.showAlert({ title: responseData.msg || responseData.message });
        }
      },
      error: (err: any) => {
        this.loadingService.hideLoadingSpinner();
        this.alertService.showAlert({
          title: "Too many requests! Please try again after few seconds."
        });
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      },
    });
  }

  resetPasswordByPhoneStep2() {
    if (!this.isValidOtp(this.resetPasswordData.otp)) {
      return;
    }
    this.loadingService.showLoadingSpinner();
    this.authService.validateOtp({
      otp: this.resetPasswordData.otp,
      sessionId: this.resetPasswordData.sessionId
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.selectStep('reset-password-step3');
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
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      },
    });
  }

  resetPasswordByEmailStep2() {
    if (!this.isValidOtp(this.resetPasswordData.otp)) {
      return;
    }
    this.loadingService.showLoadingSpinner();
    this.authService.validateOtp({
      otp: this.resetPasswordData.otp,
      sessionId: this.resetPasswordData.sessionId
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.selectStep('reset-password-step3');
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
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      },
    });
  }

  // ✅ FIX #1: Corrected the OTP timer logic for reset password
  resendResetPasswordOtp() {
    if (this.otpTimer) {  // ✅ FIXED: Changed from !this.otpTimer to this.otpTimer
      return;  // Prevent resend while timer is running
    }

    // Determine which step we're on and resend accordingly
    if (this.step == "reset-password-by-phone-step2") {
      this.resetPasswordByPhoneStep1();
    } else if (this.step == "reset-password-by-email-step2") {
      this.resetPasswordByEmailStep1();
    }
  }

  resetPasswordStep3() {
    if ((!this.isValidPassword(this.resetPasswordData.password) || !this.isValidPassword(this.resetPasswordData.cpassword)) || this.resetPasswordData.password != this.resetPasswordData.cpassword) {
      return;
    }
    this.loadingService.showLoadingSpinner();
    this.authService.resetPassword({
      password: this.resetPasswordData.password,
      sessionId: this.resetPasswordData.sessionId
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.alertService.showAlert({ title: "Your password reset successfully" });
          this.selectStep('login-by-phone');
        } else {
          this.alertService.showAlert({ title: responseData.msg });
        }
      },
      error: (err: any) => {
        this.loadingService.hideLoadingSpinner();
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      },
    });
  }

  registerStep1() {
    if (!this.isValidName(this.registerData.name) || !this.isValidEmail(this.registerData.email) || !this.isValidPassword(this.registerData.password) || !this.isValidPassword(this.registerData.cpassword) || this.registerData.password != this.registerData.cpassword) {
      return;
    }

    this.loadingService.showLoadingSpinner();
    this.authService.signUp({
      name: this.registerData.name,
      email: this.registerData.email,
      password: this.registerData.password
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.registerData.shopper = responseData.data.shopper;
          this.authService.setUserData(this.registerData.shopper);
          this.authService.storeAccessToken(responseData);
          // this.selectStep('register-step2');
          this.closePop();
        } else {
          this.alertService.showAlert({ title: responseData.msg });
        }
      },
      error: (err: any) => {
        this.loadingService.hideLoadingSpinner();
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      },
    });
  }

  registerStep2() {
    if (!this.isValidPhoneNumber(this.registerData.phoneNumber)) {
      return;
    }
    this.loadingService.showLoadingSpinner();
    const payload: any = {
      ...this.registerData.shopper,
      phone: this.registerData.phoneCode + this.registerData.phoneNumber,
    };
    this.authService.updateShopper(payload)
    .pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData2: any) => {
        this.loadingService.hideLoadingSpinner();

        // ✅ FIX #3: Changed from if (responseData2 = []) to proper condition
        if (responseData2.success !== false) {
          this.authService.setUserData(this.registerData.shopper);
          this.authService.getOtp({
            type: 'register',
            phone: this.registerData.phoneCode + this.registerData.phoneNumber,
          }).pipe(takeUntil(this.destroy$)).subscribe({
            next: (responseData: any) => {
              this.loadingService.hideLoadingSpinner();
              if (responseData.success) {
                this.startOtpTimer(30);
                this.registerData.sessionId = responseData.data.sessionId;
                this.selectStep('register-step3');
              } else {
                this.alertService.showAlert({ title: responseData.msg || responseData.message });
              }
            },
            error: (err: any) => {
              this.loadingService.hideLoadingSpinner();
              this.alertService.showAlert({
                title: "Too many requests! Please try again after few seconds."
              });
              this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
            },
          });
        } else {
          this.alertService.showAlert({ title: responseData2.msg });
        }
      },
      error: (err: any) => {
        this.loadingService.hideLoadingSpinner();
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      }
    });
  }

  registerStep3() {
    if (!this.isValidOtp(this.registerData.otp)) {
      return;
    }
    if (!this.registerData.sessionId) {
      return;
    }
    this.loadingService.showLoadingSpinner();
    this.authService.validateOtp({
      otp: this.registerData.otp,
      sessionId: this.registerData.sessionId
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        this.registerData.shopper.phone = this.registerData.phoneCode + this.registerData.phoneNumber;
        if (responseData.success) {
          this.alertService.showAlert({ title: "You have logged in successfully" });
          this.registerData.shopper.isEmailValidated = responseData.data.isEmailValidated || false;
          this.registerData.shopper.isPhoneValidated = responseData.data.isPhoneValidated || false;
          this.authService.setUserData(this.registerData.shopper);
          this.closePop();
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
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      },
    });
  }

  // ✅ FIX #2: Added dedicated method for resending registration OTP
  resendRegisterOtp() {
    if (this.otpTimer) {  // Prevent resend while timer is running
      return;
    }

    // Call registerStep2 to resend OTP
    this.registerStep2();
  }

  loginByPhone() {
    if (!this.isValidPhoneNumber(this.loginData.phoneNumber) || !this.isValidPassword(this.loginData.password)) {
      return
    }
    this.loadingService.showLoadingSpinner();
    this.authService.login({
      phone: this.loginData.phoneCode + this.loginData.phoneNumber,
      password: this.loginData.password
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.authService.setUserData(responseData.data.shopper);
          this.authService.storeAccessToken(responseData);
          this.closePop();
          this.appService.windowLocationReload = true;
          window.location.reload();
        } else {
          this.alertService.showAlert({ title: responseData.msg });
        }
      },
      error: (err: any) => {
        this.loadingService.hideLoadingSpinner();
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      },
    });
  }

  loginByEmail() {
    if (!this.isValidEmail(this.loginData.email) || !this.isValidPassword(this.loginData.password)) {
      return;
    }
    this.loadingService.showLoadingSpinner();
    this.authService.login({
      email: this.loginData.email,
      password: this.loginData.password
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responseData: any) => {
        this.loadingService.hideLoadingSpinner();
        if (responseData.success) {
          this.authService.setUserData(responseData.data.shopper);
          this.authService.storeAccessToken(responseData);
          this.closePop();
          this.appService.windowLocationReload = true;
          window.location.reload();
        } else {
          this.alertService.showAlert({ title: responseData.msg });
        }
      },
      error: (err: any) => {
        this.loadingService.hideLoadingSpinner();
        this.logger.error(err?.message, { stack: err?.stack, context: 'LoginPopComponent' });
      },
    });
  }

  isValidPhoneNumber(phoneNumber: any) {
    const phone = phoneNumber?.toString() ?? '';
    return phone.length >= 8 && !/\s/.test(phone);
  }

  isValidName(str: string) {
    // Check if the name is empty
    if (!str) {
      return false;
    }
    // Remove leading and trailing spaces from the name
    str = str.trim();
    // Regular expression to match names with only letters, non-English characters, and spaces
    const regex = /^[\p{L}\s]+$/u;
    // Check if the name matches the regular expression
    if (!regex.test(str)) {
      return false;
    }
    return true;
  }

  isValidPassword(str: string) {
    return str?.length >= 6;
  }

  isValidEmail(str: string) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(str);
  }

  isValidOtp(str: string) {
    return str?.length == 6;
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}