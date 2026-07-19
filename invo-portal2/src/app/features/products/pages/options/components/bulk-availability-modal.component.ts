import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

export interface BranchChoice { id: string; name: string; }

export interface BulkAvailabilityData {
  branches: BranchChoice[];
  /** How many options the change will hit — shown for reassurance. */
  count: number;
}

export interface BulkAvailabilityResult {
  /** Branch ids to stamp. Never empty — Apply is blocked on an empty pick. */
  branchIds: string[];
  available: boolean;
}

/**
 * "Perform change" — the legacy bulk-availability panel, as a modal.
 *
 * Picks branches and an available/unavailable state, then hands the choice
 * back; applying it to the selected rows is the caller's job.
 *
 * Multi-select rather than the legacy single-branch-or-all: it covers both of
 * those (one branch, or all of them) and the case they couldn't — a subset —
 * which otherwise meant repeating the whole flow once per branch. Defaults to
 * every branch selected, so the common "all branches" case stays one click.
 */
@Component({
  selector: 'app-bulk-availability-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'PRODUCTS.OPTIONS.AVAILABILITY.PERFORM_CHANGE' | translate"/>

    <div class="bam__body">
      <p class="bam__scope">
        {{ 'COMMON.SELECTED_COUNT' | translate:{ count: data.count } }}
      </p>

      <div class="bam__field">
        <div class="bam__label">
          <span>{{ 'PRODUCTS.OPTIONS.AVAILABILITY.BRANCHES' | translate }}</span>
          <button type="button" class="bam__link" (click)="toggleAll()">
            {{ (allPicked() ? 'COMMON.CLEAR_ALL' : 'COMMON.SELECT_ALL') | translate }}
          </button>
        </div>
        <app-search-dropdown
          [items]="data.branches"
          [displayWith]="display"
          [compareWith]="compare"
          [value]="picked()"
          [multiple]="true"
          [searchable]="true"
          [placeholder]="'PRODUCTS.OPTIONS.AVAILABILITY.PICK_BRANCHES' | translate"
          (valueChange)="onBranch($event)"/>
      </div>

      <!-- Deliberately a checkbox, not a toggle: it sets the exact state the
           grid cells will take, and those cells are checkboxes. Two affordances
           for one concept in the same flow reads as two different things. -->
      <label class="bam__check">
        <input type="checkbox" [checked]="available()"
               (change)="available.set($any($event.target).checked)"/>
        <span>{{ 'PRODUCTS.OPTIONS.AVAILABILITY.AVAILABLE' | translate }}</span>
      </label>
    </div>

    <app-modal-footer>
      <button type="button" class="btn btn-ghost" (click)="cancel()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="btn btn-primary" [disabled]="picked().length === 0" (click)="apply()">{{ 'PRODUCTS.OPTIONS.AVAILABILITY.APPLY' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .bam__body { padding: 18px; display: flex; flex-direction: column; gap: 16px; }
    .bam__scope { margin: 0; font-size: 13px; color: #64748b; }
    .bam__field { display: flex; flex-direction: column; gap: 6px; }
    .bam__label {
      display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
      font-size: 13px; font-weight: 500; color: #0f172a;
    }
    .bam__link {
      padding: 0; border: 0; background: transparent; cursor: pointer;
      font: inherit; font-size: 12px; font-weight: 600;
      color: var(--color-brand-700, #0e7490);
      &:hover { text-decoration: underline; }
    }
    .bam__check {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; color: #0f172a; cursor: pointer;
      input { width: 16px; height: 16px; accent-color: #32acc1; cursor: pointer; }
    }
  `],
})
export class BulkAvailabilityModalComponent {
  private translate = inject(TranslateService);
  private modalRef = inject<ModalRef<BulkAvailabilityResult>>(MODAL_REF);
  data = inject<BulkAvailabilityData>(MODAL_DATA);

  available = signal(true);
  /** Every branch by default — the legacy default was "All branches". */
  picked = signal<BranchChoice[]>([...this.data.branches]);

  readonly allPicked = computed(() => this.picked().length === this.data.branches.length);

  display = (b: BranchChoice) => b?.name ?? '';
  compare = (a: BranchChoice, b: BranchChoice) => a?.id === b?.id;

  onBranch(value: BranchChoice | BranchChoice[] | null): void {
    this.picked.set(Array.isArray(value) ? value : (value ? [value] : []));
  }

  toggleAll(): void {
    this.picked.set(this.allPicked() ? [] : [...this.data.branches]);
  }

  apply(): void {
    this.modalRef.close({
      branchIds: this.picked().map((b) => b.id),
      available: this.available(),
    });
  }

  cancel(): void { this.modalRef.close(undefined); }
}
