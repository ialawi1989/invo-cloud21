import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ReportTemplate } from '../core/types/template.types';
import { DesignerStateService } from './designer-state.service';

const MAX_HISTORY = 100;

/**
 * Snapshot-based history. We store full template snapshots because templates
 * are small (typically <100 blocks). For larger documents, swap this for a
 * patch-based approach (immer-style diffs).
 *
 * The service auto-records on template changes but ignores changes triggered
 * by undo/redo itself (the `silent` flag).
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly state = inject(DesignerStateService);
  private undoStack: ReportTemplate[] = [];
  private redoStack: ReportTemplate[] = [];
  private silent = false;
  /** Set for the duration of a continuous gesture (block drag / resize).
   *  Those write the template once per animation frame, so recording each
   *  one would bury a single drag under ~60 undo steps. */
  private batching = false;
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  constructor() {
    effect(() => {
      const t = this.state.template();
      if (!t) return;
      if (this.silent) return;
      untracked(() => this.record(t));
      // record() flips canUndo/canRedo. `untracked` suppresses dependency
      // tracking but not the write guard, so Angular 17 still needs this —
      // without it every snapshot throws NG0600 and Undo/Redo stay disabled.
    }, { allowSignalWrites: true });
  }

  /**
   * Open a batch: intermediate template writes stop being recorded until
   * `endBatch()`, which lands the final state as ONE undo step. Call it at
   * the start of a drag/resize gesture.
   *
   * Safe to nest-call redundantly — a second `beginBatch()` is a no-op.
   */
  beginBatch(): void {
    this.batching = true;
  }

  /** Close the batch and record where the gesture ended. Recording here
   *  rather than waiting for the effect keeps the timing deterministic: the
   *  effect fires later with the SAME template object, and record()'s
   *  identity guard drops it. */
  endBatch(): void {
    if (!this.batching) return;
    this.batching = false;
    const t = this.state.template();
    if (t) this.record(t);
  }

  private record(snapshot: ReportTemplate): void {
    if (this.batching) return;
    // Skip if identical to top of stack.
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && top === snapshot) return;
    this.undoStack.push(snapshot);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack.length = 0;
    this.canUndo.set(this.undoStack.length > 1);
    this.canRedo.set(false);
  }

  undo(): void {
    if (this.undoStack.length < 2) return;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    const previous = this.undoStack[this.undoStack.length - 1];
    this.silent = true;
    this.state.restore(previous);
    queueMicrotask(() => (this.silent = false));
    this.canUndo.set(this.undoStack.length > 1);
    this.canRedo.set(true);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(next);
    this.silent = true;
    this.state.restore(next);
    queueMicrotask(() => (this.silent = false));
    this.canUndo.set(this.undoStack.length > 1);
    this.canRedo.set(this.redoStack.length > 0);
  }

  clear(): void {
    this.batching = false;
    this.undoStack = [];
    this.redoStack = [];
    this.canUndo.set(false);
    this.canRedo.set(false);
  }
}
