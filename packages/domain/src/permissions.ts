import { z } from 'zod';

export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'guest'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);

export type WorkspaceAction =
  | 'workspace.delete'
  | 'workspace.update'
  | 'members.invite'
  | 'members.manage'
  | 'owners.manage'
  | 'teams.create'
  | 'projects.create'
  | 'labels.manage'
  | 'settings.advanced';

const matrix: Record<WorkspaceAction, readonly WorkspaceRole[]> = {
  'workspace.delete': ['owner'],
  'owners.manage': ['owner'],
  'workspace.update': ['owner', 'admin'],
  'members.invite': ['owner', 'admin'],
  'members.manage': ['owner', 'admin'],
  'labels.manage': ['owner', 'admin'],
  'settings.advanced': ['owner', 'admin'],
  'teams.create': ['owner', 'admin', 'member'],
  'projects.create': ['owner', 'admin', 'member'],
};

/**
 * UI-side mirror of the permission rules enforced by RLS. Used only to hide
 * actions a user cannot perform; the database remains the authority.
 */
export function can(role: WorkspaceRole | null | undefined, action: WorkspaceAction): boolean {
  return role != null && matrix[action].includes(role);
}

/** Roles an inviter may grant (nobody is invited as owner). */
export function invitableRoles(role: WorkspaceRole): WorkspaceRole[] {
  return role === 'owner' || role === 'admin' ? ['admin', 'member', 'guest'] : [];
}
