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
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  constructor() {
    effect(() => {
      const t = this.state.template();
      if (!t) return;
      if (this.silent) return;
      untracked(() => this.record(t));
    });
  }

  private record(snapshot: ReportTemplate): void {
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
    this.undoStack = [];
    this.redoStack = [];
    this.canUndo.set(false);
    this.canRedo.set(false);
  }
}
