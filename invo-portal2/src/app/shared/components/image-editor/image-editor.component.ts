import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  EditorTool,
  CROP_PRESETS,
  CropPreset,
  ADJUSTMENTS,
  AdjustmentDef,
  FILTER_PRESETS,
  FilterPreset,
  EditorState,
} from './image-editor.types';

/**
 * ImageEditorComponent
 * ────────────────────
 * A pure-Canvas image editor. Loads an image from a URL, lets the user
 * crop, rotate, flip, adjust (brightness/contrast/saturation/blur),
 * apply filter presets, free-draw (pen), and resize.
 *
 * On "Save", emits a Blob of the edited image. The parent is responsible
 * for uploading the blob to the server.
 */
@Component({
  selector: 'app-image-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageEditorComponent implements OnInit, OnDestroy {
  // ── Inputs ─────────────────────────────────────────────────────────────────
  /** URL of the image to edit. */
  imageUrl = input.required<string>();

  /** File name (used for the saved blob). */
  fileName = input<string>('edited-image.png');

  // ── Outputs ────────────────────────────────────────────────────────────────
  /** Fires with the edited image Blob when the user clicks Save. */
  save = output<Blob>();

  /** Fires when the user clicks Cancel. */
  cancel = output<void>();

  // ── View children ──────────────────────────────────────────────────────────
  mainCanvas  = viewChild<ElementRef<HTMLCanvasElement>>('mainCanvas');
  cropOverlay = viewChild<ElementRef<HTMLDivElement>>('cropOverlay');

  // ── State ──────────────────────────────────────────────────────────────────
  activeTool = signal<EditorTool>('crop');
  loading    = signal(true);
  saving     = signal(false);

  // Adjustments
  adjustments = signal<Record<string, number>>({
    brightness: 100,
    contrast: 100,
    saturate: 100,
    blur: 0,
  });

  // Active filter
  activeFilter = signal<string>('');

  // Rotation (degrees, multiples of 90)
  rotation = signal<number>(0);
  flipH    = signal<boolean>(false);
  flipV    = signal<boolean>(false);

  // Crop state
  cropActive = signal(false);
  cropRect   = signal({ x: 0, y: 0, w: 0, h: 0 });
  cropPreset = signal<CropPreset>(CROP_PRESETS[0]);

  // Draw
  drawColor = signal('#dc2626');
  drawSize  = signal(3);
  isDrawing = signal(false);

  // Resize
  resizeW = signal(0);
  resizeH = signal(0);
  resizeLock = signal(true);

  // Undo/redo stacks
  private undoStack: ImageData[] = [];
  private redoStack: ImageData[] = [];
  canUndo = signal(false);
  canRedo = signal(false);

  // Internal
  private img = new Image();
  private naturalW = 0;
  private naturalH = 0;
  private lastDrawPos = { x: 0, y: 0 };

  // Expose constants for the template
  readonly CROP_PRESETS  = CROP_PRESETS;
  readonly ADJUSTMENTS   = ADJUSTMENTS;
  readonly FILTER_PRESETS = FILTER_PRESETS;
  readonly TOOLS: { key: EditorTool; label: string; icon: string }[] = [
    { key: 'crop',    label: 'Crop',    icon: 'M6 2v6H2v2h6V2H6zm10 0v8h2V2h-2zm-6 12H2v2h6v6h2v-6zm10-2h-8v2h6v6h2v-8z' },
    { key: 'rotate',  label: 'Rotate',  icon: 'M4 4v6h6M20 20v-6h-6M20 8A8 8 0 0 0 6.34 5.66M4 16a8 8 0 0 0 13.66 2.34' },
    { key: 'adjust',  label: 'Adjust',  icon: 'M12 3v1m0 16v1m-8-9H3m18 0h-1m-2.636-5.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z' },
    { key: 'filters', label: 'Filters', icon: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z' },
    { key: 'draw',    label: 'Draw',    icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
    { key: 'resize',  label: 'Resize',  icon: 'M4 8V4h4M4 16v4h4M20 8V4h-4M20 16v4h-4' },
  ];

  // CSS filter string for preview
  cssFilter = computed(() => {
    const a = this.adjustments();
    const f = this.activeFilter();
    let css = `brightness(${a['brightness']}%) contrast(${a['contrast']}%) saturate(${a['saturate']}%)`;
    if (a['blur'] > 0) css += ` blur(${a['blur']}px)`;
    if (f) css += ' ' + f;
    return css;
  });

  ngOnInit(): void {
    this.img.crossOrigin = 'anonymous';
    this.img.onload = () => {
      this.naturalW = this.img.naturalWidth;
      this.naturalH = this.img.naturalHeight;
      this.resizeW.set(this.naturalW);
      this.resizeH.set(this.naturalH);
      this.resetCanvas();
      this.pushUndo();
      this.loading.set(false);
    };
    this.img.onerror = () => {
      this.loading.set(false);
    };
    this.img.src = this.imageUrl();
  }

  ngOnDestroy(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  // ── Canvas helpers ─────────────────────────────────────────────────────────

  private getCtx(): CanvasRenderingContext2D | null {
    return this.mainCanvas()?.nativeElement.getContext('2d') ?? null;
  }

  private resetCanvas(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    canvas.width = this.naturalW;
    canvas.height = this.naturalH;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.img, 0, 0);
  }

  private pushUndo(): void {
    const ctx = this.getCtx();
    const canvas = this.mainCanvas()?.nativeElement;
    if (!ctx || !canvas) return;
    this.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    this.redoStack = [];
    this.canUndo.set(this.undoStack.length > 1);
    this.canRedo.set(false);
  }

  undo(): void {
    if (this.undoStack.length <= 1) return;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    const prev = this.undoStack[this.undoStack.length - 1];
    this.restoreState(prev);
    this.canUndo.set(this.undoStack.length > 1);
    this.canRedo.set(true);
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    this.restoreState(next);
    this.canUndo.set(true);
    this.canRedo.set(this.redoStack.length > 0);
  }

  private restoreState(data: ImageData): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    canvas.width = data.width;
    canvas.height = data.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(data, 0, 0);
    this.resizeW.set(data.width);
    this.resizeH.set(data.height);
  }

  // ── Tool: Rotate / Flip ────────────────────────────────────────────────────

  rotate90(dir: 1 | -1): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imgData.width;
    tempCanvas.height = imgData.height;
    tempCanvas.getContext('2d')!.putImageData(imgData, 0, 0);

    canvas.width = imgData.height;
    canvas.height = imgData.width;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (dir === 1) {
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
    } else {
      ctx.translate(0, canvas.height);
      ctx.rotate(-Math.PI / 2);
    }
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    this.resizeW.set(canvas.width);
    this.resizeH.set(canvas.height);
    this.pushUndo();
  }

  flip(axis: 'h' | 'v'): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d')!.putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (axis === 'h') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
    this.pushUndo();
  }

  // ── Tool: Crop ─────────────────────────────────────────────────────────────

  applyCrop(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const r = this.cropRect();
    if (r.w < 2 || r.h < 2) return;

    // Scale crop rect from display to canvas coords
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    const scaleX = canvas.width / displayW;
    const scaleY = canvas.height / displayH;

    const sx = Math.round(r.x * scaleX);
    const sy = Math.round(r.y * scaleY);
    const sw = Math.round(r.w * scaleX);
    const sh = Math.round(r.h * scaleY);

    const ctx = canvas.getContext('2d')!;
    const cropped = ctx.getImageData(sx, sy, sw, sh);
    canvas.width = sw;
    canvas.height = sh;
    ctx.putImageData(cropped, 0, 0);

    this.resizeW.set(sw);
    this.resizeH.set(sh);
    this.cropActive.set(false);
    this.cropRect.set({ x: 0, y: 0, w: 0, h: 0 });
    this.pushUndo();
  }

  startCrop(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const margin = 40;
    this.cropRect.set({ x: margin, y: margin, w: w - margin * 2, h: h - margin * 2 });
    this.cropActive.set(true);
  }

  cancelCrop(): void {
    this.cropActive.set(false);
    this.cropRect.set({ x: 0, y: 0, w: 0, h: 0 });
  }

  // ── Tool: Adjust ───────────────────────────────────────────────────────────

  updateAdjustment(key: string, value: number): void {
    this.adjustments.update(a => ({ ...a, [key]: value }));
  }

  resetAdjustments(): void {
    const reset: Record<string, number> = {};
    for (const adj of ADJUSTMENTS) reset[adj.key] = adj.default;
    this.adjustments.set(reset);
    this.activeFilter.set('');
  }

  applyAdjustments(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Render current canvas + CSS filter to a temp canvas, then copy back
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tCtx = temp.getContext('2d')!;
    tCtx.filter = this.cssFilter();
    tCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(temp, 0, 0);

    this.resetAdjustments();
    this.pushUndo();
  }

  // ── Tool: Filters ──────────────────────────────────────────────────────────

  setFilter(preset: FilterPreset): void {
    this.activeFilter.set(preset.css);
  }

  // ── Tool: Draw ─────────────────────────────────────────────────────────────

  onDrawStart(e: MouseEvent | TouchEvent): void {
    if (this.activeTool() !== 'draw') return;
    this.isDrawing.set(true);
    const pos = this.getCanvasPos(e);
    this.lastDrawPos = pos;

    const ctx = this.getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = this.drawColor();
    ctx.lineWidth = this.drawSize();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  onDrawMove(e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing()) return;
    e.preventDefault();
    const pos = this.getCanvasPos(e);
    const ctx = this.getCtx();
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    this.lastDrawPos = pos;
  }

  onDrawEnd(): void {
    if (!this.isDrawing()) return;
    this.isDrawing.set(false);
    this.pushUndo();
  }

  private getCanvasPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // ── Tool: Resize ───────────────────────────────────────────────────────────

  onResizeW(w: number): void {
    this.resizeW.set(w);
    if (this.resizeLock()) {
      const canvas = this.mainCanvas()?.nativeElement;
      if (canvas) {
        const ratio = canvas.height / canvas.width;
        this.resizeH.set(Math.round(w * ratio));
      }
    }
  }

  onResizeH(h: number): void {
    this.resizeH.set(h);
    if (this.resizeLock()) {
      const canvas = this.mainCanvas()?.nativeElement;
      if (canvas) {
        const ratio = canvas.width / canvas.height;
        this.resizeW.set(Math.round(h * ratio));
      }
    }
  }

  applyResize(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const w = this.resizeW();
    const h = this.resizeH();
    if (w < 1 || h < 1) return;

    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    temp.getContext('2d')!.drawImage(canvas, 0, 0);

    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(temp, 0, 0, w, h);
    this.pushUndo();
  }

  // ── Save / Cancel ──────────────────────────────────────────────────────────

  async onSave(): Promise<void> {
    // First apply any pending adjustments/filters
    if (this.cssFilter() !== 'brightness(100%) contrast(100%) saturate(100%)') {
      this.applyAdjustments();
    }

    this.saving.set(true);
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/png'),
    );

    this.saving.set(false);
    if (blob) this.save.emit(blob);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
