import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '@core/auth/auth.service';
import { CompanyService } from '@core/auth/company.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { BranchConnectionService } from '@core/layout/services/branch.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { CountriesService, Country } from '@shared/services/countries.service';
import { LanguageService } from '@core/i18n/language.service';
import { EntityCustomFieldsComponent } from '@features/settings/components/entity-custom-fields/entity-custom-fields.component';
import { PriceLabelService } from '@features/settings/price-label/services/price-label.service';
import { PaymentMethodService } from '@features/settings/payment-methods/services/payment-method.service';

import { Customer, CustomerAddress, CustomerNotes } from '../../models/customer.model';
import { CustomersService } from '../../services/customers.service';
import { addressTitleUniqueValidator } from '../../services/customer-validators';

interface Opt { value: string; label: string }

/**
 * Customer form body — every card of the legacy `customer-form-details`
 * (type, basic info, contact, addresses with inline editing, custom fields,
 * financial info, opening balance, notes). Shared by the customer form page and
 * the quick-create dialog. The parent owns the `Customer` model and the
 * reactive form (`name`, `phone`, `mobile`, `addresses[].addressTitle`); this
 * edits them in place, exactly as the legacy component did.
 */
@Component({
  selector: 'app-customer-form-details',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent,
    SegmentedToggleComponent, DatePickerComponent, PhoneInputComponent, EntityCustomFieldsComponent,
  ],
  templateUrl: './customer-form-details.component.html',
  styleUrl: './customer-form-details.component.scss',
})
export class CustomerFormDetailsComponent implements OnInit {
  private auth = inject(AuthService);
  private company = inject(CompanyService);
  private privileges = inject(PrivilegeService);
  private branchSvc = inject(BranchConnectionService);
  private modal = inject(ModalService);
  private lang = inject(LanguageService);
  private priceLabels = inject(PriceLabelService);
  private paymentMethods = inject(PaymentMethodService);
  private customers = inject(CustomersService);
  private countriesSvc = inject(CountriesService);
  private destroyRef = inject(DestroyRef);

  @Input() customerData = new Customer();
  @Input() customerForm!: FormGroup;
  @Input() formStatus: 'new' | 'edit' | string = 'new';
  /** The quick-create dialog hides the nested "create parent" link to avoid recursion. */
  @Input() allowCreateParent = true;

  phoneLength = 8;
  maxBirthday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  /** Company dial code ("+973"), pre-selected in the phone/mobile code dropdowns. */
  get defaultCountryCode(): string {
    const code = String(this.company.settings()?.settings?.contryCode ?? '').replace('+', '');
    return code ? '+' + code : '';
  }

  get controls() { return this.customerForm.controls; }
  get addressesFormGroup() { return this.customerForm.get('addresses') as FormArray; }

  // ── static option lists ────────────────────────────────────────────
  typeOptions = [
    { value: 'Individual', label: 'CUSTOMERS.FORM.INDIVIDUAL' },
    { value: 'Business', label: 'CUSTOMERS.FORM.BUSINESS' },
  ];
  saluations: Opt[] = ['', 'Mr', 'Ms', 'Mrs', 'Miss', 'Sir', 'Dr', 'Pro'].map(v => ({
    value: v, label: v ? 'CUSTOMERS.FORM.SAL_' + v.toUpperCase() : 'CUSTOMERS.FORM.SELECT_A_SALUATE',
  }));
  industries: Opt[] = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Education', 'Real Estate', 'Other']
    .map(v => ({ value: v, label: v }));
  terms: Opt[] = [
    { value: 'net7', label: 'Net 7' }, { value: 'net10', label: 'Net 10' }, { value: 'net15', label: 'Net 15' },
    { value: 'net30', label: 'Net 30' }, { value: 'net60', label: 'Net 60' }, { value: 'net90', label: 'Net 90' },
    { value: 'endOfTheMonth', label: 'End of the month' }, { value: 'onReceiptDue', label: 'On Receipt Due' },
  ];
  addressTitlePresets = [
    { id: 'Home', translationKey: 'CUSTOMERS.FORM.LABEL_HOME' },
    { id: 'Office', translationKey: 'CUSTOMERS.FORM.LABEL_OFFICE' },
    { id: 'Billing', translationKey: 'CUSTOMERS.FORM.LABEL_BILLING' },
    { id: 'Shipping', translationKey: 'CUSTOMERS.FORM.LABEL_SHIPPING' },
    { id: 'Warehouse', translationKey: 'CUSTOMERS.FORM.LABEL_WAREHOUSE' },
  ];
  countries: Country[] = [];

  allowDeleteAddress = true;
  selectedAddress = 0;
  /** Index of the address currently expanded for inline editing, or null. */
  expandedAddress: number | null = null;
  /** Snapshot of the address being edited so Cancel can revert mutations. */
  private editingSnapshot: CustomerAddress | null = null;
  /** True when the expanded address was created by addAddress() in this session. */
  private editingIsNew = false;

  branches = () => this.branchSvc.branches();
  oBalanceData: { branchId: string; openingBalance: number } = { branchId: '', openingBalance: 0 };

  async ngOnInit(): Promise<void> {
    // Reactive controls hold name / phone / mobile; mirror them into the model (legacy: ngModel + formControlName).
    for (const key of ['name', 'phone', 'mobile'] as const) {
      this.customerForm.get(key)?.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(v => ((this.customerData as any)[key] = v ?? ''));
    }

    await this.branchSvc.load().catch(() => {});
    this.allowDeleteAddress = this.privileges.check('customerSecurity.actions.deleteAddress.access');
    const first = this.branchSvc.branches()[0];
    if (first) this.oBalanceData.branchId = first.id;
    this.ensureSingleDefaultAddress();
    this.countries = await this.countriesSvc.load().catch(() => []);

    // Editing: resolve the labels of the saved price label / currency for the dropdown triggers.
    if (this.customerData.priceLabelId) {
      const pl = await this.priceLabels.getById(this.customerData.priceLabelId).catch(() => null);
      this.priceLabelName = (pl as any)?.name ?? '';
    }
    if (this.customerData.currencyId) {
      const cur = await this.paymentMethods.getById(this.customerData.currencyId).catch(() => null);
      this.currencyName = (cur as any)?.name ?? '';
    }
  }

  // ── dropdown helpers (value <-> option) ────────────────────────────
  display = (o: any) => (o?.label ? this.lang.instant(o.label) : '');
  displayPlain = (o: any) => o?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  displayPlainCountry = (c: any) => c?.name ?? '';
  compareCountry = (a: any, b: any) => a?.name === b?.name;
  pick(list: Opt[], value: string | null | undefined): Opt | null {
    return list.find(o => o.value === (value ?? '')) ?? null;
  }
  set(key: 'saluation' | 'industry' | 'paymentTerm' | 'priceLabelId' | 'currencyId' | 'type', item: any): void {
    (this.customerData as any)[key] = item?.value ?? (key === 'saluation' ? '' : null);
  }

  // async pickers (paged + searched server-side, like the legacy selects)
  loadPriceLabels = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.priceLabels.getList({ page: p.page, limit: p.pageSize, searchTerm: p.search });
    const items = (res.list ?? []).map((x: any) => ({ value: x.id, label: x.name }));
    return { items, hasMore: p.page < (res.pageCount ?? 1) };
  };
  loadCurrencies = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.paymentMethods.getList({ page: p.page, limit: p.pageSize, type: 'Cash', searchTerm: p.search });
    const items = (res.list ?? []).map((x: any) => ({ value: x.id, label: x.name }));
    return { items, hasMore: p.page < (res.pageCount ?? 1) };
  };
  loadParents = async (p: { page: number; pageSize: number; search: string }) => {
    const params: any = { page: p.page, limit: p.pageSize, searchTerm: p.search };
    if (this.customerData.parentId) params.customerId = this.customerData.parentId;
    if (this.customerData.id) params.id = this.customerData.id;
    const data = await this.customers.getParentCustomers(params);
    const list: any[] = data?.list ?? [];
    const items = list.map(c => ({
      value: c.id,
      label: (c.saluation ? c.saluation + ' ' : '') + c.name + (c.phone ? ' - ' + c.phone : ''),
      name: (c.saluation ? c.saluation + ' ' : '') + c.name,
    }));
    return { items, hasMore: list.length >= p.pageSize };
  };
  selectedRef(id: string | null | undefined, label: string | null | undefined): Opt | null {
    return id ? { value: id, label: label || '' } : null;
  }
  currentPriceLabel = () => this.selectedRef(this.customerData.priceLabelId, this.priceLabelName);
  currentCurrency = () => this.selectedRef(this.customerData.currencyId, this.currencyName);
  private priceLabelName = '';
  private currencyName = '';
  onPriceLabel(o: any): void { this.priceLabelName = o?.label ?? ''; this.set('priceLabelId', o); }
  onCurrency(o: any): void { this.currencyName = o?.label ?? ''; this.set('currencyId', o); }
  onParent(o: any): void {
    this.customerData.parentId = o?.value ?? null;
    this.customerData.parentName = o?.name ?? '';
  }

  onChangeDiscount(): void {
    if (this.customerData.discountAmount > 100) this.customerData.discountAmount = 100;
  }

  onBirthday(d: any): void {
    this.customerData.birthDay = d instanceof Date ? d : null;
    this.customerForm.markAsDirty();
  }

  // ── addresses ──────────────────────────────────────────────────────
  /** Guarantees exactly one address has isDefault=true. */
  private ensureSingleDefaultAddress(): void {
    const addresses = this.customerData?.addresses;
    if (!addresses || addresses.length === 0) return;
    const firstDefault = addresses.findIndex(a => a.isDefault === true);
    if (firstDefault === -1) addresses[0].isDefault = true;
    else addresses.forEach((a, i) => (a.isDefault = i === firstDefault));
  }

  /** One-line summary of an address for the card. */
  getAddressSummary(address: CustomerAddress): string {
    if (!address) return '';
    const parts: string[] = [];
    if (address.addressLine1) parts.push(address.addressLine1);
    if (address.district) parts.push(address.district);
    if (address.city) parts.push(address.city);
    if (address.region) parts.push(address.region);
    if (address.country) parts.push(address.country);
    if (parts.length === 0) {
      if (address.building) parts.push('Building ' + address.building);
      if (address.road) parts.push('Road ' + address.road);
      if (address.block) parts.push('Block ' + address.block);
    }
    return parts.join(', ');
  }

  setDefaultAddress(index: number): void {
    if (!this.customerData?.addresses?.length) return;
    this.customerData.addresses.forEach((a, i) => (a.isDefault = i === index));
    this.customerForm.markAsDirty();
  }

  private async confirm(titleKey: string): Promise<boolean> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: { title: this.lang.instant(titleKey), message: '', danger: true },
    });
    return !!(await ref.afterClosed());
  }

  async removeAddress(address: CustomerAddress): Promise<void> {
    if (!(await this.confirm('CUSTOMERS.FORM.UPDATE_MSG'))) return;
    const i = this.customerData.addresses.indexOf(address);
    const wasDefault = address.isDefault;
    this.customerData.addresses.splice(i, 1);
    this.addressesFormGroup.removeAt(i);
    if (wasDefault && this.customerData.addresses.length > 0) this.customerData.addresses[0].isDefault = true;
    if (this.selectedAddress >= this.customerData.addresses.length) {
      this.selectedAddress = Math.max(0, this.customerData.addresses.length - 1);
    }
    this.customerForm.markAsDirty();
  }

  addAddress(): void {
    if (this.customerData.addresses == null) this.customerData.addresses = [];
    if (this.expandedAddress !== null) return;
    const newAddress = new CustomerAddress();
    if (this.customerData.addresses.length === 0) newAddress.isDefault = true;
    this.customerData.addresses.push(newAddress);
    const newIndex = this.customerData.addresses.length - 1;
    this.selectedAddress = newIndex;
    this.addressesFormGroup.push(
      new FormGroup({
        addressTitle: new FormControl('', [
          Validators.required,
          addressTitleUniqueValidator(() => this.customerData.addresses),
        ]),
      }),
    );
    this.editAddress(newIndex, true);
  }

  /** Expand a card for inline editing; snapshot the values so Cancel can revert. */
  editAddress(index: number, isNew = false): void {
    const address = this.customerData?.addresses?.[index];
    if (!address) return;
    this.expandedAddress = index;
    this.editingIsNew = isNew;
    this.editingSnapshot = Object.assign(new CustomerAddress(), address);
  }

  isEditingAddress(index: number): boolean {
    return this.expandedAddress === index;
  }

  /** Apply a preset label (Home / Office / …) — model and control, so validators re-run. */
  applyTitlePreset(index: number, presetId: string): void {
    const address = this.customerData?.addresses?.[index];
    if (!address) return;
    address.title = presetId;
    const titleControl = this.addressesFormGroup.at(index)?.get('addressTitle');
    if (titleControl) {
      titleControl.setValue(presetId);
      titleControl.markAsDirty();
      titleControl.updateValueAndValidity();
    }
  }

  onAddressTitle(index: number, value: string): void {
    const address = this.customerData.addresses[index];
    if (address) address.title = value;
    const c = this.addressesFormGroup.at(index)?.get('addressTitle');
    if (c) { c.setValue(value); c.markAsDirty(); }
  }

  /** Confirm inline edits: runs the title validator and collapses the card (false = stays open). */
  saveAddressEdit(index: number): boolean {
    const titleControl = this.addressesFormGroup.at(index)?.get('addressTitle');
    if (titleControl) {
      titleControl.markAsTouched();
      titleControl.updateValueAndValidity();
      if (titleControl.invalid) return false;
    }
    this.expandedAddress = null;
    this.editingSnapshot = null;
    this.editingIsNew = false;
    this.customerForm.markAsDirty();
    return true;
  }

  /** Cancel inline edits: revert an existing address, drop a brand-new placeholder. */
  cancelAddressEdit(index: number): void {
    const address = this.customerData?.addresses?.[index];
    if (!address) {
      this.expandedAddress = null; this.editingSnapshot = null; this.editingIsNew = false;
      return;
    }
    if (this.editingIsNew) {
      const wasDefault = address.isDefault;
      this.customerData.addresses.splice(index, 1);
      this.addressesFormGroup.removeAt(index);
      if (wasDefault && this.customerData.addresses.length > 0) this.customerData.addresses[0].isDefault = true;
      if (this.selectedAddress >= this.customerData.addresses.length) {
        this.selectedAddress = Math.max(0, this.customerData.addresses.length - 1);
      }
    } else if (this.editingSnapshot) {
      Object.assign(address, this.editingSnapshot);
      const titleControl = this.addressesFormGroup.at(index)?.get('addressTitle');
      if (titleControl) {
        titleControl.setValue(address.title);
        titleControl.updateValueAndValidity();
      }
    }
    this.expandedAddress = null; this.editingSnapshot = null; this.editingIsNew = false;
  }

  // ── opening balance (per branch; new customers only) ───────────────
  branchOptions = () => this.branchSvc.branches().map(b => ({ value: b.id, label: b.name }));
  currentBranch = () => this.branchOptions().find(b => b.value === this.oBalanceData.branchId) ?? null;

  onBranchChange(o: any): void {
    this.oBalanceData.branchId = o?.value ?? '';
    this.oBalanceData.openingBalance = 0;
    const found = (this.customerData.openingBalance ?? []).find((ob: any) => ob.branchId == this.oBalanceData.branchId);
    if (found) this.oBalanceData.openingBalance = found.openingBalance;
  }

  onOBalanceChange(value: any): void {
    this.oBalanceData.openingBalance = value;
    if (!Array.isArray(this.customerData.openingBalance)) this.customerData.openingBalance = [];
    const existing = this.customerData.openingBalance.find((ob: any) => ob.branchId === this.oBalanceData.branchId);
    if (existing) existing.openingBalance = value;
    else this.customerData.openingBalance.push({ branchId: this.oBalanceData.branchId, openingBalance: value });
    this.customerForm.markAsDirty();
  }

  // ── notes ──────────────────────────────────────────────────────────
  newNote = new CustomerNotes();
  showedNoteBox = false;

  showNoteBox(): void { this.showedNoteBox = true; }

  addNote(): void {
    if (!this.newNote.note?.trim()) return;
    if (this.customerData.notes == null) this.customerData.notes = [];
    const emp: any = this.auth.currentEmployee;
    this.newNote.isNew = true;
    this.newNote.employeeId = emp?.id ?? '';
    this.newNote.employeeName = emp?.name ?? '';
    this.customerData.notes.push(this.newNote);
    this.newNote = new CustomerNotes();
    this.customerForm.markAsDirty();
  }

  async removeNote(note: CustomerNotes): Promise<void> {
    if (!(await this.confirm('CUSTOMERS.FORM.CONFIRM_GO_BACK'))) return;
    const i = this.customerData.notes.indexOf(note);
    if (i >= 0) this.customerData.notes.splice(i, 1);
    this.customerForm.markAsDirty();
  }

  // ── parent customer: inline "create new" (quick-create dialog, loaded lazily) ──
  async createParent(): Promise<void> {
    const { CustomerQuickCreateModalComponent } = await import(
      '../customer-quick-create-modal/customer-quick-create-modal.component'
    );
    const res = await this.modal
      .open<any, void, { customerId: string; customerName: string }>(CustomerQuickCreateModalComponent, {
        size: 'lg',
        closeOnBackdrop: false,
      })
      .afterClosed();
    if (res?.customerId) {
      this.customerData.parentId = res.customerId;
      this.customerData.parentName = res.customerName;
      this.customerForm.markAsDirty();
    }
  }

  parentValue = () => this.selectedRef(this.customerData.parentId, this.customerData.parentName);
}
