/**
 * TEMPORARY — sample data for the Daily Attendance Sheet, to see how its photos, statuses and tiles look before there is real data.
 * Used only when the page address carries `?mock=1` (remembered for the tab; `?mock=0` turns it off). Nothing is read from or written to
 * the backend. To remove: delete this file and the `TEMP` lines in `flat-report.service.ts`.
 */
export function useFlatMock(): boolean {
  if (typeof location === 'undefined') return false;
  try {
    if (/[?&]mock=1(&|$|#)/.test(location.href)) sessionStorage.setItem('reports.flat.mock', '1');
    if (/[?&]mock=0(&|$|#)/.test(location.href)) sessionStorage.removeItem('reports.flat.mock');
    return sessionStorage.getItem('reports.flat.mock') === '1';
  } catch { return /[?&]mock=1(&|$|#)/.test(location.href); }
}

const ID = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
/** A small inline picture standing in for a clock-in / clock-out photo (no network needed). */
const photo = (label: string, hue: number) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="170" viewBox="0 0 220 170"><rect width="220" height="170" fill="hsl(${hue},55%,86%)"/>` +
  `<circle cx="110" cy="70" r="30" fill="hsl(${hue},45%,55%)"/><path d="M50 150c6-34 24-46 60-46s54 12 60 46z" fill="hsl(${hue},45%,55%)"/>` +
  `<text x="110" y="162" font-family="sans-serif" font-size="13" text-anchor="middle" fill="hsl(${hue},45%,25%)">${label}</text></svg>`);
const iso = (h: number, m: number) => `2026-11-11T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;

const shift = (inH: number, inM: number, outH: number | null, outM = 0, withPhotos = true, adjusted = false) => ({
  id: `s-${inH}${inM}`, clockedIn: iso(inH, inM), clockedOut: outH == null ? null : iso(outH, outM),
  clockedInMediaUrl: withPhotos ? photo('IN', 190) : null, clockedOutMediaUrl: withPhotos && outH != null ? photo('OUT', 25) : null, wasAdjusted: adjusted,
});

const rows = [
  { employeeId: ID(1), employeeName: 'Jassim', expectedStartLocal: '09:00', expectedEndLocal: '17:00', status: 'on_time', leaveTypeRaw: null, shifts: [shift(8, 52, 17, 4)] },
  { employeeId: ID(2), employeeName: 'Zahra Habib', expectedStartLocal: '09:00', expectedEndLocal: '17:00', status: 'late', leaveTypeRaw: null, shifts: [shift(9, 41, null)] },
  { employeeId: ID(3), employeeName: 'sayed.hussain', expectedStartLocal: '08:00', expectedEndLocal: '16:00', status: 'on_time', leaveTypeRaw: null, shifts: [shift(7, 58, 12, 0), shift(13, 0, 16, 3)] },
  { employeeId: ID(4), employeeName: 'Ali Hasan', expectedStartLocal: '10:00', expectedEndLocal: '18:00', status: 'clocked_out', leaveTypeRaw: null, shifts: [shift(9, 55, 18, 2, false, true)] },
  { employeeId: ID(5), employeeName: 'Maryam Noor', expectedStartLocal: '09:00', expectedEndLocal: '17:00', status: 'no_show', leaveTypeRaw: null, shifts: [] },
  { employeeId: ID(6), employeeName: 'Khalid Saleh', expectedStartLocal: '09:00', expectedEndLocal: '17:00', status: 'on_leave', leaveTypeRaw: 'Sick leave', shifts: [] },
  { employeeId: ID(7), employeeName: 'Noor Ahmed', expectedStartLocal: '16:00', expectedEndLocal: '23:59', status: 'upcoming', leaveTypeRaw: null, shifts: [] },
].map(r => ({
  ...r, shiftCount: r.shifts.length, clockedIn: r.shifts[0]?.clockedIn ?? null, clockedOut: r.shifts[r.shifts.length - 1]?.clockedOut ?? null,
  wasAdjusted: r.shifts.some(s => s.wasAdjusted),
}));

const summary = { totalScheduled: 7, present: 4, late: 1, absent: 1, onLeave: 1, upcoming: 1, clockedOut: 1, unscheduled: 0 };

/** Sample answers by route (null = ask the backend as usual). */
export function flatMock(route: string): Record<string, unknown> | null {
  switch (route.replace(/^\//, '')) {
    case 'attendance/dailySheet': return { list: rows, count: rows.length, pageCount: 1, summary };
    default: return null;
  }
}
