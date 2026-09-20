import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import { AccountService } from 'src/app/features/settings/chart-of-accounts/services/account.service';
import { Account } from 'src/app/features/settings/chart-of-accounts/services/account.types';
import { accountTypeKey } from 'src/app/features/settings/chart-of-accounts/utils/account-types';

import { JournalLine, emptyJournalLine } from '../../../../models/recurring-journal.model';

/**
 * Standalone debit/credit line-item grid — extracted so the same editor can
 * be reused by both the create/edit form and (if a future screen needs it)
 * a read-only preview, rather than inline-duplicating the table markup.
 *
 * 1:1 port of legacy `app-journal-form-lines`
 * (`InvoCloudFront2/src/app/pages/account/journal/journal-form/components/journal-form-lines`),
 * adapted to this app's shared `<app-search-dropdown>` (replaces the legacy
 * grouped `<app-account-select>`) and `mycurrency` pipe conventions.
 *
 * Business rules preserved from legacy:
 *  - New lines default to the first available account not already used by
 *    an earlier line (`getAvailableAccounts`).
 *  - Entering a debit clears that line's credit and vice-versa
 *    (`onChangeDebitCredit`) — a line is either a debit OR a credit line.
 *  - Removing an EXISTING (saved, has an id) line in edit mode soft-deletes
 *    it (`isVoided = true`) instead of removing it from the array, so the
 *    backend can void the line rather than lose referential history; a
 *    brand-new (unsaved) line is spliced out entirely in both modes.
 *  - Client-side warnings mirror the server's own validation so the user
 *    gets fast feedback before submit: at least 2 (non-voided) lines, and
 *    debit total must equal credit total.
 */
@Component({
  selector: 'app-journal-lines-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SearchDropdownComponent, MycurrencyPipe],
  templateUrl: './journal-lines-editor.component.html',
  styleUrl: './journal-lines-editor.component.scss',
})
export class JournalLinesEditorComponent implements OnChanges {
  private accountService = inject(AccountService);
  private translate = inject(TranslateService);

  @Input() lines: JournalLine[] = [];
  @Input() formStatus: 'new' | 'edit' = 'new';
  @Output() linesChange = new EventEmitter<JournalLine[]>();

  accounts: Account[] = [];
  accountsLoaded = false;

  linesDebitsTotal = 0;
  linesCreditsTotal = 0;

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.accountService.getList({ page: 1, limit: 999, searchTerm: '' });
      this.accounts = res.list;
    } finally {
      this.accountsLoaded = true;
    }
    this.calculateTotal();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lines']) this.calculateTotal();
  }

  get visibleLines(): JournalLine[] {
    return this.lines.filter(l => !l.isVoided);
  }

  calculateTotal(): void {
    this.linesDebitsTotal = 0;
    this.linesCreditsTotal = 0;
    for (const l of this.visibleLines) {
      this.linesDebitsTotal += Number(l.debit) || 0;
      this.linesCreditsTotal += Number(l.credit) || 0;
    }
  }

  accountDisplay = (a: Account | null) => a ? this.accountLabel(a) : '';
  accountCompare = (a: Account | null, b: Account | null) => (a?.id ?? '') === (b?.id ?? '');
  accountToValue = (a: Account | null) => a?.id ?? '';
  accountGroupBy = (a: Account) => this.translate.instant(accountTypeKey(a.parentType || a.type));

  accountLabel(a: Account): string {
    return a.name;
  }

  selectedAccount(line: JournalLine): Account | null {
    return this.accounts.find(a => a.id === line.accountId) ?? null;
  }

  setAccount(line: JournalLine, value: Account | Account[] | null): void {
    const account = Array.isArray(value) ? (value[0] ?? null) : value;
    line.accountId = account?.id ?? null;
    line.accountName = account?.name ?? '';
    this.emitChange();
  }

  /** Accounts not already used by an earlier line — mirrors legacy
   *  `getAvailableAccounts`, used to default a newly-added line. */
  private getAvailableAccounts(beforeIndex: number): Account[] {
    const usedIds = new Set(this.lines.slice(0, beforeIndex).map(l => l.accountId));
    return this.accounts.filter(a => !usedIds.has(a.id));
  }

  addLine(): void {
    const line = emptyJournalLine();
    const available = this.getAvailableAccounts(this.lines.length);
    if (available.length > 0) {
      line.accountId = available[0].id;
      line.accountName = available[0].name;
    }
    this.lines = [...this.lines, line];
    this.emitChange();
  }

  removeLine(line: JournalLine): void {
    const index = this.lines.indexOf(line);
    if (index === -1) return;
    if (this.formStatus === 'edit' && line.id) {
      // Existing, saved line — soft-delete so the backend can void it.
      line.isVoided = true;
      this.lines = [...this.lines];
    } else {
      // Never-saved line — just drop it.
      this.lines = this.lines.filter((_, i) => i !== index);
    }
    this.emitChange();
  }

  onDebitChange(line: JournalLine): void {
    if (Number(line.debit) > 0) line.credit = 0;
    this.emitChange();
  }

  onCreditChange(line: JournalLine): void {
    if (Number(line.credit) > 0) line.debit = 0;
    this.emitChange();
  }

  private emitChange(): void {
    this.calculateTotal();
    this.linesChange.emit(this.lines);
  }

  get hasLessThanTwoLines(): boolean {
    return this.visibleLines.length < 2;
  }

  get isUnbalanced(): boolean {
    return this.visibleLines.length >= 2 && this.linesDebitsTotal - this.linesCreditsTotal !== 0;
  }
}
