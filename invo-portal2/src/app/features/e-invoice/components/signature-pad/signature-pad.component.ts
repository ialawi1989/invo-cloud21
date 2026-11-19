import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, output, viewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Freehand signature box (legacy `<app-signature-pad>`). Emits the PNG data URL after each stroke, and an empty
 * string once cleared.
 */
@Component({
  selector: 'app-signature-pad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  template: `
    <div class="sp">
      <canvas #canvas class="sp__canvas"
        (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up()" (pointerleave)="up()" (pointercancel)="up()"></canvas>
      <button type="button" class="sp__clear" (click)="clear()">{{ 'EINVOICE.CLEAR' | translate }}</button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .sp { position: relative; }
    .sp__canvas { width: 100%; height: 220px; background: var(--ui-surface); border: 1px dashed #94a3b8; border-radius: 12px; touch-action: none; cursor: crosshair; display: block; }
    .sp__clear { position: absolute; top: 8px; inset-inline-end: 8px; height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--ui-line); background: var(--ui-surface); color: var(--ui-text-4); font-size: 12px; cursor: pointer; }
    .sp__clear:hover { background: var(--ui-surface-1); }
  `],
})
export class SignaturePadComponent {
  changed = output<string>();

  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private drawing = false;
  private dirty = false;

  constructor() {
    afterNextRender(() => {
      const c = this.canvas().nativeElement;
      const ratio = window.devicePixelRatio || 1;
      c.width = c.clientWidth * ratio;
      c.height = c.clientHeight * ratio;
      const ctx = c.getContext('2d')!;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
    });
  }

  private point(ev: PointerEvent): { x: number; y: number } {
    const r = this.canvas().nativeElement.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  down(ev: PointerEvent): void {
    const ctx = this.canvas().nativeElement.getContext('2d')!;
    const p = this.point(ev);
    this.drawing = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    this.dirty = true;
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  }

  move(ev: PointerEvent): void {
    if (!this.drawing) return;
    const ctx = this.canvas().nativeElement.getContext('2d')!;
    const p = this.point(ev);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  up(): void {
    if (!this.drawing) return;
    this.drawing = false;
    if (this.dirty) this.changed.emit(this.canvas().nativeElement.toDataURL('image/png'));
  }

  clear(): void {
    const c = this.canvas().nativeElement;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    this.dirty = false;
    this.changed.emit('');
  }
}
