import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModalService } from '@shared/modal/modal.service';
import { ListPreferencesService } from '@core/layout/services/list-preferences.service';
import { ListPageComponent } from './list-page.component';
import { TableColumn } from '../interfaces/list-page.types';

const EN: Record<string, string> = {
  'COMMON.LP_COUNT': 'Count', 'COMMON.LP_COUNT_ARIA': 'Show total {{noun}} count', 'COMMON.LP_SHOW_TOTAL': 'Show total',
  'COMMON.LP_OF': 'of', 'COMMON.LP_COUNTING': 'Counting', 'COMMON.LP_COULDNT_COUNT': "Couldn't count.", 'COMMON.LP_RETRY': 'Retry',
  'COMMON.LP_COUNT_FAILED_ARIA': "Couldn't count {{noun}}. Retry", 'COMMON.LP_COUNTING_ANNOUNCE': 'Counting {{noun}}',
  'COMMON.LP_COUNT_DONE_ANNOUNCE': '{{total}} {{noun}}', 'COMMON.LP_COUNT_FAILED_ANNOUNCE': "Couldn't count {{noun}}",
  'COMMON.LP_TOTAL_COUNT': '{{count}} in total',
};

interface Deferred { resolve: (n: number) => void; reject: (e: unknown) => void; params: any }

@Component({
  standalone: true,
  imports: [ListPageComponent],
  template: `<app-list-page pageTitle="Products" resultsNoun="products" [columns]="columns" [dataSource]="load"
    [countSource]="count" [countMode]="mode()" [pagination]="{ enabled: true, pageLimits: [15, 30] }" />`,
})
class HostComponent {
  mode = signal<'auto' | 'onDemand'>('onDemand');
  columns: TableColumn[] = [{ key: 'name', label: 'Name' } as TableColumn];
  listBodies: any[] = [];
  counts: Deferred[] = [];
  load = async (p: any) => { this.listBodies.push(p); return { list: Array.from({ length: 15 }, (_, i) => ({ id: i, name: 'n' + i })), hasNext: true }; };
  count = (p: any) => new Promise<number>((resolve, reject) => this.counts.push({ resolve, reject, params: p }));
}

describe('<app-list-page> countMode', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  // Not whenStable(): while a count is in flight its 30s timeout timer keeps the zone "unstable" on purpose.
  const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 0)); fixture.detectChanges(); } };
  const pill = () => el().querySelector('.ph__title-line .lp-count') as HTMLElement | null;
  const foot = () => (el().querySelector('.lp-foot') as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();
  const footBtn = () => el().querySelector('.lp-foot .pg-link') as HTMLButtonElement | null;
  const live = () => Array.from(el().querySelectorAll('[aria-live]')).map(e => e.textContent!.trim()).filter(Boolean);

  async function mount(mode: 'auto' | 'onDemand', storage: Record<string, string> = {}) {
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem() {}, removeItem() {} });
    TestBed.configureTestingModule({
      imports: [HostComponent, TranslateModule.forRoot()],
      providers: [
        { provide: Router, useValue: { navigate: async () => true, url: '/products', events: of() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} }, queryParams: of({}) } },
        { provide: ModalService, useValue: { open: () => ({ closed: of(undefined) }) } },
        { provide: ListPreferencesService, useValue: { load: async () => null, save: async () => {} } },
      ],
    });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', { COMMON: Object.fromEntries(Object.entries(EN).map(([k, v]) => [k.replace('COMMON.', ''), v])) });
    t.use('en');
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    host.mode.set(mode);
    fixture.detectChanges();
    await settle();
  }
  afterEach(() => vi.unstubAllGlobals());

  describe("onDemand", () => {
    beforeEach(async () => { await mount('onDemand'); });

    it('unknown: "Count" button in the header, "Show total" in the footer, ONE list request and no count request', () => {
      expect(host.listBodies).toHaveLength(1);
      expect(host.counts).toHaveLength(0);
      const b = pill() as HTMLButtonElement;
      expect(b.tagName).toBe('BUTTON');
      expect(b.textContent!.trim()).toBe('Count');
      expect(b.getAttribute('aria-label')).toBe('Show total products count');
      expect(b.classList.contains('lp-count--btn')).toBe(true);
      expect(foot()).toContain('Show total');
      expect(el().querySelector('[aria-label="First page"]')).toBeNull();   // no first/last, no numbered pages
      expect(el().querySelector('[aria-label="Previous page"]')).not.toBeNull();
      expect(el().querySelector('[aria-label="Next page"]')).not.toBeNull();
    });

    it('header and footer buttons make the SAME single request; a second click does nothing', async () => {
      (pill() as HTMLButtonElement).click();
      fixture.detectChanges();
      footBtn()?.click();                      // gone already (counting), but a stale click must still be harmless
      expect(host.counts).toHaveLength(1);
      await settle();
      // counting: skeleton pill with aria-busy, footer "of" + skeleton, no buttons
      expect(pill()!.getAttribute('aria-busy')).toBe('true');
      expect(pill()!.tagName).toBe('SPAN');
      expect(foot()).toMatch(/^Showing 1–15 of(?! \d)/);   // "of" then a skeleton bar, never a number
      expect(el().querySelector('.lp-foot .pg-skel')).not.toBeNull();
      expect(footBtn()).toBeNull();
      expect(live()).toContain('Counting products');
      expect(host.counts).toHaveLength(1);
      // request body inputs: search + filters only matter; list kept loading rows with one request
      expect(host.listBodies).toHaveLength(1);
    });

    it('known: the number in the pill, "of N" in the footer, numbered pages', async () => {
      (pill() as HTMLButtonElement).click();
      host.counts[0].resolve(10581);
      await settle();
      expect(pill()!.textContent!.trim()).toBe('10,581');
      expect(foot()).toContain('of 10581');
      expect(el().querySelector('[aria-label="First page"]')).not.toBeNull();
      expect(live()).toContain('10,581 products');
    });

    it('failed: danger "Retry" in the header, "Couldn\'t count." + Retry in the footer; Retry counts again', async () => {
      (pill() as HTMLButtonElement).click();
      host.counts[0].reject(new Error('boom'));
      await settle();
      const b = pill() as HTMLButtonElement;
      expect(b.textContent!.trim()).toBe('Retry');
      expect(b.classList.contains('lp-count--danger')).toBe(true);
      expect(foot()).toContain("Couldn't count.");
      expect(footBtn()!.textContent!.trim()).toBe('Retry');
      expect(live()).toContain("Couldn't count products");
      footBtn()!.click();                       // Retry from the footer
      expect(host.counts).toHaveLength(2);
    });

    it('both buttons are real <button type=button> elements, so Enter / Space operate them (keyboard)', () => {
      const b = pill() as HTMLButtonElement;
      expect(b.type).toBe('button');
      expect(footBtn()!.type).toBe('button');
      expect(b.hasAttribute('tabindex') && b.tabIndex < 0).toBe(false);
    });

    it('narrow viewport: the header pill and Previous / Next carry no md-and-up-only (`hidden md:*`) class on themselves or any ancestor', () => {
      const hiddenBelowMd = (n: Element | null) => {
        for (let e = n; e && e !== el(); e = e.parentElement) if (/(^|\s)hidden(\s|$)/.test(e.className?.toString() ?? '')) return true;
        return false;
      };
      expect(hiddenBelowMd(pill())).toBe(false);
      expect(hiddenBelowMd(el().querySelector('[aria-label="Previous page"]'))).toBe(false);
      expect(hiddenBelowMd(el().querySelector('[aria-label="Next page"]'))).toBe(false);
      // The footer "Show total" lives in the info line, which IS hidden below md: the header pill is the mobile entry point.
      expect(hiddenBelowMd(footBtn())).toBe(true);
    });

    it('sets no left/right physical offsets on the new controls (RTL uses logical properties)', () => {
      const css = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
      const block = css.match(/\.lp-count--btn[^}]*}/g)?.join('') ?? '';
      expect(block).not.toMatch(/(margin|padding|border)-(left|right)/);
    });
  });

  describe("auto (unchanged)", () => {
    it('requests the count with the list, shows no Count button', async () => {
      await mount('auto');
      expect(host.listBodies).toHaveLength(1);
      expect(host.counts).toHaveLength(1);                 // in parallel, as before
      expect(el().querySelector('.lp-count--btn')).toBeNull();
      expect(footBtn()).toBeNull();
      host.counts[0].resolve(42);
      await settle();
      expect(pill()!.textContent!.trim()).toBe('42');
    });
  });

  describe('Actions fade (.lp-overflow-end)', () => {
    const frame = () => new Promise<void>(r => requestAnimationFrame(() => r()));
    async function scrollTo(host: HTMLElement, o: { scrollWidth: number; clientWidth: number; scrollLeft: number }) {
      for (const [k, v] of Object.entries(o)) Object.defineProperty(host, k, { value: v, configurable: true, writable: true });
      host.dispatchEvent(new Event('scroll'));
      await frame(); await frame();
      fixture.detectChanges();
    }

    it('is on only while content is hidden under the sticky column: start, middle, end, and a table that fits', async () => {
      await mount('auto');
      const host = el().querySelector('.overflow-x-auto') as HTMLElement;
      const wrap = host.parentElement as HTMLElement;
      await scrollTo(host, { scrollWidth: 1500, clientWidth: 1000, scrollLeft: 0 });
      expect(wrap.classList.contains('lp-overflow-end')).toBe(true);      // start: 500px hidden
      await scrollTo(host, { scrollWidth: 1500, clientWidth: 1000, scrollLeft: 250 });
      expect(wrap.classList.contains('lp-overflow-end')).toBe(true);      // middle
      await scrollTo(host, { scrollWidth: 1500, clientWidth: 1000, scrollLeft: 500 });
      expect(wrap.classList.contains('lp-overflow-end')).toBe(false);     // end: nothing under the column
      await scrollTo(host, { scrollWidth: 1000, clientWidth: 1000, scrollLeft: 0 });
      expect(wrap.classList.contains('lp-overflow-end')).toBe(false);     // fits (1920px): no fade at all
    });

    it('coalesces a burst of scroll events into one update per frame', async () => {
      await mount('auto');
      const host = el().querySelector('.overflow-x-auto') as HTMLElement;
      const comp = fixture.debugElement.query(x => x.name === 'app-list-page').componentInstance as any;
      const spy = vi.spyOn(comp, 'updateScrollState');
      for (let i = 0; i < 20; i++) host.dispatchEvent(new Event('scroll'));
      await frame(); await frame();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('localStorage override', () => {
    it("invo.countMode='auto' turns an onDemand page back to auto without a code change", async () => {
      await mount('onDemand', { 'invo.countMode': 'auto' });
      expect(host.counts).toHaveLength(1);
      expect(el().querySelector('.lp-count--btn')).toBeNull();
    });
  });
});
