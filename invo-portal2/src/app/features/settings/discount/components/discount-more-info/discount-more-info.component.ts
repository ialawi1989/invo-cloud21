import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { MODAL_DATA } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';

import { SalesLookupsService } from '../../../../account/services/sales-lookups.service';
import { DiscountService } from '../../services/discount.service';
import { Discount } from '../../services/discount.types';

export interface DiscountMoreInfoData { discount: Discount; }

/**
 * "More info" side drawer of the discount list (legacy `DiscountMoreInfoComponent`): value & scope, validity window,
 * availability (with the branch names) and the tax / permitted employees of one discount. The list row only has ids,
 * so the discount is read again for the branch and employee names.
 */
@Component({
  selector: 'app-discount-more-info',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  templateUrl: './discount-more-info.component.html',
  styleUrl: './discount-more-info.component.scss',
})
export class DiscountMoreInfoComponent implements OnInit {
  private service = inject(DiscountService);
  private lookups = inject(SalesLookupsService);
  protected data = inject<DiscountMoreInfoData>(MODAL_DATA);

  discount: Discount = this.data.discount;
  branchNames = signal<string[]>([]);
  employeeNames = signal<string[]>([]);
  taxName = signal('');
  loading = signal(true);

  constructor() { withTranslations('settings/discount'); }

  /** An automatic discount without start / expire times runs all day (legacy `Discount.allDay`). */
  get allDay(): boolean { return !this.discount.startAtTime && !this.discount.expireAtTime; }

  async ngOnInit(): Promise<void> {
    try {
      const full = await this.service.getById(this.discount.id);
      if (full) {
        this.discount = full.discount;
        this.branchNames.set(full.selections.branches.map(b => b.name));
        this.employeeNames.set(full.selections.employees.map(e => e.name));
      }
      if (this.discount.taxId) {
        const taxes = await this.lookups.getTaxes().catch(() => []);
        this.taxName.set(taxes.find(t => t.id === this.discount.taxId)?.name ?? '');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
