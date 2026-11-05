/**
 * ONE status palette for the whole app: a status NAME decides its colour, wherever it is shown
 * (list cells, view pages, the record rail, the paper). Add a status here, never a local colour map.
 *
 *   green  open · active · approved · reconciled · converted
 *   amber  draft · pending · in progress · initiated
 *   teal   paid
 *   indigo partially paid / converted / received
 *   red    overdue · void · cancelled · rejected · expired
 *   slate  closed · not converted · inactive · anything unknown
 */
export type StatusTone = 'green' | 'amber' | 'teal' | 'indigo' | 'red' | 'slate';

const TONES: Record<string, StatusTone> = {
  open: 'green', active: 'green', approved: 'green', accepted: 'green', reconciled: 'green', completed: 'green',
  converted: 'green', 'fully converted': 'green', received: 'green', success: 'green', succeeded: 'green', 'fully received': 'green',
  draft: 'amber', pending: 'amber', 'in progress': 'amber', inprogress: 'amber', initiated: 'amber',
  paid: 'teal',
  'partially paid': 'indigo', partial: 'indigo', 'partially converted': 'indigo', 'partially received': 'indigo',
  overdue: 'red', void: 'red', voided: 'red', cancelled: 'red', canceled: 'red', rejected: 'red', expired: 'red', failed: 'red', failure: 'red', error: 'red',
  closed: 'slate', 'not converted': 'slate', inactive: 'slate', disabled: 'slate', paused: 'slate', writeoff: 'slate', 'write off': 'slate', merged: 'slate',
};

export const statusTone = (status: string | null | undefined): StatusTone =>
  TONES[String(status ?? '').trim().toLowerCase()] ?? 'slate';

// Literal class strings (not built from the tone) so Tailwind's scanner keeps them.
const CLASSES: Record<StatusTone, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  teal: 'bg-teal-50 text-teal-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  red: 'bg-red-50 text-red-700',
  slate: 'bg-slate-100 text-slate-700',
};

/** Tailwind classes of a status pill (`text-xs font-medium px-2.5 py-1 rounded-full` stays with the caller). */
export const statusClass = (status: string | null | undefined): string => CLASSES[statusTone(status)];

/** The record rail's pill kind (`DocRailItem.statusKind`) for a status. */
export const railKind = (status: string | null | undefined): 'draft' | 'open' | 'paid' | 'partial' | 'void' | 'neutral' => {
  switch (statusTone(status)) {
    case 'green': return 'open';
    case 'amber': return 'draft';
    case 'teal': return 'paid';
    case 'indigo': return 'partial';
    case 'red': return 'void';
    default: return 'neutral';
  }
};
