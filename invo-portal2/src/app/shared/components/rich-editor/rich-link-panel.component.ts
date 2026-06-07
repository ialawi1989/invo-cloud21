import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RichTooltipDirective } from './rich-tooltip.directive';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

/** The five composer-style "Link to" kinds. */
export type RichLinkKind = 'web' | 'section' | 'page' | 'blog' | 'dynamic';

/** Full link configuration the panel edits + emits on Save. */
export interface RichLinkValue {
  kind: RichLinkKind;
  url: string;
  newTab: boolean;
  noReferrer: boolean;
  noFollow: boolean;
  sponsored: boolean;
}

/** A heading inside the document, for the Section picker. */
export interface RichLinkSection { id: string; tag: string; label: string; }

/** A host-provided link target (page / blog post / dynamic item). */
export interface RichLinkTarget { id: string; label: string; url: string; }

export const EMPTY_RICH_LINK: RichLinkValue = {
  kind: 'web', url: '', newTab: true, noReferrer: true, noFollow: false, sponsored: false,
};

/**
 * Shared "Link" editor panel — the single source of truth for link
 * editing behaviour across the rich editor (cell buttons, image
 * figures, and any future consumer). Renders the composer-style form:
 *   • "Link to" kind dropdown (web / section / page / blog / dynamic)
 *   • per-kind target picker (URL input / section list / host lists)
 *   • rel toggles (new tab / noreferrer / nofollow / sponsored)
 *   • Cancel / Save footer
 *
 * Self-contained (ViewEncapsulation.None + own styles) so it looks
 * and behaves identically wherever it's dropped — the host only
 * supplies the initial value + the section/target lists and listens
 * for (save) / (cancel). The header doubles as a drag handle via
 * (headerPointerDown) so the consumer can make the panel draggable.
 *
 * TODO(link-targets): page / blog / dynamic show a "wire the host"
 * note until the consumer binds [pages] / [blogPosts] / [dynamicItems].
 */
@Component({
  selector: 'app-re-link-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RichTooltipDirective, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .re-link-panel { display: flex; flex-direction: column; }
    .re-link-panel__head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid #e2e8f0;
      cursor: grab; user-select: none;
    }
    .re-link-panel__head:active { cursor: grabbing; }
    .re-link-panel__head h4 { margin: 0; font: 700 15px/1.2 inherit; color: #0f172a; }
    .re-link-panel__close {
      width: 28px; height: 28px; display: inline-flex; align-items: center;
      justify-content: center; border: none; background: transparent;
      border-radius: 6px; color: #64748b; cursor: pointer;
    }
    .re-link-panel__close:hover { background: #f1f5f9; color: #0f172a; }
    .re-link-panel__body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
    .re-link-panel__stack { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
    .rlp__label { font: 600 12px/1.3 inherit; color: #475569; }
    .rlp__urlInput {
      width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px;
      font: 400 13px/1 inherit; color: #0f172a; outline: none; box-sizing: border-box;
    }
    .rlp__urlInput:focus { border-color: var(--ricos-custom-settings-action-color, #32acc1); }
    /* Section / target picker list */
    .rlp__list {
      display: flex; flex-direction: column; gap: 2px; max-height: 220px;
      overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px;
    }
    .rlp__list button {
      display: flex; align-items: center; gap: 8px; padding: 6px 8px;
      background: transparent; border: none; border-radius: 4px; text-align: left; cursor: pointer;
    }
    .rlp__list button:hover { background: #f1f5f9; }
    .rlp__list button.is-on {
      background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 12%, #fff);
      color: var(--ricos-custom-settings-action-color, #32acc1);
    }
    .rlp__tag {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 4px; background: #f1f5f9;
      color: #475569; font: 700 10px/1 inherit; text-transform: uppercase;
    }
    .rlp__itemLabel { font: 500 13px/1.2 inherit; color: #0f172a; }
    .rlp__empty {
      padding: 12px; border: 1px dashed #e2e8f0; border-radius: 6px;
      font: 400 12px/1.4 inherit; color: #64748b; background: #f8fafc;
    }
    /* rel toggle rows */
    .rlp__row {
      display: flex; align-items: center; justify-content: space-between;
      font: 400 13px/1.3 inherit; color: #1e293b;
    }
    .rlp__labelGroup { display: inline-flex; align-items: center; gap: 4px; }
    .rlp__info {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; color: #94a3b8; cursor: help;
    }
    .rlp__info:hover { color: #32acc1; }
    .rlp__toggle {
      display: inline-block; width: 28px; height: 16px; background: #cbd5e1;
      border-radius: 999px; position: relative; transition: background 120ms;
      cursor: pointer; flex-shrink: 0;
    }
    .rlp__toggle::after {
      content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px;
      background: #fff; border-radius: 50%; transition: transform 120ms;
    }
    .rlp__toggle.is-on { background: var(--ricos-custom-settings-action-color, #32acc1); }
    .rlp__toggle.is-on::after { transform: translateX(12px); }
    .re-link-panel__foot {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 16px; border-top: 1px solid #e2e8f0; background: #fff;
    }
    .rlp__footBtn {
      padding: 6px 16px; border: 1px solid var(--ricos-custom-settings-action-color, #32acc1);
      border-radius: 999px; background: #fff; font: 600 13px/1 inherit;
      color: var(--ricos-custom-settings-action-color, #32acc1); cursor: pointer;
    }
    .rlp__footBtn:hover { background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 6%, #fff); }
    .rlp__footBtn--primary { background: var(--ricos-custom-settings-action-color, #32acc1); color: #fff; }
    .rlp__footBtn--primary:hover { background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 85%, #000); }
  `],
  template: `
    <div class="re-link-panel">
      <header class="re-link-panel__head" (mousedown)="headerPointerDown.emit($event)">
        <h4>{{ title }}</h4>
        <button type="button" class="re-link-panel__close"
                (click)="cancel.emit()" (mousedown)="$event.stopPropagation()" aria-label="Close">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </header>

      <div class="re-link-panel__body">
        <div class="re-link-panel__stack">
          <label class="rlp__label">Link to</label>
          <app-search-dropdown
            [items]="kindOptions"
            [displayWith]="kindDisplay"
            [compareWith]="kindCompare"
            [toValue]="kindToValue"
            [clearable]="false"
            [searchable]="false"
            [ngModel]="kind()"
            (ngModelChange)="pickKind($any($event))"/>
        </div>

        @if (kind() === 'web') {
          <div class="re-link-panel__stack">
            <label class="rlp__label">URL</label>
            <input type="text" class="rlp__urlInput"
                   placeholder="Enter or paste a link"
                   [ngModel]="url()" (ngModelChange)="url.set($event)"/>
          </div>
        } @else if (kind() === 'section') {
          <div class="re-link-panel__stack">
            <label class="rlp__label">Select a section to link to</label>
            @if (sections.length === 0) {
              <div class="rlp__empty">No sections in this post yet — add a heading first.</div>
            } @else {
              <div class="rlp__list">
                @for (s of sections; track s.id) {
                  <button type="button" [class.is-on]="url() === '#' + s.id" (click)="url.set('#' + s.id)">
                    <span class="rlp__tag">{{ s.tag }}</span>
                    <span class="rlp__itemLabel">{{ s.label }}</span>
                  </button>
                }
              </div>
            }
          </div>
        } @else {
          <!-- page / blog / dynamic — TODO(link-targets) -->
          <div class="re-link-panel__stack">
            <label class="rlp__label">{{ kind() === 'page' ? 'Page' : kind() === 'blog' ? 'Post' : 'Dynamic page' }}</label>
            @if (activeTargets().length === 0) {
              <div class="rlp__empty">{{ kind() === 'page' ? 'No pages available — wire the host to populate.' : kind() === 'blog' ? 'No posts available — wire the host to populate.' : 'No dynamic items available — wire the host to populate.' }}</div>
            } @else {
              <div class="rlp__list">
                @for (t of activeTargets(); track t.id) {
                  <button type="button" [class.is-on]="url() === t.url" (click)="url.set(t.url)">
                    <span class="rlp__itemLabel">{{ t.label }}</span>
                  </button>
                }
              </div>
            }
          </div>
        }

        <div class="rlp__row">
          <span class="rlp__labelGroup">Open link in a new tab</span>
          <span class="rlp__toggle" [class.is-on]="newTab()" (mousedown)="$event.preventDefault(); newTab.set(!newTab())"></span>
        </div>
        <div class="rlp__row">
          <span class="rlp__labelGroup">
            Noreferrer
            <span class="rlp__info" [appReTooltip]="'The destination site will not receive the referring URL.'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </span>
          </span>
          <span class="rlp__toggle" [class.is-on]="noReferrer()" (mousedown)="$event.preventDefault(); noReferrer.set(!noReferrer())"></span>
        </div>
        <div class="rlp__row">
          <span class="rlp__labelGroup">
            Nofollow
            <span class="rlp__info" [appReTooltip]="'Tells search engines not to follow this link for ranking.'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </span>
          </span>
          <span class="rlp__toggle" [class.is-on]="noFollow()" (mousedown)="$event.preventDefault(); noFollow.set(!noFollow())"></span>
        </div>
        <div class="rlp__row">
          <span class="rlp__labelGroup">
            Sponsored
            <span class="rlp__info" [appReTooltip]="'Marks the link as paid/sponsored content.'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </span>
          </span>
          <span class="rlp__toggle" [class.is-on]="sponsored()" (mousedown)="$event.preventDefault(); sponsored.set(!sponsored())"></span>
        </div>
      </div>

      <footer class="re-link-panel__foot">
        <button type="button" class="rlp__footBtn"
                (mousedown)="$event.preventDefault(); $event.stopPropagation()"
                (click)="cancel.emit()">Cancel</button>
        <button type="button" class="rlp__footBtn rlp__footBtn--primary"
                (mousedown)="$event.preventDefault(); $event.stopPropagation()"
                (click)="onSave()">Save</button>
      </footer>
    </div>
  `,
})
export class RichLinkPanelComponent {
  @Input() title = 'Link';
  /** Headings in the document for the Section picker. */
  @Input() sections: RichLinkSection[] = [];
  /** TODO(link-targets): host-provided lists. */
  @Input() pages: RichLinkTarget[] = [];
  @Input() blogPosts: RichLinkTarget[] = [];
  @Input() dynamicItems: RichLinkTarget[] = [];

  /** Seed the working copy from the host's current link state. */
  @Input() set value(v: RichLinkValue | null | undefined) {
    const next = v ?? EMPTY_RICH_LINK;
    this.kind.set(next.kind);
    this.url.set(next.url);
    this.newTab.set(next.newTab);
    this.noReferrer.set(next.noReferrer);
    this.noFollow.set(next.noFollow);
    this.sponsored.set(next.sponsored);
  }

  @Output() save   = new EventEmitter<RichLinkValue>();
  @Output() cancel = new EventEmitter<void>();
  /** Header press — host wires this to its drag-to-move handler. */
  @Output() headerPointerDown = new EventEmitter<MouseEvent>();

  // Working copy (signals) — committed to the host only on Save.
  kind       = signal<RichLinkKind>('web');
  url        = signal<string>('');
  newTab     = signal<boolean>(true);
  noReferrer = signal<boolean>(true);
  noFollow   = signal<boolean>(false);
  sponsored  = signal<boolean>(false);

  readonly kindOptions = [
    { id: 'web',     label: 'Web address' },
    { id: 'section', label: 'Section' },
    { id: 'page',    label: 'Page' },
    { id: 'blog',    label: 'Blog post' },
    { id: 'dynamic', label: 'Dynamic page' },
  ];
  kindDisplay = (v: any): string => v?.label ?? this.kindOptions.find(o => o.id === v)?.label ?? '';
  kindCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  kindToValue = (i: { id: string; label: string }) => i.id;

  /** Host-provided list for the active kind. */
  activeTargets(): RichLinkTarget[] {
    switch (this.kind()) {
      case 'page':    return this.pages;
      case 'blog':    return this.blogPosts;
      case 'dynamic': return this.dynamicItems;
      default:        return [];
    }
  }

  /** Switching kind clears URLs that don't belong to the new kind so
   *  the user starts fresh (mirrors the editor's pickLinkKind). */
  pickKind(kind: RichLinkKind): void {
    this.kind.set(kind);
    if (kind === 'web') {
      if (this.url().startsWith('#')) this.url.set('');
    } else if (kind === 'section') {
      if (this.url() && !this.url().startsWith('#')) this.url.set('');
    } else {
      this.url.set('');
    }
  }

  onSave(): void {
    this.save.emit({
      kind: this.kind(),
      url: this.url().trim(),
      newTab: this.newTab(),
      noReferrer: this.noReferrer(),
      noFollow: this.noFollow(),
      sponsored: this.sponsored(),
    });
  }
}
