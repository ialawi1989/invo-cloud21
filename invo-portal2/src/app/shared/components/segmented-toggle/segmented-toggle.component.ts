import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

/**
 * One option in the segmented control.
 *
 * `label` may be a plain string OR an i18n key — the component
 * pipes it through `| translate` so passing keys is the common
 * case. Set `translate: false` on the option (or pass a value that
 * the template should render verbatim) when you've already resolved
 * the string upstream.
 */
export interface SegmentedToggleOption<T = string> {
  value:      T;
  label:      string;
  /** Skip the `translate` pipe — useful for free-form labels that
   *  came from user input or were already translated upstream. */
  translate?: boolean;
  /** Hide this option from the toggle. Lets callers conditionally
   *  surface a third tab without restructuring their template. */
  disabled?:  boolean;
  /** Optional SVG inner markup (paths / rects / circles) rendered
   *  inside a 18×18 `viewBox="0 0 24 24"` wrapper to the left of the
   *  label. Use for filter strips with category icons (e.g. media
   *  type tabs). Caller-owned content, not sanitized — never pass
   *  user-supplied strings here. */
  icon?:      string;
  /** Optional count badge rendered to the right of the label. Use
   *  for filter strips that surface "how many records match this
   *  filter" (Media Manager, etc.). */
  count?:     number | string | null;
}

/**
 * SegmentedToggleComponent
 * ────────────────────────
 * Two-or-more option pill row used wherever the legacy form had
 * "Single Branch / Bulk Edit", "Manual / Automatic", "Fixed /
 * Percent", etc. Same visual language across the app — slate
 * track, white active pill with a soft shadow, slate text.
 *
 * Single source of truth for the toggle style means a global
 * visual refresh lands in one place; consumers stop hand-rolling
 * the markup + CSS each time.
 *
 * Usage:
 *   <app-segmented-toggle
 *     [options]="[{ value: 'manual', label: 'DISCOUNT.FORM.TYPE_MANUAL' },
 *                 { value: 'automatic', label: 'DISCOUNT.FORM.TYPE_AUTOMATIC' }]"
 *     [value]="discount().type"
 *     (valueChange)="setType($event)"
 *     [locked]="isExisting()"/>
 *
 * Inputs:
 *   • `options`  — the segment array (label can be an i18n key).
 *   • `value`    — currently selected value (controlled).
 *   • `locked`   — disables every option; selected stays
 *                  highlighted, unselected dim.
 *   • `vertical` — stack options full-width (sidebar layouts).
 *   • `size`     — `'sm'` (compact) or `'md'` (default).
 *
 * Output:
 *   • `valueChange` — fires with the picked option's `value`.
 */
@Component({
  selector: 'app-segmented-toggle',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="st"
      role="tablist"
      [class.st--vertical]="vertical()"
      [class.st--sm]="size() === 'sm'"
      [class.is-locked]="locked()">
      @for (opt of visibleOptions(); track opt.value) {
        <button type="button"
          role="tab"
          class="st__btn"
          [class.st__btn--rich]="!!opt.icon || opt.count != null"
          [class.is-on]="isOn(opt.value)"
          [attr.aria-selected]="isOn(opt.value)"
          [disabled]="locked()"
          (click)="pick(opt.value)">
          @if (opt.icon) {
            <svg class="st__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 [innerHTML]="safeIcon(opt.icon)"></svg>
          }
          <span class="st__label">
            @if (opt.translate === false) {
              {{ opt.label }}
            } @else {
              {{ opt.label | translate }}
            }
          </span>
          @if (opt.count != null) {
            <span class="st__count">{{ opt.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [`
    /* Plain CSS — Angular's inline styles array doesn't run
       through SCSS, so no ampersand nesting here. */
    .st {
      display: inline-flex;
      /* Center-align so the toggle sits flush with an adjacent
         input when the parent uses align-items: stretch. */
      align-items: center;
      padding: 3px;
      background: #f1f5f9;
      border-radius: 8px;
      align-self: flex-start;
      flex-shrink: 0;
    }
    .st--vertical {
      display: flex;
      flex-direction: column;
      align-self: stretch;
      width: 100%;
    }
    .st__btn {
      appearance: none;
      background: transparent;
      border: 0;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      text-align: center;
      /* Keep labels on a single line — without this, a short label
         next to a wider one ("Fixed" / "Percent %") may wrap when
         the parent flex squeezes the toggle. */
      white-space: nowrap;
      transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
    }
    .st__btn:hover:not(:disabled):not(.is-on) { color: #334155; }
    .st__btn.is-on {
      background: #fff;
      color: #0f172a;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }
    .st__btn:disabled { cursor: not-allowed; }
    .st--sm .st__btn { padding: 4px 10px; font-size: 12px; }
    .st--vertical .st__btn { padding: 8px 12px; }

    /* Rich variant — icon + label + count. Keeps the same pill
       visual but gives the contents room to breathe. Used by media
       manager / future category filter strips. */
    .st__btn--rich {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
    }
    .st__icon {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
    }
    .st__label { line-height: 1; }
    .st__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      padding: 1px 7px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.4;
      color: #64748b;
      background: #e2e8f0;
      border-radius: 999px;
    }
    .st__btn.is-on .st__count {
      background: #d4f0f5;
      color: #1c8595;
    }

    /* Locked variant — selected stays highlighted, unselected
       dimmed so the user reads it as "this can't change". */
    .st.is-locked { opacity: 0.85; }
    .st.is-locked .st__btn:not(.is-on) { color: #94a3b8; }
  `],
})
export class SegmentedToggleComponent<T = string> {
  private sanitizer = inject(DomSanitizer);

  // ── Inputs ─────────────────────────────────────────────────────
  options  = input.required<SegmentedToggleOption<T>[]>();
  value    = input<T | null>(null);
  locked   = input<boolean>(false);
  vertical = input<boolean>(false);
  size     = input<'sm' | 'md'>('md');

  // ── Output ─────────────────────────────────────────────────────
  valueChange = output<T>();

  // ── Derived ────────────────────────────────────────────────────
  visibleOptions = computed(() => this.options().filter(o => !o.disabled));

  /** Memoise the sanitiser calls so we don't re-trust the same SVG
   *  inner string on every change-detection run — option icons are
   *  static catalog data, not per-render values. */
  private iconCache = new Map<string, SafeHtml>();
  safeIcon(svg: string): SafeHtml {
    let cached = this.iconCache.get(svg);
    if (!cached) {
      cached = this.sanitizer.bypassSecurityTrustHtml(svg);
      this.iconCache.set(svg, cached);
    }
    return cached;
  }

  isOn(v: T): boolean { return this.value() === v; }

  pick(v: T): void {
    if (this.locked() || v === this.value()) return;
    this.valueChange.emit(v);
  }
}
