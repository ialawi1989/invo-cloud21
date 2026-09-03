// ────────────────────────────────────────────────────────────────────
// Generic CSV reader for the File Reconciliation tool.
//
// Unlike `shared/components/import-wizard/csv-parser.ts` (which parses
// against a caller-supplied, fixed column schema) this tool has no
// schema up front — the whole point is that the user picks which
// column is the reference / amount / date column AFTER we show them
// the file's own headers. So parsing here just needs to detect the
// header row and hand back `{ headers, rows }`; the quote/delimiter
// handling below intentionally mirrors that sibling file's approach
// (comma-or-tab auto-detect, "quoted, cells" with "" escapes) so the
// two CSV readers in this feature area behave the same way.
//
// v1 is CSV-only — Excel support is intentionally out of scope here,
// same as it was left as a TODO in the throwaway prototype this tool
// is based on.
// ────────────────────────────────────────────────────────────────────

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Parse `text` (a full CSV file's contents) into headers + rows.
 *  The first non-blank line is always treated as the header row —
 *  reconciliation exports (bank statements, POS exports, ledgers)
 *  reliably have one, and column mapping needs named headers to
 *  populate the picker anyway. Duplicate header names are
 *  disambiguated with a `_2`, `_3`, … suffix so every column stays
 *  addressable by a unique key. */
export function parseGenericCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const delim = pickDelimiter(lines);
  const headers = dedupeHeaders(splitLine(lines[0], delim).map(h => h.trim()));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (cells[c] ?? '').trim();
    }
    rows.push(row);
  }
  return { headers, rows };
}

/** Counts tabs vs commas across the first few lines and returns
 *  whichever appears more often. Defaults to comma. */
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
 *  RFC-4180-style `""` doubled-quote escapes inside a quoted cell.
 *  Not RFC 4180 complete — embedded newlines inside quoted cells
 *  aren't supported, matching the same trade-off the import wizard's
 *  parser makes (real-world exports rarely need it). */
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

function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    const label = h || `Column ${i + 1}`;
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    return count === 0 ? label : `${label}_${count + 1}`;
  });
}
