/**
 * Deterministic per-employee display color. invo-portal2 doesn't store a
 * color on Employee records (legacy's own `Employee.color` field was never
 * backed by the server either) — hash the id into a fixed palette so the
 * same employee always renders the same color across the calendar.
 */
const PALETTE = [
  '#2691a4', '#b45309', '#7c3aed', '#16a34a', '#dc2626',
  '#0891b2', '#c026d3', '#65a30d', '#ea580c', '#4f46e5',
];

export function employeeColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
