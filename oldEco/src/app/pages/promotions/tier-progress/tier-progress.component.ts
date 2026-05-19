import { CommonModule } from '@angular/common';
import { AfterViewInit, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-tier-progress',
  templateUrl: './tier-progress.component.html',
  styleUrl: './tier-progress.component.css',
  standalone: true,
  imports: [CommonModule, TranslateModule],
})
export class TierProgressComponent{
  currentSpent = 420;
  nextMinSpent = 600;
  currentPurchases = 3;
  nextMinPurchases = 5;
  nextNameEn = 'Gold';
  nextNameAr = 'ذهبي';
  lang: 'en' | 'ar' = 'en'; // غير اللغة هنا لتغيير الاتجاه

  get spentPct() {
    return Math.min(100, (this.currentSpent / this.nextMinSpent) * 100);
  }

  get purchasesPct() {
    return Math.min(100, (this.currentPurchases / this.nextMinPurchases) * 100);
  }

  get spentRemaining() {
    return Math.max(0, this.nextMinSpent - this.currentSpent);
  }

  get purchasesRemaining() {
    return Math.max(0, this.nextMinPurchases - this.currentPurchases);
  }

  get qualified() {
    return this.spentRemaining === 0 && this.purchasesRemaining === 0;
  }

  get dir() {
    return this.lang === 'ar' ? 'rtl' : 'ltr';
  }
}
