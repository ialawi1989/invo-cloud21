import { NgTemplateOutlet } from '@angular/common';
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

/** A saved privilege set the user can clone from (the "preset" dropdown). */
interface RoleOption { id: string; name: string; }

import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { SegmentedToggleComponent, type SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  PickListModalComponent,
  PickListModalData,
  PickListModalResult,
  PickListLoader,
} from '@shared/components/pick-list-modal/pick-list-modal.component';

import { FormSkeletonComponent } from '@shared/components/skeleton/form-skeleton.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
/** Registry keys of every HR permission group (see core/auth/privileges/definitions/registry.ts). */
const HR_GROUP_KEYS = [
  'employeeSecurity', 'employeeProfileSecurity', 'employeeDocumentSecurity',
  'employeeAssetSecurity', 'employeeLeaveSecurity', 'employeePerformanceSecurity',
  'employeeDisciplinarySecurity', 'employeePayrollSecurity', 'employeeEosSecurity',
  'employeeGosiSecurity', 'employeeScheduleSecurity', 'employeeAttendenceSecurity',
  'employeePayoutSecurity', 'employeeInvitationSecurity',
] as const;

/** HR groups render INSIDE Employee Security as an inner group (view-only nesting). */
const HR_PARENT_KEY = 'employeeSecurity';
const HR_INNER_KEYS: string[] = HR_GROUP_KEYS.filter(k => k !== HR_PARENT_KEY);
const HR_INNER_ID = '__hr__';

/** Sidebar order — same as the legacy form; unknown modules are appended A–Z. */
const MODULE_ORDER = [
  'company', 'map', 'appointments', 'dashboard', 'branch', 'kitchen', 'settings', 'orders',
  'products', 'account', 'sales', 'purchase', 'employee', 'customer', 'reports', 'general',
  'promotions', 'Voucher', 'templates', 'website', 'storefront',
];

const MODULE_STYLE: Record<string, { colors: [string, string, string]; icon: string }> = {
  all:          { colors: ['#0e8fa3', '#0b6f80', '#e6f6f9'], icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  company:      { colors: ['#0f766e', '#115e59', '#e6f4f1'], icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h2M9 13h2M13 9h2M13 13h2' },
  map:          { colors: ['#d97706', '#b45309', '#fdf2e0'], icon: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  appointments: { colors: ['#0891b2', '#0e7490', '#e3f5f9'], icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  dashboard:    { colors: ['#4f46e5', '#3730a3', '#ebeafc'], icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  branch:       { colors: ['#059669', '#047857', '#e3f6ee'], icon: 'M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6' },
  kitchen:      { colors: ['#ea580c', '#c2410c', '#fdeee3'], icon: 'M6 13h12v7H6zM7 13a4 4 0 0 1 3-7 4 4 0 0 1 7 1 3 3 0 0 1 0 6' },
  settings:     { colors: ['#475569', '#334155', '#eceff3'], icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-1-1-2h-4l-1 2-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z' },
  orders:       { colors: ['#7c3aed', '#5b21b6', '#f0e9fd'], icon: 'M3 4h2l2 12h11l2-8H6' },
  products:     { colors: ['#c2410c', '#9a3412', '#fcece3'], icon: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8' },
  account:      { colors: ['#2563eb', '#1d4ed8', '#e6eefd'], icon: 'M3 7h18v13H3zM3 7l3-4h12l3 4M16 14h2' },
  sales:        { colors: ['#4338ca', '#3730a3', '#eae9fa'], icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  purchase:     { colors: ['#16a34a', '#15803d', '#e5f6ea'], icon: 'M3 4h2l2 12h11l2-8H6' },
  employee:     { colors: ['#db2777', '#be185d', '#fbe8f1'], icon: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0' },
  customer:     { colors: ['#9333ea', '#7e22ce', '#f2e8fc'], icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6' },
  reports:      { colors: ['#0369a1', '#075985', '#e3f1f9'], icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6' },
  general:      { colors: ['#64748b', '#475569', '#eef1f4'], icon: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12' },
  promotions:   { colors: ['#e11d48', '#be123c', '#fde8ec'], icon: 'M20 12l-8 8-9-9V3h8z' },
  website:      { colors: ['#0284c7', '#0369a1', '#e2f2fa'], icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18' },
  storefront:   { colors: ['#0d9488', '#0f766e', '#e2f5f3'], icon: 'M3 9l1-5h16l1 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 12v8h14v-8' },
};

/** Security-type filter option (client-side filter over the tree). */
interface SecurityTypeOption {
  labelKey: string;
  value: 'all' | 'cloud' | 'POS';
}

/** Permission-state filter option: every permission, only the enabled / disabled ones, or those changed since the form opened. */
interface StateOption {
  labelKey: string;
  value: 'all' | 'enabled' | 'disabled' | 'modified';
}

/** A single leaf action rendered as one `<app-toggle>`. */
interface ActionVm {
  key: string;
  label: string;
  setting: PrivilegeSetting;
  checked: boolean;
}

type ViewMode = 'list' | 'grid' | 'matrix';

interface ModuleVm { key: string; label: string; count: number; on: number; all: number; }

/** Matrix columns, in display order. An action lands in the first column whose pattern matches its key/name. */
const MATRIX_COLS: { id: string; re: RegExp }[] = [
  { id: 'view',   re: /view|list|read|show|see/ },
  { id: 'add',    re: /add|create|new/ },
  { id: 'edit',   re: /edit|update|modify|save/ },
  { id: 'delete', re: /delete|remove|cancel|void/ },
  { id: 'export', re: /export|print|download/ },
  { id: 'sync',   re: /sync/ },
];
const MATRIX_OTHER = 'other';

interface MxItem { section: PrivilegeSetting; setting: PrivilegeSetting; col: string; }
interface MxCell { items: MxItem[]; state: 'on' | 'off' | 'mixed'; names: string; }
interface MxRow {
  id: string;
  kind: 'module' | 'group' | 'hr' | 'child';
  depth: number;
  label: string;
  collapsible: boolean;
  open: boolean;
  all: MxCell;
  cells: Record<string, MxCell>;
}

/** The nested HR group shown inside Employee Security. */
interface HrInnerVm {
  children: GroupVm[];
  total: number;
  enabled: number;
  allOn: boolean;
  expanded: boolean;
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
  /** Owning module (the group's `securityGroup`), drives the sidebar filter. */
  module: string;
  /** Inner "HR" group — only set on Employee Security. */
  hr: HrInnerVm | null;
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
  imports: [TooltipDirective, NgTemplateOutlet, SegmentedToggleComponent, FormSkeletonComponent,
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
  private modal      = inject(ModalService);

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

  /** Whether any other saved roles exist — gates the "Copy from a role"
   *  button. The picker itself loads roles on demand (server-paginated). */
  savedRoles = signal<RoleOption[]>([]);

  /** Paginated loader for the role picker modal (excludes this record). */
  private roleLoader: PickListLoader = async ({ page, limit, searchTerm }) => {
    const res = await this.service.getPrivilegeList({ page, limit, searchTerm, sortBy: {} });
    const list = Array.isArray(res) ? res : res.list;
    const count = Array.isArray(res) ? res.length : res.count;
    const cur = this.recordId();
    return {
      list: list
        .filter((r: any) => String(r.id) !== String(cur))
        .map((r: any) => ({ id: String(r.id ?? ''), name: r.name ?? '' })),
      count,
    };
  };

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

  stateOptions: StateOption[] = [
    { labelKey: 'EMPLOYEES.PRIVILEGES.FILTER_STATE_ALL',      value: 'all' },
    { labelKey: 'EMPLOYEES.PRIVILEGES.FILTER_STATE_ENABLED',  value: 'enabled' },
    { labelKey: 'EMPLOYEES.PRIVILEGES.FILTER_STATE_DISABLED', value: 'disabled' },
    { labelKey: 'EMPLOYEES.PRIVILEGES.FILTER_STATE_MODIFIED', value: 'modified' },
  ];
  permissionState = signal<StateOption>(this.stateOptions[0]);
  displayState = (o: StateOption): string => this.translate.instant(o.labelKey);

  /** What every action's access was when the form opened (`group.action` -> on/off), the reference for "Modified". */
  private baseline = new Map<string, boolean>();
  private captureBaseline(): void {
    this.baseline.clear();
    const ep = this.record();
    if (!ep) return;
    for (const key in ep.privileges) {
      const section = ep.privileges[key] as PrivilegeSetting;
      if (!section?.actions) continue;
      for (const ak in section.actions) this.baseline.set(`${key}.${ak}`, section.actions[ak].access === true);
    }
  }

  /**
   * System roles (Super Admin / Owner) are all-access by definition and cannot
   * be edited: a stray toggle here would lock the account owner out of a
   * feature. Decided ONLY from the server-set `systemKey` the record loaded
   * with — never from a name, which anyone can edit. This is UX; the server
   * rejects the save with a 403 regardless.
   */
  readonly lockedRole = signal(false);

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

  // ── Modules sidebar (mirrors the legacy form's grouping by securityGroup) ──
  moduleKey    = signal<string>('all');
  moduleSearch = signal<string>('');

  /**
   * Builds one group card's view model, or null when the security / state /
   * search filters hide it. `force` skips the search + state filters (used for
   * a parent whose inner HR group matched instead of the parent itself).
   */
  private buildGroup(
    ep: EmployeePrivilege,
    key: string,
    ctx: { term: string; secType: string; state: string; openSet: Set<string> },
    force = false,
  ): GroupVm | null {
    const section = ep.privileges[key] as PrivilegeSetting;
    if (!section || typeof section.ToJson !== 'function') return null;
    const { term, secType, state, openSet } = ctx;
    const secOk = (t: string | undefined): boolean =>
      secType === 'all' || t === secType || t === 'common';

    const label = section.name || key;
    const groupMatches =
      !term ||
      label.toLowerCase().includes(term) ||
      key.toLowerCase().includes(term) ||
      // Searching "hr" / "human resources" finds every HR group.
      (HR_INNER_KEYS.includes(key) && ('hr'.startsWith(term) || 'human resources'.startsWith(term)));

    const secActions: PrivilegeSetting[] = [];
    const visible: ActionVm[] = [];
    if (section.actions) {
      for (const ak in section.actions) {
        const a = section.actions[ak];
        if (!secOk(a.securityType)) continue;
        secActions.push(a);
        const aLabel = a.name || ak;
        const on = a.access === true;
        const stateOk = state === 'all' || (state === 'enabled' && on) || (state === 'disabled' && !on)
          || (state === 'modified' && on !== (this.baseline.get(`${key}.${ak}`) ?? false));
        if (stateOk && (groupMatches || aLabel.toLowerCase().includes(term))) {
          visible.push({ key: ak, label: aLabel, setting: a, checked: a.access === true });
        }
      }
    }

    const hasActions   = secActions.length > 0;
    const sectionSecOk = secOk(section.securityType) || hasActions;
    const searchOk     = force || ((groupMatches || visible.length > 0) && (state === 'all' || visible.length > 0));
    if (!sectionSecOk || !searchOk) return null;

    const enabled = secActions.reduce((n, a) => (a.access === true ? n + 1 : n), 0);
    return {
      key,
      label,
      module: section.securityGroup || 'general',
      section,
      actions: visible,
      totalActions: secActions.length,
      enabledActions: enabled,
      hasActions,
      allOn: hasActions && enabled === secActions.length,
      sectionChecked: section.access === true,
      expanded: openSet.has(key),
      hr: null,
    };
  }

  /**
   * The view model — one entry per top-level security group, filtered by the
   * active module, security-type dropdown, state and search box. The HR groups
   * are NOT top-level: they render as an inner "HR" group inside Employee
   * Security. This is presentation only — the saved JSON is unchanged.
   */
  groups = computed<GroupVm[]>(() => {
    this.treeVersion();
    this.i18nTick();
    const ep = this.record();
    if (!ep) return [];

    const ctx = {
      term: this.search().trim().toLowerCase(),
      secType: this.securityType().value as string,
      state: this.permissionState().value as string,
      openSet: this.expanded(),
    };
    const module = this.moduleKey();
    const out: GroupVm[] = [];

    for (const key in ep.privileges) {
      if (HR_INNER_KEYS.includes(key)) continue;
      let vm = this.buildGroup(ep, key, ctx);

      if (key === HR_PARENT_KEY) {
        const children = HR_INNER_KEYS
          .map(k => this.buildGroup(ep, k, ctx))
          .filter((c): c is GroupVm => !!c);
        if (children.length) {
          vm ??= this.buildGroup(ep, key, ctx, true);
          if (vm) {
            const total = children.reduce((n, c) => n + c.totalActions, 0);
            const on = children.reduce((n, c) => n + c.enabledActions, 0);
            vm.hr = {
              children, total, enabled: on,
              allOn: total > 0 && on === total,
              expanded: ctx.openSet.has(HR_INNER_ID) || !!ctx.term,
            };
          }
        }
      }

      if (vm && (module === 'all' || this.viewMode() === 'matrix' || vm.module === module)) out.push(vm);
    }
    return out;
  });

  /** Sidebar entries: every module that has at least one group, with counts. */
  modules = computed<ModuleVm[]>(() => {
    this.i18nTick();
    const ep = this.record();
    if (!ep) return [];
    const counts = new Map<string, number>();
    const acts = new Map<string, { on: number; all: number }>();
    let total = 0;
    for (const key in ep.privileges) {
      const s = ep.privileges[key] as PrivilegeSetting;
      if (!s || typeof s.ToJson !== 'function') continue;
      const m = s.securityGroup || 'general';
      counts.set(m, (counts.get(m) ?? 0) + 1);
      total++;
      const a = acts.get(m) ?? { on: 0, all: 0 };
      const list = s.actions ? Object.values(s.actions) : [s];
      a.all += list.length;
      a.on += list.filter(x => x.access === true).length;
      acts.set(m, a);
    }
    const ordered = [
      ...MODULE_ORDER.filter(m => counts.has(m)),
      ...[...counts.keys()].filter(m => !MODULE_ORDER.includes(m)).sort(),
    ];
    const term = this.moduleSearch().trim().toLowerCase();
    const list = [
      { key: 'all', label: this.moduleLabel('all'), count: total, on: 0, all: 0 },
      ...ordered.map(m => ({
        key: m, label: this.moduleLabel(m), count: counts.get(m)!,
        on: acts.get(m)!.on, all: acts.get(m)!.all,
      })),
    ];
    return list.filter(m => !term || m.label.toLowerCase().includes(term));
  });

  private moduleLabel(key: string): string {
    if (key === 'all') return 'All';
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  selectModule(key: string): void { this.moduleKey.set(key); }

  currentModule = computed(() => this.modules().find(m => m.key === this.moduleKey()) ?? null);

  /** [from, to, tint] colours per module — mirrors the Reports topic tiles. */
  moduleColors(key: string): [string, string, string] {
    return MODULE_STYLE[key]?.colors ?? ['#0e8fa3', '#0b6f80', '#e6f6f9'];
  }

  /** Feather-style icon path per module. */
  moduleIcon(key: string): string {
    return MODULE_STYLE[key]?.icon ?? 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z';
  }

  // ── Views (display only — the data tree is the same in every view) ──────
  readonly viewOptions: SegmentedToggleOption<ViewMode>[] = [
    { value: 'list',  label: 'EMPLOYEES.PRIVILEGES.VIEW_LIST' },
    { value: 'grid',  label: 'EMPLOYEES.PRIVILEGES.VIEW_GRID' },
    { value: 'matrix', label: 'EMPLOYEES.PRIVILEGES.VIEW_MATRIX' },
  ];
  viewMode = signal<ViewMode>(this.readView());

  setView(v: ViewMode): void {
    this.viewMode.set(v);
    try { localStorage.setItem('privilege-form.view', v); } catch { /* storage unavailable */ }
  }

  private readView(): ViewMode {
    try {
      const v = localStorage.getItem('privilege-form.view');
      if (v === 'list' || v === 'grid' || v === 'matrix') return v;
    } catch { /* storage unavailable */ }
    return 'list';
  }

  // ── Matrix view: rows = module / group / inner group, columns = action kind ──
  private mxCollapsed = signal<Set<string>>(new Set<string>());

  private classify(key: string, label: string): string {
    const v = `${key} ${label}`.toLowerCase();
    return MATRIX_COLS.find(c => c.re.test(v))?.id ?? MATRIX_OTHER;
  }

  private mxCell(items: MxItem[]): MxCell {
    const on = items.filter(i => i.setting.access === true).length;
    return {
      items,
      state: !items.length || on === 0 ? 'off' : on === items.length ? 'on' : 'mixed',
      names: items.map(i => i.setting.name).join(', '),
    };
  }

  private mxRow(
    id: string, kind: MxRow['kind'], depth: number, label: string,
    collapsible: boolean, open: boolean, items: MxItem[],
  ): MxRow {
    const cells: Record<string, MxCell> = {};
    for (const c of [...MATRIX_COLS.map(c => c.id), MATRIX_OTHER]) {
      cells[c] = this.mxCell(items.filter(i => i.col === c));
    }
    return { id, kind, depth, label, collapsible, open, all: this.mxCell(items), cells };
  }

  /** Flattened, display-only rows. Built from the same filtered groups as the other views. */
  matrix = computed<{ cols: string[]; rows: MxRow[] }>(() => {
    const groups = this.groups();
    const collapsed = this.mxCollapsed();
    const itemsOf = (g: GroupVm): MxItem[] =>
      g.actions.map(a => ({ section: g.section, setting: a.setting, col: this.classify(a.key, a.label) }));

    const byModule = new Map<string, GroupVm[]>();
    for (const g of groups) byModule.set(g.module, [...(byModule.get(g.module) ?? []), g]);
    const order = [
      ...MODULE_ORDER.filter(m => byModule.has(m)),
      ...[...byModule.keys()].filter(m => !MODULE_ORDER.includes(m)).sort(),
    ];

    const rows: MxRow[] = [];
    for (const mod of order) {
      const gs = byModule.get(mod)!;
      const modItems = gs.flatMap(g => [...itemsOf(g), ...(g.hr ? g.hr.children.flatMap(itemsOf) : [])]);
      const open = !collapsed.has(mod);
      rows.push(this.mxRow('m:' + mod, 'module', 0, this.moduleLabel(mod), true, open, modItems));
      if (!open) continue;
      for (const g of gs) {
        rows.push(this.mxRow('g:' + g.key, 'group', 1, g.label, false, false, itemsOf(g)));
        if (!g.hr) continue;
        const hrOpen = g.hr.expanded;
        rows.push(this.mxRow('hr', 'hr', 2, this.translate.instant('EMPLOYEES.PRIVILEGES.HR_GROUP'),
          true, hrOpen, g.hr.children.flatMap(itemsOf)));
        if (hrOpen) {
          for (const c of g.hr.children) rows.push(this.mxRow('g:' + c.key, 'child', 3, c.label, false, false, itemsOf(c)));
        }
      }
    }
    const used = new Set(rows.flatMap(r => r.all.items.map(i => i.col)));
    const cols = [...MATRIX_COLS.map(c => c.id), MATRIX_OTHER].filter(c => used.has(c));
    return { cols, rows };
  });

  colLabel(id: string): string {
    return this.translate.instant('EMPLOYEES.PRIVILEGES.COL_' + id.toUpperCase());
  }

  toggleRow(row: MxRow): void {
    if (row.kind === 'module') {
      const key = row.id.slice(2);
      this.mxCollapsed.update(set => {
        const next = new Set(set);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    } else if (row.kind === 'hr') {
      this.toggleExpand('__hr__');
    }
  }

  /** Set every action in a matrix cell, then reconcile each affected group's access. */
  onCellToggle(cell: MxCell, value: boolean): void {
    if (this.lockedRole() || !cell.items.length) return;
    const sections = new Set<PrivilegeSetting>();
    for (const i of cell.items) {
      i.setting.access = value;
      sections.add(i.section);
    }
    sections.forEach(sec => this.syncSectionAccess(sec));
    this.markChanged();
  }
  onModuleSearch(value: string): void { this.moduleSearch.set(value); }

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

  /** True when every action of every HR group is enabled (drives the "Full HR access" toggle). */
  allHrOn = computed<boolean>(() => {
    this.treeVersion();
    const ep = this.record();
    if (!ep) return false;
    return HR_INNER_KEYS.every(key => {
      const section = ep.privileges[key] as PrivilegeSetting | undefined;
      if (!section || typeof section.ToJson !== 'function') return true;
      return section.actions
        ? Object.values(section.actions).every(a => a.access === true)
        : section.access === true;
    });
  });

  /** Flip every HR group + action at once — including the sensitive pay/bank/appeal grants. */
  onSelectAllHr(value: boolean): void {
    if (this.lockedRole()) return;
    const ep = this.record();
    if (!ep) return;
    for (const key of HR_INNER_KEYS) {
      const section = ep.privileges[key] as PrivilegeSetting | undefined;
      if (!section || typeof section.ToJson !== 'function') continue;
      section.access = value;
      if (section.actions) {
        for (const ak in section.actions) section.actions[ak].access = value;
      }
    }
    this.markChanged();
  }

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
      const [, ] = await Promise.all([
        this.loadSavedRoles(id),
        (async () => {
          if (!id || id === '0') {
            // New record — a fresh EmployeePrivilege carries the full catalog
            // with every action defaulting to "off".
            this.record.set(new EmployeePrivilege());
            this.captureBaseline();
          } else {
            const ep = await this.service.getPrivilege(id);
            // All-access roles: force every group + action on, including ones
            // added to the catalog after the profile was first saved. Done by
            // walking the whole tree, not a hand-kept list of group keys.
            if (ep.systemKey) {
              this.lockedRole.set(true);
              this.forceAllOn(ep);
            }
            this.record.set(ep);
            this.captureBaseline();
            this.name.set(ep.name ?? '');
            this.description.set(ep.description ?? '');
          }
        })(),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  /** Load the existing saved privilege sets for the "clone from" dropdown
   *  (excluding the record currently being edited). */
  private async loadSavedRoles(currentId: string | null): Promise<void> {
    try {
      const res = await this.service.getPrivilegeList({ page: 1, limit: 1000, searchTerm: '', sortBy: {} });
      const list = Array.isArray(res) ? res : res.list;
      this.savedRoles.set(
        list
          .filter((r: any) => String(r.id) !== String(currentId))
          .map((r: any) => ({ id: String(r.id ?? ''), name: r.name ?? '' })),
      );
    } catch {
      this.savedRoles.set([]);
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

  /** Open the role picker popup; clone the chosen role into the current tree. */
  async openRolePicker(): Promise<void> {
    if (this.lockedRole()) return; // all-access roles are not editable
    const ref = this.modal.open<PickListModalComponent, PickListModalData, PickListModalResult>(
      PickListModalComponent,
      {
        size: 'lg',
        data: {
          load: this.roleLoader,
          multiple: false,
          title: this.translate.instant('EMPLOYEES.PRIVILEGES.COPY_FROM_ROLE_TITLE'),
        },
      },
    );
    const res = await ref.afterClosed();
    const picked = res?.selected?.[0];
    if (picked) await this.applyPreset({ id: picked.id, name: picked.name });
  }

  /**
   * Clone the permission values from an existing saved role into the current
   * tree (mirrors the legacy "start from a role" dropdown). Overlays the
   * source's access map via ParseJson so every group/action takes the source's
   * on/off state; the current record's name/description are left untouched.
   */
  async applyPreset(role: RoleOption | null): Promise<void> {
    const ep = this.record();
    if (!role || !ep) return;
    this.loading.set(true);
    try {
      const src = await this.service.getPrivilege(role.id);
      ep.privileges.ParseJson(src.privileges.ToJson());
      ep.presetKey = role.id;
      this.markChanged();
    } finally {
      this.loading.set(false);
    }
  }

  private forceAllOn(ep: EmployeePrivilege): void {
    for (const key in ep.privileges) {
      const section = ep.privileges[key] as PrivilegeSetting;
      if (!section || typeof section.ToJson !== 'function') continue;
      section.access = true;
      if (section.actions) {
        for (const ak in section.actions) section.actions[ak].access = true;
      }
    }
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  onStateChange(option: StateOption | null): void {
    if (option) this.permissionState.set(option);
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
    if (this.lockedRole()) return;
    action.access = value;
    this.syncSectionAccess(section);
    this.markChanged();
  }

  /** Per-group "select all" — flips every action in the group. */
  onSelectAll(section: PrivilegeSetting, value: boolean): void {
    if (this.lockedRole()) return;
    if (section.actions) {
      for (const ak in section.actions) section.actions[ak].access = value;
    }
    section.access = value;
    this.markChanged();
  }

  /** Header toggle for an action-less group binds straight to its access. */
  onSectionToggle(section: PrivilegeSetting, value: boolean): void {
    if (this.lockedRole()) return;
    section.access = value;
    this.markChanged();
  }

  /** Master select-all — cascade to EVERY group and action in the tree. */
  onSelectAllGroups(value: boolean): void {
    if (this.lockedRole()) return;
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
    if (!ep || this.lockedRole()) return;

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
      if (e?.status === 403) {
        this.toast.error('EMPLOYEES.PRIVILEGES.SYSTEM_ROLE_LOCKED');
      } else {
        this.toast.error('COMMON.SAVE_FAILED', e?.message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/employees/privileges']);
  }

  /** Open the role's default-dashboard editor (existing records only). */
  customizeDashboard(): void {
    const id = this.recordId();
    if (!id || id === '0') return;
    this.router.navigate(['/employees/privileges', id, 'dashboard']);
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.saving();
  }
}
