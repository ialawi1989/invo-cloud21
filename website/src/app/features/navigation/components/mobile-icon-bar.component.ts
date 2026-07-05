import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { NavigationService } from '../services/navigation.service';
import { MobileIconItem, mobileHref } from '../models/navigation.types';

/**
 * Storefront bottom icon bar for phones. Renders the enabled items the
 * merchant configured (max 5), each with its chosen icon + label. Only
 * visible on small screens; hidden on desktop where the full nav shows.
 */
@Component({
  selector: 'app-mobile-icon-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length) {
      <nav class="mbar">
        @for (item of items(); track item.slug) {
          <a class="mbar-item" [href]="href(item)">
            <span class="mbar-icon" [innerHTML]="icon(item)"></span>
            <span class="mbar-label">{{ label(item) }}</span>
          </a>
        }
      </nav>
    }
  `,
  styles: [`
    .mbar { position:fixed; left:0; right:0; bottom:0; z-index:300; display:none; align-items:stretch; justify-content:space-around; background:var(--header-bg,#fff); border-top:1px solid rgba(0,0,0,.1); padding:6px 4px env(safe-area-inset-bottom,6px); }
    .mbar-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:4px 2px; color:var(--header-text); text-decoration:none; opacity:.8; }
    .mbar-item:hover { opacity:1; color:var(--primary); }
    .mbar-icon { display:inline-flex; }
    .mbar-icon svg { width:22px; height:22px; }
    .mbar-label { font-size:10px; line-height:1; }
    @media (max-width:768px) { .mbar { display:flex; } }
  `],
})
export class MobileIconBarComponent {
  private nav = inject(NavigationService);
  private sanitizer = inject(DomSanitizer);

  lang = input<string>('en');

  readonly items = computed<MobileIconItem[]>(() =>
    (this.nav.mobileBar()?.list ?? []).filter(i => i.enabled).slice(0, 5),
  );

  label(item: MobileIconItem): string {
    return item.translation?.title?.[this.lang() as 'en' | 'ar'] || item.name || '';
  }
  href(item: MobileIconItem): string { return mobileHref(item.slug, this.lang()); }
  icon(item: MobileIconItem): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(item.icon || '');
  }
}
