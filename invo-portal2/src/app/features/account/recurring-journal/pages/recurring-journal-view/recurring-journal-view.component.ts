import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LanguageService } from '@core/i18n/language.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ErrorService } from '@core/http/error.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { RecurringJournalService } from '../../services/recurring-journal.service';
import { RecurringJournal } from '../../models/recurring-journal.model';

/**
 * Read-only detail page — 1:1 port of legacy `recurring-journal-view`,
 * minus the legacy side-list/master-detail chrome (this app's convention
 * is a standalone detail page, matching Chart-of-Accounts/Opening-Balances).
 * Uses `getRecurringJournalOverview` (NOT `getRecurringJournalById` —
 * verified to be a genuinely different, view-only payload that also
 * carries `branchName` / `nextJournalDate` / the generated-journal history
 * in `childJournals`, none of which `getById` returns).
 */
@Component({
  selector: 'app-recurring-journal-view',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, BreadcrumbsComponent, LoadingOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recurring-journal-view.component.html',
  styleUrl: './recurring-journal-view.component.scss',
})
export class RecurringJournalViewComponent implements OnInit {
  private service = inject(RecurringJournalService);
  private translate = inject(TranslateService);
  private lang = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private errorService = inject(ErrorService);
  private privileges = inject(PrivilegeService);
  private modalService = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  readonly canEdit = this.privileges.check('recurringJournalSecurity.actions.add.access');
  readonly canDelete = this.privileges.check('recurringJournalSecurity.actions.delete.access');

  loading = signal<boolean>(true);
  journal = signal<RecurringJournal | null>(null);
  private i18nTick = signal(0);

  /** Mirrors legacy's delete gate exactly:
   *  `childJournalsQty == 0 && !hasJournals && <add-access>` — note legacy
   *  guards the delete BUTTON on the *add* privilege (not a separate
   *  delete privilege), which we intentionally do NOT replicate: this app
   *  has a dedicated `recurringJournalSecurity.actions.delete.access` key
   *  in the registry, so we gate on that instead (a stricter, more correct
   *  check — see feature report for this deliberate deviation). */
  canDeleteRecord = computed<boolean>(() => {
    const j = this.journal();
    if (!j) return false;
    return (j.childJournalsQty ?? 0) === 0 && !j.hasJournals && this.canDelete;
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.journal()?.name ?? this.translate.instant('RECURRING_JOURNAL.LIST.TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('RECURRING_JOURNAL.LIST.TITLE'), routerLink: '/account/recurring-journal' },
      { label: this.pageTitle() },
    ];
  });

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/recurring-journal');
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loading.set(true);
    try {
      const j = await this.service.getOverview(id);
      if (!j) {
        void this.router.navigate(['/account/recurring-journal']);
        return;
      }
      this.journal.set(j);
    } finally {
      this.loading.set(false);
    }
  }

  frequencyLabel(): string {
    const j = this.journal();
    if (!j) return '';
    const qty = j.repeatData?.periodQty ?? 1;
    switch (j.repeatData?.periodicity) {
      case 'Monthly': return this.translate.instant('RECURRING_JOURNAL.LIST.FREQUENCY_SENTENCE_MONTH', { qty, period: 'Month' });
      case 'Yearly': return this.translate.instant('RECURRING_JOURNAL.LIST.FREQUENCY_SENTENCE_YEAR', { qty, period: 'Year' });
      case 'Weekly': return this.translate.instant('RECURRING_JOURNAL.LIST.FREQUENCY_SENTENCE_WEEK', { qty, period: 'Week' });
      default: return '';
    }
  }

  edit(): void {
    const id = this.journal()?.id;
    if (id) void this.router.navigate(['/account/recurring-journal', id, 'edit']);
  }

  back(): void { void this.router.navigate(['/account/recurring-journal']); }

  async delete(): Promise<void> {
    const j = this.journal();
    if (!j || !this.canDeleteRecord()) return;

    const ref = this.modalService.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant('COMMON.DELETE'),
        message: this.translate.instant('COMMON.CONFIRM_DELETE'),
        confirm: this.translate.instant('COMMON.DELETE'),
        danger: true,
      },
    });
    const confirmed = await ref.afterClosed();
    if (!confirmed) return;

    try {
      await this.service.delete(j.id);
      this.toast.success('COMMON.DELETED_OK');
      void this.router.navigate(['/account/recurring-journal']);
    } catch (err: any) {
      this.toast.error('COMMON.DELETE_FAILED', err?.message);
      await this.errorService.handleError(err);
    }
  }
}
