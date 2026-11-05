import { TranslateService } from '@ngx-translate/core';

import {
  MappedImportConfig,
  MappedImportField,
  MappedImportIssue,
  MappedImportPreview,
  MappedRow,
} from '@shared/components/mapped-import-wizard/mapped-import.types';

import { AccountService } from './account.service';
import { Account } from './account.types';
import { ACCOUNT_TYPES } from '../utils/account-types';

const K = 'CHART_OF_ACCOUNTS.IMPORT.';
const G = K + 'GROUP';

/** Fields of the account import; `key`s are what `accounts/importAccounts` reads off each row. */
const FIELDS: MappedImportField[] = [
  { key: 'name', label: K + 'COL_NAME', group: G, required: true, aliases: ['Account Name', 'Name'] },
  { key: 'type', label: K + 'COL_TYPE', group: G, required: true, aliases: ['Account Type', 'Type'] },
  { key: 'code', label: K + 'COL_CODE', group: G, aliases: ['Account Code', 'Code', 'Account #'] },
  { key: 'description', label: K + 'COL_DESCRIPTION', group: G, aliases: ['Description'] },
  { key: 'nameEn', label: K + 'COL_NAME_EN', group: G, aliases: ['English Name'] },
  { key: 'nameAr', label: K + 'COL_NAME_AR', group: G, aliases: ['Arabic Name'] },
  { key: 'descriptionEn', label: K + 'COL_DESCRIPTION_EN', group: G, aliases: ['English Description'] },
  { key: 'descriptionAr', label: K + 'COL_DESCRIPTION_AR', group: G, aliases: ['Arabic Description'] },
];

const TYPE_IDS = new Set(ACCOUNT_TYPES.map(t => t.id));
const norm = (v: string | undefined) => (v ?? '').trim().toLowerCase();

/**
 * `<app-mapped-import-wizard>` config for the Chart of Accounts (Configure → Map Fields → Preview): the file's
 * own headers are mapped onto the fields above, so it needn't follow the template's column order.
 *
 * The backend matches an incoming row to an existing account by NAME and edits it (it never skips), so
 * "Skip duplicates" is done here, against `existing`: accounts whose name is already in the chart are left out
 * unless "Overwrite existing accounts" is ticked.
 */
export function buildAccountImportConfig(args: {
  service: AccountService;
  translate: TranslateService;
  existing: Account[];
}): MappedImportConfig {
  const { service, translate, existing } = args;
  const t = (k: string, p?: Record<string, unknown>) => translate.instant(K + k, p);
  const byName = new Map(existing.map(a => [norm(a.name), a]));

  /** Splits the file into rows to send, rows skipped and rows that can't be imported. */
  const classify = (rows: MappedRow[], overwrite: boolean) => {
    const send: MappedRow[] = [];
    const skipped: MappedImportIssue[] = [];
    const failed: MappedImportIssue[] = [];
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      const row = i + 2;
      const name = (r['name'] ?? '').trim();
      const type = (r['type'] ?? '').trim();
      if (!name) return void failed.push({ row, ref: '', reason: t('ERR_MISSING_NAME') });
      if (!type) return void failed.push({ row, ref: name, reason: t('ERR_MISSING_TYPE') });
      if (!TYPE_IDS.has(type)) return void failed.push({ row, ref: name, reason: t('ERR_INVALID_TYPE', { type }) });
      if (seen.has(norm(name))) return void skipped.push({ row, ref: name, reason: t('SKIP_IN_FILE') });
      seen.add(norm(name));
      const found = byName.get(norm(name));
      if (found && !overwrite) return void skipped.push({ row, ref: name, reason: t('SKIP_EXISTS') });
      if (found && found.type !== type) return void failed.push({ row, ref: name, reason: t('ERR_TYPE_LOCKED', { type: found.type }) });
      if (found?.default && found.name !== name) return void failed.push({ row, ref: name, reason: t('ERR_DEFAULT_NAME') });
      send.push(r);
    });
    return { send, skipped, failed };
  };

  return {
    title: K + 'TITLE',
    recordsLabel: K + 'RECORDS',
    fields: FIELDS,
    recordKey: 'name',
    templateName: 'accounts-list-template',
    templateRows: [
      ['Account Name', 'Account Type', 'Account Code', 'Description', 'English Name', 'Arabic Name', 'English Description', 'Arabic Description'],
      ['Account 1', 'Cash', '123', 'Account', 'Account 1', 'اكاونت 1', '', ''],
    ],
    options: [
      { key: 'overwrite', label: K + 'OVERWRITE', description: K + 'OVERWRITE_DESC' },
    ],
    tips: [K + 'TIP_ROWS', K + 'TIP_DUP', K + 'TIP_TYPE'],
    // Nothing is sent before Import; account codes already used by another account are only known to the
    // server and are reported after the run.
    preview: (rows, { options }): MappedImportPreview => {
      const { send, skipped, failed } = classify(rows, !!options['overwrite']);
      return { total: rows.length, ready: send.length, skipped, failed };
    },
    run: async (rows, { options }): Promise<MappedImportPreview> => {
      const { send, skipped, failed } = classify(rows, !!options['overwrite']);
      const progress = await service.getBulkImportProgress();
      // Inverted contract: success === "nothing running, go ahead".
      if (progress && !progress.success) throw new Error(progress.msg || t('ERR_RUNNING'));

      const payload = send.map(r => ({
        name: (r['name'] ?? '').trim(),
        type: (r['type'] ?? '').trim(),
        code: (r['code'] ?? '').trim(),
        description: (r['description'] ?? '').trim(),
        translation: {
          name: { en: (r['nameEn'] ?? '').trim(), ar: (r['nameAr'] ?? '').trim() },
          description: { en: (r['descriptionEn'] ?? '').trim(), ar: (r['descriptionAr'] ?? '').trim() },
        },
      }));
      let serverFailed: MappedImportIssue[] = [];
      if (payload.length) {
        const res = await service.importAccounts(payload);
        if (!res?.success) throw new Error(res?.msg || t('ERR_FAILED'));
        // The server answers with one `{ AccountName, error }` per account it refused.
        serverFailed = (Array.isArray(res.data) ? res.data : [])
          .filter((e: any) => e)
          .map((e: any) => ({ row: 0, ref: e.AccountName ?? '', reason: String(e.error ?? '') }));
      }
      return {
        total: rows.length,
        ready: send.length,
        imported: send.length - serverFailed.length,
        skipped,
        failed: [...failed, ...serverFailed],
      };
    },
  };
}
