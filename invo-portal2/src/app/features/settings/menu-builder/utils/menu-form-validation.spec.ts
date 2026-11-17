import { describe, it, expect } from 'vitest';
import type { Menu } from '../services/menu-builder.types';
import { firstInvalidKey, validateMenuForm } from './menu-form-validation';

const idOf = (s: any) => s.id ?? s.__tempId;
const menu = (over: Partial<Menu> = {}): Menu => ({
  id: 'm', name: 'Lunch', branchIds: ['b1'], priceLabelId: '', startAt: '09:00:00', endAt: '17:00:00', availableOnline: true, index: 0,
  sections: [], ...over,
});
const sec = (id: string, name: string): any => ({ id, name, translation: {}, image: '', pages: 1, color: {}, products: [] });

describe('menu form validation', () => {
  it('a good menu has no errors', () => {
    expect(validateMenuForm(menu(), idOf)).toEqual({});
  });
  it('the name is required and trimmed', () => {
    expect(validateMenuForm(menu({ name: '   ' }), idOf)['name']).toBe('REQUIRED');
  });
  it('end earlier than start is allowed (overnight); the same time is not', () => {
    expect(validateMenuForm(menu({ startAt: '18:00:00', endAt: '02:00:00' }), idOf)['endAt']).toBeUndefined();
    expect(validateMenuForm(menu({ startAt: '09:00:00', endAt: '09:00:00' }), idOf)['endAt']).toBe('SAME_AS_START');
  });
  it('needs at least one branch', () => {
    expect(validateMenuForm(menu({ branchIds: [] }), idOf)['branchIds']).toBe('REQUIRED');
  });
  it('section names are unique within the menu', () => {
    const e = validateMenuForm(menu({ sections: [sec('a', 'Rice'), sec('b', ' rice')] }), idOf);
    expect(e['section:a']).toBeUndefined();
    expect(e['section:b']).toBe('DUPLICATE_NAME');
  });

  it('the first invalid field is the first on the page: name, hours, branches, then sections', () => {
    const e = validateMenuForm(menu({ name: '', branchIds: [], sections: [sec('a', '')] }), idOf);
    expect(firstInvalidKey(e, ['a'])).toBe('name');
    expect(firstInvalidKey({ 'section:a': 'X', branchIds: 'REQUIRED' }, ['a'])).toBe('branchIds');
    expect(firstInvalidKey({ 'section:b': 'X', 'section:a': 'X' }, ['a', 'b'])).toBe('section:a');
    expect(firstInvalidKey({}, ['a'])).toBeNull();
  });
});
