// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http';
import { MenuBuilderService } from './menu-builder.service';

describe('MenuBuilderService.getList', () => {
  let post: ReturnType<typeof vi.fn>;
  let svc: MenuBuilderService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    post = vi.fn().mockReturnValue(of({ success: true, data: { list: [], count: 0 } }));
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [{ provide: ApiService, useValue: { post, get: vi.fn(), request: (o: any) => o.toPromise() } }],
    });
    svc = TestBed.inject(MenuBuilderService);
  });

  it('asks for the priority order (index, ascending) when no sort is given', async () => {
    await svc.getList({ page: 1, limit: 20, search: 'x' });
    expect(post).toHaveBeenCalledWith('product/getMenuList', { page: 1, limit: 20, searchTerm: 'x', sortBy: { sortValue: 'index', sortDirection: 'asc' } });
  });

  it('uses the sort it is given instead', async () => {
    await svc.getList({ page: 1, limit: 20, sortBy: { sortValue: 'name', sortDirection: 'desc' } });
    expect(post.mock.calls[0][1].sortBy).toEqual({ sortValue: 'name', sortDirection: 'desc' });
  });
});
