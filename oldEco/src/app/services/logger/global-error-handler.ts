import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService, registerLogger } from './logger.service';

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggerService);

  constructor() {
    registerLogger(this.logger);
  }

  handleError(error: unknown): void {
    this.logger.error(error, { source: 'angular-error-handler' });
  }
}
