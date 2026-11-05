import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { ApiService } from '@core/http/api.service';

import { MenuRecipeItem, ProductRecipeService } from './product-recipe.service';

const item = (o: Partial<MenuRecipeItem> = {}): MenuRecipeItem => ({
  inventoryId: 'inv-1', name: 'Flour', categoryName: '', UOM: '', unitCost: 1, usages: 2.5, type: '', originalUsages: 1, isNew: false, ...o,
});

/**
 * A recipe's own items are stored (and read back by the recipe page and the backend's cost query) under `usage`,
 * while menu-item and option lines use `usages`. Saving a recipe line under the wrong key left the recipe page blank.
 */
describe('ProductRecipeService.saveRecipeItem usage key', () => {
  let sent: { url: string; body: any } | null;
  let service: ProductRecipeService;

  beforeEach(() => {
    sent = null;
    TestBed.configureTestingModule({
      providers: [
        ProductRecipeService,
        { provide: ApiService, useValue: { post: (url: string, body: any) => ({ url, body }), request: async (r: any) => { sent = r; return { success: true }; } } },
      ],
    });
    service = TestBed.inject(ProductRecipeService);
  });

  it('sends `usage` (not `usages`) for a recipe owner', async () => {
    await service.saveRecipeItem('recipe', 'r1', item());
    expect(sent!.url).toBe('product/saveRecipeItem/recipe/r1');
    expect(sent!.body.usage).toBe(2.5);
    expect('usages' in sent!.body).toBe(false);
  });

  it('sends `usages` for an option owner', async () => {
    await service.saveRecipeItem('option', 'o1', item());
    expect(sent!.body.usages).toBe(2.5);
    expect('usage' in sent!.body).toBe(false);
  });
});
