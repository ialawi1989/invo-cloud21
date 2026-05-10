// ────────────────────────────────────────────────────────────────────
// Tiny CSV / TSV reader for the import wizard.
//
// Handles the cases we actually see in user-pasted exports:
//   • comma OR tab delimited (auto: whichever is more frequent)
//   • "double-quoted" cells with embedded delimiters and "" escapes
//   • optional header row — auto-detected when the first row's cells
//     match the configured column keys/labels
//
// Not RFC 4180 compliant — multi-line cells (newlines inside quotes)
// are intentionally not supported. The wizard's input is "rows of
// records", and supporting embedded newlines would force us to push
// state across lines for very little real-world payoff.
// ────────────────────────────────────────────────────────────────────

export interface CsvColumn {
  key:   string;
  label: string;
}

/** Parse `text` into an array of records keyed by `columns[i].key`.
 *  Missing trailing cells become empty strings, so callers can rely
 *  on `row[col.key]` being defined for every configured column. */
export function parseCsv(text: string, columns: CsvColumn[]): Record<string, string>[] {
  if (!text || !columns.length) return [];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length) return [];

  // Pick the delimiter once for the whole document — mixing , and \t
  // within a single paste is unusual and would otherwise need per-line
  // detection.
  const delim = pickDelimiter(lines);

  const out: Record<string, string>[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    if (i === 0 && isHeaderRow(cells, columns)) continue;

    const row: Record<string, string> = {};
    for (let c = 0; c < columns.length; c++) {
      row[columns[c].key] = (cells[c] ?? '').trim();
    }
    out.push(row);
  }
  return out;
}

/** Counts tabs vs commas across all sample lines and returns whichever
 *  appears more often. Defaults to comma when neither is present. */
function pickDelimiter(lines: string[]): ',' | '\t' {
  const sample = lines.slice(0, 5).join('\n');
  let tabs = 0, commas = 0;
  for (const ch of sample) {
    if (ch === '\t') tabs++;
    else if (ch === ',') commas++;
  }
  return tabs > commas ? '\t' : ',';
}

/** Split a single line on `delim`, honouring `"…"` quoting and
 *  RFC-4180-style `""` doubled-quote escapes inside a quoted cell. */
function splitLine(line: string, delim: ',' | '\t'): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else                                 { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** A row is treated as a header when every configured column has a
 *  cell whose value matches its `key` or `label` (case-insensitive). */
function isHeaderRow(cells: string[], columns: CsvColumn[]): boolean {
  if (cells.length < columns.length) return false;
  for (let i = 0; i < columns.length; i++) {
    const v = (cells[i] ?? '').trim().toLowerCase();
    const k = columns[i].key.toLowerCase();
    const l = columns[i].label.toLowerCase();
    if (v !== k && v !== l) return false;
  }
  return true;
}
