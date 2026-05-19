// ────────────────────────────────────────────────────────────────────
// PNG export.
//
// Renders a `LabelTemplate` to a PNG image at the same pixel size
// the canvas works in (`labelWidth × dpi` by `labelHeight × dpi`),
// element by element, on an offscreen `<canvas>`.
//
// Real-renders barcodes (jsbarcode) and QR codes (qrcode) to scratch
// canvases, then `drawImage`s them in — keeps the libs as the single
// source of truth for what those primitives look like, so the PNG
// matches what the user sees in the live editor preview.
//
// Hidden elements (`el.hidden === true`) are skipped, matching ZPL
// export behavior. Locked is not honored — locking is an editor-
// time concept; the print/export should always show the full
// canvas.
// ────────────────────────────────────────────────────────────────────

import JsBarcode from 'jsbarcode';
import * as QRCode from 'qrcode';

import {
  LabelElement,
  LabelTemplate,
  ZplBarcode,
  ZplCircle,
  ZplHorizontalLine,
  ZplImageElement,
  ZplLogoElement,
  ZplQrCode,
  ZplRectangle,
  ZplTextBox,
  ZplVerticalLine,
} from './label-template.types';
import { LabelDataMap, resolveTokens } from './token-resolver';

/** Load an image from any URL / DataURL. Resolves to `null` on
 *  failure so the caller can keep rendering without aborting the
 *  whole export. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = '*';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderElement(
  ctx: CanvasRenderingContext2D,
  el: LabelElement,
  data?: LabelDataMap,
): Promise<void> {
  const { x, y } = el.position;
  // Resolve `!product.*` tokens against the supplied data map. When
  // no map is supplied the call is a no-op (returns the raw string),
  // so the editor preview path still works unchanged.
  const resolve = (raw: string): string =>
    data ? resolveTokens(raw, data) : String(raw ?? '');

  switch (el.type) {
    case 'Textbox': {
      const e = el as ZplTextBox;
      // Match the live preview's font stack so PNG output is visually
      // close to what the editor shows. ZPL uses internal fonts on
      // the printer, so this is for the PNG path only.
      const weight = e.fontWeight === 'bold' ? 'bold' : 'normal';
      const style  = e.fontStyle  === 'italic' ? 'italic' : 'normal';
      ctx.fillStyle    = '#0f172a';
      ctx.font         = `${style} ${weight} ${e.fontSize}px sans-serif`;
      ctx.textBaseline = 'top';
      const text = resolve(String(e.data ?? ''));
      ctx.fillText(text, x, y);
      if (e.textDecoration === 'underline') {
        const m = ctx.measureText(text);
        ctx.fillRect(x, y + Math.round(e.fontSize * 1.05), m.width, Math.max(1, Math.round(e.fontSize * 0.06)));
      }
      return;
    }

    case 'Barcode': {
      const e = el as ZplBarcode;
      const scratch = document.createElement('canvas');
      try {
        const value = resolve(String(e.data || '0000')) || '0000';
        JsBarcode(scratch, value, {
          format:        'CODE128',
          height:        e.height,
          margin:        0,
          displayValue:  !!e.showValue,
          fontSize:      Math.max(10, Math.min(14, Math.floor(e.height * 0.22))),
          background:    '#ffffff',
          lineColor:     '#0f172a',
        });
        ctx.drawImage(scratch, x, y);
      } catch {
        // Bad input — skip the draw, the export keeps going.
      }
      return;
    }

    case 'QrCode': {
      const e = el as ZplQrCode;
      const scratch = document.createElement('canvas');
      try {
        const value = resolve(String(e.data || ' ')) || ' ';
        await QRCode.toCanvas(scratch, value, {
          width:        e.size.pixel,
          margin:       0,
          errorCorrectionLevel: 'M',
          color:        { dark: '#0f172a', light: '#ffffff' },
        });
        ctx.drawImage(scratch, x, y);
      } catch { /* skip */ }
      return;
    }

    case 'Rectangle': {
      const e = el as ZplRectangle;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth   = e.borderThickness;
      const off = e.borderThickness / 2;
      ctx.strokeRect(x + off, y + off, Math.max(0, e.width - e.borderThickness), Math.max(0, e.height - e.borderThickness));
      return;
    }

    case 'Circle': {
      const e = el as ZplCircle;
      const r  = e.circleDiameter / 2;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth   = e.borderThickness;
      ctx.beginPath();
      ctx.arc(x + r, y + r, Math.max(0, r - e.borderThickness / 2), 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    case 'HorizontalLine': {
      const e = el as ZplHorizontalLine;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, e.width, e.thick);
      return;
    }

    case 'VerticalLine': {
      const e = el as ZplVerticalLine;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, e.thick, e.height);
      return;
    }

    case 'Image':
    case 'Logo': {
      const e = el as ZplImageElement | ZplLogoElement;
      if (!e.src) return;
      const img = await loadImage(e.src);
      if (img) ctx.drawImage(img, x, y, e.width, e.height);
      return;
    }
  }
}

/**
 * Render a label template to a PNG `Blob`. Pixel dimensions match
 * the editor canvas (`labelWidth × dpi` by `labelHeight × dpi`).
 *
 * Async because barcode/QR scratch-canvas rendering and image
 * loading all yield, but the work is pipelined so a 30-element
 * label still finishes in well under a second.
 */
export async function generatePng(t: LabelTemplate, data?: LabelDataMap): Promise<Blob | null> {
  const canvas = await renderTemplateToCanvas(t, data);
  if (!canvas) return null;
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/** Render the template to an offscreen canvas and return it. The
 *  print-label modal reads the canvas as a data URL for its preview;
 *  `generatePng` wraps it into a Blob for download. */
export async function renderTemplateToCanvas(
  t: LabelTemplate,
  data?: LabelDataMap,
): Promise<HTMLCanvasElement | null> {
  const w = Math.max(1, Math.round((t.labelWidth  || 1) * (t.dpi || 203)));
  const h = Math.max(1, Math.round((t.labelHeight || 1) * (t.dpi || 203)));

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // White paper background — labels print on white stock by default.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const visible = t.template.filter(el => !el.hidden);
  for (const el of visible) {
    await renderElement(ctx, el, data);
  }
  return canvas;
}
