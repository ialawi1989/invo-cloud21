import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ContentLibraryService } from '../../services/content-library.service';
import { Website } from '../../../models/website.model';
import { ModalService } from '../../../../../shared/modal/modal.service';
import { NewCollectionModalComponent } from '../../components/new-collection-modal.component';
import { withTranslations } from '../../../../../core/i18n/with-translations';
import { BreadcrumbsComponent, BreadcrumbItem } from '../../../../../shared/components/breadcrumbs';
import { SpinnerComponent } from '../../../../../shared/components/spinner';

@Component({
  selector: 'app-content-library-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BreadcrumbsComponent, SpinnerComponent],
  styles: [`
    :host { display:block; }
    .top-bar { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
    .page-title { font-size:24px; font-weight:700; color:#0f172a; margin:0 0 4px; }
    .page-sub { font-size:14px; color:#64748b; margin:0; }
    .top-actions { display:flex; gap:10px; align-items:center; }
    .btn { display:inline-flex; align-items:center; gap:7px; height:38px; padding:0 20px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; font-family:inherit; border:none; transition:.15s; white-space:nowrap; }
    .btn-primary { background:var(--color-brand-600); color:#fff; }
    .btn-primary:hover { background:var(--color-brand-700); }
    .btn-outline { background:#fff; border:1px solid #e2e8f0; color:#334155; }
    .btn-outline:hover { background:#f8fafc; border-color:#cbd5e1; }
    .search-bar { margin-bottom:24px; }
    .search-input-wrap { position:relative; display:inline-flex; align-items:center; }
    .search-icon { position:absolute; left:13px; color:#94a3b8; pointer-events:none; }
    .search-input { height:40px; width:300px; border:1px solid #e2e8f0; border-radius:8px; padding:0 14px 0 38px; font-size:14px; font-family:inherit; color:#0f172a; background:#fff; outline:none; box-sizing:border-box; }
    .search-input:focus { border-color:var(--color-brand-500); box-shadow:0 0 0 3px rgba(50,172,193,.12); }
    .section-head { display:flex; align-items:center; gap:10px; margin-bottom:6px; padding-bottom:12px; border-bottom:1px solid #e2e8f0; }
    .section-title { font-size:16px; font-weight:600; color:#0f172a; }
    .section-badge { font-size:13px; color:#64748b; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:0; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; background:#fff; }
    .card { padding:20px; border-right:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; cursor:pointer; transition:all .15s; position:relative; min-height:130px; display:flex; flex-direction:column; justify-content:space-between; }
    .card:hover { background:#f8fafc; }
    .card-top { display:flex; align-items:flex-start; justify-content:space-between; }
    .card-name { font-size:14px; font-weight:600; color:#0f172a; margin:0 0 4px; }
    .card-count { font-size:13px; color:#64748b; }
    .card-menu-btn { width:28px; height:28px; border:none; background:transparent; cursor:pointer; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; flex-shrink:0; opacity:0; transition:.12s; }
    .card:hover .card-menu-btn { opacity:1; }
    .card-menu-btn:hover { background:#f1f5f9; color:#334155; }
    .dropdown { position:absolute; top:44px; right:12px; background:#fff; border:1px solid #e2e8f0; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.1); min-width:190px; z-index:200; padding:4px 0; }
    .dd-item { display:flex; align-items:center; gap:10px; padding:9px 16px; font-size:13px; color:#334155; cursor:pointer; transition:background .1s; }
    .dd-item:hover { background:#f8fafc; }
    .dd-item.del { color:#dc2626; }
    .dd-sep { height:1px; background:#f1f5f9; margin:4px 0; }
    .empty { text-align:center; padding:100px 20px; }
    .empty-icon { width:80px; height:80px; border-radius:20px; background:color-mix(in srgb, var(--color-brand-100), transparent 30%); border:1.5px solid var(--color-brand-300); display:flex; align-items:center; justify-content:center; margin:0 auto 20px; }
    .empty-h { font-size:20px; font-weight:700; color:#0f172a; margin:0 0 10px; }
    .empty-p { font-size:14px; color:#94a3b8; margin:0 0 28px; }
  `],
  template: `
    <div>
      <!-- Breadcrumbs + Header -->
      <app-breadcrumbs [items]="breadcrumbs" navClass="mb-2" />
      <div class="top-bar">
        <div>
          <h1 class="page-title">Content Library</h1>
          <p class="page-sub">Store and manage content to display anywhere on your site.</p>
        </div>
        <div class="top-actions">
          <button class="btn btn-outline" (click)="openNewCollection()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Library
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <div class="search-input-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="search-input" [(ngModel)]="searchQuery" placeholder="Search" />
        </div>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div style="display:flex;align-items:center;justify-content:center;padding:100px 0;gap:10px;color:#94a3b8;font-size:14px">
          <app-spinner size="sm" /> Loading collections...
        </div>
      }

      <!-- Empty -->
      @if (!loading() && collections().length === 0) {
        <div class="empty">
          <div class="empty-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--color-brand-500)"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
          </div>
          <h3 class="empty-h">No collections yet</h3>
          <p class="empty-p">Create your first collection to start managing content.</p>
          <button class="btn btn-primary" (click)="openNewCollection()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Library
          </button>
        </div>
      }

      <!-- Collections grid -->
      @if (!loading() && collections().length > 0) {
        <div class="section-head">
          <span class="section-title">Your Collections</span>
          <span class="section-badge">{{ collections().length }}</span>
        </div>
        <div class="grid">
          @for (coll of filteredCollections(); track coll.id) {
            <div class="card" (click)="openCollection(coll)">
              <div class="card-top">
                <div>
                  <p class="card-name">{{ coll.template?.displayName || coll.name }}</p>
                </div>
                <button class="card-menu-btn" (click)="toggleMenu($event, coll.id)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>
                </button>
                @if (openMenuId() === coll.id) {
                  <div class="dropdown" (click)="$event.stopPropagation()">
                    <div class="dd-item" (click)="openCollection(coll); openMenuId.set(null)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit library
                    </div>
                    <div class="dd-sep"></div>
                    <div class="dd-item del" (click)="deleteCollection($event, coll)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      Delete library
                    </div>
                  </div>
                }
              </div>
              <p class="card-count">{{ coll.itemCount ?? 0 }} {{ (coll.itemCount ?? 0) === 1 ? 'item' : 'items' }}</p>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class ContentLibraryListComponent implements OnInit, OnDestroy {
  private cms      = inject(ContentLibraryService);
  private router   = inject(Router);
  private modalSvc = inject(ModalService);

  constructor() { withTranslations('cms'); }

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
    { label: 'Website Content', routerLink: '/website' },
    { label: 'Content Library' },
  ];

  loading     = signal(true);
  collections = signal<any[]>([]);
  openMenuId  = signal<string | null>(null);
  searchQuery = '';
  private clickListener = () => this.openMenuId.set(null);

  filteredCollections() {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.collections();
    return this.collections().filter(c =>
      (c.template?.displayName || c.name || '').toLowerCase().includes(q)
    );
  }

  ngOnInit(): void {
    document.addEventListener('click', this.clickListener);
    this.load();
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.clickListener);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.cms.getCollections();
      const withCounts = await Promise.all(list.map(async (c: Website) => {
        try {
          const { count } = await this.cms.getItems(c.id);
          return { ...c, itemCount: count };
        } catch { return { ...c, itemCount: 0 }; }
      }));
      this.collections.set(withCounts);
    } finally {
      this.loading.set(false);
    }
  }

  openCollection(coll: any): void {
    this.router.navigate(['/website/content-library', coll.id]);
  }

  openNewCollection(): void {
    const ref = this.modalSvc.open(NewCollectionModalComponent, { size: 'sm', closeOnBackdrop: true });
    ref.afterClosed().then((result: any) => {
      if (result?.created) this.load();
    });
  }

  toggleMenu(e: Event, id: string): void {
    e.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  async deleteCollection(e: Event, coll: any): Promise<void> {
    e.stopPropagation();
    this.openMenuId.set(null);
    if (!confirm(`Delete "${coll.template?.displayName || coll.name}"? All items will also be deleted.`)) return;
    await this.cms.deleteCollection(coll.id);
    this.collections.update(list => list.filter(c => c.id !== coll.id));
  }
}
