export type NotificationChannel = 'sms' | 'email' | 'whatsapp';

export interface ChannelConfig {
  templateId: string | null;
}

export interface NotificationRecipients {
  /** Send to the customer tied to the event (e.g. the one who placed the order). */
  customer: boolean;
  /** Specific employee IDs that should also receive this notification. */
  employeeIds: string[];
}

export interface NotificationEvent {
  /** Matches the backend's `eventType` — a stable slug, e.g. `order_created`. */
  id: string;
  name: string;
  description: string;
  categoryId: string;
  enabled: boolean;
  recipients: NotificationRecipients;
  primaryChannel: NotificationChannel | null;
  fallbackChannel: NotificationChannel | null;
  channels: Record<NotificationChannel, ChannelConfig>;
}

export interface NotificationCategory {
  id: string;
  name: string;
  icon: string;
}

/** Verified against InvoCloudBack `NotificationEvents` table — field names match exactly. */
export interface RawNotificationEvent {
  eventType: string;
  enabled: boolean;
  primaryChannel: NotificationChannel | null;
  primaryTemplateId: string | null;
  fallbackChannel: NotificationChannel | null;
  fallbackTemplateId: string | null;
  sendToCustomer: boolean;
  recipientEmployeeIds: string[];
}
