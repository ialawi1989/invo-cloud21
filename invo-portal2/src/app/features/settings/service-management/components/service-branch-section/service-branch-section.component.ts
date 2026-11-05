import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import type { BranchServiceModel } from '../../services/service.types';

type BranchFilter = 'all' | 'enabled' | 'disabled';

/**
 * Per-branch section of the service form, laid out like the product form's Branches card: a collapsible
 * card with a left rail (search, filter chips, branch list with status dots) and a detail panel for the
 * active branch. The panel body is projected (`<ng-content/>`) so the form keeps choosing the
 * type-specific settings component. The parent owns the branches and the active index.
 */
@Component({
  selector: 'app-service-branch-section',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-branch-section.component.html',
  styleUrl: './service-branch-section.component.scss',
})
export class ServiceBranchSectionComponent {
  branches = input.required<ReadonlyArray<BranchServiceModel>>();
  activeIndex = input<number>(0);
  activeChange = output<number>();

  sectionOpen = signal(true);
  paneOpen = signal(true);
  search = signal('');
  filter = signal<BranchFilter>('all');

  private rows = computed(() => this.branches().map((b, index) => ({
    index, id: b.branchId, name: b.branchName || '', enabled: !!b.setting?.enabled,
  })));

  totalCount = computed(() => this.rows().length);
  enabledCount = computed(() => this.rows().filter(r => r.enabled).length);
  disabledCount = computed(() => this.totalCount() - this.enabledCount());

  visibleRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const f = this.filter();
    return this.rows().filter(r =>
      (f === 'all' || (f === 'enabled' ? r.enabled : !r.enabled)) &&
      (!term || r.name.toLowerCase().includes(term)));
  });

  active = computed(() => this.rows().find(r => r.index === this.activeIndex()) ?? null);

  setFilter(f: BranchFilter): void { this.filter.set(f); }
  clearFilters(): void { this.filter.set('all'); this.search.set(''); }
  open(index: number): void { this.activeChange.emit(index); }
}
