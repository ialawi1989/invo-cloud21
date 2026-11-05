import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { statusClass } from '@shared/utils/status-tone';

/**
 * Status pill whose colour comes from the status NAME via the one shared palette
 * (`@shared/utils/status-tone`) — use it for any status shown in a table or card so
 * "Open" is the same colour everywhere. `label` overrides the text (e.g. a translation).
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap" [class]="cls()">{{ label() ?? status() }}</span>`,
})
export class StatusBadgeComponent {
  status = input<string | null | undefined>('');
  label = input<string | null | undefined>(undefined);
  cls = computed(() => statusClass(this.status()));
}
