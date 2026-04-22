import crypto from 'crypto';

/**
 * Client for calling the API Portal with HMAC-SHA256 signed requests.
 *
 * Usage (on Invo's side):
 *
 *   const client = new ApiPortalClient();
 *   await client.updateOrder('order-uuid', { status: 4, kitchen_notes: 'Ready' });
 *
 * Environment variables:
 *   API_PORTAL_URL       - Base URL of the API Portal (e.g., https://api.example.com)
 *   INVO_CALLBACK_SECRET - Shared HMAC secret (must match the API Portal's INVO_CALLBACK_SECRET)
 */
export class ApiPortalClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(baseUrl?: string, secret?: string) {
    this.baseUrl = (baseUrl || process.env.API_PORTAL_URL || '').replace(/\/+$/, '');
    this.secret = secret || process.env.INVO_CALLBACK_SECRET || '';

    if (!this.baseUrl) {
      throw new Error('ApiPortalClient: API_PORTAL_URL environment variable is required');
    }
    if (!this.secret) {
      throw new Error('ApiPortalClient: INVO_CALLBACK_SECRET environment variable is required');
    }
  }

  /**
   * Sign and send a request to the API Portal.
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = body ? JSON.stringify(body) : '';

    // Build signing payload: timestamp.body
    const signingPayload = `${timestamp}.${rawBody}`;

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(signingPayload)
      .digest('hex');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-Signature': `sha256=${signature}`,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: rawBody || undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`API Portal ${method} ${path} failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Update an order on the API Portal.
   *
   * @param orderId - The order UUID
   * @param updates - Fields to update (reference, status, delivery_status, kitchen_notes, etc.)
   * @returns The updated order wrapped in { data: Order }
   */
  async updateOrder(orderId: string, updates: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', `/api/qrpos/v1/orders/${orderId}`, updates);
  }
}
