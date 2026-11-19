import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { LookupItem } from '../../services/promotions-lookups.service';

/** A wrap of checkboxes (branches / services) that edits a list of selected ids. */
@Component({
  selector: 'app-check-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cc">
      @for (item of items(); track item.id) {
        <label class="cc__item">
          <input type="checkbox" [checked]="selected().includes(item.id)" (change)="toggle(item.id, $any($event.target).checked)"/>
          <span>{{ item.name }}</span>
        </label>
      }
    </div>
  `,
  styles: [`
    .cc { display: flex; flex-wrap: wrap; gap: 8px; }
    .cc__item {
      display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px;
      border: 1px solid var(--ui-line-strong); background: var(--ui-surface); font-size: 13px; color: var(--ui-text-3); cursor: pointer;
    }
  `],
})
export class CheckChipsComponent {
  items = input<LookupItem[]>([]);
  selected = input<string[]>([]);
  selectedChange = output<string[]>();

  toggle(id: string, on: boolean): void {
    const cur = this.selected() ?? [];
    this.selectedChange.emit(on ? [...cur.filter(x => x !== id), id] : cur.filter(x => x !== id));
  }
}
