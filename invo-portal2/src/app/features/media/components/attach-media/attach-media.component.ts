import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Attach Media Component
 * Allows linking media to entities (Invoice, Product, etc.)
 */

export interface EntityOption {
  id: string;
  name: string;
  reference: string; // 'invoice', 'product', 'employee', etc.
}

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
          <p class="description">
            Select entities to link this media to:
          </p>

          <!-- Entity Type Selection -->
          <div class="entity-type-select">
            <label>Entity Type:</label>
            <select [(ngModel)]="selectedEntityType" (change)="onEntityTypeChange()">
              <option value="">-- Select Type --</option>
              <option value="invoice">Invoice</option>
              <option value="product">Product</option>
              <option value="employee">Employee</option>
              <option value="company">Company</option>
              <option value="category">Category</option>
            </select>
          </div>

          <!-- Entity Selection -->
          @if (selectedEntityType) {
            <div class="entity-select">
              <label>Select {{ selectedEntityType }}:</label>
              <select [(ngModel)]="selectedEntityId">
                <option value="">-- Select {{ selectedEntityType }} --</option>
                @for (entity of availableEntities(); track entity.id) {
                  <option [value]="entity.id">{{ entity.name }}</option>
                }
              </select>
            </div>

            <button
              class="add-btn"
              [disabled]="!selectedEntityId"
              (click)="addAttachment()">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Attachment
            </button>
          }

          <!-- Selected Attachments -->
          @if (attachments().length > 0) {
            <div class="attachments-list">
              <h3>Selected Attachments:</h3>
              @for (attachment of attachments(); track attachment.id) {
                <div class="attachment-item">
                  <span class="badge">{{ attachment.reference }}</span>
                  <span class="name">{{ attachment.name }}</span>
                  <button
                    class="remove-btn"
                    (click)="removeAttachment(attachment.id)"
                    aria-label="Remove">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              }
            </div>
          }
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" (click)="onCancel()">Cancel</button>
          <button
            class="save-btn"
            [disabled]="attachments().length === 0"
            (click)="onSave()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save Attachments
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .attach-media-modal {
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
        h2 svg { color: #6b7280; }

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

        .description {
          color: #666;
          margin-bottom: 1.5rem;
        }

        .entity-type-select,
        .entity-select {
          margin-bottom: 1rem;

          label {
            display: block;
            font-weight: 600;
            margin-bottom: 0.5rem;
          }

          select {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #D1D5DB;
            border-radius: 8px;
            font-size: 1rem;

            &:focus {
              outline: none;
              border-color: #4F46E5;
            }
          }
        }

        .add-btn {
          padding: 0.75rem 1.5rem;
          background: #10B981;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;

          &:hover:not(:disabled) {
            background: #059669;
          }

          &:disabled {
            background: #D1D5DB;
            cursor: not-allowed;
          }
        }

        .attachments-list {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #E5E7EB;

          h3 {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 1rem;
          }

          .attachment-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            background: #F9FAFB;
            border-radius: 8px;
            margin-bottom: 0.5rem;

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
              flex: 1;
              color: #374151;
            }

            .remove-btn {
              background: none;
              border: none;
              color: #EF4444;
              font-size: 1.25rem;
              cursor: pointer;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;

              &:hover {
                background: #FEE2E2;
              }
            }
          }
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

        .save-btn {
          background: #4F46E5;
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;

          &:hover:not(:disabled) {
            background: #4338CA;
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
export class AttachMediaComponent {
  @Input() entities: any[] = []; // Available entities list
  
  @Output() attached = new EventEmitter<EntityOption[]>();
  @Output() cancelled = new EventEmitter<void>();

  // State
  selectedEntityType: string = '';
  selectedEntityId: string = '';
  attachments = signal<EntityOption[]>([]);
  availableEntities = signal<EntityOption[]>([]);

  onEntityTypeChange(): void {
    this.selectedEntityId = '';
    // TODO: Load entities from API based on selectedEntityType
    this.loadEntities(this.selectedEntityType);
  }

  private loadEntities(type: string): void {
    // TODO: Replace with actual API call
    // For now, mock data
    const mockEntities: Record<string, EntityOption[]> = {
      'invoice': [
        { id: '1', name: 'INV-2024-001', reference: 'invoice' },
        { id: '2', name: 'INV-2024-002', reference: 'invoice' }
      ],
      'product': [
        { id: '1', name: 'Product A', reference: 'product' },
        { id: '2', name: 'Product B', reference: 'product' }
      ],
      'employee': [
        { id: '1', name: 'John Doe', reference: 'employee' },
        { id: '2', name: 'Jane Smith', reference: 'employee' }
      ],
      'company': [
        { id: '1', name: 'Company ABC', reference: 'company' }
      ],
      'category': [
        { id: '1', name: 'Category 1', reference: 'category' }
      ]
    };

    this.availableEntities.set(mockEntities[type] || []);
  }

  addAttachment(): void {
    if (!this.selectedEntityId) return;

    const entity = this.availableEntities().find(e => e.id === this.selectedEntityId);
    if (!entity) return;

    // Check if already added
    const exists = this.attachments().some(a => a.id === entity.id && a.reference === entity.reference);
    if (exists) {
      alert('This attachment already added!');
      return;
    }

    this.attachments.update(items => [...items, entity]);
    this.selectedEntityId = '';
  }

  removeAttachment(id: string): void {
    this.attachments.update(items => items.filter(a => a.id !== id));
  }

  onSave(): void {
    this.attached.emit(this.attachments());
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
