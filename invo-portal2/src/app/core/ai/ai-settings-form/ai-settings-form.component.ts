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

import { GROQ_LIMITS } from '../ai-limits';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { AiService } from '../ai.service';
import {
  AiProviderId,
  AiProviderSpec,
  AiSettings,
  AiSettingsPayload,
} from '../ai.types';

interface ProviderPreset {
  id: string; label: string; tag: 'free' | 'paid'; note: string;
  baseUrl: string; model: string; keys: string; needsAccountId?: boolean;
}
interface ProviderCard {
  key: string; label: string; kind: 'server' | 'preset' | 'custom'; tag: 'free' | 'paid' | null; note: string;
}

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
  styles: [`
    .ai-limits { margin: 4px 0 12px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; background: #f8fafc; }
    .ai-limits summary { cursor: pointer; font-size: 13px; font-weight: 600; color: #334155; }
    .ai-limits__scroll { overflow-x: auto; margin: 10px 0 6px; }
    .ai-limits table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .ai-limits th, .ai-limits td { padding: 6px 10px; text-align: start; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .ai-limits th { color: #64748b; font-weight: 600; }
    .ai-sub { margin: 14px 0 4px; font-size: 13px; font-weight: 700; color: #334155; }
    .ai-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
    .ai-card { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 10px 12px; text-align: start;
      background: #fff; border: 1px solid #d0d5dd; border-radius: 10px; cursor: pointer; font: inherit; }
    .ai-card:hover { border-color: #2691a4; }
    .ai-card.is-selected { border-color: #2691a4; background: #ecf7f9; box-shadow: 0 0 0 1px #2691a4 inset; }
    .ai-card__name { font-weight: 600; font-size: 13.5px; color: #0f172a; }
    .ai-card__tag { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: #fef3c7; color: #92400e; }
    .ai-card__tag.is-free { background: #dcfce7; color: #166534; }
    .ai-card__note { font-size: 11.5px; color: #64748b; }
    .ai-limits code { font-size: 12px; background: #eef2f6; padding: 1px 5px; border-radius: 4px; }
  `],
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

  /** Suggested chat models per provider (Groq: https://console.groq.com/docs/models — speech, TTS and guard models
   *  left out, they can't generate content). Any other model id can still be typed via "Custom model…". */
  private readonly modelPresets: Record<string, { id: string; label: string }[]> = {
    deepseek: [
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro (deepseek-v4-pro)' },
      { id: 'deepseek-flash',  label: 'DeepSeek Flash (deepseek-flash) · cheaper, faster' },
    ],
    groq: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (llama-3.3-70b-versatile) · Free' },
      { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B Instant (llama-3.1-8b-instant) · Free' },
      { id: 'openai/gpt-oss-120b',     label: 'GPT OSS 120B (openai/gpt-oss-120b) · Free' },
      { id: 'openai/gpt-oss-20b',      label: 'GPT OSS 20B (openai/gpt-oss-20b) · Free' },
      { id: 'qwen/qwen3.8-27b',        label: 'Qwen 3.8 27B, preview (qwen/qwen3.8-27b) · Free' },
      { id: 'groq/compound',           label: 'Groq Compound (groq/compound) · Free' },
      { id: 'groq/compound-mini',      label: 'Groq Compound Mini (groq/compound-mini) · Free' },
    ],
  };
  /** Groq free-plan limits for the table (figures live in `ai-limits.ts`, shared with the usage bars). */
  readonly groqLimits = GROQ_LIMITS.map(r => {
    const n = (v: number | null) => (v == null ? '—' : v.toLocaleString('en-US'));
    return { model: r.label, rpm: n(r.rpm), rpd: n(r.rpd), tpm: n(r.tpm), tpd: r.tpdText ?? n(r.tpd) };
  });
  /** Providers the server doesn't list; choosing one fills the Custom fields so the user only pastes a key.
   *  Base URLs/models come from each provider's docs; notes are the providers' free-plan figures. */
  private readonly presets: ProviderPreset[] = [
    { id: 'cerebras',    label: 'Cerebras',              tag: 'free', note: '30 req/min · 14,400/day',  baseUrl: 'https://api.cerebras.ai/v1',                                              model: 'gpt-oss-120b',                   keys: 'https://cloud.cerebras.ai' },
    { id: 'nvidia',      label: 'NVIDIA NIM',            tag: 'free', note: '40 req/min',               baseUrl: 'https://integrate.api.nvidia.com/v1',                                     model: 'meta/llama-3.1-8b-instruct',     keys: 'https://build.nvidia.com' },
    { id: 'huggingface', label: 'Hugging Face',          tag: 'free', note: '$0.10/month credits',      baseUrl: 'https://router.huggingface.co/v1',                                        model: 'openai/gpt-oss-120b:fastest',    keys: 'https://huggingface.co/settings/tokens' },
    { id: 'cloudflare',  label: 'Cloudflare Workers AI', tag: 'free', note: '10K neurons/day',          baseUrl: 'https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1',     model: '@cf/meta/llama-3.1-8b-instruct', keys: 'https://dash.cloudflare.com/profile/api-tokens', needsAccountId: true },
    { id: 'llm7',        label: 'LLM7.io',               tag: 'free', note: '30 req/min',               baseUrl: 'https://api.llm7.io/v1',                                                  model: 'gpt-4',                          keys: 'https://dash.llm7.io' },
    { id: 'claude',      label: 'Claude (Anthropic)',    tag: 'paid', note: 'API credit, not Claude Pro', baseUrl: 'https://api.anthropic.com/v1/',                                         model: 'claude-haiku-5-5',               keys: 'https://console.anthropic.com/settings/keys' },
  ];
  /** Free / paid label for the providers the server lists. */
  private readonly serverTags: Record<string, { tag: 'free' | 'paid'; note: string }> = {
    groq:       { tag: 'free', note: '30 req/min · up to 14,400/day' },
    gemini:     { tag: 'free', note: 'Free tier' },
    openrouter: { tag: 'free', note: 'Free models: 20 req/min' },
    openai:     { tag: 'paid', note: 'API credit, not ChatGPT Plus' },
    deepseek:   { tag: 'paid', note: 'Pay as you go' },
  };

  /** Provider id of the chosen preset (null = a server provider or plain Custom). */
  presetId  = signal<string | null>(null);
  accountId = signal('');
  errAccount = signal(false);

  /** Everything the user can pick, in one grid: server providers, extra presets, then Custom. */
  cards = computed<ProviderCard[]>(() => [
    ...this.providers().map(p => ({ key: p.id, label: p.label, kind: 'server' as const, ...(this.serverTags[p.id] ?? { tag: null, note: '' }) })),
    ...this.presets.map(p => ({ key: p.id, label: p.label, kind: 'preset' as const, tag: p.tag, note: p.note })),
    { key: this.customOption().id, label: this.customOption().label, kind: 'custom' as const, tag: null, note: '' },
  ]);

  isSelected(c: ProviderCard): boolean {
    if (c.kind === 'preset') return this.presetId() === c.key;
    return this.presetId() === null && this.provider() === c.key;
  }

  selectedPreset = computed(() => this.presets.find(p => p.id === this.presetId()) ?? null);
  /** Where to create an API key for the chosen provider. */
  keysLink = computed(() => this.selectedPreset()?.keys ?? this.providerHelp()?.keys ?? null);
  /** Paid providers get a reminder that a chat subscription isn't an API key. */
  selectedTag = computed(() => this.selectedPreset()?.tag ?? this.serverTags[this.provider() ?? '']?.tag ?? null);

  selectCard(c: ProviderCard): void {
    this.errAccount.set(false);
    if (c.kind === 'server') {
      this.presetId.set(null);
      this.onProviderChange({ id: c.key as AiProviderId });
      return;
    }
    this.provider.set(this.customOption().id);
    const preset = this.presets.find(p => p.id === c.key);
    this.presetId.set(preset?.id ?? null);
    this.baseUrl.set(preset?.baseUrl ?? '');
    this.model.set(preset?.model ?? '');
    this.accountId.set('');
    this.modelCustom.set(true);
    this.touch();
  }

  /** Cloudflare's base URL embeds the account id. */
  onAccountId(v: string): void {
    this.accountId.set(v);
    const preset = this.selectedPreset();
    if (preset?.needsAccountId) this.baseUrl.set(preset.baseUrl.replace('YOUR_ACCOUNT_ID', v.trim() || 'YOUR_ACCOUNT_ID'));
    this.errAccount.set(false);
    this.touch();
  }

  /** Re-detect which preset the saved settings belong to (they're stored as Custom + base URL). */
  private inferPreset(): void {
    if (this.provider() !== 'custom') { this.presetId.set(null); return; }
    const url = this.baseUrl();
    const cf = /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/([^/]+)\/ai\/v1/.exec(url);
    if (cf) { this.presetId.set('cloudflare'); this.accountId.set(cf[1] === 'YOUR_ACCOUNT_ID' ? '' : cf[1]); return; }
    this.presetId.set(this.presets.find(p => !p.needsAccountId && p.baseUrl === url)?.id ?? null);
  }

  static readonly CUSTOM_MODEL = '__custom__';
  modelCustom = signal(false);

  /** Dropdown entries for the current provider, or null when it has no presets (plain text input). */
  modelOptions = computed(() => {
    const presets = this.modelPresets[this.provider() ?? ''];
    return presets ? [...presets, { id: AiSettingsFormComponent.CUSTOM_MODEL, label: '' }] : null;
  });
  modelLabel = (o: { id: string; label: string }) => o.label || this.customModelLabel;
  customModelLabel = 'Custom model…';
  /** A typed/saved model that isn't one of the presets counts as custom. */
  showModelText = computed(() => {
    const opts = this.modelOptions();
    if (!opts) return true;
    return this.modelCustom() || (!!this.model() && !opts.some(o => o.id === this.model()));
  });
  selectedModelOption = computed(() => {
    const opts = this.modelOptions();
    if (!opts) return null;
    if (this.showModelText()) return opts[opts.length - 1];
    return opts.find(o => o.id === this.model()) ?? null;
  });

  onModelPick(opt: { id: string } | null): void {
    if (!opt) return;
    if (opt.id === AiSettingsFormComponent.CUSTOM_MODEL) {
      this.modelCustom.set(true);
      this.model.set('');
    } else {
      this.modelCustom.set(false);
      this.model.set(opt.id);
    }
    this.touch();
  }

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
    this.inferPreset();

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
    this.modelCustom.set(false);
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
    this.errAccount.set(!!this.selectedPreset()?.needsAccountId && this.baseUrl().includes('YOUR_ACCOUNT_ID'));
    return !this.errProvider() && !this.errCustom() && !this.errAccount();
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
    this.inferPreset();
    this.dirtyChange.emit(false);
  }
}
