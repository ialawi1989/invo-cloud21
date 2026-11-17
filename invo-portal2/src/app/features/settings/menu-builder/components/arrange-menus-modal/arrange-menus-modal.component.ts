import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { MenuBuilderService } from '../../services/menu-builder.service';

interface Row { id: string; name: string; startAt: string; endAt: string }

/**
 * "Menu priority": every menu in order, first = highest priority. Drag a row (or Alt + Arrow Up / Down on its handle) and Save.
 * It writes each menu's `index` through `product/rearrangeMenu` (the legacy "Arrange"). Closes with `true` when saved.
 */
@Component({
  selector: 'app-arrange-menus-modal',
  standalone: true,
  imports: [TranslateModule, CdkDropList, CdkDrag, CdkDragHandle, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arrange-menus-modal.component.html',
  styleUrl: './arrange-menus-modal.component.scss',
})
export class ArrangeMenusModalComponent implements OnInit {
  ref = inject<ModalRef<boolean>>(MODAL_REF);
  private service = inject(MenuBuilderService);
  private toast = inject(ToastService);
  private announcer = inject(LiveAnnouncer);
  private translate = inject(TranslateService);

  rows = signal<Row[]>([]);
  loading = signal(true);
  saving = signal(false);
  dirty = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.service.getList({ page: 1, limit: 500 });
      this.rows.set(res.list.map((m) => ({ id: m.id, name: m.name, startAt: m.startAt, endAt: m.endAt })));
    } finally {
      this.loading.set(false);
    }
  }

  drop(e: CdkDragDrop<unknown>): void { this.move(e.previousIndex, e.currentIndex); }

  move(from: number, to: number): void {
    if (from === to || to < 0 || to >= this.rows().length) return;
    const list = [...this.rows()];
    moveItemInArray(list, from, to);
    this.rows.set(list);
    this.dirty.set(true);
    void this.announcer.announce(this.translate.instant('MENU_BUILDER.ARRANGE.MOVED', { name: list[to].name, n: to + 1, total: list.length }), 'polite');
  }

  onKey(e: KeyboardEvent, i: number): void {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const to = i + (e.key === 'ArrowUp' ? -1 : 1);
    this.move(i, to);
    const id = this.rows()[to]?.id;
    if (id) setTimeout(() => Array.from(document.querySelectorAll<HTMLElement>('[data-arrange-id]')).find((el) => el.dataset['arrangeId'] === id)?.querySelector<HTMLElement>('.am__handle')?.focus());
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const ok = await this.service.rearrange(this.rows().map((r, index) => ({ id: r.id, index })));
      if (ok) { this.toast.success('COMMON.SAVED_OK'); this.ref.close(true); }
      else this.toast.error('COMMON.SAVE_FAILED');
    } finally {
      this.saving.set(false);
    }
  }
}
