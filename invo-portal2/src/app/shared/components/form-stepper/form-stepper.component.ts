import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** One stop in the wizard. `labelKey` is an i18n key, not a label. */
export interface FormStep {
  /** Stable identifier, used by the host to decide what to render. */
  key: string;
  labelKey: string;
}

/**
 * `<app-form-stepper>` — the numbered progress header above a multi-step form.
 *
 * Presentation only: it owns no state and performs no navigation. The host
 * decides which step is current, how far the user has been allowed to get, and
 * what a click on a completed step means — because those are validation
 * questions and this component cannot answer them.
 *
 * A step is clickable only when it has already been completed. Jumping ahead
 * would land the user on a step whose prerequisites are unmet, which the host
 * would immediately have to bounce them back from.
 *
 * Marked `--done` rather than numbered once complete: the tick is the fastest
 * way to read "this one is behind me" while scanning, and it matches how the
 * import wizard already renders its steps.
 */
@Component({
  selector: 'app-form-stepper',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-stepper.component.html',
  styleUrl: './form-stepper.component.scss',
})
export class FormStepperComponent {
  steps = input.required<FormStep[]>();
  /** Zero-based index of the step being shown. */
  current = input.required<number>();
  /**
   * Highest index the user has reached. Steps at or below it are navigable;
   * everything above is not yet earned. Defaults to `current`, which makes the
   * strip read-only unless the host opts into back-navigation.
   */
  furthest = input<number | null>(null);

  /** A completed step was clicked. The host performs the navigation. */
  stepSelected = output<number>();

  private readonly reach = computed(() => this.furthest() ?? this.current());

  isDone(index: number): boolean {
    return index < this.current();
  }

  isNavigable(index: number): boolean {
    return index !== this.current() && index <= this.reach();
  }

  select(index: number): void {
    if (this.isNavigable(index)) this.stepSelected.emit(index);
  }
}
