import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { CompanyService } from '@core/auth/company.service';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ModalService } from '@shared/modal/modal.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';

import {
  BranchSettingsService,
  BranchDetails,
} from '../../services/branch-settings.service';
import {
  DayHours,
  WEEK_DAYS,
} from '../../components/working-hours-editor/working-hours-editor.component';
import {
  LocationEditModalComponent,
  LocationEditModalData,
  LocationEditModalResult,
} from '../../components/location-edit-modal/location-edit-modal.component';
import {
  WorkingHoursModalComponent,
  WorkingHoursModalData,
  WorkingHoursModalResult,
} from '../../components/working-hours-modal/working-hours-modal.component';

/**
 * Settings → Branch form (edit only)
 *
 * Loads via `/settings/branches/:id`. Adding a branch is handled by the
 * company admin (a separate flow), so an unknown / 'new' id redirects
 * back to the list to keep this page in a consistent state.
 *
 * Round-trips unknown fields (coveredAddresses, etc.) via the captured
 * `original` snapshot so saving from this UI doesn't
 * silently wipe data managed by other parts of the system.
 */
@Component({
  selector: 'app-branch-form',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    TimePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './branch-form.component.html',
  styleUrl: './branch-form.component.scss',
})
export class BranchFormComponent implements OnInit {
  private fb         = inject(FormBuilder);
  private service    = inject(BranchSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private companySvc = inject(CompanyService);
  private modal      = inject(ModalService);
  private sanitizer  = inject(DomSanitizer);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** The current branch id, or `null` while we wait for the route param. */
  branchId = signal<string | null>(null);

  /** The full payload from the server — kept so save can round-trip
   *  unknown fields (coveredAddresses, etc.) untouched. */
  private original = signal<BranchDetails | null>(null);

  /** Current schedule state — single source of truth, edited via the
   *  modal. Initialised from the loaded branch and serialised back to
   *  the wire format on Save. */
  workingHours = signal<DayHours[]>([]);
  deliveryTimes = signal<DayHours[]>([]);

  /** Live read of the company's country code so the phone field can show
   *  the prefix (e.g. "+973"). */
  countryCode = computed<string>(() => {
    const settings = this.companySvc.settings();
    return settings?.settings?.contryCode ?? '';
  });

  /** Re-translate computed labels when ngx-translate finishes loading. */
  private i18nTick = signal(0);

  // ─── Form ───────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    name:        ['', [Validators.required]],
    phoneNumber: [''],
    address:     [''],
    closingTime: [''],
    lat:         [''],
    lng:         [''],
    onlineAvailability: [true],
    mainBranch:         [false],
  });

  // ─── Derived ────────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.BRANCH_SETTINGS'), routerLink: '/settings/branches' },
      { label: this.original()?.name || this.translate.instant('SETTINGS.BRANCHES.EDIT') },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.original()?.name || this.translate.instant('SETTINGS.BRANCHES.EDIT');
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  /** Disabled state for the "online availability" toggle — backend
   *  forbids turning off the e-commerce default branch's online flag. */
  isEcommerceDefault = computed<boolean>(() => !!this.original()?.isEcommerceDefault);

  /** Bumped on every form valueChange so map-related computeds re-run.
   *  FormControl values are not tracked by signals automatically. */
  private formTick = signal(0);

  /** Embed URL for the read-only Google-Maps preview on the form card.
   *  Returns `null` when no coordinates are set so the template can show
   *  the "no location" placeholder instead of a world-zoom map. */
  mapPreviewUrl = computed<SafeResourceUrl | null>(() => {
    this.formTick();
    const lat = String(this.form.controls['lat'].value ?? '').trim();
    const lng = String(this.form.controls['lng'].value ?? '').trim();
    if (!lat || !lng) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.google.com/maps?q=${encodeURIComponent(lat + ',' + lng)}&z=15&output=embed`,
    );
  });

  constructor() {
    withTranslations('settings');

    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));

    // Drive the map-preview signal off form changes — Angular forms don't
    // emit signals natively, so we bump a tick on every value mutation.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    // No add-flow here — adding a branch is part of the company admin.
    // If we land on `/new` or no id, bounce back to the list.
    if (!id || id === 'new') {
      this.router.navigate(['/settings/branches']);
      return;
    }
    this.branchId.set(id);

    // Make sure company settings (for the phone country-code prefix) are
    // loaded even on a hard reload of this page.
    if (!this.companySvc.settings()) {
      await this.companySvc.loadSettings();
    }

    this.loading.set(true);
    try {
      const data = await this.service.getOne(id);
      if (!data) return;
      this.original.set(data);
      this.form.patchValue({
        name:               data.name ?? '',
        phoneNumber:        data.phoneNumber ?? '',
        address:            data.address ?? '',
        closingTime:        data.closingTime ?? '',
        lat:                data.location?.lat ?? '',
        lng:                data.location?.lng ?? '',
        onlineAvailability: !!data.onlineAvailability,
        mainBranch:         !!data.mainBranch,
      });
      // Default branch can't have online flag turned off — disable the
      // toggle so the rule is visible, not just enforced on save.
      if (data.isEcommerceDefault) {
        this.form.controls['onlineAvailability'].disable();
      }
      // Schedules: the wire format is an object keyed by day name
      // (Sunday → [periods]); `toDayHours` also handles the legacy
      // `[{day, periods, isClosed}]` array shape.
      this.workingHours.set(this.toDayHours(data.workingHours));
      this.deliveryTimes.set(this.toDayHours(data.deliveryTimes));
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const original = this.original();
      const payload: any = {
        ...(original ?? {}),
        id:                 this.branchId() ?? null,
        name:               v.name,
        phoneNumber:        v.phoneNumber ?? '',
        address:             v.address ?? '',
        closingTime:        v.closingTime ?? '',
        location:           { lat: v.lat ?? '', lng: v.lng ?? '' },
        onlineAvailability: !!v.onlineAvailability,
        mainBranch:         !!v.mainBranch,
        // Schedules — serialise back to the legacy object-keyed wire
        // format (`{ Sunday: [{from,to}], ... }`). Closed days emit `[]`.
        workingHours:  this.serializeSchedule(this.workingHours()),
        deliveryTimes: this.serializeSchedule(this.deliveryTimes()),
      };
      const res = await this.service.save(payload);
      if (res?.success) {
        this.router.navigate(['/settings/branches']);
      }
    } catch (e) {
      console.error('[branch-form] save failed', e);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/settings/branches']);
  }

  /** Open the location editor in a modal — keeps the form card slim
   *  (read-only summary + map preview) and matches the Wix-style flow
   *  where address details live behind an explicit Edit click. */
  async openLocationModal(): Promise<void> {
    const ref = this.modal.open<
      LocationEditModalComponent,
      LocationEditModalData,
      LocationEditModalResult
    >(LocationEditModalComponent, {
      size: 'md',
      data: {
        address: this.form.controls['address'].value ?? '',
        lat:     this.form.controls['lat'].value     ?? '',
        lng:     this.form.controls['lng'].value     ?? '',
        // ISO-2 country code for the default map centre when the branch
        // has no saved coords. Stored under `settings.contryCode` (the
        // legacy typo is preserved as the wire field name).
        countryCode: this.companySvc.settings()?.settings?.contryCode ?? '',
      },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;
    this.form.patchValue({
      address: result.address,
      lat:     result.lat,
      lng:     result.lng,
    });
    this.form.markAsDirty();
  }

  // ─── Schedule modals ───────────────────────────────────────────────────
  /** Single helper opens the modal pre-loaded with `current` and pipes
   *  the result back through `setter` — used by both Working Hours and
   *  Delivery Times so the wiring stays DRY. */
  private async openScheduleModal(
    titleKey: string,
    subtitleKey: string,
    current: DayHours[],
    setter: (next: DayHours[]) => void,
  ): Promise<void> {
    const ref = this.modal.open<
      WorkingHoursModalComponent,
      WorkingHoursModalData,
      WorkingHoursModalResult
    >(WorkingHoursModalComponent, {
      // `lg` (720px) — `md` (560px) was too tight for the 7-day grid:
      // after the day-name column, action slot and "to" separator the
      // time pickers ended up clipping their values to "08:..." with
      // ellipses. `lg` gives each picker ~170px so "08:00 AM" + clock
      // icon fits comfortably.
      size: 'lg',
      data: {
        title:    this.translate.instant(titleKey),
        subtitle: this.translate.instant(subtitleKey),
        initial:  current,
      },
      closeOnBackdrop: false,
    });
    const result = await ref.afterClosed();
    if (!result) return;
    setter(result);
    this.form.markAsDirty();
  }

  openWorkingHoursModal(): void {
    this.openScheduleModal(
      'SETTINGS.BRANCHES.EDIT_WORKING_HOURS',
      'SETTINGS.BRANCHES.WORKING_HOURS_DESC',
      this.workingHours(),
      (next) => this.workingHours.set(next),
    );
  }

  openDeliveryTimesModal(): void {
    this.openScheduleModal(
      'SETTINGS.BRANCHES.EDIT_DELIVERY_TIMES',
      'SETTINGS.BRANCHES.DELIVERY_TIMES_DESC',
      this.deliveryTimes(),
      (next) => this.deliveryTimes.set(next),
    );
  }

  // ─── Schedule summary (read-only cards) ────────────────────────────────
  /** Build a row per canonical day for the read-only Wix-style cards.
   *  Each row carries its label + first period's from/to (12-hour
   *  formatted) + a small `extra` count when the day has multiple
   *  periods, so the card body can stack the times vertically. */
  private buildSummary(days: DayHours[]): {
    day: string;
    label: string;
    isClosed: boolean;
    from: string;
    to: string;
    extra: number;
  }[] {
    this.i18nTick();
    const map = new Map<string, DayHours>();
    days.forEach((d) => map.set(d.day, d));
    return WEEK_DAYS.map((d) => {
      const entry = map.get(d);
      const label = this.translate.instant('COMMON.DAYS.' + d.toUpperCase());
      const periods = entry?.periods ?? [];
      const isClosed = !!entry?.isClosed || periods.length === 0;
      const first = periods[0];
      return {
        day:      d,
        label,
        isClosed,
        from:     first ? formatHm(first.from) : '',
        to:       first ? formatHm(first.to)   : '',
        extra:    Math.max(0, periods.length - 1),
      };
    });
  }

  workingHoursSummary = computed(() => this.buildSummary(this.workingHours()));
  deliveryTimesSummary = computed(() => this.buildSummary(this.deliveryTimes()));

  // ─── Schedule (working hours / delivery times) helpers ─────────────────
  /**
   * Coerce whatever `workingHours` / `deliveryTimes` shape comes back
   * from the server into the editor-friendly `DayHours[]`. The legacy
   * wire format is an object keyed by day name (`{ Sunday: [{from,to}] }`),
   * but older branches saved an array of `{day, periods, isClosed}` —
   * both are accepted on read.
   */
  private toDayHours(raw: any): DayHours[] {
    if (!raw) return [];
    // Array shape — assume already-correct entries; fill in missing days.
    if (Array.isArray(raw)) {
      const map = new Map<string, DayHours>();
      raw.forEach((d: any) => {
        if (!d?.day) return;
        const periods = Array.isArray(d.periods) ? d.periods.filter((p: any) => p?.from && p?.to) : [];
        map.set(d.day, {
          day: d.day,
          isClosed: typeof d.isClosed === 'boolean' ? d.isClosed : periods.length === 0,
          periods,
        });
      });
      return WEEK_DAYS.map((d) => map.get(d) ?? { day: d, isClosed: true, periods: [] });
    }
    // Object shape — `{ Sunday: [...periods] }`. Empty array = closed.
    if (typeof raw === 'object') {
      return WEEK_DAYS.map((d) => {
        const periods = Array.isArray(raw[d]) ? raw[d].filter((p: any) => p?.from && p?.to) : [];
        return { day: d, isClosed: periods.length === 0, periods };
      });
    }
    return [];
  }

  /**
   * Convert the editor's FormArray value back to the canonical wire
   * format — an object keyed by day name with arrays of `{from,to}`.
   * Closed days emit an empty array, which is how the backend has
   * always represented "closed today".
   */
  private serializeSchedule(formValue: any): Record<string, Array<{ from: string; to: string }>> {
    const out: Record<string, Array<{ from: string; to: string }>> = {};
    const days: any[] = Array.isArray(formValue) ? formValue : [];
    WEEK_DAYS.forEach((d) => { out[d] = []; });
    days.forEach((day: any) => {
      if (!day?.day) return;
      if (day.isClosed) { out[day.day] = []; return; }
      const periods = (day.periods ?? []).map((p: any) => ({
        from: String(p.from ?? ''),
        to:   String(p.to ?? ''),
      })).filter((p: any) => p.from && p.to);
      out[day.day] = periods;
    });
    return out;
  }
}

/** "07:00" → "7:00am", "17:00" → "5:00pm". Lower-case suffix matches
 *  the Wix-style summary cards we mirror — keeps the cards short and
 *  consistent in width. Returns the raw input on parse failure. */
function formatHm(hm: string): string {
  const v = (hm ?? '').trim();
  if (!v) return '';
  const [hStr = '', mStr = ''] = v.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return v;
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  const mm = m < 10 ? '0' + m : String(m);
  return `${h12}:${mm}${period}`;
}
