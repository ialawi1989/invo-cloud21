import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http';
import { MessageTemplate, TemplateEventsBundle } from './message-template.types';

/**
 * Wraps the `templates/*` endpoints (InvoCloudBack `src/routes/v1/template`).
 * The backend stores a template's body/sample data as flat `templateBody`/
 * `sampleData` fields; the frontend nests them under `template[0]` — this
 * service is the only place that knows about that flattening, mirroring the
 * legacy `TemplatesService`.
 */
@Injectable({ providedIn: 'root' })
export class MessageTemplatesService {
  private api = inject(ApiService);

  async getTemplates(): Promise<MessageTemplate[]> {
    const res = await this.api.request<any[]>(this.api.get('templates/templates'));
    const body: any = res;
    const list: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    return list.map(r => this.fromBackend(r));
  }

  async getTemplateById(id: string): Promise<MessageTemplate> {
    const res = await this.api.request<any>(this.api.get(`templates/templates/${id}`));
    const body: any = res;
    return this.fromBackend(body?.data ?? body);
  }

  async createTemplate(template: MessageTemplate): Promise<void> {
    await this.api.request(this.api.post('templates/templates', this.toBackend(template)));
  }

  async updateTemplate(template: MessageTemplate): Promise<void> {
    await this.api.request(this.api.put(`templates/templates/${template.id}`, this.toBackend(template)));
  }

  async getTemplateEventTypes(): Promise<TemplateEventsBundle> {
    const res = await this.api.request<TemplateEventsBundle>(this.api.get('templates/event-types'));
    const body: any = res;
    return (body?.data ?? body) as TemplateEventsBundle ?? { events: [], commonVariables: [] };
  }

  /** Server-side render — avoids reimplementing the template engine client-side. */
  async renderTemplate(template: string, templateData: unknown): Promise<string> {
    const res = await this.api.request<string>(
      this.api.post('templates/templates-render', { template, templateData }),
    );
    const body: any = res;
    return typeof body === 'string' ? body : (body?.data ?? '');
  }

  private fromBackend(raw: any): MessageTemplate {
    return {
      id: raw.id,
      title: raw.title ?? '',
      type: raw.type ?? 'custom',
      eventType: raw.eventType ?? null,
      outputType: raw.outputType ?? 'text',
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy,
      template: [{
        template: raw.templateBody ?? '',
        sample: [{ sampleName: raw.title ?? '', sampleData: raw.sampleData ?? {} }],
      }],
    };
  }

  private toBackend(t: MessageTemplate): any {
    const content = t.template[0];
    return {
      id: t.id,
      title: t.title,
      type: t.type,
      eventType: t.eventType,
      outputType: t.outputType,
      templateBody: content?.template ?? '',
      sampleData: content?.sample?.[0]?.sampleData ?? {},
    };
  }
}
