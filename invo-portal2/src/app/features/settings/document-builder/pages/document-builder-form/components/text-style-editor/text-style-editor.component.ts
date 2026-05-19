import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { TextStyle } from '../../../../services/document-template.types';

type Align = 'left' | 'center' | 'right';

const ALIGN_ICONS: Record<Align, string> = {
  left:   '<line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6"  x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>',
  center: '<line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6"  x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/>',
  right:  '<line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6"  x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/>',
};

/** Static options for the alignment segmented-toggle. Icons reuse
 *  the same paths as the legacy button group so the visual rhythm
 *  stays identical after the migration. */
const ALIGN_OPTIONS: SegmentedToggleOption<Align>[] = (Object.keys(ALIGN_ICONS) as Align[]).map((a) => ({
  value: a,
  label: `DOCUMENT_BUILDER.TEXT_STYLE.ALIGN_${a.toUpperCase()}`,
  icon:  ALIGN_ICONS[a],
}));

/**
 * TextStyleEditorComponent
 * ────────────────────────
 * Compact single-field editor for a `TextStyle` block. Mirrors the
 * legacy `app-text-style-field` pattern:
 *
 *   ┌────────────────────────────────────┐
 *   │ ☑ Field name                    ⚙ │   ← compact row, 1 line
 *   ├────────────────────────────────────┤   ← clicking ⚙ expands
 *   │   Size  Colour                     │
 *   │   B  I  U      ⇇  ⇉                │
 *   └────────────────────────────────────┘
 *
 * The body stays collapsed by default so panels with many fields
 * (Customer Details, Document Details, Total Section) read as a
 * compact list of toggles — clicking any field's gear opens an
 * inline panel for that field only.
 *
 * The component is "dumb": it never mutates the input, it emits a
 * fresh `TextStyle` via `(valueChange)` so the parent funnels every
 * edit through its central patch path.
 */
@Component({
  selector: 'app-text-style-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColorPickerComponent, TooltipDirective, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-style-editor.component.html',
  styleUrl: './text-style-editor.component.scss',
})
export class TextStyleEditorComponent {
  /** Field-level label rendered next to the visibility checkbox. */
  label = input.required<string>();

  /** The TextStyle being edited. The component reads from this and
   *  emits diffs via `valueChange` — it does NOT mutate the input. */
  value = input.required<TextStyle>();

  /** Hide individual sub-controls when the parent doesn't need them.
   *  Default: everything visible. */
  showToggle    = input<boolean>(true);
  showSize      = input<boolean>(true);
  showColor     = input<boolean>(true);
  showFormat    = input<boolean>(true);   // bold / italic / underline
  showAlignment = input<boolean>(true);
  showLabel     = input<boolean>(false);  // override label text input

  /** When set, the label is greyed out and the entire editor is
   *  read-only. Used for fields the document type doesn't expose. */
  disabled = input<boolean>(false);

  /** When `true`, the visibility checkbox is shown disabled — the
   *  user can re-style the field but can't hide it. Drives the
   *  legacy `required` semantic for fields the document can't ship
   *  without (document number, document date, entity name). */
  required = input<boolean>(false);

  @Output() valueChange = new EventEmitter<TextStyle>();

  /** Whether the editor body is expanded. Local state — drives the
   *  gear toggle. Defaults to collapsed; the user clicks the gear to
   *  reveal the style controls for that one field. */
  expanded = signal<boolean>(false);

  /** Advanced sub-panel inside the body — holds Show Label, Label
   *  Colour, Style (B/I/U), Alignment. Mirrors the legacy
   *  `app-text-style-field` "Advanced" toggle so the primary view
   *  stays uncluttered (just Size + Colour). */
  advancedOpen = signal<boolean>(false);

  toggleExpanded(): void {
    if (this.disabled()) return;
    this.expanded.update((v) => !v);
  }

  toggleAdvanced(): void {
    if (this.disabled()) return;
    this.advancedOpen.update((v) => !v);
  }

  patch(patch: Partial<TextStyle>): void {
    if (this.disabled()) return;
    this.valueChange.emit({ ...this.value(), ...patch });
  }

  toggleShow(checked: boolean): void {
    // Required fields can't be hidden — the show checkbox is rendered
    // disabled, but guard at the patch level too in case the disabled
    // attribute is bypassed (devtools / accessibility tools).
    if (this.required()) return;
    this.patch({ show: checked });
  }
  toggleShowLabel(checked: boolean): void { this.patch({ showLabel: checked }); }

  setBold():      void { this.patch({ bold:      !this.value().bold      }); }
  setItalic():    void { this.patch({ italic:    !this.value().italic    }); }
  setUnderline(): void { this.patch({ underline: !this.value().underline }); }

  setAlignment(value: Align): void {
    this.patch({ alignment: value });
  }

  readonly alignOptions = ALIGN_OPTIONS;
}
