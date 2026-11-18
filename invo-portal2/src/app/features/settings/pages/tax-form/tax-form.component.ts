import { DragIconComponent } from '@shared/components/drag-icon/drag-icon.component';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { FormSkeletonComponent } from '@shared/components/skeleton/form-skeleton.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { TaxSettingsService } from '../../services/tax-settings.service';

interface ChildTax { taxId: string; name: string; taxPercentage: number; }
interface TaxOption { id: string; name: string; taxPercentage: number; }

/**
 * Settings > Tax Setting > Manage Tax > Add / Edit tax (`/settings/tax/new`, `/settings/tax/:id`).
 *
 * A tax is either a single rate or a GROUP of other (non-group) taxes, applied `flat` (each on the base amount) or
 * `stacked` (each on the previous result), in the order listed. The group's percentage is the sum of its children;
 * the backend recalculates it on save. Calls: `accounts/getTaxById/:id`, `accounts/getChildTaxes` (the taxes that can
 * be a child: not groups, and not the tax being edited) and `accounts/saveTax` (add when no `id`, edit otherwise).
 */
@Component({
  selector: 'app-tax-form',
  standalone: true,
  imports: [DragIconComponent, 
    CommonModule, RouterModule, FormsModule, ReactiveFormsModule, TranslateModule, CdkDropList, CdkDrag, CdkDragHandle,
    BreadcrumbsComponent, LoadingOverlayComponent, FormStickyFooterComponent, FormSkeletonComponent, SearchDropdownComponent, ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tax-form.component.html',
  styleUrl: './tax-form.component.scss',
})
export class TaxFormComponent implements OnInit, CanLeaveComponent {
  private fb         = inject(FormBuilder);
  private service    = inject(TaxSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private toast      = inject(ToastService);
  private modal      = inject(ModalService);

  readonly id = this.route.snapshot.paramMap.get('id');
  isNew = signal(!this.id);
  loading = signal(false);
  saving = signal(false);
  private done = false;
  private i18nTick = signal(0);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    percentage: [0, [Validators.required, Validators.min(0)]],
  });

  isGroup = signal(false);
  taxType = signal<'flat' | 'stacked'>('flat');
  children = signal<ChildTax[]>([]);
  /** Every tax that may be a child (loaded once). */
  private candidates = signal<TaxOption[]>([]);
  picked = signal<TaxOption[]>([]);
  availableChildren = computed(() => {
    const used = new Set(this.children().map(c => c.taxId));
    return this.candidates().filter(t => !used.has(t.id));
  });
  totalPercentage = computed(() => +this.children().reduce((t, c) => t + (Number(c.taxPercentage) || 0), 0).toFixed(4));

  readonly typeOptions = [{ value: 'flat' }, { value: 'stacked' }];
  readonly typeLabel = (o: { value: string }) => this.translate.instant(o.value === 'flat' ? 'SETTINGS.TAX.TYPE_FLAT' : 'SETTINGS.TAX.TYPE_STACKED');
  readonly sameType = (a: { value: string }, b: { value: string }) => a?.value === b?.value;
  readonly childLabel = (t: TaxOption) => `${t.name} (${t.taxPercentage}%)`;
  readonly sameChild = (a: TaxOption, b: TaxOption) => a?.id === b?.id;

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    const t = (k: string) => this.translate.instant(k);
    return [
      { label: t('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: t('SETTINGS.ITEMS.TAX_SETTINGS'), routerLink: '/settings/tax' },
      { label: t(this.isNew() ? 'SETTINGS.TAX.FORM_NEW' : 'SETTINGS.TAX.FORM_EDIT') },
    ];
  });

  constructor() {
    withTranslations('settings');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [tax, candidates] = await Promise.all([
        this.id ? this.service.getTaxById(this.id) : Promise.resolve(null),
        this.service.getChildTaxes(this.id),
      ]);
      this.candidates.set(candidates);
      if (tax) {
        // The default tax cannot be edited (same as the list, which does not offer it).
        if (tax.default) { void this.router.navigate(['/settings/tax']); return; }
        const kids: any[] = Array.isArray(tax.taxes) ? [...tax.taxes].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) : [];
        this.form.patchValue({ name: tax.name ?? '', percentage: Number(tax.taxPercentage) || 0 });
        this.isGroup.set(kids.length > 0);
        this.taxType.set(tax.taxType === 'stacked' ? 'stacked' : 'flat');
        this.children.set(kids.map(k => {
          const known = candidates.find(c => c.id === k.taxId);
          return { taxId: k.taxId, name: known?.name ?? k.name ?? '', taxPercentage: Number(known?.taxPercentage ?? k.taxPercentage) || 0 };
        }));
      }
      this.form.markAsPristine();
    } catch (e: any) {
      this.toast.error('COMMON.LOAD_FAILED', e?.message);
    } finally {
      this.loading.set(false);
    }
  }

  async onGroupChange(on: boolean): Promise<void> {
    if (on) { this.isGroup.set(true); this.taxType.set('flat'); this.form.markAsDirty(); return; }
    if (this.children().length) {
      const ok = await this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        size: 'sm',
        data: { title: this.translate.instant('SETTINGS.TAX.UNGROUP_TITLE'), message: this.translate.instant('SETTINGS.TAX.UNGROUP_MESSAGE'), danger: true },
      }).afterClosed();
      if (!ok) { this.isGroup.set(true); return; }
    }
    this.children.set([]);
    this.isGroup.set(false);
    this.form.markAsDirty();
  }

  addPicked(): void {
    const add = this.picked().map(t => ({ taxId: t.id, name: t.name, taxPercentage: Number(t.taxPercentage) || 0 }));
    this.children.update(list => [...list, ...add]);
    this.picked.set([]);
    this.form.markAsDirty();
  }

  remove(taxId: string): void {
    this.children.update(list => list.filter(c => c.taxId !== taxId));
    this.form.markAsDirty();
  }

  drop(e: CdkDragDrop<ChildTax[]>): void {
    const list = [...this.children()];
    moveItemInArray(list, e.previousIndex, e.currentIndex);
    this.children.set(list);
    this.form.markAsDirty();
  }

  hasUnsavedChanges(): boolean { return this.form.dirty && !this.saving() && !this.done; }

  cancel(): void { void this.router.navigate(['/settings/tax']); }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const group = this.isGroup();
    if (this.form.controls.name.invalid || (!group && this.form.controls.percentage.invalid)) return;
    if (group && this.children().length < 1) { this.toast.error('SETTINGS.TAX.NO_CHILDREN'); return; }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      await this.service.saveTax({
        ...(this.id ? { id: this.id } : {}),
        name: v.name.trim(),
        taxPercentage: group ? this.totalPercentage() : Number(v.percentage),
        taxType: group ? this.taxType() : '',
        taxes: group ? this.children().map((c, index) => ({ index, taxId: c.taxId, taxPercentage: c.taxPercentage })) : [],
      });
      this.done = true;
      this.toast.success('COMMON.SAVED_OK');
      void this.router.navigate(['/settings/tax']);
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
