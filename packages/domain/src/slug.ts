import { z } from 'zod';

export const workspaceSlugSchema = z
  .string()
  .min(2, 'At least 2 characters')
  .max(40, 'At most 40 characters')
  .regex(/^[a-z0-9](?:-?[a-z0-9])*$/, 'Lowercase letters, digits and single dashes only');

/** "Acme Inc." → "acme-inc"; accents are folded ("Café" → "cafe"). */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
