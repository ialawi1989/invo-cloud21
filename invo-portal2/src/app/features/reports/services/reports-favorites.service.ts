import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'reports_favorites';
const SEEDED_KEY = 'reports_favorites_seeded';

/**
 * Favourite reports, persisted to `localStorage` (mirrors the legacy
 * `starred_reports` behaviour). Exposed as a signal so the catalog reacts
 * instantly to star toggles.
 */
@Injectable({ providedIn: 'root' })
export class ReportsFavoritesService {
  private _slugs = signal<string[]>(this.read());
  readonly slugs = this._slugs.asReadonly();

  private read(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private write(slugs: string[]): void {
    this._slugs.set(slugs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }

  toggle(slug: string): void {
    const set = new Set(this._slugs());
    set.has(slug) ? set.delete(slug) : set.add(slug);
    this.write([...set]);
  }

  isFavorite(slug: string): boolean {
    return this._slugs().includes(slug);
  }

  /** Star the default reports once (first visit only), never overriding user edits. */
  seedDefaults(slugs: string[]): void {
    if (localStorage.getItem(SEEDED_KEY)) return;
    const merged = new Set([...this._slugs(), ...slugs]);
    this.write([...merged]);
    try {
      localStorage.setItem(SEEDED_KEY, '1');
    } catch {
      /* ignore */
    }
  }
}
