import { Component, Inject, inject, PLATFORM_ID, signal, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, Order, OrderHistoryResponse } from '../../services/authService/auth.service';
import { LoadingService } from '../../services/loadingService/loading.service';
import { AlertService } from '../../services/alertService/alert.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompanyServices } from 'src/app/services/companyServices/company.service';
import { BranchService } from 'src/app/services/branchServices/branch.service';
import { CartService } from 'src/app/services/cartServices/cart.service';
import { Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { DeliveryAddress } from 'src/app/models/company-delivery-address.model';
import { Address } from 'src/app/models/address.model';
import { DeliveryAddresses } from 'src/app/models/delivery-address.model';
import { Shopper } from 'src/app/models/shopper.module';
import { isPlatformBrowser, CommonModule } from '@angular/common';

import { ModalService } from 'src/app/services/modal.service';
import { EmailVerificationComponent } from 'src/app/components/auth/email-verification/email-verification.component';
import { PhoneVerificationComponent } from 'src/app/components/auth/phone-verification/phone-verification.component';
import { ConfirmModalComponent } from 'src/app/components/confirm-modal/confirm-modal.component';
import { WalletSettings } from '../promotions/modal/promotion.modal';
import { WalletServiceService } from '../promotions/wallet-service/wallet-service.service';

import { AppServices } from 'src/app/services/appServices';
import { WalletComponent } from "../promotions/wallet/wallet.component";
import { Company } from 'src/app/models/company.model';
import { NgSelectModule } from '@ng-select/ng-select';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { LanguageService } from 'src/app/services/langauge.service';

type ForgotStep = 'idle' | 'form';
type AccountField = 'name' | 'phone' | 'email' | null;

@Component({
  selector: 'app-account',
  imports: [
    TranslateModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CommonModule,
    WalletComponent,
    NgSelectModule
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent implements OnInit, OnDestroy {
  private logger = inject(LoggerService);

  userData: Shopper | null = null;
  addresses: Address[] = [];
  activeTab: string = 'dashboard';
  addressKey: string = "";
  address: Address | null = null;
  userAddress: Address | null = null;
  governorateAddresses: DeliveryAddress[] = [];
  addressType: string | null = null;
  blocks: string[] = [];
  cities: string[] = [];
  branchCoveredAddresses: DeliveryAddresses | null = null;
  cityAddresses: DeliveryAddress[] = [];
  blockAddresses: DeliveryAddress[] = [];
  invoiceData: any = null;

  private isLoadedBranchCoveredAddresses = false;
  private isLoadedCompanyDeliveryAddresses = false;

  // ─── Edit Address ───────────────────────────────────────────────────────────
  editIndex: number | null = null;
  editCities: string[] = [];
  editBlocks: string[] = [];
  tempAddress: Address | null = null;
  editAddressTitleDuplicate: boolean = false;

  // ─── Add New Address ────────────────────────────────────────────────────────
  isAddingAddress: boolean = false;
  newAddress: Address = this._emptyAddress();
  newAddressCities: string[] = [];
  newAddressBlocks: string[] = [];
  newAddressTitleDuplicate: boolean = false;

  // ─── Per-field Account Editing ────────────────────────────────────────────
  editingField: AccountField = null;
  fieldValues: Record<string, string> = { name: '', phone: '', email: '' };
  isSavingField: boolean = false;

  // ─── Phone split fields ───────────────────────────────────────────────────
  phoneCodeValue: string = '';
  phoneNumberValue: string = '';
  phoneCodes: any[] = [];

  // ─── Change Password ──────────────────────────────────────────────────────
  isEditingPassword: boolean = false;

  strictEmailPattern = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+(com|net|org|edu|gov|mil|co|io|info|biz|me|us|uk|ca|de|fr|au|in)$/;
  isPhoneValidated = false;
  isEmailValidated = false;
  walletSettings!: WalletSettings;

  // Order History
  orders: Order[] | any = [];
  currentOrderPage: number = 1;
  totalPages: number = 0;
  hasNextOrderPage: boolean = false;
  hasPreviousOrderPage: boolean = false;
  isLoadingOrders: boolean = false;
  selectedOrder: Order | any = null;
  showOrderDetails: boolean = false;
  ordersLimit: number = 10;

  // Currency
  companyData: Company = new Company();
  currentCurrency: any = { rate: 1, symbol: 'USD', afterDecimal: 2 };

  // ─── Change Password ──────────────────────────────────────────────────────
  passwordForm!: FormGroup;
  isSavingPassword: boolean = false;
  passwordChangeError = signal<string | null>(null);
  passwordChangeSuccess = signal<string | null>(null);
  showCurrentPassword: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;

  // ─── Forgot Password ─────────────────────────────────────────────────────
  forgotStep: ForgotStep = 'idle';
  forgotNewPassword: string = '';
  forgotConfirmPassword: string = '';
  forgotVia: 'phone' | 'email' = 'phone';
  forgotError = signal<string | null>(null);
  forgotSuccess = signal<string | null>(null);
  isSavingForgotPassword: boolean = false;
  showForgotNewPassword: boolean = false;
  showForgotConfirmPassword: boolean = false;

  private fb = inject(FormBuilder);
  form!: FormGroup;
  passwordError = signal<string | null>(null);
  isBrowser: boolean;

  private destroy$ = new Subject<void>();
  private userDataSubscription?: Subscription;
  private isComponentActive = true;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private modalService: ModalService,
    private authService: AuthService,
    private cartService: CartService,
    private branchService: BranchService,
    private loadingService: LoadingService,
    private alertService: AlertService,
    private router: Router,
    private route: ActivatedRoute,
    private companyService: CompanyServices,
    public walletServiceService: WalletServiceService,
    private translate: TranslateService,
    public appServices: AppServices,
    public languageService: LanguageService,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.phoneCodes = [];
    this._buildForm();
    this._buildPasswordForm();
  }

  private _buildForm(user?: Shopper) {
    this.form = this.fb.group({
      name: [user?.name ?? '', Validators.required],
      phone: [user?.phone ?? '', [Validators.required, Validators.pattern(/^\+?\d{6,15}$/)]],
      email: [user?.email ?? '', [Validators.required, Validators.pattern(this.strictEmailPattern)]],
    });
  }

  private _buildPasswordForm() {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    });
  }

  private _emptyAddress(): Address {
    return { title: '', governorate: '', city: '', block: '', building: '', road: '' } as Address;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async ngOnInit() {
    this.checkUserAuthentication();
    if (!this.isComponentActive) return;

    try {
      if (this.appServices?.allCountries?.length) {
        this.phoneCodes = [...this.appServices.allCountries];
      }
    } catch (e) {
      console.warn('Could not load phone codes:', e);
      this.phoneCodes = [];
    }

    await this.reloadUserData();
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const tabParam = params['tab'];
        if (tabParam) {
          this.activeTab = tabParam;
          if (tabParam === 'address') {
            this.ensureAddressDataLoaded();
          }
        }
      });

    this.getCompanyData();

    try {
      this.walletSettings = await this.walletServiceService.getWalletSettings();
    } catch (e) {
      console.warn('Could not load wallet settings:', e);
    }

    this.loadOrders(1);

    if (this.authService?.userData$) {
      this.userDataSubscription = this.authService.userData$
        .pipe(takeUntil(this.destroy$))
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: (data: Shopper | null) => {
            if (data) { this.updateUserData(data); }
            else { this.checkUserAuthentication(); }
          }
        });
    }

    this.cartService.invoiceDataSub$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoiceData: any) => {
        if (!this.isComponentActive) return;
        if (invoiceData) {
          this.invoiceData = invoiceData;
          if (invoiceData.branchId && !this.isLoadedBranchCoveredAddresses) {
            this.loadBranchCoveredAddresses();
          }
        }
      },
    });

    await this._waitForCartData();

    await Promise.all([
      this.loadCompanyDeliveryAddresses(),
      this.loadBranchCoveredAddresses(),
    ]);
  }

  ngOnDestroy() {
    this.isComponentActive = false;
    this.destroy$.next();
    this.destroy$.complete();
    this.userDataSubscription?.unsubscribe();
  }

  // ─── Wait for cartData helper ─────────────────────────────────────────────

  private _waitForCartData(): Promise<void> {
    if (this.invoiceData?.branchId) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const maxWait = 3000;
      const interval = 100;
      let elapsed = 0;
      const poll = setInterval(() => {
        elapsed += interval;
        if (this.invoiceData?.branchId || elapsed >= maxWait) {
          clearInterval(poll);
          resolve();
        }
      }, interval);
    });
  }

  // ─── Auth helpers ─────────────────────────────────────────────────────────

  private checkUserAuthentication() {
    if (!this.isComponentActive) return;
    if (!this.appServices.auth_token) {
      this.isComponentActive = false;
      this.router.navigate(['/']);
    }
  }

  private updateUserData(data: Shopper) {
    if (!this.isComponentActive) return;
    this.userData = data;
    this.addresses = JSON.parse(JSON.stringify(data.addresses || []));
    this.isEmailValidated = data.isEmailValidated;
    this.isPhoneValidated = data.isPhoneValidated;
    this._buildForm(data);
  }

  async reloadUserData() {
    if (!this.isComponentActive) return;
    try {
      await this.authService.getLoggedInUser();
    } catch (e) {
      console.warn('Could not reload user data:', e);
    }
  }

  // ─── Company data ─────────────────────────────────────────────────────────

  getCompanyData() {
    if (!this.companyService?.companyData$) return;
    this.companyService.companyData$
      .pipe(takeUntil(this.destroy$))
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data: Company) => {
          if (!this.isComponentActive) return;
          this.companyData = data;
          this.currentCurrency = {
            afterDecimal: this.companyData.settings['afterDecimal'],
            rate: 1,
            symbol: this.companyData.settings['currencySymbol']
          };
        },
      });
  }

  // ─── Address data loaders ─────────────────────────────────────────────────

  private loadCompanyDeliveryAddresses(): Promise<boolean> {
    if (this.isLoadedCompanyDeliveryAddresses) return Promise.resolve(true);
    if (!this.companyService?.getCompanyDeliveryAddresses) return Promise.resolve(false);

    return new Promise((resolve) => {
      try {
        const obs = this.companyService.getCompanyDeliveryAddresses();
        if (!obs?.pipe) { resolve(false); return; }

        obs.pipe(takeUntil(this.destroy$))
          .pipe(takeUntil(this.destroy$)).subscribe({
            next: (data: any) => {
              if (!this.isComponentActive) { resolve(false); return; }
              if (data && Array.isArray(data.addresses) && data.addresses.length) {
                this.governorateAddresses = [];
                this.cityAddresses = [];
                this.blockAddresses = [];
                data.addresses.forEach((element: any) => {
                  if (element.type === 'Governorate') { this.governorateAddresses.push(element); }
                  else if (element.type === 'City') { this.cityAddresses.push(element); }
                  else if (element.type === 'Block') { this.blockAddresses.push(element); }
                  this.addressType = element.type || null;
                });
                this.isLoadedCompanyDeliveryAddresses = true;
              }
              resolve(true);
            },
            error: (err: any) => {
              console.warn('loadCompanyDeliveryAddresses error:', err);
              resolve(false);
            },
          });
      } catch (e) {
        console.warn('loadCompanyDeliveryAddresses exception:', e);
        resolve(false);
      }
    });
  }

  private loadBranchCoveredAddresses(): Promise<boolean> {
    if (this.isLoadedBranchCoveredAddresses && this.branchCoveredAddresses?.list?.length) {
      return Promise.resolve(true);
    }
    const branchId = this.invoiceData?.branchId;
    if (!branchId) return Promise.resolve(false);
    if (!this.branchService?.getBranchCoveredAddresses) return Promise.resolve(false);

    return new Promise((resolve) => {
      try {
        const obs = this.branchService.getBranchCoveredAddresses(branchId);
        if (!obs?.pipe) { resolve(false); return; }

        obs.pipe(takeUntil(this.destroy$))
          .pipe(takeUntil(this.destroy$)).subscribe({
            next: (data: any) => {
              if (!this.isComponentActive) { resolve(false); return; }
              if (data) {
                this.branchCoveredAddresses = data;
                this.isLoadedBranchCoveredAddresses = true;
              }
              resolve(true);
            },
            error: (err: any) => {
              console.warn('loadBranchCoveredAddresses error:', err);
              resolve(false);
            },
          });
      } catch (e) {
        console.warn('loadBranchCoveredAddresses exception:', e);
        resolve(false);
      }
    });
  }

  private async ensureAddressDataLoaded(): Promise<void> {
    if (!this.invoiceData?.branchId) {
      await this._waitForCartData();
    }

    const tasks: Promise<boolean>[] = [];
    if (!this.isLoadedCompanyDeliveryAddresses) {
      tasks.push(this.loadCompanyDeliveryAddresses());
    }
    if (!this.isLoadedBranchCoveredAddresses || !this.branchCoveredAddresses?.list?.length) {
      this.isLoadedBranchCoveredAddresses = false;
      tasks.push(this.loadBranchCoveredAddresses());
    }
    if (tasks.length) await Promise.all(tasks);
  }

  // ─── Address derivation helpers ───────────────────────────────────────────

  private getCitiesForGovernorate(governorate: string): string[] {
    if (!governorate) return [];

    if (this.branchCoveredAddresses?.list?.length) {
      const cities = this.branchCoveredAddresses.list
        .filter((item: any) => item.Governorate === governorate || item.governorate === governorate)
        .map((item: any) => item.City ?? item.city)
        .filter(Boolean);
      const unique = [...new Set(cities)] as string[];
      if (unique.length) return unique;
    }

    if (this.cityAddresses?.length) {
      const cities = this.cityAddresses
        .filter((item: any) => item.governorate === governorate || item.Governorate === governorate)
        .map((item: any) => item.addressKey ?? item.city ?? item.City)
        .filter(Boolean);
      return [...new Set(cities)] as string[];
    }

    return [];
  }

  private getBlocksForCity(city: string): string[] {
    if (!city) return [];

    if (this.branchCoveredAddresses?.list?.length) {
      const blocks = this.branchCoveredAddresses.list
        .filter((item: any) => item.City === city || item.city === city)
        .map((item: any) => item.Block ?? item.block)
        .filter(Boolean);
      const unique = [...new Set(blocks)] as string[];
      if (unique.length) return unique;
    }

    if (this.blockAddresses?.length) {
      const blocks = this.blockAddresses
        .filter((item: any) => item.city === city || item.City === city)
        .map((item: any) => item.addressKey ?? item.block ?? item.Block)
        .filter(Boolean);
      return [...new Set(blocks)] as string[];
    }

    return [];
  }

  // ─── Address: ADD NEW ─────────────────────────────────────────────────────

  async startAddAddress() {
    this.isAddingAddress = true;
    this.newAddress = this._emptyAddress();
    this.newAddressCities = [];
    this.newAddressBlocks = [];
    if (this.editIndex !== null) this.cancelEdit();
    await this.ensureAddressDataLoaded();
  }

  cancelAddAddress() {
    this.isAddingAddress = false;
    this.newAddress = this._emptyAddress();
    this.newAddressCities = [];
    this.newAddressBlocks = [];
    this.newAddressTitleDuplicate = false;
  }

  onNewAddressTitleChange() {
    const val = this.newAddress?.title?.trim().toLowerCase();
    this.newAddressTitleDuplicate = !!val && this.addresses.some(
      (a) => a.title?.trim().toLowerCase() === val
    );
  }

  onEditAddressTitleChange(index: number) {
    const val = this.tempAddress?.title?.trim().toLowerCase();
    this.editAddressTitleDuplicate = !!val && this.addresses.some(
      (a, i) => i !== index && a.title?.trim().toLowerCase() === val
    );
  }

  async onNewAddressGovernorateChange() {
    this.newAddress.city = '';
    this.newAddress.block = '';
    this.newAddressBlocks = [];
    await this.ensureAddressDataLoaded();
    this.newAddressCities = this.getCitiesForGovernorate(this.newAddress.governorate);
  }

  async onNewAddressCityChange() {
    this.newAddress.block = '';
    await this.ensureAddressDataLoaded();
    this.newAddressBlocks = this.getBlocksForCity(this.newAddress.city);
  }

  saveNewAddress() {
    if (!this.newAddress?.title?.trim()) {
      this.alertService.showAlert({ title: this.translate.instant('Please enter an address title.') });
      return;
    }
    const newTitleLower = this.newAddress.title.trim().toLowerCase();
    const isDuplicate = this.addresses.some(
      (a) => a.title?.trim().toLowerCase() === newTitleLower
    );
    this.newAddressTitleDuplicate = isDuplicate;
    if (isDuplicate) return;
    this.addresses = [...this.addresses, { ...this.newAddress } as Address];
    this.persistAddresses(undefined, true);
  }

  // ─── Address: EDIT ────────────────────────────────────────────────────────

  async startEdit(index: number) {
    this.editIndex = index;
    if (this.isAddingAddress) this.cancelAddAddress();
    this.tempAddress = JSON.parse(JSON.stringify(this.addresses[index]));
    await this.ensureAddressDataLoaded();
    this.editCities = this.tempAddress!.governorate
      ? this.getCitiesForGovernorate(this.tempAddress!.governorate)
      : [];
    this.editBlocks = this.tempAddress!.city
      ? this.getBlocksForCity(this.tempAddress!.city)
      : [];
  }

  cancelEdit() {
    this.editIndex = null;
    this.tempAddress = null;
    this.editCities = [];
    this.editBlocks = [];
    this.editAddressTitleDuplicate = false;
  }

  async onEditGovernorateChange(index: number) {
    if (!this.tempAddress) return;
    this.tempAddress.city = '';
    this.tempAddress.block = '';
    this.editBlocks = [];
    await this.ensureAddressDataLoaded();
    this.editCities = this.getCitiesForGovernorate(this.tempAddress.governorate);
  }

  async onEditCityChange(index: number) {
    if (!this.tempAddress) return;
    this.tempAddress.block = '';
    await this.ensureAddressDataLoaded();
    this.editBlocks = this.getBlocksForCity(this.tempAddress.city);
  }

  saveEditAddress(index: number) {
    if (!this.tempAddress?.title?.trim()) {
      this.alertService.showAlert({ title: this.translate.instant('Please enter an address title.') });
      return;
    }
    const editedTitleLower = this.tempAddress.title.trim().toLowerCase();
    const isDuplicate = this.addresses.some(
      (a, i) => i !== index && a.title?.trim().toLowerCase() === editedTitleLower
    );
    this.editAddressTitleDuplicate = isDuplicate;
    if (isDuplicate) return;

    // ✅ Skip API call if nothing changed
    const original = this.addresses[index];
    const hasChanged =
      this.tempAddress.title !== original.title ||
      this.tempAddress.governorate !== original.governorate ||
      this.tempAddress.city !== original.city ||
      this.tempAddress.block !== original.block ||
      this.tempAddress.building !== original.building ||
      this.tempAddress.road !== original.road;

    if (!hasChanged) {
      this.cancelEdit();
      return;
    }

    this.addresses[index] = this.tempAddress as Address;
    this.persistAddresses(index);
  }

  // ─── Address: DELETE ──────────────────────────────────────────────────────

  deleteAddress(index: number) {
    if (!this.isComponentActive) return;
    if (!this.isBrowser || !this.modalService) return;
    const modalRef = this.modalService.openWithData(
      ConfirmModalComponent,
      { title: this.translate.instant('Are you sure you want to delete this address?') },
      { centered: true, windowClass: 'app-confirm-modal' }
    );
    modalRef.result
      .then((confirmed: boolean) => {
        if (!this.isComponentActive) return;
        if (confirmed) {
          this.addresses.splice(index, 1);
          this.addresses = [...this.addresses];
          this.persistAddresses();
        }
      })
      .catch(() => {
        // Dismissed (ESC / backdrop / back) — treat as cancel.
      });
  }

  // ─── Address: PERSIST ─────────────────────────────────────────────────────

  private persistAddresses(editIndexOnSuccess?: number, isNewAddress?: boolean) {
    const payload: any = {
      ...this.userData,
      addresses: this.addresses,
    };

    this.loadingService.showLoadingSpinner();
    this.authService.updateShopper(payload)
      .pipe(takeUntil(this.destroy$))
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: any) => {
          this.loadingService.hideLoadingSpinner();
          if (editIndexOnSuccess !== undefined) { this.cancelEdit(); }
          if (isNewAddress) { this.cancelAddAddress(); }
          this.reloadUserData();
          if (responseData?.msg) { this.alertService.showAlert({ title: responseData.msg }); }
        },
        error: (err: any) => {
          this.loadingService.hideLoadingSpinner();
          this.logger.error(err?.message, { stack: err?.stack, context: 'AccountComponent.updateAddresses' });
          this.alertService.showAlert({ title: this.translate.instant('Failed to save address. Please try again.') });
          if (this.userData?.addresses) {
            this.addresses = JSON.parse(JSON.stringify(this.userData.addresses));
            this.cancelEdit();
            this.cancelAddAddress();
          }
        }
      });
  }

  // ─── Per-field Account Edit ───────────────────────────────────────────────

  startEditField(field: AccountField) {
    this.editingField = field;

    if (!this.phoneCodes?.length) {
      try {
        if (this.appServices?.allCountries?.length) {
          this.phoneCodes = [...this.appServices.allCountries];
        }
      } catch (e) {
        console.warn('Could not load phone codes:', e);
      }
    }

    this.fieldValues = {
      name: this.userData?.name ?? '',
      phone: this.userData?.phone ?? '',
      email: this.userData?.email ?? '',
    };

    if (field === 'phone') {
      this.phoneCodeValue = '+973';
      this.phoneNumberValue = '';
    }

    this.form.patchValue(this.fieldValues);
  }

  cancelEditField() {
    this.editingField = null;
    this.phoneCodeValue = '';
    this.phoneNumberValue = '';
    // Re-sync validation flags from userData so badges are not affected by cancel
    if (this.userData) {
      this.isPhoneValidated = this.userData.isPhoneValidated;
      this.isEmailValidated = this.userData.isEmailValidated;
    }
  }

  async saveField(field: AccountField) {
    if (!field || !this.isComponentActive) return;

    // ─── PHONE ───────────────────────────────────────────────────────────────
    if (field === 'phone') {
      const code = this.phoneCodeValue.trim();
      const number = this.phoneNumberValue.trim();

      if (!code || !number) {
        this.alertService.showAlert({ title: this.translate.instant('Phone code and number are required.') });
        return;
      }

      const newValue = (code.startsWith('+') ? code : '+' + code) + number;
      this.fieldValues['phone'] = newValue;

      const phoneChanged = newValue !== this.userData?.phone;

      // ✅ Same phone and already verified — nothing to do, just close the edit
      if (!phoneChanged && this.isPhoneValidated) {
        this.editingField = null;
        this.phoneCodeValue = '';
        this.phoneNumberValue = '';
        return;
      }

      if (phoneChanged || !this.isPhoneValidated) {
        this.form.patchValue({ phone: newValue });
        this.isSavingField = true;

        const otpResult = await this._validatePhoneWithSession();
        if (!otpResult.validated) {
          // OTP was cancelled or failed — restore flags from userData and bail out
          this.isSavingField = false;
          if (this.userData) {
            this.isPhoneValidated = this.userData.isPhoneValidated;
          }
          return;
        }

        // OTP succeeded — mark as unverified until server confirms
        this.isPhoneValidated = false;
        this._persistEmailPhone(otpResult.sessionId!);
        return;
      }

      this._persistField({ phone: newValue, isPhoneValidated: true });
      return;
    }

    // ─── NAME ────────────────────────────────────────────────────────────────
    const newValue = (this.fieldValues[field] ?? '').trim();

    if (field === 'name') {
      if (!newValue) {
        this.alertService.showAlert({ title: this.translate.instant('Display name is required.') });
        return;
      }
      this._persistField({ name: newValue });
      return;
    }

    // ─── EMAIL ───────────────────────────────────────────────────────────────
    if (field === 'email') {
      if (!newValue) {
        this.alertService.showAlert({ title: this.translate.instant('Email address is required.') });
        return;
      }

      const emailChanged = newValue !== this.userData?.email;

      // ✅ Same email and already verified — nothing to do, just close the edit
      if (!emailChanged && this.isEmailValidated) {
        this.editingField = null;
        return;
      }

      if (emailChanged || !this.isEmailValidated) {
        this.form.patchValue({ email: newValue });
        this.isSavingField = true;

        const otpResult = await this._validateEmailWithSession();
        if (!otpResult.validated) {
          // OTP was cancelled or failed — restore flags from userData and bail out
          this.isSavingField = false;
          if (this.userData) {
            this.isEmailValidated = this.userData.isEmailValidated;
          }
          return;
        }

        // OTP succeeded — mark as unverified until server confirms
        this.isEmailValidated = false;
        this._persistEmailPhone(otpResult.sessionId!);
        return;
      }

      this._persistField({ email: newValue, isEmailValidated: true });
      return;
    }
  }

  private _persistField(changes: Partial<Shopper & { isPhoneValidated?: boolean; isEmailValidated?: boolean }>) {
    const payload: any = { ...this.userData, ...changes };

    this.isSavingField = true;
    this.loadingService.showLoadingSpinner();

    this.authService.updateShopper(payload)
      .pipe(takeUntil(this.destroy$))
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: any) => {
          this.isSavingField = false;
          this.editingField = null;
          this.phoneCodeValue = '';
          this.phoneNumberValue = '';
          this.loadingService.hideLoadingSpinner();
          this.reloadUserData();
          if (responseData?.msg) { this.alertService.showAlert({ title: responseData.msg }); }
        },
        error: (err: any) => {
          this.isSavingField = false;
          this.loadingService.hideLoadingSpinner();
          this.logger.error(err?.message, { stack: err?.stack, context: 'AccountComponent.updateAccountField' });
          this.alertService.showAlert({ title: this.translate.instant('Failed to save changes. Please try again.') });
        }
      });
  }

  private _validatePhoneWithSession(): Promise<{ validated: boolean; sessionId?: string }> {
    return new Promise((resolve) => {
      const fullPhone = this.form.getRawValue().phone as string;
      const normalized = fullPhone.replace(/[\s-]/g, '');
      const match = normalized.match(/^\+?(\d{1,4})(\d{6,})$/);
      if (!match) { resolve({ validated: false }); return; }
      if (!this.isBrowser || !this.modalService) { resolve({ validated: false }); return; }
      try {
        const modalRef = this.modalService.openWithData(
          PhoneVerificationComponent,
          { phoneCode: '+' + match[1], phoneNumber: match[2] },
          { centered: true, windowClass: 'modal-md', backdrop: 'static', keyboard: false }
        );
        modalRef.result
          .then((data: any) => {
            if (!this.isComponentActive) { resolve({ validated: false }); return; }
            resolve({ validated: !!(data?.validation), sessionId: data?.sessionId ?? undefined });
          })
          .catch(() => resolve({ validated: false }));
      } catch { resolve({ validated: false }); }
    });
  }

  private _validateEmailWithSession(): Promise<{ validated: boolean; sessionId?: string }> {
    return new Promise((resolve) => {
      if (!this.isBrowser || !this.modalService) { resolve({ validated: false }); return; }
      try {
        const modalRef = this.modalService.openWithData(
          EmailVerificationComponent,
          { email: this.form.getRawValue().email },
          { centered: true, windowClass: 'modal-md', backdrop: 'static', keyboard: false }
        );
        if (modalRef.componentInstance) { modalRef.componentInstance.verifyStep1(); }
        modalRef.result
          .then((data: any) => {
            if (!this.isComponentActive) { resolve({ validated: false }); return; }
            resolve({ validated: !!(data?.validation), sessionId: data?.sessionId ?? undefined });
          })
          .catch(() => resolve({ validated: false }));
      } catch { resolve({ validated: false }); }
    });
  }

  private _persistEmailPhone(sessionId: string) {
    this.isSavingField = false;
    this.editingField = null;
    this.phoneCodeValue = '';
    this.phoneNumberValue = '';
    this.loadingService.hideLoadingSpinner();
    // Reload user data so the verified badge reflects the server's latest state
    this.reloadUserData();
  }

  // ─── Order History ────────────────────────────────────────────────────────

  loadOrders(page: number = 1) {
    if (!this.isComponentActive) return;
    this.isLoadingOrders = true;
    const validPage = Math.max(1, page);

    this.authService.getOrderHistory(validPage, this.ordersLimit)
      .pipe(takeUntil(this.destroy$))
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (response: OrderHistoryResponse) => {
          if (!this.isComponentActive) return;
          this.orders = response.orders.map(order => ({
            id: order.id,
            orderNumber: order.orderNumber || `#${order.id.substring(0, 8)}`,
            invoiceNumber: order.invoiceNumber,
            createdAt: order.createdAt || order.date || new Date().toISOString(),
            date: order.date,
            total: order.total || 0,
            status: order.status || 'Pending',
            onlineData: order.onlineData,
            items: order.items || [],
          })) as Order[];
          this.currentOrderPage = response.currentPage;
          this.totalPages = response.totalPages;
          this.hasNextOrderPage = response.hasNext;
          this.hasPreviousOrderPage = this.currentOrderPage > 1;
          this.isLoadingOrders = false;
        },
        error: (error) => {
          if (!this.isComponentActive) return;
          this.logger.error(error?.message, { stack: error?.stack, context: 'AccountComponent.loadOrders' });
          this.isLoadingOrders = false;
        }
      });
  }

  viewOrderDetails(order: Order) {
    if (!this.isComponentActive) return;
    this.selectedOrder = order;
    this.showOrderDetails = true;
  }

  closeOrderDetails() {
    this.showOrderDetails = false;
    this.selectedOrder = null;
  }

  nextOrderPage() {
    if (!this.isComponentActive) return;
    if (this.hasNextOrderPage) { this.loadOrders(this.currentOrderPage + 1); }
  }

  previousOrderPage() {
    if (!this.isComponentActive) return;
    if (this.currentOrderPage > 1) { this.loadOrders(this.currentOrderPage - 1); }
  }

  convertDateFormat(dateStr: any): string {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = month < 10 ? `0${month}` : month;
    const formattedMins = minutes < 10 ? `0${minutes}` : minutes;
    const period = hours >= 12 ? 'PM' : 'AM';
    let formattedHour = hours % 12;
    formattedHour = formattedHour === 0 ? 12 : formattedHour;
    const formattedHourStr = formattedHour < 10 ? `0${formattedHour}` : formattedHour;
    return `${formattedDay}/${formattedMonth}/${year}, ${formattedHourStr}:${formattedMins} ${period}`;
  }

  /**
   * Returns the translated display label for a covered address.
   * Prefers the translation matching `address.type` (e.g. "Governorate"),
   * falls back to addressKey when no translation is available.
   */
  getTranslatedLabel(address: DeliveryAddress, lang?: 'ar' | 'en'): string {
    const currentLang = (lang ?? this.languageService.$t.currentLang) as 'ar' | 'en';
    if (address.translation && address.type && address.translation[address.type]) {
      return address.translation[address.type][currentLang] || address.addressKey;
    }
    return address.addressKey;
  }

  getConvertedPrice(price: number): string {
    const converted = (price / (this.currentCurrency.rate || 1)) || 0;
    return converted.toFixed(this.companyData.settings['afterDecimal']);
  }

  // ─── OTP verification ─────────────────────────────────────────────────────

  validatePhone(): Promise<boolean> {
    return new Promise((resolve) => {
      const fullPhone = this.form.getRawValue().phone as string;
      const normalized = fullPhone.replace(/[\s-]/g, '');
      const match = normalized.match(/^\+?(\d{1,4})(\d{6,})$/);
      if (!match) { this.isPhoneValidated = false; resolve(false); return; }
      if (!this.isBrowser || !this.modalService) { resolve(false); return; }
      try {
        const modalRef = this.modalService.openWithData(
          PhoneVerificationComponent,
          { phoneCode: match[1], phoneNumber: match[2] },
          { centered: true, windowClass: 'modal-md', backdrop: 'static', keyboard: false }
        );
        modalRef.result
          .then((data: any) => {
            if (!this.isComponentActive) return;
            this.isPhoneValidated = !!(data?.validation);
            resolve(this.isPhoneValidated);
          })
          .catch(() => { this.isPhoneValidated = false; resolve(false); });
      } catch { resolve(false); }
    });
  }

  validateEmail(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isBrowser || !this.modalService) { resolve(false); return; }
      try {
        const modalRef = this.modalService.openWithData(
          EmailVerificationComponent,
          { email: this.form.getRawValue().email },
          { centered: true, windowClass: 'modal-md', backdrop: 'static', keyboard: false }
        );
        if (modalRef.componentInstance) { modalRef.componentInstance.verifyStep1(); }
        modalRef.result
          .then((data: any) => {
            if (!this.isComponentActive) return;
            this.isEmailValidated = !!(data?.validation);
            resolve(this.isEmailValidated);
          })
          .catch(() => { this.isEmailValidated = false; resolve(false); });
      } catch { resolve(false); }
    });
  }

  // ─── Change Password ──────────────────────────────────────────────────────

  cancelEditPassword() {
    this.isEditingPassword = false;
    this.resetPasswordForm();
  }

  resetPasswordForm() {
    this.passwordForm.reset();
    this.passwordChangeError.set(null);
    this.passwordChangeSuccess.set(null);
    this.showCurrentPassword = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.resetForgotPasswordFlow();
  }

  async onSubmitPassword() {
    if (!this.isComponentActive) return;
    this.passwordChangeError.set(null);
    this.passwordChangeSuccess.set(null);
    this.forgotSuccess.set(null); // ← clear the forgot-password success banner

    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.passwordChangeError.set(this.translate.instant('New passwords do not match.'));
      return;
    }

    // ✅ Skip API call — same password entered, just reset form and show success locally
    if (currentPassword === newPassword) {
      this.passwordForm.reset();
      this.showCurrentPassword = false;
      this.showNewPassword = false;
      this.showConfirmPassword = false;
      this.passwordChangeSuccess.set(this.translate.instant('Password updated successfully.'));
      return;
    }

    this.isSavingPassword = true;
    this.loadingService.showLoadingSpinner();

    this.authService.setPassword(currentPassword, newPassword)
      .pipe(takeUntil(this.destroy$))
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (responseData: any) => {
          this.isSavingPassword = false;
          this.loadingService.hideLoadingSpinner();
          if (responseData?.success) {
            this.passwordForm.reset();
            this.showCurrentPassword = false;
            this.showNewPassword = false;
            this.showConfirmPassword = false;
            this.passwordChangeError.set(null);
            this.passwordChangeSuccess.set(responseData?.msg || this.translate.instant('Password updated successfully.'));
          } else {
            this.passwordChangeError.set(responseData?.msg || this.translate.instant('Failed to update password. Please try again.'));
          }
        },
        error: (err: any) => {
          this.isSavingPassword = false;
          this.loadingService.hideLoadingSpinner();
          const errMsg = err?.error?.msg || err?.error?.message || err?.message
            || this.translate.instant('Failed to update password. Please try again.');
          this.passwordChangeError.set(errMsg);
          this.logger.error(err?.message, { stack: err?.stack, context: 'AccountComponent.updatePassword' });
        }
      });
  }

  // ─── Forgot Password ─────────────────────────────────────────────────────

  openForgotPassword() {
    this.forgotError.set(null);
    this.forgotSuccess.set(null);
    this.forgotNewPassword = '';
    this.forgotConfirmPassword = '';
    this.showForgotNewPassword = false;
    this.showForgotConfirmPassword = false;
    const phone = this.userData?.phone?.trim();
    const email = this.userData?.email?.trim();
    if (phone) { this.forgotVia = 'phone'; }
    else if (email) { this.forgotVia = 'email'; }
    else { this.forgotError.set(this.translate.instant('No phone or email found on your account.')); return; }
    this.forgotStep = 'form';
  }

  async submitForgotViaOtpPopup() {
    this.forgotError.set(null);
    if (!this.forgotNewPassword || this.forgotNewPassword.length < 6) {
      this.forgotError.set(this.translate.instant('New password must be at least 6 characters.')); return;
    }
    if (this.forgotNewPassword !== this.forgotConfirmPassword) {
      this.forgotError.set(this.translate.instant('Passwords do not match.')); return;
    }
    if (!this.isBrowser || !this.modalService) return;

    this.isSavingForgotPassword = true;

    try {
      let sessionId: string | null = null;

      if (this.forgotVia === 'phone') {
        const phone = this.userData?.phone?.trim() ?? '';
        const normalized = phone.replace(/[\s-]/g, '');
        const match = normalized.match(/^\+?(\d{1,4})(\d{6,})$/);
        if (!match) {
          this.forgotError.set(this.translate.instant('Invalid phone number on your account.'));
          this.isSavingForgotPassword = false; return;
        }
        const modalRef = this.modalService.openWithData(
          PhoneVerificationComponent,
          { phoneCode: match[1], phoneNumber: match[2] },
          { centered: true, windowClass: 'modal-md', backdrop: 'static', keyboard: false }
        );
        const result = await modalRef.result.catch(() => null);
        if (!result) { this.isSavingForgotPassword = false; return; }
        if (!result.validation) {
          this.forgotError.set(this.translate.instant('OTP verification failed. Please try again.'));
          this.isSavingForgotPassword = false; return;
        }
        sessionId = result.sessionId ?? null;
      } else {
        const email = this.userData?.email?.trim() ?? '';
        const modalRef = this.modalService.openWithData(
          EmailVerificationComponent,
          { email },
          { centered: true, windowClass: 'modal-md', backdrop: 'static', keyboard: false }
        );
        if (modalRef.componentInstance) { modalRef.componentInstance.verifyStep1(); }
        const result = await modalRef.result.catch(() => null);
        if (!result) { this.isSavingForgotPassword = false; return; }
        if (!result.validation) {
          this.forgotError.set(this.translate.instant('OTP verification failed. Please try again.'));
          this.isSavingForgotPassword = false; return;
        }
        sessionId = result.sessionId ?? null;
      }

      if (!sessionId) {
        this.forgotError.set(this.translate.instant('Verification session is missing. Please try again.'));
        this.isSavingForgotPassword = false; return;
      }

      this.authService.resetPassword({ password: this.forgotNewPassword, sessionId })
        .pipe(takeUntil(this.destroy$))
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: (res: any) => {
            this.isSavingForgotPassword = false;
            if (res?.success) {
              this.forgotSuccess.set(res?.msg || this.translate.instant('Password reset successfully.'));
              this.forgotStep = 'idle';
              this.passwordForm.reset();
              this.passwordChangeError.set(null);
              this.passwordChangeSuccess.set(null); // ← clear the change-password success banner
            } else {
              this.forgotError.set(res?.msg || this.translate.instant('Failed to reset password. Please try again.'));
            }
          },
          error: (err: any) => {
            this.isSavingForgotPassword = false;
            this.forgotError.set(err?.error?.msg || this.translate.instant('Failed to reset password. Please try again.'));
          }
        });
    } catch {
      this.isSavingForgotPassword = false;
      this.forgotError.set(this.translate.instant('Something went wrong. Please try again.'));
    }
  }

  resetForgotPasswordFlow() {
    this.forgotStep = 'idle';
    this.forgotNewPassword = '';
    this.forgotConfirmPassword = '';
    this.forgotVia = 'phone';
    this.forgotError.set(null);
    this.isSavingForgotPassword = false;
    this.showForgotNewPassword = false;
    this.showForgotConfirmPassword = false;
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  setActiveTab(tab: string) {
    if (!this.isComponentActive) return;
    this.activeTab = tab;
    this.editingField = null;
    this.phoneCodeValue = '';
    this.phoneNumberValue = '';
    // Re-sync validation flags when switching tabs, in case editing was abandoned
    if (this.userData) {
      this.isPhoneValidated = this.userData.isPhoneValidated;
      this.isEmailValidated = this.userData.isEmailValidated;
    }
    if (this.isEditingPassword) this.cancelEditPassword();
    if (this.editIndex !== null) this.cancelEdit();
    if (this.isAddingAddress) this.cancelAddAddress();
    if (tab !== 'password') this.resetPasswordForm();

    if (tab === 'address') {
      this.ensureAddressDataLoaded();
    }
    this.isMobileMenuOpen = false;
  }

  logout() {
    this.destroy$.next();
    this.authService.confLogout();
  }

  goHome() {
    this.isComponentActive = false;
    this.destroy$.next();
    this.router.navigate(['/']);
  }

  goBack() {
    this.isComponentActive = false;
    this.destroy$.next();
    window.history.back();
  }

  // ─── Mobile Tab Menu ─────────────────────────────────────────────────────────
  // Add these properties to the AccountComponent class (alongside other class fields):

  isMobileMenuOpen: boolean = false;

  get mobileTabLabel(): string {
    const labels: Record<string, string> = {
      dashboard: 'Dashboard',
      orders: 'My Orders',
      address: 'My Addresses',
      account: 'Account Details',
      password: 'Change Password',
      wallet: 'My Wallet',
    };
    return labels[this.activeTab] ?? 'Menu';
  }

  get mobileTabIcon(): string {
    const icons: Record<string, string> = {
      dashboard: 'fas fa-th-large',
      orders: 'fas fa-box',
      address: 'fas fa-map-marker-alt',
      account: 'fas fa-user',
      password: 'fas fa-lock',
      wallet: 'fas fa-wallet',
    };
    return icons[this.activeTab] ?? 'fas fa-bars';
  }

  selectMobileTab(tab: string): void {
    this.setActiveTab(tab);      // reuse existing logic (resets edits, loads data, etc.)
    this.isMobileMenuOpen = false;
  }

}