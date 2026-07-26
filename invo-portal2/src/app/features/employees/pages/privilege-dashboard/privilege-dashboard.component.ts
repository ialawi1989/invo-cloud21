import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { DashboardComponent } from '../../../dashboard/pages/dashboard.component';

/**
 * Role default-dashboard editor.
 *
 * A thin wrapper that reads the `:id` route param and hands it to the full
 * dashboard in role mode. Everything — the customizer, live preview and save —
 * lives in {@link DashboardComponent}; this component only supplies the role id.
 */
@Component({
  selector: 'app-privilege-dashboard',
  standalone: true,
  imports: [DashboardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-dashboard [roleMode]="true" [roleId]="id()" />',
})
export class PrivilegeDashboardComponent {
  private route = inject(ActivatedRoute);

  /** The privilege (role) id from the route. */
  readonly id = signal(this.route.snapshot.paramMap.get('id'));
}
