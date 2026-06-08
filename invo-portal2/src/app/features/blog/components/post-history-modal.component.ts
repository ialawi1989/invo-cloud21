import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';

// Modals resolve from the ROOT injector, so the route-scoped BLOG_API token
// isn't visible here — inject the root-provided concrete directly.
import { BlogHttpApi } from '../services/blog-http-api';
import { BlogPost, BlogPostVersion } from '../services/blog.types';

export interface PostHistoryModalData { postId: string; }

/**
 * Full-screen Post History: a left rail of saved versions (current +
 * published/draft/autosave snapshots) and a right preview of the selected
 * version, with a Restore action.
 */
@Component({
  selector: 'app-blog-post-history-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph">
      <header class="ph__head">
        <h2 class="ph__title">{{ 'BLOG.HISTORY.TITLE' | translate }}</h2>
        <button class="ph__close" (click)="close()" aria-label="close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </header>

      <div class="ph__body">
        <!-- Versions list -->
        <aside class="ph__list">
          @if (loading()) {
            <div class="ph__listLoading"><span class="ph__spin"></span></div>
          } @else {
            @for (v of versions(); track v.id) {
              <button class="ph__item" [class.is-active]="selectedId() === v.id" (click)="select(v)">
                <div class="ph__itemMain">
                  <span class="ph__badge" [class.is-current]="v.isCurrent">
                    {{ v.isCurrent ? ('BLOG.HISTORY.CURRENT' | translate) : v.label }}
                  </span>
                  <span class="ph__date">{{ v.createdAt | date:'medium' }}</span>
                  @if (v.editedByName) {
                    <span class="ph__by">{{ 'BLOG.HISTORY.EDITED_BY' | translate }} <b>{{ v.editedByName }}</b></span>
                  }
                </div>
                @if (selectedId() === v.id && !v.isCurrent) {
                  <button class="ph__restore" (click)="restore(); $event.stopPropagation()" [disabled]="restoring()">
                    {{ 'BLOG.HISTORY.RESTORE' | translate }}
                  </button>
                } @else {
                  <span class="ph__chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></span>
                }
              </button>
            }
            @if (versions().length === 0) {
              <p class="ph__empty">{{ 'BLOG.HISTORY.EMPTY' | translate }}</p>
            }
          }
          <div class="ph__hint">
            <span>{{ 'BLOG.HISTORY.HINT' | translate }}</span>
          </div>
        </aside>

        <!-- Preview -->
        <section class="ph__preview">
          @if (loadingDetail()) {
            <div class="ph__previewLoading"><span class="ph__spin"></span></div>
          } @else if (detail()) {
            <article class="ph__doc">
              <h1 class="ph__docTitle">{{ previewTitle() }}</h1>
              <div class="ph__docBody" [innerHTML]="previewContent()"></div>
            </article>
          } @else {
            <p class="ph__empty">{{ 'BLOG.HISTORY.NO_PREVIEW' | translate }}</p>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .ph { display: flex; flex-direction: column; height: 100%; background: #fff; }
    .ph__head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; }
    .ph__title { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; }
    .ph__close { width: 34px; height: 34px; border: 0; background: transparent; border-radius: 8px; color: #475569; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .ph__close:hover { background: #f1f5f9; color: #0f172a; }

    .ph__body { flex: 1; display: flex; min-height: 0; }
    .ph__list { width: 320px; flex-shrink: 0; border-inline-end: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow-y: auto; }
    .ph__item {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      width: 100%; padding: 14px 18px; border: 0; border-bottom: 1px solid #f1f5f9;
      background: transparent; text-align: start; cursor: pointer;
    }
    .ph__item:hover { background: #f8fafc; }
    .ph__item.is-active { background: #eaf6f8; }
    .ph__itemMain { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .ph__badge {
      align-self: flex-start; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;
      background: #eef2f6; color: #475569;
    }
    .ph__badge.is-current { background: #d6f4f8; color: var(--color-brand-700, #2691a4); }
    .ph__date { font-size: 14px; font-weight: 600; color: #0f172a; }
    .ph__by { font-size: 12px; color: #64748b; }
    .ph__by b { font-weight: 600; color: #334155; }
    .ph__chev { color: #cbd5e1; display: inline-flex; }
    .ph__item.is-active .ph__chev { color: var(--color-brand-600, #2691a4); }
    .ph__restore {
      flex-shrink: 0; padding: 7px 16px; border: 0; border-radius: 999px;
      background: var(--color-brand-600, #2691a4); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .ph__restore:hover:not(:disabled) { background: var(--color-brand-700, #207484); }
    .ph__restore:disabled { opacity: .6; cursor: default; }
    .ph__hint { margin-top: auto; padding: 16px 18px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; }

    .ph__preview { flex: 1; overflow-y: auto; background: #fff; padding: 40px 56px; }
    .ph__doc { max-width: 760px; margin: 0 auto; }
    .ph__docTitle { font-size: 34px; font-weight: 800; color: #0f172a; margin: 0 0 24px; }
    .ph__docBody { font-size: 16px; line-height: 1.7; color: #1e293b; }
    .ph__docBody :is(h2,h3) { margin: 24px 0 8px; }
    .ph__docBody img { max-width: 100%; border-radius: 8px; }

    .ph__listLoading, .ph__previewLoading { display: flex; justify-content: center; padding: 40px; }
    .ph__spin { width: 26px; height: 26px; border: 3px solid #e2e8f0; border-top-color: var(--color-brand-600, #2691a4); border-radius: 50%; animation: ph-spin .8s linear infinite; }
    @keyframes ph-spin { to { transform: rotate(360deg); } }
    .ph__empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 14px; }
  `],
})
export class PostHistoryModalComponent implements OnInit {
  private api      = inject(BlogHttpApi);
  private toast    = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private modalRef = inject<ModalRef<BlogPost | undefined>>(MODAL_REF);
  private data     = inject<PostHistoryModalData>(MODAL_DATA);

  loading       = signal(true);
  loadingDetail = signal(false);
  restoring     = signal(false);
  versions      = signal<BlogPostVersion[]>([]);
  selectedId    = signal<string | null>(null);
  detail        = signal<BlogPost | null>(null);

  previewTitle = computed(() => {
    const d = this.detail();
    if (!d) return '';
    const lang = d.defaultLanguage || 'en';
    return d.translations?.[lang]?.title ?? (Object.values(d.translations ?? {})[0] as any)?.title ?? (d as any).title ?? '';
  });
  previewContent = computed<SafeHtml>(() => {
    const d = this.detail();
    if (!d) return '';
    const lang = d.defaultLanguage || 'en';
    const html = d.translations?.[lang]?.content ?? (Object.values(d.translations ?? {})[0] as any)?.content ?? (d as any).content ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  async ngOnInit(): Promise<void> {
    try {
      const list = await this.api.getPostHistory(this.data.postId);
      this.versions.set(list);
      const first = list.find(v => v.isCurrent) ?? list[0];
      if (first) await this.select(first);
    } catch {
      this.versions.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async select(v: BlogPostVersion): Promise<void> {
    this.selectedId.set(v.id);
    this.loadingDetail.set(true);
    try {
      this.detail.set(await this.api.getPostVersion(v.id));
    } catch {
      this.detail.set(null);
    } finally {
      this.loadingDetail.set(false);
    }
  }

  async restore(): Promise<void> {
    const id = this.selectedId();
    if (!id || this.restoring()) return;
    this.restoring.set(true);
    try {
      const post = await this.api.restorePostVersion(this.data.postId, id);
      this.toast.success('BLOG.HISTORY.RESTORED');
      this.modalRef.close(post);
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
      this.restoring.set(false);
    }
  }

  close(): void { this.modalRef.close(undefined); }
}
