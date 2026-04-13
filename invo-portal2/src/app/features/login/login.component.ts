import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ModalService } from '../../shared/modal/modal.service';
import { QrCodeTwoFaComponent, TwoFaResult, TwoFaModalData } from './components/qr-code-two-fa.component';
import { TermsAndConditionsComponent, TermsResult, TermsModalData } from './components/terms-and-conditions.component';

type FormMode = 'login' | 'forgetPassword' | 'sendOTP' | 'resetPassword';

function passwordValidator(control: AbstractControl): ValidationErrors | null {
  const val = control.value || '';
  if (!val) return null;
  const hasUpper = /[A-Z]/.test(val);
  const hasNum   = /[0-9]/.test(val);
  if (!hasUpper || !hasNum) return { passwordStrength: true };
  return null;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private modal  = inject(ModalService);

  // ── State signals ──────────────────────────────────────────────────────────
  formMode  = signal<FormMode>('login');
  submitted = signal(false);
  loading   = signal(false);
  showPass  = signal(false);
  error     = signal('');
  success   = signal('');
  warning   = signal('');

  // ── Temp auth state ────────────────────────────────────────────────────────
  private temporaryAccessToken = '';

  // ── Password reset state ───────────────────────────────────────────────────
  private sessionId = '';
  private otpValue  = '';

  year      = new Date().getFullYear();
  returnUrl = '/';

  // ── Forms ──────────────────────────────────────────────────────────────────
  loginForm: FormGroup = this.fb.group({
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required]],
    rememberMe: [false],
  });

  forgetForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  otpForm: FormGroup = this.fb.group({
    OTP: ['', [Validators.required]],
  });

  resetForm: FormGroup = this.fb.group({
    password:        ['', [Validators.required, Validators.minLength(8), passwordValidator]],
    confirmPassword: ['', [Validators.required]],
  });

  constructor() {
    this.resetForm.controls['confirmPassword'].addValidators((ctrl) =>
      ctrl.value !== this.resetForm.controls['password'].value ? { mismatch: true } : null
    );
  }

  ngOnInit(): void {
    const encoded = this.route.snapshot.queryParams['returnUrl'] || '/';
    this.returnUrl = decodeURIComponent(encoded);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  switchMode(mode: FormMode): void {
    this.error.set(''); this.success.set(''); this.warning.set('');
    this.submitted.set(false);
    this.formMode.set(mode);
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async onLogin(): Promise<void> {
    const email = this.loginForm.controls['email'].value?.trim();
    if (email) this.loginForm.controls['email'].setValue(email);

    this.submitted.set(true);
    if (this.loginForm.invalid) {
      this.submitted.set(false);
      if (this.loginForm.controls['email'].errors?.['email'])
        this.error.set('Please enter a valid email');
      return;
    }

    this.loading.set(true);
    try {
      const data = await this.auth.authenticate(
        email,
        this.loginForm.controls['password'].value,
        this.loginForm.controls['rememberMe'].value,
      );
      this.temporaryAccessToken = data.data?.temporaryAccessToken || '';

      if (data.success) {
        if (data.data?.apply2fa) {
          this.open2FA('unset');
        } else {
          this.handleLoginSuccess(data);
        }
      } else {
        this.error.set(data.msg || 'Login failed');
      }
    } catch (err: any) {
      this.error.set(err?.error?.msg || 'An error occurred');
    } finally {
      this.loading.set(false);
    }
  }

  private handleLoginSuccess(data: any): void {
    // ── Terms & Conditions gate ──────────────────────────────────────────────
    if (data?.data?.code === 'TERMS_REQUIRED') {
      this.openTerms(data.data.pendingLoginToken, data.data.terms);
      return;
    }
    // ── Normal success ───────────────────────────────────────────────────────
    this.error.set(''); this.warning.set('');
    this.success.set('Signed in successfully');
    this.auth.storeAccessToken(data.data);
    this.router.navigateByUrl(this.returnUrl || '/');
  }

  // ── 2FA modal ──────────────────────────────────────────────────────────────
  private open2FA(action: string, qrCode = '', codeStr = ''): void {
    const ref = this.modal.open<QrCodeTwoFaComponent, TwoFaModalData, TwoFaResult>(
      QrCodeTwoFaComponent,
      {
        size: 'sm',
        closeOnBackdrop: false,
        data: {
          accessToken: this.temporaryAccessToken,
          email:       this.loginForm.controls['email'].value,
          qrCode,
          codeStr,
          action,
        },
      }
    );

    ref.afterClosed().then(result => {
      if (!result) return; // dismissed
      // result already verified inside the component via auto-verify
      // so if we have a result, login was successful
      this.router.navigateByUrl(this.returnUrl || '/');
    });
  }

  // ── Terms modal ────────────────────────────────────────────────────────────
  private openTerms(pendingLoginToken: string, terms: any): void {
    const ref = this.modal.open<TermsAndConditionsComponent, TermsModalData, TermsResult>(
      TermsAndConditionsComponent,
      {
        size: 'lg',
        closeOnBackdrop: false,
        closeable: false,   // must use Decline button — can't X out of T&C
        data: { pendingLoginToken, terms },
      }
    );

    ref.afterClosed().then(result => {
      if (result?.accepted && result.data) {
        this.handleLoginSuccess({ data: result.data });
      } else if (result?.accepted === false) {
        this.error.set('You must accept the Terms & Conditions to continue.');
      }
    });
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  async onForgetPassword(): Promise<void> {
    const email = this.forgetForm.controls['email'].value?.trim();
    if (email) this.forgetForm.controls['email'].setValue(email);
    this.submitted.set(true);
    if (this.forgetForm.invalid) { this.submitted.set(false); return; }

    this.loading.set(true);
    try {
      const data = await this.auth.resetPassword(email);
      if (data.success) {
        this.error.set('');
        this.success.set('OTP sent to your email');
        if (data.data?.sessionId) { this.sessionId = data.data.sessionId; this.switchMode('sendOTP'); }
      } else { this.error.set(data.msg); }
    } catch (err: any) {
      this.error.set(err?.error?.msg || 'Failed to send reset email');
    } finally { this.loading.set(false); }
  }

  // ── OTP ────────────────────────────────────────────────────────────────────
  async onSubmitOTP(): Promise<void> {
    const otp = this.otpForm.controls['OTP'].value?.trim();
    if (otp) this.otpForm.controls['OTP'].setValue(otp);
    this.submitted.set(true);
    if (this.otpForm.invalid || !this.sessionId) { this.submitted.set(false); return; }

    this.loading.set(true);
    this.otpValue = otp;
    try {
      const data = await this.auth.checkOTP(otp, this.sessionId);
      if (data.success) { this.switchMode('resetPassword'); }
      else { this.error.set(data.msg); }
    } catch (err: any) {
      this.error.set(err?.error?.msg || 'Invalid OTP');
    } finally { this.loading.set(false); }
  }

  // ── Reset password ─────────────────────────────────────────────────────────
  async onSubmitReset(): Promise<void> {
    this.submitted.set(true);
    if (this.resetForm.invalid) { this.submitted.set(false); return; }

    this.loading.set(true);
    try {
      const data = await this.auth.setNewPassword(
        this.sessionId, this.otpValue, this.resetForm.controls['password'].value
      );
      if (data.success) { this.switchMode('login'); this.success.set('Password changed successfully!'); }
      else { this.error.set(data.msg); }
    } catch (err: any) {
      this.error.set(err?.error?.msg || 'Failed to reset password');
    } finally { this.loading.set(false); }
  }
}
