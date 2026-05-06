import { Injectable, inject } from '@angular/core';
import { ModalService } from '@shared/modal/modal.service';
import { ErrorModalComponent } from '@shared/components/error-modal/error-modal.component';
import { ApiError, ApiErrorException } from './api.service';

/**
 * Global error display service. Handles showing API errors in a modal.
 * Use this to display any error to the user in a consistent, accessible format.
 */
@Injectable({ providedIn: 'root' })
export class ErrorService {
  private modal = inject(ModalService);

  /**
   * Show an error modal with structured error details.
   * @param message Main error message / title
   * @param errors List of error details to display
   */
  showError(message: string, errors: ApiError[] = []): Promise<void> {
    const ref = this.modal.open(ErrorModalComponent, {
      size: 'sm',
      closeable: true,
      closeOnBackdrop: true,
      data: {
        title: message,
        errors,
      },
    });
    return ref.afterClosed();
  }

  /**
   * Handle an API error exception and display it in a modal.
   * @param error The ApiErrorException or Error thrown by an API call
   */
  handleError(error: unknown): Promise<void> {
    if (error instanceof ApiErrorException) {
      return this.showError(error.message, error.errors);
    }

    if (error instanceof Error) {
      return this.showError(error.message, [
        { type: 'general', message: error.message },
      ]);
    }

    // Handle plain objects
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;
      const msg = errorObj.message || errorObj.msg || JSON.stringify(error);
      return this.showError('An error occurred', [
        { type: 'general', message: msg },
      ]);
    }

    const msg = String(error) || 'An unexpected error occurred';
    return this.showError('An error occurred', [
      { type: 'general', message: msg },
    ]);
  }
}
