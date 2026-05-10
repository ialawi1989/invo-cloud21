// ────────────────────────────────────────────────────────────────────
// Minimal XLSX writer.
//
// XLSX is just a ZIP archive of a few XML files. For a tiny template
// (header + sample row) we don't need compression — the ZIP "stored"
// format (no DEFLATE) is enough, and lets us avoid pulling in a
// 200 KB SheetJS dep for a couple of hundred bytes of output.
//
// What we ship per archive:
//   • [Content_Types].xml            — content-type registry
//   • _rels/.rels                    — root rels → workbook
//   • xl/workbook.xml                — workbook with one sheet
//   • xl/_rels/workbook.xml.rels     — workbook rels → sheet1
//   • xl/worksheets/sheet1.xml       — the actual rows
//
// Strings are written inline (`<c t="inlineStr"><is><t>…</t></is></c>`)
// so we don't need the shared-strings table — keeps the output flat.
//
// Returns a `Blob` ready to hand to a download anchor.
// ────────────────────────────────────────────────────────────────────

/** CRC-32 of a byte array. Standard polynomial (0xEDB88320) — same
 *  flavour the ZIP spec mandates for entry checksums. The lookup
 *  table is built once per call (cheap, ~256 entries). */
function crc32(bytes: Uint8Array): number {
  // Build the lookup table on each call — the cost is trivial vs.
  // module-level state for a feature this small, and it keeps the
  // helper a single self-contained function.
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = (table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Encode a JS string into UTF-8 bytes. */
function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** XML-safe escape. Sufficient for our header + numeric/string body
 *  cells; we don't pass markup into the values. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Spreadsheet column letter for a 0-based index. 0→A, 25→Z, 26→AA. */
function colLetter(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Build the worksheet XML for `rows`. Numbers are emitted with
 *  `t="n"`; strings with `t="inlineStr"`. */
function sheetXml(rows: (string | number)[][]): string {
  let body = '';
  rows.forEach((row, ri) => {
    const r = ri + 1;
    body += `<row r="${r}">`;
    row.forEach((cell, ci) => {
      const ref = `${colLetter(ci)}${r}`;
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        body += `<c r="${ref}" t="n"><v>${cell}</v></c>`;
      } else {
        body += `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(String(cell))}</t></is></c>`;
      }
    });
    body += '</row>';
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

interface ZipEntry { name: string; data: Uint8Array; }

/** Pack a list of named byte arrays into a ZIP using stored
 *  compression. Returns the full archive as a Uint8Array.
 *
 *  Format references:
 *    - Local file header (signature 0x04034b50, ~30 bytes)
 *    - File data (raw, since stored = no compression)
 *    - Central directory entry (signature 0x02014b50, ~46 bytes)
 *    - End of central directory record (signature 0x06054b50)
 */
function buildZip(entries: ZipEntry[]): Uint8Array {
  // Two passes: collect each entry's local header + data, then the
  // central directory pointing at every entry's offset.
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    // Local file header: 30 + name length bytes
    const lfh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0,  0x04034b50, true); // signature
    lv.setUint16(4,  20,         true); // version needed
    lv.setUint16(6,  0,          true); // flags
    lv.setUint16(8,  0,          true); // compression = stored
    lv.setUint16(10, 0,          true); // mod time
    lv.setUint16(12, 0,          true); // mod date
    lv.setUint32(14, crc,        true); // CRC-32
    lv.setUint32(18, size,       true); // compressed size
    lv.setUint32(22, size,       true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0,          true); // extra field length
    lfh.set(nameBytes, 30);

    localChunks.push(lfh);
    localChunks.push(e.data);

    // Central directory entry: 46 + name length bytes
    const cdh = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0,  0x02014b50, true);
    cv.setUint16(4,  20,         true);
    cv.setUint16(6,  20,         true);
    cv.setUint16(8,  0,          true);
    cv.setUint16(10, 0,          true);
    cv.setUint16(12, 0,          true);
    cv.setUint16(14, 0,          true);
    cv.setUint32(16, crc,        true);
    cv.setUint32(20, size,       true);
    cv.setUint32(24, size,       true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0,          true);
    cv.setUint16(32, 0,          true);
    cv.setUint16(34, 0,          true);
    cv.setUint16(36, 0,          true);
    cv.setUint32(38, 0,          true);
    cv.setUint32(42, offset,     true);
    cdh.set(nameBytes, 46);

    centralChunks.push(cdh);
    offset += lfh.length + e.data.length;
  }

  // End of central directory
  const centralStart = offset;
  let centralLen = 0;
  for (const c of centralChunks) centralLen += c.length;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0,  0x06054b50,        true);
  ev.setUint16(4,  0,                 true);
  ev.setUint16(6,  0,                 true);
  ev.setUint16(8,  entries.length,    true);
  ev.setUint16(10, entries.length,    true);
  ev.setUint32(12, centralLen,        true);
  ev.setUint32(16, centralStart,      true);
  ev.setUint16(20, 0,                 true); // comment length

  const total = offset + centralLen + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of localChunks)   { out.set(c, pos); pos += c.length; }
  for (const c of centralChunks) { out.set(c, pos); pos += c.length; }
  out.set(eocd, pos);
  return out;
}

/** Build a minimal XLSX as a Blob from a row matrix. Strings and
 *  finite numbers are written; everything else is coerced via
 *  `String()`. */
export function buildXlsxBlob(rows: (string | number)[][]): Blob {
  const sheet = sheetXml(rows);
  const archive = buildZip([
    { name: '[Content_Types].xml',           data: enc(CONTENT_TYPES_XML) },
    { name: '_rels/.rels',                   data: enc(ROOT_RELS_XML) },
    { name: 'xl/workbook.xml',               data: enc(WORKBOOK_XML) },
    { name: 'xl/_rels/workbook.xml.rels',    data: enc(WORKBOOK_RELS_XML) },
    { name: 'xl/worksheets/sheet1.xml',      data: enc(sheet) },
  ]);
  // Cast through `BlobPart` — recent TS lib types narrow `Uint8Array`'s
  // buffer to `ArrayBufferLike` (which includes `SharedArrayBuffer`),
  // and the Blob constructor signature wants a non-shared buffer view.
  // Our archive is plain heap memory, so the cast is safe.
  return new Blob([archive as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
