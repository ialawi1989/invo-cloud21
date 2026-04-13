import { inject, DestroyRef } from '@angular/core';
import { LanguageService } from './language.service';

/**
 * Call this in a component's constructor or ngOnInit to load
 * feature-scoped translations. Falls back to base if file missing.
 *
 * @example
 * export class InvoicesComponent {
 *   constructor() { withTranslations('invoices'); }
 * }
 */
export function withTranslations(...features: string[]): void {
  const langService = inject(LanguageService);
  features.forEach(f => langService.loadFeature(f));
}
