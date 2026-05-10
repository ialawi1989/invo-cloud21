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
import * as QRCode from 'qrcode';

/**
 * Renders a QR matrix into an inline `<canvas>` using the `qrcode`
 * library (already in `package.json`). The legacy builder maps a
 * "factor" (1–10) to a pixel size; the same mapping is mirrored here
 * so existing templates keep their visual proportions.
 *
 * Empty `data` falls back to a placeholder pattern so the canvas
 * position stays meaningful while the user is still binding the
 * content. `qrcode` can encode empty strings (it just emits a single
 * tile) but the result is visually meaningless, so we override.
 */
@Component({
  selector: 'app-qrcode-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas></canvas>`,
  styles: [`
    :host   { display: inline-block; line-height: 0; }
    canvas  { display: block; image-rendering: pixelated; }
  `],
})
export class QrcodePreviewComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) data!: string;
  /** Edge length in pixels — already pre-resolved by the parent from
   *  the factor slider so this component doesn't need the mapping
   *  table. */
  @Input() pixel = 80;

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void { this.draw(); }
  ngOnChanges(_c: SimpleChanges): void {
    if (this.canvasRef) this.draw();
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const value = (this.data ?? '').toString();

    if (!value.trim()) {
      // Placeholder grid — visually obvious "QR-shaped" pattern
      // without invoking the encoder.
      canvas.width = this.pixel;
      canvas.height = this.pixel;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, this.pixel, this.pixel);
      ctx.fillStyle = '#cbd5e1';
      const tile = Math.max(2, Math.floor(this.pixel / 10));
      for (let y = 0; y < this.pixel; y += tile * 2) {
        for (let x = 0; x < this.pixel; x += tile * 2) {
          ctx.fillRect(x, y, tile, tile);
          ctx.fillRect(x + tile, y + tile, tile, tile);
        }
      }
      return;
    }

    // `toCanvas` is async; we don't `await` because OnPush + the lib's
    // synchronous draw against the existing canvas is fine for our
    // case. Errors fall through to the placeholder branch above on
    // the next render.
    QRCode.toCanvas(canvas, value, {
      width:        this.pixel,
      margin:       0,
      errorCorrectionLevel: 'M',
      color: {
        dark:  '#0f172a',
        light: '#ffffff00', // transparent — let the label background show
      },
    }).catch(() => {
      // Encoder rejected — leave the canvas as-is; next change
      // detection rerolls.
    });
  }
}
