import { can, invitableRoles } from './permissions';

describe('permissions', () => {
  it('matches the role matrix in ADR-0006', () => {
    expect(can('owner', 'workspace.delete')).toBe(true);
    expect(can('admin', 'workspace.delete')).toBe(false);
    expect(can('admin', 'members.invite')).toBe(true);
    expect(can('member', 'members.invite')).toBe(false);
    expect(can('member', 'teams.create')).toBe(true);
    expect(can('guest', 'teams.create')).toBe(false);
    expect(can(null, 'teams.create')).toBe(false);
  });

  it('never lets anyone invite an owner', () => {
    expect(invitableRoles('owner')).not.toContain('owner');
    expect(invitableRoles('member')).toEqual([]);
  });
});
