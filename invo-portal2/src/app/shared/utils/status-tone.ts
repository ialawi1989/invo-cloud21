/**
 * ONE status palette for the whole app: a status NAME decides its colour, wherever it is shown
 * (list cells, view pages, the record rail, the paper). Add a status here, never a local colour map.
 *
 * Mirrors the legacy `<status-badge>` (InvoCloudFront2 styles.scss `.bg-*`): solid pill, white text,
 * Bootstrap hex → nearest Tailwind shade. Statuses the legacy never had reuse the colour of the
 * closest-meaning legacy status.
 *
 *   dark    #495057  draft · pending · initiated                         → slate-600
 *   lime    #74b72e  paid · accepted · ready · reconciled · confirmed    → lime-600
 *   amber   #f1b44c  partially paid                                      → amber-400
 *   cyan    #32acc1  open · merged                                       → cyan-600
 *   sky     #50a5f1  void · placed · empty (bootstrap "info")            → sky-500
 *   red     #f46a6a  closed · rejected · overdue · failed (bs "danger")  → red-400
 *   gray    #74788d  write-off (bootstrap "secondary")                   → slate-500
 *   orange  #ff5a00  departure · arrived · completed                     → orange-500/600
 */
export type StatusTone = 'dark' | 'lime' | 'amber' | 'cyan' | 'sky' | 'red' | 'gray' | 'orange';

const TONES: Record<string, StatusTone> = {
  // legacy
  draft: 'dark', initiated: 'dark', pending: 'dark',
  paid: 'lime', reconciled: 'lime', calculated: 'lime', confirmed: 'lime', accepted: 'lime', ready: 'lime',
  'partially paid': 'amber',
  open: 'cyan', merged: 'cyan',
  void: 'sky', voided: 'sky', placed: 'sky',
  closed: 'red', rejected: 'red', overdue: 'red', 'failed payment': 'red',
  writeoff: 'gray', 'write off': 'gray',
  departure: 'orange', arrived: 'orange', completed: 'orange',
  // not in legacy — same colour as the closest-meaning legacy status
  'in progress': 'dark', inprogress: 'dark',
  active: 'lime', approved: 'lime', success: 'lime', succeeded: 'lime',
  converted: 'lime', 'fully converted': 'lime', received: 'lime', 'fully received': 'lime',
  partial: 'amber', 'partially converted': 'amber', 'partially received': 'amber',
  cancelled: 'red', canceled: 'red', expired: 'red', failed: 'red', failure: 'red', error: 'red',
  'not converted': 'gray', inactive: 'gray', disabled: 'gray', paused: 'gray',
};

export const statusTone = (status: string | null | undefined): StatusTone =>
  TONES[String(status ?? '').trim().toLowerCase()] ?? (status ? 'gray' : 'sky');

// Literal class strings (not built from the tone) so Tailwind's scanner keeps them.
const CLASSES: Record<StatusTone, string> = {
  dark: 'bg-slate-600 text-white',
  lime: 'bg-lime-600 text-white',
  amber: 'bg-amber-400 text-white',
  cyan: 'bg-cyan-600 text-white',
  sky: 'bg-sky-500 text-white',
  red: 'bg-red-400 text-white',
  gray: 'bg-slate-500 text-white',
  orange: 'bg-orange-500 text-white',
};

/** Tailwind classes of a status pill (`text-xs font-medium px-2.5 py-1 rounded-full` stays with the caller). */
export const statusClass = (status: string | null | undefined): string => CLASSES[statusTone(status)];

/** The record rail's pill kind (`DocRailItem.statusKind`) for a status. */
export const railKind = (status: string | null | undefined): 'draft' | 'open' | 'paid' | 'partial' | 'void' | 'neutral' | 'info' => {
  switch (statusTone(status)) {
    case 'cyan': return 'open';
    case 'dark': return 'draft';
    case 'lime': return 'paid';
    case 'amber':
    case 'orange': return 'partial';
    case 'red': return 'void';
    case 'sky': return 'info';
    default: return 'neutral';
  }
};
