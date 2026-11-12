import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal/modal.service';
import {
  ConfirmModalComponent,
  ConfirmModalData,
} from '@shared/modal/demo/confirm-modal.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ReportsFavoritesService } from '../../../services/reports-favorites.service';
import { ReportEmptyComponent } from '../../../components/report-empty/report-empty.component';
import { ReportErrorComponent } from '../../../components/report-error/report-error.component';
import { ReportSkeletonComponent } from '../../../components/report-skeleton/report-skeleton.component';
import { CustomReportsService } from '../../services/custom-reports.service';
import { ReportV2Service } from '../../services/report-v2.service';
import {
  customReportsEditPrivilegeFullKey,
  customReportsViewPrivilegeFullKey,
} from '../../custom-reports.privileges';

/** One saved custom report in the list (a v2 spec or an old-builder module). */
export interface CustomReportRow {
  /** Spec UUID, or the old module's id. Also the favourites key and the route id. */
  slug: string;
  name: string;
  /** Saved by the previous builder (modules list); moved to v2 when next saved. */
  legacy: boolean;
  /** `yyyy-MM-dd HH:mm`, as the legacy list showed it. */
  updated: string;
}

/**
 * The saved custom reports list — the legacy reports page's "Custom Report" tab
 * (select all, favourites star, edit, delete, "Previous builder" tag, Add
 * Report, AI access tokens). Same data flow as the legacy: v2 specs plus
 * old-builder modules, either failing without hiding the other.
 */
@Component({
  selector: 'app-custom-reports-list',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    ReportEmptyComponent,
    ReportErrorComponent,
    ReportSkeletonComponent,
  ],
  templateUrl: './custom-reports-list.component.html',
  styleUrl: './custom-reports-list.component.scss',
})
export class CustomReportsListComponent implements OnInit {
  private router = inject(Router);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private privileges = inject(PrivilegeService);
  private favs = inject(ReportsFavoritesService);
  private reportsV2 = inject(ReportV2Service);
  private legacyApi = inject(CustomReportsService);

  /** Edit implies View (legacy canViewCustomReports). */
  get canView(): boolean {
    return (
      (this.privileges.check(customReportsViewPrivilegeFullKey) ||
        this.privileges.check(customReportsEditPrivilegeFullKey))
    );
  }
  get canEdit(): boolean {
    return this.privileges.check(customReportsEditPrivilegeFullKey);
  }

  reports = signal<CustomReportRow[]>([]);
  loaded = signal(false);
  /** Set when the v2 list failed and there is nothing from the old builder to show instead. */
  loadError = signal<string | null>(null);
  selected = signal<ReadonlySet<string>>(new Set());
  bulkDeleting = signal(false);

  allSelected = computed(() => {
    const all = this.reports();
    return all.length > 0 && all.every((r) => this.selected().has(r.slug));
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loaded.set(false);
    this.loadError.set(null);
    this.reports.set([]);
    try {
      // v2 specs plus reports still saved by the previous builder (modules);
      // the builder moves an old one to v2 when it's next saved. Either list
      // failing must not hide the other.
      const [specsRes, modulesRes] = await Promise.allSettled([
        this.reportsV2.listSpecs(),
        this.legacyApi.getModules(),
      ]);
      const specs = specsRes.status === 'fulfilled' ? specsRes.value : [];
      const modules = modulesRes.status === 'fulfilled' ? modulesRes.value || [] : [];
      if (specsRes.status === 'rejected') {
        console.error('Error loading v2 reports:', specsRes.reason);
        if (!modules.length) this.loadError.set(specsRes.reason?.message || 'Request failed');
      }

      const all: any[] = [
        ...specs.map((s) => ({ id: s.id, name: s.name, updated: s.updatedAt, legacy: false })),
        ...modules.map((m: any) => ({ ...m, legacy: true })),
      ];
      const rows: CustomReportRow[] = [];
      for (const report of all) {
        const id = report?.id ?? report?._id ?? report?.moduleId ?? report?.uuid;
        if (!id) continue; // skip malformed records — they'd produce broken nav routes
        rows.push({
          slug: String(id),
          name: report.name,
          legacy: report.legacy,
          updated: this.formatUpdated(report.updated),
        });
      }
      this.reports.set(rows);
      this.selected.set(new Set());
    } catch (error) {
      console.error('Error loading custom reports:', error);
      this.reports.set([]);
      this.selected.set(new Set());
      this.loadError.set((error as any)?.message || 'Request failed');
    }
    this.loaded.set(true);
  }

  /** moment(x).format('yyyy-MM-DD HH:mm') in the legacy list (a missing date meant "now"). */
  private formatUpdated(value: unknown): string {
    const d = value === undefined ? new Date() : new Date(value as any);
    if (isNaN(d.getTime())) return 'Invalid date';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ─── Navigation ───────────────────────────────────────────

  view(report: CustomReportRow): void {
    if (!report?.slug) return;
    // The report builder in view mode (full-screen — no app layout chrome).
    this.router.navigate(['/reports/builder/view', report.slug]);
  }

  addReport(event: Event): void {
    event.stopPropagation();
    // The report builder, blank — full-screen.
    this.router.navigate(['/reports/builder/new']);
  }

  openMcpTokens(event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/reports/builder/mcp-tokens']);
  }

  edit(report: CustomReportRow, event: Event): void {
    event.stopPropagation();
    if (!report?.slug) return;
    this.router.navigate(['/reports/builder/edit', report.slug]);
  }

  // ─── Favourites ───────────────────────────────────────────

  isStarred(report: CustomReportRow): boolean {
    return this.favs.isFavorite(report.slug);
  }
  toggleStar(report: CustomReportRow, event: Event): void {
    event.stopPropagation();
    this.favs.toggle(report.slug);
  }

  // ─── Selection / delete ───────────────────────────────────

  isSelected(report: CustomReportRow): boolean {
    return this.selected().has(report.slug);
  }

  toggleSelection(report: CustomReportRow, event: Event): void {
    event.stopPropagation();
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(report.slug)) next.delete(report.slug);
      else next.add(report.slug);
      return next;
    });
  }

  /** Select every report, or clear when they all are already selected. */
  toggleSelectAll(event: Event): void {
    event.stopPropagation();
    this.selected.set(this.allSelected() ? new Set() : new Set(this.reports().map((r) => r.slug)));
  }

  private async confirmDelete(title: string): Promise<boolean> {
    return !!(await this.modal
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        size: 'sm',
        data: {
          title,
          message: '',
          confirm: this.translate.instant('CUSTOM_REPORTS.LIST.DELETE'),
          cancel: this.translate.instant('CUSTOM_REPORTS.COMMON.CANCEL'),
          danger: true,
        },
      })
      .afterClosed());
  }

  async deleteReport(report: CustomReportRow, event: Event): Promise<void> {
    event.stopPropagation();
    if (
      !(await this.confirmDelete(
        this.translate.instant('CUSTOM_REPORTS.LIST.DELETE_CONFIRM_TITLE'),
      ))
    )
      return;
    try {
      await this.deleteOne(report);
      this.reports.update((list) => list.filter((r) => r.slug !== report.slug));
    } catch (error) {
      console.error('Error deleting report:', error);
      this.toast.error(this.translate.instant('CUSTOM_REPORTS.LIST.DELETE_FAILED'));
    }
  }

  /** Delete every selected custom report after one confirmation. */
  async bulkDelete(): Promise<void> {
    const slugs = Array.from(this.selected());
    if (slugs.length === 0 || this.bulkDeleting()) return;
    const title = this.translate.instant('CUSTOM_REPORTS.LIST.DELETE_SELECTED_CONFIRM', {
      count: slugs.length,
    });
    if (!(await this.confirmDelete(title))) return;

    this.bulkDeleting.set(true);
    // Delete concurrently but tolerate partial failure — only drop the ones
    // that actually succeeded so a failed slug stays visible for retry.
    const results = await Promise.allSettled(
      slugs.map((slug) => {
        const report = this.reports().find((r) => r.slug === slug);
        return report
          ? this.deleteOne(report).then(() => slug)
          : Promise.reject(new Error('Unknown report ' + slug));
      }),
    );
    const deleted = new Set<string>();
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') deleted.add(slugs[i]);
      else console.error('Bulk delete failed for report:', slugs[i], res.reason);
    });
    this.reports.update((list) => list.filter((r) => !deleted.has(r.slug)));
    this.selected.update((s) => {
      const next = new Set(s);
      deleted.forEach((d) => next.delete(d));
      return next;
    });
    this.bulkDeleting.set(false);
  }

  /** v2 specs and previous-builder modules live in different lists. */
  private deleteOne(report: CustomReportRow): Promise<unknown> {
    if (!report.legacy) return this.reportsV2.deleteSpec(report.slug);
    return this.legacyApi.deleteModule(report.slug);
  }
}
