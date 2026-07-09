import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  isDevMode,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { EntitySelectorComponent } from '@shared/components/entity-selector/entity-selector.component';
import { EntityRef } from '@shared/components/entity-selector/entity-selector.service';
import { CompletionMap } from '@shared/components/entity-selector/entity-selector.util';

import { BranchTabRef } from './branch-tabs.service';
import { BranchTabsMode, resolveBranchMode, toEntityRef } from './branch-tabs.util';

export type { BranchTabsMode, BranchCompletion, CompletionMap } from './branch-tabs.util';

/**
 * branch-tabs
 * ───────────
 * Thin, branch-flavoured wrapper over the generic `<app-entity-selector>`. It
 * keeps the original public API (`branches`/`BranchTabRef` with `isOnline`, the
 * deprecated `dropdown` alias, and the same outputs/labels), maps each ref to
 * the generic `EntityRef` (`name → label`, `isOnline → status`), projects the
 * online indicator (a dot in tabs/sidebar/dropdown, a text pill in popover
 * rows), and passes the existing `PRODUCTS.FORM.BRANCH_TABS_*` translation keys.
 *
 * Selection state still comes from `provideBranchTabs(namespace)` on the host —
 * now an alias of `provideEntitySelector`.
 */
@Component({
  selector: 'app-pf-branch-tabs',
  standalone: true,
  imports: [CommonModule, TranslateModule, EntitySelectorComponent],
  templateUrl: './branch-tabs.component.html',
  styleUrl: './branch-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchTabsComponent {
  /** Live branch directory pushed from the parent. */
  branches = input.required<ReadonlyArray<BranchTabRef>>();

  /** Display mode. */
  mode = input<BranchTabsMode | undefined>(undefined);

  /** @deprecated Use `[mode]="'dropdown'"`. Alias: `true` → `'dropdown'`. */
  dropdown = input<boolean>(false);

  closable = input<boolean>(true);
  maxVisible = input<number>(5);
  maxVisibleMobile = input<number | null>(null);
  completion = input<CompletionMap | null>(null);
  showProgress = input<boolean>(true);
  showBulkActions = input<boolean>(false);

  activeChange = output<string>();
  applyToAll = output<void>();
  copyFrom = output<string>();

  /** Effective mode after applying the `dropdown` deprecation alias. */
  resolvedMode = computed<BranchTabsMode>(() =>
    resolveBranchMode(this.mode(), this.dropdown()),
  );

  /** Branch refs mapped to the generic `EntityRef` shape. */
  items = computed<EntityRef[]>(() => this.branches().map(toEntityRef));

  private warnedDropdown = false;

  constructor() {
    // One-time dev warning when the deprecated `dropdown` alias is used.
    effect(() => {
      if (isDevMode() && this.dropdown() && this.mode() == null && !this.warnedDropdown) {
        this.warnedDropdown = true;
        console.warn(
          '[app-pf-branch-tabs] `dropdown` is deprecated — use `mode="dropdown"` instead.',
        );
      }
    });
  }
}
