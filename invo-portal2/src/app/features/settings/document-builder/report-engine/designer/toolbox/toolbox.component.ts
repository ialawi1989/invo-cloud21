import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { TranslateModule } from '@ngx-translate/core';
import { blockRegistry, BlockDefinition } from '../../core/registry/block-registry';
import { DesignerStateService } from '../../services/designer-state.service';
import { Block, BlockType } from '../../core/types/block.types';
import { Section } from '../../core/types/template.types';

type ToolboxTab = 'blocks' | 'layers';

/**
 * Material Design Icons for the built-in block types. The registry still
 * carries a plain-character `icon` so third-party blocks registered by a
 * tenant render something sensible; this map just upgrades the ones we ship
 * to the icon font the rest of the app uses.
 */
const BLOCK_ICONS: Partial<Record<BlockType, string>> = {
  'text': 'mdi-format-text',
  'rich-text': 'mdi-format-color-text',
  'image': 'mdi-image-outline',
  'table': 'mdi-table',
  'line': 'mdi-minus',
  'rectangle': 'mdi-rectangle-outline',
  'divider': 'mdi-drag-horizontal-variant',
  'qr-code': 'mdi-qrcode',
  'barcode': 'mdi-barcode',
  'signature': 'mdi-draw-pen',
  'page-number': 'mdi-numeric',
  'dynamic-field': 'mdi-function-variant',
  'totals': 'mdi-sigma',
  'payments': 'mdi-cash-multiple',
  'repeater': 'mdi-view-grid-outline',
  'group-header': 'mdi-format-list-group',
  'group-footer': 'mdi-format-list-group',
};

/**
 * Left rail with two tabs:
 *   - Blocks — palette of CdkDrag sources. Dropping onto the canvas creates
 *     the block at the drop coordinates; clicking drops it near the origin.
 *   - Layers — every block on the canvas, grouped by section. Click selects,
 *     Shift/Ctrl-click extends the selection (matching the canvas).
 */
@Component({
  selector: 'app-designer-toolbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CdkDrag, CdkDropList, TranslateModule],
  templateUrl: './toolbox.component.html',
  styleUrls: ['./toolbox.component.scss'],
})
export class DesignerToolboxComponent {
  readonly state = inject(DesignerStateService);

  readonly TABS: ReadonlyArray<{ id: ToolboxTab; label: string; key: string }> = [
    { id: 'blocks', label: 'Blocks', key: 'DESIGNER.BLOCKS' },
    { id: 'layers', label: 'Layers', key: 'DESIGNER.LAYERS' },
  ];

  readonly activeTab = signal<ToolboxTab>('blocks');

  readonly groups = computed(() => {
    const cats = blockRegistry.byCategory();
    return [
      { label: 'Basic', key: 'DESIGNER.CAT_BASIC', blocks: cats.basic },
      { label: 'Data', key: 'DESIGNER.CAT_DATA', blocks: cats.data },
      { label: 'Layout', key: 'DESIGNER.CAT_LAYOUT', blocks: cats.layout },
      { label: 'Media', key: 'DESIGNER.CAT_MEDIA', blocks: cats.media },
      { label: 'Custom', key: 'DESIGNER.CAT_CUSTOM', blocks: cats.custom },
    ].filter((g) => g.blocks.length > 0);
  });

  /** Sections + their blocks straight from the template. Reads in section
   *  order so header blocks sit above body above footer — matching the
   *  canvas's top-to-bottom layout. */
  readonly layerSections = computed<Section[]>(() => this.state.template()?.sections ?? []);

  isSelected(id: string): boolean {
    return this.state.selectedIds().has(id);
  }

  /** Click-to-add drops the block just inside the top-left of the active
   *  section rather than at a true centre — the user is about to drag it
   *  anyway, and a predictable corner beats overlapping whatever is
   *  currently mid-page. */
  addAtCorner(def: BlockDefinition): void {
    this.state.addBlock(def.type, 20, 20);
  }

  onLayerClick(id: string, ev: MouseEvent): void {
    this.state.select(id, ev.shiftKey || ev.metaKey || ev.ctrlKey);
  }

  sectionLabel(type: Section['type']): string {
    const map: Record<Section['type'], string> = {
      'page-header': 'Page header',
      'first-page-header': 'First-page header',
      'body': 'Body',
      'page-footer': 'Page footer',
      'last-page-footer': 'Last-page footer',
    };
    return map[type] ?? type;
  }

  /** mdi class for a block type, or empty when the type is unknown to us —
   *  the template then falls back to the registry's character icon. */
  mdiFor(type: BlockType): string {
    return BLOCK_ICONS[type] ?? '';
  }

  charIconFor(type: BlockType): string {
    return blockRegistry.get(type)?.icon ?? '·';
  }

  /** Layer row label: the user's own name wins; otherwise a contextual hint
   *  (text content / data source / column count) so sibling blocks of the
   *  same type stay distinguishable without opening each one. */
  labelFor(b: Block): string {
    if (b.name) return b.name;
    switch (b.type) {
      case 'text':
        return this.truncate(b.text || 'text', 26);
      case 'rich-text':
        return 'rich text';
      case 'dynamic-field':
        return this.truncate(b.expression || 'dynamic', 26);
      case 'table':
        return `table · ${b.dataSource || '?'} (${b.columns?.length ?? 0} col)`;
      case 'payments':
        return `payments · ${b.dataSource || '?'}`;
      case 'totals':
        return `totals · ${b.rows?.length ?? 0} rows`;
      case 'repeater':
        return `card list · ${b.dataSource || '?'}`;
      case 'image':
        return 'image';
      case 'qr-code':
        return 'qr code';
      case 'barcode':
        return 'barcode';
      case 'signature':
        return b.label || 'signature';
      case 'page-number':
        return 'page number';
      default:
        return b.type;
    }
  }

  private truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
}
