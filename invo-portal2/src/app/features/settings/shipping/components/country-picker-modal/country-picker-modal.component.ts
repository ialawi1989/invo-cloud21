import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

export interface CountryPickerModalData {
  /** Names of countries already selected for THIS zone — pre-tick. */
  selected:  string[];
  /** Names already taken by OTHER zones — show as disabled rows so
   *  the user can see what's unavailable + why. */
  takenByOthers: string[];
  /** All country names available to pick from (already loaded by
   *  the caller; the modal doesn't fetch). */
  countries: string[];
  /** Modal title. */
  title:     string;
}

export type CountryPickerModalResult = string[] | undefined;

/**
 * Multi-country picker — checkbox list with search + select-all-
 * filtered, used by the shipping page when the user adds a zone
 * or edits an existing zone's country set.
 */
@Component({
  selector: 'app-country-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="data.title"/>

    <div class="cpm__body">
      <label class="cpm__search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          [placeholder]="'COMMON.SEARCH' | translate"/>
      </label>

      <div class="cpm__bar">
        <span class="cpm__count">{{ 'SHIPPING.PICKER.SELECTED' | translate:{ count: selectedSet().size } }}</span>
        <button type="button" class="cpm__link" (click)="selectAllFiltered()">
          {{ 'SHIPPING.PICKER.SELECT_ALL_FILTERED' | translate }}
        </button>
        <button type="button" class="cpm__link" (click)="clearAll()">
          {{ 'SHIPPING.PICKER.CLEAR_ALL' | translate }}
        </button>
      </div>

      <ul class="cpm__list">
        @for (c of filtered(); track c) {
          @let taken = takenSet().has(c) && !selectedSet().has(c);
          <li class="cpm__row" [class.is-taken]="taken"
            (click)="taken ? null : toggle(c)">
            <input type="checkbox"
              [checked]="selectedSet().has(c)"
              [disabled]="taken"
              (click)="$event.stopPropagation()"
              (change)="toggle(c)"/>
            <span>{{ c }}</span>
            @if (taken) {
              <span class="cpm__taken">{{ 'SHIPPING.PICKER.TAKEN' | translate }}</span>
            }
          </li>
        }
        @if (filtered().length === 0) {
          <li class="cpm__empty">{{ 'SHIPPING.PICKER.NO_MATCH' | translate }}</li>
        }
      </ul>
    </div>

    <app-modal-footer>
      <button type="button" class="btn btn-ghost"   (click)="cancel()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="btn btn-primary" (click)="apply()">{{ 'COMMON.APPLY' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; max-height: 80vh; }

    .cpm__body {
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-height: 0;
    }
    .cpm__search {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 38px;
      padding: 0 12px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;

      > svg { color: #94a3b8; flex-shrink: 0; }
      > input {
        flex: 1 1 auto;
        border: 0;
        outline: 0;
        background: transparent;
        font-size: 13px;
        color: #0f172a;
      }
      &:focus-within {
        border-color: var(--color-brand-300, #bae6fd);
        box-shadow: 0 0 0 2px var(--color-brand-100, #e0f2fe);
      }
    }

    .cpm__bar {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: #475569;
    }
    .cpm__count { font-weight: 600; }
    .cpm__link {
      appearance: none;
      background: transparent;
      border: 0;
      color: var(--color-brand-700, #0e7490);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      padding: 0;
      &:hover { text-decoration: underline; }
    }

    .cpm__list {
      list-style: none;
      margin: 0;
      padding: 0;
      flex: 1;
      overflow-y: auto;
      border: 1px solid #f1f5f9;
      border-radius: 8px;
      max-height: 420px;
    }
    .cpm__row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
      color: #0f172a;
      cursor: pointer;

      &:last-child { border-bottom: 0; }
      &:hover:not(.is-taken) { background: #f8fafc; }

      &.is-taken {
        cursor: not-allowed;
        color: #94a3b8;
      }

      input { accent-color: var(--color-brand-600, #0891b2); }
    }
    .cpm__taken {
      margin-inline-start: auto;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #b45309;
      letter-spacing: 0.04em;
    }
    .cpm__empty {
      padding: 24px;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
    }
  `],
})
export class CountryPickerModalComponent {
  data = inject<CountryPickerModalData>(MODAL_DATA);
  private ref = inject<ModalRef<CountryPickerModalResult>>(MODAL_REF);

  search = signal<string>('');
  selectedSet = signal<Set<string>>(new Set(this.data.selected));
  takenSet    = signal<Set<string>>(new Set(this.data.takenByOthers));

  filtered = computed<string[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.data.countries;
    return this.data.countries.filter(c => c.toLowerCase().includes(q));
  });

  toggle(country: string): void {
    this.selectedSet.update(set => {
      const next = new Set(set);
      next.has(country) ? next.delete(country) : next.add(country);
      return next;
    });
  }

  /** Select-all targets only the currently-filtered list — and
   *  skips any country already taken by another zone, since
   *  those are disabled in the row. */
  selectAllFiltered(): void {
    this.selectedSet.update(set => {
      const next = new Set(set);
      for (const c of this.filtered()) {
        if (!this.takenSet().has(c) || next.has(c)) next.add(c);
      }
      return next;
    });
  }

  clearAll(): void {
    this.selectedSet.set(new Set());
  }

  apply(): void {
    this.ref.close(Array.from(this.selectedSet()));
  }
  cancel(): void {
    this.ref.dismiss();
  }
}
