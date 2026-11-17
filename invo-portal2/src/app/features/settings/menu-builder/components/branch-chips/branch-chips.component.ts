import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import type { BranchSummary } from '../../../services/branch-settings.service';

const VISIBLE = 3;

/**
 * The menu's branches as chips (the first three, then "+N more") with an Edit link that opens the multiselect.
 * Presentational: it shows `selectedIds` and reports the new list.
 */
@Component({
  selector: 'app-branch-chips',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './branch-chips.component.html',
  styleUrl: './branch-chips.component.scss',
})
export class BranchChipsComponent {
  branches = input<BranchSummary[]>([]);
  selectedIds = input<string[]>([]);
  /** Error code from validation (e.g. "REQUIRED"), or null. */
  error = input<string | null>(null);
  change = output<string[]>();

  editing = signal(false);

  selected = computed(() => {
    const ids = new Set(this.selectedIds());
    return this.branches().filter((b) => ids.has(b.id));
  });
  shown = computed(() => this.selected().slice(0, VISIBLE));
  more = computed(() => Math.max(0, this.selected().length - VISIBLE));

  label = (b: BranchSummary) => b.name || b.id;
  value = (b: BranchSummary) => b.id;
  equals = (a: BranchSummary, b: BranchSummary) => a?.id === b?.id;

  onDropdown(next: BranchSummary | BranchSummary[] | null): void {
    const list = next == null ? [] : Array.isArray(next) ? next : [next];
    this.change.emit(list.map((b) => b.id));
  }

  remove(id: string): void { this.change.emit(this.selectedIds().filter((x) => x !== id)); }
  toggle(): void { this.editing.update((v) => !v); }
}
