import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { BranchServiceModel } from '../../../services/service.types';

/** Per-branch settings for `type === 'Salon'`. Minimal — just the
 *  shared Enable toggle (no surcharge / price-label inputs). */
@Component({
  selector: 'app-salon-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
export class SalonSettingsComponent {
  @Input({ required: true }) branch!: BranchServiceModel;
  @Output() branchUpdate = new EventEmitter<BranchServiceModel>();

  patchSetting(key: string, value: unknown): void {
    this.branchUpdate.emit({
      ...this.branch,
      setting: { ...this.branch.setting, [key]: value },
    });
  }
}
