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

/**
 * Renders a 1D barcode into an inline `<svg>` using `jsbarcode`. Used
 * by the label-builder canvas to give the user a faithful preview of
 * what the printer will emit. Live-redraws on input changes so the
 * inspector's edits update without remounting.
 *
 * Bare-minimum API on purpose — the canvas just needs a `data` string,
 * a target `height`, and a "show value" toggle. Format defaults to
 * CODE128 which handles arbitrary alphanumerics and is what the
 * legacy ZPL output settles on too.
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

  @ViewChild('svg', { static: true }) svgRef!: ElementRef<SVGElement>;

  ngAfterViewInit(): void { this.draw(); }
  ngOnChanges(_c: SimpleChanges): void {
    if (this.svgRef) this.draw();
  }

  private draw(): void {
    const svg = this.svgRef.nativeElement;
    // Fall back to a literal placeholder when data is empty — feeding
    // jsbarcode an empty string throws and would leave the SVG blank.
    const value = (this.data ?? '').toString().trim() || '0000';
    try {
      JsBarcode(svg, value, {
        format:    'CODE128',
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
      // jsbarcode throws on values that can't be encoded (CODE128 is
      // permissive but malformed inputs still happen). Render a thin
      // hatched bar so the canvas position stays meaningful instead
      // of collapsing to a 0-height SVG.
      svg.setAttribute('width',  '120');
      svg.setAttribute('height', String(this.height));
      svg.innerHTML = `<rect width="120" height="${this.height}" fill="url(#hatch)"/>` +
        `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse">` +
        `<path d="M0 0 L6 6 M6 0 L0 6" stroke="#cbd5e1" stroke-width="1"/></pattern></defs>`;
    }
  }
}
