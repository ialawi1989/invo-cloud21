import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { provideTranslateService } from '@ngx-translate/core';

import { DatePickerComponent } from './date-picker.component';

/**
 * The calendar cursor follows the bound value, but only when the DATE changes. Parents such as the list
 * filter bar hand over a freshly built (equal) `Date` on every change detection; that must not snap the
 * calendar back while the user is browsing years/months.
 */
describe('DatePickerComponent cursor sync', () => {
  const make = (value: Date | null) => {
    TestBed.configureTestingModule({ providers: [provideTranslateService({ fallbackLang: 'en' })] });
    const fixture = TestBed.createComponent(DatePickerComponent);
    fixture.componentRef.setInput('inline', true);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture;
  };

  it('starts on the month of the bound value', () => {
    const f = make(new Date(2026, 10, 8));
    expect(f.componentInstance.cursor().getFullYear()).toBe(2026);
    expect(f.componentInstance.cursor().getMonth()).toBe(10);
  });

  it('keeps the browsed year when the parent rebinds an equal Date', () => {
    const f = make(new Date(2026, 10, 8));
    f.componentInstance.view.set('years');
    f.componentInstance.selectYear(2016, false);
    f.componentRef.setInput('value', new Date(2026, 10, 8)); // new object, same day
    f.detectChanges();
    expect(f.componentInstance.cursor().getFullYear()).toBe(2016);
    expect(f.componentInstance.view()).toBe('months');
  });

  it('moves to the new month when the bound date really changes', () => {
    const f = make(new Date(2026, 10, 8));
    f.componentRef.setInput('value', new Date(2024, 2, 5));
    f.detectChanges();
    expect(f.componentInstance.cursor().getFullYear()).toBe(2024);
    expect(f.componentInstance.cursor().getMonth()).toBe(2);
  });

  it('follows the value again after it is cleared and set back', () => {
    const f = make(new Date(2026, 10, 8));
    f.componentInstance.selectYear(2016, false);
    f.componentRef.setInput('value', null);
    f.detectChanges();
    f.componentRef.setInput('value', new Date(2026, 10, 8));
    f.detectChanges();
    expect(f.componentInstance.cursor().getFullYear()).toBe(2026);
  });
});
