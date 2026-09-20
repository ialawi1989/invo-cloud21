import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { AuthService } from '@core/auth/auth.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import type { MediaPickerModalComponent as MediaPickerType } from 'src/app/features/settings/media/components/media-picker/media-picker-modal.component';
import { MediaService } from 'src/app/features/settings/media/services/media.service';

import { ManualJournalsService } from '../../services/manual-journals.service';
import { Journal, JournalAttachment, JournalComment, calculateJournalTotals, emptyJournal } from '../../services/manual-journals.types';

/** Backend `reference` key this feature's attachments are linked under
 *  (matches legacy `type: 'journal'` passed to `<app-attachment>`). */
const ATTACHMENT_REFERENCE = 'journal';

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
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    MycurrencyPipe,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manual-journal-view.component.html',
  styleUrl: './manual-journal-view.component.scss',
})
export class ManualJournalViewComponent implements OnInit {
  private service = inject(ManualJournalsService);
  private mediaService = inject(MediaService);
  private auth = inject(AuthService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);
  private toast = inject(ToastService);

  loading = signal<boolean>(false);
  journalId = signal<string>('');
  journal = signal<Journal>(emptyJournal());
  currentEmployeeName = signal<string>('');

  totals = computed(() => calculateJournalTotals(this.journal().lines));

  showCommentBox = signal<boolean>(false);
  newComment = signal<string>('');
  commentsSaving = signal<boolean>(false);

  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('MENU.DASHBOARD'), routerLink: '/dashboard' },
      { label: this.translate.instant('MANUAL_JOURNALS.LIST.TITLE'), routerLink: '/account/manual-journals' },
      { label: this.translate.instant('MANUAL_JOURNALS.FORM.VIEW_TITLE') },
    ];
  });

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    this.auth.employee$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(e => {
      this.currentEmployeeName.set(e?.name || e?.employeeName || e?.fullName || '');
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.journalId.set(id);
    await this.load();
  }

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

  // ─── Attachments ────────────────────────────────────────────────────────
  /** Persists immediately (the journal already exists) via the shared
   *  media-link API, matching legacy's immediate-append-on-view-page flow —
   *  but, unlike legacy, never wipes existing attachments on failure: only
   *  the newly-picked files are rolled back locally. */
  async addAttachment(): Promise<void> {
    const { MediaPickerModalComponent } =
      await import('src/app/features/settings/media/components/media-picker/media-picker-modal.component');
    const ref = this.modal.open<MediaPickerType, any, any>(
      MediaPickerModalComponent,
      {
        size: 'xl',
        data: {
          contentTypes: ['image', 'document'],
          title: this.translate.instant('MANUAL_JOURNALS.FORM.ATTACH_FILE'),
          multiple: true,
        },
        closeOnBackdrop: true,
      },
    );
    const picked = await ref.afterClosed();
    if (!picked) return;
    const items: any[] = Array.isArray(picked) ? picked : [picked];
    if (!items.length) return;

    for (const m of items) {
      const mapped: JournalAttachment = {
        id: String(m?.id ?? m?._id ?? ''),
        size: typeof m?.getSize === 'number' ? m.getSize : Number(m?.size?.size ?? m?.mediaSize ?? 0) || 0,
        mediaUrl: m?.imageUrl || m?.url?.defaultUrl || m?.url?.original || m?.url?.thumbnail || '',
        mediaType: m?.mediaType?.fileType || m?.contentType || '',
        mediaName: m?.name || '',
      };
      if (!mapped.id) continue;
      try {
        const ok = await this.mediaService.appendAttachment({
          reference: ATTACHMENT_REFERENCE,
          referenceId: this.journalId(),
          attachment: [{ id: mapped.id }],
        } as any);
        if (ok) {
          this.journal.update(j => (j.attachment.some(a => a.id === mapped.id)
            ? j
            : { ...j, attachment: [...j.attachment, mapped] }));
        } else {
          this.toast.error('COMMON.SAVE_FAILED');
        }
      } catch (e: any) {
        this.toast.error('COMMON.SAVE_FAILED', e?.message);
      }
    }
  }

  async removeAttach(attachment: JournalAttachment): Promise<void> {
    try {
      const ok = await this.mediaService.deleteAttachment({
        reference: ATTACHMENT_REFERENCE,
        referenceId: this.journalId(),
        attachmentId: attachment.id,
      });
      if (ok) {
        this.journal.update(j => ({ ...j, attachment: j.attachment.filter(a => a.id !== attachment.id) }));
      } else {
        this.toast.error('COMMON.DELETE_FAILED');
      }
    } catch (e: any) {
      this.toast.error('COMMON.DELETE_FAILED', e?.message);
    }
  }
}
