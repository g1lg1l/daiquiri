import { safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
  it.each([
    ['/acme/inbox', '/acme/inbox'],
    ['/acme/team/ENG/tasks?layout=board#x', '/acme/team/ENG/tasks?layout=board#x'],
  ])('keeps %s', (input, expected) => expect(safeRedirectPath(input)).toBe(expected));

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '',
    null,
  ])('rejects %s', (input) => expect(safeRedirectPath(input, '/home')).toBe('/home'));
});
