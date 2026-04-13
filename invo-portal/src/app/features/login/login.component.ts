import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';
import { TwoFaDialogComponent } from './components/two-fa-dialog.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TwoFaDialogComponent],
  template: `
    <div class="login-wrapper">
      <!-- ==================== Left Branding Panel ==================== -->
      <div class="login-branding">
        <div class="branding-content">
          <div class="brand-logo">
            <span class="logo-icon">◆</span>
            <span class="logo-text">invo</span>
          </div>
          <div class="brand-illustration">
            <svg viewBox="0 0 400 300" fill="none">
              <circle cx="200" cy="150" r="120" stroke="rgba(255,255,255,0.08)" stroke-width="1" fill="none"/>
              <circle cx="200" cy="150" r="80" stroke="rgba(255,255,255,0.12)" stroke-width="1" fill="none"/>
              <circle cx="200" cy="150" r="40" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" fill="none"/>
              <path d="M200 30 L200 270" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
              <path d="M80 150 L320 150" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
              <circle cx="200" cy="30" r="4" fill="rgba(255,255,255,0.4)" class="dot-pulse"/>
              <circle cx="320" cy="150" r="4" fill="rgba(255,255,255,0.4)" class="dot-pulse d1"/>
              <circle cx="200" cy="270" r="4" fill="rgba(255,255,255,0.4)" class="dot-pulse d2"/>
              <circle cx="80" cy="150" r="4" fill="rgba(255,255,255,0.4)" class="dot-pulse d3"/>
              <rect x="175" y="125" width="50" height="50" rx="8" fill="rgba(255,255,255,0.08)" transform="rotate(45 200 150)"/>
            </svg>
          </div>
          <div class="brand-tagline">
            <h2>Manage your business<br>with confidence</h2>
            <p>Streamlined invoicing, smart analytics, and seamless workflows — all in one platform.</p>
          </div>
        </div>
        <div class="branding-footer">
          <div class="feature-pills">
            <span class="pill">Invoicing</span>
            <span class="pill">Inventory</span>
            <span class="pill">Analytics</span>
            <span class="pill">POS</span>
          </div>
        </div>
      </div>

      <!-- ==================== Right Form Panel ==================== -->
      <div class="login-form-panel">
        <div class="form-container">

          <!-- ========= LOGIN ========= -->
          @if (formMode() === 'login') {
            <div class="form-header">
              <h1>Welcome back</h1>
              <p>Sign in to your invo account</p>
            </div>

            <form [formGroup]="loginForm" (ngSubmit)="onLogin()">
              <!-- Alerts -->
              @if (error()) {
                <div class="alert alert-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <span>{{ error() }}</span>
                </div>
              }
              @if (success()) {
                <div class="alert alert-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <span>{{ success() }}</span>
                </div>
              }

              <!-- Email -->
              <div class="form-group">
                <label for="login-email">Email address</label>
                <div class="input-wrapper" [class.has-error]="submitted() && loginForm.controls['email'].errors">
                  <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <input type="text" id="login-email" formControlName="email" placeholder="name&#64;company.com" />
                </div>
                @if (submitted() && loginForm.controls['email'].errors) {
                  <div class="field-error">
                    @if (loginForm.controls['email'].errors['required']) { <span>Email is required</span> }
                    @if (loginForm.controls['email'].errors['email']) { <span>Please enter a valid email address</span> }
                  </div>
                }
              </div>

              <!-- Password -->
              <div class="form-group">
                <div class="label-row">
                  <label for="login-pass">Password</label>
                  <a href="javascript:void(0)" (click)="switchMode('forgetPassword')" class="forgot-link">Forgot password?</a>
                </div>
                <div class="input-wrapper" [class.has-error]="submitted() && loginForm.controls['password'].errors">
                  <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  <input [type]="showPass() ? 'text' : 'password'" id="login-pass" formControlName="password" placeholder="Enter your password" />
                  <button type="button" class="toggle-pass" (click)="showPass.set(!showPass())">
                    @if (!showPass()) {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    } @else {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    }
                  </button>
                </div>
                @if (submitted() && loginForm.controls['password'].errors) {
                  <div class="field-error"><span>Password is required</span></div>
                }
              </div>

              <!-- Remember -->
              <div class="form-group-inline">
                <label class="checkbox-wrap">
                  <input type="checkbox" />
                  <span class="check"></span>
                  <span>Remember me</span>
                </label>
              </div>

              <!-- Submit -->
              <button class="btn-submit" type="submit" [disabled]="loading()">
                @if (loading()) {
                  <span class="spinner"></span>
                } @else {
                  <span>Sign In</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                }
              </button>
            </form>
          }

          <!-- ========= FORGOT PASSWORD ========= -->
          @if (formMode() === 'forgetPassword') {
            <div class="form-header">
              <button class="back-btn" (click)="switchMode('login')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
              </button>
              <h1>Reset password</h1>
              <p>Enter your email to receive a reset code</p>
            </div>

            <form [formGroup]="forgetForm" (ngSubmit)="onForgetPassword()">
              @if (error()) {
                <div class="alert alert-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span>{{ error() }}</span>
                </div>
              }

              <div class="form-group">
                <label>Email address</label>
                <div class="input-wrapper" [class.has-error]="submitted() && forgetForm.controls['email'].errors">
                  <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input type="text" formControlName="email" placeholder="name&#64;company.com" />
                </div>
                @if (submitted() && forgetForm.controls['email'].errors) {
                  <div class="field-error">
                    @if (forgetForm.controls['email'].errors['required']) { <span>Email is required</span> }
                    @if (forgetForm.controls['email'].errors['email']) { <span>Please enter a valid email</span> }
                  </div>
                }
              </div>

              <div class="btn-row">
                <button type="button" class="btn-secondary" (click)="switchMode('login')">Back</button>
                <button class="btn-submit" type="submit" [disabled]="loading()">
                  @if (loading()) { <span class="spinner"></span> }
                  @else {
                    <span>Send Code</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  }
                </button>
              </div>
            </form>
          }

          <!-- ========= OTP ========= -->
          @if (formMode() === 'sendOTP') {
            <div class="form-header">
              <div class="icon-badge">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <h1>Verify OTP</h1>
              <p>Enter the code sent to your email</p>
            </div>

            <form [formGroup]="otpForm" (ngSubmit)="onSubmitOTP()">
              @if (success()) {
                <div class="alert alert-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span>{{ success() }}</span>
                </div>
              }
              @if (error()) {
                <div class="alert alert-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span>{{ error() }}</span>
                </div>
              }

              <div class="form-group">
                <label>One-Time Password</label>
                <div class="input-wrapper">
                  <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <input type="text" formControlName="OTP" placeholder="Enter OTP code" />
                </div>
                @if (submitted() && otpForm.controls['OTP'].errors) {
                  <div class="field-error"><span>OTP is required</span></div>
                }
              </div>

              <button class="btn-submit" type="submit" [disabled]="loading() || otpForm.controls['OTP'].errors">
                <span>Verify</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </form>
          }

          <!-- ========= RESET PASSWORD ========= -->
          @if (formMode() === 'resetPassword') {
            <div class="form-header">
              <div class="icon-badge">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </div>
              <h1>Set new password</h1>
              <p>Create a strong, secure password</p>
            </div>

            <form [formGroup]="resetForm" (ngSubmit)="onSubmitReset()">
              @if (warning()) {
                <div class="alert alert-warning">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span>{{ warning() }}</span>
                </div>
              }

              <div class="form-group">
                <label>New Password</label>
                <div class="input-wrapper" [class.has-error]="resetForm.controls['password'].errors && resetForm.controls['password'].touched">
                  <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  <input [type]="showPass() ? 'text' : 'password'" formControlName="password" placeholder="Enter new password" />
                  <button type="button" class="toggle-pass" (click)="showPass.set(!showPass())">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                @if (resetForm.controls['password'].errors && resetForm.controls['password'].touched) {
                  <div class="field-error">
                    @if (resetForm.controls['password'].errors['required']) { <span>Password is required</span> }
                    @if (resetForm.controls['password'].errors['minlength']) { <span>Must be at least 8 characters</span> }
                  </div>
                }
              </div>

              <div class="form-group">
                <label>Confirm Password</label>
                <div class="input-wrapper" [class.has-error]="resetForm.controls['confirmPassword'].errors && resetForm.controls['confirmPassword'].touched">
                  <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <input [type]="showPass() ? 'text' : 'password'" formControlName="confirmPassword" placeholder="Confirm your password" />
                </div>
                @if (resetForm.controls['confirmPassword'].errors && resetForm.controls['confirmPassword'].touched) {
                  <div class="field-error">
                    @if (resetForm.controls['confirmPassword'].errors['required']) { <span>Confirm password is required</span> }
                    @if (resetForm.controls['confirmPassword'].errors['mismatch']) { <span>Passwords do not match</span> }
                  </div>
                }
              </div>

              <button class="btn-submit" type="submit" [disabled]="loading() || resetForm.invalid">
                <span>Save Password</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </form>
          }

          <!-- Footer -->
          <div class="form-footer">
            <p>&copy; {{ year }} Invo 5</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 2FA Dialog -->
    @if (show2FA()) {
      <app-two-fa-dialog
        [accessToken]="temporaryAccessToken"
        [email]="loginForm.controls['email'].value"
        [qrCode]="twoFaQrCode"
        [codeStr]="twoFaCode"
        [action]="twoFaAction"
        (verified)="on2FAVerified($event)"
        (dismiss)="show2FA.set(false)"
      />
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }

    /* ==================== Layout ==================== */
    .login-wrapper {
      display: flex;
      height: 100vh;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* ==================== Branding Panel ==================== */
    .login-branding {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: linear-gradient(160deg, #143742 0%, #1e5f6e 50%, #287a8a 100%);
      padding: 40px;
      position: relative;
      overflow: hidden;
    }

    .login-branding::before {
      content: '';
      position: absolute;
      top: -50%; right: -30%;
      width: 80%; height: 200%;
      background: radial-gradient(ellipse, rgba(50,172,193,0.15) 0%, transparent 70%);
      pointer-events: none;
    }

    .branding-content {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 48px;
    }

    .logo-icon { font-size: 24px; color: #32acc1; }
    .logo-text { font-size: 24px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }

    .brand-illustration svg {
      width: 100%;
      max-width: 360px;
      height: auto;
      margin-bottom: 48px;
    }

    .dot-pulse { animation: pulse 2s ease-in-out infinite; }
    .d1 { animation-delay: 0.5s; }
    .d2 { animation-delay: 1s; }
    .d3 { animation-delay: 1.5s; }

    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }

    .brand-tagline h2 {
      font-size: 32px;
      font-weight: 700;
      color: #fff;
      line-height: 1.25;
      letter-spacing: -0.5px;
      margin: 0 0 16px;
    }

    .brand-tagline p {
      font-size: 15px;
      color: rgba(255,255,255,0.6);
      line-height: 1.6;
      margin: 0;
      max-width: 400px;
    }

    .branding-footer { position: relative; z-index: 1; }

    .feature-pills { display: flex; gap: 8px; flex-wrap: wrap; }

    .pill {
      padding: 6px 14px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
      color: rgba(255,255,255,0.7);
    }

    /* ==================== Form Panel ==================== */
    .login-form-panel {
      width: 480px;
      min-width: 480px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      padding: 40px;
      overflow-y: auto;
    }

    .form-container { width: 100%; max-width: 360px; }

    /* ==================== Header ==================== */
    .form-header { margin-bottom: 32px; }
    .form-header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 8px;
      letter-spacing: -0.3px;
    }
    .form-header p { font-size: 14px; color: #6b7280; margin: 0; }

    .back-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px; height: 36px;
      background: #f3f4f6;
      border: none;
      border-radius: 8px;
      color: #6b7280;
      cursor: pointer;
      margin-bottom: 16px;
      transition: all 0.2s;
    }
    .back-btn:hover { background: #e5e7eb; color: #111827; }

    .icon-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px; height: 48px;
      background: #d9f2f6;
      border-radius: 12px;
      color: #32acc1;
      margin-bottom: 16px;
    }

    /* ==================== Alerts ==================== */
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 20px;
      line-height: 1.4;
    }
    .alert svg { flex-shrink: 0; margin-top: 1px; }
    .alert-error {
      background: rgba(239,68,68,0.08);
      color: #ef4444;
      border: 1px solid rgba(239,68,68,0.15);
    }
    .alert-success {
      background: rgba(16,185,129,0.08);
      color: #059669;
      border: 1px solid rgba(16,185,129,0.15);
    }
    .alert-warning {
      background: rgba(245,158,11,0.08);
      color: #b45309;
      border: 1px solid rgba(245,158,11,0.15);
    }

    /* ==================== Form Controls ==================== */
    .form-group { margin-bottom: 20px; }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #111827;
      margin-bottom: 6px;
    }

    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .label-row label { margin-bottom: 0; }

    .forgot-link {
      font-size: 13px;
      font-weight: 500;
      color: #32acc1;
      text-decoration: none;
    }
    .forgot-link:hover { color: #2b95a8; }

    .input-wrapper {
      display: flex;
      align-items: center;
      border: 1.5px solid #e5e7eb;
      border-radius: 8px;
      padding: 0 12px;
      height: 44px;
      background: #fff;
      transition: all 0.2s;
    }
    .input-wrapper:focus-within {
      border-color: #32acc1;
      box-shadow: 0 0 0 3px rgba(50,172,193,0.1);
    }
    .input-wrapper.has-error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239,68,68,0.08);
    }

    .input-icon {
      flex-shrink: 0;
      color: #9ca3af;
      margin-right: 10px;
    }

    .input-wrapper input {
      flex: 1;
      height: 100%;
      border: none;
      background: transparent;
      font-size: 14px;
      font-family: inherit;
      color: #111827;
      outline: none;
    }
    .input-wrapper input::placeholder { color: #9ca3af; }

    .toggle-pass {
      display: flex;
      align-items: center;
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #9ca3af;
      margin-left: 4px;
    }
    .toggle-pass:hover { color: #6b7280; }

    .field-error { margin-top: 6px; }
    .field-error span {
      display: block;
      font-size: 12px;
      color: #ef4444;
      line-height: 1.4;
    }

    /* ==================== Checkbox ==================== */
    .form-group-inline { margin-bottom: 24px; }

    .checkbox-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 13px;
      color: #6b7280;
    }
    .checkbox-wrap input { display: none; }

    .check {
      width: 18px; height: 18px;
      border: 1.5px solid #e5e7eb;
      border-radius: 4px;
      position: relative;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .checkbox-wrap input:checked + .check {
      background: #32acc1;
      border-color: #32acc1;
    }
    .checkbox-wrap input:checked + .check::after {
      content: '';
      position: absolute;
      left: 5px; top: 2px;
      width: 5px; height: 9px;
      border: solid white;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    /* ==================== Buttons ==================== */
    .btn-submit {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      height: 44px;
      background: #32acc1;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-submit:hover:not(:disabled) {
      background: #2b95a8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(50,172,193,0.3);
    }
    .btn-submit:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      padding: 0 24px;
      background: #f3f4f6;
      color: #111827;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-secondary:hover { background: #e5e7eb; }

    .btn-row { display: flex; gap: 12px; }
    .btn-row .btn-submit { flex: 1; }

    /* Spinner */
    .spinner {
      width: 20px; height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ==================== Footer ==================== */
    .form-footer {
      margin-top: 40px;
      text-align: center;
    }
    .form-footer p {
      font-size: 12px;
      color: #9ca3af;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ==================== Responsive ==================== */
    @media (max-width: 960px) {
      .login-wrapper { flex-direction: column; }
      .login-branding { padding: 32px 24px; flex: none; }
      .brand-illustration, .feature-pills { display: none; }
      .brand-tagline p { display: none; }
      .brand-tagline h2 { font-size: 22px; }
      .login-form-panel { width: 100%; min-width: 100%; flex: 1; padding: 32px 24px; }
    }

    @media (max-width: 480px) {
      .login-branding { padding: 24px 20px; }
      .brand-tagline h2 { font-size: 18px; }
      .login-form-panel { padding: 24px 20px; }
      .form-container { max-width: 100%; }
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // State signals
  formMode = signal<'login' | 'forgetPassword' | 'sendOTP' | 'resetPassword'>('login');
  submitted = signal(false);
  loading = signal(false);
  showPass = signal(false);
  error = signal('');
  success = signal('');
  warning = signal('');
  show2FA = signal(false);

  year = new Date().getFullYear();
  returnUrl = '/';

  // 2FA state
  temporaryAccessToken = '';
  twoFaQrCode = '';
  twoFaCode = '';
  twoFaAction = 'unset';

  // Password reset state
  sessionId = '';
  otpValue = '';

  // Forms
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  forgetForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  otpForm: FormGroup = this.fb.group({
    OTP: ['', [Validators.required]],
  });

  resetForm: FormGroup = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  constructor() {
    // Password match validation
    this.resetForm.controls['confirmPassword'].addValidators((control) => {
      if (control.value !== this.resetForm?.controls['password']?.value) {
        return { mismatch: true };
      }
      return null;
    });
  }

  ngOnInit() {
    const encoded = this.route.snapshot.queryParams['returnUrl'] || '/';
    this.returnUrl = decodeURIComponent(encoded);
  }

  // ==================== Mode switching ====================

  switchMode(mode: 'login' | 'forgetPassword' | 'sendOTP' | 'resetPassword') {
    this.error.set('');
    this.success.set('');
    this.warning.set('');
    this.submitted.set(false);
    this.formMode.set(mode);
  }

  // ==================== Login ====================

  async onLogin() {
    const email = this.loginForm.controls['email'].value?.trim();
    if (email) this.loginForm.controls['email'].setValue(email);

    this.submitted.set(true);

    if (this.loginForm.invalid) {
      this.submitted.set(false);
      if (this.loginForm.controls['email'].errors?.['email']) {
        this.error.set('Please enter a valid email');
      }
      return;
    }

    this.loading.set(true);
    try {
      const data = await this.auth.authenticate(email, this.loginForm.controls['password'].value);
      this.temporaryAccessToken = data.data.temporaryAccessToken || '';

      if (data.success) {
        if (data.data.apply2fa) {
          this.twoFaAction = 'unset';
          this.show2FA.set(true);
        } else {
          this.handleLoginSuccess(data);
        }
      } else {
        this.error.set(data.msg || 'Login failed');
      }
    } catch (err: any) {
      this.success.set('');
      this.error.set(err?.error?.msg || 'An error occurred');
    } finally {
      this.loading.set(false);
    }
  }

  handleLoginSuccess(data: any) {
    this.error.set('');
    this.warning.set('');
    this.success.set('Signed in successfully');
    this.auth.storeAccessToken(data.data);
    this.router.navigateByUrl(this.returnUrl || '/dashboard');
  }

  // ==================== 2FA ====================

  async on2FAVerified(result: { pincode?: string; OTP?: string; isOTP?: boolean }) {
    try {
      if (result.isOTP && result.OTP) {
        const res = await this.auth.validateOTP(this.temporaryAccessToken, result.OTP);
        if (res.success) {
          this.show2FA.set(false);
          this.handleLoginSuccess(res);
        }
      } else if (result.pincode) {
        const res = await this.auth.validate2FaCode(this.temporaryAccessToken, result.pincode);
        if (res.success) {
          this.show2FA.set(false);
          this.handleLoginSuccess(res);
        } else {
          this.error.set('Wrong code. Please try again.');
          this.show2FA.set(true);
        }
      }
    } catch {
      this.error.set('Verification failed');
    }
  }

  // ==================== Forgot Password ====================

  async onForgetPassword() {
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
        if (data.data.sessionId) {
          this.sessionId = data.data.sessionId;
          this.switchMode('sendOTP');
          this.success.set('OTP sent to your email');
        }
      } else {
        this.error.set(data.msg);
      }
    } catch (err: any) {
      this.error.set(err?.error?.msg || 'Failed to send reset email');
    } finally {
      this.loading.set(false);
    }
  }

  // ==================== OTP ====================

  async onSubmitOTP() {
    const otp = this.otpForm.controls['OTP'].value?.trim();
    if (otp) this.otpForm.controls['OTP'].setValue(otp);

    this.submitted.set(true);
    if (this.otpForm.invalid) { this.submitted.set(false); return; }

    if (!this.sessionId) return;

    this.loading.set(true);
    this.otpValue = otp;
    try {
      const data = await this.auth.checkOTP(this.otpValue, this.sessionId);
      if (data.success) {
        this.switchMode('resetPassword');
      } else {
        this.error.set(data.msg);
      }
    } catch (err: any) {
      this.error.set(err?.error?.msg || 'Invalid OTP');
    } finally {
      this.loading.set(false);
    }
  }

  // ==================== Reset Password ====================

  async onSubmitReset() {
    this.submitted.set(true);
    if (this.resetForm.invalid) { this.submitted.set(false); return; }

    this.loading.set(true);
    try {
      const data = await this.auth.setNewPassword(
        this.sessionId,
        this.otpValue,
        this.resetForm.controls['password'].value
      );
      if (data.success) {
        this.switchMode('login');
        this.success.set('Password changed successfully!');
      } else {
        this.error.set(data.msg);
      }
    } catch (err: any) {
      this.error.set(err?.error?.msg || 'Failed to reset password');
    } finally {
      this.loading.set(false);
    }
  }
}
