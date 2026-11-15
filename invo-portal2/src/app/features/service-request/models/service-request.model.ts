/**
 * A service request ("paging") template: the call-for-service a guest can send from the table (e.g. "Request the bill").
 * Backed by the company notification templates (`accounts/*NotificationTemplate*`): the backend persists `body`, `icon`
 * and `extraData` only.
 */
export interface ServiceRequest {
  id: string;
  title: string;
  icon: string;
  body: string;
  extraData: Record<string, unknown>;
}

export const DEFAULT_SERVICE_ICON = '🛎️';

/** The legacy form pre-selects the bell for a new request. */
export const emptyServiceRequest = (): ServiceRequest => ({ id: '', title: '', icon: DEFAULT_SERVICE_ICON, body: '', extraData: {} });

/** Backend `NotificationTemplateSchema`: `body` is required with `minLength: 3`. */
export const SERVICE_BODY_MIN = 3;

export interface ServiceRequestListParams {
  page: number;
  limit: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: 'asc' | 'desc' };
}

export interface ServiceRequestListResult {
  list: ServiceRequest[];
  count: number;
  pageCount: number;
}
