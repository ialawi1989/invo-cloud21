import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { TooltipDirective } from '../../directives/tooltip.directive';
import { ColorPickerComponent } from '../color-picker/color-picker.component';
import {
  EditorTool,
  CropDragMode,
  CropOrientation,
  CropPresetView,
  CROP_RATIO_BASE,
  ADJUST_GROUPS,
  ADJUST_DEFAULTS,
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
  imports: [CommonModule, FormsModule, TooltipDirective, ColorPickerComponent],
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

  // Adjustments — raw values consumed by the pixel pipeline (see ADJUST_DEFAULTS).
  adjustments = signal<Record<string, number>>({ ...ADJUST_DEFAULTS });
  /** Colour used by the Tint control. */
  tintColor = signal<string>('#ff0047');

  // Active filter
  activeFilter = signal<string>('');

  // Rotation (degrees, multiples of 90)
  rotation = signal<number>(0);
  flipH    = signal<boolean>(false);
  flipV    = signal<boolean>(false);

  // Crop state — cropRect is stored in canvas-area coordinates (the overlay's
  // positioning context), so left/top can be bound to the box directly.
  cropActive  = signal(false);
  cropRect    = signal({ x: 0, y: 0, w: 0, h: 0 });
  /** Stable key of the selected ratio preset ('free' | 'original' | 'r0'…). */
  cropSel     = signal<string>('free');
  cropOrientation = signal<CropOrientation>('portrait');

  /** Free (fine) rotation in degrees, applied live around the image centre. */
  freeRotation = signal(0);
  /** Snapshot the free-rotation is applied to, so dragging never compounds. */
  private rotationSource: HTMLCanvasElement | null = null;

  /** The ratio grid, rebuilt when orientation flips. */
  cropPresets = computed<CropPresetView[]>(() => {
    const land = this.cropOrientation() === 'landscape';
    const list: CropPresetView[] = [
      { key: 'free',     label: 'Free',     ratio: null, kind: 'free',     rw: 0,  rh: 0 },
      { key: 'original', label: 'Original', ratio: 0,    kind: 'original', rw: 22, rh: 22 },
    ];
    CROP_RATIO_BASE.forEach(([a, b], i) => {
      const label = land ? `${b}:${a}` : `${a}:${b}`;
      const wh = land ? a / b : b / a;               // width / height
      const rw = wh >= 1 ? 22 : 22 * wh;             // icon rect (portrait base)
      const rh = wh >= 1 ? 22 / wh : 22;
      list.push({ key: `r${i}`, label, ratio: wh, kind: 'ratio', rw: +rw.toFixed(1), rh: +rh.toFixed(1) });
    });
    return list;
  });

  /** Active drag gesture on the crop box, or null when idle. */
  private cropDrag: {
    mode: CropDragMode;
    startX: number;
    startY: number;
    startRect: { x: number; y: number; w: number; h: number };
  } | null = null;
  private readonly CROP_MIN = 20; // smallest allowed crop edge, in display px

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

  /**
   * True when the image differs from the untouched original — i.e. there's a
   * committed edit in history, or a pending (not-yet-baked) filter, free
   * rotation, or adjustment. Drives the "Revert to Original" button.
   */
  canRevert = computed(() =>
    this.canUndo() || this.canRedo() ||
    !!this.activeFilter() || this.freeRotation() !== 0 ||
    Object.keys(ADJUST_DEFAULTS).some(k => this.adjustments()[k] !== ADJUST_DEFAULTS[k]),
  );

  // Internal
  private img = new Image();
  private naturalW = 0;
  private naturalH = 0;
  private lastDrawPos = { x: 0, y: 0 };
  /** Object URL created from the fetched blob; revoked on destroy. */
  private objectUrl: string | null = null;

  /** True when the image failed to load entirely. */
  loadError = signal(false);

  /**
   * Set when the browser refuses to export the canvas — the source image is
   * cross-origin and its host didn't send CORS headers, so editing works but
   * the result can't be read back out for saving.
   */
  exportBlocked = signal(false);

  // Free-rotate dial: pixels per degree + tick marks (45°…-45°, majors at 15°).
  readonly PX_PER_DEG = 4;
  readonly FREE_ROTATE_MAX = 45;
  readonly FREE_ROTATE_TICKS = Array.from({ length: 91 }, (_, i) => {
    const angle = 45 - i;
    return { angle, major: angle % 15 === 0 };
  });
  private dialDrag: { startY: number; startAngle: number } | null = null;

  // Expose constants for the template
  readonly ADJUST_GROUPS  = ADJUST_GROUPS;
  readonly FILTER_PRESETS = FILTER_PRESETS;

  private sanitizer = inject(DomSanitizer);
  private iconCache = new Map<string, SafeHtml>();
  /** Trust a control's inline SVG so it can be bound with [innerHTML]. */
  trustIcon(svg: string): SafeHtml {
    let html = this.iconCache.get(svg);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(svg);
      this.iconCache.set(svg, html);
    }
    return html;
  }

  // Adjust tool: live preview is processed from a cached, downscaled snapshot
  // (cheap on every slider tick); "Apply" re-processes the full-res source.
  private adjustSource: HTMLCanvasElement | null = null;
  private adjustPreview: HTMLCanvasElement | null = null;
  private adjustRaf = 0;
  private readonly ADJUST_PREVIEW_MAX = 1400;
  readonly TOOLS: { key: EditorTool; label: string; icon: string; fill?: boolean }[] = [
    { key: 'crop',    label: 'Crop & Extend', fill: true, icon: 'M7,7 L7,5 L8,5 L8,7 L14,7 C15.6568542,7 17,8.34314575 17,10 L17,16 L19,16 L19,17 L17,17 L17,19 L16,19 L16,17 L10,17 C8.34314575,17 7,15.6568542 7,14 L7,8 L5,8 L5,7 L7,7 Z M16,16 L16,10 C16,8.8954305 15.1045695,8 14,8 L8,8 L8,14 C8,15.1045695 8.8954305,16 10,16 L16,16 Z M22.8618505,10.6 L23.9624116,10.6 C23.356556,4.6108387 18.3068092,0 12.2316398,0 C12.1624456,0 12.0936736,0.00181975924 12.0200005,0.00551793594 L15.3816398,3.36715729 L16.6699086,2.07888848 L16.7973046,2.13927495 C20.1355157,3.72160742 22.4450195,6.90965564 22.8618505,10.6 Z M11.934008,23.9952496 L8.5811185,20.6335599 L7.29274785,21.9316175 L7.16465805,21.8705105 C3.82514471,20.2773481 1.51720911,17.0886637 1.10056272,13.3999996 L0,13.3999996 C0.605857095,19.3891609 5.65560391,23.9999996 11.7307733,23.9999996 C11.7987067,23.9999996 11.8581706,23.9986706 11.934008,23.9952496 Z' },
    { key: 'adjust',  label: 'Adjust',  icon: 'M12 3v1m0 16v1m-8-9H3m18 0h-1m-2.636-5.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z' },
    { key: 'filters', label: 'Filters', icon: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z' },
    { key: 'draw',    label: 'Draw',    icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
  ];

  // CSS filter for the live canvas — just the active filter preset. Adjustments
  // are no longer CSS: they're baked into the pixels by the Adjust pipeline.
  cssFilter = computed(() => this.activeFilter() || 'none');

  ngOnInit(): void {
    this.img.onload = () => {
      this.naturalW = this.img.naturalWidth;
      this.naturalH = this.img.naturalHeight;
      this.resizeW.set(this.naturalW);
      this.resizeH.set(this.naturalH);
      this.resetCanvas();
      this.pushUndo();
      this.loading.set(false);
      // Crop is the default tool — show its live frame immediately.
      if (this.activeTool() === 'crop') this.startCrop();
    };
    this.img.onerror = () => {
      this.loading.set(false);
      this.loadError.set(true);
    };
    this.loadImage(this.imageUrl());
  }

  /**
   * Loads the source image so the canvas is editable and exportable.
   *
   * Remote CDN URLs won't taint the canvas only if fetched as a blob and
   * loaded through a same-origin `blob:` URL. We first pull the bytes via
   * XHR (the same mechanism the media service uses for downloads); if that
   * fails (e.g. CORS on the XHR), we fall back to a direct load so the image
   * at least renders.
   */
  private loadImage(url: string): void {
    // Already a same-origin source (the caller fetched it through an
    // authenticated/CORS-safe endpoint) — load it straight in, untainted.
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      this.img.src = url;
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        this.objectUrl = URL.createObjectURL(xhr.response);
        this.img.src = this.objectUrl;
      } else {
        this.img.src = url; // fall back to a direct (possibly tainted) load
      }
    };
    xhr.onerror = () => {
      this.img.src = url; // fall back to a direct (possibly tainted) load
    };
    xhr.send();
  }

  ngOnDestroy(): void {
    this.onCropDragUp(); // detach any in-flight crop drag listeners
    this.onDialUp();     // detach any in-flight rotation-dial listeners
    if (this.adjustRaf) cancelAnimationFrame(this.adjustRaf);
    this.undoStack = [];
    this.redoStack = [];
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
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
    try {
      this.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      this.redoStack = [];
      this.canUndo.set(this.undoStack.length > 1);
      this.canRedo.set(false);
    } catch {
      // Tainted canvas (cross-origin image loaded without CORS) — pixel
      // history is unavailable, but the image still renders and displays.
    }
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

  /**
   * Discard every edit and return to the untouched original (the first frame
   * captured on load). Pending previews (filter, free rotation, adjustments)
   * are cleared and the revert itself is pushed onto the undo stack so it can
   * be undone.
   */
  revertToOriginal(): void {
    if (this.undoStack.length === 0) return;
    // Drop any pending, not-yet-baked previews so the reverted pixels win.
    if (this.adjustRaf) { cancelAnimationFrame(this.adjustRaf); this.adjustRaf = 0; }
    this.activeFilter.set('');
    this.adjustments.set({ ...ADJUST_DEFAULTS });
    this.adjustSource = null;
    this.adjustPreview = null;
    this.rotation.set(0);
    this.flipH.set(false);
    this.flipV.set(false);

    this.restoreState(this.undoStack[0]);
    this.pushUndo();
    if (this.activeTool() === 'crop') this.startCrop();
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
    // The restored pixels are a new baseline for free-rotation and the crop box.
    this.rotationSource = null;
    this.freeRotation.set(0);
    if (this.cropActive()) this.initCropRect();
  }

  // ── Tool: Rotate / Flip ────────────────────────────────────────────────────

  rotate90(dir: 1 | -1): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const srcW = canvas.width, srcH = canvas.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = srcW;
    tempCanvas.height = srcH;
    tempCanvas.getContext('2d')!.drawImage(canvas, 0, 0);

    canvas.width = srcH;
    canvas.height = srcW;
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
    // A 90° turn is rigid: if a free rotation is in play (tilted image with
    // empty corners), rotate its baseline too so the crop keeps inscribing the
    // real pixels. The tilt angle is unchanged by a 90° turn.
    if (this.rotationSource) {
      this.rotationSource = this.rotateCanvas90(this.rotationSource, dir);
    }
    if (this.cropActive()) this.refitCropRect();
    this.pushUndo();
  }

  flip(axis: 'h' | 'v'): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d')!.drawImage(canvas, 0, 0);

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
    // A mirror is rigid too, but it reverses the rotation direction: flip the
    // free-rotation baseline on the same axis and negate the angle so the crop
    // stays inscribed on the real pixels.
    if (this.rotationSource) {
      this.rotationSource = this.flipCanvas(this.rotationSource, axis);
      this.freeRotation.set(-this.freeRotation());
    }
    if (this.cropActive()) this.refitCropRect();
    this.pushUndo();
  }

  /** Rotate a canvas 90° (dir 1 = CW, -1 = CCW) into a fresh, dims-swapped canvas. */
  private rotateCanvas90(src: HTMLCanvasElement, dir: 1 | -1): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = src.height;
    out.height = src.width;
    const ctx = out.getContext('2d')!;
    if (dir === 1) {
      ctx.translate(out.width, 0);
      ctx.rotate(Math.PI / 2);
    } else {
      ctx.translate(0, out.height);
      ctx.rotate(-Math.PI / 2);
    }
    ctx.drawImage(src, 0, 0);
    return out;
  }

  /** Mirror a canvas on the given axis into a fresh canvas of the same size. */
  private flipCanvas(src: HTMLCanvasElement, axis: 'h' | 'v'): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d')!;
    if (axis === 'h') {
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, out.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(src, 0, 0);
    return out;
  }

  // ── Tool: Free (fine) rotation ─────────────────────────────────────────────

  /** Snapshot the current canvas so free-rotation always draws from a clean base. */
  private captureRotationSource(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    c.getContext('2d')!.drawImage(canvas, 0, 0);
    this.rotationSource = c;
  }

  /** Live free-rotate as the slider moves (degrees). Redraws from the snapshot. */
  onFreeRotate(deg: number): void {
    if (!this.rotationSource) this.captureRotationSource();
    this.freeRotation.set(deg);
    this.renderFreeRotation();
  }

  /** Checkpoint into undo history when the slider is released. */
  commitFreeRotation(): void {
    if (this.rotationSource) this.pushUndo();
  }

  resetFreeRotation(): void {
    this.freeRotation.set(0);
    this.renderFreeRotation();
  }

  // ── Rotation dial (vertical tick ruler) ────────────────────────────────────

  onDialDown(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    if (!this.rotationSource) this.captureRotationSource();
    this.dialDrag = { startY: this.pointerY(e), startAngle: this.freeRotation() };
    window.addEventListener('mousemove', this.onDialMove);
    window.addEventListener('mouseup', this.onDialUp);
    window.addEventListener('touchmove', this.onDialMove, { passive: false });
    window.addEventListener('touchend', this.onDialUp);
  }

  private readonly onDialMove = (e: MouseEvent | TouchEvent): void => {
    if (!this.dialDrag) return;
    e.preventDefault();
    // Drag down → the ruler scrolls down → higher angle sits under the pointer.
    const dy = this.pointerY(e) - this.dialDrag.startY;
    let a = Math.round(this.dialDrag.startAngle + dy / this.PX_PER_DEG);
    a = Math.max(-this.FREE_ROTATE_MAX, Math.min(this.FREE_ROTATE_MAX, a));
    this.freeRotation.set(a);
    this.renderFreeRotation();
  };

  private readonly onDialUp = (): void => {
    this.dialDrag = null;
    window.removeEventListener('mousemove', this.onDialMove);
    window.removeEventListener('mouseup', this.onDialUp);
    window.removeEventListener('touchmove', this.onDialMove);
    window.removeEventListener('touchend', this.onDialUp);
    this.commitFreeRotation();
  };

  private pointerY(e: MouseEvent | TouchEvent): number {
    const t = 'touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : null;
    return t ? t.clientY : (e as MouseEvent).clientY;
  }

  /**
   * Straighten: rotate `rotationSource` into its (larger) bounding box, showing
   * the whole image with an "extend" margin around it. The crop frame is then
   * fitted to the largest valid area inside the rotated image and can be resized
   * out to the real image edges (but never onto the empty corners — see
   * `rectValid`).
   */
  private renderFreeRotation(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    const src = this.rotationSource;
    if (!canvas || !src) return;
    const W = src.width, H = src.height;
    const rad = (this.freeRotation() * Math.PI) / 180;
    const a = Math.abs(Math.sin(rad));
    const c = Math.abs(Math.cos(rad));
    const nw = Math.max(1, Math.round(W * c + H * a));
    const nh = Math.max(1, Math.round(W * a + H * c));

    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, nw, nh);
    ctx.save();
    ctx.translate(nw / 2, nh / 2);
    ctx.rotate(rad);
    ctx.drawImage(src, -W / 2, -H / 2);
    ctx.restore();

    this.resizeW.set(nw);
    this.resizeH.set(nh);
    if (this.cropActive()) this.fitCropInscribed();
  }

  /** Geometry mapping display coords → the rotated source rectangle. */
  private cropGeom(): { s: number; cx: number; cy: number; hw: number; hh: number; cos: number; sin: number } | null {
    const canvas = this.mainCanvas()?.nativeElement;
    const box = this.canvasDisplayBox();
    const src = this.rotationSource;
    if (!canvas || !box || !src || !canvas.width) return null;
    const rad = (this.freeRotation() * Math.PI) / 180;
    return {
      s: box.width / canvas.width,                 // display px per canvas px
      cx: box.left + box.width / 2,
      cy: box.top + box.height / 2,
      hw: src.width / 2,
      hh: src.height / 2,
      cos: Math.cos(rad),
      sin: Math.sin(rad),
    };
  }

  /** True when the rect (display coords) lies entirely on real image pixels. */
  private rectValid(r: { x: number; y: number; w: number; h: number }): boolean {
    const g = this.cropGeom();
    if (!g) return true;
    const inside = (xd: number, yd: number): boolean => {
      const dx = (xd - g.cx) / g.s, dy = (yd - g.cy) / g.s;
      const rx = dx * g.cos + dy * g.sin;      // inverse-rotate into source space
      const ry = -dx * g.sin + dy * g.cos;
      return Math.abs(rx) <= g.hw + 0.5 && Math.abs(ry) <= g.hh + 0.5;
    };
    return inside(r.x, r.y) && inside(r.x + r.w, r.y) &&
           inside(r.x, r.y + r.h) && inside(r.x + r.w, r.y + r.h);
  }

  /** Set the crop rect only if it stays on real pixels (used while dragging). */
  private setCropIfValid(r: { x: number; y: number; w: number; h: number }): void {
    if (this.freeRotation() === 0 || !this.rotationSource || this.rectValid(r)) {
      this.cropRect.set(r);
    }
  }

  /** Centre the largest crop of the current ratio that fits the rotated image. */
  private fitCropInscribed(): void {
    const box = this.canvasDisplayBox();
    if (!box) return;
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    const ratio = this.cropRatio() ?? box.width / box.height;
    let lo = this.CROP_MIN, hi = Math.hypot(box.width, box.height);
    for (let i = 0; i < 26; i++) {
      const w = (lo + hi) / 2, h = w / ratio;
      if (this.rectValid({ x: cx - w / 2, y: cy - h / 2, w, h })) lo = w; else hi = w;
    }
    const w = lo, h = w / ratio;
    this.cropRect.set({ x: cx - w / 2, y: cy - h / 2, w, h });
  }

  // ── Tools / panel switching ────────────────────────────────────────────────

  /**
   * Switch the active tool. Leaving Crop commits the current frame (there's no
   * Apply button); entering Crop shows a fresh live frame.
   */
  setTool(tool: EditorTool): void {
    const prev = this.activeTool();
    if (prev === 'crop' && tool !== 'crop') this.commitCrop();
    if (prev === 'adjust' && tool !== 'adjust') this.commitAdjust();
    this.activeTool.set(tool);
    if (tool === 'crop') this.startCrop();
    if (tool === 'adjust') this.captureAdjustSource();
  }

  // ── Tool: Crop ─────────────────────────────────────────────────────────────

  /**
   * The canvas's displayed box relative to `.canvas-area` (the overlay's
   * offset parent). Crop coordinates live in this same space so the overlay
   * lines up with the image even when the canvas is letterboxed/centered.
   */
  private canvasDisplayBox(): { left: number; top: number; width: number; height: number } | null {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return null;
    return {
      left: canvas.offsetLeft,
      top: canvas.offsetTop,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    };
  }

  /** The currently-selected preset view. */
  private selectedPreset(): CropPresetView {
    const list = this.cropPresets();
    return list.find(p => p.key === this.cropSel()) ?? list[0];
  }

  /** Aspect ratio (w/h) the current preset enforces, or null for free crop. */
  private cropRatio(): number | null {
    const p = this.selectedPreset();
    if (p.ratio === null) return null;
    if (p.ratio === 0) return this.naturalH > 0 ? this.naturalW / this.naturalH : null;
    return p.ratio;
  }

  /** Switch the active preset; refit the box in place when a crop is running. */
  setCropPreset(key: string): void {
    this.cropSel.set(key);
    if (this.cropActive()) this.refitCropRect();
  }

  /** Flip every ratio preset between portrait and landscape. */
  setOrientation(o: CropOrientation): void {
    this.cropOrientation.set(o);
    if (this.cropActive()) this.refitCropRect();
  }

  startCrop(): void {
    this.cropActive.set(true);
    this.refitCropRect();
  }

  /**
   * Re-fit the crop box for the current preset. When a free rotation is applied
   * the image is tilted inside a larger canvas (empty corners), so we inscribe
   * the box in the real pixels; otherwise we fit it to the axis-aligned canvas.
   */
  private refitCropRect(): void {
    if (this.freeRotation() !== 0 && this.rotationSource) {
      this.fitCropInscribed();
    } else {
      this.initCropRect();
    }
  }

  /**
   * Center a fresh crop box. Free fills the whole frame (so it's a no-op unless
   * dragged); a ratio preset fits the largest box of that ratio, centered.
   */
  private initCropRect(): void {
    const box = this.canvasDisplayBox();
    if (!box) return;
    const ratio = this.cropRatio();
    let w = box.width;
    let h = box.height;
    if (ratio) {
      if (w / h > ratio) w = h * ratio;
      else h = w / ratio;
    }
    this.cropRect.set({
      x: box.left + (box.width - w) / 2,
      y: box.top + (box.height - h) / 2,
      w,
      h,
    });
  }

  /**
   * Commit the current crop frame (used on tool-switch and Save — there are no
   * Start/Apply buttons). Skips the crop when the frame still covers the whole
   * canvas (a Free frame nobody dragged), so it's a genuine no-op then.
   */
  private commitCrop(): void {
    if (!this.cropActive()) return;
    const box = this.canvasDisplayBox();
    const r = this.cropRect();
    if (box && r.w >= box.width - 2 && r.h >= box.height - 2) {
      this.cancelCrop();
      return;
    }
    this.applyCrop();
  }

  /** Resize + refit, used by the Width/Height fields in the crop panel. */
  commitResize(): void {
    this.applyResize();
    if (this.cropActive()) this.refitCropRect();
  }

  // ── Crop drag / resize gestures ──────────────────────────────────────────

  onCropDown(e: MouseEvent | TouchEvent, mode: CropDragMode): void {
    e.preventDefault();
    e.stopPropagation();
    const p = this.pointerInArea(e);
    this.cropDrag = { mode, startX: p.x, startY: p.y, startRect: { ...this.cropRect() } };
    window.addEventListener('mousemove', this.onCropDragMove);
    window.addEventListener('mouseup', this.onCropDragUp);
    window.addEventListener('touchmove', this.onCropDragMove, { passive: false });
    window.addEventListener('touchend', this.onCropDragUp);
  }

  private readonly onCropDragMove = (e: MouseEvent | TouchEvent): void => {
    if (!this.cropDrag) return;
    e.preventDefault();
    const box = this.canvasDisplayBox();
    if (!box) return;
    const minX = box.left, minY = box.top;
    const maxX = box.left + box.width, maxY = box.top + box.height;

    const p = this.pointerInArea(e);
    const d = this.cropDrag;
    const r0 = d.startRect;

    if (d.mode === 'move') {
      const dx = p.x - d.startX;
      const dy = p.y - d.startY;
      const x = Math.min(Math.max(r0.x + dx, minX), maxX - r0.w);
      const y = Math.min(Math.max(r0.y + dy, minY), maxY - r0.h);
      this.setCropIfValid({ x, y, w: r0.w, h: r0.h });
      return;
    }

    // Edge resize: move one side; the opposite side stays put. With a locked
    // ratio, the perpendicular dimension follows and stays centered.
    if (d.mode === 'n' || d.mode === 's' || d.mode === 'e' || d.mode === 'w') {
      const left = r0.x, top = r0.y, right = r0.x + r0.w, bottom = r0.y + r0.h;
      const px = Math.min(Math.max(p.x, minX), maxX);
      const py = Math.min(Math.max(p.y, minY), maxY);
      let x = left, y = top, w = r0.w, h = r0.h;

      if (d.mode === 'n')      { y = py;  h = bottom - py; }
      else if (d.mode === 's') { h = py - top; }
      else if (d.mode === 'w') { x = px;  w = right - px; }
      else                     { w = px - left; }

      const ratio = this.cropRatio();
      if (ratio && (d.mode === 'n' || d.mode === 's')) {
        h = Math.max(h, this.CROP_MIN);
        w = Math.min(h * ratio, maxX - minX);
        h = w / ratio;
        x = Math.min(Math.max(left + r0.w / 2 - w / 2, minX), maxX - w);
      } else if (ratio) {
        w = Math.max(w, this.CROP_MIN);
        h = Math.min(w / ratio, maxY - minY);
        w = h * ratio;
        y = Math.min(Math.max(top + r0.h / 2 - h / 2, minY), maxY - h);
      } else {
        w = Math.max(w, this.CROP_MIN);
        h = Math.max(h, this.CROP_MIN);
      }
      this.setCropIfValid({ x, y, w, h });
      return;
    }

    // Corner resize: keep the opposite corner anchored.
    const right = r0.x + r0.w, bottom = r0.y + r0.h;
    const anchorX = d.mode === 'nw' || d.mode === 'sw' ? right : r0.x;
    const anchorY = d.mode === 'nw' || d.mode === 'ne' ? bottom : r0.y;
    const leftOfAnchor = d.mode === 'nw' || d.mode === 'sw';
    const aboveAnchor  = d.mode === 'nw' || d.mode === 'ne';

    const px = Math.min(Math.max(p.x, minX), maxX);
    const py = Math.min(Math.max(p.y, minY), maxY);

    let w = Math.abs(px - anchorX);
    let h = Math.abs(py - anchorY);

    // Cap to the canvas edge in the drag direction.
    const maxW = leftOfAnchor ? anchorX - minX : maxX - anchorX;
    const maxH = aboveAnchor ? anchorY - minY : maxY - anchorY;

    const ratio = this.cropRatio();
    if (ratio) {
      // Drive height from width, then clamp both while preserving the ratio.
      h = w / ratio;
      w = Math.min(w, maxW);
      h = Math.min(w / ratio, maxH);
      w = h * ratio;
      w = Math.max(w, this.CROP_MIN);
      h = Math.max(h, this.CROP_MIN);
    } else {
      w = Math.min(Math.max(w, this.CROP_MIN), maxW);
      h = Math.min(Math.max(h, this.CROP_MIN), maxH);
    }

    const x = leftOfAnchor ? anchorX - w : anchorX;
    const y = aboveAnchor ? anchorY - h : anchorY;
    this.setCropIfValid({ x, y, w, h });
  };

  private readonly onCropDragUp = (): void => {
    this.cropDrag = null;
    window.removeEventListener('mousemove', this.onCropDragMove);
    window.removeEventListener('mouseup', this.onCropDragUp);
    window.removeEventListener('touchmove', this.onCropDragMove);
    window.removeEventListener('touchend', this.onCropDragUp);
  };

  /** Pointer position in `.canvas-area` coordinates (matches cropRect space). */
  private pointerInArea(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : null;
    const clientX = touch ? touch.clientX : (e as MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as MouseEvent).clientY;
    // canvas.offsetLeft/Top convert from viewport-relative to area-relative.
    return {
      x: clientX - rect.left + canvas.offsetLeft,
      y: clientY - rect.top + canvas.offsetTop,
    };
  }

  applyCrop(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    const box = this.canvasDisplayBox();
    if (!canvas || !box) return;
    const r = this.cropRect();
    if (r.w < 2 || r.h < 2) return;

    // Convert from area coords → canvas-local display coords → source pixels.
    const scaleX = canvas.width / box.width;
    const scaleY = canvas.height / box.height;

    let sx = Math.round((r.x - box.left) * scaleX);
    let sy = Math.round((r.y - box.top) * scaleY);
    let sw = Math.round(r.w * scaleX);
    let sh = Math.round(r.h * scaleY);

    // Clamp to the source bitmap so getImageData never reads out of bounds.
    sx = Math.max(0, Math.min(sx, canvas.width - 1));
    sy = Math.max(0, Math.min(sy, canvas.height - 1));
    sw = Math.max(1, Math.min(sw, canvas.width - sx));
    sh = Math.max(1, Math.min(sh, canvas.height - sy));

    // Copy the crop region out with drawImage (which — unlike getImageData —
    // works even on a canvas tainted by a cross-origin image), then paint it
    // back as the new canvas contents.
    const temp = document.createElement('canvas');
    temp.width = sw;
    temp.height = sh;
    temp.getContext('2d')!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const ctx = canvas.getContext('2d')!;
    canvas.width = sw;
    canvas.height = sh;
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(temp, 0, 0);

    this.resizeW.set(sw);
    this.resizeH.set(sh);
    this.cropActive.set(false);
    this.cropRect.set({ x: 0, y: 0, w: 0, h: 0 });
    this.rotationSource = null;
    this.freeRotation.set(0);
    this.pushUndo();
  }

  cancelCrop(): void {
    this.cropActive.set(false);
    this.cropRect.set({ x: 0, y: 0, w: 0, h: 0 });
  }

  // ── Tool: Adjust ───────────────────────────────────────────────────────────

  /** Snapshot the current canvas as the adjust baseline + a downscaled preview. */
  private captureAdjustSource(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;
    const full = document.createElement('canvas');
    full.width = canvas.width;
    full.height = canvas.height;
    full.getContext('2d')!.drawImage(canvas, 0, 0);
    this.adjustSource = full;

    const longest = Math.max(canvas.width, canvas.height);
    const scale = longest > this.ADJUST_PREVIEW_MAX ? this.ADJUST_PREVIEW_MAX / longest : 1;
    const prev = document.createElement('canvas');
    prev.width = Math.max(1, Math.round(canvas.width * scale));
    prev.height = Math.max(1, Math.round(canvas.height * scale));
    prev.getContext('2d')!.drawImage(canvas, 0, 0, prev.width, prev.height);
    this.adjustPreview = prev;
  }

  /** Slider handler — update the value and schedule a throttled preview redraw. */
  onAdjustInput(key: string, value: number): void {
    this.adjustments.update(a => ({ ...a, [key]: value }));
    this.scheduleAdjustRender();
  }

  /** Tint colour handler. */
  onTintColor(color: string): void {
    this.tintColor.set(color);
    this.scheduleAdjustRender();
  }

  private scheduleAdjustRender(): void {
    if (this.adjustRaf) return;
    this.adjustRaf = requestAnimationFrame(() => {
      this.adjustRaf = 0;
      const canvas = this.mainCanvas()?.nativeElement;
      if (canvas && this.adjustPreview) this.processInto(this.adjustPreview, canvas);
    });
  }

  /** Reset every slider to its default and restore the untouched image. */
  resetAdjustments(): void {
    this.adjustments.set({ ...ADJUST_DEFAULTS });
    const canvas = this.mainCanvas()?.nativeElement;
    if (canvas && this.adjustSource) {
      canvas.width = this.adjustSource.width;
      canvas.height = this.adjustSource.height;
      canvas.getContext('2d')!.drawImage(this.adjustSource, 0, 0);
    }
  }

  /** Bake the adjustments at full resolution and checkpoint into undo history. */
  applyAdjustments(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas || !this.adjustSource || !this.hasAdjustChanges()) return;
    this.processInto(this.adjustSource, canvas);
    this.resizeW.set(canvas.width);
    this.resizeH.set(canvas.height);
    this.adjustSource = null;
    this.adjustPreview = null;
    this.adjustments.set({ ...ADJUST_DEFAULTS });
    this.pushUndo();
  }

  /** Leaving the Adjust tool: bake pending changes, else drop the snapshots. */
  private commitAdjust(): void {
    if (this.adjustRaf) { cancelAnimationFrame(this.adjustRaf); this.adjustRaf = 0; }
    if (this.hasAdjustChanges()) this.applyAdjustments();
    this.adjustSource = null;
    this.adjustPreview = null;
    this.adjustments.set({ ...ADJUST_DEFAULTS });
  }

  /** True when any slider is off its default (a tint amount > 0 counts too). */
  private hasAdjustChanges(): boolean {
    const a = this.adjustments();
    return Object.keys(ADJUST_DEFAULTS).some(k => a[k] !== ADJUST_DEFAULTS[k]);
  }

  /**
   * Run the full adjustment pipeline: `src` → processed pixels in `dst`.
   * Brightness/contrast/saturation/exposure ride the GPU `ctx.filter`; the rest
   * (highlights, shadows, temperature, tint, vignette, grain) are a single
   * pixel pass; sharpness is an extra unsharp-mask pass when non-zero.
   */
  private processInto(src: HTMLCanvasElement, dst: HTMLCanvasElement): void {
    const a = this.adjustments();
    const w = src.width, h = src.height;
    dst.width = w;
    dst.height = h;
    const ctx = dst.getContext('2d')!;

    // Exposure (stops) folds into brightness; contrast + saturation are native.
    const bright = a['brightness'] * Math.pow(2, a['exposure']);
    ctx.filter = `brightness(${bright}) contrast(${a['contrast']}) saturate(${a['saturation']})`;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';

    const hi = a['highlights'], sh = a['shadows'], temp = a['temperature'];
    const tint = a['tint'], vig = a['vignette'], grain = a['grain'];
    if (hi || sh || temp || tint || vig || grain) {
      const [tr, tg, tb] = this.hexToRgb(this.tintColor());
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const cx = w / 2, cy = h / 2;
      const maxD = Math.hypot(cx, cy) || 1;
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        if (hi) { r = this.tone(r, hi, true); g = this.tone(g, hi, true); b = this.tone(b, hi, true); }
        if (sh) { r = this.tone(r, sh, false); g = this.tone(g, sh, false); b = this.tone(b, sh, false); }
        if (temp) { r += temp * 40; b -= temp * 40; }
        if (tint) { r += (tr - r) * tint; g += (tg - g) * tint; b += (tb - b) * tint; }
        if (vig) {
          const x = p % w, y = (p / w) | 0;
          const dist = Math.hypot(x - cx, y - cy) / maxD;
          const f = 1 - vig * dist * dist;
          r *= f; g *= f; b *= f;
        }
        if (grain) {
          const n = (Math.random() - 0.5) * grain * 60;
          r += n; g += n; b += n;
        }
        d[i] = this.clamp8(r); d[i + 1] = this.clamp8(g); d[i + 2] = this.clamp8(b);
      }
      ctx.putImageData(img, 0, 0);
    }

    const sharp = a['sharpness'] / 25;
    if (sharp) this.applySharpen(ctx, w, h, sharp);
  }

  /** Push a channel toward white/black in the highlight (or shadow) range. */
  private tone(c: number, amt: number, highlight: boolean): number {
    if (highlight) return c > 128 ? c + amt * 63 * ((c - 128) / 127) : c;
    return c < 128 ? c + amt * 63 * ((128 - c) / 128) : c;
  }

  private clamp8(v: number): number {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  private hexToRgb(hex: string): [number, number, number] {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
  }

  /** 3×3 unsharp mask. `amt` in −1…1 (positive sharpens, negative softens). */
  private applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amt: number): void {
    const srcData = ctx.getImageData(0, 0, w, h);
    const s = srcData.data;
    const out = ctx.createImageData(w, h);
    const o = out.data;
    const center = 1 + 4 * amt;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const up = ((Math.max(0, y - 1)) * w + x) * 4;
        const dn = ((Math.min(h - 1, y + 1)) * w + x) * 4;
        const lf = (y * w + Math.max(0, x - 1)) * 4;
        const rt = (y * w + Math.min(w - 1, x + 1)) * 4;
        for (let c = 0; c < 3; c++) {
          o[i + c] = this.clamp8(s[i + c] * center - amt * (s[up + c] + s[dn + c] + s[lf + c] + s[rt + c]));
        }
        o[i + 3] = s[i + 3];
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  // ── Tool: Filters ──────────────────────────────────────────────────────────

  setFilter(preset: FilterPreset): void {
    this.activeFilter.set(preset.css);
  }

  /** Bake the active filter preset into the pixels and clear it. */
  applyFilter(): void {
    const canvas = this.mainCanvas()?.nativeElement;
    const css = this.activeFilter();
    if (!canvas || !css) return;
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tCtx = temp.getContext('2d')!;
    tCtx.filter = css;
    tCtx.drawImage(canvas, 0, 0);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(temp, 0, 0);
    this.activeFilter.set('');
    this.pushUndo();
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
    this.rotationSource = null;
    this.freeRotation.set(0);
    this.pushUndo();
  }

  // ── Save / Cancel ──────────────────────────────────────────────────────────

  /** Longest side (px) allowed in the exported image. */
  private readonly MAX_EXPORT_SIDE = 1600;

  /**
   * Returns a canvas whose longest side is capped at MAX_EXPORT_SIDE. If the
   * source is already within bounds it's returned unchanged; otherwise the
   * pixels are drawn into a smaller temp canvas so we export fewer bytes.
   */
  private downscaleForExport(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const longest = Math.max(canvas.width, canvas.height);
    if (longest <= this.MAX_EXPORT_SIDE) return canvas;

    const scale = this.MAX_EXPORT_SIDE / longest;
    const temp = document.createElement('canvas');
    temp.width = Math.round(canvas.width * scale);
    temp.height = Math.round(canvas.height * scale);
    temp.getContext('2d')!.drawImage(canvas, 0, 0, temp.width, temp.height);
    return temp;
  }

  async onSave(): Promise<void> {
    // Commit a pending crop frame first (there's no explicit Apply button).
    if (this.activeTool() === 'crop') this.commitCrop();
    // Bake any pending adjustments (Adjust tool) and filter preset.
    if (this.activeTool() === 'adjust') this.commitAdjust();
    this.applyFilter();

    const canvas = this.mainCanvas()?.nativeElement;
    if (!canvas) return;

    this.saving.set(true);
    let blob: Blob | null = null;
    try {
      // Cap the exported dimensions (longest side ≤ MAX_EXPORT_SIDE) so we don't
      // upload a huge image the backend will just downscale anyway.
      const source = this.downscaleForExport(canvas);

      // Prefer WebP (smallest, keeps alpha); fall back to JPEG on browsers that
      // can't encode WebP. Quality 0.9 is visually lossless but far smaller than
      // the previous lossless PNG that was tipping importMedia past its timeout.
      const type = source.toDataURL('image/webp').startsWith('data:image/webp')
        ? 'image/webp'
        : 'image/jpeg';

      blob = await new Promise<Blob | null>((resolve, reject) => {
        try {
          source.toBlob(
            b => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
            type,
            0.9,
          );
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      // Tainted canvas — the browser refuses to export a cross-origin image
      // that was loaded without CORS. Surface it instead of silently hanging.
      console.error('Failed to export edited image:', err);
      this.exportBlocked.set(true);
    }

    this.saving.set(false);
    if (blob) this.save.emit(blob);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
