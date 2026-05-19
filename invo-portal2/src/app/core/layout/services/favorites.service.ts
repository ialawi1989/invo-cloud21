import { Injectable, inject, signal } from '@angular/core';
import { EmployeeOptionsService } from './employee-options.service';

export interface FavPage {
  /** Fallback label (plain text) for when no translation key is available or
   *  the user has renamed the favorite. */
  label: string;
  /** i18n key for the page's name. Preferred over `label` at render time so
   *  the favorite re-translates when the UI language changes. Absent on
   *  user-renamed favorites. */
  labelKey?: string;
  link: string;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private optionsService = inject(EmployeeOptionsService);

  favorites   = signal<FavPage[]>([]);
  recentPages = signal<FavPage[]>([]);

  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const opts = await this.optionsService.get();
    if (opts?.sidebar?.favorites?.length)
      this.favorites.set(opts.sidebar.favorites);
    if (opts?.sidebar?.recentPages?.length)
      this.recentPages.set(opts.sidebar.recentPages);
  }

  async save(): Promise<void> {
    await this.optionsService.patch({
      sidebar: {
        favorites:   this.favorites(),
        recentPages: this.recentPages(),
      }
    });
  }

  async addFavorite(page: FavPage): Promise<void> {
    // Lazy-load on first explicit action so we don't fetch employee
    // options at app boot — but also don't clobber server state when
    // the user clicks "add" before we've hydrated.
    await this.load();
    if (this.favorites().some(f => f.link === page.link)) return;
    this.favorites.update(fs => [...fs, page]);
    this.save();
  }

  async removeFavorite(link: string): Promise<void> {
    await this.load();
    this.favorites.update(fs => fs.filter(f => f.link !== link));
    this.save();
  }

  async updateFavorite(link: string, label: string): Promise<void> {
    await this.load();
    // User-provided rename → drop the i18n key so the custom text sticks.
    this.favorites.update(fs =>
      fs.map(f => f.link === link ? { ...f, label, labelKey: undefined } : f)
    );
    this.save();
  }

  addRecent(page: FavPage): void {
    const current = this.recentPages();
    if (current[0]?.link === page.link) return;
    this.recentPages.set(
      [page, ...current.filter(p => p.link !== page.link)].slice(0, 10)
    );
    // Intentionally no save() here — recents are tracked on every
    // NavigationEnd, and persisting them would fire setEmployeeOptions
    // on every page change. The server only learns about recents the
    // next time a real action (favorite add/remove/rename) flushes the
    // current state, which is fine — recents are a UX nicety, not
    // load-bearing data.
  }

  isFavorite(link: string): boolean {
    return this.favorites().some(f => f.link === link);
  }
}
