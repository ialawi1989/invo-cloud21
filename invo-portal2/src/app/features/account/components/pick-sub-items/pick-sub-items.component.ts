import '../../account-i18n';
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { MathUtils } from '@core/math/math-helpers';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

import { applySubItemsPricing, isMenuSelectionDefinition, SubItemsDefinition } from '../../services/sub-items-pricing';

interface VmOption { id: string; name: string; price: number; mediaUrl: string | null; imgFailed?: boolean; }

/** an option that comes with the item: the quantity can be lowered (down to 0), never raised above `maxQty` */
interface VmDefaultOption { id: string; name: string; price: number; maxQty: number; qty: number; mediaUrl: string | null; imgFailed?: boolean; }

interface VmGroup { id: string; title: string; min: number; max: number | null; options: VmOption[]; }

interface VmItem {
  key: string;
  id: string;
  name: string;
  price: number;
  qty: number;
  mediaUrl: string | null;
  imgFailed?: boolean;
  groups: VmGroup[];
  quickOptions: VmOption[];
  defaultOptions: VmDefaultOption[];
  selected: boolean;
  /** the options panel is folded */
  collapsed: boolean;
  /** option groups the user folded (or that folded themselves once the choice was finished) */
  closedGroups: Record<string, boolean>;
  /** option ids chosen per option group id */
  chosen: Record<string, string[]>;
  chosenQuick: string[];
}

interface VmLevel {
  levelName: string;
  /** how many items the user has to pick in the level; 0 = unlimited (any number, including none) */
  required: number;
  items: VmItem[];
}

export interface PickSubItemsData {
  productId: string;
  branchId: string;
  defaultPrice?: number;
  priceOverride?: number | null;
  /** a menu item has no sub items: only its own options are shown */
  ownOptions?: boolean;
  /** the sub items already picked on the line (when the line is edited) */
  previous?: any[];
}

/** what the popup returns, the caller turns it into invoice / estimate lines */
export interface PickSubItemsResult {
  /** the price of the product itself: it is the base the price model works from */
  defaultPrice: number;
  /** price typed over the calculated total (total price models) */
  priceOverride: number | null;
  priceModel: { model?: string; discount?: number } | null;
  subItems: Array<{
    productId: string;
    productName: string;
    qty: number;
    defaultPrice: number;
    options: Array<{ optionId: string; optionName: string; defaultPrice: number; qty: number }>;
  }>;
}

/**
 * Picks the sub items (and their options) of a package, menu selection or menu item product — port of
 * legacy `PickSubItemsComponent`. The items come from POST `accounts/getSubItems`.
 * Closes with a {@link PickSubItemsResult}, or `null` when dismissed.
 */
@Component({
  selector: 'app-pick-sub-items',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './pick-sub-items.component.html',
  styleUrl: './pick-sub-items.component.scss',
})
export class PickSubItemsComponent implements OnInit {
  private api = inject(ApiService);
  protected data = inject<PickSubItemsData>(MODAL_DATA);
  private ref = inject<ModalRef<PickSubItemsResult | null>>(MODAL_REF);

  loading = true;
  failed = false;
  productName = '';
  isMenuSelection = false;
  /** a menu item has no sub items: only its own options are shown */
  optionsOnly = false;
  levels: VmLevel[] = [];
  /** the price of the package / menu selection product, edited in the popup */
  basePrice = 0;
  /** the price typed over the calculated total (total price models) */
  customPrice: number | null = null;
  private definition: SubItemsDefinition | null = null;

  async ngOnInit(): Promise<void> {
    const params = this.data;
    this.customPrice = params.priceOverride ?? null;
    this.basePrice = params.defaultPrice ?? 0;
    try {
      const res = await this.api.request<any>(this.api.post('accounts/getSubItems', { productId: params.productId, branchId: params.branchId }));
      const rows: any[] = res?.data ?? [];
      if (params.ownOptions) {
        /** menu item: the backend returns its own options in a row without items */
        this.optionsOnly = true;
        this.definition = this.ownOptionsDefinition(rows.find(r => r.items == null) ?? null, params.productId);
      } else {
        this.definition = rows.find(r => r.items != null) ?? null;
      }
      this.build(params.previous ?? []);
      /** nothing to choose: the popup is not needed */
      if (this.optionsOnly && !this.levels[0]?.items.some(i => this.hasOptions(i))) {
        this.ref.close({ defaultPrice: 0, priceOverride: null, priceModel: null, subItems: [] });
        return;
      }
    } catch (e) {
      console.error(e);
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  /** the menu item row of getSubItems (productName, optionGroups, defaultOptions) as one item holding the options */
  private ownOptionsDefinition(row: any, productId: string): SubItemsDefinition | null {
    if (!row) return null;
    return {
      productName: row.productName,
      priceModel: null,
      items: [{ id: productId, name: row.productName, price: 0, qty: 1, mediaUrl: null, optionGroups: row.optionGroups ?? [], quickOptions: [], defaultOptions: row.defaultOptions ?? [] }],
    };
  }

  private build(previous: any[]): void {
    const def = this.definition;
    this.levels = [];
    if (!def) return;
    this.productName = def.productName;
    this.isMenuSelection = isMenuSelectionDefinition(def);

    const opt = (o: any): VmOption => ({ id: o.id, name: o.name, price: Number(o.price ?? 0), mediaUrl: o.mediaUrl ?? null });
    const toItem = (raw: any, key: string): VmItem => {
      const item: VmItem = {
        key,
        id: raw.id,
        name: raw.name,
        price: Number(raw.price ?? 0),
        qty: Number(raw.qty ?? 1),
        mediaUrl: raw.mediaUrl ?? null,
        groups: (raw.optionGroups ?? []).map((g: any) => ({
          id: g.id,
          title: g.title,
          min: Number(g.minSelectable ?? 0),
          max: g.maxSelectable == null ? null : Number(g.maxSelectable),
          options: (g.options ?? []).map(opt),
        })),
        quickOptions: (raw.quickOptions ?? []).map(opt),
        defaultOptions: (raw.defaultOptions ?? []).map((o: any) => {
          const maxQty = Number(o.qty ?? 1);
          return { id: o.optionId ?? o.id, name: o.name, price: Number(o.price ?? o.optionPrice ?? 0), maxQty, qty: maxQty, mediaUrl: o.mediaUrl ?? null };
        }),
        selected: false,
        collapsed: false,
        closedGroups: {},
        chosen: {},
        chosenQuick: [],
      };
      item.groups.forEach(g => (item.chosen[g.id] = []));

      /** restore what was picked before */
      const old = previous.find(p => p.productId === item.id);
      if (old) {
        item.selected = true;
        const oldIds: string[] = (old.options ?? []).map((o: any) => o.optionId);
        item.groups.forEach(g => (item.chosen[g.id] = g.options.filter(o => oldIds.includes(o.id)).map(o => o.id)));
        item.chosenQuick = item.quickOptions.filter(o => oldIds.includes(o.id)).map(o => o.id);
        item.defaultOptions.forEach(d => {
          const before = (old.options ?? []).find((o: any) => o.optionId === d.id);
          d.qty = before ? Math.min(Number(before.qty), d.maxQty) : 0;
        });
      }
      return item;
    };

    if (this.isMenuSelection) {
      this.levels = def.items.map((level: any, li: number) => {
        const items = (level.items ?? []).map((raw: any, ii: number) => toItem(raw, `${li}:${ii}`));
        const n = Number(level.noOfSelection ?? 1);
        return { levelName: level.levelName, required: n > 0 ? Math.min(n, items.length) : 0, items };
      });
    } else {
      /** a package holds every item, nothing to choose between them */
      const items = def.items.map((raw: any, ii: number) => {
        const item = toItem(raw, `0:${ii}`);
        item.selected = true;
        return item;
      });
      this.levels = [{ levelName: '', required: items.length, items }];
    }
  }

  /** the price of everything chosen on the item (options of the groups, quick options and default options x qty) */
  itemOptionsTotal(item: VmItem): number {
    let total = 0;
    item.groups.forEach(g =>
      g.options.filter(o => (item.chosen[g.id] ?? []).includes(o.id)).forEach(o => (total = MathUtils.add2(total, o.price))));
    item.quickOptions.filter(o => item.chosenQuick.includes(o.id)).forEach(o => (total = MathUtils.add2(total, o.price)));
    item.defaultOptions.forEach(d => (total = MathUtils.add2(total, MathUtils.multiply2(d.price, d.qty))));
    return MathUtils.roundDecimal(total);
  }

  /** menu item: the total of its options. package / menu selection: the price the line will have */
  get grandTotal(): number {
    if (!this.optionsOnly) return this.previewPrice;
    let total = 0;
    this.levels.forEach(level => level.items.filter(i => i.selected).forEach(i => (total = MathUtils.add2(total, this.itemOptionsTotal(i)))));
    return MathUtils.roundDecimal(total);
  }

  selectedCount(level: VmLevel): number { return level.items.filter(i => i.selected).length; }
  isUnlimited(level: VmLevel): boolean { return this.isMenuSelection && level.required === 0; }

  toggleItem(level: VmLevel, item: VmItem): void {
    if (!this.isMenuSelection) return;
    if (item.selected) { item.selected = false; return; }
    if (this.isUnlimited(level)) { item.selected = true; return; }
    if (level.required === 1) level.items.forEach(i => (i.selected = false));
    else if (this.selectedCount(level) >= level.required) return;
    item.selected = true;
  }

  hasOptions(item: VmItem): boolean { return item.groups.length > 0 || item.quickOptions.length > 0 || item.defaultOptions.length > 0; }
  /** a required option group of the item is still missing a choice */
  itemIncomplete(item: VmItem): boolean { return item.groups.some(g => !this.groupComplete(item, g)); }
  toggleCollapse(item: VmItem, event: Event): void { event.stopPropagation(); item.collapsed = !item.collapsed; }
  isChosen(item: VmItem, group: VmGroup, option: VmOption): boolean { return (item.chosen[group.id] ?? []).includes(option.id); }

  /** the group reached its max, only the options already chosen can still be clicked (to un-choose them) */
  isGroupFull(item: VmItem, group: VmGroup, option: VmOption): boolean {
    const list = item.chosen[group.id] ?? [];
    return group.max !== 1 && group.max != null && list.length >= group.max && !list.includes(option.id);
  }

  toggleOption(item: VmItem, group: VmGroup, option: VmOption): void {
    const list = item.chosen[group.id] ?? [];
    if (list.includes(option.id)) item.chosen[group.id] = list.filter(id => id !== option.id);
    else if (group.max === 1) item.chosen[group.id] = [option.id];
    else if (group.max == null || list.length < group.max) item.chosen[group.id] = [...list, option.id];
    /** the choice is finished when no other option can be added: the group closes */
    if (group.max != null && (item.chosen[group.id] ?? []).length >= group.max) item.closedGroups[group.id] = true;
  }

  toggleGroup(item: VmItem, group: VmGroup): void { item.closedGroups[group.id] = !item.closedGroups[group.id]; }

  chosenNames(item: VmItem, group: VmGroup): string {
    return group.options.filter(o => (item.chosen[group.id] ?? []).includes(o.id)).map(o => o.name).join(', ');
  }

  /** the quantity goes down to 1, the option is taken off with removeDefault() */
  decreaseDefault(o: VmDefaultOption): void { if (o.qty > 1) o.qty--; }
  removeDefault(o: VmDefaultOption): void { o.qty = 0; }
  increaseDefault(o: VmDefaultOption): void { if (o.qty < o.maxQty) o.qty++; }

  /** with a fixed price the options are part of the price, so their price is not shown */
  get showPrices(): boolean { return this.definition?.priceModel?.model !== 'fixedPrice'; }

  toggleQuick(item: VmItem, option: VmOption): void {
    item.chosenQuick = item.chosenQuick.includes(option.id) ? item.chosenQuick.filter(id => id !== option.id) : [...item.chosenQuick, option.id];
  }

  levelComplete(level: VmLevel): boolean { return this.isUnlimited(level) || this.selectedCount(level) === level.required; }
  groupComplete(item: VmItem, group: VmGroup): boolean { return (item.chosen[group.id] ?? []).length >= group.min; }

  /** with a fixed price model the price of the product is the price of the line, so it is typed here */
  get isFixedModel(): boolean {
    const model = this.definition?.priceModel?.model;
    return model === 'fixedPrice' || model === 'fixedPriceWOption';
  }

  /** what the price box shows: the typed price, else the calculated one */
  get priceValue(): number { return this.isFixedModel ? this.basePrice : (this.customPrice ?? this.previewPrice); }

  onPriceChange(value: any): void {
    if (this.isFixedModel) this.basePrice = value;
    else this.customPrice = value === '' || value == null ? null : Number(value);
  }

  /** the calculated price is different from the one shown, it is offered back to the user */
  get priceDiffers(): boolean {
    return this.previewPrice !== (this.isFixedModel ? this.normalizedBasePrice : this.customPrice ?? this.previewPrice);
  }

  resetPrice(): void { this.customPrice = null; }

  /** the price the line will have with the current choices, from the same calculation the lines use */
  get previewPrice(): number {
    const parent = {
      price: 0,
      defaultPrice: this.normalizedBasePrice,
      priceModel: this.definition?.priceModel ?? null,
      priceOverride: null,
      subItems: this.currentSubItems().map(item => ({
        price: 0,
        defaultPrice: item.defaultPrice,
        options: item.options.map(o => ({ price: 0, defaultPrice: o.defaultPrice })),
      })),
    };
    applySubItemsPricing(parent);
    return parent.price;
  }

  private get normalizedBasePrice(): number {
    const value = Number(this.basePrice);
    return Number.isFinite(value) && value > 0 ? MathUtils.roundDecimal(value) : 0;
  }

  get canConfirm(): boolean {
    if (!this.definition || this.loading) return false;
    return this.levels.every(level => this.levelComplete(level) && level.items.filter(i => i.selected).every(i => i.groups.every(g => this.groupComplete(i, g))));
  }

  confirm(): void {
    if (!this.canConfirm) return;
    this.ref.close({
      defaultPrice: this.normalizedBasePrice,
      priceModel: this.definition!.priceModel,
      priceOverride: !this.isFixedModel && this.customPrice != null ? MathUtils.roundDecimal(Math.max(0, this.customPrice)) : null,
      subItems: this.currentSubItems(),
    });
  }

  private currentSubItems(): PickSubItemsResult['subItems'] {
    const subItems: PickSubItemsResult['subItems'] = [];
    this.levels.forEach(level =>
      level.items.filter(i => i.selected).forEach(item => {
        const options: PickSubItemsResult['subItems'][0]['options'] = [];
        const add = (o: VmOption) => options.push({ optionId: o.id, optionName: o.name, defaultPrice: o.price, qty: 1 });
        item.groups.forEach(g => g.options.filter(o => (item.chosen[g.id] ?? []).includes(o.id)).forEach(add));
        item.quickOptions.filter(o => item.chosenQuick.includes(o.id)).forEach(add);
        item.defaultOptions.filter(d => d.qty > 0).forEach(d => options.push({ optionId: d.id, optionName: d.name, defaultPrice: d.price, qty: d.qty }));
        subItems.push({ productId: item.id, productName: item.name, qty: item.qty, defaultPrice: item.price, options });
      }));
    return subItems;
  }

  cancel(): void { this.ref.close(null); }
}
