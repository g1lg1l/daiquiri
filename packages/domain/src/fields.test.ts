import {
  fieldKeys,
  formatFieldValue,
  isFieldValue,
  matchesFieldFilters,
  parseFieldFilter,
} from './fields';
import type { CustomField } from './model';

const severity: CustomField = {
  id: 'f1',
  workspaceId: 'w',
  name: 'Severity',
  kind: 'select',
  options: [
    { id: 's1', name: 'Minor' },
    { id: 's2', name: 'Major' },
  ],
  position: 0,
};

const task = (fields: Record<string, string | boolean | string[]>) => ({ fields });

describe('custom fields', () => {
  it('checks values against the kind', () => {
    expect(isFieldValue('number', 3)).toBe(true);
    expect(isFieldValue('number', '3')).toBe(false);
    expect(isFieldValue('date', '2026-10-23')).toBe(true);
    expect(isFieldValue('date', 'tomorrow')).toBe(false);
    expect(isFieldValue('multi_select', ['a', 'b'])).toBe(true);
    expect(isFieldValue('checkbox', 'yes')).toBe(false);
  });

  it('shows option and member names', () => {
    const members = new Map([['u1', { displayName: 'Ana' }]]);
    expect(formatFieldValue(severity, 's2', members)).toBe('Major');
    expect(formatFieldValue({ ...severity, kind: 'multi_select' }, ['s1', 's2'], members)).toBe(
      'Minor, Major',
    );
    expect(formatFieldValue({ ...severity, kind: 'person' }, 'u1', members)).toBe('Ana');
    expect(formatFieldValue({ ...severity, kind: 'checkbox' }, false, members)).toBe('No');
    expect(formatFieldValue(severity, undefined, members)).toBe('');
  });

  it('filters with OR inside a field and AND across fields', () => {
    const filters = parseFieldFilter(['f1:s1', 'f1:s2', 'f2:true', 'broken']);
    expect([...filters.keys()]).toEqual(['f1', 'f2']);
    expect(matchesFieldFilters(task({ f1: 's2', f2: true }), filters, 'me')).toBe(true);
    expect(matchesFieldFilters(task({ f1: 's2', f2: false }), filters, 'me')).toBe(false);
    expect(matchesFieldFilters(task({}), parseFieldFilter(['f1:none']), 'me')).toBe(true);
    expect(matchesFieldFilters(task({ f3: 'u1' }), parseFieldFilter(['f3:me']), 'u1')).toBe(true);
    expect(fieldKeys(['a', 'b'])).toEqual(['a', 'b']);
  });
});
