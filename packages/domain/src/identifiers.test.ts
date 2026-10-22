import { formatIdentifier, parseIdentifier, suggestTeamKey, teamKeySchema } from './identifiers';

describe('identifiers', () => {
  it('formats and parses round-trip, case-insensitively', () => {
    expect(formatIdentifier('ENG', 142)).toBe('ENG-142');
    expect(parseIdentifier('eng-142')).toEqual({ teamKey: 'ENG', number: 142 });
    expect(parseIdentifier('  OPS2-7 ')).toEqual({ teamKey: 'OPS2', number: 7 });
  });

  it.each(['ENG', 'ENG-', 'ENG-0', 'ENG-01', '1NG-3', 'E-3', 'ENGINEER-3', 'ENG-12a'])(
    'rejects %s',
    (input) => expect(parseIdentifier(input)).toBeNull(),
  );

  it('suggests valid team keys', () => {
    expect(suggestTeamKey('Engineering')).toBe('ENG');
    expect(suggestTeamKey('Product Design')).toBe('PD');
    expect(suggestTeamKey('Café Ops & Support')).toBe('COS');
    expect(suggestTeamKey('X')).toBe('XTEA');
    for (const name of ['Engineering', 'Product Design', '2nd Line', 'a b c d e f g h']) {
      expect(teamKeySchema.safeParse(suggestTeamKey(name)).success).toBe(true);
    }
  });
});
