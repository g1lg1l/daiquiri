import { formatIdentifier, type Task } from '@daiq/domain';
import { useWorkspaceData } from '../workspace/workspace-context';

/** "ENG-142", or "ENG-…" while the server has not assigned the number yet. */
export function useIdentifier(): (task: Pick<Task, 'teamId' | 'number'>) => string {
  const { teamsById } = useWorkspaceData();
  return (task) => {
    const key = teamsById.get(task.teamId)?.key ?? '…';
    return task.number === null ? `${key}-…` : formatIdentifier(key, task.number);
  };
}
