import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import { BlogHttpApi } from '../../services/blog-http-api';
import { BlogPost } from '../../services/blog.types';

export interface PickedPost {
  /** Empty string = the "All posts" sentinel (clears the filter). */
  id:    string;
  title: string;
}

export interface PickPostModalData {
  /** Currently selected post id ('' = all). */
  selectedId?: string;
  title?: string;
}

/**
 * Single-select blog-post picker — paginated list with search + infinite
 * scroll, plus an "All posts" row to clear the filter. Mirrors the product /
 * member pickers; better than a dropdown for a long post list. Closes on
 * pick, returning the chosen `PickedPost` (or `undefined` on dismiss).
 */
@Component({
  selector: 'app-pick-post-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  templateUrl: './pick-post-modal.component.html',
  styleUrl: './pick-post-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickPostModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private api      = inject(BlogHttpApi);
  private modalRef = inject<ModalRef<PickedPost>>(MODAL_REF);
  data             = inject<PickPostModalData>(MODAL_DATA) ?? {};

  search  = signal<string>('');
  loading = signal<boolean>(false);
  page    = signal<number>(1);
  hasMore = signal<boolean>(false);
  rows    = signal<PickedPost[]>([]);

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;
  private debounce?: ReturnType<typeof setTimeout>;

  get selectedId(): string { return this.data.selectedId ?? ''; }

  ngOnInit(): void { this.loadPage(1); }

  ngAfterViewInit(): void {
    const el = this.scrollSentinel()?.nativeElement;
    if (!el) return;
    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) this.loadMore();
    }, { root: el.closest('.ppm-list') as Element | null, rootMargin: '120px' });
    this.scrollObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    clearTimeout(this.debounce);
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.loadPage(1), 300);
  }

  async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.listPosts({ page, limit: 20, search: this.search().trim() });
      const rows: PickedPost[] = (res.list ?? []).map((p: BlogPost) => ({ id: p.id, title: this.titleOf(p) }));
      if (page === 1) this.rows.set(rows);
      else this.rows.update((prev) => [...prev, ...rows]);
      this.hasMore.set(page < (res.pageCount ?? 1));
      this.page.set(page);
    } finally {
      this.loading.set(false);
    }
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loadPage(this.page() + 1);
  }

  private titleOf(p: BlogPost): string {
    const t = (p as any)?.translations;
    if (t && typeof t === 'object') {
      return t[p.defaultLanguage]?.title ?? (Object.values(t)[0] as any)?.title ?? (p as any).title ?? '(untitled)';
    }
    return (p as any).title ?? '(untitled)';
  }

  pick(p: PickedPost): void { this.modalRef.close(p); }
  pickAll(): void { this.modalRef.close({ id: '', title: '' }); }
  cancel(): void { this.modalRef.dismiss(); }
}
