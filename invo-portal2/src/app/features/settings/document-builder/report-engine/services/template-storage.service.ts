import { Injectable } from '@angular/core';
import { ReportTemplate } from '../core/types/template.types';

const KEY_PREFIX = 'invo-template:';

/**
 * Storage abstraction. The default implementation persists to localStorage so
 * the designer works offline; swap with an HTTP backend by replacing the
 * provider in the host module.
 */
@Injectable({ providedIn: 'root' })
export class TemplateStorageService {
  save(template: ReportTemplate): void {
    const updated: ReportTemplate = {
      ...template,
      version: template.version + 1,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY_PREFIX + updated.id, JSON.stringify(updated));
  }

  load(id: string): ReportTemplate | null {
    const raw = localStorage.getItem(KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as ReportTemplate) : null;
  }

  list(): ReportTemplate[] {
    const out: ReportTemplate[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) out.push(JSON.parse(raw) as ReportTemplate);
      }
    }
    return out;
  }

  delete(id: string): void {
    localStorage.removeItem(KEY_PREFIX + id);
  }

  exportJson(template: ReportTemplate): string {
    return JSON.stringify(template, null, 2);
  }

  importJson(json: string): ReportTemplate {
    return JSON.parse(json) as ReportTemplate;
  }
}
