import { Pipe, PipeTransform } from '@angular/core';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

/**
 * Accounting amount: negatives in parentheses — `(1,200.000)` — otherwise the
 * company currency format. Legacy `minusNumber`.
 */
@Pipe({ name: 'boAmount', standalone: true, pure: false })
export class BoAmountPipe implements PipeTransform {
  private cur = new MycurrencyPipe();
  transform(value: number | null | undefined): string {
    const v = Number(value) || 0;
    return v < 0 ? `(${this.cur.transform(-v)})` : this.cur.transform(v);
  }
}
