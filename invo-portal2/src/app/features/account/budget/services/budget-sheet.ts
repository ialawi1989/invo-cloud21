import { BudgetAccount, BudgetPeriodicity } from '../models/budget.model';

export type SheetKey = 'pl' | 'bs';

/** A column of the grid. `key` is what the server stores / returns as `periodFilter`. */
export interface PeriodCol { key: string; label: string; }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The periods of a budget - same keys the server's actual-vs-plan query produces (`January`, `q1`, `1H`, the year). */
export function periodColumns(periodicity: BudgetPeriodicity | '', year: number, t: (key: string) => string): PeriodCol[] {
  switch (periodicity) {
    case 'monthly': return MONTHS.map(m => ({ key: m, label: t('BUDGET.MONTHS.' + m) }));
    case 'quarterly': return ['q1', 'q2', 'q3', 'q4'].map(q => ({ key: q, label: t('BUDGET.QUARTERS.' + q) }));
    case 'half': return ['1H', '2H'].map(h => ({ key: h, label: t('BUDGET.HALVES.' + h) }));
    case 'yearly': return [{ key: String(year), label: String(year) }];
    default: return [];
  }
}

/** A total / derived line: the sum of whole account groups (by parent type), each added or subtracted. */
export interface Spec { terms: { parentType: string; sign: 1 | -1 }[]; }

export type SheetRow =
  | { kind: 'title'; key: string; label: string }
  | { kind: 'group'; key: string; label: string }
  | { kind: 'account'; key: string; account: BudgetAccount }
  | { kind: 'total'; key: string; label: string; spec: Spec };

const OI = 'Operating Income';
const COGS = 'Costs Of Goods Sold';
const OPEX = 'Operating Expense';
const CA = 'Current Assets';
const OCA = 'Other Current Assets';
const CL = 'Current Liabilities';
const EQ = 'Equity';

type Block = { section: string } | { derived: string; terms: Spec['terms'] };

const LAYOUT: Record<SheetKey, Block[]> = {
  pl: [
    { section: OI },
    { section: COGS },
    { derived: 'GROSS_PROFIT', terms: [{ parentType: OI, sign: 1 }, { parentType: COGS, sign: -1 }] },
    { section: OPEX },
    { derived: 'OPERATING_PROFIT', terms: [{ parentType: OI, sign: 1 }, { parentType: COGS, sign: -1 }, { parentType: OPEX, sign: -1 }] },
    { derived: 'NET_PROFIT', terms: [{ parentType: OI, sign: 1 }, { parentType: COGS, sign: -1 }, { parentType: OPEX, sign: -1 }] },
  ],
  bs: [
    { section: CA },
    { section: OCA },
    { derived: 'TOTAL_ASSETS', terms: [{ parentType: CA, sign: 1 }, { parentType: OCA, sign: 1 }] },
    { section: CL },
    { section: EQ },
    { derived: 'TOTAL_LIABILITIES_EQUITY', terms: [{ parentType: EQ, sign: 1 }, { parentType: CL, sign: 1 }] },
  ],
};

const SECTION_KEY: Record<string, string> = {
  [OI]: 'OPERATING_INCOME', [COGS]: 'COSTS_OF_GOODS_SOLD', [OPEX]: 'OPERATING_EXPENSE',
  [CA]: 'CURRENT_ASSETS', [OCA]: 'OTHER_CURRENT_ASSETS', [CL]: 'CURRENT_LIABILITIES', [EQ]: 'EQUITY',
};

/** The accounts a sheet shows (legacy sections only; other parent types come back from the server but were never drawn). */
export function sheetParentTypes(sheet: SheetKey): string[] {
  return LAYOUT[sheet].flatMap(b => 'section' in b ? [b.section] : []);
}

/** The rows of a sheet: per section a title, its account groups (by account type) with their accounts, and a total; then the derived lines. */
export function buildSheetRows(sheet: SheetKey, accounts: BudgetAccount[], t: (key: string, params?: object) => string): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const block of LAYOUT[sheet]) {
    if ('derived' in block) {
      rows.push({ kind: 'total', key: 'd:' + block.derived, label: t('BUDGET.SHEET.' + block.derived), spec: { terms: block.terms } });
      continue;
    }
    const title = t('BUDGET.SECTIONS.' + SECTION_KEY[block.section]);
    rows.push({ kind: 'title', key: 't:' + block.section, label: title });
    const groups = new Map<string, BudgetAccount[]>();
    for (const a of accounts.filter(x => x.parentType === block.section)) {
      const g = groups.get(a.type) ?? [];
      g.push(a);
      groups.set(a.type, g);
    }
    for (const [type, list] of groups) {
      rows.push({ kind: 'group', key: `g:${block.section}:${type}`, label: type });
      for (const a of list) rows.push({ kind: 'account', key: 'a:' + a.accountId, account: a });
    }
    rows.push({ kind: 'total', key: 'x:' + block.section, label: t('BUDGET.SHEET.TOTAL_FOR', { name: title }), spec: { terms: [{ parentType: block.section, sign: 1 }] } });
  }
  return rows;
}

/** A typed cell as a number (blank / not a number counts as 0). */
export function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
