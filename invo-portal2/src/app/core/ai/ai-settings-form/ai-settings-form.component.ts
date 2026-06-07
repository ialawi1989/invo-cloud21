import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { AiService } from '../ai.service';
import {
  AiProviderId,
  AiProviderSpec,
  AiSettings,
  AiSettingsPayload,
} from '../ai.types';

/**
 * Reusable Content AI settings form — provider preset dropdown (with
 * baseUrl/model autofill), API-key field with stored-key preservation,
 * and an enable toggle. Shared by the Plugins → Content AI page
 * (company level) and the user profile override (employee level); the
 * parent owns the load + save endpoints and passes the current settings
 * in, receiving a validated `AiSettingsPayload` out via `(save)`.
 */
@Component({
  selector: 'app-ai-settings-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../../../features/settings/plugins/pages/forms/plugin-fields.scss'],
  templateUrl: './ai-settings-form.component.html',
})
export class AiSettingsFormComponent implements OnInit {
  private ai = inject(AiService);

  /** Current settings (from GET). When `apiKeySet` is true the key
   *  input is hidden behind a "Replace key" toggle. */
  @Input({ required: true }) settings!: AiSettings;

  @Output() dirtyChange = new EventEmitter<boolean>();

  providers = signal<AiProviderSpec[]>([]);
  /** Server-provided "Custom" entry — its label comes from the API so
   *  nothing about the provider list is hardcoded on the client. */
  customOption = signal<{ id: AiProviderId; label: string }>({ id: 'custom', label: 'Custom' });
  submitted = signal(false);

  // Editable model — seeded from `settings` on init.
  provider = signal<AiProviderId | null>(null);
  baseUrl  = signal('');
  model    = signal('');
  apiKey   = signal('');
  enabled  = signal(false);
  /** When a key is already stored, the input is hidden until the user
   *  opts to replace it. */
  replacingKey = signal(false);

  errProvider = signal(false);
  errCustom   = signal(false);

  /** Dropdown options = known providers + the server's "Custom" entry.
   *  Stored in a signal (not a computed) so option object identities are
   *  stable — the dropdown's `[value]` must reference the same instance
   *  that's in `[items]` for the selection to highlight. */
  options = signal<{ id: AiProviderId; label: string }[]>([]);
  optionLabel = (o: { id: AiProviderId; label: string }) => o.label;
  /** Compare by id — the dropdown emits/holds the full option object. */
  optionEquals = (a: { id: AiProviderId } | null, b: { id: AiProviderId } | null) =>
    (a?.id ?? null) === (b?.id ?? null);

  /** The option object matching the current provider id (for `[value]`). */
  selectedOption = computed(() => this.options().find(o => o.id === this.provider()) ?? null);

  /** Per-provider help links — where to generate an API key and how to
   *  pick a model. The provider *list* still comes from the endpoint;
   *  these are static documentation pointers for UX guidance only. */
  private readonly providerHelpLinks: Record<string, { keys: string; models: string }> = {
    deepseek:   { keys: 'https://platform.deepseek.com/api_keys',  models: 'https://api-docs.deepseek.com/quick_start/pricing' },
    groq:       { keys: 'https://console.groq.com/keys',           models: 'https://console.groq.com/docs/models' },
    openai:     { keys: 'https://platform.openai.com/api-keys',    models: 'https://platform.openai.com/docs/models' },
    gemini:     { keys: 'https://aistudio.google.com/app/apikey',  models: 'https://ai.google.dev/gemini-api/docs/models' },
    openrouter: { keys: 'https://openrouter.ai/keys',              models: 'https://openrouter.ai/models' },
  };
  providerHelp = computed(() => this.providerHelpLinks[this.provider() ?? ''] ?? null);

  get keyStored(): boolean { return this.settings?.apiKeySet ?? false; }
  get isCustom(): boolean { return this.provider() === 'custom'; }
  get showKeyInput(): boolean { return !this.keyStored || this.replacingKey(); }

  async ngOnInit(): Promise<void> {
    this.provider.set(this.settings.provider);
    this.baseUrl.set(this.settings.baseUrl);
    this.model.set(this.settings.model);
    this.enabled.set(this.settings.enabled);
    const res = await this.ai.getProviders();
    this.providers.set(res.providers);
    const custom = res.custom?.id
      ? { id: res.custom.id as AiProviderId, label: res.custom.label }
      : { id: 'custom' as AiProviderId, label: 'Custom' };
    this.customOption.set(custom);
    this.options.set([
      ...res.providers.map(p => ({ id: p.id as AiProviderId, label: p.label })),
      custom,
    ]);

    // Default selection when the company hasn't configured a provider
    // yet: prefer Groq, else the first available provider. Autofills its
    // base URL + model so the form is ready to key + save.
    if (!this.provider()) {
      const fallback = res.providers.find(p => p.id === 'groq') ?? res.providers[0];
      if (fallback) this.onProviderChange({ id: fallback.id as AiProviderId });
    }
  }

  /** The dropdown emits the full option object — extract its id and
   *  autofill base URL + default model from the matching provider spec. */
  onProviderChange(opt: { id: AiProviderId } | null): void {
    const id = opt?.id ?? null;
    this.provider.set(id);
    const spec = this.providers().find(p => p.id === id);
    if (spec) {
      this.baseUrl.set(spec.baseUrl);
      this.model.set(spec.defaultModel);
    }
    this.touch();
  }

  keyHint(): string {
    return this.providers().find(p => p.id === this.provider())?.keyHint ?? '';
  }

  toggleReplaceKey(): void {
    this.replacingKey.update(v => !v);
    if (!this.replacingKey()) this.apiKey.set('');
    this.touch();
  }

  touch(): void { this.dirtyChange.emit(true); }

  private validate(): boolean {
    this.errProvider.set(!this.provider());
    this.errCustom.set(
      this.isCustom && (!this.baseUrl().trim() || !this.model().trim()),
    );
    return !this.errProvider() && !this.errCustom();
  }

  /** Build a payload for the parent to POST. Returns null if invalid. */
  buildPayload(): AiSettingsPayload | null {
    this.submitted.set(true);
    if (!this.validate()) return null;
    const payload: AiSettingsPayload = {
      provider: this.provider(),
      baseUrl:  this.baseUrl().trim(),
      model:    this.model().trim(),
      enabled:  this.enabled(),
    };
    // Only send the key when the user actually typed one — preserves
    // the stored key otherwise.
    if (this.showKeyInput && this.apiKey().trim()) {
      payload.apiKey = this.apiKey().trim();
    }
    return payload;
  }

  /** Reseed after a successful save (clears the typed key). */
  reset(next: AiSettings): void {
    this.settings = next;
    this.apiKey.set('');
    this.replacingKey.set(false);
    this.submitted.set(false);
    this.provider.set(next.provider);
    this.baseUrl.set(next.baseUrl);
    this.model.set(next.model);
    this.enabled.set(next.enabled);
    this.dirtyChange.emit(false);
  }
}
