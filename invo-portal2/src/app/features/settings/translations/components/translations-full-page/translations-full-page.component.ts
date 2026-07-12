import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Full-page shell for the Translation Manager.
 *
 * Wraps the landing + editor in a Wix-style full-viewport takeover: a slim top
 * bar with an Exit-to-Settings control and the "Translation Manager" title,
 * then the routed content fills the rest of the screen. Registered OUTSIDE the
 * admin `MainLayoutComponent` (see app.routes.ts) so there's no sidebar/topbar
 * chrome around it — matching the receipt / document / blog composer builders.
 */
@Component({
  selector: 'app-translations-full-page',
  standalone: true,
  imports: [RouterModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tfp">
      <header class="tfp-bar">
        <a class="tfp-exit" routerLink="/settings" [attr.aria-label]="'COMMON.CLOSE' | translate"
           [attr.title]="'TRANSLATIONS.EXIT' | translate">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </a>
        <span class="tfp-title">{{ 'TRANSLATIONS.TITLE' | translate }}</span>
      </header>

      <div class="tfp-body">
        <router-outlet/>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .tfp { height: 100vh; height: 100dvh; display: flex; flex-direction: column; background: #fff; }
    .tfp-bar {
      flex: 0 0 auto; display: flex; align-items: center; gap: 12px;
      height: 56px; padding: 0 18px; border-bottom: 1px solid #e2e8f0; background: #fff;
    }
    .tfp-exit {
      display: inline-flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 8px; border: 1px solid #e2e8f0;
      background: #fff; color: #475569; text-decoration: none;
      transition: background .12s ease, color .12s ease;
    }
    .tfp-exit:hover { background: #f8fafc; color: #0f172a; }
    .tfp-title { font-size: 15px; font-weight: 700; color: #0f172a; }
    /* Definite-height content region; the routed host fills it with height:100%. */
    .tfp-body { flex: 1 1 auto; min-height: 0; overflow: hidden; }
  `],
})
export class TranslationsFullPageComponent {}
