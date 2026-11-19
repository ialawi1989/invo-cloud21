import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/** One entity the image can be attached to. */
export interface AttachableEntity {
  id: string;
  name: string;
  reference: string; // 'Product', 'Category', ...
  selected: boolean;
}

/**
 * Attach Media: the counterpart of the Detach Media dialog. Lists entities and links `media` to the ones that are ticked
 * (all of them to start with). Used right after an edited image is saved, with the entities the original image was on, so
 * the saved edit takes its place without going through each product / category by hand.
 *
 * Like Detach Media it only collects the choice: `confirmed` emits the ticked entities and the page does the linking.
 */
@Component({
  selector: 'app-attach-media',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="attach-media-modal">
      <div class="modal-overlay" (click)="onCancel()"></div>

      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Attach Media
          </h2>
          <button class="close-btn" (click)="onCancel()" aria-label="Close">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          @if (items().length === 0) {
            <div class="empty-state"><p>There are no entities to attach this image to</p></div>
          } @else {
            <p class="description">
              Select the entities that should use "<strong>{{ mediaName }}</strong>" as their image:
            </p>

            <div class="entities-list">
              @for (entity of items(); track entity.id) {
                <div class="entity-item" [class.selected]="entity.selected">
                  <input type="checkbox" [id]="'attach-' + entity.id" [(ngModel)]="entity.selected" (change)="onSelectionChange()">
                  <label [for]="'attach-' + entity.id">
                    <span class="badge">{{ entity.reference }}</span>
                    <span class="name">{{ entity.name }}</span>
                  </label>
                </div>
              }
            </div>

            @if (selectedCount() > 0) {
              <div class="selection-summary">
                <strong>{{ selectedCount() }}</strong> {{ selectedCount() === 1 ? 'entity' : 'entities' }} selected
              </div>
            }
          }
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" (click)="onCancel()">Skip</button>
          <button class="attach-btn" [disabled]="selectedCount() === 0" (click)="onAttach()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Attach Selected ({{ selectedCount() }})
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .attach-media-modal {
      position: fixed; inset: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center;

      .modal-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.5); }
      .modal-content {
        position: relative; background: var(--ui-surface); border-radius: 12px; width: 90%; max-width: 600px; max-height: 90vh;
        display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
      .modal-header {
        display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid var(--ui-line);
        h2 { margin: 0; font-size: 1.5rem; font-weight: 600; display: flex; align-items: center; gap: 10px; color: var(--ui-text); }
        h2 svg { color: var(--ui-brand-t600); }
        .close-btn {
          background: none; border: none; cursor: pointer; color: #666; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center; border-radius: 4px;
          &:hover { background: var(--ui-surface-2); }
        }
      }
      .modal-body {
        padding: 1.5rem; overflow-y: auto;
        .empty-state { text-align: center; padding: 2rem; color: #666; p { font-size: 1.125rem; margin: 0; } }
        .description { color: #666; margin-bottom: 1.5rem; strong { color: var(--ui-text); } }
        .entities-list {
          border: 1px solid var(--ui-line); border-radius: 8px; overflow: hidden;
          .entity-item {
            display: flex; align-items: center; padding: 1rem; border-bottom: 1px solid var(--ui-line); transition: background 0.2s;
            &:last-child { border-bottom: none; }
            &:hover { background: var(--ui-surface-1); }
            &.selected { background: var(--color-brand-50, var(--ui-brand-soft)); }
            input[type="checkbox"] { width: 20px; height: 20px; cursor: pointer; margin-right: 1rem; accent-color: var(--color-brand-600, #2691a4); }
            label {
              flex: 1; display: flex; align-items: center; gap: 0.75rem; cursor: pointer;
              .badge { padding: 0.25rem 0.75rem; background: var(--color-brand-600, #2691a4); color: white; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
              .name { color: var(--ui-text-3); font-weight: 500; }
            }
          }
        }
        .selection-summary { margin-top: 1rem; padding: 0.75rem; background: var(--color-brand-50, var(--ui-brand-soft)); border-radius: 8px; text-align: center; color: var(--ui-brand-t700); }
      }
      .modal-footer {
        display: flex; gap: 1rem; padding: 1.5rem; border-top: 1px solid var(--ui-line);
        button { flex: 1; padding: 0.75rem; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: all 0.2s; }
        .cancel-btn { background: white; border: 1px solid var(--ui-line-strong); color: var(--ui-text-3); &:hover { background: var(--ui-surface-2); } }
        .attach-btn {
          background: var(--color-brand-600, #2691a4); color: white; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          &:hover:not(:disabled) { background: var(--color-brand-700, #207484); }
          &:disabled { background: var(--ui-line-strong); cursor: not-allowed; }
        }
      }
    }
  `],
})
export class AttachMediaComponent implements OnInit {
  /** The image being attached (its `name` is shown). */
  @Input() media: any = null;
  /** The entities offered, `{ id, name, reference }`. */
  @Input() entities: Array<{ id: string; name: string; reference: string }> = [];

  @Output() confirmed = new EventEmitter<any[]>();
  @Output() cancelled = new EventEmitter<void>();

  items = signal<AttachableEntity[]>([]);
  selectedCount = signal(0);

  ngOnInit(): void {
    this.items.set((this.entities ?? []).map(e => ({ id: e.id, name: e.name, reference: e.reference, selected: true })));
    this.onSelectionChange();
  }

  get mediaName(): string { return this.media?.name ?? ''; }

  onSelectionChange(): void { this.selectedCount.set(this.items().filter(e => e.selected).length); }

  onAttach(): void {
    const chosen = this.items().filter(e => e.selected);
    if (chosen.length) this.confirmed.emit(chosen);
  }

  onCancel(): void { this.cancelled.emit(); }
}
