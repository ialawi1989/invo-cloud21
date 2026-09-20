import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationEvent,
  RawNotificationEvent,
} from './notification-settings.types';

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  { id: 'orders', name: 'NOTIFICATIONS_SETTINGS.CATEGORY.ORDERS', icon: 'receipt' },
  { id: 'reservations', name: 'NOTIFICATIONS_SETTINGS.CATEGORY.RESERVATIONS', icon: 'calendar' },
  { id: 'appointments', name: 'NOTIFICATIONS_SETTINGS.CATEGORY.APPOINTMENTS', icon: 'calendar-check' },
  { id: 'payments', name: 'NOTIFICATIONS_SETTINGS.CATEGORY.PAYMENTS', icon: 'credit-card' },
];

/**
 * Hardcoded event catalog — the backend only stores per-event overrides
 * (enabled/channels/recipients), not the event's identity/description, so
 * the catalog itself lives on the frontend, same as legacy.
 */
function seedEvents(): NotificationEvent[] {
  const make = (
    id: string,
    name: string,
    description: string,
    categoryId: string,
    primary: NotificationChannel | null,
    fallback: NotificationChannel | null = null,
    enabled = true,
  ): NotificationEvent => ({
    id,
    name,
    description,
    categoryId,
    enabled,
    recipients: { customer: true, employeeIds: [] },
    primaryChannel: primary,
    fallbackChannel: fallback,
    channels: {
      sms: { templateId: null },
      email: { templateId: null },
      whatsapp: { templateId: null },
    },
  });

  return [
    make('order_created', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_CREATED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_CREATED.DESC', 'orders', 'email', 'sms'),
    make('order_confirmed', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_CONFIRMED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_CONFIRMED.DESC', 'orders', 'sms', 'email'),
    make('order_ready', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_READY.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_READY.DESC', 'orders', 'sms', 'email'),
    make('order_delivered', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_DELIVERED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_DELIVERED.DESC', 'orders', 'email', null),
    make('order_cancelled', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_CANCELLED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.ORDER_CANCELLED.DESC', 'orders', 'sms', 'email'),

    make('reservation_created', 'NOTIFICATIONS_SETTINGS.EVENT.RESERVATION_CREATED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.RESERVATION_CREATED.DESC', 'reservations', 'sms', 'email'),
    make('reservation_updated', 'NOTIFICATIONS_SETTINGS.EVENT.RESERVATION_UPDATED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.RESERVATION_UPDATED.DESC', 'reservations', 'sms', null),
    make('reservation_cancelled', 'NOTIFICATIONS_SETTINGS.EVENT.RESERVATION_CANCELLED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.RESERVATION_CANCELLED.DESC', 'reservations', null, null, false),

    make('appointment_created', 'NOTIFICATIONS_SETTINGS.EVENT.APPOINTMENT_CREATED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.APPOINTMENT_CREATED.DESC', 'appointments', 'sms', 'email'),
    make('appointment_updated', 'NOTIFICATIONS_SETTINGS.EVENT.APPOINTMENT_UPDATED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.APPOINTMENT_UPDATED.DESC', 'appointments', 'sms', null),
    make('appointment_cancelled', 'NOTIFICATIONS_SETTINGS.EVENT.APPOINTMENT_CANCELLED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.APPOINTMENT_CANCELLED.DESC', 'appointments', 'sms', 'email'),

    make('payment_received', 'NOTIFICATIONS_SETTINGS.EVENT.PAYMENT_RECEIVED.NAME', 'NOTIFICATIONS_SETTINGS.EVENT.PAYMENT_RECEIVED.DESC', 'payments', 'email', null),
  ];
}

@Injectable({ providedIn: 'root' })
export class NotificationSettingsService {
  private api = inject(ApiService);

  /** Merges saved backend overrides onto the hardcoded event catalog. */
  async getEvents(): Promise<NotificationEvent[]> {
    const seeded = seedEvents();
    let raw: RawNotificationEvent[] = [];
    try {
      const res = await this.api.request<RawNotificationEvent[]>(this.api.get('notification-settings/notification-settings'));
      // The endpoint may return a bare array or `{ data: [...] }` — handle both.
      const body: any = res;
      raw = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    } catch {
      return seeded;
    }
    if (!Array.isArray(raw) || raw.length === 0) return seeded;

    const savedByType = new Map(raw.map(r => [r.eventType, r]));
    return seeded.map(event => {
      const saved = savedByType.get(event.id);
      if (!saved) return event;

      const channels = { ...event.channels };
      if (saved.primaryChannel && channels[saved.primaryChannel]) {
        channels[saved.primaryChannel] = { templateId: saved.primaryTemplateId };
      }
      if (saved.fallbackChannel && channels[saved.fallbackChannel]) {
        channels[saved.fallbackChannel] = { templateId: saved.fallbackTemplateId };
      }

      return {
        ...event,
        enabled: saved.enabled,
        primaryChannel: saved.primaryChannel,
        fallbackChannel: saved.fallbackChannel,
        recipients: { customer: saved.sendToCustomer, employeeIds: saved.recipientEmployeeIds ?? [] },
        channels,
      };
    });
  }

  async saveEvents(events: NotificationEvent[]): Promise<void> {
    const payload: RawNotificationEvent[] = events.map(e => ({
      eventType: e.id,
      enabled: e.enabled,
      primaryChannel: e.primaryChannel,
      primaryTemplateId: e.primaryChannel ? (e.channels[e.primaryChannel]?.templateId ?? null) : null,
      fallbackChannel: e.fallbackChannel,
      fallbackTemplateId: e.fallbackChannel ? (e.channels[e.fallbackChannel]?.templateId ?? null) : null,
      sendToCustomer: e.recipients.customer,
      recipientEmployeeIds: e.recipients.employeeIds,
    }));
    await this.api.call(this.api.post('notification-settings/notification-settings', payload));
  }
}
