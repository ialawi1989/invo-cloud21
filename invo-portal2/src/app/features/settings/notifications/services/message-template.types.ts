export type TemplateOutputType = 'text' | 'HTML' | 'markdown';

export interface TemplateSample {
  sampleName: string;
  sampleData: Record<string, unknown>;
}

export interface TemplateContent {
  template: string;
  sample: TemplateSample[];
}

export interface MessageTemplate {
  id: string;
  title: string;
  /** Free-form category the backend stores — kept opaque, not user-editable here. */
  type: string;
  /** null = generic, usable by any event of a matching output type. */
  eventType: string | null;
  outputType: TemplateOutputType;
  /** Always exactly one entry — the array shape is what the backend expects. */
  template: TemplateContent[];
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TemplateVariable {
  /** Dot-path used inside `{{ }}`, e.g. `customer.name`. */
  token: string;
  label: string;
  description?: string;
  group: string;
  sample?: unknown;
}

export interface TemplateEventType {
  id: string;
  name: string;
  category: string;
  variables: TemplateVariable[];
}

export interface TemplateEventsBundle {
  events: TemplateEventType[];
  commonVariables: TemplateVariable[];
}
