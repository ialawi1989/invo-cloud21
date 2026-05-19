import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/i18n/language.service';

/**
 * Per-language tab strip with completion indicators.
 *
 * `active` is controlled. `completion` tells the strip which language slices
 * are valid (green check) vs missing required fields (yellow warning). The
 * caller owns the data model — this component only renders the chrome and
 * emits change events.
 */
@Component({
  selector: 'app-blog-language-tabs',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lt">
      <div class="lt__tabs">
        @for (l of activeLangs(); track l) {
          <button type="button"
                  class="lt__tab"
                  [class.is-on]="l === active()"
                  (click)="activeChange.emit(l)">
            <span class="lt__code">{{ labelFor(l) }}</span>
            @if (completion()[l] === 'complete') {
              <svg class="lt__icon lt__icon--ok" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            } @else if (completion()[l] === 'partial') {
              <svg class="lt__icon lt__icon--warn" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M12 9v4"/>
                <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
            }
            @if (l === defaultLang() && showDefaultBadge()) {
              <span class="lt__pin" [title]="'BLOG.COMPOSER.DEFAULT' | translate">★</span>
            }
            @if (canRemove() && l !== defaultLang() && activeLangs().length > 1) {
              <button type="button"
                      class="lt__remove"
                      (click)="$event.stopPropagation(); removeLang.emit(l)"
                      [attr.aria-label]="'COMMON.DELETE' | translate">×</button>
            }
          </button>
        }
        @if (addableLangs().length > 0) {
          <div class="lt__add">
            <button type="button" class="lt__addBtn" (click)="addOpen.set(!addOpen())">
              + {{ 'BLOG.COMPOSER.ADD_LANGUAGE' | translate }}
            </button>
            @if (addOpen()) {
              <div class="lt__menu" (click)="$event.stopPropagation()">
                @for (l of addableLangs(); track l) {
                  <button type="button" class="lt__menuItem" (click)="pickAdd(l)">
                    {{ labelFor(l) }}
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>

      @if (showDefaultPicker()) {
        <div class="lt__default">
          <span class="lt__defaultLabel">{{ 'BLOG.COMPOSER.DEFAULT' | translate }}:</span>
          <select class="lt__defaultSel" [value]="defaultLang()" (change)="onDefaultChange($any($event.target).value)">
            @for (l of activeLangs(); track l) {
              <option [value]="l">{{ labelFor(l) }}</option>
            }
          </select>
        </div>
      }
    </div>
  `,
  styles: [`
    .lt {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      flex-wrap: wrap;
    }
    .lt__tabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .lt__tab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      color: #475569;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
    }
    .lt__tab:hover { border-color: #cbd5e1; }
    .lt__tab.is-on {
      background: #0f172a;
      border-color: #0f172a;
      color: #fff;
    }
    .lt__code { text-transform: uppercase; font-weight: 600; letter-spacing: .04em; font-size: 11px; }
    .lt__icon { flex-shrink: 0; }
    .lt__icon--ok { color: #10b981; }
    .lt__icon--warn { color: #f59e0b; }
    .lt__tab.is-on .lt__icon--ok { color: #34d399; }
    .lt__tab.is-on .lt__icon--warn { color: #fbbf24; }
    .lt__pin { color: #f59e0b; font-size: 12px; }
    .lt__remove {
      width: 18px; height: 18px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent; border: none; cursor: pointer;
      color: inherit; opacity: .6; font-size: 18px; line-height: 1;
      border-radius: 999px;
    }
    .lt__remove:hover { opacity: 1; background: rgba(255,255,255,.15); }

    .lt__add { position: relative; }
    .lt__addBtn {
      padding: 6px 12px;
      background: transparent;
      border: 1px dashed #cbd5e1;
      border-radius: 999px;
      color: #475569;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .lt__addBtn:hover { color: #0f172a; border-color: #94a3b8; }
    .lt__menu {
      position: absolute;
      top: calc(100% + 4px);
      inset-inline-start: 0;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(15,23,42,.08);
      padding: 4px;
      z-index: 10;
      min-width: 140px;
    }
    .lt__menuItem {
      width: 100%;
      padding: 6px 10px;
      background: transparent;
      border: none;
      border-radius: 6px;
      text-align: start;
      cursor: pointer;
      font-size: 13px;
      color: #0f172a;
    }
    .lt__menuItem:hover { background: #f1f5f9; }

    .lt__default { display: inline-flex; align-items: center; gap: 6px; }
    .lt__defaultLabel { font-size: 12px; color: #64748b; }
    .lt__defaultSel {
      padding: 4px 22px 4px 8px;
      font-size: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fff;
      color: #0f172a;
      cursor: pointer;
    }
  `],
})
export class LanguageTabsComponent {
  private lang = inject(LanguageService);

  /** Languages currently activated (have a translations slice). */
  activeLangs  = input.required<string[]>();
  /** Languages the admin allows but haven't been activated yet. */
  addableLangs = input.required<string[]>();
  /** Currently selected tab. */
  active       = input.required<string>();
  /** Default-language code (rendered with a star). */
  defaultLang  = input.required<string>();
  /** Per-language completion status. */
  completion   = input<Record<string, 'complete' | 'partial' | 'empty'>>({});
  /** When true, the "Default" dropdown on the right is rendered. */
  showDefaultPicker = input<boolean>(true);
  showDefaultBadge  = input<boolean>(true);
  /** When true, non-default tabs can be removed via an "x". */
  canRemove   = input<boolean>(true);

  activeChange   = output<string>();
  addLang        = output<string>();
  removeLang     = output<string>();
  defaultChange  = output<string>();

  addOpen = signal(false);

  /** Map a language code to its native label using LanguageService. */
  labelFor(code: string): string {
    return this.lang.available.find(a => a.code === code)?.nativeLabel ?? code.toUpperCase();
  }

  pickAdd(code: string): void {
    this.addOpen.set(false);
    this.addLang.emit(code);
  }

  onDefaultChange(code: string): void {
    this.defaultChange.emit(code);
  }
}
