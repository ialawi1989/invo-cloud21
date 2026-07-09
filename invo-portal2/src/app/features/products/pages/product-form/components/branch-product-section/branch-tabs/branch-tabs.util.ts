import { EntityRef } from '@shared/components/entity-selector/entity-selector.service';
import { EntityCompletion, SelectorMode } from '@shared/components/entity-selector/entity-selector.util';
import { BranchTabRef } from './branch-tabs.service';

/** Branch-flavoured mode alias (kept for the wrapper's public API). */
export type BranchTabsMode = SelectorMode;
export type BranchCompletion = EntityCompletion;

// Re-export the generic pure helpers so existing importers keep working.
export {
  normalizeForSearch,
  matchesQuery,
  progressCounts,
} from '@shared/components/entity-selector/entity-selector.util';
export type { CompletionMap } from '@shared/components/entity-selector/entity-selector.util';

/**
 * Resolve the effective mode: `mode` wins; otherwise the deprecated `dropdown`
 * boolean maps `true` → `'dropdown'`, falling back to `'tabs'`.
 */
export function resolveBranchMode(
  mode: BranchTabsMode | undefined,
  dropdown: boolean,
): BranchTabsMode {
  if (mode) return mode;
  return dropdown ? 'dropdown' : 'tabs';
}

/** Map the branch-flavoured ref onto the generic `EntityRef`. */
export function toEntityRef(b: BranchTabRef): EntityRef {
  return {
    id: b.id,
    label: b.name,
    status: b.isOnline ? 'online' : 'offline',
    group: b.group,
    disabled: b.disabled,
  };
}
