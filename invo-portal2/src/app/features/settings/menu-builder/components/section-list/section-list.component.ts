import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { RowMenuComponent, type RowMenuItem } from '../row-menu/row-menu.component';

export interface SectionRow {
  id: string;
  name: string;
  /** Colour dot: the section's gradient. */
  colorStart: string;
  colorEnd: string;
  productsCount: number;
}

export type SectionAction = 'rename' | 'color' | 'duplicate' | 'delete';

/**
 * The left column: the sections as a vertical list. Drag the handle (or Alt + Arrow Up / Down) to reorder; the new order is what is saved.
 * The selected row has an accent background AND a 3px bar. Presentational: it reports what was asked, it changes nothing.
 */
@Component({
  selector: 'app-section-list',
  standalone: true,
  imports: [TranslateModule, CdkDropList, CdkDrag, CdkDragHandle, RowMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section-list.component.html',
  styleUrl: './section-list.component.scss',
})
export class SectionListComponent {
  sections = input<SectionRow[]>([]);
  selectedId = input<string | null>(null);
  /** Section-name errors by section id (e.g. "DUPLICATE_NAME"). */
  errors = input<Record<string, string>>({});
  emptyCount = input(0);

  select = output<string>();
  add = output<void>();
  reorder = output<{ from: number; to: number }>();
  action = output<{ id: string; action: SectionAction }>();

  constructor(private translate: TranslateService) {}

  menuItems(): RowMenuItem[] {
    const t = (k: string) => this.translate.instant(k);
    return [
      { id: 'rename', label: t('MENU_BUILDER.SECTION.RENAME') },
      { id: 'color', label: t('MENU_BUILDER.SECTION.CHANGE_COLOR') },
      { id: 'duplicate', label: t('MENU_BUILDER.SECTION.DUPLICATE') },
      { id: 'delete', label: t('COMMON.DELETE'), danger: true, separator: true },
    ];
  }

  menuLabel(s: SectionRow): string { return this.translate.instant('MENU_BUILDER.SECTION.ACTIONS_FOR', { name: s.name }); }
  handleLabel(s: SectionRow): string { return this.translate.instant('MENU_BUILDER.SECTION.DRAG_HANDLE', { name: s.name }); }

  drop(e: CdkDragDrop<unknown>): void {
    if (e.previousIndex !== e.currentIndex) this.reorder.emit({ from: e.previousIndex, to: e.currentIndex });
  }

  /** Alt + Arrow Up / Down on a row moves it (the keyboard alternative to dragging). */
  onRowKey(e: KeyboardEvent, index: number): void {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const to = index + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= this.sections().length) return;
    e.preventDefault();
    this.reorder.emit({ from: index, to });
    // The row is re-rendered at its new place: keep the focus on it.
    const id = this.sections()[index].id;
    const list = (e.currentTarget as HTMLElement).closest('ul');
    queueMicrotask(() => setTimeout(() => Array.from(list?.querySelectorAll<HTMLElement>('[data-section-id]') ?? []).find((el) => el.dataset['sectionId'] === id)?.querySelector<HTMLElement>('.sl__main')?.focus()));
  }

  onPick(id: string, a: string): void { this.action.emit({ id, action: a as SectionAction }); }
}
