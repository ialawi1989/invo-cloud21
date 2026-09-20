import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { EmployeeSummary } from '../../../../employees/models/employee.types';
import { MessageTemplate } from '../../services/message-template.types';
import { NotificationChannel, NotificationEvent } from '../../services/notification-settings.types';

interface FilterOption<T> {
  value: T;
  label: string;
}

export interface EventConfigureDrawerData {
  event: NotificationEvent;
  allChannels: NotificationChannel[];
  employees: EmployeeSummary[];
  canEdit: boolean;
  templatesForChannel: (c: NotificationChannel) => MessageTemplate[];
  providerLabel: (c: NotificationChannel) => string;
  channelLabel: (c: NotificationChannel) => string;
  categoryLabel: (id: string) => string;
  onSendTest: (e: NotificationEvent, c: NotificationChannel) => void;
}

/**
 * Per-event configuration panel — opened as a `ModalService` drawer, same
 * mechanism as the topbar's Branches/Notifications/Recent-Updates panels,
 * instead of a hand-rolled fixed-position overlay.
 *
 * Edits a LOCAL copy of the event; closes with the edited event on Save
 * (`ModalRef.close(event)`) or with no result on Cancel/backdrop-dismiss —
 * the caller applies the result and persists it.
 */
@Component({
  selector: 'app-event-configure-drawer',
  standalone: true,
  imports: [FormsModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './event-configure-drawer.component.html',
  styleUrl: './event-configure-drawer.component.scss',
})
export class EventConfigureDrawerComponent {
  private ref = inject<ModalRef<NotificationEvent>>(MODAL_REF);
  private translate = inject(TranslateService);
  data = inject<EventConfigureDrawerData>(MODAL_DATA);

  event = signal<NotificationEvent>(this.data.event);
  employeeSearch = signal('');

  // ---------- dropdown options (app-search-dropdown, never a native <select>) ----------
  readonly optionLabel = (o: FilterOption<unknown>) => o.label;
  readonly optionValue = (o: FilterOption<unknown>) => o.value;
  readonly optionCompare = (o: FilterOption<unknown>, v: unknown) => o.value === v;

  primaryChannelOptions = computed<FilterOption<NotificationChannel | null>[]>(() => [
    { value: null, label: this.translate.instant('NOTIFICATIONS_SETTINGS.SELECT_CHANNEL') },
    ...this.data.allChannels.map(c => ({ value: c, label: this.data.channelLabel(c) })),
  ]);

  fallbackChannelOptions = computed<FilterOption<NotificationChannel | null>[]>(() => [
    { value: null, label: this.translate.instant('NOTIFICATIONS_SETTINGS.NONE') },
    ...this.fallbackOptions(this.event()).map(c => ({ value: c, label: this.data.channelLabel(c) })),
  ]);

  templateOptions(c: NotificationChannel): FilterOption<string | null>[] {
    return [
      { value: null, label: this.translate.instant('NOTIFICATIONS_SETTINGS.DEFAULT_TEMPLATE') },
      ...this.data.templatesForChannel(c).map(t => ({ value: t.id, label: t.title })),
    ];
  }

  filteredEmployees = computed(() => {
    const q = this.employeeSearch().trim().toLowerCase();
    if (!q) return this.data.employees;
    return this.data.employees.filter(e => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));
  });

  activeChannels(e: NotificationEvent): NotificationChannel[] {
    const out: NotificationChannel[] = [];
    if (e.primaryChannel) out.push(e.primaryChannel);
    if (e.fallbackChannel && e.fallbackChannel !== e.primaryChannel) out.push(e.fallbackChannel);
    return out;
  }

  channelRole(e: NotificationEvent, c: NotificationChannel): 'primary' | 'fallback' | 'off' {
    if (e.primaryChannel === c) return 'primary';
    if (e.fallbackChannel === c) return 'fallback';
    return 'off';
  }

  fallbackOptions(e: NotificationEvent): NotificationChannel[] {
    return this.data.allChannels.filter(c => c !== e.primaryChannel);
  }

  patch(partial: Partial<NotificationEvent>): void {
    this.event.update(e => ({ ...e, ...partial }));
  }

  toggleEnabled(): void {
    this.patch({ enabled: !this.event().enabled });
  }

  onPrimaryChange(channel: NotificationChannel | null): void {
    const current = this.event();
    const fallback = current.fallbackChannel === channel ? null : current.fallbackChannel;
    this.patch({ primaryChannel: channel, fallbackChannel: channel ? fallback : null });
  }

  onTemplateChange(channel: NotificationChannel, templateId: string | null): void {
    this.patch({ channels: { ...this.event().channels, [channel]: { templateId: templateId ?? null } } });
  }

  isEmployeeSelected(id: string): boolean {
    return this.event().recipients.employeeIds.includes(id);
  }

  toggleEmployee(id: string): void {
    const current = this.event();
    const has = current.recipients.employeeIds.includes(id);
    const employeeIds = has
      ? current.recipients.employeeIds.filter(x => x !== id)
      : [...current.recipients.employeeIds, id];
    this.patch({ recipients: { ...current.recipients, employeeIds } });
  }

  sendTest(c: NotificationChannel): void {
    this.data.onSendTest(this.event(), c);
  }

  save(): void {
    this.ref.close(this.event());
  }

  cancel(): void {
    this.ref.dismiss();
  }
}
