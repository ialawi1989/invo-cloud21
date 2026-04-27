import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ModalService } from '@shared/modal/modal.service';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { TimePickerComponent } from '@shared/components/time-picker/time-picker.component';
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import {
  CUSTOM_FIELD_ENTITY_TYPES,
  CUSTOM_FIELD_TYPES,
  CustomField,
  CustomFieldEntityType,
  CustomFieldOption,
  CustomFieldType,
  FieldTypeCard,
  GridTemplate,
  NumberDisplay,
  TEXTUAL_TYPES,
  findEntityType,
  findFieldTypeCard,
} from '../../models/custom-field.types';
import { CustomFieldsService } from '../../services/custom-fields.service';
import {
  CustomFieldTypeModalComponent,
  CustomFieldTypeModalData,
} from '../../components/custom-field-type-modal/custom-field-type-modal.component';

/**
 * Settings → Custom Fields → :type
 *
 * Per-entity-type editor: lists, adds, edits, reorders, soft-deletes
 * and restores custom field definitions. Persists via
 * `CustomFieldsService.save`.
 *
 * The view holds two arrays — `active` and `deleted` — driven by signals
 * so the OnPush template re-renders cleanly without manual `markForCheck`.
 * Validation (slug uniqueness, name required) is computed lazily from
 * the same signals so error states stay in sync without explicit wiring.
 */
@Component({
  selector: 'app-custom-fields-manager',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    DragDropModule,
    DatePickerComponent,
    TimePickerComponent,
    ColorPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-fields-manager.component.html',
  styleUrl: './custom-fields-manager.component.scss',
})
export class CustomFieldsManagerComponent implements OnInit {
  private service    = inject(CustomFieldsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private cdr        = inject(ChangeDetectorRef);
  private modal      = inject(ModalService);
  private sanitizer  = inject(DomSanitizer);

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  /** Entity type from the route param. Falls back to the first entity if unknown. */
  entity = signal<CustomFieldEntityType>(CUSTOM_FIELD_ENTITY_TYPES[0]);

  /** Active fields, in display order. */
  active  = signal<CustomField[]>([]);

  /** Soft-deleted fields. Order is preserved but isn't user-visible. */
  deleted = signal<CustomField[]>([]);

  /** Trash drawer open/closed (collapsed by default). */
  trashOpen = signal<boolean>(false);

  /** Re-translate labels after ngx-translate finishes loading. */
  private i18nTick = signal(0);

  /** Snapshot of the loaded fields so Cancel can revert without a re-fetch. */
  private snapshot: { active: CustomField[]; deleted: CustomField[] } = {
    active: [], deleted: [],
  };

  // ─── Constants for templates ───────────────────────────────────────────
  readonly fieldTypes:  readonly CustomFieldType[]                   = CUSTOM_FIELD_TYPES;
  readonly numberKinds: readonly NumberDisplay[]                     = ['integer', 'decimal', 'currency', 'percentage'];
  readonly grids:       readonly GridTemplate[]                      = ['col-4', 'col-6', 'col-12'];

  // ─── Derived ───────────────────────────────────────────────────────────
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.CUSTOM_FIELDS'), routerLink: '/settings/custom-fields' },
      { label: this.translate.instant(this.entity().nameKey) },
    ];
  });

  pageTitle = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('SETTINGS.CUSTOM_FIELDS.MANAGER_TITLE', {
      entity: this.translate.instant(this.entity().nameKey),
    });
  });

  /** True when at least one field has unfilled / invalid required props. */
  isValid = computed<boolean>(() => {
    const list = this.active();
    if (list.length === 0) return true;
    const slugs = new Set<string>();
    for (const f of list) {
      if (!f.name.trim() || !f.abbr.trim()) return false;
      const slug = f.abbr.trim().toLowerCase();
      if (slugs.has(slug)) return false;
      slugs.add(slug);
      if (f.type === 'select' && (!f.customOptions || f.customOptions.length === 0)) return false;
    }
    return true;
  });

  saveLabel = computed<string>(() => {
    this.i18nTick();
    return this.translate.instant('COMMON.SAVING');
  });

  constructor() {
    withTranslations('settings');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const slug = this.route.snapshot.paramMap.get('type') ?? '';
    const entity = findEntityType(slug);
    if (!entity) {
      this.router.navigate(['/settings/custom-fields']);
      return;
    }
    this.entity.set(entity);

    this.loading.set(true);
    try {
      const all = await this.service.getByType(entity.type);
      const active  = all.filter((f) => !f.isDeleted);
      const deleted = all.filter((f) =>  f.isDeleted);
      this.active.set(active.map(this.attachUi));
      this.deleted.set(deleted);
      this.snapshot = {
        active:  active.map(clone),
        deleted: deleted.map(clone),
      };
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Per-field helpers ─────────────────────────────────────────────────
  identify(_: number, f: CustomField): string { return f.id; }

  toggleOpen(id: string): void {
    this.active.update((list) =>
      list.map((f) => (f.id === id ? { ...f, isOpened: !f.isOpened } : f)),
    );
  }

  setTab(id: string, tab: NonNullable<CustomField['activeTab']>): void {
    this.active.update((list) =>
      list.map((f) => (f.id === id ? { ...f, activeTab: tab } : f)),
    );
  }

  /** Patch one property — updates the signal so the view re-renders. */
  patch<K extends keyof CustomField>(id: string, key: K, value: CustomField[K]): void {
    this.active.update((list) =>
      list.map((f) => (f.id === id ? { ...f, [key]: value } : f)),
    );
  }

  /** Coerce / sanitise the slug as the user types it. */
  onSlugInput(id: string, raw: string): void {
    const slug = raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 40);
    this.patch(id, 'abbr', slug);
  }

  /** Auto-derive slug from name when slug is empty (UX nicety). */
  onNameBlur(id: string): void {
    const f = this.active().find((x) => x.id === id);
    if (!f) return;
    if (f.abbr.trim()) return;
    const auto = f.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40);
    if (auto) this.patch(id, 'abbr', auto);
  }

  /** Slug taken by another field — drives the inline error. */
  isSlugTaken(id: string, slug: string): boolean {
    const s = slug.trim().toLowerCase();
    if (!s) return false;
    return this.active().some((f) => f.id !== id && f.abbr.trim().toLowerCase() === s);
  }

  // ─── Add / duplicate / delete / restore ────────────────────────────────
  /**
   * Add a new field. Opens the type-picker modal first so the user picks
   * the shape they want before being dropped into the configuration UI —
   * matches the Content Library "Choose field type" pattern.
   */
  async add(): Promise<void> {
    const ref = this.modal.open<
      CustomFieldTypeModalComponent,
      CustomFieldTypeModalData,
      CustomFieldType | null
    >(CustomFieldTypeModalComponent, {
      size: 'lg',
      data: { initialType: 'text' },
      closeOnBackdrop: true,
    });
    const picked = await ref.afterClosed();
    if (!picked) return;

    const fresh: CustomField = this.attachUi({
      id:             newId(),
      type:           picked,
      name:           '',
      abbr:           '',
      required:       false,
      defaultValue:   '',
      gridTemplate:   'col-12',
      customOptions:  [],
      selectMultiple: false,
      clearable:      true,
      allowNull:      false,
    });
    fresh.isOpened = true;
    fresh.activeTab = 'general';
    this.active.update((list) => [...list, fresh]);
  }

  /** Open the type picker for an existing field. */
  async changeType(id: string): Promise<void> {
    const current = this.active().find((f) => f.id === id);
    if (!current) return;
    const ref = this.modal.open<
      CustomFieldTypeModalComponent,
      CustomFieldTypeModalData,
      CustomFieldType | null
    >(CustomFieldTypeModalComponent, {
      size: 'lg',
      data: { initialType: current.type },
      closeOnBackdrop: true,
    });
    const picked = await ref.afterClosed();
    if (!picked || picked === current.type) return;
    this.patch(id, 'type', picked);
    // Switching to a select-type field needs at least one option to save —
    // seed an empty row so the user can spot what's needed.
    if (picked === 'select') {
      this.active.update((list) =>
        list.map((f) =>
          f.id === id && (!f.customOptions || f.customOptions.length === 0)
            ? { ...f, customOptions: [{ label: '', value: '' }] }
            : f,
        ),
      );
    }
  }

  /** Resolve a field's card metadata (icon + label key). */
  cardFor(type: CustomFieldType): FieldTypeCard {
    return findFieldTypeCard(type);
  }

  /** Pretty-print a field-type card icon — used in the "Field type" row. */
  iconHtml(type: CustomFieldType): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(findFieldTypeCard(type).icon);
  }

  /** True for types whose value is stored as a string + capped by `charLimit`. */
  isTextual(type: CustomFieldType): boolean {
    return (TEXTUAL_TYPES as readonly string[]).includes(type);
  }

  // ─── Default-value adapters (date / datetime / time) ───────────────────
  // The persisted shape is a single string:
  //   • date     → "YYYY-MM-DD"
  //   • datetime → "YYYY-MM-DDTHH:mm"
  //   • time     → "HH:mm"
  // The pickers want their own native types, so the four helpers below
  // bridge between the canonical string on the field and what the
  // <app-date-picker> / <app-time-picker> bind to.

  /** Pull a `Date` from the date portion of `defaultValue`.
   *  For `datetime` types, the time portion is folded back in too so
   *  the date-picker's `showTime` stepper shows the previously-saved
   *  hour/minute. */
  dateValueOf(f: CustomField): Date | null {
    const v = typeof f.defaultValue === 'string' ? f.defaultValue : '';
    if (!v) return null;
    const datePart = v.includes('T') ? v.split('T')[0] : v;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    // Construct via local time so the picker shows the same calendar day
    // the user typed. `new Date('2026-04-27')` would parse as UTC and
    // shift in negative-offset zones.
    const [y, m, d] = datePart.split('-').map(Number);
    const out = new Date(y, m - 1, d);
    if (Number.isNaN(out.getTime())) return null;
    // Datetime-shaped value → fold in HH:mm so the picker's time
    // stepper opens to the saved time instead of midnight.
    if (v.includes('T')) {
      const [hStr = '0', mStr = '0'] = v.split('T')[1].split(':');
      out.setHours(parseInt(hStr, 10) || 0, parseInt(mStr, 10) || 0, 0, 0);
    }
    return out;
  }

  /** Pull the `HH:mm` portion. For pure `time` it's the whole value. */
  timeValueOf(f: CustomField): string {
    const v = typeof f.defaultValue === 'string' ? f.defaultValue : '';
    if (!v) return '';
    if (f.type === 'time') return v;
    const idx = v.indexOf('T');
    return idx >= 0 ? v.slice(idx + 1, idx + 6) : '';
  }

  /** Set the date portion — for `datetime`, also reads the time off the
   *  picker's Date (it carries hour/minute when `showTime` is on). */
  setDate(f: CustomField, d: Date | null): void {
    if (!d) {
      // Clearing the date on a datetime should just clear the whole
      // value — a half-empty "Tnn:nn" string would round-trip as
      // garbage on the entity form.
      this.patch(f.id, 'defaultValue', '');
      return;
    }
    const datePart =
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    if (f.type === 'datetime') {
      const timePart = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      this.patch(f.id, 'defaultValue', `${datePart}T${timePart}`);
    } else {
      this.patch(f.id, 'defaultValue', datePart);
    }
  }

  /** Set the time portion — preserves an existing date on `datetime`. */
  setTime(f: CustomField, time: string): void {
    if (f.type === 'time') {
      this.patch(f.id, 'defaultValue', time ?? '');
      return;
    }
    const v = typeof f.defaultValue === 'string' ? f.defaultValue : '';
    const datePart = v.includes('T') ? v.split('T')[0] : v;
    if (!time) {
      this.patch(f.id, 'defaultValue', datePart || '');
      return;
    }
    this.patch(f.id, 'defaultValue', datePart ? `${datePart}T${time}` : `T${time}`);
  }

  duplicate(f: CustomField): void {
    const dup: CustomField = this.attachUi({
      ...clone(f),
      id:       newId(),
      name:     f.name + ' (copy)',
      abbr:     uniqueSlug(f.abbr || 'field', this.active()),
      isOpened: true,
    });
    this.active.update((list) => [...list, dup]);
  }

  remove(id: string): void {
    const idx = this.active().findIndex((f) => f.id === id);
    if (idx < 0) return;
    const removed = this.active()[idx];
    const tombstone: CustomField = {
      ...stripUi(removed),
      isDeleted: true,
      deletedAt: new Date().toISOString(),
    };
    this.active.update((list) => list.filter((_, i) => i !== idx));
    this.deleted.update((list) => [tombstone, ...list]);
  }

  restore(id: string): void {
    const idx = this.deleted().findIndex((f) => f.id === id);
    if (idx < 0) return;
    const restored: CustomField = this.attachUi({
      ...this.deleted()[idx],
      isDeleted: false,
      deletedAt: null,
    });
    this.deleted.update((list) => list.filter((_, i) => i !== idx));
    this.active.update((list) => [...list, restored]);
  }

  drop(event: CdkDragDrop<CustomField[]>): void {
    const list = [...this.active()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.active.set(list);
  }

  // ─── Options (select type) ─────────────────────────────────────────────
  addOption(id: string): void {
    this.active.update((list) =>
      list.map((f) => {
        if (f.id !== id) return f;
        const opts = [...(f.customOptions ?? [])];
        opts.push({ label: '', value: '' });
        return { ...f, customOptions: opts };
      }),
    );
  }

  patchOption(
    id: string,
    optIdx: number,
    key: keyof CustomFieldOption,
    value: string,
  ): void {
    this.active.update((list) =>
      list.map((f) => {
        if (f.id !== id) return f;
        const opts = [...(f.customOptions ?? [])];
        if (!opts[optIdx]) return f;
        opts[optIdx] = { ...opts[optIdx], [key]: value };
        return { ...f, customOptions: opts };
      }),
    );
  }

  removeOption(id: string, optIdx: number): void {
    this.active.update((list) =>
      list.map((f) => {
        if (f.id !== id) return f;
        const opts = (f.customOptions ?? []).filter((_, i) => i !== optIdx);
        return { ...f, customOptions: opts };
      }),
    );
  }

  // ─── Save / cancel ─────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.isValid()) return;
    this.saving.set(true);
    try {
      const payload: CustomField[] = [
        ...this.active().map(stripUi),
        ...this.deleted().map(stripUi),
      ];
      const ok = await this.service.save(this.entity().type, payload);
      if (ok) {
        this.service.invalidate(this.entity().type);
        this.router.navigate(['/settings/custom-fields']);
      }
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    // Revert to snapshot if dirty, otherwise just leave.
    this.active.set(this.snapshot.active.map(this.attachUi));
    this.deleted.set(this.snapshot.deleted.map(clone));
    this.router.navigate(['/settings/custom-fields']);
  }

  // ─── Internal ──────────────────────────────────────────────────────────
  /** Decorate a domain field with the UI flags we don't persist. */
  private attachUi = (f: CustomField): CustomField => ({
    ...f,
    activeTab: f.activeTab ?? 'general',
    isOpened:  f.isOpened  ?? false,
  });
}

// ─── Free helpers ────────────────────────────────────────────────────────
function newId(): string {
  return 'tmp_' + Math.random().toString(36).slice(2, 10);
}

function pad2(n: number): string { return n < 10 ? '0' + n : String(n); }

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function stripUi(f: CustomField): CustomField {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { activeTab, isOpened, ...rest } = f;
  return rest;
}

function uniqueSlug(base: string, list: CustomField[]): string {
  const seen = new Set(list.map((f) => f.abbr.trim().toLowerCase()));
  let n = 2;
  let candidate = `${base}_${n}`;
  while (seen.has(candidate)) {
    n += 1;
    candidate = `${base}_${n}`;
  }
  return candidate;
}
