import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';
import type { BranchSummary } from '../../../services/branch-settings.service';
import type { Menu } from '../../services/menu-builder.types';
import type { MenuFormErrors } from '../../utils/menu-form-validation';
import { formatHours } from '../../utils/menu-hours';
import { BranchChipsComponent } from '../branch-chips/branch-chips.component';

export interface MenuDetailsPatch { key: 'name' | 'priceLabelId' | 'startAt' | 'endAt' | 'availableOnline' | 'branchIds'; value: unknown }

/**
 * "Menu details": name and price list, the available hours with the online toggle, and the branches as chips.
 * Presentational: fields come in as inputs, every change goes out as one `patch`.
 */
@Component({
  selector: 'app-menu-details-card',
  standalone: true,
  imports: [FormsModule, TranslateModule, SearchDropdownComponent, TimePickerComponent, BranchChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-details-card.component.html',
  styleUrl: './menu-details-card.component.scss',
})
export class MenuDetailsCardComponent {
  menu = input.required<Pick<Menu, 'name' | 'priceLabelId' | 'startAt' | 'endAt' | 'availableOnline' | 'branchIds'>>();
  priceLabels = input<Array<{ id: string; name: string }>>([]);
  branches = input<BranchSummary[]>([]);
  errors = input<MenuFormErrors>({});
  /** IANA zone the hours are in, for the helper text. */
  timeZone = input('');
  patch = output<MenuDetailsPatch>();

  hours = computed(() => formatHours(this.menu()));
  priceSelected = computed(() => this.priceLabels().find((p) => p.id === this.menu().priceLabelId) ?? null);

  priceLabel = (p: { id: string; name: string }) => p.name || '—';
  priceValue = (p: { id: string; name: string }) => p.id;
  priceEquals = (a: { id: string; name: string }, b: { id: string; name: string }) => a?.id === b?.id;

  /** The picker speaks "HH:mm"; the model keeps the wire's "HH:mm:ss". */
  short = (t: string) => (t || '').slice(0, 5);
  long = (t: string) => (t ? `${t}:00` : '00:00:00');
  onPrice(next: unknown): void { this.patch.emit({ key: 'priceLabelId', value: (next as { id?: string } | null)?.id ?? '' }); }
}
