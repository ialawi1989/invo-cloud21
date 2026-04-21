import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MODAL_DATA, MODAL_REF } from '../../../modal/modal.tokens';
import { ModalRef } from '../../../modal/modal.service';
import { TableColumn } from '../interfaces/list-page.types';

export interface CustomizeColumnsData {
  columns: TableColumn[];
}

interface DisplayColumn extends TableColumn {
  groupedItems?: TableColumn[];
  isGroup?: boolean;
  isExpanded?: boolean;
  subFieldsExpanded?: boolean;
}

@Component({
  selector: 'app-customize-columns-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, TranslateModule],
  template: `
    <!-- Header -->
    <div class="px-6 pt-6 pb-4">
      <h2 class="text-xl font-semibold text-slate-900">{{ 'COMMON.MANAGE_FIELDS' | translate }}</h2>
      <p class="text-sm text-slate-500 mt-1 leading-5">{{ 'COMMON.MANAGE_FIELDS_SUBTITLE' | translate }}</p>
    </div>

    <!-- Body -->
    <div class="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
      <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="flex flex-col divide-y divide-slate-100">
        @for (item of displayColumns(); track item.key) {
          <!-- Row wrapper. Locked rows are not draggable — they stay at the
               top so sticky-column positioning in the table holds. -->
          <div cdkDrag
            [cdkDragDisabled]="!!item.locked"
            [class.bg-slate-50/70]="item.isGroup && item.isExpanded">

            <!-- Main row -->
            <div class="group/row flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-slate-50/80 transition-colors">

              <!-- Drag handle — hidden for locked rows since drag is disabled. -->
              <div cdkDragHandle
                class="flex-shrink-0 text-slate-300 transition-colors"
                [class.cursor-grab]="!item.locked"
                [class.active:cursor-grabbing]="!item.locked"
                [class.hover:text-slate-500]="!item.locked"
                [class.opacity-30]="item.locked"
                [class.cursor-not-allowed]="item.locked">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2.5" cy="3"  r="1.1"/><circle cx="7.5" cy="3"  r="1.1"/>
                  <circle cx="2.5" cy="8"  r="1.1"/><circle cx="7.5" cy="8"  r="1.1"/>
                  <circle cx="2.5" cy="13" r="1.1"/><circle cx="7.5" cy="13" r="1.1"/>
                </svg>
              </div>

              <!-- Visibility checkbox -->
              <button type="button" (click)="toggleVisibility(item); $event.stopPropagation()"
                class="flex-shrink-0 w-[20px] h-[20px] rounded-[6px] flex items-center justify-center transition-all"
                [disabled]="!!item.locked"
                [class]="item.locked
                  ? 'bg-brand-100 text-brand-400'
                  : item.visible
                    ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                    : 'border-[1.5px] border-slate-300 bg-white text-transparent hover:border-brand-500 hover:bg-brand-50'">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>

              <!-- Column name -->
              <span class="flex-1 text-[14px] truncate"
                [class.text-slate-800]="item.visible || item.locked"
                [class.text-slate-400]="!item.visible && !item.locked">
                {{ item.label }}
              </span>

              <!-- Tags -->
              @if (item.isCustomField) {
                <span class="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 flex-shrink-0">
                  {{ 'COMMON.CUSTOM' | translate }}
                </span>
              }
              @if (isPrimary(item)) {
                <span class="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-brand-100 text-brand-700 flex-shrink-0">
                  {{ 'COMMON.PRIMARY' | translate }}
                </span>
              }

              <!-- Group badge + expand button -->
              @if (item.isGroup && item.groupedItems) {
                <span class="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium flex-shrink-0"
                  [class]="item.visible ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'">
                  {{ getGroupVisibleCount(item) }}/{{ item.groupedItems.length }}
                </span>
                <button type="button" (click)="item.isExpanded = !item.isExpanded; $event.stopPropagation()"
                  class="p-0.5 rounded text-slate-400 hover:text-slate-600 flex-shrink-0 transition-colors">
                  <svg class="w-4 h-4 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                    [class.rotate-180]="item.isExpanded">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              }

              <!-- Lock icon (right side) -->
              @if (item.locked) {
                <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              }

              <!-- SubFields expand -->
              @if (!item.isGroup && item.subFields?.length) {
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0"
                  [class]="item.visible ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'">
                  {{ getSubFieldVisibleCount(item) }}/{{ item.subFields!.length }} visible
                </span>
                <button type="button" (click)="item.subFieldsExpanded = !item.subFieldsExpanded; $event.stopPropagation()"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0 transition-colors">
                  <svg class="w-4 h-4 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                    [class.rotate-180]="item.subFieldsExpanded">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              }
            </div>

            <!-- Grouped children (flat list, reorderable, per-item layout toggle) -->
            @if (item.isGroup && item.isExpanded && item.groupedItems) {
              <div class="bg-slate-50/60 border-t border-slate-100"
                cdkDropList
                [cdkDropListData]="item.groupedItems"
                (cdkDropListDropped)="onChildDrop(item, $event)">
                @for (child of item.groupedItems; track child.key; let first = $first) {
                  <!-- Locked children cannot be dragged. -->
                  <div cdkDrag
                    [cdkDragDisabled]="!!child.locked"
                    class="group/child flex items-center gap-3 px-2 py-2 ps-14 hover:bg-slate-100/60 transition-colors"
                    [class.opacity-60]="!child.visible && !child.locked">
                    <!-- Drag handle — dimmed for locked children. -->
                    <div cdkDragHandle
                      class="flex-shrink-0 text-slate-300 transition-colors"
                      [class.cursor-grab]="!child.locked"
                      [class.active:cursor-grabbing]="!child.locked"
                      [class.hover:text-slate-500]="!child.locked"
                      [class.opacity-30]="child.locked"
                      [class.cursor-not-allowed]="child.locked">
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2.5" cy="3"  r="1.1"/><circle cx="7.5" cy="3"  r="1.1"/>
                        <circle cx="2.5" cy="8"  r="1.1"/><circle cx="7.5" cy="8"  r="1.1"/>
                        <circle cx="2.5" cy="13" r="1.1"/><circle cx="7.5" cy="13" r="1.1"/>
                      </svg>
                    </div>
                    <!-- Visibility checkbox -->
                    <button type="button" (click)="toggleChildVisibility(item, child)"
                      class="flex-shrink-0 w-[18px] h-[18px] rounded-[5px] flex items-center justify-center transition-colors"
                      [disabled]="!!child.locked"
                      [class]="child.locked
                        ? 'bg-brand-100 text-brand-400'
                        : child.visible
                          ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                          : 'border-[1.5px] border-slate-300 bg-white text-transparent hover:border-brand-500 hover:bg-brand-50'">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                    <!-- Label -->
                    <span class="flex-1 text-[13px] truncate"
                      [class.text-slate-700]="child.visible || child.locked"
                      [class.text-slate-400]="!child.visible && !child.locked">
                      {{ child.headerLabel || child.key }}
                    </span>
                    <!-- Primary tag for primary children -->
                    @if (child.primary) {
                      <span class="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-brand-100 text-brand-700 flex-shrink-0">
                        {{ 'COMMON.PRIMARY' | translate }}
                      </span>
                    }
                    <!-- Display-style toggle — only for 2nd+ items -->
                    @if (!first) {
                      <button type="button" (click)="toggleChildStyle(child); $event.stopPropagation()"
                        class="flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded border transition-colors"
                        [class]="child.displayStyle === 'inline'
                          ? 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'"
                        [title]="child.displayStyle === 'inline' ? ('COMMON.INLINE' | translate) : ('COMMON.NEW_LINE' | translate)">
                        {{ child.displayStyle === 'inline' ? ('COMMON.INLINE' | translate) : ('COMMON.NEW_LINE' | translate) }}
                      </button>
                    }
                    <!-- Lock icon (right) -->
                    @if (child.locked) {
                      <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                    }
                  </div>
                }
              </div>
            }

            <!-- SubFields (inside card) -->
            @if (!item.isGroup && item.subFieldsExpanded && item.subFields?.length) {
              <div class="border-t border-slate-100 bg-slate-50/50">
                @for (sf of item.subFields!; track sf.key) {
                  <div class="flex items-center gap-3 px-4 py-2.5 ps-12"
                    [class.opacity-50]="sf.visible === false">
                    <button type="button" (click)="toggleSubField(sf)"
                      class="flex-shrink-0 transition-colors">
                      @if (sf.visible !== false) {
                        <svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      } @else {
                        <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18"/>
                        </svg>
                      }
                    </button>
                    <span class="text-sm text-slate-600 truncate">{{ sf.label || sf.key }}</span>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- Footer — full-width action row, solid teal Apply to match reference -->
    <div class="px-5 py-4 border-t border-slate-100 bg-white flex items-center gap-3">
      <button type="button" (click)="onCancel()"
        class="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" (click)="onApply()"
        class="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors">
        {{ 'COMMON.APPLY' | translate }}
      </button>
    </div>

    <!-- CDK drag styles -->
    <style>
      :host {
        display: flex;
        flex-direction: column;
        /* Fill the drawer panel on both axes so the footer sits at the bottom.
           flex: 1 1 auto is required because the parent .drawer-panel is a
           flex-col — height: 100% alone does not stretch a flex item along
           the main axis. */
        flex: 1 1 auto;
        height: 100%;
        min-height: 0;
      }
      .cdk-drag-preview {
        background: white;
        border: 1px solid #e2e8f0; border-radius: 10px;
        box-shadow: 0 12px 32px rgba(0,0,0,.15);
        overflow: visible;
      }
      .cdk-drag-placeholder {
        background: #f1f5f9; border: 2px dashed #cbd5e1;
        border-radius: 10px; min-height: 44px; opacity: .5;
        overflow: hidden;
      }
      .cdk-drag-animating { transition: transform 200ms ease; }
      .cdk-drop-list-dragging .cdk-drag { transition: transform 200ms ease; }
    </style>
  `
})
export class CustomizeColumnsModalComponent {
  private modalRef = inject(MODAL_REF) as ModalRef<TableColumn[]>;
  private modalData = inject(MODAL_DATA) as CustomizeColumnsData;

  displayColumns = signal<DisplayColumn[]>([]);

  ngOnInit(): void {
    this.buildDisplayColumns(this.modalData.columns);
  }

  private buildDisplayColumns(columns: TableColumn[]): void {
    const cols = columns.map(c => ({ ...c }));
    const labelMap = new Map<string, TableColumn[]>();

    cols.forEach(col => {
      const existing = labelMap.get(col.label);
      if (existing) {
        existing.push(col);
      } else {
        labelMap.set(col.label, [col]);
      }
    });

    const display: DisplayColumn[] = [];
    labelMap.forEach((items, label) => {
      if (items.length > 1) {
        display.push({
          key: items.map(i => i.key).join('_'),
          label,
          // A group is treated as locked if *any* member is locked: you can't
          // fully hide the group (the locked member would stay visible), so
          // the group-level visibility toggle is meaningless — we surface the
          // lock icon instead and let per-child toggles handle the rest.
          locked: items.some(i => i.locked),
          visible: items.some(i => i.visible),
          order: items[0].order ?? 0,
          isGroup: true,
          isExpanded: false,
          groupedItems: items
        } as DisplayColumn);
      } else {
        display.push({
          ...items[0],
          subFieldsExpanded: false
        } as DisplayColumn);
      }
    });

    display.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this.displayColumns.set(display);
  }

  onDrop(event: CdkDragDrop<any>): void {
    const cols = [...this.displayColumns()];
    // Locked items (e.g. sticky primary column) must not move, and other
    // items cannot displace them by landing on their slot.
    if (cols[event.previousIndex]?.locked) return;
    if (cols[event.currentIndex]?.locked)  return;
    moveItemInArray(cols, event.previousIndex, event.currentIndex);
    cols.forEach((col, i) => col.order = i);
    this.displayColumns.set([...cols]);
  }

  /** Reorder items within an expanded group. */
  onChildDrop(parent: DisplayColumn, event: CdkDragDrop<any>): void {
    if (!parent.groupedItems) return;
    const items = parent.groupedItems;
    if (items[event.previousIndex]?.locked) return;
    if (items[event.currentIndex]?.locked)  return;
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.displayColumns.set([...this.displayColumns()]);
  }

  /** Toggle a grouped child's layout between 'newLine' and 'inline'. */
  toggleChildStyle(child: TableColumn): void {
    child.displayStyle = child.displayStyle === 'inline' ? 'newLine' : 'inline';
    this.displayColumns.set([...this.displayColumns()]);
  }

  toggleVisibility(item: DisplayColumn): void {
    if (item.locked) return;
    item.visible = !item.visible;
    if (item.isGroup && item.groupedItems) {
      item.groupedItems.forEach(g => g.visible = item.visible);
    }
  }

  toggleChildVisibility(parent: DisplayColumn, child: TableColumn): void {
    if (child.locked) return;
    child.visible = !child.visible;
    if (parent.groupedItems) {
      parent.visible = parent.groupedItems.some(g => g.visible);
    }
  }

  toggleSubField(sf: any): void {
    sf.visible = sf.visible === false ? true : false;
  }

  getGroupVisibleCount(item: DisplayColumn): number {
    return item.groupedItems?.filter(g => g.visible).length ?? 0;
  }

  /** True if the row itself is primary OR any grouped sibling is primary. */
  isPrimary(item: DisplayColumn): boolean {
    if (item.primary) return true;
    return !!item.groupedItems?.some(g => g.primary);
  }

  getSubFieldVisibleCount(item: DisplayColumn): number {
    return item.subFields?.filter((sf: any) => sf.visible !== false).length ?? 0;
  }

  onCancel(): void {
    this.modalRef.dismiss();
  }

  onApply(): void {
    const result: TableColumn[] = [];
    this.displayColumns().forEach(dc => {
      if (dc.isGroup && dc.groupedItems) {
        // Use a fractional offset per item so the list-page's stable
        // `displayColumns` sort keeps the order the user arranged here.
        dc.groupedItems.forEach((g, idx) => {
          result.push({ ...g, order: (dc.order ?? 0) + idx * 0.001 });
        });
      } else {
        const { isGroup, groupedItems, isExpanded, subFieldsExpanded, ...col } = dc;
        result.push(col as TableColumn);
      }
    });
    result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this.modalRef.close(result);
  }
}
