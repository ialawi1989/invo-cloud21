/**
 * Shared status-filter + badge mapping for the Zatca / JordanFatoorah
 * invoice tracking tables. Both report status as one of REPORTED /
 * FAILED / QUEUED / PENDING and offer the same QUEUED/REPORTED/FAILED
 * filter pills.
 */
export class InvoiceStatusFilter {
  /** Filter pills the user can toggle. */
  readonly options = ['QUEUED', 'REPORTED', 'FAILED'] as const;
  private active = new Set<string>();

  selected(): string[] { return [...this.active]; }
  isOn(s: string): boolean { return this.active.has(s); }
  toggle(s: string): void {
    if (this.active.has(s)) this.active.delete(s);
    else this.active.add(s);
  }

  badgeClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'REPORTED': return 'pf-status pf-status--ok';
      case 'FAILED':   return 'pf-status pf-status--err';
      case 'QUEUED':   return 'pf-status pf-status--warn';
      case 'PENDING':  return 'pf-status pf-status--info';
      default:         return 'pf-status';
    }
  }

  labelKey(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'REPORTED': return 'PLUGINS.INVOICES.ST_REPORTED';
      case 'FAILED':   return 'PLUGINS.INVOICES.ST_FAILED';
      case 'QUEUED':   return 'PLUGINS.INVOICES.ST_QUEUED';
      case 'PENDING':  return 'PLUGINS.INVOICES.ST_PENDING';
      default:         return status;
    }
  }
}
