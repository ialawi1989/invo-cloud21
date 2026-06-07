import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
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

export interface PickedMember {
  id:     string;
  name:   string;
  email?: string;
  phone?: string;
}

export interface PickMemberModalData {
  /** Member ids already excluded — pre-selected on open. */
  excludedIds?: string[];
  title?: string;
}

export interface PickMemberResult {
  /** Newly picked members (not selected at open). */
  added: PickedMember[];
  /** Ids that were selected at open and the user unchecked. */
  removed: string[];
}

/**
 * Paginated site-member (shopper) picker — mirrors the product picker. Lists
 * shoppers visible to the company via `blog/getShopperList`, with search +
 * infinite scroll + multi-select. Used to choose members to exclude from a
 * comment-moderation rule.
 */
@Component({
  selector: 'app-pick-member-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  templateUrl: './pick-member-modal.component.html',
  styleUrl: './pick-member-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickMemberModalComponent implements OnInit, AfterViewInit, OnDestroy {
  // Inject the root-provided concrete impl, not the route-scoped BLOG_API
  // token — the modal renders in the CDK overlay (root injector), where the
  // blog route's BLOG_API provider isn't visible.
  private api      = inject(BlogHttpApi);
  private modalRef = inject<ModalRef<PickMemberResult>>(MODAL_REF);
  data             = inject<PickMemberModalData>(MODAL_DATA) ?? {};

  search   = signal<string>('');
  loading  = signal<boolean>(false);
  page     = signal<number>(1);
  hasMore  = signal<boolean>(false);
  rows     = signal<PickedMember[]>([]);
  selected = signal<Set<string>>(new Set());

  private initialSelected: Set<string> = new Set();
  private debounce?: ReturnType<typeof setTimeout>;

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private scrollObserver?: IntersectionObserver;

  selectedCount = computed(() => this.selected().size);

  ngOnInit(): void {
    const ids = this.data.excludedIds ?? [];
    this.initialSelected = new Set(ids);
    this.selected.set(new Set(ids));
    this.loadPage(1);
  }

  ngAfterViewInit(): void {
    const el = this.scrollSentinel()?.nativeElement;
    if (!el) return;
    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) this.loadMore();
    }, { root: el.closest('.pmm-list') as Element | null, rootMargin: '120px' });
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
      const res = await this.api.getShopperList({ page, limit: 20, searchTerm: this.search().trim() });
      const rows: PickedMember[] = (res.list ?? []).map((r) => ({
        id:    r.id,
        name:  r.name ?? '',
        email: r.email,
        phone: r.phone,
      }));
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

  toggle(id: string): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isSelected(id: string): boolean { return this.selected().has(id); }

  /** Two-letter initials for the avatar bubble. */
  initials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  confirm(): void {
    const current = this.selected();
    const added = this.rows().filter((r) => current.has(r.id) && !this.initialSelected.has(r.id));
    const removed = [...this.initialSelected].filter((id) => !current.has(id));
    this.modalRef.close({ added, removed });
  }

  cancel(): void { this.modalRef.dismiss(); }
}
