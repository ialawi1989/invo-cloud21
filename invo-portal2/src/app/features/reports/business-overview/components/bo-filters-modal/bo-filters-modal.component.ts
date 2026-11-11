import { Component, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { BoFilter, CompareType, ComparePeriod, MAX_COMPARE_QTY, normalizeFilter } from '../../shared/bo-filter';

export interface BranchOption { value: string; label: string; }

export interface BoFiltersModalData {
  filter: BoFilter;
  branches: BranchOption[];
  /** Offer the comparison section. */
  comparison: boolean;
}

/**
 * "Filters" modal of the Business Overview reports (legacy opened a filter
 * modal from its "Filters" button). Edits a draft; nothing changes until Apply.
 *  - Branches: searchable checklist with select all / none.
 *  - Compare: None / By period / By branches, each explained; the branch mode
 *    unlocks once two or more branches are ticked.
 */
@Component({
  selector: 'app-bo-filters-modal',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent],
  templateUrl: './bo-filters-modal.component.html',
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; height: 100%; }
    .opt { transition: border-color .15s, background .15s, box-shadow .15s; }
    .opt[aria-checked='true'] { border-color: var(--color-brand-500, #32acc1); background: rgba(50, 172, 193, .06); box-shadow: 0 0 0 3px rgba(50, 172, 193, .12); }
    .opt[aria-disabled='true'] { opacity: .5; cursor: not-allowed; }
  `],
})
export class BoFiltersModalComponent {
  private ref = inject(MODAL_REF) as ModalRef<BoFilter | undefined>;
  readonly data = inject(MODAL_DATA) as BoFiltersModalData;

  draft = signal<BoFilter>({ ...this.data.filter, branches: [...this.data.filter.branches] });
  search = signal('');

  readonly qtyOptions = Array.from({ length: MAX_COMPARE_QTY }, (_, i) => i + 1);

  visibleBranches = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.data.branches.filter(b => b.label.toLowerCase().includes(q)) : this.data.branches;
  });
  selectedCount = computed(() => this.draft().branches.length);
  allVisibleSelected = computed(() => {
    const v = this.visibleBranches();
    return v.length > 0 && v.every(b => this.draft().branches.includes(b.value));
  });
  canCompareBranches = computed(() => this.draft().branches.length >= 2);

  isSelected = (id: string) => this.draft().branches.includes(id);

  toggleBranch(id: string): void {
    const set = new Set(this.draft().branches);
    set.has(id) ? set.delete(id) : set.add(id);
    this.update({ branches: [...set] });
  }

  /** Select / clear every branch currently visible (respects the search box). */
  toggleAllVisible(): void {
    const set = new Set(this.draft().branches);
    const ids = this.visibleBranches().map(b => b.value);
    if (this.allVisibleSelected()) ids.forEach(i => set.delete(i)); else ids.forEach(i => set.add(i));
    this.update({ branches: [...set] });
  }

  setCompare(t: CompareType): void {
    if (t === 'branch' && !this.canCompareBranches()) return;
    this.update({ compareType: t });
  }
  setPeriod(p: ComparePeriod): void { this.update({ comparePeriod: p }); }
  setQty(n: number): void { this.update({ compareQty: n }); }

  /** Applies edits; normalising drops "compare by branches" if fewer than two remain. */
  private update(p: Partial<BoFilter>): void {
    const next = { ...this.draft(), ...p };
    this.draft.set(p.branches ? normalizeFilter(next) : next);
  }

  clearAll(): void { this.draft.set(normalizeFilter({ ...this.draft(), branches: [], compareType: 'none' })); }
  cancel(): void { this.ref.dismiss(); }
  apply(): void { this.ref.close(normalizeFilter(this.draft())); }
}
