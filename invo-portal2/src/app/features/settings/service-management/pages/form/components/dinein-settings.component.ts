import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import {
  BranchServiceModel,
  SurchargeOption,
  PriceLabelOption,
} from '../../../services/service.types';

/**
 * Per-branch settings panel for `type === 'DineIn'`.
 *
 * The widest of the seven panels — surfaces Charge / Price dropdowns
 * plus four DineIn-specific toggles (table selection, single-ticket,
 * customer phone in reservation, enforce guest count) on top of the
 * shared Enable toggle.
 */
@Component({
  selector: 'app-dinein-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bs-grid">
      <label class="bs-field">
        <span class="bs-label">{{ 'SERVICE_MANAGEMENT.FIELDS.CHARGE' | translate }}</span>
        <app-search-dropdown
          [items]="surcharges"
          [displayWith]="optionDisplay"
          [compareWith]="optionCompare"
          [toValue]="optionToValue"
          [value]="selectedCharge()"
          [clearable]="true"
          [placeholder]="'SERVICE_MANAGEMENT.FIELDS.CHARGE_PLACEHOLDER' | translate"
          (valueChange)="setCharge($any($event))"/>
      </label>

      <label class="bs-field">
        <span class="bs-label">{{ 'SERVICE_MANAGEMENT.FIELDS.PRICE' | translate }}</span>
        <app-search-dropdown
          [items]="priceLabels"
          [displayWith]="optionDisplay"
          [compareWith]="optionCompare"
          [toValue]="optionToValue"
          [value]="selectedPrice()"
          [clearable]="true"
          [placeholder]="'SERVICE_MANAGEMENT.FIELDS.PRICE_PLACEHOLDER' | translate"
          (valueChange)="setPrice($any($event))"/>
      </label>
    </div>

    <div class="bs-toggles">
      <label class="bs-toggle">
        <input type="checkbox"
          [checked]="!!branch.setting.enabled"
          (change)="patchSetting('enabled', $any($event.target).checked)"/>
        <span class="bs-toggle__text">
          <strong>{{ 'SERVICE_MANAGEMENT.FIELDS.ENABLED' | translate }}</strong>
          <small>{{ 'SERVICE_MANAGEMENT.FIELDS.ENABLED_HINT' | translate }}</small>
        </span>
      </label>
      <label class="bs-toggle">
        <input type="checkbox"
          [checked]="!!branch.setting.showTableSelection"
          (change)="patchSetting('showTableSelection', $any($event.target).checked)"/>
        <span class="bs-toggle__text">
          <strong>{{ 'SERVICE_MANAGEMENT.FIELDS.SHOW_TABLE_SELECTION' | translate }}</strong>
        </span>
      </label>
      <label class="bs-toggle">
        <input type="checkbox"
          [checked]="!!branch.setting.onlyOneTicketPerTable"
          (change)="patchSetting('onlyOneTicketPerTable', $any($event.target).checked)"/>
        <span class="bs-toggle__text">
          <strong>{{ 'SERVICE_MANAGEMENT.FIELDS.ONLY_ONE_TICKET_PER_TABLE' | translate }}</strong>
        </span>
      </label>
      <label class="bs-toggle">
        <input type="checkbox"
          [checked]="!!branch.setting.showCustomerPhoneInReservation"
          (change)="patchSetting('showCustomerPhoneInReservation', $any($event.target).checked)"/>
        <span class="bs-toggle__text">
          <strong>{{ 'SERVICE_MANAGEMENT.FIELDS.SHOW_CUSTOMER_PHONE_IN_RESERVATION' | translate }}</strong>
        </span>
      </label>
      <label class="bs-toggle">
        <input type="checkbox"
          [checked]="!!branch.setting.enforceGuestCount"
          (change)="patchSetting('enforceGuestCount', $any($event.target).checked)"/>
        <span class="bs-toggle__text">
          <strong>{{ 'SERVICE_MANAGEMENT.FIELDS.ENFORCE_GUEST_COUNT' | translate }}</strong>
        </span>
      </label>
    </div>
  `,
  styleUrl: './branch-settings.shared.scss',
})
export class DineinSettingsComponent {
  @Input({ required: true }) branch!: BranchServiceModel;
  @Input() surcharges:  SurchargeOption[]  = [];
  @Input() priceLabels: PriceLabelOption[] = [];
  @Output() branchUpdate = new EventEmitter<BranchServiceModel>();

  optionDisplay = (o: { id: string; name: string } | null) => o?.name ?? '';
  optionCompare = (a: { id: string } | null, b: { id: string } | null) => (a?.id ?? '') === (b?.id ?? '');
  optionToValue = (o: { id: string } | null) => o?.id ?? '';

  selectedCharge = () => this.surcharges.find(s => s.id === this.branch.chargeId) ?? null;
  selectedPrice  = () => this.priceLabels.find(p => p.id === this.branch.priceLabelId) ?? null;

  setCharge(v: { id: string } | null): void {
    this.branchUpdate.emit({ ...this.branch, chargeId: v?.id ?? '' });
  }
  setPrice(v: { id: string } | null): void {
    this.branchUpdate.emit({ ...this.branch, priceLabelId: v?.id ?? '' });
  }
  patchSetting(key: string, value: unknown): void {
    this.branchUpdate.emit({
      ...this.branch,
      setting: { ...this.branch.setting, [key]: value },
    });
  }
}
