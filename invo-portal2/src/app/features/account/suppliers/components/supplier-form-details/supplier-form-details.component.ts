import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { BranchConnectionService } from '@core/layout/services/branch.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { CountriesService, Country } from '@shared/services/countries.service';
import { EntityCustomFieldsComponent } from '@features/settings/components/entity-custom-fields/entity-custom-fields.component';
import { PaymentMethodService } from '@features/settings/payment-methods/services/payment-method.service';

import { Supplier, SupplierContact } from '../../models/supplier.model';
import { SalesLookupsService } from '../../../services/sales-lookups.service';
import { SuppliersService } from '../../services/suppliers.service';
import { SupplierItemsCardComponent } from '../supplier-items-card/supplier-items-card.component';
import { contactGroup } from '../../services/supplier-form.builder';

interface Opt { value: string; label: string }

/**
 * Supplier form body — the cards of the legacy `supplier-form-details`: general information, contact
 * information, financial information (currency, cost centre, payment term), custom fields, opening
 * balance (new suppliers only), notes and extra contacts. The parent owns the `Supplier` model and the
 * reactive form (`supplierNameInput`, `supplierPhoneInput`, `supplierEmailInput`, `contacts[]`); this
 * edits the model in place, exactly as the legacy component did.
 */
@Component({
  selector: 'app-supplier-form-details',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, SearchDropdownComponent, EntityCustomFieldsComponent, SupplierItemsCardComponent],
  templateUrl: './supplier-form-details.component.html',
  styleUrl: './supplier-form-details.component.scss',
})
export class SupplierFormDetailsComponent implements OnInit {
  private branchSvc = inject(BranchConnectionService);
  private countriesSvc = inject(CountriesService);
  private paymentMethods = inject(PaymentMethodService);
  private lookups = inject(SalesLookupsService);
  private suppliers = inject(SuppliersService);
  private destroyRef = inject(DestroyRef);

  @Input() supplierData = new Supplier();
  @Input() supplierForm!: FormGroup;
  @Input() formStatus: 'new' | 'edit' | string = 'new';

  get controls() { return this.supplierForm.controls; }
  get contactsFormGroup() { return this.supplierForm.get('contacts') as FormArray; }

  terms: Opt[] = [
    { value: 'net7', label: 'Net 7' }, { value: 'net10', label: 'Net 10' }, { value: 'net15', label: 'Net 15' },
    { value: 'net30', label: 'Net 30' }, { value: 'net60', label: 'Net 60' }, { value: 'net90', label: 'Net 90' },
    { value: 'endOfTheMonth', label: 'End of the month' }, { value: 'onReceiptDue', label: 'On Receipt Due' },
  ];
  countries: Country[] = [];
  accounts: Opt[] = [];
  oBalanceData: { branchId: string; openingBalance: number } = { branchId: '', openingBalance: 0 };

  async ngOnInit(): Promise<void> {
    // Reactive controls hold name / phone / email; mirror them into the model (legacy: ngModel + formControlName).
    const mirror: [string, keyof Supplier][] = [['supplierNameInput', 'name'], ['supplierPhoneInput', 'phone'], ['supplierEmailInput', 'email']];
    for (const [control, prop] of mirror) {
      this.supplierForm.get(control)?.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(v => ((this.supplierData as any)[prop] = v ?? ''));
    }
    if (this.supplierData.contacts == null) this.supplierData.contacts = [];

    if (this.formStatus === 'new') {
      await this.branchSvc.load().catch(() => {});
      const first = this.branchSvc.branches()[0];
      if (first) this.oBalanceData.branchId = first.id;
    }
    this.countries = await this.countriesSvc.load().catch(() => []);
    this.accounts = (await this.lookups.getPurchaseAccounts().catch(() => [])).map((a: any) => ({ value: a.id, label: a.name }));
    if (this.supplierData.currencyId) {
      const cur = await this.paymentMethods.getById(this.supplierData.currencyId).catch(() => null);
      this.currencyName = (cur as any)?.name ?? '';
    }
  }

  // ── shared dropdown helpers ────────────────────────────────────────
  displayPlain = (o: any) => o?.label ?? o?.name ?? '';
  compare = (a: any, b: any) => (a?.value ?? a?.name) === (b?.value ?? b?.name);
  pick = (list: Opt[], value: string | null | undefined): Opt | null => list.find(o => o.value === value) ?? null;
  set(prop: keyof Supplier, o: any): void { (this.supplierData as any)[prop] = o?.value ?? ''; this.supplierForm.markAsDirty(); }
  edit(prop: keyof Supplier, value: any): void { (this.supplierData as any)[prop] = value; this.supplierForm.markAsDirty(); }

  // ── currency (a Cash payment method) ───────────────────────────────
  private currencyName = '';
  loadCurrencies = async (p: { page: number; pageSize: number; search: string }) => {
    const res = await this.paymentMethods.getList({ page: p.page, limit: p.pageSize, type: 'Cash', searchTerm: p.search });
    const items = (res.list ?? []).map((x: any) => ({ value: x.id, label: x.name }));
    return { items, hasMore: p.page < (res.pageCount ?? 1) };
  };
  currentCurrency = (): Opt | null => (this.supplierData.currencyId ? { value: this.supplierData.currencyId, label: this.currencyName } : null);
  onCurrency(o: any): void {
    this.currencyName = o?.label ?? '';
    this.supplierData.currencyId = o?.value ?? null;
    this.supplierForm.markAsDirty();
  }

  // ── country ────────────────────────────────────────────────────────
  countryOf = () => (this.supplierData.country ? { name: this.supplierData.country } : null);
  onCountry(c: any): void { this.supplierData.country = c?.name ?? ''; this.supplierForm.markAsDirty(); }

  // ── opening balance (per branch; new suppliers only) ───────────────
  branchOptions = () => this.branchSvc.branches().map(b => ({ value: b.id, label: b.name }));
  currentBranch = () => this.branchOptions().find(b => b.value === this.oBalanceData.branchId) ?? null;

  onBranchChange(o: any): void {
    this.oBalanceData.branchId = o?.value ?? '';
    this.oBalanceData.openingBalance = 0;
    const found = (this.supplierData.openingBalance ?? []).find(ob => ob.branchId == this.oBalanceData.branchId);
    if (found) this.oBalanceData.openingBalance = found.openingBalance;
  }

  onOBalanceChange(value: any): void {
    this.oBalanceData.openingBalance = value;
    if (!Array.isArray(this.supplierData.openingBalance)) this.supplierData.openingBalance = [];
    const existing = this.supplierData.openingBalance.find(ob => ob.branchId === this.oBalanceData.branchId);
    if (existing) existing.openingBalance = value;
    else this.supplierData.openingBalance.push({ branchId: this.oBalanceData.branchId, openingBalance: value });
    this.supplierForm.markAsDirty();
  }

  // ── contacts ───────────────────────────────────────────────────────
  addContact(): void {
    const contact = new SupplierContact();
    this.supplierData.contacts.push(contact);
    this.contactsFormGroup.push(contactGroup(contact, this.supplierData, this.suppliers, () => this.supplierData.id || null));
    this.supplierForm.markAsDirty();
  }

  removeContact(index: number): void {
    this.supplierData.contacts.splice(index, 1);
    this.contactsFormGroup.removeAt(index);
    this.supplierForm.markAsDirty();
    this.contactsFormGroup.controls.forEach(g => g.updateValueAndValidity());
  }

  /** Contact controls mirror into the model (legacy: ngModel + formControlName on the same input). */
  setContact(index: number, prop: keyof SupplierContact, value: string): void {
    (this.supplierData.contacts[index] as any)[prop] = value;
  }
}
