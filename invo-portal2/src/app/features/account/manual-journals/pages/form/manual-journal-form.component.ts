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
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { ErrorService } from '@core/http/error.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';

import { BranchSettingsService } from 'src/app/features/settings/services/branch-settings.service';
import { AccountService } from 'src/app/features/settings/chart-of-accounts/services/account.service';
import { Account } from 'src/app/features/settings/chart-of-accounts/services/account.types';
import type { MediaPickerModalComponent as MediaPickerType } from 'src/app/features/settings/media/components/media-picker/media-picker-modal.component';

import { ManualJournalsService } from '../../services/manual-journals.service';
import {
  Journal,
  JournalAttachment,
  JournalLine,
  SaveJournalPayload,
  calculateJournalTotals,
  emptyJournal,
  emptyJournalLine,
  toDateInput,
} from '../../services/manual-journals.types';

interface BranchOption {
  id: string;
  name: string;
  translation?: Record<string, Record<string, string> | undefined>;
}

/**
 * Manual Journal create / edit / clone form.
 *
 * Business rules preserved exactly from legacy `journal-form.component.ts` +
 * `journal-form-lines.component.ts`:
 *   - >= 2 (non-voided) lines, every line's debit XOR credit (never both
 *     zero on the same line), and total debits === total credits — gates
 *     the Save button (`saveDisabled`/`saveDraftDisabled`; identical logic
 *     here since `JOURNAL_SCHEMA` uses the same rules for every mode).
 *   - Typing into Debit while > 0 zeroes Credit on that line and vice versa.
 *   - Clone: id/reference blanked, date reset to today, every line's `code`
 *     blanked — accountId/debit/credit are NOT touched (handled in
 *     `ManualJournalsService.clone`).
 *   - Removing a line: if it has a persisted id (edit mode), soft-void it
 *     (`isVoided = true`, hidden from the grid, sent back with the flag so
 *     the backend hard-deletes it); a brand-new unsaved line is spliced out
 *     immediately.
 */
@Component({
  selector: 'app-manual-journal-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    MycurrencyPipe,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    FormStickyFooterComponent,
    DatePickerComponent,
    SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manual-journal-form.component.html',
  styleUrl: './manual-journal-form.component.scss',
})
export class ManualJournalFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(ManualJournalsService);
  private accountService = inject(AccountService);
  private branchSvc = inject(BranchSettingsService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);
  private toast = inject(ToastService);
  private errorService = inject(ErrorService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  dirty = signal<boolean>(false);
  submitClicked = signal<boolean>(false);

  journalId = signal<string>('new');
  isNew = computed(() => this.journalId() === 'new' || this.journalId() === '' || this.journalId() === '0');
  isClone = signal<boolean>(false);

  status = signal<Journal['status']>('');
  reconciled = signal<boolean>(false);

  branchId = signal<string>('');
  branches = signal<BranchOption[]>([]);
  reference = signal<string>('');
  notes = signal<string>('');
  journalDate = signal<Date>(new Date());

  /** Legacy caps the journal-date picker at today (`maxDate="today"`). */
  readonly today = new Date();

  lines = signal<JournalLine[]>([]);
  attachments = signal<JournalAttachment[]>([]);

  accounts = signal<Account[]>([]);
  accountsLoaded = signal<boolean>(false);
  /** `groupBy` on `<app-search-dropdown>` requires items pre-sorted by
   *  group — bucket by parentType, alphabetical within each bucket. */
  sortedAccounts = computed<Account[]>(() => {
    return [...this.accounts()].sort((a, b) => {
      const pt = (a.parentType || '').localeCompare(b.parentType || '');
      return pt !== 0 ? pt : (a.name || '').localeCompare(b.name || '');
    });
  });

  private i18nTick = signal(0);

  // ─── Derived / validation ──────────────────────────────────────────────
  activeLines = computed(() => this.lines().filter(l => !l.isVoided));
  totals = computed(() => calculateJournalTotals(this.lines()));
  hasZeroLine = computed(() => this.activeLines().some(l => l.debit === 0 && l.credit === 0));
  balanceDiff = computed(() => {
    const t = this.totals();
    return Math.round((t.debitsTotal - t.creditsTotal + Number.EPSILON) * 1000) / 1000;
  });
  journalBalanceInvalid = computed(() =>
    this.activeLines().length < 2 || this.hasZeroLine() || this.balanceDiff() !== 0);

  missingBranch = computed(() => !this.branchId());
  missingLineAccounts = computed(() => this.activeLines().some(l => !l.accountId));
  missingRequiredFields = computed(() => this.missingBranch() || this.missingLineAccounts());

  /** `JOURNAL_SCHEMA` uses the SAME rule set for create/edit/draft, so the
   *  draft gate and the full-save gate are identical for journals — kept as
   *  two separate computeds (matching legacy's two buttons/tooltips) purely
   *  for template symmetry, not because the rules differ. */
  canSave = computed(() => !this.missingRequiredFields() && !this.journalBalanceInvalid());
  canSaveDraft = computed(() => !this.missingRequiredFields() && !this.journalBalanceInvalid());
  saveDisabled = computed(() => !this.canSave() || this.submitClicked() || this.saving());
  saveDraftDisabled = computed(() => !this.canSaveDraft() || this.submitClicked() || this.saving());

  missingTooltip = computed(() => {
    const parts: string[] = [];
    if (this.missingBranch()) parts.push(this.translate.instant('MANUAL_JOURNALS.FORM.FIELD_BRANCH'));
    if (this.missingLineAccounts()) parts.push(this.translate.instant('MANUAL_JOURNALS.FORM.FIELD_LINE_ACCOUNT'));
    if (!parts.length) return '';
    const header = this.translate.instant('MANUAL_JOURNALS.FORM.MISSING_HEADER');
    return `${header}\n• ${parts.join('\n• ')}`;
  });

  // ─── Dropdown adapters ──────────────────────────────────────────────────
  branchDisplay = (b: BranchOption | null) => b?.name ?? '';
  branchCompare = (a: BranchOption | null, b: BranchOption | null) => (a?.id ?? '') === (b?.id ?? '');
  branchToValue = (b: BranchOption | null) => b?.id ?? '';
  selectedBranch = (): BranchOption | null => this.branches().find(b => b.id === this.branchId()) ?? null;

  accountDisplay = (a: Account | null) => a?.name ?? '';
  accountCompare = (a: Account | null, b: Account | null) => (a?.id ?? '') === (b?.id ?? '');
  accountToValue = (a: Account | null) => a?.id ?? '';
  accountGroupBy = (a: Account) => a.parentType || a.type || '';
  selectedAccount = (line: JournalLine): Account | null =>
    this.accounts().find(a => a.id === line.accountId) ?? (line.accountId ? { id: line.accountId, name: line.accountName, type: '' } : null);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('MENU.DASHBOARD'), routerLink: '/dashboard' },
      { label: this.translate.instant('MANUAL_JOURNALS.LIST.TITLE'), routerLink: '/account/manual-journals' },
      { label: this.translate.instant(this.isNew() ? 'MANUAL_JOURNALS.FORM.NEW_TITLE' : 'MANUAL_JOURNALS.FORM.EDIT_TITLE') },
    ];
  });

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') || 'new';
    this.journalId.set(id);
    this.isClone.set(this.route.snapshot.queryParamMap.get('clone') === 'true');

    this.loading.set(true);
    try {
      await Promise.all([this.loadBranches(), this.loadAccounts()]);

      if (!this.isNew()) {
        const journal = this.isClone()
          ? await this.service.clone(id)
          : await this.service.getById(id);

        if (journal) {
          this.applyJournal(journal);
        } else {
          void this.router.navigate(['/account/manual-journals']);
          return;
        }
      } else {
        // New journal: default branch to the main branch and start with two
        // blank lines — mirrors legacy `journal-form-lines` `ngOnInit`.
        if (this.branches().length) this.branchId.set(this.branches()[0].id);
        this.addLine();
        this.addLine();
      }
      this.dirty.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.saving();
  }

  private applyJournal(journal: Journal): void {
    // A cloned journal always starts life as a fresh 'Draft'-eligible record
    // (id already blanked by the service); an edited journal keeps its
    // persisted status/reconciled flag.
    this.status.set(this.isClone() ? '' : journal.status);
    this.reconciled.set(this.isClone() ? false : journal.reconciled);
    this.branchId.set(journal.branchId || (this.branches()[0]?.id ?? ''));
    this.reference.set(journal.reference);
    this.notes.set(journal.notes);
    this.journalDate.set(journal.journalDate ? new Date(journal.journalDate) : new Date());
    this.attachments.set(this.isClone() ? [] : journal.attachment);
    this.lines.set(journal.lines.length ? journal.lines : [emptyJournalLine(), emptyJournalLine()]);
  }

  private async loadBranches(): Promise<void> {
    try {
      const res = await this.branchSvc.getList({ limit: 200 });
      this.branches.set(res.list.map((b: any) => ({ id: b.id, name: b.name, translation: b.translation })));
    } catch (e) {
      console.error('[manual-journals] loadBranches failed', e);
    }
  }

  private async loadAccounts(): Promise<void> {
    try {
      const res = await this.accountService.getList({ page: 1, limit: 999, searchTerm: '', sortBy: {} });
      this.accounts.set(res.list);
    } catch (e) {
      console.error('[manual-journals] loadAccounts failed', e);
    } finally {
      this.accountsLoaded.set(true);
    }
  }

  // ─── Header field edits ─────────────────────────────────────────────────
  onBranchChange(option: BranchOption | BranchOption[] | null): void {
    const opt = Array.isArray(option) ? option[0] ?? null : option;
    this.branchId.set(opt?.id ?? '');
    this.dirty.set(true);
  }
  onDateChange(value: Date | null): void {
    this.journalDate.set(value ?? new Date());
    this.dirty.set(true);
  }
  onReferenceChange(value: string): void { this.reference.set(value); this.dirty.set(true); }
  onNotesChange(value: string): void { this.notes.set(value); this.dirty.set(true); }

  // ─── Line editing ───────────────────────────────────────────────────────
  /** Accounts not already picked by an earlier (non-voided) line — used to
   *  auto-select a sensible default for a newly-added line, same as legacy
   *  `getAvailableAccounts()`. Does not prevent manually picking a
   *  duplicate via the dropdown. */
  private availableAccounts(beforeIndex: number): Account[] {
    const active = this.activeLines();
    const usedIds = new Set(active.slice(0, beforeIndex).map(l => l.accountId));
    return this.accounts().filter(a => !usedIds.has(a.id));
  }

  addLine(): void {
    const line = emptyJournalLine();
    const available = this.availableAccounts(this.activeLines().length);
    if (available.length) line.accountId = available[0].id;
    this.lines.update(list => [...list, line]);
    this.dirty.set(true);
  }

  async removeLine(line: JournalLine): Promise<void> {
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title: this.translate.instant('MANUAL_JOURNALS.FORM.CONFIRM_REMOVE_LINE_TITLE'),
          message: this.translate.instant('MANUAL_JOURNALS.FORM.CONFIRM_REMOVE_LINE_MESSAGE'),
          confirm: this.translate.instant('COMMON.DELETE'),
          danger: true,
        },
      },
    );
    if (!(await ref.afterClosed())) return;

    this.lines.update(list => {
      const idx = list.indexOf(line);
      if (idx === -1) return list;
      if (!this.isNew() && line.id != null) {
        // Persisted line — soft-void so it hides from the grid but is still
        // sent back on save with `isVoided: true` for a server-side delete.
        const next = [...list];
        next[idx] = { ...line, isVoided: true };
        return next;
      }
      return list.filter((_, i) => i !== idx);
    });
    this.dirty.set(true);
  }

  onAccountChange(line: JournalLine, account: Account | Account[] | null): void {
    const acc = Array.isArray(account) ? account[0] ?? null : account;
    this.updateLine(line, { accountId: acc?.id ?? '', accountName: acc?.name ?? '' });
  }

  onCodeChange(line: JournalLine, value: string): void { this.updateLine(line, { code: value }); }
  onDescriptionChange(line: JournalLine, value: string): void { this.updateLine(line, { description: value }); }

  /** Mutual exclusivity: a positive Debit zeroes Credit on the same line and
   *  vice versa — matches legacy `onChangeDebitCredit()` exactly. */
  onDebitChange(line: JournalLine, value: string): void {
    const debit = Math.max(0, parseFloat(value) || 0);
    this.updateLine(line, { debit, credit: debit > 0 ? 0 : line.credit });
  }
  onCreditChange(line: JournalLine, value: string): void {
    const credit = Math.max(0, parseFloat(value) || 0);
    this.updateLine(line, { credit, debit: credit > 0 ? 0 : line.debit });
  }

  private updateLine(line: JournalLine, patch: Partial<JournalLine>): void {
    this.lines.update(list => list.map(l => (l === line ? { ...l, ...patch } : l)));
    this.dirty.set(true);
  }

  // ─── Attachments ────────────────────────────────────────────────────────
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

    const mapped: JournalAttachment[] = items
      .map((m: any): JournalAttachment => ({
        id: String(m?.id ?? m?._id ?? ''),
        size: typeof m?.getSize === 'number' ? m.getSize : Number(m?.size?.size ?? m?.mediaSize ?? 0) || 0,
        mediaUrl: m?.imageUrl || m?.url?.defaultUrl || m?.url?.original || m?.url?.thumbnail || '',
        mediaType: m?.mediaType?.fileType || m?.contentType || '',
        mediaName: m?.name || '',
      }))
      .filter(a => !!a.id);

    this.attachments.update(existing => {
      const seen = new Set(existing.map(a => a.id));
      return [...existing, ...mapped.filter(a => !seen.has(a.id))];
    });
    this.dirty.set(true);
  }

  removeAttachment(id: string): void {
    this.attachments.update(list => list.filter(a => a.id !== id));
    this.dirty.set(true);
  }

  // ─── Save / cancel / view ───────────────────────────────────────────────
  async save(status: 'Draft' | 'Open'): Promise<void> {
    if (status === 'Draft' ? this.saveDraftDisabled() : this.saveDisabled()) return;
    // Defense-in-depth re-check, mirroring legacy `doSaveJournal()`'s own
    // second guard even though the button is already `[disabled]`.
    if (this.activeLines().length < 2 || this.hasZeroLine() || this.balanceDiff() !== 0) return;

    this.submitClicked.set(true);
    this.saving.set(true);
    try {
      const payload: SaveJournalPayload = {
        id: this.isNew() ? null : this.journalId(),
        branchId: this.branchId(),
        reference: this.reference(),
        notes: this.notes(),
        journalDate: toDateInput(this.journalDate()),
        status,
        attachment: this.attachments(),
        lines: this.lines().map(l => ({
          id: l.id,
          code: l.code,
          description: l.description,
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          isVoided: l.isVoided,
        })),
      };

      await this.service.save(payload);
      this.toast.success('MESSAGE.SUCCESSFULLY_SAVED');
      this.dirty.set(false);
      void this.router.navigate(['/account/manual-journals']);
    } catch (e: any) {
      console.error('[manual-journals] save failed', e);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      await this.errorService.handleError(e);
      this.submitClicked.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/account/manual-journals']);
  }

  view(): void {
    if (this.isNew()) return;
    void this.router.navigate(['/account/manual-journals/view', this.journalId()]);
  }

  trackLine = (_: number, l: JournalLine) => l;
}
