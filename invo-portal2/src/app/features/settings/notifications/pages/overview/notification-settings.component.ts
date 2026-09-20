import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import { QueryParamsService, enumCodec, ParamDef } from '@shared/services/query-params.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { EventConfigureDrawerComponent } from '../../components/event-configure-drawer/event-configure-drawer.component';
import { EmployeeService } from '../../../../employees/services/employee.service';
import { EmployeeSummary } from '../../../../employees/models/employee.types';
import { PluginService } from '../../../plugins/services/plugin.service';
import { NOTIFICATION_CATEGORIES, NotificationSettingsService } from '../../services/notification-settings.service';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationEvent,
} from '../../services/notification-settings.types';
import { MessageTemplate } from '../../services/message-template.types';
import { MessageTemplatesService } from '../../services/message-templates.service';
import { NotificationLog, NotificationLogFilter, NotificationLogsService } from '../../services/notification-logs.service';

type Tab = 'events' | 'templates' | 'logs';
type EventStatus = 'disabled' | 'active' | 'partial' | 'needs_setup';
type StatusFilter = 'all' | 'enabled' | 'disabled' | 'issues';

interface FilterOption<T> {
  value: T;
  label: string;
}

const TAB_PARAM: ParamDef<Tab> = { key: 'tab', codec: enumCodec(['events', 'templates', 'logs'] as const, 'events') };

@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [FormsModule, TranslateModule, DatePipe, SearchDropdownComponent, DatePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-settings.component.html',
  styleUrl: './notification-settings.component.scss',
})
export class NotificationSettingsComponent implements OnInit {
  private settingsSvc = inject(NotificationSettingsService);
  private templatesSvc = inject(MessageTemplatesService);
  private logsSvc = inject(NotificationLogsService);
  private employeeSvc = inject(EmployeeService);
  private pluginSvc = inject(PluginService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private modal = inject(ModalService);
  private qp = inject(QueryParamsService);
  readonly privileges = inject(PrivilegeService);

  readonly canEdit = computed(() => this.privileges.check('notificationSettingsSecurity.actions.edit.access'));
  readonly canEditTemplates = computed(() => this.privileges.check('messageTemplatesSecurity.actions.edit.access'));

  tab = signal<Tab>(this.qp.read({ tab: TAB_PARAM }).tab);
  categories: NotificationCategory[] = NOTIFICATION_CATEGORIES;

  // ---------- filter-bar dropdown options (app-search-dropdown, never a native <select>) ----------
  readonly optionLabel = (o: FilterOption<unknown>) => o.label;
  readonly optionValue = (o: FilterOption<unknown>) => o.value;
  readonly optionCompare = (o: FilterOption<unknown>, v: unknown) => o.value === v;

  categoryOptions = computed<FilterOption<string>[]>(() => [
    { value: 'all', label: this.translate.instant('NOTIFICATIONS_SETTINGS.ALL_CATEGORIES') },
    ...this.categories.map(c => ({ value: c.id, label: this.translate.instant(c.name) })),
  ]);

  channelOptions = computed<FilterOption<NotificationChannel | 'all'>[]>(() => [
    { value: 'all', label: this.translate.instant('NOTIFICATIONS_SETTINGS.ALL_CHANNELS') },
    { value: 'sms', label: 'SMS' },
    { value: 'email', label: 'Email' },
    ...(this.whatsappEnabled() ? [{ value: 'whatsapp' as const, label: 'WhatsApp' }] : []),
  ]);

  statusOptions = computed<FilterOption<StatusFilter>[]>(() => [
    { value: 'all', label: this.translate.instant('NOTIFICATIONS_SETTINGS.ALL_STATUSES') },
    { value: 'enabled', label: this.translate.instant('NOTIFICATIONS_SETTINGS.STATUS_ENABLED') },
    { value: 'disabled', label: this.translate.instant('NOTIFICATIONS_SETTINGS.STATUS_DISABLED') },
    { value: 'issues', label: this.translate.instant('NOTIFICATIONS_SETTINGS.NEEDS_ATTENTION') },
  ]);

  // ---------- Events tab state ----------
  events = signal<NotificationEvent[]>([]);
  eventsLoading = signal(false);
  saving = signal(false);

  search = signal('');
  categoryFilter = signal('all');
  statusFilter = signal<StatusFilter>('all');
  channelFilter = signal<NotificationChannel | 'all'>('all');

  whatsappEnabled = signal(false);
  smsThirdPartyProvider = signal<string | null>(null);
  emailThirdPartyProvider = signal<string | null>(null);
  allChannels = computed<NotificationChannel[]>(() => this.whatsappEnabled() ? ['sms', 'email', 'whatsapp'] : ['sms', 'email']);

  employees = signal<EmployeeSummary[]>([]);

  async ngOnInit() {
    // Plugin state MUST resolve before events, and stay applied AFTER events
    // load: loadPluginState() strips WhatsApp from any event that has it
    // selected when the plugin is off, but that only means something once
    // `events` actually holds the backend's saved selections. Doing it once
    // up front (on an empty list) then loading events afterward would silently
    // restore a stale WhatsApp selection, so re-apply it once events are in.
    await this.loadPluginState();
    await Promise.all([this.loadEvents(), this.loadEmployees(), this.loadTemplates()]);
    if (!this.whatsappEnabled()) this.clearWhatsappFromEvents();

    // Deep-linked straight into ?tab=logs — setTab() (which fetches logs) never ran for it.
    if (this.tab() === 'logs') void this.loadLogs();
  }

  private async loadEvents() {
    this.eventsLoading.set(true);
    try {
      this.events.set(await this.settingsSvc.getEvents());
    } finally {
      this.eventsLoading.set(false);
    }
  }

  private async loadPluginState() {
    try {
      const list = await this.pluginSvc.getPlugins({ limit: 99, type: 'Notifications' });
      const waKind = (name: string) => ['whatsapp notifications', 'whatsapp infobip', 'whatsapp wasender'].includes((name || '').toLowerCase());
      const enabledWa = list.find(p => waKind(p.pluginName) && !!p.settings?.enable);
      this.whatsappEnabled.set(!!enabledWa);
      if (!enabledWa) this.clearWhatsappFromEvents();

      const smsNames = ['sms infobip', 'sms bareedsms'];
      const emailNames = ['email smtp'];
      const enabledSms = list.find(p => smsNames.includes((p.pluginName || '').toLowerCase()) && !!p.settings?.enable);
      const enabledEmail = list.find(p => emailNames.includes((p.pluginName || '').toLowerCase()) && !!p.settings?.enable);
      this.smsThirdPartyProvider.set(enabledSms?.pluginName ?? null);
      this.emailThirdPartyProvider.set(enabledEmail?.pluginName ?? null);
    } catch {
      this.whatsappEnabled.set(false);
    }
  }

  private clearWhatsappFromEvents() {
    this.events.update(list => list.map(e => ({
      ...e,
      primaryChannel: e.primaryChannel === 'whatsapp' ? null : e.primaryChannel,
      fallbackChannel: e.fallbackChannel === 'whatsapp' ? null : e.fallbackChannel,
    })));
    if (this.channelFilter() === 'whatsapp') this.channelFilter.set('all');
  }

  private async loadEmployees() {
    try {
      const res = await this.employeeSvc.getList({ page: 1, limit: 500, searchTerm: '' });
      this.employees.set(res.list.filter(e => !!e.id));
    } catch {
      this.employees.set([]);
    }
  }

  setTab(t: Tab) {
    this.tab.set(t);
    this.qp.writeOne(TAB_PARAM, t);
    if (t === 'logs' && this.logs().length === 0 && !this.logsLoading()) void this.loadLogs();
  }

  // ---------- derived (Events) ----------

  filteredGroups = computed(() => {
    const q = this.search().trim().toLowerCase();
    const catFilter = this.categoryFilter();
    const chFilter = this.channelFilter();
    const stFilter = this.statusFilter();

    const filtered = this.events().filter(e => {
      if (q) {
        const name = this.translate.instant(e.name).toLowerCase();
        const desc = this.translate.instant(e.description).toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }
      if (chFilter !== 'all' && this.channelRole(e, chFilter) === 'off') return false;
      const s = this.statusOf(e);
      if (stFilter === 'enabled' && !e.enabled) return false;
      if (stFilter === 'disabled' && e.enabled) return false;
      if (stFilter === 'issues' && s !== 'needs_setup' && s !== 'partial') return false;
      return true;
    });

    return this.categories
      .filter(c => catFilter === 'all' || catFilter === c.id)
      .map(c => ({ category: c, events: filtered.filter(e => e.categoryId === c.id) }))
      .filter(g => g.events.length > 0);
  });

  totalEventsCount = computed(() => this.events().length);
  enabledCount = computed(() => this.events().filter(e => e.enabled).length);
  issueCount = computed(() => this.events().filter(e => {
    const s = this.statusOf(e);
    return s === 'needs_setup' || s === 'partial';
  }).length);

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
    return this.allChannels().filter(c => c !== e.primaryChannel);
  }

  /** SMS/Email always have INVO's system provider as a fallback; WhatsApp only exists as a channel when its plugin is enabled. */
  channelHasProvider(c: NotificationChannel): boolean {
    return c === 'whatsapp' ? this.whatsappEnabled() : true;
  }

  statusOf(e: NotificationEvent): EventStatus {
    if (!e.enabled) return 'disabled';
    const active = this.activeChannels(e);
    if (active.length === 0) return 'needs_setup';
    const missing = active.filter(c => !this.channelHasProvider(c));
    if (missing.length === 0) return 'active';
    if (missing.length === active.length) return 'needs_setup';
    return 'partial';
  }

  /** Pill visual state: 'off' (unselected), 'warn' (selected but its provider is unavailable), or the channel's role. */
  channelStatus(e: NotificationEvent, c: NotificationChannel): 'off' | 'warn' | 'primary' | 'fallback' {
    const role = this.channelRole(e, c);
    if (role === 'off') return 'off';
    return this.channelHasProvider(c) ? role : 'warn';
  }

  statusLabelKey(e: NotificationEvent): string {
    switch (this.statusOf(e)) {
      case 'active': return 'NOTIFICATIONS_SETTINGS.STATUS_ACTIVE';
      case 'disabled': return 'NOTIFICATIONS_SETTINGS.STATUS_DISABLED';
      case 'partial': return 'NOTIFICATIONS_SETTINGS.STATUS_PARTIAL';
      case 'needs_setup': return 'NOTIFICATIONS_SETTINGS.STATUS_NEEDS_SETUP';
    }
  }

  channelIcon(c: NotificationChannel): string {
    return c === 'sms' ? 'chat' : c === 'email' ? 'mail' : 'whatsapp';
  }

  channelLabel(c: NotificationChannel): string {
    return c === 'sms' ? 'SMS' : c === 'email' ? 'Email' : 'WhatsApp';
  }

  providerLabel(c: NotificationChannel): string {
    if (c === 'whatsapp') return 'WhatsApp Plugin';
    if (c === 'sms') return this.smsThirdPartyProvider() ?? 'System Provider';
    if (c === 'email') return this.emailThirdPartyProvider() ?? 'System Provider';
    return 'System Provider';
  }

  // ---------- mutations ----------

  toggleEvent(e: NotificationEvent) {
    if (!this.canEdit()) return;
    this.events.update(list => list.map(x => x.id === e.id ? { ...x, enabled: !x.enabled } : x));
  }

  cycleChannel(e: NotificationEvent, c: NotificationChannel) {
    if (!this.canEdit()) return;
    this.events.update(list => list.map(x => {
      if (x.id !== e.id) return x;
      const role = this.channelRole(x, c);
      if (role === 'primary') return { ...x, primaryChannel: null, fallbackChannel: null };
      if (role === 'fallback') return { ...x, fallbackChannel: null };
      if (!x.primaryChannel) return { ...x, primaryChannel: c };
      return { ...x, fallbackChannel: c };
    }));
  }

  /** Decorative, matching legacy — there's no real "send a test message" backend endpoint yet, just user feedback. */
  sendTest(e: NotificationEvent, c: NotificationChannel): void {
    if (!this.channelHasProvider(c)) {
      this.toast.error(`${this.channelLabel(c)} ${this.translate.instant('NOTIFICATIONS_SETTINGS.PROVIDER_UNAVAILABLE')}`);
      return;
    }
    this.toast.success(this.translate.instant('NOTIFICATIONS_SETTINGS.TEST_SENT', { channel: this.channelLabel(c), event: this.translate.instant(e.name) }));
  }

  /** Opens the per-event configure panel as a `ModalService` drawer (same mechanism as the topbar's panels). */
  openConfigure(e: NotificationEvent): void {
    this.modal.open(EventConfigureDrawerComponent, {
      drawer: true,
      drawerWidth: '420px',
      data: {
        event: e,
        allChannels: this.allChannels(),
        employees: this.employees(),
        canEdit: this.canEdit(),
        templatesForChannel: (c: NotificationChannel) => this.templatesForChannel(c),
        providerLabel: (c: NotificationChannel) => this.providerLabel(c),
        channelLabel: (c: NotificationChannel) => this.channelLabel(c),
        categoryLabel: (id: string) => this.categoryLabel(id),
        onSendTest: (ev: NotificationEvent, c: NotificationChannel) => this.sendTest(ev, c),
      },
    }).afterClosed().then(updated => {
      if (!updated) return; // cancelled / dismissed
      this.events.update(list => list.map(x => x.id === updated.id ? updated : x));
      void this.save();
    });
  }

  templatesForChannel(c: NotificationChannel): MessageTemplate[] {
    const allowed: Record<NotificationChannel, string[]> = { sms: ['text'], whatsapp: ['text'], email: ['text', 'HTML', 'markdown'] };
    return this.templates().filter(t => allowed[c].includes(t.outputType));
  }

  async save() {
    this.saving.set(true);
    try {
      await this.settingsSvc.saveEvents(this.events());
      this.toast.success(this.translate.instant('NOTIFICATIONS_SETTINGS.SAVED'));
    } catch {
      this.toast.error(this.translate.instant('NOTIFICATIONS_SETTINGS.SAVE_FAILED'));
    } finally {
      this.saving.set(false);
    }
  }

  // ---------- Templates tab ----------
  templates = signal<MessageTemplate[]>([]);
  templatesLoading = signal(false);
  templateSearch = signal('');

  filteredTemplates = computed(() => {
    const q = this.templateSearch().trim().toLowerCase();
    if (!q) return this.templates();
    return this.templates().filter(t => t.title.toLowerCase().includes(q) || t.outputType.toLowerCase().includes(q));
  });

  private async loadTemplates() {
    this.templatesLoading.set(true);
    try {
      this.templates.set(await this.templatesSvc.getTemplates());
    } catch {
      this.templates.set([]);
    } finally {
      this.templatesLoading.set(false);
    }
  }

  reloadTemplates() {
    void this.loadTemplates();
  }

  createTemplate() {
    this.router.navigate(['/settings/notifications/templates/new']);
  }

  editTemplate(t: MessageTemplate) {
    this.router.navigate(['/settings/notifications/templates', t.id]);
  }

  // ---------- Logs tab ----------
  logs = signal<NotificationLog[]>([]);
  logsLoading = signal(false);
  logsHasNext = signal(false);
  logsFilter = signal<NotificationLogFilter>({ channel: '', eventType: '', status: '', from: '', to: '', limit: 50, offset: 0 });
  logsLimitOptions = [25, 50, 100, 200, 500];
  logChannelOptions: NotificationChannel[] = ['sms', 'email', 'whatsapp'];

  logChannelFilterOptions = computed<FilterOption<NotificationChannel | ''>[]>(() => [
    { value: '', label: this.translate.instant('NOTIFICATIONS_SETTINGS.ALL_CHANNELS') },
    ...this.logChannelOptions.map(c => ({ value: c, label: this.channelLabel(c) })),
  ]);

  logStatusFilterOptions = computed<FilterOption<'' | 'success' | 'failure'>[]>(() => [
    { value: '', label: this.translate.instant('NOTIFICATIONS_SETTINGS.ALL_STATUSES') },
    { value: 'success', label: this.translate.instant('NOTIFICATIONS_SETTINGS.LOG_SUCCESS') },
    { value: 'failure', label: this.translate.instant('NOTIFICATIONS_SETTINGS.LOG_FAILURE') },
  ]);

  logsLimitFilterOptions = computed<FilterOption<number>[]>(() =>
    this.logsLimitOptions.map(n => ({ value: n, label: String(n) })),
  );

  async loadLogs() {
    this.logsLoading.set(true);
    try {
      const list = await this.logsSvc.getLogs(this.logsFilter());
      this.logs.set(list);
      this.logsHasNext.set(list.length >= (this.logsFilter().limit ?? 50));
    } catch {
      this.logs.set([]);
      this.logsHasNext.set(false);
    } finally {
      this.logsLoading.set(false);
    }
  }

  patchLogsFilter(patch: Partial<NotificationLogFilter>) {
    this.logsFilter.update(f => ({ ...f, ...patch }));
  }

  /** `logsFilter().from/to` (plain `YYYY-MM-DD` wire strings) as a `DateRange` for the picker. */
  logsDateRange = computed<DateRange | null>(() => {
    const { from, to } = this.logsFilter();
    if (!from && !to) return null;
    return { start: from ? new Date(from) : null, end: to ? new Date(to) : null };
  });

  onLogsDateRange(range: DateRange | null): void {
    this.patchLogsFilter({ from: toWireDate(range?.start), to: toWireDate(range?.end) });
    this.applyLogsFilter();
  }

  applyLogsFilter() {
    this.patchLogsFilter({ offset: 0 });
    void this.loadLogs();
  }

  clearLogsFilter() {
    this.logsFilter.set({ channel: '', eventType: '', status: '', from: '', to: '', limit: 50, offset: 0 });
    void this.loadLogs();
  }

  prevLogsPage() {
    const { limit = 50, offset = 0 } = this.logsFilter();
    if (offset === 0) return;
    this.patchLogsFilter({ offset: Math.max(0, offset - limit) });
    void this.loadLogs();
  }

  nextLogsPage() {
    if (!this.logsHasNext()) return;
    const { limit = 50, offset = 0 } = this.logsFilter();
    this.patchLogsFilter({ offset: offset + limit });
    void this.loadLogs();
  }

  changeLogsLimit(limit: number) {
    this.patchLogsFilter({ limit, offset: 0 });
    void this.loadLogs();
  }

  logsPageNumber = computed(() => {
    const { limit = 50, offset = 0 } = this.logsFilter();
    return Math.floor(offset / limit) + 1;
  });

  logProviderLabel(provider: string): string {
    switch (provider) {
      case 'MetaWhatsappProvider': return 'WhatsApp (Meta)';
      case 'InfobipProvider': return 'WhatsApp (Infobip)';
      case 'EmailProvider': return 'Email';
      case 'SmsProvider': return 'SMS';
      default: return 'Unknown';
    }
  }

  categoryLabel(id: string): string {
    return this.categories.find(c => c.id === id)?.name ?? id;
  }

  trackById(_i: number, e: NotificationEvent): string { return e.id; }
  trackByTemplateId(_i: number, t: MessageTemplate): string { return t.id; }
}

/** The endpoint wants plain `YYYY-MM-DD`, in local time — not an ISO instant, which would shift the day across timezones. */
function toWireDate(d: Date | null | undefined): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
