import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';
import {
  SegmentedToggleComponent,
  SegmentedToggleOption,
} from '@shared/components/segmented-toggle/segmented-toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { ModalService } from '@shared/modal/modal.service';

import { CustomersService } from '../../../customers/services/customers.service';
import {
  PickCustomersModalComponent,
  PickCustomersModalData,
  PickCustomersModalResult,
} from '../../components/pick-customers-modal/pick-customers-modal.component';

type SegmentType = 'Manual' | 'Auto';
type SegmentMatch = 'all' | 'any';

interface Opt { label: string; value: string; }

interface SegmentCondition { type: string; condition: string; value: string; }

interface SegmentCustomer { id: string; name: string; phone?: string; saluation?: string; }

interface Segment {
  id: string | null;
  title: string;
  slug: string;
  description: string;
  type: SegmentType;
  /** Manual */
  customers: SegmentCustomer[];
  /** Auto */
  match: SegmentMatch;
  conditions: SegmentCondition[];
}

/** Comparator ids are the legacy wire values; `startsWith`/`endsWith` mean greater/less for numeric fields. */
const OP_EQUAL = { value: 'isEqual', label: 'CUSTOMER_SEGMENTS.FORM.OP_EQUAL' };
const OP_NOT_EQUAL = { value: 'isNotEqual', label: 'CUSTOMER_SEGMENTS.FORM.OP_NOT_EQUAL' };
const OP_GREATER = { value: 'startsWith', label: 'CUSTOMER_SEGMENTS.FORM.OP_GREATER' };
const OP_LESS = { value: 'endsWith', label: 'CUSTOMER_SEGMENTS.FORM.OP_LESS' };
const NUMERIC_OPS = [OP_EQUAL, OP_GREATER, OP_LESS];

/** Condition fields — mirrors the legacy `comparisons` list (field ids are the wire values). */
const FIELDS: { value: string; label: string; ops: { value: string; label: string }[] }[] = [
  { value: 'Country', label: 'CUSTOMER_SEGMENTS.FORM.FIELD_COUNTRY', ops: [OP_EQUAL, OP_NOT_EQUAL] },
  { value: 'Age', label: 'CUSTOMER_SEGMENTS.FORM.FIELD_AGE', ops: NUMERIC_OPS },
  { value: 'Amount Spent', label: 'CUSTOMER_SEGMENTS.FORM.FIELD_AMOUNT_SPENT', ops: NUMERIC_OPS },
  { value: 'No. Of Orders', label: 'CUSTOMER_SEGMENTS.FORM.FIELD_ORDERS', ops: NUMERIC_OPS },
  { value: 'Order Date', label: 'CUSTOMER_SEGMENTS.FORM.FIELD_ORDER_DATE', ops: NUMERIC_OPS },
];

const slugify = (s: string): string =>
  s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');

const emptyCondition = (): SegmentCondition => ({ type: 'Age', condition: 'isEqual', value: '' });

const emptySegment = (): Segment => ({
  id: null, title: '', slug: '', description: '',
  type: 'Manual', customers: [], match: 'all', conditions: [],
});

/**
 * Customer-segment editor (`/account/customer-segments/:id`, `new` → create).
 * Port of the legacy `customer-segments-form.component`: Manual segments pin
 * individual customers; Automated ones match customers against conditions
 * (all / any). Same signal + snapshot-dirty + guard chrome as the
 * product-collection form.
 */
@Component({
  selector: 'app-customer-segment-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, LoadingOverlayComponent,
    SegmentedToggleComponent, SearchDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-segment-form.component.html',
  styleUrl: './customer-segment-form.component.scss',
})
export class CustomerSegmentFormComponent implements OnInit, CanLeaveComponent {
  private customers = inject(CustomersService);
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private modal = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);
  saving = signal(false);
  segment = signal<Segment>(emptySegment());

  private isCreate = signal(true);
  cleanSnapshot = signal('');
  private i18nTick = signal(0);

  readonly typeOptions: SegmentedToggleOption<SegmentType>[] = [
    { value: 'Manual', label: 'CUSTOMER_SEGMENTS.FORM.TYPE_MANUAL' },
    { value: 'Auto', label: 'CUSTOMER_SEGMENTS.FORM.TYPE_AUTO' },
  ];
  readonly matchOptions: SegmentedToggleOption<SegmentMatch>[] = [
    { value: 'all', label: 'CUSTOMER_SEGMENTS.FORM.MATCH_ALL' },
    { value: 'any', label: 'CUSTOMER_SEGMENTS.FORM.MATCH_ANY' },
  ];

  fieldOpts = computed<Opt[]>(() => {
    this.i18nTick();
    return FIELDS.map(f => ({ value: f.value, label: this.translate.instant(f.label) }));
  });

  pageTitle = computed(() => {
    this.i18nTick();
    return this.translate.instant(this.isCreate() ? 'CUSTOMER_SEGMENTS.FORM.NEW_TITLE' : 'CUSTOMER_SEGMENTS.FORM.EDIT_TITLE');
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('CUSTOMER_SEGMENTS.TITLE'), routerLink: '/account/customer-segments' },
      { label: this.pageTitle() },
    ];
  });

  isManual = computed(() => this.segment().type === 'Manual');
  titleError = computed<string | null>(() =>
    this.segment().title.trim() ? null : 'CUSTOMER_SEGMENTS.FORM.TITLE_REQUIRED');

  /** Manual needs ≥1 customer; Auto needs ≥1 condition, each with a value. */
  linesValid = computed(() => {
    const s = this.segment();
    if (s.type === 'Manual') return s.customers.length > 0;
    return s.conditions.length > 0 && s.conditions.every(c => String(c.value ?? '').trim() !== '');
  });

  isDirty = computed(() => this.snapshot() !== this.cleanSnapshot());
  canSave = computed(() => !this.titleError() && this.linesValid() && !this.saving() && this.isDirty());

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new' && id !== '0') {
      this.isCreate.set(false);
      this.loading.set(true);
      try {
        const raw = await this.customers.getCustomerSegmentById(id);
        this.segment.set(this.fromWire(raw, id));
      } finally {
        this.loading.set(false);
      }
    }
    this.cleanSnapshot.set(this.snapshot());
  }

  /** Wire → form model. Manual `data.customers` arrives as `{customerId, CustomerName, phone, saluation}`
   *  (null-ish single row when the segment has no members, because of the backend's LEFT JOIN). */
  private fromWire(raw: any, id: string): Segment {
    const type: SegmentType = raw?.type === 'Auto' ? 'Auto' : 'Manual';
    const data = raw?.data ?? {};
    const customers: SegmentCustomer[] = type === 'Manual'
      ? (Array.isArray(data.customers) ? data.customers : [])
          .filter((c: any) => c?.customerId)
          .map((c: any) => ({ id: c.customerId, name: c.CustomerName ?? '', phone: c.phone ?? '', saluation: c.saluation ?? '' }))
      : [];
    return {
      id: raw?.id ?? id,
      title: raw?.title ?? '',
      slug: raw?.slug ?? slugify(raw?.title ?? ''),
      description: raw?.description ?? '',
      type,
      customers,
      match: data.match === 'any' ? 'any' : 'all',
      conditions: type === 'Auto' && Array.isArray(data.conditions)
        ? data.conditions.map((c: any) => ({ type: c.type, condition: c.condition, value: c.value ?? '' }))
        : [],
    };
  }

  // ── Field setters ──────────────────────────────────────────────────
  setTitle(v: string): void { this.segment.update(s => ({ ...s, title: v, slug: slugify(v) })); }
  setDescription(v: string): void { this.segment.update(s => ({ ...s, description: v })); }
  setMatch(m: SegmentMatch): void { this.segment.update(s => ({ ...s, match: m })); }

  setType(t: SegmentType): void {
    if (t === this.segment().type) return;
    // Swap payloads wholesale so Manual / Auto never carry stale fields (legacy selectSegmentType).
    this.segment.update(s => ({
      ...s, type: t, customers: [], match: 'all',
      conditions: t === 'Auto' ? [emptyCondition()] : [],
    }));
  }

  // ── Manual: customers ──────────────────────────────────────────────
  /** Multi-select picker modal; the applied selection replaces the list
   *  (already-added customers arrive pre-ticked, so unticking removes them). */
  async pickCustomers(): Promise<void> {
    const res = await this.modal.open<PickCustomersModalComponent, PickCustomersModalData, PickCustomersModalResult>(
      PickCustomersModalComponent,
      { size: 'md', data: { selected: this.segment().customers } },
    ).afterClosed();
    if (!res) return;
    this.segment.update(s => ({ ...s, customers: res.selected }));
  }

  removeCustomer(index: number): void {
    this.segment.update(s => ({ ...s, customers: s.customers.filter((_, i) => i !== index) }));
  }

  // ── Auto: conditions ───────────────────────────────────────────────
  addCondition(): void { this.segment.update(s => ({ ...s, conditions: [...s.conditions, emptyCondition()] })); }
  removeCondition(i: number): void {
    this.segment.update(s => ({ ...s, conditions: s.conditions.filter((_, idx) => idx !== i) }));
  }

  private patchCondition(i: number, patch: Partial<SegmentCondition>): void {
    this.segment.update(s => ({ ...s, conditions: s.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  }
  setConditionType(i: number, opt: any): void {
    const type = opt?.value ?? opt ?? 'Age';
    // Comparator lists differ per field; reset to the first valid one.
    this.patchCondition(i, { type, condition: FIELDS.find(f => f.value === type)?.ops[0].value ?? 'isEqual' });
  }
  setConditionComparator(i: number, opt: any): void { this.patchCondition(i, { condition: opt?.value ?? opt ?? 'isEqual' }); }
  setConditionValue(i: number, value: string): void { this.patchCondition(i, { value }); }

  comparatorOpts(type: string): Opt[] {
    this.i18nTick();
    return (FIELDS.find(f => f.value === type)?.ops ?? []).map(o => ({ value: o.value, label: this.translate.instant(o.label) }));
  }

  displayOpt = (o: Opt | string): string => (typeof o === 'string' ? o : o?.label ?? '');
  compareOpt = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);
  /** Resolve a persisted id back to its option so the dropdown shows the label. */
  fieldOpt(type: string): Opt | null { return this.fieldOpts().find(o => o.value === type) ?? null; }
  comparatorOpt(type: string, condition: string): Opt | null { return this.comparatorOpts(type).find(o => o.value === condition) ?? null; }

  // ── Save / cancel ──────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const s = this.segment();
      const payload = {
        id: this.isCreate() ? null : s.id,
        title: s.title.trim(),
        slug: s.slug,
        description: s.description,
        type: s.type,
        data: s.type === 'Manual'
          ? { type: 'Customer', ids: s.customers.map(c => c.id) }
          : { match: s.match, conditions: s.conditions },
      };
      const res = await this.customers.saveCustomerSegment(payload);
      if (res?.success) {
        this.toast.success('CUSTOMER_SEGMENTS.FORM.SAVED_OK');
        this.cleanSnapshot.set(this.snapshot());
        void this.router.navigate(['/account/customer-segments']);
      } else {
        this.toast.error('CUSTOMER_SEGMENTS.FORM.SAVE_FAILED', res?.msg);
      }
    } catch (err: any) {
      // Backend rejects duplicate titles / slugs with "Title already used" / "Slug already used".
      this.toast.error('CUSTOMER_SEGMENTS.FORM.SAVE_FAILED', err?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { void this.router.navigate(['/account/customer-segments']); }

  // ── Unsaved-changes guard ──────────────────────────────────────────
  private snapshot(): string { return JSON.stringify(this.segment()); }
  hasUnsavedChanges(): boolean { return this.snapshot() !== this.cleanSnapshot(); }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      void this.save();
    }
  }
}
