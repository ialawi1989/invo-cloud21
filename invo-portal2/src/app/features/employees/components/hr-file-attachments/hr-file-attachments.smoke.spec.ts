import { Component, ErrorHandler, provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

// The REAL bundles. Without them ngx-translate echoes every key back and the
// unresolved-key guard below asserts nothing.
import employeesEn from '../../i18n/en.json';

import { EmployeeFileService, HrFile } from '../../services/employee-file.service';
import { HrFileAttachmentsComponent } from './hr-file-attachments.component';

/**
 * Does the attachments control actually RENDER?
 *
 * ── WHY THIS EXISTS ALONGSIDE THE PURE GATE TEST ─────────────────────────────
 * `hr-file-attachments.spec.ts` proves what `attachmentAccess()` DECIDES. It
 * cannot catch a template that never renders the decision — a mistyped control
 * flow block, a binding to a field that does not exist, a translation key that
 * resolves to itself. Those only appear when the component is instantiated, and
 * they are the class of bug this repo keeps shipping.
 *
 * **This is NOT the browser verification that was asked for and does not
 * replace it.** Nobody has yet watched a file leave a browser and arrive in S3
 * through this control; that needs a signed-in session, which is why it is
 * still outstanding. What this does cover is everything between "the gate
 * decided" and "the markup exists", which is where a template error would sit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Template errors go through ErrorHandler, which LOGS and continues. */
class CapturingErrorHandler implements ErrorHandler {
  readonly errors: unknown[] = [];
  handleError(error: unknown): void { this.errors.push(error); }
}

/**
 * A key that never resolved, found ANYWHERE in the text — same rule as the
 * benefits smoke test, and a whole-string search for the same reason: adjacent
 * inline elements render with no whitespace between them, so a per-token regex
 * misses a raw key sitting against its neighbour.
 */
const UNRESOLVED_KEY = /[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+/g;

function expectNoUnresolvedKeys(fixture: ComponentFixture<unknown>, label: string): void {
  const text = String((fixture.nativeElement as HTMLElement).textContent ?? '');
  const unresolved = [...new Set(text.match(UNRESOLVED_KEY) ?? [])].sort();
  expect(
    unresolved.length ? `${label}: unresolved translation keys -> ${unresolved.join(', ')}` : null,
  ).toBeNull();
}

const FILE: HrFile = {
  id: 'f1',
  fileName: 'passport.pdf',
  contentType: 'application/pdf',
  sizeBytes: 2048,
  uploadedAt: '2026-08-01',
  uploadedBy: 'e1',
};

@Component({
  standalone: true,
  imports: [HrFileAttachmentsComponent],
  template: `<app-hr-file-attachments
    [entity]="'employeeDocument'"
    [parentId]="'doc-1'"
    [attachments]="files()"
    [canUpload]="canUpload()"
    [disabledReasonKey]="reason()" />`,
})
class HostComponent {
  files = signal<HrFile[]>([]);
  canUpload = signal(false);
  reason = signal<string | null>(null);
}

async function render(opts: {
  files?: HrFile[];
  canUpload?: boolean;
  reason?: string | null;
  catalogRejects?: boolean;
}) {
  const handler = new CapturingErrorHandler();

  await TestBed.resetTestingModule().configureTestingModule({
    imports: [HostComponent, TranslateModule.forRoot()],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      { provide: ErrorHandler, useValue: handler },
      {
        provide: EmployeeFileService,
        useValue: {
          catalog: opts.catalogRejects
            ? () => Promise.reject(new Error('endpoint does not exist'))
            : () => Promise.resolve({
                maxBytes: 10 * 1024 * 1024,
                accepted: ['application/pdf'],
                storageConfigured: true,
              }),
          upload: () => Promise.resolve(),
          downloadUrl: () => Promise.resolve({ url: 'https://example.invalid/x', fileName: 'x.pdf' }),
          remove: () => Promise.resolve(),
        },
      },
    ],
  }).compileComponents();

  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', employeesEn as any, true);
  translate.use('en');

  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.files.set(opts.files ?? []);
  fixture.componentInstance.canUpload.set(opts.canUpload ?? false);
  fixture.componentInstance.reason.set(opts.reason ?? null);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, errors: handler.errors, text: String(fixture.nativeElement.textContent ?? '') };
}

describe('hr-file-attachments — it renders', () => {
  it('renders the upload control when the parent allows it', async () => {
    const { fixture, errors, text } = await render({ canUpload: true });

    expect(errors).toEqual([]);
    expect(fixture.nativeElement.querySelector('input[type=file]')).toBeTruthy();
    expect(text).toContain('Attach a file');
    expectNoUnresolvedKeys(fixture, 'upload allowed');
  });

  it('renders NO file input and states the reason when it does not', async () => {
    // The inverse. A template that always renders the input satisfies the test
    // above and fails here — which is the bug that puts a working-looking
    // upload button in front of someone whose every request is refused.
    const { fixture, errors, text } = await render({
      canUpload: false,
      reason: 'EMPLOYEES.FILES.SAVE_EMPLOYEE_FIRST',
    });

    expect(errors).toEqual([]);
    expect(fixture.nativeElement.querySelector('input[type=file]')).toBeNull();
    expect(text).toContain('Save the employee first');
    expectNoUnresolvedKeys(fixture, 'upload disabled');
  });

  it('lists attached files with their size', async () => {
    const { fixture, errors, text } = await render({ files: [FILE], canUpload: true });

    expect(errors).toEqual([]);
    expect(text).toContain('passport.pdf');
    expect(text).toContain('2 KB');
    expectNoUnresolvedKeys(fixture, 'populated');
  });

  it('says so when there is nothing attached', async () => {
    // The inverse of the list case: a template that always renders the list
    // shows an empty bullet list and no explanation.
    const { fixture, errors, text } = await render({ files: [], canUpload: true });

    expect(errors).toEqual([]);
    expect(text).toContain('No files attached');
    expect(fixture.nativeElement.querySelector('.hr-files__item')).toBeNull();
    expectNoUnresolvedKeys(fixture, 'empty');
  });

  it('offers no remove control to someone who may not upload', async () => {
    const { fixture, text } = await render({ files: [FILE], canUpload: false, reason: null });

    expect(fixture.nativeElement.querySelector('.hr-files__remove')).toBeNull();
    // ...but the file is still listed and downloadable.
    expect(text).toContain('passport.pdf');
  });

  it('renders even when the file catalogue cannot be fetched', async () => {
    // TODAY's state on any deployment where the endpoint is missing. The
    // control must degrade, not throw — the accept attribute simply goes empty
    // and the server remains the authority on what it will take.
    const { fixture, errors } = await render({ canUpload: true, catalogRejects: true });

    expect(errors).toEqual([]);
    const input = fixture.nativeElement.querySelector('input[type=file]');
    expect(input).toBeTruthy();
    expect(input.getAttribute('accept')).toBe('');
    expectNoUnresolvedKeys(fixture, 'catalogue missing');
  });
});
