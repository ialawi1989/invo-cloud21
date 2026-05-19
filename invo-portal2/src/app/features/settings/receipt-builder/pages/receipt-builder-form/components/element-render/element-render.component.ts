import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

import {
  PrintElement,
  TableCell,
  TableElement,
  TableGroup,
  TableRow,
} from '../../../../services/receipt-builder.types';
import {
  DEMO_PROFILES,
  DemoProfile,
  resolveBindings,
  resolveLineKey,
} from '../../../../services/binding-resolver';

/**
 * ElementRenderComponent
 * ──────────────────────
 * Visually renders ONE print element exactly as it would appear on
 * the printed receipt. Text picks up its real font-size / weight /
 * alignment, lines draw at the chosen style, spacers reserve the
 * right vertical room, etc.
 *
 * Renderers in this component are *visual only* — they do not edit
 * anything. The form's right-side editor panel owns mutations.
 *
 * QR codes and barcodes are now generated for real (via `qrcode` and
 * `jsbarcode`) so the user sees an accurate preview of what the POS
 * will print. Bindings like `!invoice.zatcaCode` are encoded as the
 * literal string — the POS substitutes the real value at print time.
 */
@Component({
  selector: 'app-element-render',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './element-render.component.html',
  styleUrl: './element-render.component.scss',
})
export class ElementRenderComponent {
  private sanitizer = inject(DomSanitizer);

  element = input.required<PrintElement>();

  /** Demo data context — drives binding resolution on text, side
   *  text, QR/Barcode value, and Table dynamic rows. Defaults to the
   *  first preset profile so the renderer still works when used
   *  outside of the form (e.g. unit tests). */
  profile = input<DemoProfile>(DEMO_PROFILES[0]);

  // ─── Type narrowers — one per branch in the template's @switch ─────
  asText      = computed(() => { const e = this.element(); return e.type === 'Text'      ? e : null; });
  asSideText  = computed(() => { const e = this.element(); return e.type === 'SideText'  ? e : null; });
  asLine      = computed(() => { const e = this.element(); return e.type === 'Line'      ? e : null; });
  asSpacer    = computed(() => { const e = this.element(); return e.type === 'Spacer'    ? e : null; });
  asLogo      = computed(() => { const e = this.element(); return e.type === 'Logo'      ? e : null; });
  asImage     = computed(() => { const e = this.element(); return e.type === 'Image'     ? e : null; });
  asQrCode    = computed(() => { const e = this.element(); return e.type === 'QrCode'    ? e : null; });
  asBarcode   = computed(() => { const e = this.element(); return e.type === 'Barcode'   ? e : null; });
  asTable     = computed(() => { const e = this.element(); return e.type === 'Table'     ? e : null; });

  /**
   * Receipt printers run at ~~200 dpi where 1 mm ≈ 8 px. The legacy
   * `fontSize` field is stored at print-pixel resolution (e.g. 30
   * means 30 px on the printed receipt at the printer's native DPI).
   * For the on-screen preview that's WAY too big — we'd need a 380 px
   * paper to display 30 px text comfortably. We ramp it down to a
   * screen-friendly value while preserving relative size differences
   * between elements (a 60 print-px Text still reads as larger than
   * a 30 print-px one).
   */
  scaleFontSize(printPx: number): number {
    return Math.round(Math.max(8, printPx * 0.5));
  }

  /**
   * Resolve a logo / image binding to either a real URL the
   * `<img>` tag can load, or `null` (so the template renders a
   * named placeholder instead of a broken image).
   *
   *   - `data:` URIs and absolute http(s) URLs render directly.
   *   - Asset paths like `/assets/foo.png` render directly.
   *   - Source bindings like `!preferences.logo` resolve against
   *     the active demo profile via `resolveBindings`. When the
   *     parent has fed the user's actual company logo into the
   *     profile's `preferences.logo`, the canvas displays the real
   *     image. Bindings that can't be resolved come back as
   *     `{lastSegment}` placeholder strings — we treat those as
   *     "not a URL" and fall through to the placeholder UI.
   */
  resolveImageSrc(data: string, path?: string): string | null {
    const raw = path?.trim() || data?.trim() || '';
    if (!raw) return null;

    const resolved = raw.startsWith('!')
      ? resolveBindings(raw, this.profile()).trim()
      : raw;

    // Unresolved bindings come back as `{logo}` etc.; don't try to
    // load that as a URL — let the placeholder show.
    if (!resolved || resolved.startsWith('{')) return null;
    // Anything that looks plausibly like an image source — including
    // bare hostnames or filenames — is handed to the browser. The
    // tenant's `company.logo` may be a relative path that the browser
    // resolves against the document base, so don't be over-strict.
    return resolved;
  }

  // ─── Table preview helpers ─────────────────────────────────────────
  // The Table preview reads the column model directly so the user sees
  // their edits in the canvas immediately. We tolerate a missing/loose
  // `groups` shape because older saved templates may have been written
  // before this feature shipped (they'd just show the source hint).

  tableGroups(tbl: TableElement): TableGroup[] {
    return Array.isArray(tbl.groups) ? tbl.groups : [];
  }

  visibleCells(row: TableRow): TableCell[] {
    return (row?.cells ?? []).filter((c) => c.isVisible !== false);
  }

  hasVisibleCells(tbl: TableElement): boolean {
    return this.tableGroups(tbl).some((g) => g.rows.some((r) => this.visibleCells(r).length > 0));
  }

  /** Map a table's `source` binding (`!invoice.lines` / `taxes` /
   *  `payments`) to the matching sample collection on the active demo
   *  profile. Dynamic rows repeat once per item in this list so the
   *  user can preview a fully-filled table during editing. Returns an
   *  empty list (no rows rendered) when the source is unrecognised. */
  sampleRowsFor(source: string | undefined): Record<string, unknown>[] {
    const inv = this.profile().invoice;
    const key = (source ?? '').replace(/^!?invoice\./, '').replace(/\(\)$/, '');
    if (key === 'lines')    return inv.lines    as unknown as Record<string, unknown>[];
    if (key === 'taxes')    return inv.taxes    as unknown as Record<string, unknown>[];
    if (key === 'payments') return inv.payments as unknown as Record<string, unknown>[];
    return [];
  }

  /** True when the given QR value carries a ZATCA tax-compliance
   *  binding. Saudi Arabia mandates a specific TLV-encoded payload on
   *  every receipt; we surface a badge so the user can spot which QR
   *  is the legally-required one. The check matches both the canonical
   *  legacy spelling (`zatcaCode`) and the common variant (`zatcaQr`). */
  isZatcaQr(value: string | undefined): boolean {
    if (!value) return false;
    return /!invoice\.zatca(Code|Qr)\b/i.test(value);
  }

  /** Resolve every `!invoice.*` / `!preferences.*` token in `text`
   *  against the active demo profile. Used by the template for
   *  Text / SideText / QR / Barcode value fields so the canvas
   *  preview reads the way the printed receipt will. */
  resolveText(text: string | undefined | null): string {
    return resolveBindings(text ?? '', this.profile());
  }

  /** Same idea for a Table cell whose `key` is a relative path
   *  inside an invoice line (e.g. `qty`, `product.name`). */
  resolveCellForLine(key: string, line: Record<string, unknown>): string {
    return resolveLineKey(key, line, this.profile());
  }

  // ─── QR / Barcode generators ───────────────────────────────────────
  // We generate real SVG with `qrcode` / `jsbarcode` so the canvas
  // preview matches what the POS will print byte-for-byte. Both
  // computeds depend on `element()` so they re-run whenever the user
  // edits the value, size, or height. The generated string is wrapped
  // in `bypassSecurityTrustHtml` because the default Angular sanitiser
  // strips `<svg>` markup pushed through `[innerHTML]`.

  /** SVG markup for the current QR's value. `qrcode.create()` runs
   *  synchronously (pure bit math — no I/O) so we can paint the SVG
   *  in a `computed` without an effect. Renders one `<rect>` per dark
   *  module against `currentColor` so the host can tint via CSS
   *  (used by the ZATCA highlight). Falls back to an empty string when
   *  the value is empty or the encoder rejects it (over-long input). */
  qrSvg = computed<SafeHtml>(() => {
    const e = this.element();
    if (e.type !== 'QrCode') return '';
    // Resolve bindings before encoding so the live preview matches
    // what the POS would actually print at runtime. `!invoice.zatcaCode`
    // becomes the demo TLV payload; plain text passes through.
    const text = resolveBindings(e.value ?? '', this.profile()).trim();
    if (!text) return '';
    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
      const cells: number = qr.modules.size;
      const data = qr.modules;
      let rects = '';
      for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
          // `qrcode`'s BitMatrix exposes `get(x, y)` returning 1 for
          // dark modules. The 1.02 width avoids hairline gaps between
          // adjacent rects when the SVG is up-scaled by the host.
          if (data.get(x, y)) {
            rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
          }
        }
      }
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cells} ${cells}" ` +
        `preserveAspectRatio="none" width="100%" height="100%" shape-rendering="crispEdges">` +
        `<g fill="currentColor">${rects}</g></svg>`;
      return this.sanitizer.bypassSecurityTrustHtml(svg);
    } catch {
      return '';
    }
  });

  /** SVG markup for the current barcode value. We hand `jsbarcode` an
   *  off-DOM SVG node, let it draw the bars, then serialise the result
   *  to a string for `[innerHTML]`. CODE128 is the safe default — it
   *  accepts the full ASCII range so binding tokens (`!invoice.foo`)
   *  encode without throwing. The element's `height` drives the bar
   *  height; we always hide the human-readable line beneath the bars
   *  because the editor renders the value separately under the bars. */
  barcodeSvg = computed<SafeHtml>(() => {
    const e = this.element();
    if (e.type !== 'Barcode') return '';
    const text = resolveBindings(e.value ?? '', this.profile()).trim();
    if (!text) return '';
    try {
      const xml = new DOMParser().parseFromString(
        '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        'image/svg+xml',
      );
      const svgEl = xml.documentElement as unknown as SVGElement;
      JsBarcode(svgEl as unknown as Element, text, {
        format:        'CODE128',
        height:        Math.max(20, e.height ?? 50),
        displayValue:  false,
        margin:        0,
        background:    '#ffffff',
        lineColor:     '#1f2937',
      });
      const svg = new XMLSerializer().serializeToString(svgEl);
      return this.sanitizer.bypassSecurityTrustHtml(svg);
    } catch {
      return '';
    }
  });
}
