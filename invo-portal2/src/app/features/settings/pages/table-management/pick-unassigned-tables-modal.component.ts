import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import {
  RestaurantTable,
  TableManagementService,
} from '../../services/table-management.service';

export interface PickUnassignedModalData {
  branchId: string;
}

/**
 * Pick-unassigned-tables modal
 * ────────────────────────────
 * Surfaces every table that lives on the branch but isn't placed in
 * any active group, so the user can re-attach one (or many) to the
 * group they're currently editing. Used from the table-management
 * page's right-click context menu and the right-panel "+" button.
 *
 * Returns the picked tables on confirm, `[]` on cancel.
 */
@Component({
  selector: 'app-tm-pick-unassigned-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pick-unassigned-tables-modal.component.html',
  styleUrl: './pick-unassigned-tables-modal.component.scss',
})
export class PickUnassignedTablesModalComponent {
  private modalRef = inject<ModalRef<RestaurantTable[]>>(MODAL_REF);
  private data     = inject<PickUnassignedModalData>(MODAL_DATA);
  private service  = inject(TableManagementService);

  loading = signal<boolean>(true);
  rows    = signal<RestaurantTable[]>([]);
  search  = signal<string>('');
  picked  = signal<Set<string>>(new Set());

  filtered = computed<RestaurantTable[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((t) => (t.name ?? '').toLowerCase().includes(q));
  });

  pickedCount = computed<number>(() => this.picked().size);

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    try {
      this.rows.set(await this.service.getUnassignedTables(this.data.branchId));
    } finally {
      this.loading.set(false);
    }
  }

  toggle(id: string | null): void {
    if (!id) return;
    this.picked.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isPicked(id: string | null): boolean {
    return !!id && this.picked().has(id);
  }

  ok(): void {
    const ids = this.picked();
    const out = this.rows().filter((t) => t.id && ids.has(t.id));
    this.modalRef.close(out);
  }

  cancel(): void {
    this.modalRef.close([]);
  }
}
