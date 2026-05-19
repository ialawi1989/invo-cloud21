import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
} from '@angular/cdk/drag-drop';

import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { PrintElement } from '../../../../services/receipt-builder.types';

/**
 * ElementsListComponent
 * ─────────────────────
 * Layers panel for the receipt builder. Lists every element on the
 * canvas as a compact row with: drag handle, type label, brief
 * summary of the element's content, and delete/duplicate buttons.
 *
 * Behaviour:
 *   - Click a row to select the element on the canvas (drives the
 *     same `selectedKey` signal the canvas slot uses).
 *   - Drag a row to reorder — emits a `CdkDragDrop` event the parent
 *     funnels through its existing reorder path so undo / redo /
 *     dirty-checking keeps working unchanged.
 *   - Delete / duplicate fire the parent's existing handlers so the
 *     buttons mirror the canvas slot chrome 1:1.
 *
 * Owned by the form's left rail (below the palette) — same width as
 * the palette so the rail reads as one column.
 */
@Component({
  selector: 'app-elements-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    TooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './elements-list.component.html',
  styleUrl: './elements-list.component.scss',
})
export class ElementsListComponent {
  elements    = input<PrintElement[]>([]);
  selectedKey = input<string>('');

  @Output() select    = new EventEmitter<PrintElement>();
  @Output() remove    = new EventEmitter<PrintElement>();
  @Output() duplicate = new EventEmitter<PrintElement>();
  @Output() reorder   = new EventEmitter<CdkDragDrop<PrintElement[]>>();

  /** Quick visual summary of an element — what it is + a snippet of
   *  its content. Used as the row label. Long values are truncated
   *  in CSS via ellipsis so multi-line text doesn't break the rail. */
  summary(el: PrintElement): string {
    switch (el.type) {
      case 'Text':     return el.value || '—';
      case 'SideText': return [el.leftText, el.rightText].filter(Boolean).join('  ⋮  ') || '—';
      case 'Line':     return '';
      case 'Spacer':   return `${el.height}px`;
      case 'Logo':     return '';
      case 'Image':    return el.path || el.data || '';
      case 'QrCode':   return el.value || '—';
      case 'Barcode':  return el.value || '—';
      case 'Table':    return this.tableSourceLabel(el.source);
      default:         return '';
    }
  }

  private tableSourceLabel(source: string | undefined): string {
    switch (source) {
      case '!invoice.lines':    return 'Lines';
      case '!invoice.taxes':    return 'Taxes';
      case '!invoice.payments': return 'Payments';
      default:                  return source ?? '';
    }
  }

  /** Element type → palette icon id. Logo + Image share a glyph
   *  because the legacy palette did the same. Table flavours all
   *  fall back to the generic grid icon — the row's source label
   *  carries the disambiguation. */
  iconId(el: PrintElement): string {
    if (el.type === 'Table') return 'Table';
    return el.type;
  }

  isSelected = (key: string | undefined): boolean => !!key && key === this.selectedKey();

  trackEl = (_: number, e: PrintElement) => e.__key ?? _;

  onDrop(event: CdkDragDrop<PrintElement[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.reorder.emit(event);
  }

  /** Stable empty list flag — drives the empty-state hint. */
  isEmpty = computed<boolean>(() => this.elements().length === 0);
}
