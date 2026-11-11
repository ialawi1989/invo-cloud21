import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'reports_recent';
const MAX = 8;

/** The reports the user opened last (newest first) — the "Recently viewed" row of the Reports page. Kept per browser. */
@Injectable({ providedIn: 'root' })
export class ReportsRecentService {
  private _slugs = signal<string[]>(this.read());
  readonly slugs = this._slugs.asReadonly();

  private read(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, MAX) : [];
    } catch { return []; }
  }

  /** Remember that a report was opened. */
  push(slug: string): void {
    if (!slug) return;
    const next = [slug, ...this._slugs().filter(s => s !== slug)].slice(0, MAX);
    this._slugs.set(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode / quota */ }
  }
}
