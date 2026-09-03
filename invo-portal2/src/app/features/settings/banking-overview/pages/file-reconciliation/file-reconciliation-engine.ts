// ────────────────────────────────────────────────────────────────────
// Pure client-side matching logic for the File Reconciliation tool.
//
// No backend call, no persistence — the two parsed CSVs live only in
// this page's memory. The approach:
//
//   1. Index file 2's rows by the chosen match key(s).
//   2. Scan file 1's rows once, looking each one up in that index.
//   3. Whichever file-2 row is consumed by a match is removed from
//      the "still available" pool, so it can't be matched twice and
//      correctly falls out of `unmatchedFile2`.
//
// "Try Both" builds both indices up front and, for each file-1 row,
// tries the reference match first and falls back to amount+date —
// mirrors the reference prototype's approach, rewritten with real
// types instead of the loose JS it used.
// ────────────────────────────────────────────────────────────────────

export type CsvRow = Record<string, string>;

export type MatchMethod = 'reference' | 'amount-date' | 'both';

export interface ColumnMapping {
  referenceCol: string | null;
  amountCol:    string | null;
  dateCol:      string | null;
}

export type MatchedBy = 'reference' | 'amount-date';

export interface MatchedPair {
  file1: CsvRow;
  file2: CsvRow;
  matchedBy: MatchedBy;
}

export interface ReconciliationResult {
  matched:        MatchedPair[];
  unmatchedFile1: CsvRow[];
  unmatchedFile2: CsvRow[];
}

/** Reconcile `file1Rows` against `file2Rows` using the configured
 *  column mapping, match method, and (for amount+date matching) an
 *  absolute amount tolerance. */
export function reconcile(
  file1Rows: CsvRow[],
  file2Rows: CsvRow[],
  mapping1:  ColumnMapping,
  mapping2:  ColumnMapping,
  method:    MatchMethod,
  tolerance: number,
): ReconciliationResult {
  const useReference  = method === 'reference' || method === 'both';
  const useAmountDate = method === 'amount-date' || method === 'both';

  const referenceIndex = useReference && mapping2.referenceCol
    ? buildReferenceIndex(file2Rows, mapping2.referenceCol)
    : null;

  const dateIndex = useAmountDate && mapping2.dateCol && mapping2.amountCol
    ? buildDateIndex(file2Rows, mapping2.dateCol, mapping2.amountCol)
    : null;

  const usedFile2 = new Set<number>();
  const matched: MatchedPair[] = [];
  const unmatchedFile1: CsvRow[] = [];

  for (const row of file1Rows) {
    let matchIdx: number = -1;
    let matchedBy: MatchedBy | null = null;

    if (referenceIndex && mapping1.referenceCol) {
      const key = normalizeReference(row[mapping1.referenceCol]);
      const bucket = key ? referenceIndex.get(key) : undefined;
      const idx = bucket?.find(i => !usedFile2.has(i));
      if (idx != null) { matchIdx = idx; matchedBy = 'reference'; }
    }

    if (matchIdx < 0 && dateIndex && mapping1.dateCol && mapping1.amountCol) {
      const dateKey = normalizeDate(row[mapping1.dateCol]);
      const amount1 = normalizeAmount(row[mapping1.amountCol]);
      const bucket = dateIndex.get(dateKey) ?? [];

      let best = -1;
      let bestDiff = Infinity;
      for (const { index, amount } of bucket) {
        if (usedFile2.has(index)) continue;
        const diff = Math.abs(amount1 - amount);
        if (diff <= tolerance && diff < bestDiff) { best = index; bestDiff = diff; }
      }
      if (best >= 0) { matchIdx = best; matchedBy = 'amount-date'; }
    }

    if (matchIdx >= 0 && matchedBy) {
      usedFile2.add(matchIdx);
      matched.push({ file1: row, file2: file2Rows[matchIdx], matchedBy });
    } else {
      unmatchedFile1.push(row);
    }
  }

  const unmatchedFile2 = file2Rows.filter((_, i) => !usedFile2.has(i));

  return { matched, unmatchedFile1, unmatchedFile2 };
}

// ─── Indexing ──────────────────────────────────────────────────────

function buildReferenceIndex(rows: CsvRow[], col: string): Map<string, number[]> {
  const index = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const key = normalizeReference(row[col]);
    if (!key) return;
    const bucket = index.get(key);
    if (bucket) bucket.push(i); else index.set(key, [i]);
  });
  return index;
}

function buildDateIndex(
  rows: CsvRow[], dateCol: string, amountCol: string,
): Map<string, { index: number; amount: number }[]> {
  const index = new Map<string, { index: number; amount: number }[]>();
  rows.forEach((row, i) => {
    const key = normalizeDate(row[dateCol]);
    const entry = { index: i, amount: normalizeAmount(row[amountCol]) };
    const bucket = index.get(key);
    if (bucket) bucket.push(entry); else index.set(key, [entry]);
  });
  return index;
}

// ─── Normalization ─────────────────────────────────────────────────

/** Case/whitespace-insensitive reference comparison — bank/POS
 *  exports are inconsistent about casing and padding on the same
 *  reference number. */
export function normalizeReference(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Strips currency symbols, thousands separators, and stray
 *  whitespace, then parses the remainder as a float. Non-numeric
 *  input normalizes to 0 (treated as "no usable amount"). */
export function normalizeAmount(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Normalizes to `YYYY-MM-DD` when the value parses as a date, so
 *  "2024-01-05", "01/05/2024" and "5 Jan 2024" all index together.
 *  Falls back to the trimmed raw string when it doesn't parse,
 *  rather than silently collapsing every bad date to one bucket. */
export function normalizeDate(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.toLowerCase();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
