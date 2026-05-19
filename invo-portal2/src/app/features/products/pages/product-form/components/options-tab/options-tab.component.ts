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
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

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
    SegmentedToggleComponent,
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

  /** Segmented-toggle options. SVG icons reuse the same `viewBox` /
   *  stroke conventions used elsewhere in the form so the toggle's
   *  icon slot renders them consistently. */
  tabOptions = computed<SegmentedToggleOption<Tab>[]>(() => [
    {
      value:    'quick',
      label:    'PRODUCTS.FORM.QUICK_OPTIONS',
      disabled: !this.showQuick(),
      icon:     '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
    },
    {
      value:    'default',
      label:    'PRODUCTS.FORM.DEFAULT_OPTIONS',
      disabled: !this.showDefault(),
      icon:     '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
    },
    {
      value:    'group',
      label:    'PRODUCTS.FORM.OPTION_GROUPS',
      disabled: !this.showGroup(),
      icon:     '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    },
  ]);

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
