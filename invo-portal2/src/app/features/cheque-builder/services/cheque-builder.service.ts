import { Injectable } from '@angular/core';

import { ChequeListParams, ChequeListResult, ChequeTemplate, parseChequeTemplate } from '../models/cheque-template.model';

const STORAGE_KEY = 'chequeList';

/**
 * Cheque templates - the legacy `ChequeBuilderService`: the whole list lives in `localStorage['chequeList']`
 * (no backend route exists for cheques in InvoCloudBack). Two legacy bug fixes: delete wrote the shortened list to
 * `websiteNavigationList` (so nothing was ever deleted), and a new template was saved with an empty id (so it could
 * never be opened again) - it now gets an id on first save.
 */
@Injectable({ providedIn: 'root' })
export class ChequeBuilderService {
  private read(): ChequeTemplate[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(parseChequeTemplate) : [];
    } catch { return []; }
  }

  private write(list: ChequeTemplate[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  async getList(params: ChequeListParams = {}): Promise<ChequeListResult> {
    let list = this.read();
    const term = (params.searchTerm ?? '').trim().toLowerCase();
    if (term) list = list.filter(t => `${t.name} ${t.bank}`.toLowerCase().includes(term));
    const sv = params.sortBy?.sortValue as keyof ChequeTemplate | undefined;
    if (sv) {
      const dir = params.sortBy?.sortDirection?.toLowerCase() === 'desc' ? -1 : 1;
      list = [...list].sort((a, b) => String(a[sv] ?? '').localeCompare(String(b[sv] ?? ''), undefined, { numeric: true }) * dir);
    }
    const page = params.page ?? 1;
    const limit = params.limit ?? 15;
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      list: list.slice(start, end),
      count: list.length,
      pageCount: Math.max(1, Math.ceil(list.length / limit)),
      startIndex: start + 1,
      lastIndex: Math.min(end, list.length),
    };
  }

  async getById(id: string): Promise<ChequeTemplate | null> {
    return this.read().find(t => t.id === id) ?? null;
  }

  /** Insert or replace by id; returns the saved template (id assigned when new). */
  async save(template: ChequeTemplate): Promise<{ success: boolean; data: ChequeTemplate }> {
    const data: ChequeTemplate = { ...template, id: template.id || crypto.randomUUID() };
    const list = this.read();
    const i = list.findIndex(t => t.id === data.id);
    if (i >= 0) list[i] = data; else list.push(data);
    this.write(list);
    return { success: true, data };
  }

  async remove(id: string): Promise<{ success: boolean }> {
    this.write(this.read().filter(t => t.id !== id));
    return { success: true };
  }
}
