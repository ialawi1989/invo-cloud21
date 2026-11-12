import { FlatField, SheetConfig } from '../models/custom-report.model';
import { CatalogEntity, CatalogFieldType } from './report-v2.model';

/**
 * Field identity on the v2 catalog.
 *
 * The builder keeps addressing a field as `<node>.<fieldKey>`, where a node is
 * the report's root entity followed by relation names:
 *
 *   invoiceLines                     → the root entity
 *   invoiceLines.product             → follows the `product` relation
 *   invoiceLines.invoice.customer    → two hops
 *
 * so `invoiceLines.invoice.customer.name` is the field whose v2 path is
 * `invoice.customer.name`. The first segment is always the root entity, the
 * last is always the field key (`@formula` keys carry no dots).
 */

/** The backend follows at most this many relations per field path. */
export const MAX_RELATION_HOPS = 3;

export type CatalogIndex = Map<string, CatalogEntity>;

export function indexCatalog(catalog: CatalogEntity[]): CatalogIndex {
  return new Map(catalog.map(e => [e.key, e]));
}

/** Root entity key of a node id or field id. */
export function rootOf(id: string): string {
  return (id || '').split('.')[0];
}

/** Node id owning a field id (`a.b.field` → `a.b`). */
export function nodeOfField(fullId: string): string {
  const parts = (fullId || '').split('.');
  return parts.slice(0, -1).join('.');
}

/** v2 field path of a field id, relative to its root (`a.b.field` → `b.field`). */
export function pathOfField(fullId: string): string {
  return (fullId || '').split('.').slice(1).join('.');
}

/** Field id for a v2 path on `root`. */
export function fieldIdOf(root: string, path: string): string {
  return path ? `${root}.${path}` : root;
}

export function hopsOf(nodeId: string): number {
  return Math.max(0, (nodeId || '').split('.').length - 1);
}

/** Entity reached at the end of a node id, or null when a hop is unknown. */
export function entityOfNode(index: CatalogIndex, nodeId: string): CatalogEntity | null {
  const [rootKey, ...rels] = (nodeId || '').split('.');
  let entity = index.get(rootKey) || null;
  for (const name of rels) {
    if (!entity) return null;
    const rel = entity.relations.find(r => r.name === name);
    entity = rel ? index.get(rel.entity) || null : null;
  }
  return entity;
}

/** True when any hop on the node's path is a `many` relation (rows repeat). */
export function nodeFansOut(index: CatalogIndex, nodeId: string): boolean {
  const [rootKey, ...rels] = (nodeId || '').split('.');
  let entity = index.get(rootKey) || null;
  for (const name of rels) {
    const rel = entity?.relations.find(r => r.name === name);
    if (!rel) return false;
    if (rel.cardinality === 'many') return true;
    entity = index.get(rel.entity) || null;
  }
  return false;
}

/** The builder's filter/format code keys off text | number | date | boolean. */
export function builderFieldType(t: CatalogFieldType | string): string {
  switch (t) {
    case 'number': return 'number';
    case 'date': return 'date';
    case 'boolean': return 'boolean';
    default: return 'text'; // id, json, text
  }
}

/** "invoiceLines" → "Invoice lines" */
export function humanize(name: string): string {
  const spaced = (name || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Display label of a node: the entity label at the root, the relation chain below it. */
export function nodeLabel(index: CatalogIndex, nodeId: string): string {
  const [rootKey, ...rels] = (nodeId || '').split('.');
  if (rels.length === 0) return index.get(rootKey)?.label || rootKey;
  return rels.map(humanize).join(' › ');
}

/** Fields of one node as builder FlatFields. */
export function nodeFields(index: CatalogIndex, nodeId: string): FlatField[] {
  const entity = entityOfNode(index, nodeId);
  if (!entity) return [];
  return entity.fields.map(f => ({
    id: f.key,
    label: f.label,
    type: builderFieldType(f.type),
    ...(f.numberFormat ? { numberFormat: f.numberFormat } : {}),
    table: nodeId,
    fullId: `${nodeId}.${f.key}`,
    isFormula: f.key.startsWith('@'),
    filterable: f.filterable && f.type !== 'json',
    show: f.show,
  }));
}

export interface RelationOption {
  nodeId: string;
  label: string;
  entityLabel: string;
  many: boolean;
}

/** Relations that can still be followed from a node (stops at MAX_RELATION_HOPS). */
export function childRelations(index: CatalogIndex, nodeId: string): RelationOption[] {
  if (hopsOf(nodeId) >= MAX_RELATION_HOPS) return [];
  const entity = entityOfNode(index, nodeId);
  if (!entity) return [];
  return entity.relations.map(r => ({
    nodeId: `${nodeId}.${r.name}`,
    label: humanize(r.name),
    entityLabel: index.get(r.entity)?.label || r.entity,
    many: r.cardinality === 'many',
  }));
}

/** Strip an aggregate / date-part prefix from a builder column key. */
const KEY_PREFIX = /^(sum|count|avg|max|min|day|week|month|year|yearmonth|yearmonthday|hour)\./;
export function fieldIdOfKey(key: string): string {
  return (key || '').replace(KEY_PREFIX, '');
}

/**
 * Every node a sheet references (shelves, marks, filters, sort, group by),
 * plus every ancestor so the field tree can show the path to it.
 */
export function sheetNodeIds(sheet: SheetConfig): string[] {
  const out = new Set<string>();
  const add = (fullId: string | undefined) => {
    if (!fullId) return;
    const node = nodeOfField(fullId);
    const parts = node.split('.');
    for (let i = 1; i <= parts.length; i++) out.add(parts.slice(0, i).join('.'));
  };
  [...sheet.columnsShelf, ...sheet.rowsShelf, ...sheet.marks.map(m => m.field)].forEach(c => add(c.col));
  sheet.filterRules.forEach(r => add(r.field));
  sheet.sortBy.forEach(s => add(fieldIdOfKey(s.id)));
  add(sheet.groupBy);
  return [...out];
}
