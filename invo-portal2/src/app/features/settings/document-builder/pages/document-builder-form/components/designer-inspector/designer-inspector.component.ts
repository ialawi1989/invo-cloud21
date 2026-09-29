import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';

import { DesignerElement } from '../../../../services/document-template.types';

/**
 * DesignerInspectorComponent
 * ──────────────────────────
 * Right-rail property inspector for the currently-selected designer
 * element. Handles every type in the palette by branching off
 * `selected().type` and surfacing only the relevant fields.
 *
 * The inspector is "dumb" — it never mutates the input. Every edit
 * fires through `(elementChange)` so the parent funnels updates
 * through its central patch path (keeps `isDirty` + signal change
 * detection deterministic).
 *
 * The four arrange buttons (send-to-back / send-back / bring-forward
 * / bring-to-front) work via the `(arrange)` event so the parent can
 * splice the elements array.
 */
@Component({
  selector: 'app-designer-inspector',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColorPickerComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './designer-inspector.component.html',
  styleUrl: './designer-inspector.component.scss',
})
export class DesignerInspectorComponent {
  selected = input<DesignerElement | null>(null);
  /** Z-order index — populated by the parent so the inspector can
   *  show "1 / N" without holding a reference to the full list. */
  zIndex   = input<number>(0);
  total    = input<number>(0);

  @Output() elementChange = new EventEmitter<DesignerElement>();
  @Output() arrange       = new EventEmitter<'back' | 'backward' | 'forward' | 'front'>();
  @Output() duplicate     = new EventEmitter<void>();
  @Output() delete        = new EventEmitter<void>();
  @Output() toggleHidden  = new EventEmitter<void>();
  @Output() toggleLocked  = new EventEmitter<void>();

  /** Composite signal — convenient for `@if (el; as e)` in template. */
  el = computed<DesignerElement | null>(() => this.selected());

  patch(patch: Partial<DesignerElement>): void {
    const cur = this.selected();
    if (!cur) return;
    this.elementChange.emit({ ...cur, ...patch });
  }

  // ─── Type accessors so the template doesn't need typeguards
  isText      = computed<boolean>(() => this.selected()?.type === 'Text');
  isDataField = computed<boolean>(() => this.selected()?.type === 'Data Field');
  isShape     = computed<boolean>(() => this.selected()?.type === 'Shape');
  isImage     = computed<boolean>(() => this.selected()?.type === 'Image');
  isTable     = computed<boolean>(() => this.selected()?.type === 'Table');
  isBarcode   = computed<boolean>(() => this.selected()?.type === 'Barcode');
  isQR        = computed<boolean>(() => this.selected()?.type === 'QR Code');
  isSig       = computed<boolean>(() => this.selected()?.type === 'Signature');
  isPageNum   = computed<boolean>(() => this.selected()?.type === 'Page #');
  isRichText    = computed<boolean>(() => this.selected()?.type === 'Rich Text');
  isGroupHeader = computed<boolean>(() => this.selected()?.type === 'Group Header');
  isGroupFooter = computed<boolean>(() => this.selected()?.type === 'Group Footer');
  isPayments    = computed<boolean>(() => this.selected()?.type === 'Payments');
  isRepeater    = computed<boolean>(() => this.selected()?.type === 'Repeater');

  /** Leaf types a repeater card may contain — matches legacy's `REPEATER_CHILD_KINDS` restriction
   *  (no nested tables/repeaters/payments). */
  readonly repeaterChildKinds = ['Text', 'Data Field', 'Image', 'Shape', 'Barcode', 'QR Code', 'Signature'] as const;

  /** Which repeater child is open for inline editing (id, or null for none). */
  selectedChildId = signal<DesignerElement['id'] | null>(null);
  selectedChild = computed<DesignerElement | null>(() => {
    const id = this.selectedChildId();
    if (id == null) return null;
    return (this.selected()?.repeaterItems ?? []).find(c => c.id === id) ?? null;
  });

  addRepeaterChild(type: string): void {
    const cur = this.selected();
    if (!cur) return;
    const items = cur.repeaterItems ?? [];
    const child: DesignerElement = {
      id: Date.now(), type, x: 4, y: 4, w: 140, h: 20, color: '#1f2937', size: 10,
      content: type === 'Text' ? 'Text' : '', ...(type === 'Data Field' ? { path: 'productName' } : {}),
    };
    this.patch({ repeaterItems: [...items, child] });
    this.selectedChildId.set(child.id);
  }
  patchRepeaterChild(id: DesignerElement['id'], childPatch: Partial<DesignerElement>): void {
    const cur = this.selected();
    if (!cur) return;
    this.patch({ repeaterItems: (cur.repeaterItems ?? []).map(c => c.id === id ? { ...c, ...childPatch } : c) });
  }
  removeRepeaterChild(id: DesignerElement['id']): void {
    const cur = this.selected();
    if (!cur) return;
    this.patch({ repeaterItems: (cur.repeaterItems ?? []).filter(c => c.id !== id) });
    if (this.selectedChildId() === id) this.selectedChildId.set(null);
  }

  readonly paymentsColumnOptions = ['method', 'reference', 'date', 'amount', 'status', 'rate'] as const;
  togglePaymentsColumn(col: string): void {
    const cur = this.selected();
    if (!cur) return;
    const list: string[] = Array.isArray(cur.paymentsColumns) ? cur.paymentsColumns as string[] : ['method', 'reference', 'date', 'amount'];
    const next = list.includes(col) ? list.filter(c => c !== col) : [...list, col];
    this.patch({ paymentsColumns: next as any });
  }

  /** Round so transform inputs read clean integers. */
  asInt(v: number | undefined | null): number {
    return Math.round(Number(v) || 0);
  }
}
