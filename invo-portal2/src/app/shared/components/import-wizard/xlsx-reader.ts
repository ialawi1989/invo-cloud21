// ────────────────────────────────────────────────────────────────────
// Minimal XLSX reader.
//
// Counterpart to `xlsx-writer.ts` — reads the first worksheet of an
// xlsx file and returns its rows as `string[][]`. Built on the
// browser's native `DecompressionStream('deflate-raw')` so we
// don't pull in a 200 KB SheetJS dep.
//
// What we handle:
//   • ZIP archive parsing (EOCD → central directory → entries)
//   • Stored (method 0) and DEFLATE (method 8) compression
//   • Shared-strings table (`xl/sharedStrings.xml`)
//   • Inline strings (`<c t="inlineStr">`)
//   • Number cells (`<c><v>10.5</v></c>`)
//   • Boolean / error cells (returned as strings)
//
// What we don't handle (intentional, scope-driven):
//   • Multi-sheet workbooks beyond the first sheet
//   • Cell formatting / number-format codes (numbers are emitted
//     as decimal strings — feeders are expected to coerce in
//     their per-row validator)
//   • Date types — XLSX dates are stored as serial numbers;
//     leaving the conversion to the caller keeps this decoupled
//   • Formulas — we read the cached `<v>` value
//
// Browser compat: `DecompressionStream('deflate-raw')` is available
// in Chrome 80+, Safari 16.4+, Firefox 113+ — broad enough for an
// admin tool, narrow enough that legacy IE etc. won't regress.
// ────────────────────────────────────────────────────────────────────

/** Read the first worksheet of `file` as a row matrix. Empty cells
 *  are filled with empty strings up to the highest-touched column
 *  index in each row, so callers can reliably index by column. */
export async function readXlsx(file: File): Promise<string[][]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = await unzip(buf);

  const ssXml = entries['xl/sharedStrings.xml'];
  const sharedStrings = ssXml ? parseSharedStrings(decode(ssXml)) : [];

  // Pick the first worksheet. Workbook XML lists sheets in order;
  // we don't need to parse it — sheet1.xml is the conventional
  // first slot, and falling back to "first xl/worksheets/*.xml"
  // covers the few writers that name their sheets differently.
  let sheet = entries['xl/worksheets/sheet1.xml'];
  if (!sheet) {
    const key = Object.keys(entries).find(k => /^xl\/worksheets\/.+\.xml$/i.test(k));
    if (key) sheet = entries[key];
  }
  if (!sheet) return [];

  return parseSheet(decode(sheet), sharedStrings);
}

// ─── ZIP parser ─────────────────────────────────────────────────────

interface ZipEntryMeta {
  method: number;     // 0 = stored, 8 = deflate
  size:   number;     // uncompressed
  csize:  number;     // compressed
  offset: number;     // local-header offset
}

/** Parse the ZIP container in `buf` and return inflated entries
 *  keyed by their archive name. */
async function unzip(buf: Uint8Array): Promise<Record<string, Uint8Array>> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // Find End-Of-Central-Directory (EOCD) record. Search backward
  // from the tail — the spec allows a trailing comment up to 64KB.
  const eocdOffset = findEOCD(buf, dv);
  if (eocdOffset < 0) throw new Error('Not a valid ZIP/XLSX file (EOCD missing).');

  const cdSize  = dv.getUint32(eocdOffset + 12, true);
  const cdStart = dv.getUint32(eocdOffset + 16, true);

  // Walk the central directory.
  const out: Record<string, Uint8Array> = {};
  let cur = cdStart;
  const cdEnd = cdStart + cdSize;
  while (cur < cdEnd) {
    if (dv.getUint32(cur, true) !== 0x02014b50) break;
    const method     = dv.getUint16(cur + 10, true);
    const csize      = dv.getUint32(cur + 20, true);
    const size       = dv.getUint32(cur + 24, true);
    const nameLen    = dv.getUint16(cur + 28, true);
    const extraLen   = dv.getUint16(cur + 30, true);
    const commentLen = dv.getUint16(cur + 32, true);
    const lhOffset   = dv.getUint32(cur + 42, true);
    const name = decode(buf.subarray(cur + 46, cur + 46 + nameLen));
    cur += 46 + nameLen + extraLen + commentLen;

    out[name] = await readEntry(buf, dv, { method, size, csize, offset: lhOffset });
  }
  return out;
}

function findEOCD(buf: Uint8Array, dv: DataView): number {
  // EOCD is at least 22 bytes; the comment field that precedes
  // EOF can push it back up to 65535 bytes from the end.
  const minStart = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= minStart; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

async function readEntry(buf: Uint8Array, dv: DataView, meta: ZipEntryMeta): Promise<Uint8Array> {
  // Skip the local file header to land on the entry's data. The
  // local header repeats name/extra lengths — they may differ from
  // the central-directory copies (extra-field padding, etc.) so
  // we re-read them here.
  if (dv.getUint32(meta.offset, true) !== 0x04034b50) {
    throw new Error('Bad local-header signature in XLSX zip.');
  }
  const nameLen  = dv.getUint16(meta.offset + 26, true);
  const extraLen = dv.getUint16(meta.offset + 28, true);
  const dataStart = meta.offset + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + meta.csize);

  if (meta.method === 0) return new Uint8Array(data);          // stored
  if (meta.method === 8) return await inflateRaw(data);        // deflate
  throw new Error(`Unsupported XLSX compression method: ${meta.method}`);
}

/** Inflate raw DEFLATE bytes via the browser's `DecompressionStream`.
 *  Falls through with a descriptive error on older browsers without
 *  the API — the wizard's CSV path still works in that case. */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('XLSX reader needs DecompressionStream support (Chrome 80+, Safari 16.4+, Firefox 113+).');
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

// ─── XML parsers ────────────────────────────────────────────────────

const decoder = new TextDecoder('utf-8');
function decode(b: Uint8Array): string { return decoder.decode(b); }

function parseSharedStrings(xml: string): string[] {
  // Each `<si>…</si>` is one shared-string entry, possibly broken
  // into multiple `<t>` runs with rich-text formatting. We
  // concatenate the `<t>` contents and ignore the formatting.
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  const tRe  = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml)) !== null) {
    let combined = '';
    let inner: RegExpExecArray | null;
    tRe.lastIndex = 0;
    while ((inner = tRe.exec(m[1])) !== null) {
      combined += xmlUnescape(inner[1]);
    }
    out.push(combined);
  }
  return out;
}

function parseSheet(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];

  // Per-row: capture all cells, place them at their column index.
  // `<row …>…</row>` may carry `r="N"` for sparse sheets — we
  // honour it so blank rows in the source don't collapse, but
  // most exports lay rows down sequentially anyway.
  const rowRe  = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml)) !== null) {
    const rowAttrs = rm[1];
    const rowR = /\br="(\d+)"/.exec(rowAttrs);
    const targetIdx = rowR ? parseInt(rowR[1], 10) - 1 : rows.length;

    // Pad with empties for any sparse gaps before this row.
    while (rows.length <= targetIdx) rows.push([]);
    const row = rows[targetIdx];

    let cm: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cm = cellRe.exec(rm[2])) !== null) {
      const attrs = cm[1] || '';
      const inner = cm[2] ?? '';
      const refMatch = /\br="([A-Z]+)\d+"/.exec(attrs);
      const colIdx   = refMatch ? colLetterToIndex(refMatch[1]) : row.length;
      const tMatch   = /\bt="([^"]+)"/.exec(attrs);
      const t        = tMatch ? tMatch[1] : '';
      const value    = decodeCell(t, inner, sharedStrings);

      while (row.length <= colIdx) row.push('');
      row[colIdx] = value;
    }
  }

  // Drop trailing fully-empty rows (Excel often pads with one).
  while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
  return rows;
}

function decodeCell(t: string, inner: string, sharedStrings: string[]): string {
  // Inline string: <c t="inlineStr"><is><t>…</t></is></c>
  if (t === 'inlineStr' || t === 'str') {
    const m = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(inner);
    return m ? xmlUnescape(m[1]) : '';
  }
  // Shared string: <c t="s"><v>INDEX</v></c>
  if (t === 's') {
    const m = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
    if (!m) return '';
    const idx = parseInt(m[1], 10);
    return Number.isFinite(idx) ? (sharedStrings[idx] ?? '') : '';
  }
  // Boolean / error / number / formula-cached value — read <v>.
  const m = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
  if (!m) return '';
  if (t === 'b') return m[1] === '1' ? 'TRUE' : 'FALSE';
  return xmlUnescape(m[1]);
}

function colLetterToIndex(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g,  '&'); // ampersand last to avoid double-decoding
}
