import { Block, BlockType } from '../types/block.types';

/**
 * A BlockDefinition describes a block to the designer:
 *   - factory()      → produce a new default instance
 *   - icon, label    → toolbox display
 *   - category       → grouping in the toolbox
 *   - propertyGroups → which property panels are relevant
 *
 * Renderers register handlers separately (see RendererRegistry) so a block can
 * be defined once but rendered to multiple targets.
 */
export interface BlockDefinition<TBlock extends Block = Block> {
  type: TBlock['type'];
  label: string;
  icon: string; // SVG path or emoji — kept simple for portability
  category: 'basic' | 'data' | 'layout' | 'media' | 'custom';
  description?: string;
  factory: (id: string) => TBlock;
  /** Which property groups are relevant for this block. Drives property-panel UI. */
  propertyGroups: ReadonlyArray<PropertyGroup>;
  /** Whether the block can have its size autoset from content. */
  autoHeight?: boolean;
  /** Whether the block can be resized in the designer. */
  resizable?: boolean;
}

export type PropertyGroup =
  | 'position'
  | 'size'
  | 'typography'
  | 'background'
  | 'border'
  | 'spacing'
  | 'binding'
  | 'visibility'
  | 'image'
  | 'table-columns'
  | 'totals-rows'
  | 'barcode'
  | 'signature'
  | 'divider'
  | 'page-number';

/**
 * Singleton-style registry. Pure data structure — no Angular DI here so the
 * engine can be unit-tested in isolation. The Angular service in /designer
 * imports this and exposes it via `inject()` / signals.
 */
export class BlockRegistry {
  private readonly map = new Map<BlockType, BlockDefinition>();

  register<T extends Block>(def: BlockDefinition<T>): void {
    if (this.map.has(def.type)) {
      // Replacing is allowed for tenants that need to override defaults.
      console.info(`Overriding block definition for '${def.type}'`);
    }
    this.map.set(def.type, def as unknown as BlockDefinition);
  }

  get(type: BlockType): BlockDefinition | undefined {
    return this.map.get(type);
  }

  /** Throws if not registered — used by renderers that must succeed. */
  require(type: BlockType): BlockDefinition {
    const def = this.map.get(type);
    if (!def) throw new Error(`No block definition registered for '${type}'`);
    return def;
  }

  list(): BlockDefinition[] {
    return Array.from(this.map.values());
  }

  byCategory(): Record<BlockDefinition['category'], BlockDefinition[]> {
    const groups: Record<BlockDefinition['category'], BlockDefinition[]> = {
      basic: [],
      data: [],
      layout: [],
      media: [],
      custom: [],
    };
    for (const def of this.map.values()) groups[def.category].push(def);
    return groups;
  }
}

/** Single shared registry instance. */
export const blockRegistry = new BlockRegistry();
