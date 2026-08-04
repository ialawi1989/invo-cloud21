import { ReportTemplate } from '../core/types/template.types';

export interface RenderInput {
  template: ReportTemplate;
  data: Record<string, unknown>;
  /** Custom variables (tenant info, current user, environment). */
  vars?: Record<string, unknown>;
  /** Override the template's locale. */
  locale?: string;
}

export interface Renderer<TOutput> {
  render(input: RenderInput): TOutput;
}
