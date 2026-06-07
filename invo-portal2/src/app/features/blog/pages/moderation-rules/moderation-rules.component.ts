import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { ToastService } from '@shared/components/toast/toast.service';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { BLOG_API } from '../../services/blog-api';
import { BlogModerationRule } from '../../services/blog.types';

@Component({
  selector: 'app-blog-moderation-rules',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, ToggleComponent, DropdownMenuBtnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './moderation-rules.component.html',
  styleUrl: './moderation-rules.component.scss',
})
export class ModerationRulesComponent implements OnInit {
  private api        = inject(BLOG_API);
  private router     = inject(Router);
  private translate  = inject(TranslateService);
  private toast      = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  loading = signal<boolean>(false);
  rules   = signal<BlogModerationRule[]>([]);

  constructor() {
    withTranslations('blog');
  }

  async ngOnInit(): Promise<void> { await this.reload(); }

  async reload(): Promise<void> {
    this.loading.set(true);
    try { this.rules.set(await this.api.listModerationRules()); }
    catch (e: any) { this.toast.error('COMMON.LOAD_FAILED', e?.message); }
    finally { this.loading.set(false); }
  }

  // ── Display labels ──────────────────────────────────────────────────
  groupLabel(g: string): string { return this.translate.instant('BLOG.MODERATION.GROUP_' + g.toUpperCase()); }
  actionLabel(a: string): string { return this.translate.instant('BLOG.MODERATION.ACTION_' + a.toUpperCase()); }
  triggerLabel(t: string): string {
    const key = 'BLOG.MODERATION.TRIGGER_' + t.toUpperCase();
    const val = this.translate.instant(key);
    return val === key ? t : val; // free-form triggers fall back to the raw value
  }

  // ── Actions ─────────────────────────────────────────────────────────
  addRule(): void { void this.router.navigate(['/blog/comments/rules/new']); }
  edit(r: BlogModerationRule): void { void this.router.navigate(['/blog/comments/rules', r.id, 'edit']); }

  async toggle(r: BlogModerationRule, active: boolean): Promise<void> {
    try {
      await this.api.toggleModerationRule(r.id, active);
      this.rules.update(list => list.map(x => x.id === r.id ? { ...x, active } : x));
    } catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }

  async duplicate(r: BlogModerationRule): Promise<void> {
    try {
      await this.api.saveModerationRule({
        name: `${r.name} (${this.translate.instant('COMMON.DUPLICATE')})`,
        group: r.group, trigger: r.trigger, action: r.action,
        excludedMemberIds: [...r.excludedMemberIds], active: r.active,
      });
      this.toast.success('COMMON.SAVED_OK');
      await this.reload();
    } catch (e: any) { this.toast.error('COMMON.SAVE_FAILED', e?.message); }
  }

  async remove(r: BlogModerationRule): Promise<void> {
    if (!window.confirm(this.translate.instant('BLOG.MODERATION.CONFIRM_DELETE', { name: r.name }))) return;
    try { await this.api.deleteModerationRule(r.id); this.toast.success('COMMON.DELETED_OK'); await this.reload(); }
    catch (e: any) { this.toast.error('COMMON.DELETE_FAILED', e?.message); }
  }

  rowMenu(r: BlogModerationRule): DropdownMenuBtnItem[] {
    return [
      { label: 'COMMON.EDIT',      click: () => this.edit(r),      iconPath: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
      { label: 'COMMON.DUPLICATE', click: () => this.duplicate(r), iconPath: 'M9 9h13v13H9z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' },
      { label: 'COMMON.DELETE',    click: () => this.remove(r), danger: true, separator: true, iconPath: 'M3 6h18 M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
    ];
  }
}
