import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import JsBarcode from 'jsbarcode';
import { isBarcodeValueValid } from '../../services/label-template.types';

/**
 * Renders a 1D barcode into an inline `<svg>` using `jsbarcode`. Used
 * by the label-builder canvas to give the user a faithful preview of
 * what the printer will emit. Live-redraws on input changes so the
 * inspector's edits update without remounting.
 *
 * `format` selects the jsbarcode symbology (CODE128, EAN13, UPC, …
 * see `BARCODE_FORMATS`); defaults to CODE128 which handles arbitrary
 * alphanumerics and is what the legacy ZPL output settles on too.
 *
 * Before drawing, the resolved value is checked against the chosen
 * format's shape (`isBarcodeValueValid` — e.g. EAN13 needs exactly
 * 12-13 digits). A value that doesn't fit renders a "BARCODE"
 * placeholder box instead of jsbarcode's own (uglier, inconsistent)
 * failure mode — same UX as the legacy label-builder.
 *
 * If `data` is empty (e.g. an unbound textbox token) we render a
 * placeholder striped bar so the user can still see + position the
 * element on the canvas.
 */
@Component({
  selector: 'app-barcode-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg #svg></svg>`,
  styles: [`
    :host { display: inline-block; line-height: 0; }
    svg   { display: block; }
  `],
})
export class BarcodePreviewComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) data!: string;
  @Input() height = 40;
  @Input() showValue = false;
  @Input() format = 'CODE128';

  @ViewChild('svg', { static: true }) svgRef!: ElementRef<SVGElement>;

  ngAfterViewInit(): void { this.draw(); }
  ngOnChanges(_c: SimpleChanges): void {
    if (this.svgRef) this.draw();
  }

  private draw(): void {
    const svg = this.svgRef.nativeElement;
    const value = (this.data ?? '').toString().trim();
    const format = this.format || 'CODE128';

    // Value doesn't fit the chosen symbology (empty, wrong digit
    // count, disallowed characters, …) — render the same "BARCODE"
    // text placeholder the legacy label-builder shows, instead of
    // feeding jsbarcode something it can't encode.
    if (!isBarcodeValueValid(value, format)) {
      this.drawInvalidPlaceholder(svg);
      return;
    }

    try {
      JsBarcode(svg, value, {
        format,
        height:    this.height,
        // Pixel-tight bars look closest to the printed result; the
        // canvas already gives the surrounding spacing affordance.
        margin:    0,
        displayValue: !!this.showValue,
        fontSize:  Math.max(10, Math.min(14, Math.floor(this.height * 0.22))),
        background:'transparent',
        lineColor: '#0f172a',
      });
    } catch {
      // jsbarcode throws on values that can't be encoded even after
      // passing our own shape check (an edge case the regex doesn't
      // fully cover). Render a thin hatched bar so the canvas
      // position stays meaningful instead of collapsing to a
      // 0-height SVG.
      svg.setAttribute('width',  '120');
      svg.setAttribute('height', String(this.height));
      svg.innerHTML = `<rect width="120" height="${this.height}" fill="url(#hatch)"/>` +
        `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse">` +
        `<path d="M0 0 L6 6 M6 0 L0 6" stroke="#cbd5e1" stroke-width="1"/></pattern></defs>`;
    }
  }

  /** "B A R C O D E" placeholder box — mirrors the legacy
   *  `.barcode-placeholder` treatment (thin border, centered
   *  spaced-out label) so an invalid value still gives the user a
   *  meaningful, positionable element on the canvas. */
  private drawInvalidPlaceholder(svg: SVGElement): void {
    const width = 120;
    svg.setAttribute('width',  String(width));
    svg.setAttribute('height', String(this.height));
    svg.innerHTML =
      `<rect x="0.5" y="0.5" width="${width - 1}" height="${this.height - 1}" ` +
      `fill="none" stroke="#ddd" stroke-width="1"/>` +
      `<text x="${width / 2}" y="${this.height / 2}" text-anchor="middle" dominant-baseline="middle" ` +
      `font-size="11" fill="#0f172a" font-family="sans-serif">B A R C O D E</text>`;
  }
}
