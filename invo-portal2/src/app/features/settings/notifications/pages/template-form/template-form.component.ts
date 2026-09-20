import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { MessageTemplatesService } from '../../services/message-templates.service';
import { MessageTemplate, TemplateEventType, TemplateOutputType, TemplateVariable } from '../../services/message-template.types';

interface FilterOption<T> {
  value: T;
  label: string;
  group: string;
}

/** A fresh, empty template — used both for "new" and as a safe fallback while an edit loads. */
function emptyTemplate(): MessageTemplate {
  return {
    id: '',
    title: '',
    type: 'custom',
    eventType: null,
    outputType: 'text',
    template: [{ template: '', sample: [{ sampleName: '', sampleData: {} }] }],
  };
}

@Component({
  selector: 'app-template-form',
  standalone: true,
  imports: [FormsModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-form.component.html',
  styleUrl: './template-form.component.scss',
})
export class TemplateFormComponent implements OnInit {
  private templatesSvc = inject(MessageTemplatesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  private bodyInput = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');

  templateId = signal<string | null>(null);
  isEditMode = computed(() => !!this.templateId());
  loading = signal(false);
  saving = signal(false);

  template = signal<MessageTemplate>(emptyTemplate());
  sampleDataText = signal('{}');
  sampleDataError = signal<string | null>(null);

  eventTypes = signal<TemplateEventType[]>([]);
  commonVariables = signal<TemplateVariable[]>([]);
  variableSearch = signal('');

  previewLoading = signal(false);
  previewOutput = signal('');
  previewError = signal<string | null>(null);

  outputTypes: TemplateOutputType[] = ['text', 'HTML', 'markdown'];

  // ---------- dropdown options (app-search-dropdown, never a native <select>) ----------
  readonly optionLabel = (o: FilterOption<unknown>) => o.label;
  readonly optionValue = (o: FilterOption<unknown>) => o.value;
  readonly optionCompare = (o: FilterOption<unknown>, v: unknown) => o.value === v;
  readonly optionGroup = (o: FilterOption<unknown>) => o.group;

  outputTypeOptions: FilterOption<TemplateOutputType>[] = this.outputTypes.map(o => ({ value: o, label: o, group: '' }));

  eventTypeOptions = computed<FilterOption<string | null>[]>(() => [
    { value: null, label: this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.GENERIC_OPTION'), group: this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.GENERIC_GROUP') },
    ...this.eventTypeGroups().flatMap(g => g.items.map(e => ({ value: e.id, label: e.name, group: g.category }))),
  ]);

  visibleVariables = computed<TemplateVariable[]>(() => {
    const eventId = this.template().eventType;
    const eventVars = eventId ? (this.eventTypes().find(e => e.id === eventId)?.variables ?? []) : [];
    let all = [...eventVars, ...this.commonVariables()];
    const q = this.variableSearch().trim().toLowerCase();
    if (q) all = all.filter(v => v.token.toLowerCase().includes(q) || v.label.toLowerCase().includes(q));
    return all;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    this.templateId.set(id);

    await this.loadEventTypes();

    if (id) {
      this.loading.set(true);
      try {
        const t = await this.templatesSvc.getTemplateById(id);
        this.template.set(t);
        this.sampleDataText.set(JSON.stringify(t.template[0]?.sample[0]?.sampleData ?? {}, null, 2));
      } catch {
        this.toast.error(this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.LOAD_FAILED'));
      } finally {
        this.loading.set(false);
      }
    }
  }

  private async loadEventTypes(): Promise<void> {
    try {
      const bundle = await this.templatesSvc.getTemplateEventTypes();
      this.eventTypes.set(bundle?.events ?? []);
      this.commonVariables.set(bundle?.commonVariables ?? []);
    } catch {
      this.eventTypes.set([]);
      this.commonVariables.set([]);
    }
  }

  patch(partial: Partial<MessageTemplate>): void {
    this.template.update(t => ({ ...t, ...partial }));
  }

  setBody(value: string): void {
    this.template.update(t => ({ ...t, template: [{ ...t.template[0], template: value }] }));
  }

  get body(): string {
    return this.template().template[0]?.template ?? '';
  }

  /**
   * Insert `{{token}}` at the current cursor position in the body textarea,
   * AND seed the sample-data JSON with that variable's sample value (if it
   * doesn't already have one) — without this, the user would have to
   * hand-author matching JSON for every token before Preview does anything.
   */
  insertVariable(v: TemplateVariable): void {
    const el = this.bodyInput()?.nativeElement;
    const snippet = `{{${v.token}}}`;
    if (!el) {
      this.setBody(this.body + snippet);
    } else {
      const start = el.selectionStart ?? this.body.length;
      const end = el.selectionEnd ?? this.body.length;
      const next = this.body.slice(0, start) + snippet + this.body.slice(end);
      this.setBody(next);
      queueMicrotask(() => {
        el.focus();
        const pos = start + snippet.length;
        el.setSelectionRange(pos, pos);
      });
    }

    this.mergeSampleForVariable(v);
    void this.preview();
  }

  /** Merges `v.sample` into the sample-data JSON at the dot-path `v.token`, without overwriting an existing value there. */
  private mergeSampleForVariable(v: TemplateVariable): void {
    if (v.sample === undefined) return;

    let root: Record<string, any>;
    try {
      const parsed = JSON.parse(this.sampleDataText());
      root = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch {
      root = {};
    }

    const parts = v.token.split('.');
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const child = cursor[key];
      if (typeof child !== 'object' || child === null || Array.isArray(child)) {
        cursor[key] = {};
      }
      cursor = cursor[key];
    }
    const leaf = parts[parts.length - 1];
    if (!(leaf in cursor)) {
      cursor[leaf] = v.sample;
    }

    this.sampleDataText.set(JSON.stringify(root, null, 2));
  }

  variableGroups = computed<{ group: string; items: TemplateVariable[] }[]>(() => {
    const groups = new Map<string, TemplateVariable[]>();
    for (const v of this.visibleVariables()) {
      if (!groups.has(v.group)) groups.set(v.group, []);
      groups.get(v.group)!.push(v);
    }
    return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
  });

  eventTypeGroups = computed<{ category: string; items: TemplateEventType[] }[]>(() => {
    const groups = new Map<string, TemplateEventType[]>();
    for (const e of this.eventTypes()) {
      if (!groups.has(e.category)) groups.set(e.category, []);
      groups.get(e.category)!.push(e);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  });

  async preview(): Promise<void> {
    this.sampleDataError.set(null);
    this.previewError.set(null);

    let data: unknown;
    try {
      data = JSON.parse(this.sampleDataText());
    } catch {
      this.sampleDataError.set(this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.INVALID_JSON'));
      return;
    }

    this.previewLoading.set(true);
    try {
      this.previewOutput.set(await this.templatesSvc.renderTemplate(this.body, data));
    } catch {
      this.previewError.set(this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.PREVIEW_ERROR'));
    } finally {
      this.previewLoading.set(false);
    }
  }

  async save(): Promise<void> {
    const t = this.template();
    if (!t.title.trim()) {
      this.toast.error(this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.TITLE_REQUIRED'));
      return;
    }
    if (!this.body.trim()) {
      this.toast.error(this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.BODY_REQUIRED'));
      return;
    }

    let sampleData: Record<string, unknown> = {};
    try {
      sampleData = JSON.parse(this.sampleDataText());
    } catch {
      this.toast.error(this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.INVALID_JSON'));
      return;
    }

    const payload: MessageTemplate = {
      ...t,
      template: [{ template: this.body, sample: [{ sampleName: t.title, sampleData }] }],
    };

    this.saving.set(true);
    try {
      if (this.isEditMode()) {
        await this.templatesSvc.updateTemplate(payload);
      } else {
        await this.templatesSvc.createTemplate(payload);
      }
      this.toast.success(this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.SAVED'));
      this.cancel();
    } catch {
      this.toast.error(this.translate.instant('NOTIFICATIONS_SETTINGS.TEMPLATE_FORM.SAVE_FAILED'));
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/settings/notifications']);
  }
}
