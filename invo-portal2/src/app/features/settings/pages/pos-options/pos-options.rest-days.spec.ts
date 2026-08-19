import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { ToastService } from '@shared/components/toast/toast.service';
import { BusinessSettingsService } from '../../services/business-settings.service';
import { PosOptionsComponent } from './pos-options.component';

/**
 * Weekly rest days, on the POS-options screen.
 *
 * ── WHY HERE, AND WHY THESE ASSERTIONS ───────────────────────────────────────
 * `Companies.options` is written WHOLESALE by the server — `company.repo.ts:361`
 * sets `"options"=$6`. The blob also holds six POS flags used by 124 companies.
 * So the question this file has to answer is NOT "did restDays save" — that
 * passes under a payload that wipes everything else. It is **what else went out
 * in the same request**.
 *
 * Everything is asserted on the payload handed to `saveCompany`, which is
 * DOWNSTREAM OF THE CALL SITE. Asserting on the form control instead would pass
 * whether or not `save()` ever read it — a correct rule and an unused rule look
 * identical from the control.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

/** A company as the API returns it: POS flags set, rest days never chosen. */
const COMPANY: any = {
  id: 'co-1',
  name: 'Sayed Hussain',
  options: {
    allowOnlyOneCashierPerTerminal: true,
    noSaleWhenZero: true,
    hideVoidedItem: true,
    voidedItemNeedExplanation: true,
    addCustomerByMSR: true,
    disableHalfItem: true,
    maxReferneceNumber: 42,
    voidReasons: ['Wrong item'],
    // A key this build does NOT render. `options` is a jsonb blob shared with
    // the POS and across releases, so a stored flag this screen knows nothing
    // about is the ordinary case, not a contrived one — and it is the ONLY
    // witness that can detect a payload built from the form alone.
    someFlagFromAnotherRelease: true,
  },
  printingOptions: {},
};

function setup(company: any = COMPANY) {
  const saveCompany = vi.fn().mockResolvedValue({ success: true });

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PosOptionsComponent, TranslateModule.forRoot()],
    providers: [
      {
        provide: BusinessSettingsService,
        useValue: {
          saveCompany,
          loadSettings: vi.fn().mockResolvedValue(company),
          getCompany: vi.fn().mockResolvedValue(company),
        },
      },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      // The component renders `<app-breadcrumbs>` with routerLinks, so the
      // standalone injector needs a route even though nothing here reads one.
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: new Map(), queryParamMap: new Map() } },
      },
    ],
  });

  const fixture = TestBed.createComponent(PosOptionsComponent);
  return { fixture, component: fixture.componentInstance, saveCompany };
}

async function load(fixture: ComponentFixture<PosOptionsComponent>): Promise<void> {
  fixture.detectChanges();
  await flush();
  await flush();
  fixture.detectChanges();
}

/** The options blob actually posted. */
function sentOptions(saveCompany: any): any {
  return saveCompany.mock.calls[0][0].options;
}

describe('rest days on the POS options screen', () => {
  it('0 IS SUNDAY, and the labels are in that order', () => {
    // Pinned on the client as well as the server. ISO numbering (1 = Monday)
    // would put every company's rest days one day out while every leave count
    // still looked plausible — a premise that has moved every expectation by
    // one, twice. The list index IS the day number, so this also guards a
    // reordering of the array.
    const { component } = setup();
    const opts = component.restDayOptions;

    expect(opts[0].labelKey).toContain('SUNDAY');
    expect(opts[5].labelKey).toContain('FRIDAY');
    expect(opts[6].labelKey).toContain('SATURDAY');
    for (let i = 0; i < opts.length; i++) expect(opts[i].value).toBe(i);

    // And the numbering the server actually uses.
    expect(new Date('2026-08-09T00:00:00Z').getUTCDay()).toBe(0); // Sunday
    expect(new Date('2026-08-07T00:00:00Z').getUTCDay()).toBe(5); // Friday
  });

  it('shows Fri+Sat but marks them ASSUMED when the company never chose', async () => {
    const ctx = setup();
    await load(ctx.fixture);

    expect(ctx.component.restDaysAreDefault()).toBe(true);
    expect(ctx.component.form.get(['options', 'restDays'])?.value).toEqual([5, 6]);
  });

  it('marks them chosen when the company HAS chosen', async () => {
    const ctx = setup({ ...COMPANY, options: { ...COMPANY.options, restDays: [0, 6] } });
    await load(ctx.fixture);

    expect(ctx.component.restDaysAreDefault()).toBe(false);
    expect(ctx.component.form.get(['options', 'restDays'])?.value).toEqual([0, 6]);
  });

  it('drops a null entry on load instead of showing Sunday as chosen', async () => {
    // Number(null) is 0. Without the type check ahead of the coercion the
    // screen would display Sunday as a deliberate rest day.
    const ctx = setup({ ...COMPANY, options: { ...COMPANY.options, restDays: [5, null, 6] } });
    await load(ctx.fixture);

    expect(ctx.component.form.get(['options', 'restDays'])?.value).toEqual([5, 6]);
  });

  describe('what the save actually posts', () => {
    it('KEEPS a stored option this screen does not even render', async () => {
      // THE assertion of this file, and the SECOND attempt at it.
      //
      // The first version listed the six POS flags and was DECORATIVE: every
      // one of them has a control on this form, so the form's own value
      // carries them whether or not the stored options are merged in. The
      // mutant that removes the merge left all nine tests green — which is how
      // the hole was found instead of shipped.
      //
      // The key that actually distinguishes "merged" from "built from the
      // form" is one this build does not know about. Under a form-only payload
      // it is simply absent, and the server's wholesale `"options"=$6` then
      // deletes it for that company.
      const ctx = setup();
      await load(ctx.fixture);

      ctx.component.form.get(['options', 'restDays'])?.setValue([0, 6]);
      await ctx.component.save();

      expect(sentOptions(ctx.saveCompany).someFlagFromAnotherRelease).toBe(true);
    });

    it('and keeps the rendered POS flags too', async () => {
      // Ordinary regression cover, NOT proof of the merge — these pass with
      // the merge removed, because the form renders all six. Kept, and labelled
      // so nobody reads them as the guarantee.
      const ctx = setup();
      await load(ctx.fixture);

      ctx.component.form.get(['options', 'restDays'])?.setValue([0, 6]);
      await ctx.component.save();

      const sent = sentOptions(ctx.saveCompany);
      expect(sent.voidedItemNeedExplanation).toBe(true);
      expect(sent.addCustomerByMSR).toBe(true);
      expect(sent.maxReferneceNumber).toBe(42);
    });

    it('sends the chosen days, de-duplicated and sorted', async () => {
      const ctx = setup();
      await load(ctx.fixture);

      ctx.component.form.get(['options', 'restDays'])?.setValue([6, 0, 6]);
      await ctx.component.save();

      expect(sentOptions(ctx.saveCompany).restDays).toEqual([0, 6]);
    });

    it('omits the key entirely when nothing is selected', async () => {
      // Empty is "not chosen", not "works seven days" — the server collapses
      // [] to the default anyway, so writing it would store a value that reads
      // back as an assumption while looking like a decision.
      const ctx = setup();
      await load(ctx.fixture);

      ctx.component.form.get(['options', 'restDays'])?.setValue([]);
      await ctx.component.save();

      expect('restDays' in sentOptions(ctx.saveCompany)).toBe(false);
    });

    it('CLEARS a previously stored value when the user empties the field', async () => {
      // The trap in the merge: the payload spreads the stored options first, so
      // merely leaving the key out of the form's half lets the old value
      // survive and the clear silently fails. It has to be deleted from the
      // MERGED object.
      const ctx = setup({ ...COMPANY, options: { ...COMPANY.options, restDays: [0, 6] } });
      await load(ctx.fixture);

      ctx.component.form.get(['options', 'restDays'])?.setValue([]);
      await ctx.component.save();

      const sent = sentOptions(ctx.saveCompany);
      expect('restDays' in sent).toBe(false);
      // …and the unrendered key survives the clearing path too.
      expect(sent.someFlagFromAnotherRelease).toBe(true);
    });

    it('never sends a day outside 0-6', async () => {
      const ctx = setup();
      await load(ctx.fixture);

      ctx.component.form.get(['options', 'restDays'])?.setValue([5, 7, -1]);
      await ctx.component.save();

      expect(sentOptions(ctx.saveCompany).restDays).toEqual([5]);
    });
  });
});
