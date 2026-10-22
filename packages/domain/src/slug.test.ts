import { slugify, workspaceSlugSchema } from './slug';

describe('slugify', () => {
  it.each([
    ['Acme Inc.', 'acme-inc'],
    ['  Café  Society ', 'cafe-society'],
    ['---hello---', 'hello'],
    ['A'.repeat(60), 'a'.repeat(40)],
  ])('%s → %s', (input, expected) => expect(slugify(input)).toBe(expected));

  it('produces valid slugs', () => {
    expect(workspaceSlugSchema.safeParse(slugify('Daiq Labs')).success).toBe(true);
    expect(workspaceSlugSchema.safeParse('bad--slug').success).toBe(false);
    expect(workspaceSlugSchema.safeParse('-bad').success).toBe(false);
  });
});
