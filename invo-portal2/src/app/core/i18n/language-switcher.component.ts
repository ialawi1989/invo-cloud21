import { Component, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from './language.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="lang-wrap">
      <button class="lang-trigger" (click)="toggleOpen($event)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span>{{ currentLabel() }}</span>
        <svg class="chevron" [class.open]="isOpen" width="12" height="12"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      @if (isOpen) {
        <div class="lang-dropdown">
          @for (lang of langService.available; track lang.code) {
            <button class="lang-option"
                    [class.active]="langService.current() === lang.code"
                    (click)="select(lang.code)">
              @if (langService.current() === lang.code) {
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" class="check">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              } @else {
                <span class="check-placeholder"></span>
              }
              <span class="lang-native">{{ lang.nativeLabel }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .lang-wrap { position: relative; }

    .lang-trigger {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 10px; border-radius: 8px;
      border: 1px solid #e9ecef;
      background: transparent; cursor: pointer;
      color: #495057; font-size: 13px; font-weight: 500;
      font-family: inherit; transition: all .15s;
    }
    .lang-trigger:hover { background: #f1f3f5; border-color: #dee2e6; }
    .lang-trigger svg { color: #6c757d; flex-shrink: 0; }
    .chevron { transition: transform .2s; }
    .chevron.open { transform: rotate(180deg); }

    .lang-dropdown {
      position: absolute; top: calc(100% + 6px); right: 0;
      min-width: 150px; background: #fff;
      border: 1px solid #e9ecef; border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,.12);
      overflow: hidden; z-index: 200;
      animation: dropIn .12s ease;
    }
    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .lang-option {
      display: flex; align-items: center; gap: 8px;
      width: 100%; padding: 10px 14px;
      background: transparent; border: none;
      cursor: pointer; font-family: inherit;
      transition: background .1s;
    }
    .lang-option:hover { background: #f8f9fa; }
    .lang-option.active { background: #f0f4ff; }
    .lang-option .check { color: #556ee6; flex-shrink: 0; }
    .check-placeholder { width: 13px; flex-shrink: 0; }
    .lang-native { font-size: 13px; font-weight: 500; color: #212529; }
  `]
})
export class LanguageSwitcherComponent {
  langService = inject(LanguageService);
  private elRef = inject(ElementRef);

  isOpen = false;

  currentLabel() {
    const lang = this.langService.available.find(
      l => l.code === this.langService.current()
    );
    return lang?.nativeLabel ?? 'EN';
  }

  toggleOpen(e: MouseEvent): void {
    e.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  select(code: string): void {
    this.langService.use(code);
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(e.target as Node)) {
      this.isOpen = false;
    }
  }
}
