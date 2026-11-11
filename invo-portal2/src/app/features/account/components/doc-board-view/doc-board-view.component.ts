import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { DocCardComponent } from '../doc-card/doc-card.component';
import { DocHScrollComponent } from '../doc-h-scroll/doc-h-scroll.component';
import { DocBoardColumn, DocFetch, DocViewAdapter } from '../doc-views/doc-views.types';
import { TABLET_MIN, injectViewportWidth } from '../doc-views/viewport-width';

interface ColumnState {
  rows:    any[];
  count:   number;
  page:    number;
  pages:   number;
  loading: boolean;
}

const EMPTY: ColumnState = { rows: [], count: 0, page: 0, pages: 0, loading: false };
const PAGE_SIZE = 20;

/**
 * Status board — one column per status of the document, each loading its own
 * pages so a column's count is the true total (not just what fits on screen).
 * Search and filters come from the list page through `fetch`; `query` only
 * signals that they changed so every column reloads.
 */
@Component({
  selector: 'app-doc-board-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, DocCardComponent, DocHScrollComponent],
  // Custom elements are inline by default — the board needs a width to scroll within.
  host: { class: 'block min-w-0 max-w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './doc-board-view.component.html',
})
export class DocBoardViewComponent {
  readonly fetch   = input.required<DocFetch>();
  readonly adapter = input.required<DocViewAdapter>();
  /** Changes whenever the list's search / filters change → reload. */
  readonly query   = input<unknown>(null);

  /** Phone: one column at a time, picked from the status chips. */
  private readonly width = injectViewportWidth();
  readonly isPhone = computed(() => this.width() < TABLET_MIN);

  private readonly pickedId = signal<string | null>(null);
  /** The column shown on a phone (the first one until the user picks another). */
  readonly activeId = computed(() => {
    const cols = this.adapter().columns;
    const picked = this.pickedId();
    return cols.some(c => c.id === picked) ? picked! : (cols[0]?.id ?? '');
  });
  readonly visibleColumns = computed(() =>
    this.isPhone() ? this.adapter().columns.filter(c => c.id === this.activeId()) : this.adapter().columns);
  pick(id: string): void { this.pickedId.set(id); }

  readonly state = signal<Record<string, ColumnState>>({});
  /** Drops results of a load that a newer one superseded. */
  private generation = 0;

  constructor() {
    effect(() => {
      this.query();
      this.fetch();
      untracked(() => void this.reloadAll());
    });
  }

  col(id: string): ColumnState { return this.state()[id] ?? EMPTY; }

  async reloadAll(): Promise<void> {
    const gen = ++this.generation;
    this.state.set({});
    await Promise.all(this.adapter().columns.map(c => this.load(c, 1, gen)));
  }

  loadMore(c: DocBoardColumn): void {
    void this.load(c, this.col(c.id).page + 1, this.generation);
  }

  private patch(id: string, p: Partial<ColumnState>): void {
    this.state.update(s => ({ ...s, [id]: { ...(s[id] ?? EMPTY), ...p } }));
  }

  private async load(c: DocBoardColumn, page: number, gen: number): Promise<void> {
    this.patch(c.id, { loading: true });
    try {
      const res = await this.fetch()({ status: c.statuses, page, limit: PAGE_SIZE });
      if (gen !== this.generation) return;
      const prev = page === 1 ? [] : this.col(c.id).rows;
      this.patch(c.id, {
        rows: [...prev, ...(res.list ?? [])],
        count: res.count ?? 0,
        page,
        pages: res.pageCount ?? 0,
        loading: false,
      });
    } catch (e) {
      console.error('[doc-board] load failed', c.id, e);
      if (gen === this.generation) this.patch(c.id, { loading: false });
    }
  }
}
