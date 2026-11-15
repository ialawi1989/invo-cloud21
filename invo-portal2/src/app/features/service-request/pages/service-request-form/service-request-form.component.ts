import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import type { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { ToastService } from '@shared/components/toast/toast.service';

import '../../service-request-i18n';
import { ServiceIconPickerComponent } from '../../components/icon-picker/service-icon-picker.component';
import { SERVICE_BODY_MIN, ServiceRequest, emptyServiceRequest } from '../../models/service-request.model';
import { ServiceRequestService } from '../../services/service-request.service';

/**
 * Service requests -> create / edit (`/paging/new`, `/paging/:id`). Legacy `ServiceRequestFormComponent`: the request
 * text (required) and its icon. Saving toasts and goes back to the list.
 */
@Component({
  selector: 'app-service-request-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BreadcrumbsComponent, EmptyStateComponent, LoadingOverlayComponent, ServiceIconPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-request-form.component.html',
  styleUrl: './service-request-form.component.scss',
})
export class ServiceRequestFormComponent implements OnInit, CanLeaveComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private service = inject(ServiceRequestService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly notFound = signal(false);
  readonly touched = signal(false);
  readonly doc = signal<ServiceRequest>(emptyServiceRequest());
  private clean = signal('');
  private saved = false;

  readonly isNew = computed(() => !this.doc().id);
  readonly bodyMissing = computed(() => this.doc().body.trim().length < SERVICE_BODY_MIN);
  readonly canSave = computed(() => !this.bodyMissing() && !!this.doc().icon && !this.saving());
  readonly breadcrumbs = signal<BreadcrumbItem[]>([]);
  readonly bodyMin = SERVICE_BODY_MIN;

  hasUnsavedChanges(): boolean { return !this.saved && JSON.stringify(this.doc()) !== this.clean(); }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('service-request');
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new' && id !== '0') {
      this.loading.set(true);
      try {
        const d = await this.service.getById(id);
        if (d) this.doc.set(d.icon ? d : { ...d, icon: emptyServiceRequest().icon });
        else this.notFound.set(true);
      } catch {
        this.notFound.set(true);
      } finally {
        this.loading.set(false);
      }
    }
    this.clean.set(JSON.stringify(this.doc()));
    this.breadcrumbs.set([
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: this.translate.instant('SERVICE_REQUEST.TITLE'), routerLink: '/paging' },
      { label: this.translate.instant(this.isNew() ? 'SERVICE_REQUEST.FORM_NEW' : 'SERVICE_REQUEST.FORM_EDIT') },
    ]);
  }

  setBody(v: string): void { this.doc.update(d => ({ ...d, body: v })); }
  setIcon(v: string): void { this.doc.update(d => ({ ...d, icon: v })); }

  async save(): Promise<void> {
    this.touched.set(true);
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const res = await this.service.save({ ...this.doc(), body: this.doc().body.trim() });
      if (res?.success) {
        this.saved = true;
        this.toast.success('SERVICE_REQUEST.SAVED');
        void this.router.navigate(['/paging']);
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' && res.msg ? res.msg : this.lang.instant('SERVICE_REQUEST.SAVE_FAILED'));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? this.lang.instant('SERVICE_REQUEST.SAVE_FAILED'));
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void { void this.router.navigate(['/paging']); }
}
