import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { FormSplitComponent } from './form-split.component';

@Component({
  standalone: true,
  imports: [FormSplitComponent],
  template: `<app-form-split [items]="items()" [disabled]="disabled()" (action)="onAction()">Save and Send</app-form-split>`,
})
class HostComponent {
  readonly items = signal<DropdownMenuBtnItem[]>([]);
  readonly disabled = signal(false);
  onAction = vi.fn();
}

function setup(items: DropdownMenuBtnItem[] = [], disabled = false) {
  TestBed.configureTestingModule({ imports: [HostComponent, TranslateModule.forRoot()] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.items.set(items);
  fixture.componentInstance.disabled.set(disabled);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, host: fixture.componentInstance, el, label: () => el.querySelector<HTMLButtonElement>('.fs__label')!, chev: () => el.querySelector<HTMLButtonElement>('.fs__chev'), menu: () => el.querySelector('.fs__menu'), items: () => Array.from(el.querySelectorAll<HTMLButtonElement>('.fs__item')) };
}

describe('FormSplitComponent', () => {
  it('runs the primary action when the label is clicked, and does not open the menu', () => {
    const t = setup([{ label: 'Save and Print', click: vi.fn() }]);
    t.label().click(); t.fixture.detectChanges();
    expect(t.host.onAction).toHaveBeenCalledTimes(1);
    expect(t.menu()).toBeNull();
  });

  it('opens the menu from the chevron without running the primary action', () => {
    const t = setup([{ label: 'Save and Print', click: vi.fn() }]);
    t.chev()!.click(); t.fixture.detectChanges();
    expect(t.host.onAction).not.toHaveBeenCalled();
    expect(t.menu()).not.toBeNull();
    expect(t.chev()!.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls the item handler it was given and closes', () => {
    const print = vi.fn(); const share = vi.fn();
    const t = setup([{ label: 'Save and Print', click: print }, { label: 'Save and Share', click: share }]);
    t.chev()!.click(); t.fixture.detectChanges();
    t.items()[1].click(); t.fixture.detectChanges();
    expect(share).toHaveBeenCalledTimes(1);
    expect(print).not.toHaveBeenCalled();
    expect(t.menu()).toBeNull();
  });

  it('closes on Escape and returns focus to the chevron', () => {
    const t = setup([{ label: 'Save and Print', click: vi.fn() }]);
    document.body.appendChild(t.el);
    t.chev()!.click(); t.fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); t.fixture.detectChanges();
    expect(t.menu()).toBeNull();
    expect(document.activeElement).toBe(t.chev());
    t.el.remove();
  });

  it('closes on an outside click', () => {
    const t = setup([{ label: 'Save and Print', click: vi.fn() }]);
    t.chev()!.click(); t.fixture.detectChanges();
    document.body.click(); t.fixture.detectChanges();
    expect(t.menu()).toBeNull();
  });

  it('has no chevron segment when there are no extra save options', () => {
    const t = setup([]);
    expect(t.chev()).toBeNull();
    expect(t.el.querySelector('.fs__divider')).toBeNull();
  });

  it('disabled: neither segment acts, and the pill is marked disabled', () => {
    const t = setup([{ label: 'Save and Print', click: vi.fn() }], true);
    t.label().click(); t.chev()!.click(); t.fixture.detectChanges();
    expect(t.host.onAction).not.toHaveBeenCalled();
    expect(t.menu()).toBeNull();
    expect(t.el.querySelector('app-form-split')!.classList.contains('fs--disabled')).toBe(true);
  });

  it('keeps a separate accessible name for the chevron segment', () => {
    const t = setup([{ label: 'Save and Print', click: vi.fn() }]);
    expect(t.chev()!.getAttribute('aria-label')).toBeTruthy();
    expect(t.chev()!.getAttribute('aria-label')).not.toBe(t.label().textContent!.trim());
  });
});
