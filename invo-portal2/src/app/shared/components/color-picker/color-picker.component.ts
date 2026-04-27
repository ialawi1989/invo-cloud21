import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

/**
 * ColorPickerComponent
 * ────────────────────
 * Drop-in replacement for `<input type="color">`. Accepts and emits
 * a `#RRGGBB` hex string via `ControlValueAccessor`, so it works with
 * `formControlName`, `[(ngModel)]`, and `[formControl]`.
 *
 * Visual: matches the project's date/time pickers — same trigger size,
 * same panel theme (white card, brand accents, slate text). Opens a
 * popover BELOW the trigger via CDK overlay containing:
 *   • A grid of brand-aligned preset swatches for quick picks
 *   • A native color input for the long tail (full HSV picker)
 *   • A hex text input that round-trips with the swatch
 *   • Clear + Done buttons in the footer
 */
@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [CommonModule, OverlayModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-picker.component.html',
  styleUrl: './color-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ColorPickerComponent),
      multi: true,
    },
  ],
})
export class ColorPickerComponent implements ControlValueAccessor {
  private cdr = inject(ChangeDetectorRef);

  // ─── Inputs ────────────────────────────────────────────────────────────
  /** Show as `disabled`. */
  disabledInput = input<boolean>(false, { alias: 'disabled' });

  /** Apply error styling to the trigger. */
  invalid = input<boolean>(false);

  /** Trigger placeholder when nothing is selected. */
  placeholder = input<string>('Pick a color');

  /**
   * Override the preset palette. Defaults to a curated set of 16 colors
   * covering brand cyan, neutrals and a balanced rainbow — enough for
   * common entity defaults without an overwhelming wall of swatches.
   */
  presets = input<string[]>(DEFAULT_PRESETS);

  // ─── State ─────────────────────────────────────────────────────────────
  /** Committed value (hex) — empty string when no color is set. */
  value = signal<string>('');

  /** Working value while the popover is open — committed on Done. */
  draft = signal<string>('');

  /** True while the popover is mounted. */
  isOpen = signal<boolean>(false);

  /** CVA-set disabled state. */
  cvaDisabled = signal<boolean>(false);

  isDisabled = computed(() => this.disabledInput() || this.cvaDisabled());

  /** True when the picker has a non-empty hex value. */
  hasValue = computed<boolean>(() => !!this.value());

  /** Trigger element — used for focus management. */
  triggerEl = viewChild<ElementRef<HTMLElement>>('trigger');

  // ─── CVA plumbing ──────────────────────────────────────────────────────
  private _onChange: (v: string) => void = () => {};
  private _onTouched: () => void = () => {};

  writeValue(v: string | null | undefined): void {
    this.value.set(normaliseHex(v ?? ''));
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(disabled: boolean): void {
    this.cvaDisabled.set(disabled);
    this.cdr.markForCheck();
  }

  // ─── Open / close ──────────────────────────────────────────────────────
  toggle(): void {
    if (this.isDisabled()) return;
    this.isOpen() ? this.cancel() : this.open();
  }

  open(): void {
    if (this.isDisabled() || this.isOpen()) return;
    // Snapshot the committed value into the working draft.
    this.draft.set(this.value() || '#32acc1');
    this.isOpen.set(true);
  }

  /** Close without committing. */
  cancel(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this._onTouched();
  }

  /** Commit the working draft and close. */
  ok(): void {
    const next = normaliseHex(this.draft());
    if (next !== this.value()) {
      this.value.set(next);
      this._onChange(next);
    }
    this.isOpen.set(false);
    this._onTouched();
  }

  /** Wipe the value entirely (no color). */
  clear(): void {
    if (this.value()) {
      this.value.set('');
      this._onChange('');
    }
    this.draft.set('');
    this.isOpen.set(false);
    this._onTouched();
  }

  // ─── Picker actions ────────────────────────────────────────────────────
  pickPreset(hex: string): void {
    this.draft.set(normaliseHex(hex));
  }

  /** Native color input → 7-char `#RRGGBB`. */
  onNativeInput(value: string): void {
    this.draft.set(normaliseHex(value));
  }

  /** Hex text field → tolerate `RRGGBB` / `#RGB` / pasted strings. */
  onHexInput(value: string): void {
    this.draft.set(normaliseHexLoose(value));
  }

  /** True when `hex` matches the current draft (case-insensitive). */
  isPicked(hex: string): boolean {
    return normaliseHex(hex).toUpperCase() === normaliseHex(this.draft()).toUpperCase();
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if ((event.key === 'Enter' || event.key === ' ') &&
          document.activeElement === this.triggerEl()?.nativeElement) {
        event.preventDefault();
        this.open();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
      this.triggerEl()?.nativeElement.focus();
    }
  }
}

// ─── Default palette ─────────────────────────────────────────────────────
// Curated 4×4 grid: brand cyan + neutrals + a balanced rainbow. Order
// is left-to-right, top-to-bottom: warm → cool → dark/light. Picked to
// be useful for category tags, branch labels, badge colors etc.
export const DEFAULT_PRESETS: string[] = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', // reds → yellows
  '#84CC16', '#22C55E', '#10B981', '#14B8A6', // greens
  '#06B6D4', '#32ACC1', '#3B82F6', '#6366F1', // cyans → blues (brand cyan in the middle)
  '#A855F7', '#EC4899', '#0F172A', '#94A3B8', // purples + neutrals
];

// ─── Free helpers ────────────────────────────────────────────────────────
/** Coerce an input string to canonical `#RRGGBB` (uppercase). Empty → ''. */
function normaliseHex(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return ('#' + s).toUpperCase();
  // Short form `#abc` → `#aabbcc`.
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1], g = s[2], b = s[3];
    return ('#' + r + r + g + g + b + b).toUpperCase();
  }
  return s.toUpperCase();
}

/**
 * Looser version used on free-text input — lets the user type partial
 * values (`#3`, `#32a`, `32acc`, …) without snapping back. Only fully-
 * formed hex strings get normalised; everything else passes through so
 * the user can finish typing.
 */
function normaliseHexLoose(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) return normaliseHex(s);
  if (/^#?[0-9a-fA-F]{3}$/.test(s)) return normaliseHex(s);
  return s.toUpperCase();
}
