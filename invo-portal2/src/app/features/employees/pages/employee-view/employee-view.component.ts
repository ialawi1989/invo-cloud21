import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { LayoutService } from '@core/layout/services/layout.service';
import { withTranslations } from '@core/i18n/with-translations';
import { DocViewShellComponent } from '@features/account/components/doc-view-shell/doc-view-shell.component';
import type { DocRailItem } from '@features/account/services/document-view-base';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeOverviewComponent } from '../employee-overview/employee-overview.component';

/**
 * View employee — a read-only record page in the same three-pane layout as the
 * customer view: searchable employee rail on the left, name + actions on top,
 * the record's cards in the body.
 *
 * It is an ADDITIONAL page: opening an employee from the list still goes
 * straight to the form. Everything shown is the existing overview (cards with a
 * pencil per section that opens the focused editor), embedded rather than
 * rebuilt so the two can never disagree about what is on file.
 */
@Component({
  selector: 'app-employee-view',
  standalone: true,
  imports: [TranslateModule, DocViewShellComponent, EmployeeOverviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-view.component.html',
  styleUrl: './employee-view.component.scss',
  // The shell must be the effective flex child of the no-padding main area.
  host: { style: 'display: contents' },
})
export class EmployeeViewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(EmployeeService);
  private readonly layout = inject(LayoutService);
  private readonly privileges = inject(PrivilegeService);

  readonly canAdd = this.privileges.check('employeeSecurity.actions.add.access');

  readonly employeeId = signal<string>('');
  readonly name = signal<string>('');
  readonly terminated = signal<boolean>(false);

  readonly railPageSize = 15;
  readonly railItems = signal<DocRailItem[]>([]);
  readonly railLoading = signal(false);
  readonly railPage = signal(1);
  readonly railPageCount = signal(1);
  readonly railTerm = signal('');
  private railSeq = 0;
  private railTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    withTranslations('employees');
    // The rail re-points the same component at another id — follow the param.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.employeeId.set(p.get('id') ?? '');
      void this.loadHeader();
    });
  }

  ngOnInit(): void {
    this.layout.setNoPadding(true);
    void this.loadRail(1);
  }

  ngOnDestroy(): void {
    this.layout.setNoPadding(false);
    if (this.railTimer) clearTimeout(this.railTimer);
  }

  private async loadHeader(): Promise<void> {
    const id = this.employeeId();
    this.name.set('');
    if (!id) return;
    const rec = await this.service.getOne(id);
    if (id !== this.employeeId()) return; // a faster click already moved on
    this.name.set(rec?.name ?? '');
    this.terminated.set(!!rec?.terminationDate);
  }

  async loadRail(page: number): Promise<void> {
    const seq = ++this.railSeq;
    this.railLoading.set(true);
    try {
      const data = await this.service.getList({
        page, limit: this.railPageSize, searchTerm: this.railTerm(),
        sortBy: { sortValue: 'name', sortDirection: 'asc' },
      });
      if (seq !== this.railSeq) return;
      this.railItems.set((data.list ?? []).map((r): DocRailItem => ({
        id: r.id,
        primary: r.name,
        amountLabel: '',
        sub: r.email || '',
        data: r,
      })));
      this.railPage.set(page);
      this.railPageCount.set(Math.max(1, data.pageCount || 1));
    } finally {
      if (seq === this.railSeq) this.railLoading.set(false);
    }
  }

  onRailSearch(term: string): void {
    if (this.railTimer) clearTimeout(this.railTimer);
    this.railTimer = setTimeout(() => { this.railTerm.set(term); void this.loadRail(1); }, 300);
  }
  railPrev(): void { if (this.railPage() > 1) void this.loadRail(this.railPage() - 1); }
  railNext(): void { if (this.railPage() < this.railPageCount()) void this.loadRail(this.railPage() + 1); }

  railGoTo(item: DocRailItem): void {
    const invited = !!item.data?.isInvitedUser;
    void this.router.navigate(invited ? ['/employees/invitation', item.id] : ['/employees/view', item.id]);
  }

  goToList(): void { void this.router.navigate(['/employees']); }
  add(): void { void this.router.navigate(['/employees', 0]); }
  edit(): void { void this.router.navigate(['/employees', this.employeeId(), 'edit']); }
  terminate(): void { void this.router.navigate(['/employees', this.employeeId(), 'end-of-service']); }
}
