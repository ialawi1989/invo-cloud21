import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { LanguageService } from '@core/i18n/language.service';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { CustomFieldsService } from '../../services/custom-fields.service';
import { CustomFieldsManagerComponent } from './custom-fields-manager.component';

describe('custom fields manager: unsaved changes', () => {
  it('is clean after load and dirty once a field is added', async () => {
    const fields = [{ id: 'a', type: 'text', name: 'AAA', abbr: 'aaa', required: false, system: false, defaultValue: null, gridTemplate: 'col-12', isDeleted: false, deletedAt: null }];
    TestBed.configureTestingModule({
      providers: [
        { provide: CustomFieldsService, useValue: { getByType: async () => fields.map(f => ({ ...f })) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'product' } } } },
        { provide: Router, useValue: { navigate: () => {} } },
        { provide: TranslateService, useValue: { onTranslationChange: new Subject(), onLangChange: new Subject(), instant: (k: string) => k, get: () => new Subject() } },
        { provide: LanguageService, useValue: { loadFeature: async () => {}, instant: (k: string) => k, current: () => 'en' } },
        { provide: ModalService, useValue: {
            open: () => ({ afterClosed: async () => 'url' }),
            scrollRestored: () => new Promise(() => {}),
          } },
        { provide: ToastService, useValue: {} },
      ],
    });
    TestBed.overrideComponent(CustomFieldsManagerComponent, { set: { template: '', imports: [] } });
    const c = TestBed.createComponent(CustomFieldsManagerComponent).componentInstance;
    await c.ngOnInit();
    expect(c.hasUnsavedChanges()).toBe(false);
    await c.add();
    expect(c.hasUnsavedChanges()).toBe(true);
  });
});
