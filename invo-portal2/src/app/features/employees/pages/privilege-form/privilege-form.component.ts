import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EmployeePrivilege } from '@core/auth/privileges/models/privilege.model';
import { PrivilegeSetting } from '@core/auth/privileges/models/privilege-setting.model';
import {
  PRESET_ROLES,
  PresetRole,
  applyPresetToPrivilege,
} from '@core/auth/privileges/preset-roles';

import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';

/** Security-type filter option (client-side filter over the tree). */
interface SecurityTypeOption {
  labelKey: string;
  value: 'all' | 'cloud' | 'POS';
}

/** A single leaf action rendered as one `<app-toggle>`. */
interface ActionVm {
  key: string;
  label: string;
  setting: PrivilegeSetting;
  checked: boolean;
}

/** One collapsible card per top-level security group. */
interface GroupVm {
  key: string;
  label: string;
  section: PrivilegeSetting;
  /** Actions visible after the security + search filters. */
  actions: ActionVm[];
  /** Total actions passing the security filter (ignores search). */
  totalActions: number;
  /** How many of those are enabled — drives the "x / y" counter. */
  enabledActions: number;
  hasActions: boolean;
  allOn: boolean;
  /** For action-less groups the header toggle is the section's own access. */
  sectionChecked: boolean;
  expanded: boolean;
}

/**
 * Privilege (permission-set) form
 * ───────────────────────────────
 * Name + the full feature/action access tree. One collapsible card per
 * top-level security group (~100 groups); each action is an `<app-toggle>`.
 *
 * Data:
 *   • The canonical catalog is built by instantiating the CORE
 *     {@link EmployeePrivilege} — its `Privilege` builds the entire
 *     group/action tree from the local definitions (the same data
 *     `PrivilegeService.loadPrivileges()` / `getPrivilegesFile` returns).
 *     We instantiate it directly rather than call `loadPrivileges()`
 *     because that method caches into the service's shared `_privileges`,
 *     which `check()` reads for the signed-in user's live permissions —
 *     overwriting it here would corrupt route/permission checks for the
 *     session.
 *   • For an existing record `getPrivilege(id)` already returns a fully
 *     merged tree (it seeds a fresh `Privilege` then overlays the saved
 *     access map), so every group/action renders with its saved state.
 *
 * Save builds the EmployeePrivilege payload via `ToJson()` and calls
 * `savePrivilege()`.
 */
@Component({
  selector: 'app-privilege-form',
  standalone: true,
  imports: [
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    ToggleComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privilege-form.component.html',
  styleUrl: './privilege-form.component.scss',
})
export class PrivilegeFormComponent implements OnInit, CanLeaveComponent {
  private service    = inject(PrivilegeService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** '0' (or missing) means a brand-new record. */
  private recordId = signal<string | null>(null);
  isCreate = computed<boolean>(() => {
    const id = this.recordId();
    return !id || id === '0';
  });

  /** The privilege-set name (top field). */
  name = signal<string>('');

  /** Optional description of what this role is for. */
  description = signal<string>('');

  /** Preset (template) roles — "Start from a preset" picker. */
  presetRoles: PresetRole[] = PRESET_ROLES;
  displayPreset = (p: PresetRole): string => this.translate.instant(p.displayNameKey);

  /** The underlying tree (mutable CORE instances). Toggles mutate the
   *  `access` fields in place; `treeVersion` is bumped so the derived
   *  view model recomputes. */
  private record = signal<EmployeePrivilege | null>(null);
  private treeVersion = signal(0);

  private dirty = signal<boolean>(false);

  // ── Filters ──────────────────────────────────────────────────────────────
  search = signal<string>('');

  securityTypeOptions: SecurityTypeOption[] = [
    { labelKey: 'EMPLOYEES.PRIVILEGES.FILTER_ALL',   value: 'all' },
    { labelKey: 'EMPLOYEES.PRIVILEGES.FILTER_CLOUD', value: 'cloud' },
    { labelKey: 'EMPLOYEES.PRIVILEGES.FILTER_POS',   value: 'POS' },
  ];
  securityType = signal<SecurityTypeOption>(this.securityTypeOptions[0]);

  /** Which groups are expanded (by key). */
  private expanded = signal<Set<string>>(new Set<string>());

  /** Re-run translated computeds after ngx-translate loads / lang change. */
  private i18nTick = signal(0);

  displaySecurityType = (o: SecurityTypeOption): string =>
    this.translate.instant(o.labelKey);

  // ── Derived ────────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('EMPLOYEES.TITLE'), routerLink: '/employees' },
      { label: this.translate.instant('EMPLOYEES.PRIVILEGES.TITLE'), routerLink: '/employees/privileges' },
      {
        label: this.translate.instant(
          this.isCreate()
            ? 'EMPLOYEES.PRIVILEGES.ADD_TITLE'
            : 'EMPLOYEES.PRIVILEGES.EDIT_TITLE',
        ),
      },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant(
      this.isCreate()
        ? 'EMPLOYEES.PRIVILEGES.ADD_TITLE'
        : 'EMPLOYEES.PRIVILEGES.EDIT_TITLE',
    );
  });

  savingLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  /**
   * The view model — one entry per top-level security group, filtered by
   * the security-type dropdown and the search box. Recomputes whenever the
   * filters, expand state, or `treeVersion` (a toggle) change.
   */
  groups = computed<GroupVm[]>(() => {
    this.treeVersion();
    this.i18nTick();
    const ep = this.record();
    if (!ep) return [];

    const term    = this.search().trim().toLowerCase();
    const secType = this.securityType().value;
    const openSet = this.expanded();

    const secOk = (t: string | undefined): boolean =>
      secType === 'all' || t === secType || t === 'common';

    const out: GroupVm[] = [];

    for (const key in ep.privileges) {
      const section = ep.privileges[key] as PrivilegeSetting;
      if (!section || typeof section.ToJson !== 'function') continue;

      const label = section.name || key;
      const groupMatches =
        !term ||
        label.toLowerCase().includes(term) ||
        key.toLowerCase().includes(term);

      // All actions passing the security filter (search-independent) — the
      // basis for the select-all counter.
      const secActions: PrivilegeSetting[] = [];
      const visible: ActionVm[] = [];

      if (section.actions) {
        for (const ak in section.actions) {
          const a = section.actions[ak];
          if (!secOk(a.securityType)) continue;
          secActions.push(a);
          const aLabel = a.name || ak;
          if (groupMatches || aLabel.toLowerCase().includes(term)) {
            visible.push({ key: ak, label: aLabel, setting: a, checked: a.access === true });
          }
        }
      }

      const hasActions   = secActions.length > 0;
      const sectionSecOk = secOk(section.securityType) || hasActions;
      const searchOk     = groupMatches || visible.length > 0;
      if (!sectionSecOk || !searchOk) continue;

      const enabled = secActions.reduce((n, a) => (a.access === true ? n + 1 : n), 0);

      out.push({
        key,
        label,
        section,
        actions: visible,
        totalActions: secActions.length,
        enabledActions: enabled,
        hasActions,
        allOn: hasActions && enabled === secActions.length,
        sectionChecked: section.access === true,
        expanded: openSet.has(key),
      });
    }

    return out;
  });

  /** True once a catalog is loaded but the filters hid everything. */
  noMatches = computed<boolean>(() => !!this.record() && this.groups().length === 0);

  /**
   * Master "select all" state across the WHOLE tree (ignores filters): true
   * only when every group and every action is enabled. Drives the header
   * master toggle — the "promotion way" select-all applied to all groups.
   */
  allGroupsOn = computed<boolean>(() => {
    this.treeVersion();
    const ep = this.record();
    if (!ep) return false;
    for (const key in ep.privileges) {
      const section = ep.privileges[key] as PrivilegeSetting;
      if (!section || typeof section.ToJson !== 'function') continue;
      if (section.actions) {
        for (const ak in section.actions) {
          if (section.actions[ak].access !== true) return false;
        }
      } else if (section.access !== true) {
        return false;
      }
    }
    return true;
  });

  constructor() {
    withTranslations('employees');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    this.recordId.set(id);

    this.loading.set(true);
    try {
      if (!id || id === '0') {
        // New record — a fresh EmployeePrivilege carries the full catalog
        // with every action defaulting to "off".
        this.record.set(new EmployeePrivilege());
      } else {
        const ep = await this.service.getPrivilege(id);
        this.record.set(ep);
        this.name.set(ep.name ?? '');
        this.description.set(ep.description ?? '');
      }
    } finally {
      this.loading.set(false);
    }
  }

  // ── Field handlers ─────────────────────────────────────────────────────────
  onNameInput(value: string): void {
    this.name.set(value);
    this.dirty.set(true);
  }

  onDescriptionInput(value: string): void {
    this.description.set(value);
    this.dirty.set(true);
  }

  /**
   * Apply a preset template to the whole tree: its groups on, everything else
   * off. Also seeds the name (only when still blank, so we don't clobber a
   * user's typed name) and the description, and records the preset key.
   */
  applyPreset(preset: PresetRole | null): void {
    const ep = this.record();
    if (!preset || !ep) return;
    applyPresetToPrivilege(ep.privileges, preset);
    ep.presetKey = preset.key;
    if (!this.name().trim()) this.name.set(this.translate.instant(preset.displayNameKey));
    this.description.set(this.translate.instant(preset.descriptionKey));
    this.markChanged();
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  onSecurityTypeChange(option: SecurityTypeOption | null): void {
    if (option) this.securityType.set(option);
  }

  toggleExpand(key: string): void {
    this.expanded.update(set => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Access mutations ───────────────────────────────────────────────────────
  /** Toggle a single leaf action, then reconcile the parent's access. */
  onActionChange(section: PrivilegeSetting, action: PrivilegeSetting, value: boolean): void {
    action.access = value;
    this.syncSectionAccess(section);
    this.markChanged();
  }

  /** Per-group "select all" — flips every action in the group. */
  onSelectAll(section: PrivilegeSetting, value: boolean): void {
    if (section.actions) {
      for (const ak in section.actions) section.actions[ak].access = value;
    }
    section.access = value;
    this.markChanged();
  }

  /** Header toggle for an action-less group binds straight to its access. */
  onSectionToggle(section: PrivilegeSetting, value: boolean): void {
    section.access = value;
    this.markChanged();
  }

  /** Master select-all — cascade to EVERY group and action in the tree. */
  onSelectAllGroups(value: boolean): void {
    const ep = this.record();
    if (!ep) return;
    for (const key in ep.privileges) {
      const section = ep.privileges[key] as PrivilegeSetting;
      if (!section || typeof section.ToJson !== 'function') continue;
      section.access = value;
      if (section.actions) {
        for (const ak in section.actions) section.actions[ak].access = value;
      }
    }
    this.markChanged();
  }

  /** A section is "accessible" when at least one of its actions is on. */
  private syncSectionAccess(section: PrivilegeSetting): void {
    if (!section.actions) return;
    let any = false;
    for (const ak in section.actions) {
      if (section.actions[ak].access === true) { any = true; break; }
    }
    section.access = any;
  }

  private markChanged(): void {
    this.dirty.set(true);
    this.treeVersion.update(n => n + 1);
  }

  // ── Save / cancel ───────────────────────────────────────────────────────────
  async save(): Promise<void> {
    const ep = this.record();
    if (!ep) return;

    const trimmed = this.name().trim();
    if (!trimmed) {
      this.toast.error('EMPLOYEES.PRIVILEGES.NAME_REQUIRED');
      return;
    }

    ep.name = trimmed;
    ep.description = this.description().trim();
    this.saving.set(true);
    try {
      const res = await this.service.savePrivilege(ep.ToJson());
      if (res?.success === false) {
        this.toast.error('COMMON.SAVE_FAILED');
        return;
      }
      // Clear the dirty flag before navigating so the unsaved-changes guard
      // doesn't intercept the programmatic navigation.
      this.dirty.set(false);
      this.toast.success('EMPLOYEES.PRIVILEGES.SAVED');
      this.router.navigate(['/employees/privileges']);
    } catch (e: any) {
      console.error('[privilege-form] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/employees/privileges']);
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.saving();
  }
}
