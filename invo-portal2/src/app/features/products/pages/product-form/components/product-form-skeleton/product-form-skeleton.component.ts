import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';

/**
 * Full-form skeleton that mirrors the product-form grid (main column + side
 * column) so the page doesn't flash a half-rendered form while data loads.
 *
 * Kept dumb — no inputs, no state. The product-form shows / hides it based
 * on its own `loading` signal.
 */
@Component({
  selector: 'app-product-form-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sk-grid">
      <section class="sk-col sk-col--main">
        @for (_ of [0,1,2,3]; track $index) {
          <div class="sk-card">
            <div class="sk-card__head">
              <app-skeleton variant="line" width="36px" height="36px"/>
              <app-skeleton variant="line" width="180px" height="14px"/>
            </div>
            <div class="sk-card__body">
              <div class="sk-row-2">
                <div>
                  <app-skeleton variant="line" width="80px" height="10px"/>
                  <app-skeleton variant="line" height="36px"/>
                </div>
                <div>
                  <app-skeleton variant="line" width="80px" height="10px"/>
                  <app-skeleton variant="line" height="36px"/>
                </div>
              </div>
              <div class="sk-row-1">
                <app-skeleton variant="line" width="100px" height="10px"/>
                <app-skeleton variant="line" height="36px"/>
              </div>
            </div>
          </div>
        }
      </section>

      <aside class="sk-col sk-col--side">
        @for (_ of [0,1,2]; track $index) {
          <div class="sk-card">
            <div class="sk-card__head">
              <app-skeleton variant="line" width="36px" height="36px"/>
              <app-skeleton variant="line" width="120px" height="14px"/>
            </div>
            <div class="sk-card__body">
              <app-skeleton variant="line" width="70px" height="10px"/>
              <app-skeleton variant="line" height="36px"/>
              <app-skeleton variant="line" width="70px" height="10px"/>
              <app-skeleton variant="line" height="36px"/>
            </div>
          </div>
        }
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .sk-grid {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: 20px;

      @media (max-width: 991px) { grid-template-columns: 1fr; }
    }

    .sk-col {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }

    .sk-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      overflow: hidden;
    }

    .sk-card__head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      background: #fff;
    }

    .sk-card__body {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sk-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;

      & > div {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }

      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }

    .sk-row-1 {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  `],
})
export class ProductFormSkeletonComponent {}
