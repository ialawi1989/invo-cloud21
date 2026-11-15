import { Injectable } from '@angular/core';

import { Question } from '../models/questionnaire.model';

/**
 * Questionnaire data access.
 *
 * NOT CONNECTED: the legacy screens never called a service (every call in `questionnaire.component.ts` and
 * `questionnaire-form.component.ts` is commented out) and InvoCloudBack (feature/new-project) has no questionnaire
 * route, controller, repo or table. Per the "never invent routes" rule nothing is requested here; once the backend
 * exists, only this file needs to change.
 */
@Injectable({ providedIn: 'root' })
export class QuestionnaireService {
  /** Whether a backend exists for the questionnaire. */
  readonly available = false;

  async getList(_params: { page: number; limit: number; searchTerm: string }): Promise<{ list: Question[]; count: number; pageCount: number }> {
    return { list: [], count: 0, pageCount: 1 };
  }

  async getById(_id: string): Promise<Question | null> {
    return null;
  }

  /** Mirrors the legacy `save()` (a no-op): resolves `{ success: false }` until a backend route exists. */
  async save(_q: Question): Promise<{ success: boolean; msg?: string }> {
    return { success: false, msg: 'QUESTIONNAIRE.NOT_AVAILABLE' };
  }
}
