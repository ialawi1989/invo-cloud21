import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SKELETON_STYLES } from './skeleton-styles';

/**
 * Placeholder for a vertical list / feed / modal pick-list while rows load.
 *
 *   <app-list-skeleton />                          // 5 text rows
 *   <app-list-skeleton [rows]="4" [avatar]="true" /> // avatar + two lines
 *   <app-list-skeleton [rows]="3" [bordered]="false" />
 */
@Component({
  selector: 'app-list-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-busy': 'true', 'aria-label': 'Loading' },
  template: `
    @for (r of rowArr(); track $index) {
      <div class="ls-row" [class.ls-row--bordered]="bordered()">
        @if (avatar()) { <div class="sk sk--circle ls-avatar"></div> }
        <div class="ls-body">
          <div class="sk ls-line" [style.width.%]="60 + (($index * 17) % 30)"></div>
          @if (lines() > 1) { <div class="sk ls-line ls-line--sub" [style.width.%]="35 + (($index * 11) % 25)"></div> }
        </div>
        @if (trailing()) { <div class="sk ls-trail"></div> }
      </div>
    }
  `,
  styles: [SKELETON_STYLES + `
    .ls-row { display: flex; align-items: center; gap: 12px; padding: 12px 4px; }
    .ls-row--bordered { border-bottom: 1px solid #f1f5f9; }
    .ls-row--bordered:last-child { border-bottom: 0; }
    .ls-avatar { width: 36px; height: 36px; flex: none; }
    .ls-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
    .ls-line { height: 12px; }
    .ls-line--sub { height: 10px; }
    .ls-trail { width: 64px; height: 24px; border-radius: 12px; flex: none; }
  `],
})
export class ListSkeletonComponent {
  rows     = input<number>(5);
  /** 1 = single bar, 2 = title + subtitle. */
  lines    = input<number>(1);
  avatar   = input<boolean>(false);
  trailing = input<boolean>(false);
  bordered = input<boolean>(true);

  rowArr = computed(() => Array.from({ length: this.rows() }));
}
