const KEY = 'daiq-last-workspace';

export function rememberWorkspace(slug: string): void {
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    // Storage may be unavailable (private mode); remembering is a convenience only.
  }
}

export function lastWorkspace(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
