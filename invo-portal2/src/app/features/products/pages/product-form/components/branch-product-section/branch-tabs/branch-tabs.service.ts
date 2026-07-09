/**
 * Compatibility shim — the branch selector is now a thin wrapper over the
 * generic `<app-entity-selector>`. Hosts keep importing `BranchTabsService`,
 * `provideBranchTabs`, `BRANCH_TABS_NAMESPACE` and `BranchTabRef` from here
 * unchanged; they resolve to the generic entity-selector store.
 */
export {
  EntitySelectorService as BranchTabsService,
  ENTITY_SELECTOR_NAMESPACE as BRANCH_TABS_NAMESPACE,
  provideEntitySelector as provideBranchTabs,
} from '@shared/components/entity-selector/entity-selector.service';

/**
 * The branch-flavoured directory ref (public wrapper API). Mapped to the
 * generic `EntityRef` internally (`name → label`, `isOnline → status`).
 */
export interface BranchTabRef {
  id:        string;
  name:      string;
  isOnline:  boolean;
  /** Optional grouping label for sidebar mode. */
  group?:    string;
  /** Rendered but not selectable. */
  disabled?: boolean;
}
