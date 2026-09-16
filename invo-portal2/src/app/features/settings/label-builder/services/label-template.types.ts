// ────────────────────────────────────────────────────────────────────
// Label-builder type definitions.
//
// Mirrors the legacy InvoCloudFront2 element shapes 1:1 so existing
// templates persisted by the old client deserialize unchanged. Each
// element is a plain class with a `ParseJson(obj)` rehydrator and a
// `toLABEL(...)` ZPL emitter — preserves the behavior the old back-
// end expects when it stores `template: any[]`.
//
// Naming quirks worth keeping (these are persisted in production
// data — renaming would corrupt existing rows):
//   - `prerferences` (sic) on `LabelTemplateMap`
//   - `protien` (sic) inside `Nutrition`
// ────────────────────────────────────────────────────────────────────

export type LabelTemplateType = 'label' | 'kitchen';

export type LabelElementType =
  | 'Textbox'
  | 'Barcode'
  | 'QrCode'
  | 'Rectangle'
  | 'Circle'
  | 'HorizontalLine'
  | 'VerticalLine'
  | 'Image'
  | 'Logo';

export interface Position { x: number; y: number; }
export interface PixelSize { factor: number; pixel: number; }

/** Common surface every element exposes. Concrete classes add their
 *  own fields on top.
 *
 *  `locked` and `hidden` are layer-panel flags:
 *    - `locked` skips drag / resize / nudging on the canvas; the
 *      element still renders + still appears in ZPL output. Useful
 *      for keeping a positioned background fixed while editing
 *      foreground details.
 *    - `hidden` excludes the element from canvas render AND from
 *      ZPL output, so the user can stage variants (e.g. nutrition
 *      block toggled off for non-food labels) without deleting them.
 *
 *  Both default to `false` and are persisted as plain booleans, so
 *  legacy templates without the fields continue to parse correctly
 *  via `assignMatching` (the keys simply don't override). */
export interface LabelElement {
  type: LabelElementType;
  position: Position;
  locked?: boolean;
  hidden?: boolean;
  ParseJson(obj: any): void;
  toLABEL(labelX: number, labelY: number, labelHeight: number, labelWidth: number): string;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Copy any matching keys from `src` onto `dst` — used by every
 *  element's `ParseJson` to rehydrate a plain JSON blob into a class
 *  instance without enumerating every field. */
function assignMatching<T extends object>(dst: T, src: any): T {
  if (!src || typeof src !== 'object') return dst;
  for (const key of Object.keys(src)) {
    if (key in (dst as any)) (dst as any)[key] = src[key];
  }
  return dst;
}

/** Convert a 4-bit nibble (`"0001"`, `"1010"`, …) to its hex digit. */
function nibbleToHex(nibble: string): string {
  const v = parseInt(nibble, 2);
  if (Number.isNaN(v)) return '0';
  return v.toString(16).toUpperCase();
}

/**
 * Rasterize an image (DataURL or remote URL) to the ZPL `~DG`
 * download-graphic format. Returns the full `~DG…\n` payload string
 * which is prepended to the document by `generateZpl()` before the
 * elements that reference it via `^XGR:<imgId>`.
 *
 * Encoding pipeline (matches legacy):
 *   1. Draw the image onto an offscreen canvas at the target px size.
 *   2. Read pixels — anything brighter than mid-grey becomes white,
 *      else black (matches the legacy 3-channel sum >= 384 cutoff).
 *   3. Pack each row into bytes (8 px / byte, MSB-first) and emit
 *      hex; pad short rows with `00` so every row is `bytesPerLine`.
 *
 * Returns `''` (and logs nothing) if the image fails to load — the
 * caller still gets a valid ZPL document, just without that one
 * graphic; better than throwing in the middle of an export.
 */
export async function rasterizeImageToZpl(
  src: string,
  width: number,
  height: number,
  imgId: string,
): Promise<string> {
  if (!src || typeof window === 'undefined') return '';
  return new Promise<string>((resolve) => {
    const img = new Image(width, height);
    img.crossOrigin = '*';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        const bytesPerLine = Math.ceil(width / 8);
        let body = '';
        for (let y = 0; y < height; y++) {
          let nibble = '';
          let bytesEmitted = 0;
          for (let x = 0; x < width; x++) {
            const p = 4 * (width * y + x);
            const sum = data[p] + data[p + 1] + data[p + 2];
            // Match legacy: black pixels are those that drew non-
            // white *after* threshold (sum < 384). Pre-thresholding
            // by reading green=0 (after the ctx fill) is what the
            // legacy code did; we just inline the threshold.
            nibble += sum < 384 ? '1' : '0';
            if (nibble.length === 8) {
              body += nibbleToHex(nibble.slice(0, 4)) + nibbleToHex(nibble.slice(4));
              nibble = '';
              bytesEmitted++;
            }
          }
          if (nibble.length > 0) {
            while (nibble.length < 8) nibble += '0';
            body += nibbleToHex(nibble.slice(0, 4)) + nibbleToHex(nibble.slice(4));
            nibble = '';
            bytesEmitted++;
          }
          while (bytesEmitted < bytesPerLine) {
            body += '00';
            bytesEmitted++;
          }
          body += '\n';
        }
        const totalBytes = bytesPerLine * height;
        resolve(`~DG${imgId},${totalBytes},${bytesPerLine},${body}`);
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

// ── Textbox ─────────────────────────────────────────────────────────

export class ZplTextBox implements LabelElement {
  type: LabelElementType = 'Textbox';
  data = 'Textbox';
  fontSize = 15;
  fontWeight: 'normal' | 'bold' = 'normal';
  fontStyle: 'normal' | 'italic'  = 'normal';
  textDecoration: 'none' | 'underline' = 'none';
  position: Position = { x: 0, y: 0 };
  locked = false;
  hidden = false;

  constructor(position: Position = { x: 0, y: 0 }) {
    this.position = { ...position };
  }
  ParseJson(obj: any): void { assignMatching(this, obj); }
  toLABEL(): string {
    // `^A0N,<size>` = scalable font 0, no rotation. Legacy nudges
    // the print position by (+5,+5) to compensate for the canvas's
    // padding; preserved verbatim so saved templates print the same
    // place after the port.
    return `^FO${this.position.x + 5},${this.position.y + 5}^A0N,${this.fontSize}^FD${this.data}^FS`;
  }
}

// ── Barcode ─────────────────────────────────────────────────────────

export class ZplBarcode implements LabelElement {
  type: LabelElementType = 'Barcode';
  data = 'Barcode';
  height = 40;
  showValue = false;
  /** Barcode symbology — drives the jsbarcode-based preview/PNG
   *  render (`BarcodePreviewComponent`, `png-export.ts`) AND its
   *  per-format value validation. Mirrors the legacy `barcode.ts`
   *  field one-for-one (same default) so existing templates without
   *  it fall back to CODE128 exactly like before.
   *
   *  NOTE — matches legacy scope exactly: this only changes what the
   *  *browser* renders (editor canvas, PNG export, print preview).
   *  `toLABEL()` below is untouched and always emits CODE128 ZPL
   *  (`^B3N,N`) regardless of `format` — the legacy port never wired
   *  the format selector into the ZPL emitter either, so an actual
   *  Zebra printer still prints CODE128 for every barcode element.
   *  Wiring per-format ZPL commands (`^BE`, `^BU`, `^B3`, …) is a
   *  separate, larger change and out of scope here. */
  format = 'CODE128';
  position: Position = { x: 0, y: 0 };
  locked = false;
  hidden = false;

  constructor(position: Position = { x: 0, y: 0 }) {
    this.position = { ...position };
  }
  ParseJson(obj: any): void { assignMatching(this, obj); }
  toLABEL(): string {
    // `^BY1` sets the narrow-bar width to 1 dot. `^B3N,N,<h>,N`
    // selects CODE128 (the legacy choice) with no rotation, no
    // interpretation-line, given height, no above-text. Display of
    // the human-readable value below the bars is controlled by the
    // 4th param — `Y` to show, `N` to hide.
    const showLine = this.showValue ? 'Y' : 'N';
    return `^FO${this.position.x},${this.position.y}^BY1^B3N,N,${this.height},${showLine}^FD${this.data}^FS`;
  }
}

/** Barcode symbologies the browser-side renderer (`jsbarcode`, used
 *  by both `BarcodePreviewComponent` and `png-export.ts`) supports.
 *  Every value here is a real jsbarcode format string — nothing is
 *  listed that would silently render blank. `note` is a short usage
 *  hint shown under the format picker in the inspector. */
export const BARCODE_FORMATS: ReadonlyArray<{ value: string; label: string; note: string }> = [
  { value: 'CODE128',  label: 'CODE128',   note: 'General purpose. Accepts letters, numbers and symbols. Good default choice.' },
  { value: 'CODE128A', label: 'CODE128A',  note: 'CODE128 subset A. Uppercase letters, numbers and control characters only.' },
  { value: 'CODE128B', label: 'CODE128B',  note: 'CODE128 subset B. Upper/lowercase letters, numbers and punctuation.' },
  { value: 'CODE128C', label: 'CODE128C',  note: 'CODE128 subset C. Numbers only, in pairs (even digit count). Most compact for numeric data.' },
  { value: 'EAN13',    label: 'EAN13',     note: 'Standard 13-digit retail product barcode (International Article Number).' },
  { value: 'UPC',      label: 'UPC',       note: '12-digit retail product barcode, common in the US and Canada.' },
  { value: 'EAN8',     label: 'EAN8',      note: 'Shortened 8-digit EAN barcode, used on small packages.' },
  { value: 'EAN5',     label: 'EAN5',      note: '5-digit supplemental barcode, e.g. for book/publication pricing.' },
  { value: 'EAN2',     label: 'EAN2',      note: '2-digit supplemental barcode, e.g. for magazine issue numbers.' },
  { value: 'CODE39',   label: 'CODE39',    note: 'Letters, numbers and some symbols. Common in logistics and government use.' },
  { value: 'ITF',      label: 'ITF',       note: 'Interleaved 2 of 5. Numbers only, must have an even number of digits.' },
  { value: 'ITF14',    label: 'ITF14',     note: '14-digit ITF barcode used on shipping cartons and pallets.' },
  { value: 'MSI',      label: 'MSI',       note: 'Numeric barcode commonly used for inventory and warehouse shelf labels.' },
  { value: 'MSI10',    label: 'MSI10',     note: 'MSI barcode with a Modulo-10 check digit.' },
  { value: 'MSI11',    label: 'MSI11',     note: 'MSI barcode with a Modulo-11 check digit.' },
  { value: 'MSI1010',  label: 'MSI1010',   note: 'MSI barcode with two Modulo-10 check digits.' },
  { value: 'MSI1110',  label: 'MSI1110',   note: 'MSI barcode with Modulo-11 then Modulo-10 check digits.' },
  { value: 'pharmacode', label: 'Pharmacode', note: 'Numeric barcode used for pharmaceutical packaging control.' },
  { value: 'codabar',  label: 'Codabar',   note: 'Numbers and a few symbols. Common in libraries and blood banks.' },
];

/**
 * Whether `value` is well-formed enough for `format` to render
 * something meaningful via jsbarcode, instead of a broken/blank
 * barcode. Ported 1:1 from the legacy `label-builder.component.ts` /
 * `label-renderer.service.ts` validators (same regexes, same format
 * set) — used by both the live canvas preview and the PNG/print
 * export path so a mis-formatted value shows the same "invalid"
 * placeholder everywhere instead of a silently blank barcode.
 */
export function isBarcodeValueValid(value: string | undefined | null, format?: string): boolean {
  if (value == null || String(value).trim() === '') return false;

  const val = String(value).trim();
  const fmt = (format || '').toString().toUpperCase();

  switch (fmt) {
    case 'EAN13':
      return /^\d{12,13}$/.test(val);
    case 'EAN8':
      return /^\d{7,8}$/.test(val);
    case 'EAN5':
      return /^\d{5}$/.test(val);
    case 'EAN2':
      return /^\d{2}$/.test(val);
    case 'UPC':
      return /^\d{11,12}$/.test(val);
    case 'CODE128C':
      return /^\d+$/.test(val) && val.length % 2 === 0;
    case 'ITF':
      return /^\d+$/.test(val) && val.length % 2 === 0;
    case 'ITF14':
      return /^\d{14}$/.test(val);
    case 'MSI':
    case 'MSI10':
    case 'MSI11':
    case 'MSI1010':
    case 'MSI1110':
    case 'PHARMACODE':
      return /^\d+$/.test(val);
    case 'CODABAR':
      return /^[A-D0-9\-$:/.+]+$/i.test(val);
    case 'CODE39':
      return /^[A-Z0-9\-. $/+%]+$/.test(val);
    case 'CODE128':
    case 'CODE128A':
    case 'CODE128B':
    default:
      // General purpose formats accept most characters; empty was
      // already ruled out above.
      return true;
  }
}

// ── QR code ─────────────────────────────────────────────────────────

export class ZplQrCode implements LabelElement {
  type: LabelElementType = 'QrCode';
  data = 'Qr Code Content';
  size: PixelSize = { factor: 3, pixel: 80 };
  position: Position = { x: 0, y: 0 };
  locked = false;
  hidden = false;

  constructor(position: Position = { x: 0, y: 0 }) {
    this.position = { ...position };
  }
  ParseJson(obj: any): void {
    assignMatching(this, obj);
    if (obj?.size) this.size = { ...this.size, ...obj.size };
  }
  toLABEL(): string {
    // `^BQ,<model>,<factor>` = QR with model 2, magnification factor.
    // `^FDQ,<data>` — the leading `Q,` is the error-correction prefix
    // that ZPL expects on the field-data side.
    return `^FO${this.position.x + 10},${this.position.y}^BQ,2,${this.size.factor}^FDQ,${this.data}^FS`;
  }
}

// ── Rectangle ───────────────────────────────────────────────────────

export class ZplRectangle implements LabelElement {
  type: LabelElementType = 'Rectangle';
  width = 80;
  height = 80;
  borderThickness = 1;
  position: Position = { x: 0, y: 0 };
  locked = false;
  hidden = false;

  constructor(position: Position = { x: 0, y: 0 }) {
    this.position = { ...position };
  }
  ParseJson(obj: any): void { assignMatching(this, obj); }
  toLABEL(): string {
    // `^GB<w>,<h>,<thickness>` draws a graphic box. The trailing
    // `^FDQ,` is a legacy quirk preserved so saved templates emit
    // byte-for-byte identical ZPL after the port.
    return `^FO${this.position.x},${this.position.y}^GB${this.width},${this.height},${this.borderThickness}^FDQ,^FS`;
  }
}

// ── Circle ──────────────────────────────────────────────────────────

export class ZplCircle implements LabelElement {
  type: LabelElementType = 'Circle';
  circleDiameter = 80;
  borderThickness = 1;
  position: Position = { x: 0, y: 0 };
  locked = false;
  hidden = false;

  constructor(position: Position = { x: 0, y: 0 }) {
    this.position = { ...position };
  }
  ParseJson(obj: any): void { assignMatching(this, obj); }
  toLABEL(): string {
    // `^GC<diameter>,<thickness>,<color>` — `B` = black.
    return `^FO${this.position.x},${this.position.y}^GC${this.circleDiameter},${this.borderThickness},B^FS`;
  }
}

// ── Horizontal line ─────────────────────────────────────────────────

export class ZplHorizontalLine implements LabelElement {
  type: LabelElementType = 'HorizontalLine';
  width = 200;
  thick = 3;
  position: Position = { x: 0, y: 0 };
  locked = false;
  hidden = false;

  constructor(position: Position = { x: 0, y: 0 }) {
    this.position = { ...position };
  }
  ParseJson(obj: any): void { assignMatching(this, obj); }
  toLABEL(): string {
    // `^GB<w>,<h>,<thickness>` with h == thickness gives a flat bar.
    return `^FO${this.position.x},${this.position.y}^GB${this.width},${this.thick},${this.thick}^FS`;
  }
}

// ── Vertical line ───────────────────────────────────────────────────

export class ZplVerticalLine implements LabelElement {
  type: LabelElementType = 'VerticalLine';
  height = 100;
  thick = 3;
  position: Position = { x: 0, y: 0 };
  locked = false;
  hidden = false;

  constructor(position: Position = { x: 0, y: 0 }) {
    this.position = { ...position };
  }
  ParseJson(obj: any): void { assignMatching(this, obj); }
  toLABEL(): string {
    // Width is empty (so the box collapses to its thickness),
    // height carries the line length.
    return `^FO${this.position.x},${this.position.y}^GB,${this.thick},${this.height},${this.thick}^FS`;
  }
}

// ── Image ───────────────────────────────────────────────────────────

export class ZplImageElement implements LabelElement {
  type: LabelElementType = 'Image';
  id = '';
  src = '';
  width = 80;
  height = 80;
  /** Raw `~DG` definition emitted just before the `^FO…^XGR…` body
   *  reference. Populated by `rasterize()` (called in the form's
   *  ZPL-export flow); empty until the first export. */
  bufferData = '';
  position: Position = { x: 0, y: 0 };
  locked = false;
  hidden = false;

  constructor(id = '', position: Position = { x: 0, y: 0 }, src = '') {
    this.id = id;
    this.position = { ...position };
    this.src = src;
  }
  ParseJson(obj: any): void { assignMatching(this, obj); }
  toLABEL(): string {
    // `^XGR:IMG<id>` references a resident graphic that the matching
    // `~DG` (in `bufferData`, prepended to the document by the
    // exporter) will have just downloaded to the printer.
    return `^FO${this.position.x},${this.position.y}^XGR:IMG${this.id},1,1^FDQ,^FS`;
  }
  async rasterize(): Promise<void> {
    this.bufferData = await rasterizeImageToZpl(this.src, this.width, this.height, `IMG${this.id}`);
  }
}

// ── Logo (same shape as Image, distinct type so the company logo can
//        replace `src` automatically) ─────────────────────────────────

export class ZplLogoElement implements LabelElement {
  type: LabelElementType = 'Logo';
  id = '';
  src = '';
  width = 80;
  height = 80;
  bufferData = '';
  position: Position = { x: 0, y: 0 };
  locked = false;
  hidden = false;

  constructor(id = '', position: Position = { x: 0, y: 0 }, src = '') {
    this.id = id;
    this.position = { ...position };
    this.src = src;
  }
  ParseJson(obj: any): void { assignMatching(this, obj); }
  toLABEL(): string {
    return `^FO${this.position.x},${this.position.y}^XGR:IMG${this.id},1,1^FDQ,^FS`;
  }
  async rasterize(): Promise<void> {
    this.bufferData = await rasterizeImageToZpl(this.src, this.width, this.height, `IMG${this.id}`);
  }
}

// ── parseType / hydrate helpers ─────────────────────────────────────

/** Re-instantiate the right element subclass from a plain object.
 *  Falls back to `ZplTextBox` for unknown types (matches legacy
 *  behavior so old/corrupt templates still load). */
export function parseElement(obj: any): LabelElement {
  let parsed: LabelElement;
  switch (obj?.type) {
    case 'Textbox':         parsed = new ZplTextBox();        break;
    case 'QrCode':          parsed = new ZplQrCode();         break;
    case 'Barcode':         parsed = new ZplBarcode();        break;
    case 'Rectangle':       parsed = new ZplRectangle();      break;
    case 'Circle':          parsed = new ZplCircle();         break;
    case 'HorizontalLine':  parsed = new ZplHorizontalLine(); break;
    case 'VerticalLine':    parsed = new ZplVerticalLine();   break;
    case 'Image':           parsed = new ZplImageElement();   break;
    case 'Logo':            parsed = new ZplLogoElement();    break;
    default:                parsed = new ZplTextBox();
  }
  parsed.ParseJson(obj);
  return parsed;
}

// ── Top-level template ──────────────────────────────────────────────

/** Common DPI presets — the `<select>` in the inspector uses these.
 *  Other values are still accepted on persisted templates. */
export const DPI_PRESETS: ReadonlyArray<number> = [152, 203, 300, 600];

export class LabelTemplate {
  id = '';
  name = '';
  companyId = '';
  template: LabelElement[] = [];
  /** ZPL output cache — set by the form when the user clicks
   *  Generate, otherwise empty. The list page reads it as-is. */
  LABEL = '';
  labelHeight = 0.75;  // inches
  labelWidth  = 1.75;  // inches
  dpi         = 203;
  source: string = 'none';
  templateType: LabelTemplateType | '' = '';

  /** Preview-only; transient. Not persisted server-side, only used by
   *  the canvas to render representative dummy data inside textbox /
   *  barcode tokens. */
  type: 'zpl' = 'zpl';

  /** Dirty flag — set by the form on every mutation, cleared on save
   *  / load. Never persisted. */
  isChanged: boolean | null = false;

  /** Runtime mapping abbr → custom-field id for token resolution. Not
   *  persisted; rebuilt from `customFields` on load. */
  customFieldsMap?: Map<string, string>;

  ParseJson(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (key === 'template') {
        this.template = Array.isArray(obj.template)
          ? obj.template.filter(Boolean).map(parseElement)
          : [];
      } else if (key in this) {
        (this as any)[key] = obj[key];
      }
    }
  }

  /** Plain-object snapshot for save. Drops transient fields
   *  (`isChanged`, `customFieldsMap`). */
  toJSON(): any {
    const { isChanged: _ignored1, customFieldsMap: _ignored2, ...rest } = this;
    return { ...rest };
  }
}

/** Lightweight row shape returned by the list endpoint.
 *
 *  The list endpoint now also returns the `template[]` element array
 *  inline so the list page can render real thumbnails without paying
 *  N round-trips to `/getLabelTemplate/:id` (one per row scrolled
 *  into view). The full editor still calls `getById` so it can be
 *  bookmarked / deep-linked without depending on a list fetch. */
export interface LabelTemplateSummary {
  id: string;
  name: string;
  templateType: LabelTemplateType | '';
  labelHeight: number;
  labelWidth: number;
  dpi: number;
  updatedDate?: string;
  /** Element array, when the list endpoint provides it inline. The
   *  list page rehydrates this into a `LabelTemplate` for the
   *  thumbnail. Optional so the older endpoint shape still works. */
  template?: any[];
}

// ── ZPL document generator ──────────────────────────────────────────

/** Standard ZPL preamble + label-size block. Mirrors the legacy
 *  builder's prologue verbatim so printers configured against old
 *  templates print identically against new ones. */
function zplPreamble(widthDots: number, heightDots: number): string {
  return [
    '^XA',
    '^LT0',
    '^MNW',
    '^MTT',
    '^PON',
    '^PMN',
    '^LH0,0',
    '^JMA',
    '^PR8,8',
    '^JUS',
    '^LRN',
    '^CI27',
    '^PA0,1,1,0',
    '^XZ',
    '^XA',
    '^MMT',
    `^PW${widthDots}`,
    `^LL${heightDots}`,
    '^LS0',
    '',
  ].join('\r\n');
}

/** Generate the full ZPL document for a template. Returns the same
 *  string the legacy "Generate Label" button download. The function
 *  is async because Image / Logo elements rasterize their `src`
 *  asynchronously (canvas + image-load) and we want to finish them
 *  all before stitching the document together — fixes the legacy
 *  race where the first export sometimes missed the graphic header.
 */
export async function generateZpl(t: LabelTemplate): Promise<string> {
  const widthDots  = Math.round(t.labelWidth  * t.dpi);
  const heightDots = Math.round(t.labelHeight * t.dpi);

  // Filter out hidden layers up front — they're skipped both in the
  // `~DG` header (no point rasterizing an image whose body ref will
  // never be emitted) and in the body itself.
  const visible = t.template.filter(el => !el.hidden);

  // Rasterize all visible images first so their `bufferData` is
  // ready when we ask for `toLABEL()` — the resulting `~DG` blocks
  // live in the header above the body.
  const imageEls = visible.filter(
    (el): el is ZplImageElement | ZplLogoElement =>
      el.type === 'Image' || el.type === 'Logo',
  );
  await Promise.all(imageEls.map(el => el.rasterize()));

  let header = '';
  for (const el of imageEls) {
    if (el.bufferData) header += el.bufferData + '\n';
  }

  let body = zplPreamble(widthDots, heightDots);
  for (const el of visible) {
    body += el.toLABEL(0, 0, t.labelHeight, t.labelWidth) + '\r\n';
  }
  body += '^PQ1,0,1,Y\r\n^XZ\r\n';

  return header + body;
}
