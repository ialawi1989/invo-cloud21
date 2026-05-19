import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Detach Media Component
 * Shows linked entities and allows detaching media from them
 */

export interface LinkedEntity {
  id: string;
  name: string;
  reference: string; // 'invoice', 'product', etc.
  selected: boolean;
}

@Component({
  selector: 'app-detach-media',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="detach-media-modal">
      <div class="modal-overlay" (click)="onCancel()"></div>
      
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1"/>
            </svg>
            Detach Media
          </h2>
          <button class="close-btn" (click)="onCancel()" aria-label="Close">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          @if (linkedEntities().length === 0) {
            <div class="empty-state">
              <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              <p>This media is not linked to any entities</p>
            </div>
          } @else {
            <p class="description">
              Select entities to unlink from "<strong>{{ mediaName }}</strong>":
            </p>

            <div class="entities-list">
              @for (entity of linkedEntities(); track entity.id) {
                <div class="entity-item" [class.selected]="entity.selected">
                  <input 
                    type="checkbox"
                    [id]="'entity-' + entity.id"
                    [(ngModel)]="entity.selected"
                    (change)="onSelectionChange()">
                  
                  <label [for]="'entity-' + entity.id">
                    <span class="badge">{{ entity.reference }}</span>
                    <span class="name">{{ entity.name }}</span>
                  </label>
                </div>
              }
            </div>

            @if (selectedCount() > 0) {
              <div class="selection-summary">
                <strong>{{ selectedCount() }}</strong> 
                {{ selectedCount() === 1 ? 'entity' : 'entities' }} selected
              </div>
            }
          }
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" (click)="onCancel()">Cancel</button>
          <button
            class="detach-btn"
            [disabled]="selectedCount() === 0"
            (click)="onDetach()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1"/>
            </svg>
            Detach Selected ({{ selectedCount() }})
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detach-media-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;

      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
      }

      .modal-content {
        position: relative;
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid #E5E7EB;

        h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #111827;
        }
        h2 svg {
          color: #6b7280;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #666;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;

          &:hover {
            background: #F3F4F6;
          }
        }
      }

      .modal-body {
        padding: 1.5rem;
        overflow-y: auto;

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #666;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;

          svg { color: #9ca3af; }

          p {
            font-size: 1.125rem;
            margin: 0;
          }
        }

        .description {
          color: #666;
          margin-bottom: 1.5rem;

          strong {
            color: #111827;
          }
        }

        .entities-list {
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          overflow: hidden;

          .entity-item {
            display: flex;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #E5E7EB;
            transition: background 0.2s;

            &:last-child {
              border-bottom: none;
            }

            &:hover {
              background: #F9FAFB;
            }

            &.selected {
              background: #EEF2FF;
            }

            input[type="checkbox"] {
              width: 20px;
              height: 20px;
              cursor: pointer;
              margin-right: 1rem;
            }

            label {
              flex: 1;
              display: flex;
              align-items: center;
              gap: 0.75rem;
              cursor: pointer;

              .badge {
                padding: 0.25rem 0.75rem;
                background: #4F46E5;
                color: white;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
              }

              .name {
                color: #374151;
                font-weight: 500;
              }
            }
          }
        }

        .selection-summary {
          margin-top: 1rem;
          padding: 0.75rem;
          background: #EEF2FF;
          border-radius: 8px;
          text-align: center;
          color: #4F46E5;
        }
      }

      .modal-footer {
        display: flex;
        gap: 1rem;
        padding: 1.5rem;
        border-top: 1px solid #E5E7EB;

        button {
          flex: 1;
          padding: 0.75rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn {
          background: white;
          border: 1px solid #D1D5DB;
          color: #374151;

          &:hover {
            background: #F3F4F6;
          }
        }

        .detach-btn {
          background: #EF4444;
          color: white;
          display: inline-flex;
          align-items: center;
          gap: 8px;

          &:hover:not(:disabled) {
            background: #DC2626;
          }

          &:disabled {
            background: #D1D5DB;
            cursor: not-allowed;
          }
        }
      }
    }
  `]
})
export class DetachMediaComponent implements OnInit {
  @Input() media: any = null; // Single media object
  
  @Output() confirmed = new EventEmitter<any[]>();
  @Output() cancelled = new EventEmitter<void>();

  linkedEntities = signal<LinkedEntity[]>([]);
  selectedCount = signal<number>(0);

  ngOnInit(): void {
    if (!this.media) return;

    // Transform media.uploadTo to LinkedEntity format
    const entities: LinkedEntity[] = (this.media.uploadTo || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      reference: item.reference,
      selected: false
    }));
    
    this.linkedEntities.set(entities);
  }

  get mediaName(): string {
    return this.media ? this.media.name : '';
  }

  onSelectionChange(): void {
    const count = this.linkedEntities().filter(e => e.selected).length;
    this.selectedCount.set(count);
  }

  onDetach(): void {
    const selected = this.linkedEntities().filter(e => e.selected);
    if (selected.length === 0) return;

    this.confirmed.emit(selected);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
