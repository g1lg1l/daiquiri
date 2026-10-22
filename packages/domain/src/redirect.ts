/**
 * Returns a safe in-app path to navigate to after sign-in. Only same-origin
 * relative paths are allowed (prevents open redirects, threat T12).
 */
export function safeRedirectPath(candidate: string | null | undefined, fallback = '/'): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return fallback;
  }
  try {
    const url = new URL(candidate, 'https://daiq.invalid');
    return url.origin === 'https://daiq.invalid' ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
