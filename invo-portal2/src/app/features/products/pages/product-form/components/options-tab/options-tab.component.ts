import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

import { QuickOptionComponent } from './quick-option.component';
import { DefaultOptionsComponent } from './default-options.component';
import { OptionGroupComponent } from './option-group.component';

type Tab = 'quick' | 'default' | 'group';

/**
 * options-tab
 * ───────────
 * MenuItem options card. Tabbed wrapper with three sub-sections:
 *   • Quick options     — flat list of POS-quick-add items (no qty/order)
 *   • Default options   — drag-orderable list with per-item qty
 *   • Option groups     — drag-orderable list of option-group references
 *
 * Each tab is gated independently by `fieldsOptions.{quickOptions,
 * defaultOptions, optionGroups}.isVisible`.  The card hides entirely when
 * no tab is visible.  Picks are sourced from `product/getOptionsList` and
 * `product/getOptionGroupList` via dedicated modals.
 */
@Component({
  selector: 'app-pf-options-tab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    QuickOptionComponent,
    DefaultOptionsComponent,
    OptionGroupComponent,
  ],
  templateUrl: './options-tab.component.html',
  styleUrl: './options-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsTabComponent {
  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  showQuick   = computed(() => !!this.fieldsOptions()?.quickOptions?.isVisible);
  showDefault = computed(() => !!this.fieldsOptions()?.defaultOptions?.isVisible);
  showGroup   = computed(() => !!this.fieldsOptions()?.optionGroups?.isVisible);
  hasAny      = computed(() => this.showQuick() || this.showDefault() || this.showGroup());

  /** First-visible tab on init; user can switch freely afterwards. */
  activeTab = signal<Tab>('quick');

  constructor() {
    queueMicrotask(() => {
      if (this.showQuick())        this.activeTab.set('quick');
      else if (this.showDefault()) this.activeTab.set('default');
      else if (this.showGroup())   this.activeTab.set('group');
    });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }
}
