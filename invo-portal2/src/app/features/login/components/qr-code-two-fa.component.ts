import {
  Component, OnInit, inject,
  ElementRef, QueryList, ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { MODAL_DATA, MODAL_REF } from '../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../shared/modal/modal.service';

export interface TwoFaModalData {
  accessToken: string;
  email:       string;
  qrCode?:     string;
  codeStr?:    string;
  action?:     string;
}

export interface TwoFaResult {
  pincode?: string;
  OTP?:     string;
  isOTP?:   boolean;
}

@Component({
  selector: 'app-qr-code-two-fa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (!isRecoveryCode) {
      <form (ngSubmit)="done()">
        <div class="body">
          <h2 class="title">Two-Factor Authentication</h2>

          <!-- QR / Manual setup -->
          @if (data.action === 'setup') {
            <div class="setup-block">
              @if (codeMode === 'scan') {
                <p class="hint">Open your authenticator app and scan the QR code</p>
                <img [src]="data.qrCode" class="qr-img" width="120" height="120" alt="QR code"/>
                <a href="javascript:void(0)" (click)="toggleMode()">Trouble scanning?</a>
              } @else {
                <div class="code-box">{{ data.codeStr }}</div>
                <button type="button" class="btn-copy" (click)="copyCode()">Copy Code</button>
                <a href="javascript:void(0)" (click)="toggleMode()">Scan QR code instead</a>
              }
            </div>
          }

          <p class="hint">Enter the 6-digit code from your authenticator app</p>

          <div class="pincode-row"
               [class.pincode-error]="error === true"
               [class.pincode-success]="error === false">
            <input
              *ngFor="let ctrl of pincodeControls.controls; let i = index"
              type="tel" class="pin-input" maxlength="1" pattern="\\d*"
              [formControl]="getControl(i)"
              (input)="onInput($event, i)"
              (keydown)="onBackspace($event, i)"
              #pincodeInputs autocomplete="off"
            />
          </div>

          <button type="submit" class="btn-primary" [disabled]="checkDisable()">
            Continue
          </button>
          @if (data.action !== 'setup') {
            <a href="javascript:void(0)" (click)="toggleRecoveryMode()" class="alt-link">
              Try another method
            </a>
          }
        </div>
      </form>
    } @else {
      <form (ngSubmit)="done2()">
        <div class="body">
          <h2 class="title">Verify Your Identity</h2>
          <p class="hint">We've sent a code to <strong>{{ maskedEmail }}</strong></p>
          <p class="hint">Enter the 6-digit code from your email</p>

          <div class="pincode-row"
               [class.pincode-error]="error2 === true"
               [class.pincode-success]="error2 === false">
            <input
              *ngFor="let ctrl of OTPControls.controls; let i = index"
              type="text" class="pin-input" maxlength="1"
              [formControl]="getOTPControl(i)"
              (input)="onInput2($event, i)"
              (keydown)="onBackspace2($event, i)"
              #OTPInputs autocomplete="off"
            />
          </div>

          <button type="submit" class="btn-primary" [disabled]="checkDisable2()">
            Continue
          </button>
        </div>
      </form>
    }
  `,
  styles: [`
    :host { display: block; }
    .body {
      display: flex; flex-direction: column; align-items: center;
      gap: 16px; padding: 28px 24px 24px;
    }
    .title   { font-size: 18px; font-weight: 600; color: #111827; margin: 0; text-align: center; }
    .hint    { font-size: 13px; color: #6b7280; text-align: center; margin: 0; }
    .setup-block { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
    .qr-img  { border-radius: 8px; border: 1px solid #e5e7eb; }
    .code-box {
      font-family: monospace; font-size: 13px; background: #f3f4f6;
      padding: 10px 16px; border-radius: 8px; letter-spacing: 2px; word-break: break-all;
    }
    .btn-copy {
      padding: 8px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer;
      &:hover { background: #e5e7eb; }
    }

    .pincode-row { display: flex; gap: 8px; justify-content: center; }
    .pin-input {
      width: 44px; height: 52px; text-align: center; font-size: 20px; font-weight: 600;
      border: 1.5px solid #e5e7eb; border-radius: 10px; outline: none;
      transition: border-color .15s;
      &:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.1); }
    }
    .pincode-error   .pin-input { border-color: #ef4444; }
    .pincode-success .pin-input { border-color: #10b981; }

    .btn-primary {
      width: 100%; padding: 12px; background: #32acc1; color: #fff;
      border: none; border-radius: 10px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: background .2s;
      &:hover:not(:disabled) { background: #2b95a8; }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    .alt-link { font-size: 13px; color: #32acc1; text-decoration: none; }
    .alt-link:hover { text-decoration: underline; }
  `]
})
export class QrCodeTwoFaComponent implements OnInit {
  private auth = inject(AuthService);
  private fb   = inject(FormBuilder);

  data = inject<TwoFaModalData>(MODAL_DATA);
  ref  = inject<ModalRef<TwoFaResult>>(MODAL_REF);

  @ViewChildren('pincodeInputs') pincodeInputs!: QueryList<ElementRef>;
  @ViewChildren('OTPInputs')     OTPInputs!: QueryList<ElementRef>;

  pincodeForm!: FormGroup;
  isRecoveryCode = false;
  codeMode       = 'scan';
  error:  boolean | null = null;
  error2: boolean | null = null;
  maskedEmail = '';

  private searchTimer: any;

  ngOnInit(): void {
    this.pincodeForm = this.fb.group({
      pincode: this.fb.array(new Array(6).fill('').map(() => [''])),
      OTP:     this.fb.array(new Array(6).fill('').map(() => [''])),
    });
    this.maskedEmail = this.maskEmail(this.data.email);
  }

  get pincodeControls(): FormArray { return this.pincodeForm.get('pincode') as FormArray; }
  get OTPControls(): FormArray     { return this.pincodeForm.get('OTP') as FormArray; }
  getControl(i: number): FormControl    { return this.pincodeControls.at(i) as FormControl; }
  getOTPControl(i: number): FormControl { return this.OTPControls.at(i) as FormControl; }

  onInput(event: any, index: number): void {
    if (!/^\d$/.test(event.target.value)) { event.target.value = ''; return; }
    if (index < 5) this.pincodeInputs.toArray()[index + 1].nativeElement.focus();
    else           this.autoVerifyPincode();
  }
  onBackspace(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && index > 0 && !(event.target as HTMLInputElement).value)
      this.pincodeInputs.toArray()[index - 1].nativeElement.focus();
    if (!this.pincodeForm.value.pincode.join('')) this.error = null;
  }
  onInput2(event: any, index: number): void {
    if (index < 5) this.OTPInputs.toArray()[index + 1].nativeElement.focus();
    else           this.autoVerifyOTP();
  }
  onBackspace2(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && index > 0 && !(event.target as HTMLInputElement).value)
      this.OTPInputs.toArray()[index - 1].nativeElement.focus();
    if (!this.pincodeForm.value.OTP.join('')) this.error2 = null;
  }

  private autoVerifyPincode(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(async () => {
      const pincode = this.pincodeForm.value.pincode.join('');
      if (pincode.length === 6) {
        const result = await this.auth.validate2FaCode(this.data.accessToken, pincode);
        this.error = !result.success;
        if (result.success) this.ref.close({ pincode });
      }
    }, 50);
  }
  private autoVerifyOTP(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(async () => {
      const OTP = this.pincodeForm.value.OTP.join('');
      if (OTP.length === 6) {
        const result = await this.auth.validateOTP(this.data.accessToken, OTP);
        this.error2 = !result.success;
        if (result.success) this.ref.close({ OTP, isOTP: true });
      }
    }, 50);
  }

  done(): void {
    const pincode = this.pincodeForm.value.pincode.join('');
    if (pincode.length === 6) this.ref.close({ pincode });
  }
  done2(): void {
    const OTP = this.pincodeForm.value.OTP.join('');
    if (OTP.length === 6) this.ref.close({ OTP, isOTP: true });
  }

  checkDisable():  boolean { return this.pincodeForm.value.pincode.join('').length !== 6; }
  checkDisable2(): boolean { return this.pincodeForm.value.OTP.join('').length !== 6; }

  toggleMode(): void { this.codeMode = this.codeMode === 'scan' ? 'manual' : 'scan'; }
  toggleRecoveryMode(): void {
    this.isRecoveryCode = !this.isRecoveryCode;
    if (this.isRecoveryCode) this.auth.reset2fa(this.data.accessToken);
  }
  copyCode(): void { navigator.clipboard.writeText(this.data.codeStr ?? '').catch(console.error); }

  private maskEmail(email: string): string {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 2))}@${domain}`;
  }
}
