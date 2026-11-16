import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { DaySpan, TranslatedString, translate } from '../../../models/common.model';
import { areEqual, clone } from '../../../models/promotions-utils';
import { ConditionMatch, CustomerTier, CustomerTierSettings } from '../../../models/tiers.model';
import { TiersService } from '../../../services/tiers.service';
import { DaySpanControlComponent } from '../../../components/day-span-control/day-span-control.component';
import { TranslatedStringInputComponent } from '../../../components/translated-string-input/translated-string-input.component';
import {
  PromoActionData,
  PromoActionModalComponent,
  PromoActionResult,
} from '../../../components/promo-action-modal/promo-action-modal.component';

const PRIV = 'customerTiersPrivileges.actions.';
const KEY = 'PROMOTIONS.CUSTOMER_TIERS.';
const MAX_TIERS = 8;

/**
 * Customer tiers → one page with a read-only view (condition summary + tier
 * cards) and an edit mode (condition settings, tier editor, reason + note).
 * Legacy `CustomerTiersComponent`: same conditions, validation, limits (8
 * tiers), evaluation / enable-disable flows and payloads.
 */
@Component({
  selector: 'app-tiers-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, MycurrencyPipe, BreadcrumbsComponent, FormStickyFooterComponent,
    SearchDropdownComponent, ToggleComponent, DaySpanControlComponent, TranslatedStringInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tiers-page.component.html',
  styleUrl: './tiers-page.component.scss',
})
export class TiersPageComponent implements OnInit, CanLeaveComponent {
  private service = inject(TiersService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);
  private company = inject(CompanyService);

  readonly canEdit = this.privileges.check(PRIV + 'Edit.access');
  readonly canEvaluate = this.privileges.check(PRIV + 'Evaluation.access');
  readonly canSendEmail = this.privileges.check(PRIV + 'SendEmail.access');
  readonly canEnableDisable = this.privileges.check(PRIV + 'EnableDisable.access');

  translate = translate;
  ConditionMatch = ConditionMatch;
  currentLang = computed(() => this.lang.current() || 'en');

  data = signal<CustomerTierSettings | null>(null);
  editMode = signal(false);
  saving = signal(false);
  reason = signal<TranslatedString>({});
  notes = signal('');
  /** Bumped to re-create the master switch when its reason dialog is cancelled, so it snaps back. */
  toggleKeys = signal([0]);
  private original: CustomerTierSettings | null = null;

  breadcrumbs: BreadcrumbItem[] = [];

  conditionOptions = [
    { value: ConditionMatch.ALL_CONDITION, label: KEY + 'ALL_CONDITION' },
    { value: ConditionMatch.ANY_CONDITION, label: KEY + 'ANY_CONDITION' },
  ];
  conditionDisplay = (i: any) => this.lang.instant(i?.label ?? '');
  conditionCompare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  conditionToValue = (i: any) => i?.value ?? i;
  selectedCondition = computed(() => this.conditionOptions.find(o => o.value === this.data()?.conditionMatch) ?? null);

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('promotions');
    const t = (k: string) => this.lang.instant(k);
    this.breadcrumbs = [
      { label: t('PROMOTIONS.TITLE'), routerLink: '/dashboard' },
      { label: t(KEY + 'CUSTOMER_TIERS') },
    ];
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.data.set(await this.service.getCustomerTierSettings());
  }

  // ── unsaved-changes guard ─────────────────────────────────────────
  hasUnsavedChanges(): boolean {
    return this.editMode() && !this.saving() && !!this.original && !areEqual(this.data(), this.original);
  }

  // ── view ⇄ edit ───────────────────────────────────────────────────
  switchToEditMode(): void {
    const d = this.data();
    if (!d) return;
    this.original = clone(d);
    this.data.set(clone(d));
    this.reason.set({});
    this.notes.set('');
    this.editMode.set(true);
  }

  async cancelChanges(): Promise<void> {
    if (this.hasUnsavedChanges()) {
      const ok = await this.confirmMessage('PROMOTIONS.MESSAGE.CONFIRM_TO_LEAVE_AND_LOSS_CHANGES');
      if (!ok) return;
    }
    if (this.original) this.data.set(clone(this.original));
    this.original = null;
    this.editMode.set(false);
  }

  private async confirmMessage(titleKey: string): Promise<boolean> {
    const t = (k: string) => this.lang.instant(k);
    const ok = await this.modal
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        size: 'sm',
        data: { title: t(titleKey), message: '', confirm: t('COMMON.YES'), cancel: t('COMMON.NO') },
      })
      .afterClosed();
    return !!ok;
  }

  private async ask(title: string): Promise<PromoActionResult | null> {
    const data: PromoActionData = { kind: 'reason', title, domain: 'tiers' };
    const result = await this.modal
      .open<PromoActionModalComponent, PromoActionData, PromoActionResult | null>(PromoActionModalComponent, {
        size: 'sm',
        data,
        closeOnBackdrop: false,
      })
      .afterClosed();
    return result ?? null;
  }

  // ── conditions ────────────────────────────────────────────────────
  private mutate(fn: (d: CustomerTierSettings) => void): void {
    this.data.update(d => {
      if (!d) return d;
      const next = { ...d };
      fn(next);
      return next;
    });
  }

  atLeastOneConditionSelected = computed(() => {
    const d = this.data();
    return !!d && (d.useMinOrder || d.useMinSpend);
  });
  isCustomerMatchDisabled = computed(() => {
    const d = this.data();
    return !!d && d.useMinOrder !== d.useMinSpend;
  });

  setUseMinOrder(v: boolean): void {
    this.mutate(d => { d.useMinOrder = v; });
    this.updateConditions();
  }
  setUseMinSpend(v: boolean): void {
    this.mutate(d => { d.useMinSpend = v; });
    this.updateConditions();
  }
  /** Legacy `updateConditions`: one condition → no match mode, two → ALL. */
  private updateConditions(): void {
    this.mutate(d => {
      const count = Number(d.useMinOrder) + Number(d.useMinSpend);
      d.conditionMatch = count === 1 ? ConditionMatch.NO_CONDITION : ConditionMatch.ALL_CONDITION;
    });
  }
  setConditionMatch(item: any): void {
    const v = (item && typeof item === 'object' ? item.value : item) ?? ConditionMatch.ALL_CONDITION;
    this.mutate(d => { d.conditionMatch = v; });
  }
  setCalculationPeriod(span: DaySpan): void {
    this.mutate(d => { d.calculationPeriod = { ...span }; });
  }

  // ── tiers ─────────────────────────────────────────────────────────
  isAddCustomerTierVisible = computed(() => (this.data()?.customerTiers.length ?? 0) < MAX_TIERS);

  addCustomerTier(): void {
    this.mutate(d => {
      if (d.customerTiers.length < MAX_TIERS) {
        d.customerTiers = [
          ...d.customerTiers,
          { id: '', name: {}, minNumberOfOrders: 0, minAmountSpend: 0, customerCount: 0, enabled: true },
        ];
      }
    });
  }

  async confirmRemoveTier(index: number): Promise<void> {
    const ok = await this.confirmMessage('COMMON.CONFIRM_DELETE');
    if (!ok) return;
    this.mutate(d => { d.customerTiers = d.customerTiers.filter((_, i) => i !== index); });
  }

  private patchTier(index: number, part: Partial<CustomerTier>): void {
    this.mutate(d => { d.customerTiers = d.customerTiers.map((t, i) => (i === index ? { ...t, ...part } : t)); });
  }
  setTierEnabled(index: number, v: boolean): void { this.patchTier(index, { enabled: v }); }
  setTierName(index: number, name: TranslatedString): void { this.patchTier(index, { name }); }
  setTierOrders(index: number, v: number): void { this.patchTier(index, { minNumberOfOrders: v }); }
  setTierSpend(index: number, v: number): void { this.patchTier(index, { minAmountSpend: v }); }

  // ── decimals (legacy MathHelpers.afterDecimal) ────────────────────
  private afterDecimal = computed(() => this.company.settings()?.settings?.afterDecimal ?? 3);
  amountStep = computed(() =>
    this.afterDecimal() > 0 ? (1 / Math.pow(10, this.afterDecimal())).toFixed(this.afterDecimal()) : '1');

  limitAmountDecimals(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const [intPart, decPart] = input.value.split('.');
    const dec = this.afterDecimal();
    if (decPart === undefined || decPart.length <= dec) return;
    const trimmed = dec > 0 ? `${intPart}.${decPart.slice(0, dec)}` : intPart;
    input.value = trimmed;
    this.setTierSpend(index, Number(trimmed));
  }

  // ── validation (legacy) ───────────────────────────────────────────
  /** Legacy `isUniqueTranslation`, kept as written (compares against the lower-cased entry). */
  private isUniqueName(name: string, index: number, tiers: CustomerTier[]): boolean {
    const lang = this.currentLang();
    return !tiers.some((tier, i) => tier.name[lang]?.trim()?.toLowerCase() === name && i !== index);
  }

  validateTierName(tier: CustomerTier, index: number): string | null {
    const tiers = this.data()?.customerTiers ?? [];
    const trimmed = translate(tier.name, this.currentLang()).trim();
    if (!trimmed) return KEY + 'THE_NAME_IS_REQUIRED';
    if (!this.isUniqueName(trimmed, index, tiers)) return KEY + 'THE_NAME_ALREADY_EXISTS';
    return null;
  }

  ordersNotAbovePrevious(i: number): boolean {
    const d = this.data();
    if (!d?.useMinOrder || i <= 0) return false;
    return d.customerTiers[i].minNumberOfOrders <= d.customerTiers[i - 1].minNumberOfOrders;
  }

  spendNotAbovePrevious(i: number): boolean {
    const d = this.data();
    if (!d?.useMinSpend || i <= 0) return false;
    return d.customerTiers[i].minAmountSpend <= d.customerTiers[i - 1].minAmountSpend;
  }

  reasonValid = computed(() => (this.reason()[this.currentLang()] ?? '') !== '');

  valid = computed(() => {
    const d = this.data();
    if (!d) return false;
    return (
      d.customerTiers.every(
        (tier, i) =>
          this.validateTierName(tier, i) === null && !this.ordersNotAbovePrevious(i) && !this.spendNotAbovePrevious(i),
      ) &&
      this.atLeastOneConditionSelected() &&
      this.reasonValid()
    );
  });

  async save(): Promise<void> {
    const d = this.data();
    if (!d || !this.valid() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.service.saveCustomerTierSettings({ reason: this.reason(), note: this.notes() }, d);
      this.original = null;
      this.editMode.set(false);
      this.toast.success('COMMON.SAVED_OK');
      await this.refresh();
    } finally {
      this.saving.set(false);
    }
  }

  // ── enable / disable (reason + note, then PUT settings) ───────────
  async toggleEnabled(): Promise<void> {
    const d = this.data();
    if (!d) return;
    const result = await this.ask(KEY + 'DISABLE_ENABLE_CUSTOMER_TIERS');
    if (!result) {
      this.toggleKeys.update(k => [k[0] + 1]);
      return;
    }
    await this.service.saveCustomerTierSettings(
      { reason: result.reason, note: result.note },
      { ...d, enabled: !d.enabled },
    );
    await this.refresh();
    this.toggleKeys.update(k => [k[0] + 1]);
    this.toast.success('COMMON.SAVED_OK');
  }

  // ── evaluation ────────────────────────────────────────────────────
  async evaluate(): Promise<void> {
    const result = await this.ask(KEY + 'EVALUATION');
    if (!result) return;
    await this.service.evaluateCustomerCounts({ reason: result.reason, note: result.note });
    await this.refresh();
    this.toast.success(KEY + 'EVALUATION_SUCCESS');
  }

  // ── email (legacy: "coming soon" notices only) ────────────────────
  async sendEmail(index: number): Promise<void> {
    const tier = this.data()?.customerTiers[index];
    if (!tier) return;
    await this.confirmMessage(
      tier.customerCount === 0 ? KEY + 'THERE_ARE_NO_CUSTOMERS_IN_THIS_TIER' : KEY + 'EMAIL_SENDING_IS_COMING_SOON',
    );
  }

  openHistory(): void {
    void this.router.navigate(['/promotions/customer-tiers/history']);
  }
}
