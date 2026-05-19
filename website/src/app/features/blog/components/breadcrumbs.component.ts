import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  link?: any[] | string | null;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        @for (c of crumbs; track $index; let last = $last) {
          <li>
            @if (c.link && !last) {
              <a [routerLink]="c.link">{{ c.label }}</a>
            } @else {
              <span aria-current="page">{{ c.label }}</span>
            }
            @if (!last) { <span class="sep" aria-hidden="true">›</span> }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [`
    :host { display: block; }
    ol { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; font-size: 13px; color: rgba(0,0,0,.6); }
    li { display: inline-flex; align-items: center; gap: 6px; }
    a { color: inherit; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .sep { opacity: .6; }
    [dir='rtl'] .sep { transform: scaleX(-1); }
  `],
})
export class BreadcrumbsComponent {
  @Input({ required: true }) crumbs: Crumb[] = [];
}
