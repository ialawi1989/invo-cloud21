import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';

export interface BranchOption { value: string; label: string; }

export interface BranchFilterData {
  /** First entry is "All branches" (empty value). */
  options: BranchOption[];
  selected: string;
}

/** Single-choice branch picker - resolves with the chosen branch id ('' = all branches). */
@Component({
  selector: 'app-branch-filter-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, ModalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'APPOINTMENTS.BRANCH' | translate" />

    <div class="bf">
      <input class="bf__search" type="text" [ngModel]="search()" (ngModelChange)="search.set($event)"
        [placeholder]="'APPOINTMENTS.BRANCH_SEARCH' | translate" />

      <ul class="bf__list">
        @for (o of filtered(); track o.value) {
          <li>
            <button type="button" class="bf__row" [class.is-on]="o.value === data.selected" (click)="pick(o.value)">
              <span class="bf__radio"></span>
              <span>{{ o.label }}</span>
            </button>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .bf { padding: 16px 24px 22px; }
    .bf__search { width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: inherit; margin-bottom: 10px; }
    .bf__search:focus { outline: none; border-color: #32acc1; }
    .bf__list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; }
    .bf__row { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 8px; border: none; border-radius: 8px; background: none; cursor: pointer; font-size: 13.5px; color: #1f2937; text-align: left; font-family: inherit; }
    .bf__row:hover { background: #f5f7fa; }
    .bf__row.is-on { background: #e0f2f6; font-weight: 600; }
    .bf__radio { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #94a3b8; flex-shrink: 0; box-sizing: border-box; }
    .is-on .bf__radio { border-color: #2691a4; background: radial-gradient(#2691a4 40%, transparent 45%); }
  `],
})
export class BranchFilterModalComponent {
  data = inject<BranchFilterData>(MODAL_DATA);
  private ref = inject<ModalRef<string>>(MODAL_REF);

  search = signal('');
  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.data.options.filter(o => o.label.toLowerCase().includes(q)) : this.data.options;
  });

  pick(value: string): void { this.ref.close(value); }
}
