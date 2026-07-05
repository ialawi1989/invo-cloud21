import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NavigationService } from '../services/navigation.service';
import { buildNavTree, navName, resolveHref, NavItem } from '../models/navigation.types';

/**
 * Storefront primary navigation — renders the published menu the
 * merchant built in the dashboard: top-level links, nested dropdowns
 * (up to 2 levels) and mega-menu panels (columns with optional image
 * tiles). Colours come from the `--header-*` CSS variables the
 * customizer already sets, so it themes for free.
 *
 * Falls back to nothing when no menu is published — the shell keeps
 * its own default links in that case (see AppComponent).
 */
@Component({
  selector: 'app-site-nav',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tree().length) {
      <nav class="site-nav">
        <ul class="nav-root">
          @for (item of tree(); track item.uId || item.name) {
            <li class="nav-node" [class.has-pop]="item.children?.length || item.isMegaMenu">
              <a class="nav-link" [href]="href(item)">
                {{ label(item) }}
                @if (item.children?.length || item.isMegaMenu) {
                  <svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                }
              </a>

              <!-- Mega panel -->
              @if (item.isMegaMenu && item.megaColumns?.length) {
                <div class="mega" [class.full]="item.megaWidth === 'full'">
                  <div class="mega-inner">
                    @for (col of item.megaColumns; track $index) {
                      <div class="mega-col" [style.flex-basis.%]="col.width || null">
                        @if (col.title) { <h4 class="mega-col-title">{{ col.title }}</h4> }
                        <ul>
                          @for (ci of col.items; track ci.uId || ci.name) {
                            <li>
                              @if (ci.type === 'image') {
                                <a [href]="href(ci)" class="mega-img">
                                  <img [src]="ci.mediaUrl?.defaultUrl || ''" [alt]="ci.name" />
                                </a>
                              } @else {
                                <a [href]="href(ci)">{{ label(ci) }}</a>
                              }
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Nested dropdown -->
              @else if (item.children?.length) {
                <ul class="dropdown">
                  @for (child of item.children; track child.uId || child.name) {
                    <li [class.has-sub]="child.children?.length">
                      <a [href]="href(child)">{{ label(child) }}</a>
                      @if (child.children?.length) {
                        <ul class="sub">
                          @for (g of child.children; track g.uId || g.name) {
                            <li><a [href]="href(g)">{{ label(g) }}</a></li>
                          }
                        </ul>
                      }
                    </li>
                  }
                </ul>
              }
            </li>
          }
        </ul>
      </nav>
    }
  `,
  styles: [`
    .site-nav { display:flex; }
    .nav-root { list-style:none; display:flex; gap:4px; margin:0; padding:0; align-items:center; }
    .nav-node { position:relative; }
    .nav-link { display:inline-flex; align-items:center; gap:4px; padding:8px 12px; color:var(--header-text); text-decoration:none; font-size:14px; opacity:.85; border-radius:6px; white-space:nowrap; }
    .nav-link:hover { opacity:1; }
    .caret { transition:transform .15s; }
    .nav-node:hover > .nav-link .caret { transform:rotate(180deg); }

    /* Pop-outs share a hidden→shown on hover */
    .dropdown, .mega { position:absolute; top:100%; left:0; opacity:0; visibility:hidden; transform:translateY(6px); transition:opacity .15s, transform .15s, visibility .15s; z-index:200; background:var(--header-bg, #fff); border:1px solid rgba(0,0,0,.08); border-radius:10px; box-shadow:0 12px 32px rgba(0,0,0,.12); }
    .nav-node:hover > .dropdown, .nav-node:hover > .mega { opacity:1; visibility:visible; transform:translateY(0); }

    /* Dropdown */
    .dropdown { min-width:200px; padding:6px; list-style:none; }
    .dropdown li { position:relative; list-style:none; }
    .dropdown a { display:block; padding:8px 12px; color:var(--header-text); text-decoration:none; font-size:14px; border-radius:6px; }
    .dropdown a:hover { background:rgba(0,0,0,.05); }
    .dropdown .sub { position:absolute; top:0; left:100%; min-width:190px; padding:6px; margin:0; list-style:none; background:var(--header-bg,#fff); border:1px solid rgba(0,0,0,.08); border-radius:10px; box-shadow:0 12px 32px rgba(0,0,0,.12); opacity:0; visibility:hidden; transition:.15s; }
    .dropdown li.has-sub:hover > .sub { opacity:1; visibility:visible; }

    /* Mega */
    .mega { padding:20px; min-width:520px; }
    .mega.full { left:0; right:0; position:fixed; width:100vw; border-radius:0; }
    .mega-inner { display:flex; gap:28px; max-width:var(--container-width,1200px); margin:0 auto; }
    .mega-col { flex:1 1 0; min-width:140px; }
    .mega-col-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--header-text); opacity:.6; margin:0 0 10px; }
    .mega-col ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
    .mega-col a { color:var(--header-text); text-decoration:none; font-size:14px; opacity:.85; }
    .mega-col a:hover { opacity:1; }
    .mega-img img { width:100%; border-radius:8px; display:block; }

    @media (max-width:768px) { .site-nav { display:none; } }
  `],
})
export class SiteNavComponent {
  private nav = inject(NavigationService);

  /** Active language — feeds href resolution. Defaults to 'en'. */
  lang = input<string>('en');

  readonly tree = computed<NavItem[]>(() => {
    const menu = this.nav.primaryMenu();
    return menu ? buildNavTree(menu.list) : [];
  });

  label(item: NavItem): string { return navName(item, this.lang()); }
  href(item: NavItem): string { return resolveHref(item, this.lang()); }
}
