/** Recently viewed items, shown when the palette opens with an empty query. */
export interface RecentItem {
  kind: 'task' | 'project';
  id: string;
  title: string;
  subtitle: string | null;
}

const KEY = 'daiq-recent';
const LIMIT = 8;

function key(workspaceId: string) {
  return `${KEY}:${workspaceId}`;
}

export function readRecent(workspaceId: string): RecentItem[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key(workspaceId)) ?? '[]');
    return Array.isArray(raw) ? raw.filter(isRecentItem) : [];
  } catch {
    return [];
  }
}

function isRecentItem(value: unknown): value is RecentItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value.kind === 'task' || value.kind === 'project') &&
    'id' in value &&
    typeof value.id === 'string' &&
    'title' in value &&
    typeof value.title === 'string'
  );
}

export function rememberRecent(workspaceId: string, item: RecentItem): void {
  try {
    const next = [item, ...readRecent(workspaceId).filter((r) => r.id !== item.id)].slice(0, LIMIT);
    localStorage.setItem(key(workspaceId), JSON.stringify(next));
  } catch {
    // Recents are a convenience; storage can be unavailable.
  }
}
