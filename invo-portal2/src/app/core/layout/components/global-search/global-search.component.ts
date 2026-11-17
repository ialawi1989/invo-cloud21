import {
  Component, ElementRef, HostListener, ViewChild, computed, effect, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../../pipes/safe-html.pipe';
import { ModalService } from '../../../../shared/modal/modal.service';
import { GlobalSearchService, SearchHit } from '../../services/global-search.service';

/**
 * Top-bar quick-access search ("sitemap" search). A pill in the bar opens a palette that finds
 * any sidebar page or Settings tile, and Settings pages by text found inside them.
 * Opens with Ctrl/⌘+K or "/" from anywhere.
 */
@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [TranslateModule, SafeHtmlPipe],
  templateUrl: './global-search.component.html',
  styleUrl: './global-search.component.scss',
})
export class GlobalSearchComponent {
  private search = inject(GlobalSearchService);
  private router = inject(Router);
  private modal  = inject(ModalService);

  @ViewChild('input') private inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('list')  private listEl?: ElementRef<HTMLElement>;

  readonly isOpen = signal(false);
  readonly query  = signal('');
  readonly active = signal(0);
  /** Bumped once the lazy Settings strings are in, so `hits` re-evaluates against the full corpus. */
  private readonly indexVersion = signal(0);

  readonly isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  /** Corrected query ("previllege" → "privilege") when the typed one finds nothing. */
  readonly suggestion = computed<string | null>(() => {
    this.indexVersion();
    const q = this.query().trim();
    if (!q || this.search.search(q).length) return null;
    const s = this.search.suggest(q);
    return s && this.search.search(s).length ? s : null;
  });

  readonly hits = computed<SearchHit[]>(() => {
    this.indexVersion();
    const q = this.query().trim();
    if (!q) return this.search.browse();
    return this.search.search(this.suggestion() ?? q);
  });
  readonly hasQuery = computed(() => this.query().trim().length > 0);

  constructor() {
    // Keep the highlighted row inside the scroll area while arrowing through results.
    effect(() => {
      const i = this.active();
      this.hits();
      queueMicrotask(() => {
        this.listEl?.nativeElement.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' });
      });
    });
  }

  async open(): Promise<void> {
    if (this.isOpen()) return;
    this.query.set('');
    this.active.set(0);
    this.isOpen.set(true);
    document.body.style.overflow = 'hidden';
    setTimeout(() => this.inputEl?.nativeElement.focus());
    await this.search.prepare();
    this.indexVersion.update(v => v + 1);
    // Background: load the other pages' text so in-page search works everywhere; refresh when done.
    await this.search.prepareDeep();
    this.indexVersion.update(v => v + 1);
  }

  close(): void {
    this.isOpen.set(false);
    document.body.style.overflow = '';
  }

  onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  applySuggestion(): void {
    const s = this.suggestion();
    if (!s) return;
    this.query.set(s);
    this.active.set(0);
    this.inputEl?.nativeElement.focus();
  }

  onKeydown(e: KeyboardEvent): void {
    const n = this.hits().length;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (n) this.active.set((this.active() + 1) % n); break;
      case 'ArrowUp':   e.preventDefault(); if (n) this.active.set((this.active() - 1 + n) % n); break;
      case 'Enter': {
        e.preventDefault();
        const hit = this.hits()[this.active()];
        if (hit) void this.go(hit);
        break;
      }
      case 'Escape': e.preventDefault(); this.close(); break;
    }
  }

  async go(hit: SearchHit): Promise<void> {
    const e = hit.entry;
    this.close();
    if (e.popup) {
      // Settings tiles pass either a component class or a lazy `() => import(...)` loader.
      const c = e.popup.component;
      const component = typeof c === 'function' && !c.prototype ? await c() : c;
      this.modal.open(component, { size: (e.popup.size as any) ?? 'md', closeOnBackdrop: true });
    } else if (e.link) {
      void this.router.navigate([e.link], { queryParams: e.queryParams ?? null });
    }
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (this.isOpen()) this.close(); else void this.open();
      return;
    }
    if (e.key === '/' && !this.isOpen() && !this.isTyping(e.target)) {
      e.preventDefault();
      void this.open();
    }
  }

  private isTyping(t: EventTarget | null): boolean {
    const el = t as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }
}
