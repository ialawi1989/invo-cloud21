import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

export interface WizardStepItem { key: string; label: string; }

/**
 * Numbered step indicator (Upload → Preview → Import → Done) with the same
 * look as the one inside `<app-import-wizard>`, for modals that run their own
 * step logic but should read as the same flow.
 */
@Component({
  selector: 'app-wizard-steps',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wizard-steps.component.html',
  styleUrl: './wizard-steps.component.scss',
})
export class WizardStepsComponent {
  readonly steps = input.required<WizardStepItem[]>();
  /** Key of the active step. */
  readonly current = input.required<string>();
  /** Centre the steps in the row instead of starting at the left edge. */
  readonly center = input(false);

  currentIndex(): number {
    const i = this.steps().findIndex(s => s.key === this.current());
    return i < 0 ? 0 : i;
  }
}
