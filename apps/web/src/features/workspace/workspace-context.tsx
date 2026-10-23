import { useCustomFields, useLabels, useMembers, useProjects, useTeams } from '@daiq/data';
import type { CustomField, Label, Member, Project, Status, Team, Workspace } from '@daiq/domain';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface WorkspaceContextValue {
  workspace: Workspace;
  userId: string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  userId,
  children,
}: WorkspaceContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ workspace, userId }), [workspace, userId]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside a workspace route');
  return context;
}

export interface WorkspaceData {
  teams: Team[];
  myTeams: Team[];
  teamsByKey: ReadonlyMap<string, Team>;
  teamsById: ReadonlyMap<string, Team>;
  statuses: ReadonlyMap<string, Status>;
  members: Member[];
  membersById: ReadonlyMap<string, Member>;
  labels: Label[];
  labelsById: ReadonlyMap<string, Label>;
  projects: Project[];
  projectsById: ReadonlyMap<string, Project>;
  fields: CustomField[];
  fieldsById: ReadonlyMap<string, CustomField>;
  ready: boolean;
}

/** Workspace-wide reference data with lookup maps, shared by every screen. */
export function useWorkspaceData(): WorkspaceData {
  const { workspace, userId } = useWorkspace();
  const teams = useTeams(workspace.id);
  const members = useMembers(workspace.id);
  const labels = useLabels(workspace.id);
  const projects = useProjects(workspace.id);
  const fields = useCustomFields(workspace.id);

  return useMemo(() => {
    const teamList = teams.data ?? [];
    return {
      teams: teamList,
      myTeams: teamList.filter((team) => team.memberIds.includes(userId)),
      teamsByKey: new Map(teamList.map((team) => [team.key, team])),
      teamsById: new Map(teamList.map((team) => [team.id, team])),
      statuses: new Map(
        teamList.flatMap((team) => team.statuses.map((status) => [status.id, status])),
      ),
      members: members.data ?? [],
      membersById: new Map((members.data ?? []).map((member) => [member.id, member])),
      labels: labels.data ?? [],
      labelsById: new Map((labels.data ?? []).map((label) => [label.id, label])),
      projects: projects.data ?? [],
      projectsById: new Map((projects.data ?? []).map((project) => [project.id, project])),
      fields: fields.data ?? [],
      fieldsById: new Map((fields.data ?? []).map((field) => [field.id, field])),
      ready: Boolean(teams.data && members.data && labels.data && projects.data),
    };
  }, [teams.data, members.data, labels.data, projects.data, fields.data, userId]);
}
