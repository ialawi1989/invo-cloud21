import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import { ModalService } from '../../modal/modal.service';
import { SearchDropdownComponent } from '../dropdown/search-dropdown.component';
import {
  FaqTemplateItem,
  PRODUCT_TYPES,
  ProductType,
  SpecField,
  SpecFieldType,
  TabTemplate,
  TabType,
  VehicleConfig,
  newFaqTemplateItem,
  newSpecField,
  newTabTemplate,
  productTypeI18nKey,
  slugify,
} from './tab-builder.types';
import { AddTabModalComponent, AddTabResult } from './add-tab-modal.component';
import { TabTypeIconComponent } from './tab-type-icon.component';

/**
 * Tab-template builder (Settings → Tab Builder).
 *
 * Two-column layout (matches the React reference):
 *   - Left:  list of tab templates (drag-reorderable, add/delete).
 *   - Right: editor for the selected template. The body swaps based on
 *            `template.type` — specs / vehicle / faq / richtext+custom /
 *            table (no config).
 *
 * The component is purely for editing *schema*, not values. A separate
 * `TabDataEditorComponent` renders the same templates on a product.
 */
@Component({
  selector: 'app-tab-template-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DragDropModule, SearchDropdownComponent, TabTypeIconComponent],
  templateUrl: './tab-template-builder.component.html',
  styleUrl: './tab-template-builder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabTemplateBuilderComponent {
  private modal     = inject(ModalService);
  private translate = inject(TranslateService);

  templates = input<TabTemplate[]>([]);
  templatesChange = output<TabTemplate[]>();

  selectedId = signal<string>('');

  readonly SPEC_FIELD_TYPE_VALUES: SpecFieldType[] = ['text', 'number', 'select', 'multiselect'];
  displaySpecType = (t: SpecFieldType) =>
    this.translate.instant(`TAB_BUILDER.SPEC_TYPES.${t.toUpperCase()}`);

  readonly PRODUCT_TYPE_VALUES = PRODUCT_TYPES;
  productTypeLabel = (t: ProductType) => this.translate.instant(productTypeI18nKey(t));

  /** Selected value for the multi-select dropdown. Empty array = "All". */
  selectedProductTypes(tpl: TabTemplate): ProductType[] {
    return tpl.productTypes ?? [];
  }

  onProductTypesChange(next: ProductType[] | ProductType | null): void {
    const arr = Array.isArray(next) ? next : next ? [next] : [];
    // Empty list is equivalent to "all types" — persist as undefined so the
    // stored JSON stays minimal and the semantic is explicit.
    this.updateSelected({ productTypes: arr.length ? arr : undefined });
  }

  selectedTemplate = computed<TabTemplate | null>(() => {
    const list = this.templates();
    if (list.length === 0) return null;
    const id = this.selectedId();
    return list.find(t => t.id === id) ?? list[0];
  });

  // ─── Templates (left column) ────────────────────────────────────────────

  async openAdd(): Promise<void> {
    const existing = this.templates().map(t => t.abbr);
    const ref = this.modal.open<AddTabModalComponent, any, AddTabResult>(
      AddTabModalComponent,
      { size: 'sm', data: { existingAbbrs: existing } },
    );
    const res = await ref.afterClosed();
    if (!res) return;
    const tpl = newTabTemplate(res.name, res.type, this.templates().length);
    this.commit([...this.templates(), tpl]);
    this.selectedId.set(tpl.id);
  }

  select(id: string): void {
    this.selectedId.set(id);
  }

  deleteTemplate(id: string, ev?: Event): void {
    ev?.stopPropagation();
    const tpl = this.templates().find(t => t.id === id);
    if (!tpl) return;
    if (!confirm(`Delete "${tpl.name}"?`)) return;
    const next = this.templates().filter(t => t.id !== id);
    this.commit(next);
    if (this.selectedId() === id) {
      this.selectedId.set(next[0]?.id ?? '');
    }
  }

  onDrop(ev: CdkDragDrop<TabTemplate[]>): void {
    if (ev.previousIndex === ev.currentIndex) return;
    const list = [...this.templates()];
    moveItemInArray(list, ev.previousIndex, ev.currentIndex);
    this.commit(list.map((t, i) => ({ ...t, sortOrder: i })));
  }

  // ─── Template field mutators (right column) ─────────────────────────────

  updateSelected(patch: Partial<TabTemplate>): void {
    const sel = this.selectedTemplate();
    if (!sel) return;
    const next = this.templates().map(t => t.id === sel.id ? { ...t, ...patch } : t);
    this.commit(next);
  }

  updateName(name: string): void {
    this.updateSelected({ name, abbr: slugify(name) });
  }

  toggleActive(isActive: boolean): void {
    this.updateSelected({ isActive });
  }

  // ── Specs ──────────────────────────────────────────────────────────────
  addSpecField(): void {
    const sel = this.selectedTemplate();
    if (!sel) return;
    const fields = [...(sel.specFields ?? []), newSpecField()];
    this.updateSelected({ specFields: fields });
  }

  updateSpecField(index: number, patch: Partial<SpecField>): void {
    const sel = this.selectedTemplate();
    if (!sel?.specFields) return;
    const fields = sel.specFields.map((f, i) => {
      if (i !== index) return f;
      const next = { ...f, ...patch };
      if (patch.label !== undefined) next.abbr = slugify(patch.label);
      if (next.type !== 'select' && next.type !== 'multiselect') next.options = [];
      return next;
    });
    this.updateSelected({ specFields: fields });
  }

  updateSpecOptions(index: number, commaSeparated: string): void {
    const options = commaSeparated.split(',').map(s => s.trim()).filter(Boolean);
    this.updateSpecField(index, { options });
  }

  deleteSpecField(index: number): void {
    const sel = this.selectedTemplate();
    if (!sel?.specFields) return;
    this.updateSelected({ specFields: sel.specFields.filter((_, i) => i !== index) });
  }

  // ── Vehicle ────────────────────────────────────────────────────────────
  updateVehicleConfig(patch: Partial<VehicleConfig>): void {
    const sel = this.selectedTemplate();
    if (!sel) return;
    const cur = sel.vehicleConfig ?? { allowUniversal: true, allowYearRange: true, requireEngine: false };
    this.updateSelected({ vehicleConfig: { ...cur, ...patch } });
  }

  // ── FAQ ────────────────────────────────────────────────────────────────
  addFaqField(): void {
    const sel = this.selectedTemplate();
    if (!sel) return;
    this.updateSelected({ faqFields: [...(sel.faqFields ?? []), newFaqTemplateItem()] });
  }

  updateFaqField(index: number, patch: Partial<FaqTemplateItem>): void {
    const sel = this.selectedTemplate();
    if (!sel?.faqFields) return;
    this.updateSelected({
      faqFields: sel.faqFields.map((f, i) => i === index ? { ...f, ...patch } : f),
    });
  }

  deleteFaqField(index: number): void {
    const sel = this.selectedTemplate();
    if (!sel?.faqFields) return;
    this.updateSelected({ faqFields: sel.faqFields.filter((_, i) => i !== index) });
  }

  // ── Richtext / Custom ──────────────────────────────────────────────────
  updatePlaceholder(value: string): void {
    this.updateSelected({ placeholder: value });
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  typeKey(t: TabType): string {
    return `TAB_BUILDER.TYPES.${t.toUpperCase()}`;
  }

  private commit(next: TabTemplate[]): void {
    this.templatesChange.emit(next);
  }
}
