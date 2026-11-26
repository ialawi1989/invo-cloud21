import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SettingItem } from '../../../../features/settings/settings.catalog';
import { SettingsAccessService } from '../../../../features/settings/services/settings-access.service';
import { SettingsModeService } from '../../services/settings-mode.service';

/**
 * The settings sub-menu rail. Owned by the layout and rendered once, beside the router outlet — never inside a page.
 * Flat (no card): a hairline on its inner edge, a small muted group label, then the group's accessible tiles with the
 * current one highlighted. It collapses to a 56px strip (in memory only). On phones it becomes a horizontal strip.
 */
@Component({
  selector: 'app-settings-submenu',
  standalone: true,
  imports: [RouterModule, TranslateModule],
  template: `
    @if (mode.activeGroup(); as group) {
      <nav class="ssub" [class.is-collapsed]="mode.railCollapsed()" [attr.aria-label]="'SETTINGS.SUBMENU_LABEL' | translate">
        <div class="ssub-head">
          @if (!mode.railCollapsed()) { <h2 class="ssub-title">{{ group.title | translate }}</h2> }
          <button type="button" class="ssub-toggle"
                  [attr.aria-expanded]="!mode.railCollapsed()" aria-controls="settings-rail-list"
                  [attr.aria-label]="(mode.railCollapsed() ? 'SETTINGS.EXPAND_MENU' : 'SETTINGS.COLLAPSE_MENU') | translate"
                  (click)="mode.railCollapsed.set(!mode.railCollapsed())">
            <svg class="flip" [class.is-collapsed]="mode.railCollapsed()" width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>
        <ul class="ssub-list" id="settings-rail-list" [hidden]="mode.railCollapsed()">
          @for (item of items(); track item.label + (item.link ?? '') + (item.queryParams?.['type'] ?? '')) {
            <li>
              @if (item.link) {
                <a class="ssub-row" [routerLink]="item.link" [queryParams]="item.queryParams ?? null"
                   [class.active]="item === mode.activeItem()"
                   [attr.aria-current]="item === mode.activeItem() ? 'page' : null"
                   (click)="mode.choose(group.id)">{{ item.label | translate }}</a>
              } @else if (item.popup) {
                <button type="button" class="ssub-row" (click)="access.openPopup(item.popup)">{{ item.label | translate }}</button>
              }
            </li>
          }
        </ul>
      </nav>
    }
  `,
  styles: [`
    :host { display: block; width: 224px; flex-shrink: 0; box-sizing: border-box;
            background: var(--ui-surface); border-inline-end: 1px solid var(--ui-line); }
    :host(.collapsed) { width: 56px; }
    .ssub { height: 100%; overflow-y: auto; overflow-x: hidden; }
    /* 24px from the main menu to the rail's content, and the title sits on the page content's top line (24px down). */
    .ssub-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px;
                 padding: 24px 12px 12px 24px; }
    .ssub.is-collapsed .ssub-head { padding-inline: 0; justify-content: center; }
    .ssub-title { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ui-muted); }
    .ssub-toggle { display: inline-flex; padding: 6px; border: 0; border-radius: 6px; background: transparent; color: var(--ui-muted); cursor: pointer; }
    .ssub-toggle:hover { background: var(--ui-surface-2); color: var(--ui-text-2); }
    .ssub-toggle svg.is-collapsed { transform: scaleX(-1); }
    .ssub-list { list-style: none; margin: 0; padding: 0 12px 16px; display: flex; flex-direction: column; gap: 2px; }
    .ssub-row {
      display: block; width: 100%; box-sizing: border-box; padding: 8px 12px; border: 0; border-radius: 8px;
      background: transparent; color: var(--ui-text); font: inherit; font-size: 13.5px;
      text-align: start; text-decoration: none; cursor: pointer;
    }
    .ssub-row:hover { background: var(--ui-surface-2); }
    .ssub-row.active { background: var(--ui-brand-soft); color: var(--ui-text-2); font-weight: 600; }
    .ssub-row:focus-visible, .ssub-toggle:focus-visible { outline: 2px solid var(--ui-brand-t700); outline-offset: -2px; }
    :host-context([dir='rtl']) .ssub-toggle svg { transform: scaleX(-1); }
    :host-context([dir='rtl']) .ssub-toggle svg.is-collapsed { transform: none; }

    /* Tablet: slimmer. */
    @media (max-width: 1199px) { :host { width: 184px; } :host(.collapsed) { width: 56px; } }

    /* Phone: a horizontal strip above the content, no collapse. */
    @media (max-width: 767px) {
      :host, :host(.collapsed) { width: auto; border-inline-end: 0; border-bottom: 1px solid var(--ui-line); }
      .ssub { height: auto; display: flex; align-items: center; }
      .ssub-head { display: none; }
      .ssub-list[hidden] { display: flex !important; }
      .ssub-list { flex-direction: row; overflow-x: auto; padding: 8px; gap: 4px; scrollbar-width: thin; }
      .ssub-row { white-space: nowrap; width: auto; }
    }

    @media print { :host { display: none !important; } }
  `]
})
export class SettingsSubmenuComponent {
  readonly mode   = inject(SettingsModeService);
  readonly access = inject(SettingsAccessService);

  readonly items = computed<SettingItem[]>(() => {
    const g = this.mode.activeGroup();
    return g ? this.access.accessibleItems(g) : [];
  });
}

/** "Settings / Group / Item" above the page title. "Settings" opens the grid, the group opens its first tile. */
@Component({
  selector: 'app-settings-breadcrumb',
  standalone: true,
  imports: [RouterModule, TranslateModule],
  template: `
    @if (mode.activeGroup(); as group) {
      <nav class="crumbs" [attr.aria-label]="'SETTINGS.BREADCRUMB_LABEL' | translate">
        <ol>
          <li><a routerLink="/settings" (click)="mode.activeGroupId.set(null)">{{ 'SETTINGS.TITLE' | translate }}</a></li>
          <li>
            <svg class="sep" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            @if (first(); as t) {
              <a [routerLink]="t.link" [queryParams]="t.queryParams ?? null">{{ group.title | translate }}</a>
            } @else { {{ group.title | translate }} }
          </li>
          @if (mode.activeItem(); as item) {
            <li aria-current="page">
              <svg class="sep" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
              <span>{{ item.label | translate }}</span>
            </li>
          }
        </ol>
      </nav>
    }
  `,
  styles: [`
    :host { display: block; }
    .crumbs { margin-bottom: 12px; font-size: 13px; }
    ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    li { display: inline-flex; align-items: center; gap: 6px; color: var(--ui-muted); }
    li[aria-current] span { color: var(--ui-text-2); font-weight: 600; }
    a { color: var(--ui-muted); text-decoration: none; border-radius: 4px; }
    a:hover { color: var(--ui-text-2); text-decoration: underline; }
    a:focus-visible { outline: 2px solid var(--ui-brand-t700); outline-offset: 2px; }
    .sep { color: var(--ui-faint); }
    :host-context([dir='rtl']) .sep { transform: scaleX(-1); }
    @media print { :host { display: none !important; } }
  `]
})
export class SettingsBreadcrumbComponent {
  readonly mode   = inject(SettingsModeService);
  private readonly access = inject(SettingsAccessService);

  readonly first = computed(() => {
    const g = this.mode.activeGroup();
    return g ? this.access.firstRoutable(g) : undefined;
  });
}
