import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { EmployeeLite } from '../../models/appointment.types';
import { employeeColor } from '../../utils/employee-color';

export interface StaffFilterData {
  employees: EmployeeLite[];
  /** Ids currently hidden from the calendar. */
  hiddenIds: string[];
}

/** Resolves with the new list of hidden ids, or nothing when dismissed. */
@Component({
  selector: 'app-staff-filter-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'APPOINTMENTS.STAFF' | translate" />

    <div class="sf">
      <div class="sf__tools">
        <input class="sf__search" type="text" [ngModel]="search()" (ngModelChange)="search.set($event)"
          [placeholder]="'APPOINTMENTS.STAFF_FILTER.SEARCH' | translate" />
        <button type="button" class="sf__link" (click)="setAll(true)">{{ 'APPOINTMENTS.STAFF_FILTER.SELECT_ALL' | translate }}</button>
        <button type="button" class="sf__link" (click)="setAll(false)">{{ 'APPOINTMENTS.STAFF_FILTER.CLEAR' | translate }}</button>
      </div>

      <ul class="sf__list">
        @for (emp of filtered(); track emp.id) {
          <li>
            <label class="sf__row">
              <input type="checkbox" [checked]="!hidden().has(emp.id)" (change)="toggle(emp.id)" />
              <span class="sf__dot" [style.background]="color(emp.id)"></span>
              <span class="sf__name">{{ emp.name }}</span>
            </label>
          </li>
        }
      </ul>
    </div>

    <app-modal-footer>
      <button type="button" class="sf__btn" (click)="ref.dismiss()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="sf__btn sf__btn--primary" (click)="apply()">{{ 'APPOINTMENTS.STAFF_FILTER.APPLY' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .sf { padding: 16px 24px; }
    .sf__tools { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .sf__search { flex: 1; min-width: 0; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: inherit; }
    .sf__search:focus { outline: none; border-color: #32acc1; }
    .sf__link { background: none; border: none; color: #2691a4; font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 0; white-space: nowrap; }
    .sf__link:hover { text-decoration: underline; }
    .sf__list { list-style: none; margin: 0; padding: 0; max-height: 340px; overflow: auto; }
    .sf__row { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: 8px; cursor: pointer; font-size: 13.5px; color: #1f2937; }
    .sf__row:hover { background: #f5f7fa; }
    .sf__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .sf__btn { padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; cursor: pointer; }
    .sf__btn--primary { background: #2691a4; border-color: #2691a4; color: #fff; font-weight: 600; }
  `],
})
export class StaffFilterModalComponent {
  private data = inject<StaffFilterData>(MODAL_DATA);
  ref = inject<ModalRef<string[]>>(MODAL_REF);

  search = signal('');
  hidden = signal<Set<string>>(new Set(this.data.hiddenIds));

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.data.employees.filter(e => e.name.toLowerCase().includes(q)) : this.data.employees;
  });

  color(id: string): string { return employeeColor(id); }

  toggle(id: string): void {
    this.hidden.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Applies to whoever the search currently shows. */
  setAll(visible: boolean): void {
    this.hidden.update(set => {
      const next = new Set(set);
      for (const e of this.filtered()) { if (visible) next.delete(e.id); else next.add(e.id); }
      return next;
    });
  }

  apply(): void { this.ref.close(Array.from(this.hidden())); }
}
