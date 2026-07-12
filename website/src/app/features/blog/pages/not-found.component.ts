import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { t } from '../i18n/i18n';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="wrap">
      <h1>{{ t(lang(), '404_title') }}</h1>
      <p>{{ t(lang(), '404_body') }}</p>
      <a class="btn" [routerLink]="['/', lang(), 'blog']">{{ t(lang(), 'back_to_blog') }}</a>
    </div>
  `,
  styles: [`
    .wrap { text-align: center; padding: 120px 24px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    p { margin: 0 0 24px; opacity: .7; }
    .btn { display: inline-block; padding: 10px 20px; background: var(--primary, #6366f1); color: #fff; text-decoration: none; border-radius: 8px; }
  `],
})
export class NotFoundPage implements OnInit {
  private route = inject(ActivatedRoute);
  lang = signal('en');
  t = t;
  ngOnInit(): void {
    const s = this.route.snapshot;
    this.lang.set(s.paramMap.get('lang') || s.queryParamMap.get('lang') || 'en');
  }
}
