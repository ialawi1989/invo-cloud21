import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ALL_BRANCHES, BranchFilter } from '../../services/tracking-map.types';
import { TrackingMapService } from '../../services/tracking-map.service';

interface BranchOption {
  id: BranchFilter;
  name: string;
}

@Component({
  selector: 'app-branch-filter',
  standalone: true,
  imports: [SearchDropdownComponent, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-search-dropdown
      [items]="options()"
      [displayWith]="displayWith"
      [toValue]="toValue"
      [compareWith]="compareWith"
      [value]="selectedOption()"
      (valueChange)="onValueChange($event)"
      [clearable]="false"
      [placeholder]="'TRACKING_MAP.BRANCH_FILTER.PLACEHOLDER' | translate"
      [searchPlaceholder]="'TRACKING_MAP.BRANCH_FILTER.SEARCH' | translate"
    />
  `,
})
export class BranchFilterComponent {
  readonly tracking = inject(TrackingMapService);
  private readonly translate = inject(TranslateService);

  readonly options = computed<BranchOption[]>(() => [
    { id: ALL_BRANCHES, name: this.translate.instant('TRACKING_MAP.BRANCH_FILTER.ALL') },
    ...this.tracking.branches().map(b => ({ id: b.id, name: b.name })),
  ]);

  readonly selectedOption = computed<BranchOption | null>(
    () => this.options().find(o => o.id === this.tracking.selectedBranch()) ?? null,
  );

  readonly displayWith = (item: BranchOption) => item.name;
  readonly toValue = (item: BranchOption) => item.id;
  readonly compareWith = (a: BranchOption, b: BranchOption) => a.id === b.id;

  onValueChange(value: BranchOption | BranchOption[] | null): void {
    const option = Array.isArray(value) ? value[0] ?? null : value;
    this.tracking.setBranch(option?.id ?? ALL_BRANCHES);
  }
}
