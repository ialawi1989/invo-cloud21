import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';

type Align = 'left' | 'center' | 'right';

const ALIGN_ICONS: Record<Align, string> = {
  left:   '<line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6"  x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>',
  center: '<line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6"  x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/>',
  right:  '<line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6"  x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/>',
};

const ALIGN_OPTIONS: SegmentedToggleOption<Align>[] = (Object.keys(ALIGN_ICONS) as Align[]).map((a) => ({
  value: a,
  label: `DOCUMENT_BUILDER.TEXT_STYLE.ALIGN_${a.toUpperCase()}`,
  icon:  ALIGN_ICONS[a],
}));

/** A bulk-style edit: only the fields the user changed are emitted.
 *  The parent broadcasts these onto every field in the section so
 *  e.g. setting `size: 12` makes every header field 12pt at once. */
export interface BulkStylePatch {
  size?:            number;
  color?:           string;
  labelColor?:      string;
  backgroundColor?: string;
  bold?:            boolean;
  italic?:          boolean;
  underline?:       boolean;
  alignment?:       'left' | 'center' | 'right';
}

/**
 * BulkStyleEditorComponent
 * ────────────────────────
 * Single-control surface that pushes a `TextStyle` patch onto every
 * field in a section at once. Sits inside the "Layout" sub-tab of
 * each panel (Header / Footer / Customer Details / Document Details
 * / Total Section / Payment Table / Custom Fields / Other Details).
 *
 * The editor never mutates anything itself — it emits one
 * `BulkStylePatch` per field change, and the parent broadcasts that
 * patch onto every field in the section. Keeps the patch path
 * deterministic and friendly to undo/redo.
 *
 * Each sub-control can be hidden via input flag — e.g. the
 * Customer Balance card uses bulk style without a label-colour
 * input (there's only one label in the card).
 */
@Component({
  selector: 'app-bulk-style-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColorPickerComponent, SegmentedToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-style-editor.component.html',
  styleUrl: './bulk-style-editor.component.scss',
})
export class BulkStyleEditorComponent {
  /** Section title rendered above the controls (e.g. "Header style"). */
  title = input<string>('');

  /** Optional explainer rendered below the title. */
  note  = input<string>('');

  /** Current "representative" values — the parent passes the most
   *  common value across the section (e.g. 12 if every field is 12pt;
   *  '' / placeholder when fields disagree). The editor renders these
   *  pre-filled so the user knows the starting point. */
  size            = input<number | string>(10);
  color           = input<string>('#1f2937');
  labelColor      = input<string>('#1f2937');
  backgroundColor = input<string>('');
  bold            = input<boolean>(false);
  italic          = input<boolean>(false);
  underline       = input<boolean>(false);
  alignment       = input<'left' | 'center' | 'right'>('left');

  /** Per-control visibility flags — let the parent hide controls
   *  irrelevant to its section. Default: everything visible. */
  showSize       = input<boolean>(true);
  showColor      = input<boolean>(true);
  showLabelColor = input<boolean>(true);
  showBackground = input<boolean>(true);
  showFormat     = input<boolean>(true);
  showAlignment  = input<boolean>(true);

  @Output() patch = new EventEmitter<BulkStylePatch>();

  emit(p: BulkStylePatch): void { this.patch.emit(p); }

  toggleBold():      void { this.emit({ bold:      !this.bold()      }); }
  toggleItalic():    void { this.emit({ italic:    !this.italic()    }); }
  toggleUnderline(): void { this.emit({ underline: !this.underline() }); }
  setAlignment(a: Align): void { this.emit({ alignment: a }); }

  readonly alignOptions = ALIGN_OPTIONS;
}
