import { Injectable, signal } from '@angular/core';

export interface UploadToastItem {
  id: string;
  name: string;
  size: string;
  status: 'uploading' | 'completed' | 'failed';
  progress: number; // 0–100
  error?: string;
}

/**
 * Global service for managing the floating upload toast.
 * Any component can push upload items here, and the toast renders them.
 */
@Injectable({ providedIn: 'root' })
export class UploadToastService {
  items    = signal<UploadToastItem[]>([]);
  visible  = signal(false);
  expanded = signal(true);

  /** Add a new upload item (starts as "uploading"). */
  add(item: UploadToastItem): void {
    this.items.update(list => [...list, item]);
    this.visible.set(true);
    this.expanded.set(true);
  }

  /** Update an existing item (e.g. progress, status). */
  update(id: string, changes: Partial<UploadToastItem>): void {
    this.items.update(list =>
      list.map(i => (i.id === id ? { ...i, ...changes } : i)),
    );
  }

  /** Mark an item as completed. */
  complete(id: string): void {
    this.update(id, { status: 'completed', progress: 100 });
  }

  /** Mark an item as failed. */
  fail(id: string, error?: string): void {
    this.update(id, { status: 'failed', error });
  }

  /** Remove all completed items. */
  clearCompleted(): void {
    this.items.update(list => list.filter(i => i.status !== 'completed'));
    if (this.items().length === 0) this.visible.set(false);
  }

  /** Close the toast entirely. */
  dismiss(): void {
    this.visible.set(false);
    this.items.set([]);
  }

  /** Toggle expanded/collapsed. */
  toggleExpand(): void {
    this.expanded.update(v => !v);
  }

  /** Computed counts. */
  get uploadingCount(): number {
    return this.items().filter(i => i.status === 'uploading').length;
  }

  get completedCount(): number {
    return this.items().filter(i => i.status === 'completed').length;
  }

  get totalCount(): number {
    return this.items().length;
  }

  get headerLabel(): string {
    const uploading = this.uploadingCount;
    const completed = this.completedCount;
    if (uploading > 0) return `Uploading ${uploading} File${uploading > 1 ? 's' : ''}`;
    if (completed > 0) return `${completed} Upload${completed > 1 ? 's' : ''} Completed`;
    return 'Uploads';
  }

  get isAllDone(): boolean {
    return this.items().length > 0 && this.uploadingCount === 0;
  }
}
