import { Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChildren, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-two-fa-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- Backdrop -->
    <div class="dialog-backdrop" (click)="dismiss.emit()"></div>

    <div class="dialog-panel">
      <!-- Close button -->
      <button class="dialog-close" (click)="dismiss.emit()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <!-- 2FA Pincode Mode -->
      @if (!isRecoveryCode()) {
        <form (ngSubmit)="submitPincode()">
          <div class="dialog-body">
            <div class="dialog-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>

            <h2>Two-Factor Authentication</h2>

            <!-- Setup: QR / Manual -->
            @if (action === 'setup') {
              <div class="setup-section">
                @if (codeMode() === 'scan') {
                  <p class="desc">Open your authenticator app and scan the QR code</p>
                  <div class="qr-box">
                    <img [src]="qrCode" width="120" height="120" alt="QR Code" />
                  </div>
                  <a href="javascript:void(0)" (click)="toggleCodeMode()" class="link">Trouble scanning?</a>
                } @else {
                  <p class="desc">Enter this code manually in your authenticator app</p>
                  <div class="manual-code">{{ codeStr }}</div>
                  <button type="button" class="btn-copy" (click)="copyCode()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    {{ copied() ? 'Copied!' : 'Copy Code' }}
                  </button>
                  <a href="javascript:void(0)" (click)="toggleCodeMode()" class="link">Scan QR code instead</a>
                }
              </div>
            }

            <p class="desc pin-label">Enter 6-digit code from your authenticator app</p>

            <div class="pincode-row" [class.error]="pinError() === true" [class.success]="pinError() === false">
              @for (control of pincodeControls.controls; track $index) {
                <input
                  type="tel"
                  class="pin-input"
                  maxlength="1"
                  pattern="\\d*"
                  autocomplete="off"
                  [formControl]="asPinControl($index)"
                  (input)="onPinInput($event, $index)"
                  (keydown)="onPinBackspace($event, $index)"
                  #pinInputs
                />
              }
            </div>

            <button type="submit" class="btn-primary-full" [disabled]="!isPincodeComplete()">
              Continue
            </button>

            @if (action !== 'setup') {
              <a href="javascript:void(0)" (click)="isRecoveryCode.set(true); sendRecoveryEmail()" class="link alt">
                Try another method
              </a>
            }
          </div>
        </form>
      }

      <!-- Recovery / OTP via email mode -->
      @if (isRecoveryCode()) {
        <form (ngSubmit)="submitOTP()">
          <div class="dialog-body">
            <div class="dialog-icon recovery">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>

            <h2>Verify Your Identity</h2>
            <p class="desc">We've sent a code to <strong>{{ maskedEmail }}</strong></p>
            <p class="desc pin-label">Enter the 6-digit code from your email</p>

            <div class="pincode-row" [class.error]="otpError() === true" [class.success]="otpError() === false">
              @for (control of otpControls.controls; track $index) {
                <input
                  type="text"
                  class="pin-input"
                  maxlength="1"
                  autocomplete="off"
                  [formControl]="asOtpControl($index)"
                  (input)="onOtpInput($event, $index)"
                  (keydown)="onOtpBackspace($event, $index)"
                  #otpInputs
                />
              }
            </div>

            <button type="submit" class="btn-primary-full" [disabled]="!isOtpComplete()">
              Continue
            </button>

            <a href="javascript:void(0)" (click)="isRecoveryCode.set(false)" class="link alt">
              Use authenticator app instead
            </a>
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    /* Backdrop */
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }

    /* Panel */
    .dialog-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      z-index: 1001;
      width: 420px;
      max-width: 95vw;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideIn 0.25s ease;
    }

    .dialog-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f3f4f6;
      border: none;
      border-radius: 8px;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
    }

    .dialog-close:hover {
      background: #e5e7eb;
      color: #111827;
    }

    /* Body */
    .dialog-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 40px 32px 32px;
    }

    .dialog-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: #d9f2f6;
      color: #32acc1;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }

    .dialog-icon.recovery {
      background: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
    }

    h2 {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 8px;
      letter-spacing: -0.3px;
    }

    .desc {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
      margin: 0 0 16px;
      max-width: 300px;
    }

    .desc strong { color: #111827; }
    .desc.pin-label {
      font-weight: 500;
      color: #111827;
      margin-bottom: 12px;
    }

    /* Setup section */
    .setup-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      padding-bottom: 24px;
      margin-bottom: 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .qr-box {
      padding: 16px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .qr-box img { display: block; border-radius: 4px; }

    .manual-code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 1px;
      padding: 12px 20px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      width: 100%;
      max-width: 280px;
      text-align: center;
      word-break: break-all;
      margin-bottom: 12px;
      color: #111827;
    }

    .btn-copy {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: transparent;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 8px;
    }

    .btn-copy:hover {
      background: #f9fafb;
      color: #111827;
    }

    .link {
      font-size: 13px;
      font-weight: 500;
      color: #32acc1;
      text-decoration: none;
      transition: color 0.2s;
    }

    .link:hover { color: #2b95a8; }
    .link.alt { margin-top: 16px; }

    /* Pincode row */
    .pincode-row {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }

    .pin-input {
      width: 44px;
      height: 52px;
      text-align: center;
      font-size: 20px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      color: #111827;
      border: 1.5px solid #e5e7eb;
      border-radius: 8px;
      background: #fff;
      outline: none;
      transition: all 0.2s;
    }

    .pin-input:focus {
      border-color: #32acc1;
      box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.1);
    }

    .pincode-row.error .pin-input {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.04);
      color: #ef4444;
      animation: shake 0.4s ease;
    }

    .pincode-row.error .pin-input:focus {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .pincode-row.success .pin-input {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.04);
      color: #10b981;
    }

    /* Submit */
    .btn-primary-full {
      width: 100%;
      max-width: 280px;
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

    .btn-primary-full:hover:not(:disabled) {
      background: #2b95a8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(50, 172, 193, 0.3);
    }

    .btn-primary-full:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translate(-50%, -48%); }
      to { opacity: 1; transform: translate(-50%, -50%); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }

    input[type="tel"]::-webkit-inner-spin-button,
    input[type="tel"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  `]
})
export class TwoFaDialogComponent {
  @Input() accessToken = '';
  @Input() email = '';
  @Input() qrCode = '';
  @Input() codeStr = '';
  @Input() action = 'unset'; // 'setup' | 'unset'

  @Output() verified = new EventEmitter<{ pincode?: string; OTP?: string; isOTP?: boolean }>();
  @Output() dismiss = new EventEmitter<void>();

  @ViewChildren('pinInputs') pinInputElements!: QueryList<ElementRef>;
  @ViewChildren('otpInputs') otpInputElements!: QueryList<ElementRef>;

  private fb = new FormBuilder();
  private auth: AuthService;

  pincodeForm: FormGroup;
  isRecoveryCode = signal(false);
  codeMode = signal<'scan' | 'manual'>('scan');
  pinError = signal<boolean | null>(null);
  otpError = signal<boolean | null>(null);
  copied = signal(false);

  get maskedEmail(): string {
    if (!this.email) return '***';
    const [user, domain] = this.email.split('@');
    if (!domain) return '***';
    const visible = user.substring(0, Math.min(2, user.length));
    return `${visible}***@${domain}`;
  }

  get pincodeControls(): FormArray {
    return this.pincodeForm.get('pincode') as FormArray;
  }

  get otpControls(): FormArray {
    return this.pincodeForm.get('otp') as FormArray;
  }

  constructor(auth: AuthService) {
    this.auth = auth;
    this.pincodeForm = this.fb.group({
      pincode: this.fb.array(Array(6).fill('').map(() => [''])),
      otp: this.fb.array(Array(6).fill('').map(() => ['']))
    });
  }

  asPinControl(i: number): FormControl {
    return this.pincodeControls.controls[i] as FormControl;
  }

  asOtpControl(i: number): FormControl {
    return this.otpControls.controls[i] as FormControl;
  }

  // ==================== Pin Inputs ====================

  onPinInput(event: any, index: number) {
    const value = event.target.value;
    if (!/^\d$/.test(value)) { event.target.value = ''; return; }
    if (index < 5) {
      this.pinInputElements.toArray()[index + 1].nativeElement.focus();
    } else {
      this.validatePincode();
    }
  }

  onPinBackspace(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && index > 0 && !(event.target as HTMLInputElement).value) {
      this.pinInputElements.toArray()[index - 1].nativeElement.focus();
    }
    if (this.getPincode().length === 0) this.pinError.set(null);
  }

  // ==================== OTP Inputs ====================

  onOtpInput(event: any, index: number) {
    if (index < 5) {
      this.otpInputElements.toArray()[index + 1].nativeElement.focus();
    }
  }

  onOtpBackspace(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && index > 0 && !(event.target as HTMLInputElement).value) {
      this.otpInputElements.toArray()[index - 1].nativeElement.focus();
    }
    if (this.getOtp().length === 0) this.otpError.set(null);
  }

  // ==================== Helpers ====================

  private getPincode(): string {
    return this.pincodeForm.value.pincode.join('');
  }

  private getOtp(): string {
    return this.pincodeForm.value.otp.join('');
  }

  isPincodeComplete(): boolean {
    return this.getPincode().length === 6;
  }

  isOtpComplete(): boolean {
    return this.getOtp().length === 6;
  }

  toggleCodeMode() {
    this.codeMode.set(this.codeMode() === 'scan' ? 'manual' : 'scan');
  }

  copyCode() {
    navigator.clipboard.writeText(this.codeStr).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  sendRecoveryEmail() {
    this.auth.reset2fa(this.accessToken);
  }

  // ==================== Validation ====================

  private debounceTimer: any;

  async validatePincode() {
    const pin = this.getPincode();
    if (pin.length !== 6) return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      const result = await this.auth.validate2FaCode(this.accessToken, pin);
      this.pinError.set(!result.success);
    }, 50);
  }

  // ==================== Submit ====================

  submitPincode() {
    const pincode = this.getPincode();
    if (pincode.length !== 6) return;
    this.verified.emit({ pincode });
  }

  submitOTP() {
    const OTP = this.getOtp();
    if (OTP.length !== 6) return;
    this.verified.emit({ OTP, isOTP: true });
  }
}
