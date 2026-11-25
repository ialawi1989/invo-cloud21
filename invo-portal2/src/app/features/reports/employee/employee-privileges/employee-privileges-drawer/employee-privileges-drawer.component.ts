import { Component, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';
import { MODAL_DATA } from '@shared/modal/modal.tokens';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ReportErrorComponent } from '../../../components/report-error/report-error.component';
import { ReportSkeletonComponent } from '../../../components/report-skeleton/report-skeleton.component';
import { EmployeePrivilegesService, EmployeeRoleRow, PrivilegeRow } from '../employee-privileges.service';

export interface EmployeePrivilegesDrawerData {
  employee: EmployeeRoleRow;
  /** How many employees are on the same role (the chosen one included). */
  sharedBy: number;
}

/** A group tile of the access summary. */
interface GroupTile { key: string; name: string; count: number; }

/**
 * One employee's access, in a side drawer: the role, and the permissions it grants — grouped, searchable, and filterable by group.
 * Opened from the Employee Privileges Report so the list page stays short.
 */
@Component({
  selector: 'app-employee-privileges-drawer',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent, ReportErrorComponent, ReportSkeletonComponent],
  templateUrl: './employee-privileges-drawer.component.html',
  styleUrl: './employee-privileges-drawer.component.scss',
})
export class EmployeePrivilegesDrawerComponent {
  private svc = inject(EmployeePrivilegesService);
  private lang = inject(LanguageService);
  readonly data = inject<EmployeePrivilegesDrawerData>(MODAL_DATA);

  perms = signal<PrivilegeRow[]>([]);
  /** How many permissions can be granted in total (0 when the backend doesn't say). */
  total = signal(0);
  loading = signal(true);
  error = signal<string | null>(null);
  group = signal('');
  search = signal('');

  tiles = computed<GroupTile[]>(() => {
    const m = new Map<string, GroupTile>();
    for (const p of this.perms()) {
      const key = this.groupKey(p);
      const t = m.get(key) ?? { key, name: p.securityName || key, count: 0 };
      t.count++; m.set(key, t);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  /** The selected group as the dropdown's item (null = all groups). */
  groupValue = computed(() => this.tiles().find(t => t.key === this.group()) ?? null);
  groupLabel = (t: GroupTile) => `${t.name} (${t.count})`;
  groupCompare = (a: GroupTile, b: GroupTile) => a?.key === b?.key;

  visible = computed(() => {
    const g = this.group(); const q = this.search().trim().toLowerCase();
    return this.perms()
      .filter(p => (!g || this.groupKey(p) === g) && (!q || (p.privilegeName ?? '').toLowerCase().includes(q) || (p.securityName ?? '').toLowerCase().includes(q)))
      .sort((a, b) => (a.securityName ?? '').localeCompare(b.securityName ?? '') || (a.privilegeName ?? '').localeCompare(b.privilegeName ?? ''));
  });

  constructor() { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await this.svc.rolePermissions(this.data.employee.privilegeId);
      this.perms.set(r.rows);
      this.total.set(r.total);
    } catch (e: any) {
      this.error.set(e?.message ?? this.lang.instant('REPORTS.VIEW.LOAD_ERROR'));
      this.perms.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  groupKey(p: PrivilegeRow): string { return p.securityKey || p.securityName || '-'; }
  setGroup(t: GroupTile | null): void { this.group.set(t?.key ?? ''); }
  initial(n: string): string { return (n || '?').charAt(0).toUpperCase(); }
}
