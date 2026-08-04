/**
 * Synchronous SVG generators for the `qr-code` and `barcode` blocks.
 *
 * Both renderers (HTML and pdfmake) build their output as a plain string in
 * one pass, so anything they embed has to be produced synchronously. That
 * rules out `QRCode.toString()` / `QRCode.toDataURL()` (promise-based) and
 * JsBarcode's canvas path (needs a paint tick).
 *
 * Instead:
 *  - QR uses `QRCode.create()`, which is sync and hands back the raw module
 *    bit-matrix. We walk it and emit one `<rect>` per run of dark modules
 *    (run-length merged horizontally — a version-10 code is ~57x57, so
 *    per-module rects would be ~3000 nodes per QR).
 *  - Barcodes run JsBarcode against a detached `<svg>` element and read back
 *    `outerHTML`. JsBarcode's SVG renderer is fully synchronous; the element
 *    never enters the document.
 *
 * Both are browser-only (barcode needs `document`). The engine's render path
 * is browser-side, and `barcodeSvg` degrades to a labelled placeholder rather
 * than throwing if it ever runs headless.
 */

import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { BarcodeBlock, QrCodeBlock } from '../core/types/block.types';

export interface CodeColors {
  /** Module / bar color. Default black. */
  dark?: string;
  /** Quiet-zone + background color. Default white. */
  light?: string;
}

/**
 * Render a QR code as a self-contained SVG string sized to fill its box via
 * `viewBox` (so the caller controls physical size purely through CSS/pdf
 * width & height).
 *
 * `margin` is in modules, matching the `qrcode` package's own unit, and
 * defaults to the spec-mandated 4-module quiet zone. Passing 0 is allowed —
 * scanners tolerate it on screen, less so in print.
 */
export function qrSvg(
  value: string,
  opts: { ecLevel?: QrCodeBlock['ecLevel']; margin?: number } & CodeColors = {},
): string {
  const dark = opts.dark ?? '#000000';
  const light = opts.light ?? '#ffffff';
  // `create('')` throws — an empty binding is a normal transient state while
  // the user is still typing an expression, so render an empty quiet zone.
  const text = value || ' ';
  const margin = Math.max(0, opts.margin ?? 4);

  let size: number;
  let data: Uint8Array;
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: opts.ecLevel ?? 'M' });
    size = qr.modules.size;
    data = qr.modules.data;
  } catch {
    // Payload too large for any QR version, or an invalid segment. Show a
    // visible placeholder instead of breaking the whole document render.
    return placeholderSvg('QR too large', light);
  }

  const total = size + margin * 2;
  const rects: string[] = [];
  for (let y = 0; y < size; y++) {
    let runStart = -1;
    for (let x = 0; x <= size; x++) {
      // `x === size` is a sentinel column that always reads light, so a run
      // touching the right edge still gets flushed.
      const isDark = x < size && data[y * size + x] === 1;
      if (isDark && runStart === -1) {
        runStart = x;
      } else if (!isDark && runStart !== -1) {
        rects.push(
          `<rect x="${runStart + margin}" y="${y + margin}" width="${x - runStart}" height="1"/>`,
        );
        runStart = -1;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `width="100%" height="100%" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<g fill="${dark}">${rects.join('')}</g>` +
    `</svg>`
  );
}

/** JsBarcode format names keyed by our `symbology` union. */
const SYMBOLOGY_FORMAT: Record<BarcodeBlock['symbology'], string> = {
  code128: 'CODE128',
  code39: 'CODE39',
  ean13: 'EAN13',
  ean8: 'EAN8',
  upca: 'UPC',
  // JsBarcode is a 1-D generator only. 2-D symbologies fall through to the
  // QR path in `barcodeSvg` rather than being mapped here.
  qrcode: '',
  datamatrix: '',
};

/**
 * Render a barcode as a self-contained SVG string.
 *
 * `qrcode` and `datamatrix` symbologies are delegated to `qrSvg` — JsBarcode
 * can't produce them, and a QR is a strictly better fallback than nothing
 * (DataMatrix in particular has no free JS generator we already ship).
 *
 * An invalid value for the chosen symbology (e.g. letters in an EAN-13)
 * makes JsBarcode throw; we surface that as a visible placeholder so the
 * user can see which block is misconfigured instead of getting a blank box.
 */
export function barcodeSvg(
  value: string,
  symbology: BarcodeBlock['symbology'],
  opts: { showText?: boolean } & CodeColors = {},
): string {
  const dark = opts.dark ?? '#000000';
  const light = opts.light ?? '#ffffff';

  if (symbology === 'qrcode' || symbology === 'datamatrix') {
    return qrSvg(value, { dark, light });
  }

  const format = SYMBOLOGY_FORMAT[symbology] || 'CODE128';
  if (typeof document === 'undefined') return placeholderSvg(value, light);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, value || ' ', {
      format,
      displayValue: opts.showText !== false,
      background: light,
      lineColor: dark,
      // Fixed intrinsic geometry — the caller scales the whole SVG to the
      // block's mm box, so these are only about the bar:height ratio.
      width: 2,
      height: 60,
      margin: 6,
      fontSize: 16,
    });
  } catch {
    return placeholderSvg(`Invalid ${symbology}`, light);
  }

  // JsBarcode stamps absolute width/height; strip them so the SVG scales to
  // its container and keep the viewBox it computed for the aspect ratio.
  const width = svg.getAttribute('width');
  const height = svg.getAttribute('height');
  if (width && height && !svg.getAttribute('viewBox')) {
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'none');
  return svg.outerHTML;
}

/** Neutral box with a short diagnostic label. */
function placeholderSvg(label: string, background: string): string {
  const text = label.length > 24 ? `${label.slice(0, 23)}…` : label;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="100%" height="100%">` +
    `<rect width="200" height="60" fill="${background}" stroke="#d0d0d0" stroke-dasharray="3 2"/>` +
    `<text x="100" y="34" text-anchor="middle" font-size="11" fill="#888">${escapeXml(text)}</text>` +
    `</svg>`
  );
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
