import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import {
  BranchServiceModel,
  PriceLabelOption,
} from '../../../services/service.types';

/** Per-branch settings for `type === 'Retail'`. Just the Enable
 *  toggle plus a Price-label dropdown (no surcharge). */
@Component({
  selector: 'app-retail-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="bs-field">
      <span class="bs-label">{{ 'SERVICE_MANAGEMENT.FIELDS.PRICE' | translate }}</span>
      <app-search-dropdown
        [items]="priceLabels"
        [displayWith]="optionDisplay" [compareWith]="optionCompare" [toValue]="optionToValue"
        [value]="selectedPrice()" [clearable]="true"
        [placeholder]="'SERVICE_MANAGEMENT.FIELDS.PRICE_PLACEHOLDER' | translate"
        (valueChange)="setPrice($any($event))"/>
    </label>

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
    </div>
  `,
  styleUrl: './branch-settings.shared.scss',
})
export class RetailSettingsComponent {
  @Input({ required: true }) branch!: BranchServiceModel;
  @Input() priceLabels: PriceLabelOption[] = [];
  @Output() branchUpdate = new EventEmitter<BranchServiceModel>();

  optionDisplay = (o: { id: string; name: string } | null) => o?.name ?? '';
  optionCompare = (a: { id: string } | null, b: { id: string } | null) => (a?.id ?? '') === (b?.id ?? '');
  optionToValue = (o: { id: string } | null) => o?.id ?? '';
  selectedPrice = () => this.priceLabels.find(p => p.id === this.branch.priceLabelId) ?? null;

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
