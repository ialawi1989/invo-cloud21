import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MODAL_REF } from '../../../../shared/modal/modal.tokens';
import { ModalRef } from '../../../../shared/modal/modal.service';
import { CompanyService } from '../../../../core/auth/company.service';

@Component({
  selector: 'app-import-from-invo',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="ifi">

      <!-- Header -->
      <div class="ifi-header">
        <h3 class="ifi-title">{{ 'GENERAL.IMPORT_FROM_INVO' | translate }}</h3>
      </div>

      <!-- Body -->
      <div class="ifi-body">
        <p class="ifi-label">{{ 'GENERAL.IMPORT_INVOBK' | translate }}</p>

        <!-- Drop zone -->
        <div class="ifi-dropzone"
             [class.ifi-dropzone--active]="dragOver()"
             [class.ifi-dropzone--selected]="fileName()"
             [class.ifi-dropzone--error]="fileTypeError()"
             (dragover)="onDragOver($event)"
             (dragleave)="dragOver.set(false)"
             (drop)="onDrop($event)"
             (click)="fileInput.click()">
          <input #fileInput type="file" accept=".invobk"
                 style="display:none" (change)="onFileChange($event)" />

          @if (fileName()) {
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#32acc1" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span class="ifi-filename">{{ fileName() }}</span>
            <span class="ifi-hint">Click to change file</span>
          } @else {
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2">
              <polyline points="16 16 12 12 8 16"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            <span class="ifi-hint-main">Drop your <strong>.invobk</strong> file here</span>
            <span class="ifi-hint">or click to browse</span>
          }
        </div>

        @if (fileTypeError()) {
          <p class="ifi-error">{{ 'MESSAGE.PLEASE_CHOOSE_ONLY_DOT_INVOBK' | translate }}</p>
        }
        @if (apiError()) {
          <p class="ifi-error">{{ apiError() }}</p>
        }
        @if (success()) {
          <div class="ifi-success">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Successfully imported!
          </div>
        }
      </div>

      <!-- Footer -->
      <div class="ifi-footer">
        <button class="ifi-btn ifi-btn--cancel" (click)="ref.dismiss()">Cancel</button>
        <button class="ifi-btn ifi-btn--import"
                (click)="doImport()"
                [disabled]="!file() || fileTypeError() || loading()">
          @if (loading()) {
            <span class="ifi-spin"></span>
          } @else {
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="8 17 12 21 16 17"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.83"/>
            </svg>
          }
          {{ 'GENERAL.IMPORT' | translate }}
        </button>
      </div>

    </div>
  `,
  styles: [`
    .ifi { min-width: 360px; }

    .ifi-header {
      padding: 20px 24px 14px;
      border-bottom: 1px solid #f0f2f5;
    }
    .ifi-title { font-size: 16px; font-weight: 600; color: #111827; margin: 0; }

    .ifi-body { padding: 20px 24px; }
    .ifi-label { font-size: 13px; font-weight: 500; color: #374151; margin: 0 0 12px; }

    .ifi-dropzone {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: 32px 20px;
      border: 2px dashed #e2e8f0; border-radius: 12px;
      cursor: pointer; transition: all .15s; text-align: center;
      background: #fafafa;
      &:hover { border-color: #32acc1; background: #f0fdf4; }
    }
    .ifi-dropzone--active { border-color: #32acc1; background: #e6f7f7; }
    .ifi-dropzone--selected { border-color: #32acc1; border-style: solid; background: #f0fdfb; }
    .ifi-dropzone--error { border-color: #ef4444; background: #fef2f2; }

    .ifi-filename { font-size: 14px; font-weight: 600; color: #32acc1; }
    .ifi-hint-main { font-size: 13px; color: #374151; }
    .ifi-hint { font-size: 12px; color: #94a3b8; }

    .ifi-error {
      font-size: 12px; color: #ef4444; margin: 8px 0 0;
      display: flex; align-items: center; gap: 5px;
    }
    .ifi-success {
      display: flex; align-items: center; gap: 8px;
      margin-top: 12px; padding: 10px 14px; border-radius: 8px;
      background: #f0fdf4; color: #16a34a; font-size: 13px; font-weight: 500;
      border: 1px solid #bbf7d0;
    }

    .ifi-footer {
      display: flex; gap: 10px; padding: 12px 24px 20px;
      border-top: 1px solid #f0f2f5;
    }
    .ifi-btn {
      flex: 1; height: 40px; border-radius: 8px; font-size: 14px; font-weight: 500;
      cursor: pointer; border: none; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 7px;
      transition: all .15s;
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    .ifi-btn--cancel { background: #f4f5f7; color: #374151; &:hover:not(:disabled) { background: #e9ecef; } }
    .ifi-btn--import { background: #32acc1; color: #fff;  &:hover:not(:disabled) { background: #2b95a8; } }

    .ifi-spin {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
      animation: spin .6s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ImportFromInvoComponent {
  ref            = inject<ModalRef>(MODAL_REF);
  private companySvc = inject(CompanyService);

  file          = signal<File | null>(null);
  fileName      = signal('');
  fileTypeError = signal(false);
  dragOver      = signal(false);
  loading       = signal(false);
  apiError      = signal('');
  success       = signal(false);

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) this.setFile(input.files[0]);
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    const f = e.dataTransfer?.files[0];
    if (f) this.setFile(f);
  }

  private setFile(f: File): void {
    this.apiError.set('');
    this.success.set(false);
    this.file.set(f);
    this.fileName.set(f.name);
    this.fileTypeError.set(!f.name.endsWith('.invobk'));
  }

  async doImport(): Promise<void> {
    const f = this.file();
    if (!f || this.fileTypeError()) return;

    this.loading.set(true);
    this.apiError.set('');

    try {
      const res = await this.companySvc.importCompanyData(f);

      if (res?.success) {
        this.success.set(true);
        setTimeout(() => this.ref.close({ imported: true }), 1200);
      } else {
        this.apiError.set(res?.msg ?? res?.message ?? 'Import failed. Please try again.');
      }
    } catch (err: any) {
      this.apiError.set(err?.error?.msg ?? err?.error?.message ?? 'Import failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
