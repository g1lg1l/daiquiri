import { z } from 'zod';

/** Team keys: 2–6 chars, uppercase letter first ("ENG", "OPS2"). */
export const teamKeySchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/, 'Use 2–6 uppercase letters or digits, starting with a letter');

const identifierPattern = /^([A-Z][A-Z0-9]{1,5})-([1-9]\d{0,8})$/;

export function formatIdentifier(teamKey: string, number: number): string {
  return `${teamKey}-${number}`;
}

/** Parses "eng-42" or "ENG-42" into its parts; returns null if it is not an identifier. */
export function parseIdentifier(input: string): { teamKey: string; number: number } | null {
  const match = identifierPattern.exec(input.trim().toUpperCase());
  if (!match) return null;
  return { teamKey: match[1]!, number: Number(match[2]) };
}

/** Suggests a team key from a team name: "Product Design" → "PD", "Engineering" → "ENG". */
export function suggestTeamKey(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const raw =
    words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? '').slice(0, 3);
  const key = raw
    .toUpperCase()
    .replace(/^[0-9]+/, '')
    .slice(0, 6);
  return key.length >= 2 ? key : (key + 'TEAM').slice(0, 4);
}
