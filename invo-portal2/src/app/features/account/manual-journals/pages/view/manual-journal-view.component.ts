import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { formatJournalDate } from '../../../services/journal-date';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { AuthService } from '@core/auth/auth.service';
import { railKind } from '@shared/utils/status-tone';
import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { LayoutService } from '@core/layout/services/layout.service';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { ManualJournalPaperComponent } from '../../components/manual-journal-paper/manual-journal-paper.component';
import { DocViewAttachmentsComponent } from '../../../components/doc-view-attachments/doc-view-attachments.component';
import { DocAdditionalDetailsComponent } from '../../../components/doc-additional-details/doc-additional-details.component';
import type { DocAdditionalDetailsConfig } from '../../../components/doc-additional-details/doc-additional-details.types';
import { DocViewShellComponent } from '../../../components/doc-view-shell/doc-view-shell.component';
import type { DocRailItem } from '../../../services/document-view-base';
import { ManualJournalsService } from '../../services/manual-journals.service';
import { Journal, JournalComment, calculateJournalTotals, emptyJournal } from '../../services/manual-journals.types';

/**
 * Manual Journal detail/view page — read-only ledger display, comments
 * thread, attachments, print, and the "Open Journal" (Draft → Open) action.
 *
 * Preserves legacy business rules:
 *   - Comments are append-only from the UI, but every add/remove round-trips
 *     the FULL array to `saveJournalComments` (server replaces wholesale) —
 *     see `ManualJournalsService.saveComments`. The response omits
 *     `employeeName`, so newly-added comments fall back to the current
 *     employee's own name until the page is reloaded.
 *   - "Open Journal" only shown for `status === 'Draft'`; always sets
 *     status to the literal `'Open'` server-side (confirmed against
 *     InvoCloudBack — NOT a generic status toggle).
 *   - Edit/Clone/Delete hidden once `reconciled` is true.
 */
@Component({
  selector: 'app-manual-journal-view',
  standalone: true,
  providers: [MycurrencyPipe],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    DocViewShellComponent,
    ManualJournalPaperComponent,
    DocAdditionalDetailsComponent,
    DocViewAttachmentsComponent,
    LoadingOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manual-journal-view.component.html',
  styleUrl: './manual-journal-view.component.scss',
})
export class ManualJournalViewComponent implements OnInit, OnDestroy {
  private service = inject(ManualJournalsService);
  private auth = inject(AuthService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private privileges = inject(PrivilegeService);
  private layout = inject(LayoutService);
  private lang = inject(LanguageService);
  private currency = inject(MycurrencyPipe);

  /** Add also gates Edit/Clone (legacy), Delete has its own privilege. */
  readonly canAdd = this.privileges.check('manualJournalSecurity.actions.add.access');
  readonly canDelete = this.privileges.check('manualJournalSecurity.actions.delete.access');

  loading = signal<boolean>(false);
  journalId = signal<string>('');
  journal = signal<Journal>(emptyJournal());
  currentEmployeeName = signal<string>('');

  totals = computed(() => calculateJournalTotals(this.journal().lines));

  showCommentBox = signal<boolean>(false);
  newComment = signal<string>('');
  commentsSaving = signal<boolean>(false);

  // ─── Side list of the other journals (record rail) ──────────────────────
  private readonly railPageSize = 15;
  railItems = signal<DocRailItem[]>([]);
  railLoading = signal<boolean>(false);
  railTerm = signal<string>('');
  railPage = signal<number>(1);
  railPageCount = signal<number>(1);
  /** Created dates of the journals the rail has listed (the detail endpoint has none), by id. */
  private createdById = signal<Record<string, string>>({});
  /** The open journal with its created date, for the paper. */
  paperJournal = computed(() => ({ ...this.journal(), createdAt: this.createdById()[this.journalId()] ?? this.journal().createdAt }));
  private railSearch$ = new Subject<string>();
  private railSeq = 0;

  docTitle = computed(() => {
    this.i18nTick();
    return `${this.translate.instant('MANUAL_JOURNALS.FORM.VIEW_TITLE')} ${this.journal().reference || ''}`.trim();
  });

  private i18nTick = signal(0);

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    this.railSearch$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => { this.railTerm.set(term); void this.loadRail(1); });

    this.auth.employee$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(e => {
      this.currentEmployeeName.set(e?.name || e?.employeeName || e?.fullName || '');
    });
  }

  async ngOnInit(): Promise<void> {
    // Edge-to-edge like the other document views (rail + toolbar span the full width).
    this.layout.setNoPadding(true);
    // The shared view shell's `DOC_VIEW.*` labels live in this feature's translations.
    await Promise.all([
      this.lang.loadFeature('account/manual-journals'),
      this.lang.loadFeature('account/components/doc-lines-table'),
    ]);
    void this.loadRail(1);
    // The route is reused when picking another journal from the rail, so follow the param.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(m => {
      this.journalId.set(m.get('id') || '');
      void this.load();
    });
  }

  ngOnDestroy(): void { this.layout.setNoPadding(false); }

  // ─── Rail ───────────────────────────────────────────────────────────────
  async loadRail(page: number): Promise<void> {
    const seq = ++this.railSeq;
    this.railLoading.set(true);
    try {
      const res = await this.service.getList({ page, limit: this.railPageSize, searchTerm: this.railTerm(), sortBy: { sortValue: 'createdAt', sortDirection: 'desc' } });
      if (seq !== this.railSeq) return;
      this.createdById.update(m => ({ ...m, ...Object.fromEntries(res.list.filter(r => r.createdAt).map(r => [r.id, String(r.createdAt)])) }));
      this.railItems.set(res.list.map(r => ({
        id: r.id,
        primary: r.reference || '—',
        amountLabel: this.currency.transform(r.amount),
        sub: [formatJournalDate(r.journalDate), r.branchName].filter(Boolean).join(' · '),
        statusText: r.status ? this.translate.instant('MANUAL_JOURNALS.STATUS.' + r.status.toUpperCase()) : '',
        statusKind: railKind(r.status),
      } as DocRailItem)));
      this.railPage.set(page);
      this.railPageCount.set(Math.max(1, res.pageCount || 1));
    } finally {
      if (seq === this.railSeq) this.railLoading.set(false);
    }
  }
  onRailSearch(term: string): void { this.railSearch$.next(term); }
  railPrev(): void { if (this.railPage() > 1) void this.loadRail(this.railPage() - 1); }
  railNext(): void { if (this.railPage() < this.railPageCount()) void this.loadRail(this.railPage() + 1); }
  railGoTo(item: DocRailItem): void { void this.router.navigate(['/account/manual-journals/view', item.id]); }
  add(): void { void this.router.navigate(['/account/manual-journals', 'new']); }

  /** Toolbar "more" menu — same visibility rules as legacy's button row. */
  actionItems = computed<DropdownMenuBtnItem[]>(() => {
    this.i18nTick();
    const j = this.journal();
    const items: DropdownMenuBtnItem[] = [];
    if (!j.reconciled && this.canAdd) items.push({ label: this.translate.instant('COMMON.CLONE'), click: () => this.cloneJournal() });
    if (!j.reconciled && this.canDelete) items.push({ label: this.translate.instant('COMMON.DELETE'), danger: true, click: () => void this.deleteJournal() });
    return items;
  });
  /** "Additional Details" under the paper — the journal's Logs. */
  additionalDetails = computed<DocAdditionalDetailsConfig>(() => ({ tabs: ['logs'], logsSourceTable: 'Journals', logsSourceId: this.journalId() }));
  printItems = computed<DropdownMenuBtnItem[]>(() => {
    this.i18nTick();
    return [{ label: this.translate.instant('COMMON.PRINT'), click: () => this.print() }];
  });

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const journal = await this.service.getById(this.journalId());
      if (!journal) {
        void this.router.navigate(['/account/manual-journals']);
        return;
      }
      this.journal.set(journal);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Navigation ─────────────────────────────────────────────────────────
  back(): void { void this.router.navigate(['/account/manual-journals']); }
  editJournal(): void { void this.router.navigate(['/account/manual-journals', this.journalId()]); }
  cloneJournal(): void { void this.router.navigate(['/account/manual-journals', this.journalId()], { queryParams: { clone: 'true' } }); }
  print(): void { window.print(); }

  async deleteJournal(): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.translate.instant('MANUAL_JOURNALS.LIST.DELETE_TITLE'),
          message: this.translate.instant('MANUAL_JOURNALS.LIST.DELETE_MESSAGE', { reference: this.journal().reference || '—' }),
          confirm: this.translate.instant('COMMON.DELETE'),
          danger: true,
        },
        closeOnBackdrop: false,
      },
    );
    if (!(await ref.afterClosed())) return;
    try {
      const ok = await this.service.delete(this.journalId());
      if (ok) {
        this.toast.success('MESSAGE.SUCCESSFULLY_DELETED');
        void this.router.navigate(['/account/manual-journals']);
      } else {
        this.toast.error('COMMON.DELETE_FAILED');
      }
    } catch (e: any) {
      this.toast.error('COMMON.DELETE_FAILED', e?.message);
    }
  }

  async openJournal(): Promise<void> {
    this.loading.set(true);
    try {
      const ok = await this.service.openJournal(this.journalId());
      if (ok) {
        this.toast.success('MESSAGE.SUCCESSFULLY_SAVED');
        void this.router.navigate(['/account/manual-journals']);
      } else {
        this.toast.error('COMMON.SAVE_FAILED');
      }
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Comments ───────────────────────────────────────────────────────────
  openCommentBox(): void { this.showCommentBox.set(true); }

  async addComment(): Promise<void> {
    const text = this.newComment().trim();
    if (!text) return;
    this.commentsSaving.set(true);
    try {
      const optimistic: JournalComment[] = [
        ...this.journal().comments,
        { employeeId: '', employeeName: this.currentEmployeeName(), comment: text, date: new Date() },
      ];
      const saved = await this.service.saveComments(this.journalId(), optimistic);
      // The save response omits `employeeName` — patch it back in locally
      // from the current employee for anything we just posted this session.
      const patched = saved.map(c => ({ ...c, employeeName: c.employeeName || this.currentEmployeeName() }));
      this.journal.update(j => ({ ...j, comments: patched }));
      this.newComment.set('');
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.commentsSaving.set(false);
    }
  }

  async removeComment(comment: JournalComment): Promise<void> {
    this.commentsSaving.set(true);
    try {
      const next = this.journal().comments.filter(c => c !== comment);
      const saved = await this.service.saveComments(this.journalId(), next);
      const patched = saved.map(c => ({ ...c, employeeName: c.employeeName || this.currentEmployeeName() }));
      this.journal.update(j => ({ ...j, comments: patched }));
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.commentsSaving.set(false);
    }
  }
}
