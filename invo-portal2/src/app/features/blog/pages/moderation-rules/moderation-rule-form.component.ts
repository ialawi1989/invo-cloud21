import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { BLOG_API } from '../../services/blog-api';
import { BlogModerationRule, ModerationAction, ModerationGroup } from '../../services/blog.types';

@Component({
  selector: 'app-blog-moderation-rule-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './moderation-rule-form.component.html',
  styleUrl: './moderation-rule-form.component.scss',
})
export class ModerationRuleFormComponent implements OnInit {
  private api       = inject(BLOG_API);
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private translate = inject(TranslateService);
  private toast     = inject(ToastService);

  private id: string | null = null;
  private existing: BlogModerationRule | null = null;

  loading = signal<boolean>(false);
  saving  = signal<boolean>(false);

  name    = signal<string>('');
  group   = signal<ModerationGroup>('everyone');
  trigger = signal<string>('spam');
  action  = signal<ModerationAction>('pending');

  private i18nTick = signal(0);

  canSave = computed(() => this.name().trim().length > 0 && this.trigger().trim().length > 0 && !this.saving());

  groupOptions = computed(() => {
    this.i18nTick();
    return (['everyone', 'members', 'visitors'] as const).map(v => ({ id: v, label: this.translate.instant('BLOG.MODERATION.GROUP_' + v.toUpperCase()) }));
  });
  triggerOptions = computed(() => {
    this.i18nTick();
    return (['spam', 'links', 'profanity', 'phone', 'email', 'all'] as const).map(v => ({ id: v, label: this.translate.instant('BLOG.MODERATION.TRIGGER_' + v.toUpperCase()) }));
  });
  actionOptions = computed(() => {
    this.i18nTick();
    return (['pending', 'trash', 'block'] as const).map(v => ({ id: v, label: this.translate.instant('BLOG.MODERATION.ACTION_' + v.toUpperCase()) }));
  });

  idDisplay = (v: any) => v?.label ?? v ?? '';
  idCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  idToValue = (i: { id: string; label: string }) => i.id;

  pageTitle = computed(() => this.name().trim() || this.translate.instant('BLOG.MODERATION.NEW_RULE'));

  constructor() {
    withTranslations('blog');
    this.translate.onLangChange.subscribe(() => this.i18nTick.update(n => n + 1));
  }

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id');
    if (!this.id) return;
    this.loading.set(true);
    try {
      const r = await this.api.getModerationRule(this.id);
      if (r) {
        this.existing = r;
        this.name.set(r.name);
        this.group.set(r.group);
        this.trigger.set(r.trigger);
        this.action.set(r.action);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      await this.api.saveModerationRule({
        id: this.id ?? undefined,
        name: this.name().trim(),
        group: this.group(),
        trigger: this.trigger().trim(),
        action: this.action(),
        excludedMemberIds: this.existing?.excludedMemberIds ?? [],
        active: this.existing?.active ?? true,
      });
      this.toast.success('COMMON.SAVED_OK');
      this.cancel();
    } catch (e: any) {
      this.saving.set(false);
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    }
  }

  cancel(): void { void this.router.navigate(['/blog/comments/rules']); }
}
