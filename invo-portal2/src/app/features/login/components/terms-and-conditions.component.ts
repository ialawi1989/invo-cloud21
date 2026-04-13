import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, inject, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { MODAL_DATA, MODAL_REF } from '../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../shared/modal/modal.service';
import { marked } from 'marked';

export interface TermsData {
  version:      string;
  title:        string;
  content_md:   string;
  published_at: string;
}

export interface TermsModalData {
  pendingLoginToken: string;
  terms: TermsData | null;
}

export interface TermsResult {
  accepted: boolean;
  data?: any;
}

@Component({
  selector: 'app-terms-and-conditions',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <!-- Header -->
    <div class="terms-header">
      <div class="terms-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <div>
        <h4 class="terms-title">{{ data.terms?.title || 'Terms & Conditions' }}</h4>
        <p class="terms-meta">
          Version {{ data.terms?.version }}
          <span class="dot">·</span>
          Updated {{ data.terms?.published_at | date:'mediumDate' }}
        </p>
      </div>
    </div>

    <!-- Scroll hint -->
    <div class="scroll-hint" [class.scroll-hint--done]="hasScrolledToBottom">
      @if (!hasScrolledToBottom) {
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
        </svg>
        Please scroll to the bottom to accept
      } @else {
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        You've read the terms — you may now accept
      }
    </div>

    <!-- Scrollable body -->
    <div class="terms-body" #scrollContainer (scroll)="onScroll()">
      @if (renderedContent) {
        <div class="terms-content" [innerHTML]="renderedContent"></div>
      } @else if (data.terms?.content_md) {
        <pre class="terms-content terms-plain">{{ data.terms?.content_md }}</pre>
      }
      <div class="terms-sentinel"></div>
    </div>

    <!-- Error -->
    @if (error) {
      <div class="terms-error">{{ error }}</div>
    }

    <!-- Footer -->
    <div class="terms-footer">
      <div class="terms-lock-row" [class.terms-lock-row--disabled]="!hasScrolledToBottom">
        <div class="lock-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            @if (!hasScrolledToBottom) {
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            } @else {
              <path d="M7 11V7a5 5 0 0110 0"/>
            }
          </svg>
        </div>
        <p class="lock-label">
          @if (!hasScrolledToBottom) {
            Scroll to the bottom to unlock acceptance
          } @else {
            By clicking <strong>Accept</strong>, you confirm you have read and agree to the above terms.
          }
        </p>
      </div>

      <div class="terms-actions">
        <button class="btn-decline" (click)="onDecline()" [disabled]="isAccepting">
          Decline
        </button>
        <button class="btn-accept" (click)="onAccept()"
          [disabled]="!hasScrolledToBottom || isAccepting">
          @if (isAccepting) { <span class="spinner"></span> }
          @else { Accept &amp; Continue }
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; }

    .terms-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 52px 16px 24px;
      border-bottom: 1px solid #e5e7eb; flex-shrink: 0;
    }
    .terms-icon {
      width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #e8f8fb, #d0eef5);
      color: #32acc1; display: flex; align-items: center; justify-content: center;
    }
    .terms-title { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 2px; }
    .terms-meta  { font-size: 12px; color: #9ca3af; margin: 0; }
    .dot { margin: 0 6px; }

    .scroll-hint {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 7px 16px; font-size: 12px; font-weight: 500; flex-shrink: 0;
      background: #fff8e1; color: #856404; border-bottom: 1px solid #ffd966;
      transition: background .4s, color .4s;
    }
    .scroll-hint--done { background: #e8f8eb; color: #1a6630; border-color: #a3d9ae; }

    .terms-body {
      flex: 1 1 auto; overflow-y: auto; padding: 24px 28px;
      background: #fafbfc; min-height: 0;
      scrollbar-width: thin; scrollbar-color: #32acc1 #f0f0f0;
    }
    .terms-body::-webkit-scrollbar       { width: 6px; }
    .terms-body::-webkit-scrollbar-track { background: #f0f0f0; border-radius: 3px; }
    .terms-body::-webkit-scrollbar-thumb { background: #32acc1; border-radius: 3px; }

    .terms-content { color: #2c3e50; font-size: 14px; line-height: 1.75; }
    .terms-content h2, .terms-content h3 { color: #111827; font-weight: 600; margin-top: 1.4em; }
    .terms-plain { white-space: pre-wrap; word-break: break-word; font-family: inherit; }
    .terms-sentinel { height: 1px; }

    .terms-error {
      margin: 8px 24px; padding: 10px 14px; flex-shrink: 0;
      background: rgba(239,68,68,.08); color: #ef4444;
      border: 1px solid rgba(239,68,68,.15); border-radius: 8px; font-size: 13px;
    }

    .terms-footer { padding: 16px 24px 20px; border-top: 1px solid #e5e7eb; flex-shrink: 0; }
    .terms-lock-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 16px; transition: opacity .3s;
    }
    .terms-lock-row--disabled { opacity: .55; }
    .lock-icon {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      background: #f3f4f6; color: #9ca3af;
      display: flex; align-items: center; justify-content: center;
    }
    .lock-label { font-size: 13px; color: #6b7280; margin: 0; line-height: 1.4; }
    .lock-label strong { color: #111827; }

    .terms-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-decline {
      padding: 10px 24px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 14px; cursor: pointer;
      &:hover { background: #e5e7eb; }
    }
    .btn-accept {
      display: flex; align-items: center; justify-content: center;
      min-width: 160px; padding: 10px 28px;
      background: #32acc1; color: #fff; border: none;
      border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background .2s, transform .15s;
      &:hover:not(:disabled) { background: #2b95a8; transform: translateY(-1px); }
      &:disabled { background: #b0bec5; cursor: not-allowed; opacity: .7; }
    }
    .spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
      border-radius: 50%; animation: spin .6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class TermsAndConditionsComponent implements OnInit, AfterViewInit, OnDestroy {
  private auth = inject(AuthService);
  private cdr  = inject(ChangeDetectorRef);

  data = inject<TermsModalData>(MODAL_DATA);
  ref  = inject<ModalRef<TermsResult>>(MODAL_REF);

  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

  renderedContent     = '';
  hasScrolledToBottom = false;
  isAccepting         = false;
  error               = '';

  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    if (this.data.terms?.content_md) {
      try {
        this.renderedContent = marked.parse(this.data.terms.content_md, { breaks: true }) as string;
      } catch {
        this.renderedContent = this.data.terms.content_md;
      }
    }
  }

  ngAfterViewInit(): void {
    const el = this.scrollContainer?.nativeElement;
    if (el) {
      // Use ResizeObserver to detect when container gets its final size
      this.resizeObserver = new ResizeObserver(() => this.checkScroll());
      this.resizeObserver.observe(el);
    }
    setTimeout(() => this.checkScroll(), 300);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  onScroll(): void { this.checkScroll(); }

  private checkScroll(): void {
    const el = this.scrollContainer?.nativeElement;
    if (!el || !el.clientHeight) return;
    // Auto-unlock if content doesn't overflow (no scroll needed)
    // or user has scrolled close enough to the bottom
    if (el.scrollHeight <= el.clientHeight || el.scrollHeight - el.scrollTop - el.clientHeight <= 40) {
      if (!this.hasScrolledToBottom) {
        this.hasScrolledToBottom = true;
        this.cdr.detectChanges();
      }
    }
  }

  async onAccept(): Promise<void> {
    if (!this.hasScrolledToBottom || this.isAccepting) return;
    this.isAccepting = true;
    this.error = '';
    try {
      const res = await this.auth.acceptTermsAndConditions(this.data.pendingLoginToken);
      if (res?.success) {
        this.ref.close({ accepted: true, data: res.data });
      } else {
        this.error = res?.msg || 'Failed to accept terms. Please try again.';
      }
    } catch (err: any) {
      this.error = err?.error?.msg || 'An unexpected error occurred.';
    } finally {
      this.isAccepting = false;
    }
  }

  onDecline(): void {
    this.ref.close({ accepted: false });
  }
}
