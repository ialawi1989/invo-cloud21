import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { Privilege } from '@core/auth/privileges/models/privilege.model';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ParamDef, QueryParamsService, StringCodec, enumCodec } from '@shared/services/query-params.service';
import { ReportEmptyComponent } from '../../components/report-empty/report-empty.component';
import { ReportErrorComponent } from '../../components/report-error/report-error.component';
import { ReportSkeletonComponent } from '../../components/report-skeleton/report-skeleton.component';
import { ReportApiFilter } from '../../models/report.model';
import { EmployeePrivilegesService, EmployeeRoleRow, PrivilegeRow } from './employee-privileges.service';

type View = 'emp' | 'perm';

/**
 * The selection lives in the URL (so a refresh or shared link opens the same view, and the shared Export button knows what to export):
 * `view`, `emp` = employee id, `role` / `rn` = that employee's privilege id / name, `sec` + `act` = the permission of "By permission".
 */
const PARAMS = {
  view: { key: 'view', codec: enumCodec<View>(['emp', 'perm'], 'emp') } as ParamDef<View>,
  emp: { key: 'emp', codec: StringCodec } as ParamDef<string>,
  role: { key: 'role', codec: StringCodec } as ParamDef<string>,
  rn: { key: 'rn', codec: StringCodec } as ParamDef<string>,
  sec: { key: 'sec', codec: StringCodec } as ParamDef<string>,
  act: { key: 'act', codec: StringCodec } as ParamDef<string>,
};

/** One pickable permission of the "By permission" view (from the same registry the privilege form edits). */
interface PermOption { key: string; securityKey: string; actionKey: string; group: string; label: string; }

/** A group tile of an employee's access summary. */
interface GroupTile { key: string; name: string; count: number; }

/**
 * Employee Privileges Report: the employees and their privilege role on one side; for the chosen employee the permissions the role
 * grants (grouped, searchable, filterable by group) — and, in "By permission", who holds one permission and through which role.
 */
@Component({
  selector: 'app-employee-privileges',
  standalone: true,
  imports: [TranslateModule, PaginationComponent, SearchDropdownComponent, SegmentedToggleComponent, ReportEmptyComponent, ReportErrorComponent, ReportSkeletonComponent],
  templateUrl: './employee-privileges.component.html',
  styleUrl: './employee-privileges.component.scss',
})
export class EmployeePrivilegesComponent {
  private svc = inject(EmployeePrivilegesService);
  private lang = inject(LanguageService);
  private urlState = inject(QueryParamsService);

  /** The shell's filter (this report has none) and its Refresh tick. */
  filter = input<ReportApiFilter>({});
  refresh = input(0);

  readonly sizes = [10, 15, 25, 50];
  view = signal<View>('emp');
  loading = signal(false);
  error = signal<string | null>(null);
  employees = signal<EmployeeRoleRow[]>([]);

  // By employee
  search = signal('');
  roleFilter = signal<string | null>(null);
  page = signal(1);
  pageSize = signal(15);
  selectedId = signal('');
  perms = signal<PrivilegeRow[]>([]);
  /** How many permissions can be granted in total (0 when the backend doesn't say). */
  permTotal = signal(0);
  permsLoading = signal(false);
  permsError = signal<string | null>(null);
  group = signal('');
  permSearch = signal('');

  // By permission
  permKey = signal('');
  holders = signal<PrivilegeRow[]>([]);
  holdersLoading = signal(false);
  holdersError = signal<string | null>(null);

  private seq = 0;
  private permsSeq = 0;
  private holdersSeq = 0;

  readonly viewOptions: SegmentedToggleOption<View>[] = [
    { value: 'emp', label: 'REPORTS.EMP_PRIV.BY_EMPLOYEE' },
    { value: 'perm', label: 'REPORTS.EMP_PRIV.BY_PERMISSION' },
  ];

  /** Every permission that can be granted, by group — the picker of "By permission". */
  readonly permOptions: PermOption[] = (() => {
    const out: PermOption[] = [];
    const tree = new Privilege() as Record<string, any>;
    for (const [securityKey, g] of Object.entries(tree)) {
      if (typeof g === 'function' || !g?.actions) continue;
      for (const [actionKey, a] of Object.entries<any>(g.actions)) {
        out.push({ key: `${securityKey}|${actionKey}`, securityKey, actionKey, group: g.name || securityKey, label: a.name || actionKey });
      }
    }
    return out.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  })();
  permGroupBy = (o: PermOption) => o.group;
  permLabel = (o: PermOption) => o.label;
  permCompare = (a: PermOption, b: PermOption) => a?.key === b?.key;
  permValue = computed(() => this.permOptions.find(o => o.key === this.permKey()) ?? null);

  roleItems = computed(() => [...new Set(this.employees().map(e => e.privilegeName).filter(Boolean))].sort((a, b) => a.localeCompare(b)));

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase(); const r = this.roleFilter();
    return this.employees()
      .filter(e => (!r || e.privilegeName === r) && (!q || e.employeeName?.toLowerCase().includes(q) || e.privilegeName?.toLowerCase().includes(q)))
      .sort((a, b) => (a.employeeName ?? '').localeCompare(b.employeeName ?? ''));
  });
  pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  pageRows = computed(() => { const s = (this.page() - 1) * this.pageSize(); return this.filtered().slice(s, s + this.pageSize()); });

  selected = computed(() => this.employees().find(e => e.employeeId === this.selectedId()) ?? null);
  /** Employees on the same role as the chosen one (the chosen included). */
  sharedBy = computed(() => { const s = this.selected(); return s ? this.employees().filter(e => e.privilegeId === s.privilegeId).length : 0; });

  tiles = computed<GroupTile[]>(() => {
    const m = new Map<string, GroupTile>();
    for (const p of this.perms()) {
      const key = this.groupKey(p);
      const t = m.get(key) ?? { key, name: p.securityName || key, count: 0 };
      t.count++; m.set(key, t);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
  visiblePerms = computed(() => {
    const g = this.group(); const q = this.permSearch().trim().toLowerCase();
    return this.perms()
      .filter(p => (!g || this.groupKey(p) === g) && (!q || (p.privilegeName ?? '').toLowerCase().includes(q) || (p.securityName ?? '').toLowerCase().includes(q)))
      .sort((a, b) => (a.securityName ?? '').localeCompare(b.securityName ?? '') || (a.privilegeName ?? '').localeCompare(b.privilegeName ?? ''));
  });

  sortedHolders = computed(() => [...this.holders()].sort((a, b) => (a.employeeName ?? '').localeCompare(b.employeeName ?? '')));

  constructor() {
    const u = this.urlState.read(PARAMS);
    this.view.set(u.view);
    this.selectedId.set(u.emp);
    this.permKey.set(u.sec && u.act ? `${u.sec}|${u.act}` : '');
    effect(() => {
      this.refresh();
      untracked(() => { this.svc.clearCache(); void this.load(); });
    });
  }

  async load(): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.svc.employees();
      if (mine !== this.seq) return;
      this.employees.set(rows);
      // the first employee opens by itself when none (or an unknown one) is in the URL
      if (this.view() === 'emp') {
        const keep = rows.some(e => e.employeeId === this.selectedId());
        const first = [...rows].sort((a, b) => (a.employeeName ?? '').localeCompare(b.employeeName ?? ''))[0];
        this.select(keep ? this.selectedId() : (first?.employeeId ?? ''));
      }
      if (this.permKey()) void this.loadHolders();
    } catch (e: any) {
      if (mine !== this.seq) return;
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.employees.set([]);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  setView(v: View): void { this.view.set(v); this.sync(); if (v === 'perm' && this.permKey()) void this.loadHolders(); }

  select(id: string): void {
    if (id !== this.selectedId()) { this.group.set(''); this.permSearch.set(''); }
    this.selectedId.set(id);
    this.sync();
    void this.loadPerms();
  }

  async loadPerms(): Promise<void> {
    const s = this.selected();
    const mine = ++this.permsSeq;
    this.permsError.set(null);
    if (!s) { this.perms.set([]); return; }
    this.permsLoading.set(true);
    try {
      const r = await this.svc.rolePermissions(s.privilegeId);
      if (mine === this.permsSeq) { this.perms.set(r.rows); this.permTotal.set(r.total); }
    } catch (e: any) {
      if (mine !== this.permsSeq) return;
      this.permsError.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.perms.set([]);
    } finally {
      if (mine === this.permsSeq) this.permsLoading.set(false);
    }
  }

  pickPermission(o: PermOption | null): void {
    this.permKey.set(o?.key ?? '');
    this.sync();
    if (o) void this.loadHolders(); else this.holders.set([]);
  }

  async loadHolders(): Promise<void> {
    const o = this.permValue();
    const mine = ++this.holdersSeq;
    this.holdersError.set(null);
    if (!o) { this.holders.set([]); return; }
    this.holdersLoading.set(true);
    try {
      const rows = await this.svc.holders(o.securityKey, o.actionKey);
      if (mine === this.holdersSeq) this.holders.set(rows);
    } catch (e: any) {
      if (mine !== this.holdersSeq) return;
      this.holdersError.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.holders.set([]);
    } finally {
      if (mine === this.holdersSeq) this.holdersLoading.set(false);
    }
  }

  /** Open a holder in "By employee" (the row carries a name and role, not an id). */
  jumpTo(h: PrivilegeRow): void {
    const e = this.employees().find(x => h.employeeId ? x.employeeId === h.employeeId : (x.employeeName === h.employeeName && x.privilegeName === h.roleName));
    if (!e) return;
    this.view.set('emp');
    this.search.set(''); this.roleFilter.set(null);
    this.select(e.employeeId);
  }

  groupKey(p: PrivilegeRow): string { return p.securityKey || p.securityName || '-'; }
  toggleGroup(key: string): void { this.group.set(this.group() === key ? '' : key); }
  setSearch(v: string): void { this.search.set(v); this.page.set(1); }
  setRole(v: string | null): void { this.roleFilter.set(v); this.page.set(1); }
  goTo(p: number): void { this.page.set(p); }
  setPageSize(n: number): void { this.pageSize.set(n); this.page.set(1); }
  initial(n: string): string { return (n || '?').charAt(0).toUpperCase(); }

  private sync(): void {
    const s = this.selected(); const o = this.permValue();
    this.urlState.write(PARAMS, {
      view: this.view(),
      emp: s?.employeeId ?? '', role: s?.privilegeId ?? '', rn: s?.privilegeName ?? '',
      sec: o?.securityKey ?? '', act: o?.actionKey ?? '',
    });
  }
}
