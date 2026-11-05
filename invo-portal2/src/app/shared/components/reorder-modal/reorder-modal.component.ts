import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TranslateModule } from '@ngx-translate/core';

import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import type { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';

export interface ReorderItem {
  id: string;
  label: string;
  /** Smaller line under the label. */
  sub?: string;
  /** Thumbnail URL. */
  image?: string | null;
}

export interface ReorderModalData {
  /** Already-translated heading. */
  title: string;
  /** The items in their current order. */
  items: ReorderItem[];
}

/**
 * Reorder dialog: drag a row by its handle, nudge it with the arrows, or type the position it should have (1-based).
 * Closes with the ids in the new order, or `null` when cancelled; the caller persists them. Used wherever a list has a
 * manual display order (categories, the options of an option group).
 */
@Component({
  selector: 'app-reorder-modal',
  standalone: true,
  imports: [DragDropModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="data.title"/>
    <div class="ro">
      <p class="ro__hint">{{ 'COMMON.REORDER.HINT' | translate }}</p>
      <ul class="ro__list" cdkDropList (cdkDropListDropped)="drop($event)">
        @for (it of items(); track it.id; let i = $index) {
          <li class="ro__row" cdkDrag>
            <span class="ro__grip" cdkDragHandle [attr.aria-label]="'COMMON.DRAG_TO_REORDER' | translate">⠿</span>
            <input class="ro__pos" type="number" min="1" [max]="items().length" [value]="i + 1"
              (change)="moveTo(i, $any($event.target).value)" [attr.aria-label]="'COMMON.REORDER.POSITION' | translate"/>
            @if (it.image) { <img class="ro__img" [src]="it.image" alt=""/> }
            <div class="ro__name"><strong>{{ it.label }}</strong>@if (it.sub) { <small>{{ it.sub }}</small> }</div>
            <button type="button" class="ro__btn" [disabled]="i === 0" (click)="moveTo(i, i)" [attr.aria-label]="'COMMON.MOVE_UP' | translate">▲</button>
            <button type="button" class="ro__btn" [disabled]="i === items().length - 1" (click)="moveTo(i, i + 2)" [attr.aria-label]="'COMMON.MOVE_DOWN' | translate">▼</button>
          </li>
        }
      </ul>
    </div>
    <app-modal-footer>
      <button type="button" class="ro__act" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="ro__act ro__act--primary" [disabled]="!changed()" (click)="ref.close(ids())">{{ 'COMMON.APPLY' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .ro { padding: 16px 20px; min-width: min(560px, 92vw); display: flex; flex-direction: column; gap: 10px; }
    .ro__hint { margin: 0; font-size: 12.5px; color: #64748b; }
    .ro__list { list-style: none; margin: 0; padding: 0; max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .ro__row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
    .ro__row.cdk-drag-preview { box-shadow: 0 8px 24px rgba(15,23,42,.18); }
    .ro__grip { cursor: grab; color: #94a3b8; font-size: 18px; line-height: 1; user-select: none; }
    .ro__pos { width: 56px; height: 32px; text-align: center; border: 1px solid #d0d5dd; border-radius: 6px; font: inherit; }
    .ro__img { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; }
    .ro__name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .ro__name small { color: #64748b; }
    .ro__btn { width: 28px; height: 28px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; color: #475569; cursor: pointer; font-size: 11px; }
    .ro__btn:disabled { opacity: .35; cursor: not-allowed; }
    .ro__act { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .ro__act--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .ro__act:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class ReorderModalComponent {
  readonly data = inject<ReorderModalData>(MODAL_DATA);
  readonly ref = inject<ModalRef<string[] | null>>(MODAL_REF);

  readonly items = signal<ReorderItem[]>([...this.data.items]);
  readonly ids = computed(() => this.items().map(i => i.id));
  readonly changed = computed(() => this.ids().some((id, i) => id !== this.data.items[i]?.id));

  drop(e: CdkDragDrop<unknown>): void { this.shift(e.previousIndex, e.currentIndex); }

  /** `position` is 1-based; a value outside the list is clamped to its ends. */
  moveTo(from: number, position: number | string): void {
    const n = Math.round(Number(position));
    if (!Number.isFinite(n)) { this.items.update(l => [...l]); return; }
    this.shift(from, Math.min(this.items().length, Math.max(1, n)) - 1);
  }

  private shift(from: number, to: number): void {
    // Re-emitting even for a no-op resets a typed position back to the row's real one.
    this.items.update(l => {
      const next = [...l];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
}
