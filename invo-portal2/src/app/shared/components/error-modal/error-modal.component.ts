import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ApiError } from '@core/http/api.service';

export interface ErrorModalData {
  title: string;
  errors: ApiError[];
}

/**
 * Error display modal showing all error types in a structured format.
 * - Validation errors grouped by field
 * - Business logic errors
 * - Server/auth errors
 * - General error messages
 *
 * Usage:
 *   errorService.showError('Failed to save', errors);
 */
@Component({
  selector: 'app-error-modal',
  standalone: true,
  imports: [CommonModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header
      [title]="data.title"
      icon="<circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/>"
    />

    <div class="body">
      @if (grouped.validation.length) {
        <div class="error-group">
          <h4 class="error-group__title">Validation Errors ({{ grouped.validation.length }})</h4>
          <ul class="error-list">
            @for (err of (grouped.validation | slice:0:5); track $index) {
              <li class="error-item error-item--validation">
                @if (err.field) {
                  <strong class="error-field">{{ err.field }}</strong>
                }
                {{ err.message }}
              </li>
            }
            @if (grouped.validation.length > 5) {
              <li class="error-item error-item--validation error-item--more">
                ... and {{ grouped.validation.length - 5 }} more validation error(s)
              </li>
            }
          </ul>
        </div>
      }

      @if (grouped.business.length) {
        <div class="error-group">
          <h4 class="error-group__title">Business Logic ({{ grouped.business.length }})</h4>
          <ul class="error-list">
            @for (err of (grouped.business | slice:0:5); track $index) {
              <li class="error-item error-item--business">
                {{ err.message }}
              </li>
            }
            @if (grouped.business.length > 5) {
              <li class="error-item error-item--business error-item--more">
                ... and {{ grouped.business.length - 5 }} more error(s)
              </li>
            }
          </ul>
        </div>
      }

      @if (grouped.auth.length) {
        <div class="error-group">
          <h4 class="error-group__title">Authentication ({{ grouped.auth.length }})</h4>
          <ul class="error-list">
            @for (err of (grouped.auth | slice:0:5); track $index) {
              <li class="error-item error-item--auth">
                {{ err.message }}
              </li>
            }
            @if (grouped.auth.length > 5) {
              <li class="error-item error-item--auth error-item--more">
                ... and {{ grouped.auth.length - 5 }} more error(s)
              </li>
            }
          </ul>
        </div>
      }

      @if (grouped.server.length) {
        <div class="error-group">
          <h4 class="error-group__title">Server Error ({{ grouped.server.length }})</h4>
          <ul class="error-list">
            @for (err of (grouped.server | slice:0:5); track $index) {
              <li class="error-item error-item--server">
                {{ err.message }}
              </li>
            }
            @if (grouped.server.length > 5) {
              <li class="error-item error-item--server error-item--more">
                ... and {{ grouped.server.length - 5 }} more error(s)
              </li>
            }
          </ul>
        </div>
      }

      @if (grouped.general.length) {
        <div class="error-group">
          <h4 class="error-group__title">Messages ({{ grouped.general.length }})</h4>
          <ul class="error-list">
            @for (err of (grouped.general | slice:0:5); track $index) {
              <li class="error-item error-item--general">
                {{ err.message }}
              </li>
            }
            @if (grouped.general.length > 5) {
              <li class="error-item error-item--general error-item--more">
                ... and {{ grouped.general.length - 5 }} more message(s)
              </li>
            }
          </ul>
        </div>
      }
    </div>

    <app-modal-footer>
      <button class="btn-close" (click)="ref.close()">Close</button>
    </app-modal-footer>
  `,
  styles: [`
    .body {
      padding: 20px 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .error-group {
      margin-bottom: 16px;

      &:last-child { margin-bottom: 0; }
    }

    .error-group__title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #9ca3af;
      margin: 0 0 8px;
      letter-spacing: 0.5px;
    }

    .error-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .error-item {
      font-size: 13px;
      padding: 10px 12px;
      border-radius: 6px;
      border-left: 3px solid;
      line-height: 1.5;
    }

    .error-field {
      display: block;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 2px;
      text-transform: capitalize;
    }

    .error-item--validation {
      background: #fef3c7;
      border-left-color: #f59e0b;
      color: #92400e;
    }

    .error-item--business {
      background: #fee2e2;
      border-left-color: #ef4444;
      color: #7f1d1d;
    }

    .error-item--auth {
      background: #fecaca;
      border-left-color: #dc2626;
      color: #7f1d1d;
    }

    .error-item--server {
      background: #dbeafe;
      border-left-color: #3b82f6;
      color: #1e3a8a;
    }

    .error-item--general {
      background: #f3f4f6;
      border-left-color: #6b7280;
      color: #374151;
    }

    .error-item--more {
      font-style: italic;
      opacity: 0.85;
      padding: 8px 12px;
    }

    .btn-close {
      padding: 9px 24px;
      background: #32acc1;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        background: #2b95a8;
      }
    }
  `]
})
export class ErrorModalComponent {
  data = inject<ErrorModalData>(MODAL_DATA);
  ref = inject<ModalRef<void>>(MODAL_REF);

  grouped = this.groupErrors(this.data.errors);

  private groupErrors(errors: ApiError[]) {
    return {
      validation: errors.filter(e => e.type === 'validation'),
      business: errors.filter(e => e.type === 'business'),
      auth: errors.filter(e => e.type === 'auth'),
      server: errors.filter(e => e.type === 'server'),
      general: errors.filter(e => e.type === 'general'),
    };
  }
}
