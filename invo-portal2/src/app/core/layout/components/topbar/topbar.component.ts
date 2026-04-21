import {
  Component, Input, Output, EventEmitter, inject, computed, signal,
  HostListener, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../auth/auth.service';
import { CompanyService } from '../../../auth/company.service';
import { resolveEmployeeName, resolveInitials } from '../../../auth/auth.models';
import { ModalService } from '../../../../shared/modal/modal.service';
import { CompanySwitcherComponent } from './company-switcher.component';
import { LanguageSwitcherComponent } from '../../../i18n/language-switcher.component';
import { LanguageService } from '../../../i18n/language.service';
import { FavoritesService } from '../../services/favorites.service';
import { QuickActionsComponent } from '../sidebar/quick-actions.component';
import { SIDE_MENU } from '../sidebar/sidebar.component';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';
import { BranchConnectionService } from '../../services/branch.service';
import { BranchesPanelComponent } from './branches-panel.component';
import { RecentUpdatesPanelComponent } from './recent-updates-panel.component';

import type { FavPage as FavTab } from '../../services/favorites.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, LanguageSwitcherComponent, QuickActionsComponent, TooltipDirective],
  template: `
    <!-- ── Main topbar ── -->
    <header class="topbar">
      <div class="topbar-left">
        <button class="hamburger" (click)="toggleSidebar()"
                [appTooltip]="'TOPBAR.TOGGLE_SIDEBAR' | translate">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <a routerLink="/dashboard" class="logo-link">
          @if (!logoImgError) {
            <img src="assets/images/invo-logo-black.svg" class="logo-img" alt="invo"
                 (error)="logoImgError = true" />
          } @else {
            <span class="logo-wordmark">invo<span class="logo-dot">.</span></span>
          }
        </a>

        <!-- ── Desktop: Quick Actions + Favorites buttons ── -->
        <div class="desktop-actions">
          <button class="topbar-action-btn" [class.topbar-action-btn--active]="qaOpen()"
                  (click)="toggleQA()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span>{{ 'SIDEBAR.QUICK_ACTIONS' | translate }}</span>
            <svg class="btn-caret" width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 [style.transform]="qaOpen() ? 'rotate(180deg)' : 'rotate(0deg)'">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          <button class="topbar-action-btn"
                  [class.topbar-action-btn--active]="favOpen()"
                  [class.topbar-action-btn--starred]="isCurrentPageFavorited()"
                  (click)="toggleFav()">
            <svg width="14" height="14" viewBox="0 0 24 24"
                 [attr.fill]="isCurrentPageFavorited() ? 'currentColor' : 'none'"
                 stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span>{{ 'SIDEBAR.FAVORITE_PAGES' | translate }}</span>
            <svg class="btn-caret" width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 [style.transform]="favOpen() ? 'rotate(180deg)' : 'rotate(0deg)'">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>

        <!-- ── Mobile: single icon button ── -->
        <button class="mobile-more-btn" [class.mobile-more-btn--active]="mobileMenuOpen()"
                (click)="toggleMobileMenu()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          @if (isCurrentPageFavorited()) {
            <span class="mobile-fav-dot"></span>
          }
        </button>
      </div>


      <div class="topbar-right">
        <app-language-switcher></app-language-switcher>
        <div class="topbar-divider"></div>

        <!-- Fullscreen -->
        <button class="icon-action icon-action--mobile-hide" (click)="toggleFullscreen()"
                [appTooltip]="'TOPBAR.FULLSCREEN' | translate">
          @if (!isFullscreen()) {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          } @else {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
              <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
            </svg>
          }
        </button>

        <!-- Notifications -->
        <button class="icon-action icon-action--badge" [appTooltip]="'TOPBAR.NOTIFICATIONS' | translate">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>

        <!-- Branch connections -->
        <div class="icon-action-wrap icon-action--mobile-hide">
          <button class="icon-action" (click)="openBranches()"
                  [class.icon-action--active]="connectedBranches > 0"
                  [appTooltip]="'TOPBAR.BRANCHES' | translate">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <path d="M6 9v6"/><path d="M9 6h6a3 3 0 0 1 3 3v3"/>
            </svg>
          </button>
          @if (connectedBranches > 0) {
            <span class="icon-count">{{ connectedBranches }}</span>
          }
        </div>

        <!-- Settings -->
        <button class="icon-action icon-action--mobile-hide" [routerLink]="'/settings'"
                [appTooltip]="'TOPBAR.SETTINGS' | translate">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <!-- Recent updates -->
        <button class="icon-action icon-action--badge icon-action--mobile-hide" (click)="openUpdates()" [appTooltip]="'TOPBAR.UPDATES' | translate">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>

        <div class="topbar-divider"></div>
        <button class="avatar-btn" [appTooltip]="displayName()" (click)="openProfile()">
          @if (avatarUrl()) {
            <img [src]="avatarUrl()" class="avatar-img" [alt]="displayName()" />
          } @else {
            <span class="avatar-initials">{{ initials() }}</span>
          }
        </button>
      </div>
    </header>

    <!-- ── Quick Actions panel ── -->
    @if (qaOpen()) {
      <app-quick-actions (close)="closeQA()"></app-quick-actions>
    }

    <!-- ── Favorites dropdown (desktop) ── -->
    @if (favOpen()) {
      <div class="fav-dropdown">
        <div class="fav-dropdown-header">
          <span class="fav-dropdown-title">{{ 'SIDEBAR.FAVORITE_PAGES' | translate }}</span>
          <button class="fav-close-btn" (click)="favOpen.set(false)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="fav-dropdown-body">
          @if (favTabs().length === 0) {
            <p class="fav-empty">{{ 'SIDEBAR.NO_FAVORITES' | translate }}</p>
          }
          @for (fav of favTabs(); track fav.link) {
            <div class="fav-item" [class.fav-item--active]="isActive(fav.link)">
              @if (editingFav()?.link === fav.link) {
                <div class="fav-edit-row">
                  <input class="fav-input" [ngModel]="editingFav()!.label"
                         (ngModelChange)="editingFav.set({link: fav.link, label: $event})"
                         (keydown.enter)="saveFav()" (keydown.escape)="cancelEdit()" />
                  <button class="fav-act-btn fav-act-btn--cancel" (click)="cancelEdit()">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                  <button class="fav-act-btn fav-act-btn--save" (click)="saveFav()">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                </div>
              } @else {
                <svg class="fav-item-star" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <a [routerLink]="fav.link" class="fav-item-label" (click)="favOpen.set(false)">{{ fav.labelKey ? (fav.labelKey | translate) : fav.label }}</a>
                <button class="fav-item-edit" (click)="startEdit(fav)" title="Rename">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="fav-item-remove" (click)="removeFav(fav.link)" title="Remove">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              }
            </div>
          }
        </div>
        <div class="fav-dropdown-footer">
          <button class="fav-add-btn" (click)="addCurrentPage()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {{ 'SIDEBAR.ADD_CURRENT_PAGE' | translate }}
          </button>
          @if (recentPages().length > 0) {
            <p class="fav-recent-label">{{ 'SIDEBAR.RECENTLY_VIEWED' | translate }}</p>
            <div class="fav-recent-chips">
              @for (r of recentPages(); track r.link) {
                <button class="fav-recent-chip" (click)="addFavFromRecent(r)">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {{ r.labelKey ? (r.labelKey | translate) : r.label }}
                </button>
              }
            </div>
          }
        </div>
      </div>
    }

    <!-- ── Mobile bottom sheet ── -->
    @if (mobileMenuOpen()) {
      <div class="mobile-sheet-backdrop" (click)="mobileMenuOpen.set(false)"></div>
      <div class="mobile-sheet">
        <div class="mobile-sheet-handle"></div>

        <!-- Quick Actions section -->
        <button class="mobile-sheet-row" (click)="openMobileQA()">
          <span class="mobile-sheet-icon mobile-sheet-icon--blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </span>
          <span class="mobile-sheet-label">{{ 'SIDEBAR.QUICK_ACTIONS' | translate }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mobile-sheet-chevron">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <div class="mobile-sheet-divider"></div>

        <!-- Favorites section -->
        <div class="mobile-sheet-section-title">{{ 'SIDEBAR.FAVORITE_PAGES' | translate }}</div>

        @if (favTabs().length === 0) {
          <p class="mobile-sheet-empty">{{ 'SIDEBAR.NO_FAVORITES' | translate }}</p>
        }
        @for (fav of favTabs(); track fav.link) {
          <a class="mobile-sheet-row" [routerLink]="fav.link" (click)="mobileMenuOpen.set(false)"
             [class.mobile-sheet-row--active]="isActive(fav.link)">
            <svg class="mobile-sheet-star" width="14" height="14" viewBox="0 0 24 24"
                 fill="currentColor" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span class="mobile-sheet-label">{{ fav.labelKey ? (fav.labelKey | translate) : fav.label }}</span>
            <button class="mobile-sheet-remove" (click)="removeFavMobile(fav.link, $event)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </a>
        }

        <button class="mobile-sheet-add" (click)="addCurrentPageMobile()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {{ 'SIDEBAR.ADD_CURRENT_PAGE' | translate }}
        </button>

        <div class="mobile-sheet-divider"></div>

        <!-- Language section -->
        <div class="mobile-sheet-section-title">{{ 'TOPBAR.LANGUAGE' | translate }}</div>
        @for (lang of langService.available; track lang.code) {
          <button class="mobile-sheet-row mobile-sheet-row--lang" (click)="selectLang(lang.code)">
            <span class="mobile-sheet-icon mobile-sheet-icon--globe">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </span>
            <span class="mobile-sheet-label">{{ lang.nativeLabel }}</span>
            @if (langService.current() === lang.code) {
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#556ee6" stroke-width="2.5" stroke-linecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            }
          </button>
        }
      </div>
    }
  `,
  styles: [`

    .topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1100;
      display: flex; align-items: center; justify-content: space-between;
      height: 56px; padding: 0 16px 0 0;
      background: #fff; border-bottom: 1px solid #e9ecef;
    }
    .topbar-left { display: flex; align-items: center; gap: 6px; }
    .hamburger {
      width: 52px; height: 56px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none;
      color: #495057; cursor: pointer; transition: all .15s;
    }
    .hamburger:hover { background: #f1f3f5; color: #212529; }
    .logo-link { display: flex; align-items: center; text-decoration: none; user-select: none; }
    .logo-img { height: 28px; width: 80px; object-fit: contain; display: block; }
    .logo-wordmark { font-size: 20px; font-weight: 700; color: #2a3042; letter-spacing: -0.5px; }
    .logo-dot { color: #34c2be; }

    /* ── Desktop action buttons ── */
    .desktop-actions { display: flex; align-items: center; gap: 6px; margin-left: 6px; }

    .topbar-action-btn {
      display: flex; align-items: center; gap: 6px;
      height: 32px; padding: 0 10px 0 9px;
      background: transparent; border: 1px solid #e4e7ec; border-radius: 8px;
      color: #495057; font-size: 13px; font-weight: 500;
      cursor: pointer; user-select: none; transition: all .15s;
      white-space: nowrap; flex-shrink: 0;
    }
    .topbar-action-btn:hover { background: #f4f5f7; border-color: #c5cfe0; color: #2a3042; }
    .topbar-action-btn--active { background: #eef1ff; border-color: #556ee6; color: #556ee6; }
    .topbar-action-btn--active svg { color: #556ee6; }
    .topbar-action-btn--active .btn-caret { color: #556ee6; }
    .topbar-action-btn--starred svg:first-child { color: #f4c542; }
    .btn-caret { transition: transform .15s; flex-shrink: 0; color: #9ca3af; }

    /* ── Mobile more button ── */
    .mobile-more-btn {
      display: none; position: relative;
      width: 36px; height: 36px; margin-left: 6px;
      align-items: center; justify-content: center;
      background: transparent; border: 1px solid #e4e7ec; border-radius: 8px;
      color: #495057; cursor: pointer; transition: all .15s; flex-shrink: 0;
    }
    .mobile-more-btn:hover { background: #f4f5f7; }
    .mobile-more-btn--active { background: #eef1ff; border-color: #556ee6; color: #556ee6; }
    .mobile-fav-dot {
      position: absolute; top: 5px; right: 5px;
      width: 6px; height: 6px; border-radius: 50%;
      background: #f4c542; border: 1.5px solid #fff;
    }

    /* ── Topbar right ── */
    .topbar-right { display: flex; align-items: center; gap: 2px; overflow: visible; }
    .topbar-divider { width: 1px; height: 20px; background: #e9ecef; margin: 0 4px; }

    @media (max-width: 767px) {
      app-language-switcher,
      .topbar-divider { display: none; }
      .icon-action--mobile-hide,
      .icon-action-wrap { display: none; }
    }
    .icon-action {
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 8px;
      color: #6c757d; cursor: pointer; transition: all .15s;
      position: relative; text-decoration: none; flex-shrink: 0;
    }
    .icon-action:hover { background: #f1f3f5; color: #212529; }
    .icon-action--active { color: #32acc1; }
    .icon-action--active:hover { background: #e6f7f7; }
    .icon-action--badge::after {
      content: ''; position: absolute; top: 4px; right: 4px;
      width: 7px; height: 7px; border-radius: 50%;
      background: #ef4444; border: 1.5px solid #fff;
    }
    .icon-action-wrap {
      position: relative; display: inline-flex; flex-shrink: 0;
    }
    .icon-count {
      position: absolute; top: -5px; right: -5px;
      min-width: 18px; height: 18px; border-radius: 9px; padding: 0 5px;
      background: #32acc1; color: #fff;
      font-size: 11px; font-weight: 700; line-height: 18px !important;
      border: 2px solid #fff; text-align: center;
      pointer-events: none; white-space: nowrap;
      display: flex; align-items: center; justify-content: center;
    }
    .avatar-btn {
      width: 32px; height: 32px; margin-left: 4px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 50%;
      cursor: pointer; padding: 0; overflow: hidden;
    }
    .avatar-img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
    .avatar-initials {
      width: 32px; height: 32px; border-radius: 50%;
      background: #34c2be; color: #fff; font-size: 12px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      text-transform: uppercase; letter-spacing: .5px; pointer-events: none;
    }

    /* ── Favorites dropdown (desktop) ── */
    .fav-dropdown {
      position: fixed; top: 56px; left: 180px; width: 300px;
      background: #fff; border: 1px solid #e9ecef; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,.12); z-index: 1098;
      animation: dropIn .14s ease; overflow: hidden;
    }
    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fav-dropdown-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px; border-bottom: 1px solid #f0f2f5;
    }
    .fav-dropdown-title { font-size: 13px; font-weight: 600; color: #2a3042; }
    .fav-close-btn {
      width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 6px;
      color: #9ca3af; cursor: pointer; transition: all .12s;
    }
    .fav-close-btn:hover { background: #f4f5f7; color: #2a3042; }
    .fav-dropdown-body { padding: 6px 8px; max-height: 240px; overflow-y: auto; }
    .fav-empty { font-size: 12px; color: #9ca3af; padding: 10px 8px; margin: 0; }
    .fav-item {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 8px; border-radius: 7px; transition: background .1s;
    }
    .fav-item:hover { background: #f4f5f7; }
    .fav-item:hover .fav-item-edit,
    .fav-item:hover .fav-item-remove { opacity: 1; }
    .fav-item--active .fav-item-label { color: #556ee6; font-weight: 500; }
    .fav-item--active .fav-item-star { color: #556ee6; }
    .fav-item-star { color: #f4c542; flex-shrink: 0; }
    .fav-item-label {
      flex: 1; font-size: 13px; color: #2a3042;
      text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .fav-item-label:hover { color: #556ee6; }
    .fav-item-edit, .fav-item-remove {
      width: 22px; height: 22px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 4px;
      color: #adb5bd; cursor: pointer; padding: 0; opacity: 0; transition: all .1s;
    }
    .fav-item-edit:hover { background: #e9ecef; color: #495057; }
    .fav-item-remove:hover { background: #fee2e2; color: #dc2626; }
    .fav-edit-row { display: flex; align-items: center; gap: 5px; width: 100%; }
    .fav-input {
      flex: 1; background: #f4f5f7; border: 1.5px solid #556ee6;
      border-radius: 6px; color: #2a3042; font-size: 16px;
      padding: 4px 8px; outline: none; font-family: inherit;
    }
    .fav-act-btn {
      width: 26px; height: 26px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border: none; border-radius: 50%; cursor: pointer;
    }
    .fav-act-btn--cancel { background: #f1f3f5; color: #6c757d; }
    .fav-act-btn--save   { background: #556ee6; color: #fff; }
    .fav-dropdown-footer { padding: 8px; border-top: 1px solid #f0f2f5; }
    .fav-add-btn {
      display: flex; align-items: center; gap: 7px;
      width: 100%; padding: 8px 8px;
      background: transparent; border: none; border-radius: 7px;
      color: #556ee6; font-size: 13px; cursor: pointer;
      transition: background .12s; font-family: inherit; font-weight: 500;
    }
    .fav-add-btn:hover { background: #eef1ff; }
    .fav-recent-label { font-size: 10px; color: #9ca3af; margin: 10px 0 6px 4px; text-transform: uppercase; letter-spacing: .04em; }
    .fav-recent-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 2px; }
    .fav-recent-chip {
      display: flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: 16px;
      border: 1px solid #e4e7ec; background: transparent;
      color: #495057; font-size: 12px; cursor: pointer; font-family: inherit; transition: all .12s;
    }
    .fav-recent-chip:hover { border-color: #556ee6; color: #556ee6; }
    .fav-recent-chip svg { color: #9ca3af; flex-shrink: 0; }

    /* ── Mobile bottom sheet ── */
    .mobile-sheet-backdrop {
      position: fixed; inset: 0; z-index: 1200;
      background: rgba(0,0,0,.35);
      animation: fadeIn .18s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; } to { opacity: 1; }
    }
    .mobile-sheet {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 1201;
      background: #fff; border-radius: 20px 20px 0 0;
      padding: 0 0 env(safe-area-inset-bottom, 16px);
      box-shadow: 0 -4px 32px rgba(0,0,0,.14);
      animation: sheetUp .22s cubic-bezier(.25,.46,.45,.94);
      max-height: 80vh; overflow-y: auto;
    }
    @keyframes sheetUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    .mobile-sheet-handle {
      width: 36px; height: 4px; border-radius: 2px;
      background: #d1d5db; margin: 12px auto 4px; flex-shrink: 0;
    }
    .mobile-sheet-row {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 20px; text-decoration: none;
      color: #2a3042; transition: background .1s; cursor: pointer;
      background: transparent; border: none; width: 100%;
      font-size: 14px; font-family: inherit; text-align: left;
    }
    .mobile-sheet-row:hover, .mobile-sheet-row:active { background: #f4f5f7; }
    .mobile-sheet-row--active { color: #556ee6; }
    .mobile-sheet-icon {
      width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .mobile-sheet-icon--blue { background: #eef1ff; color: #556ee6; }
    .mobile-sheet-icon--globe { background: #f0faf8; color: #1D9E75; }
    .mobile-sheet-star { color: #f4c542; flex-shrink: 0; }
    .mobile-sheet-row--active .mobile-sheet-star { color: #556ee6; }
    .mobile-sheet-label { flex: 1; }
    .mobile-sheet-chevron { color: #9ca3af; flex-shrink: 0; }
    .mobile-sheet-remove {
      width: 28px; height: 28px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 6px;
      color: #adb5bd; cursor: pointer; padding: 0; transition: all .12s;
    }
    .mobile-sheet-remove:hover { background: #fee2e2; color: #dc2626; }
    .mobile-sheet-divider { height: 1px; background: #f0f2f5; margin: 4px 0; }
    .mobile-sheet-section-title {
      padding: 12px 20px 4px;
      font-size: 11px; font-weight: 600; color: #9ca3af;
      text-transform: uppercase; letter-spacing: .05em;
    }
    .mobile-sheet-empty { font-size: 13px; color: #9ca3af; padding: 8px 20px 4px; margin: 0; }
    .mobile-sheet-add {
      display: flex; align-items: center; gap: 10px;
      width: 100%; padding: 14px 20px; margin-top: 2px;
      background: transparent; border: none; border-top: 1px solid #f0f2f5;
      color: #556ee6; font-size: 14px; font-weight: 500;
      cursor: pointer; font-family: inherit; transition: background .1s;
    }
    .mobile-sheet-add:hover { background: #f4f6ff; }
    .mobile-sheet-row--lang { padding: 8px 20px; }
    .mobile-sheet-row--lang .mobile-sheet-icon { width: 28px; height: 28px; border-radius: 7px; }
    .mobile-sheet-row--lang .mobile-sheet-icon svg { width: 13px; height: 13px; }

    /* ── Responsive breakpoints ── */
    @media (min-width: 768px) {
      .desktop-actions { display: flex; }
      .mobile-more-btn { display: none !important; }
    }
    @media (max-width: 767px) {
      .desktop-actions { display: none; }
      .mobile-more-btn { display: flex; }
    }
  `]
})
export class TopbarComponent {
  @Input()  collapsed = false;
  @Output() menuToggle      = new EventEmitter<void>();
  @Output() collapsedChange = new EventEmitter<boolean>();

  private modal        = inject(ModalService);
  private router       = inject(Router);
  private favsService  = inject(FavoritesService);
  private translateSvc = inject(TranslateService);
  private elRef        = inject(ElementRef);
  auth                 = inject(AuthService);
  companyService       = inject(CompanyService);
  langService          = inject(LanguageService);
  branchSvc            = inject(BranchConnectionService) as BranchConnectionService;
  get connectedBranches() { return this.branchSvc.connectedCount; }

  logoImgError    = false;
  qaOpen          = signal(false);
  favOpen         = signal(false);
  mobileMenuOpen  = signal(false);
  editingFav      = signal<FavTab | null>(null);
  isFullscreen    = signal(false);

  displayName = computed(() => resolveEmployeeName(this.auth.currentEmployee));
  initials    = computed(() => resolveInitials(this.auth.currentEmployee));
  avatarUrl   = computed(() => {
    const emp = this.auth.currentEmployee as any;
    return emp?.avatar ?? emp?.profileImage ?? null;
  });

  favTabs     = computed(() => this.favsService.favorites());
  // Different routes can share the same menu label (e.g. multiple list pages
  // translated as "Product List"). Collapse same-named entries to the most
  // recent one so the dropdown doesn't repeat identical-looking chips.
  recentPages = computed(() => {
    const seen = new Set<string>();
    return this.favsService.recentPages().filter(p => {
      const key = p.labelKey || p.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  isCurrentPageFavorited = computed(() => this.favsService.isFavorite(this.router.url));

  constructor() {
    this.favsService.load();
    this.branchSvc.load();
    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen.set(!!document.fullscreenElement);
    });
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  isActive(link: string): boolean {
    return this.router.url === link || this.router.url.startsWith(link + '?');
  }

  // ── Quick Actions ──────────────────────────────────────────────
  toggleQA(): void {
    const opening = !this.qaOpen();
    this.qaOpen.set(opening);
    this.favOpen.set(false);
    document.body.style.overflow = opening ? 'hidden' : '';
  }

  closeQA(): void {
    this.qaOpen.set(false);
    document.body.style.overflow = '';
  }

  // ── Favorites (desktop) ────────────────────────────────────────
  toggleFav(): void {
    const opening = !this.favOpen();
    this.favOpen.set(opening);
    if (opening) { this.qaOpen.set(false); document.body.style.overflow = ''; }
    this.editingFav.set(null);
  }

  addCurrentPage(): void {
    const url   = this.router.url;
    const flat  = SIDE_MENU.flatMap((m: any) => m.subItems ?? [m]);
    const found = flat.find((i: any) => i.link === url);
    const key   = found?.label ?? url.split('/').pop() ?? url;
    const translated = this.translateSvc.instant(key);
    const hasKey = translated !== key;
    this.favsService.addFavorite({
      label: hasKey ? translated : key,
      labelKey: hasKey ? key : undefined,
      link: url,
    });
  }

  addFavFromRecent(r: FavTab): void { this.favsService.addFavorite(r); }
  removeFav(link: string): void { this.favsService.removeFavorite(link); }
  startEdit(fav: FavTab): void { this.editingFav.set({ ...fav }); }
  saveFav(): void {
    const e = this.editingFav();
    if (!e) return;
    this.favsService.updateFavorite(e.link, e.label);
    this.editingFav.set(null);
  }
  cancelEdit(): void { this.editingFav.set(null); }

  // ── Mobile bottom sheet ────────────────────────────────────────
  toggleMobileMenu(): void {
    const opening = !this.mobileMenuOpen();
    this.mobileMenuOpen.set(opening);
    document.body.style.overflow = opening ? 'hidden' : '';
  }

  openMobileQA(): void {
    this.mobileMenuOpen.set(false);
    document.body.style.overflow = '';
    setTimeout(() => this.toggleQA(), 50);
  }

  addCurrentPageMobile(): void {
    this.addCurrentPage();
    // Stay open so user sees the page added
  }

  removeFavMobile(link: string, e: Event): void {
    e.preventDefault(); e.stopPropagation();
    this.favsService.removeFavorite(link);
  }

  selectLang(code: string): void {
    this.langService.use(code);
    this.mobileMenuOpen.set(false);
    document.body.style.overflow = '';
  }

  // ── Global click — close panels when clicking outside ──────────
  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(e.target as Node)) {
      if (this.qaOpen()) this.closeQA();
      if (this.favOpen()) this.favOpen.set(false);
    }
  }

  toggleSidebar(): void {
    if (window.innerWidth <= 991) {
      this.menuToggle.emit();
    } else {
      this.collapsedChange.emit(!this.collapsed);
    }
  }

  openProfile(): void {
    this.modal.open(CompanySwitcherComponent, {
      drawer: true, drawerWidth: '300px', closeOnBackdrop: true,
    });
  }

  openBranches(): void {
    this.modal.open(BranchesPanelComponent, {
      drawer: true, drawerWidth: '320px', closeOnBackdrop: true,
    });
  }

  openUpdates(): void {
    this.modal.open(RecentUpdatesPanelComponent, {
      drawer: true, drawerWidth: '380px', closeOnBackdrop: true,
    });
  }
}
