/*
 * Task attachments (feature spec P2). Files live in the private `attachments`
 * bucket at {workspace}/{task}/{attachment}/{file name}.
 */

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Raster images only: user files are never rendered as SVG or HTML in the app. */
const PREVIEWABLE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']);

export function isPreviewableImage(mimeType: string): boolean {
  return PREVIEWABLE.has(mimeType.toLowerCase());
}

/** A file name safe as the last segment of a storage path; keeps the extension. */
export function safeFileName(name: string): string {
  // Strip folders, control characters and characters storage keys reject.
  const base = name.split(/[/\\]/).pop() ?? '';
  const cleaned = base
    // Control characters are exactly what this removes.
    // oxlint-disable-next-line no-control-regex
    .replaceAll(/[\u0000-\u001f\u007f]/g, '')
    .replaceAll(/[#%?*:<>|"{}^`[\]~]/g, '-')
    .trim()
    .replace(/^\.+/, '');
  if (!cleaned) return 'file';
  if (cleaned.length <= 120) return cleaned;
  const dot = cleaned.lastIndexOf('.');
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : '';
  return cleaned.slice(0, 120 - extension.length) + extension;
}

export function attachmentPath(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `${workspaceId}/${taskId}/${attachmentId}/${safeFileName(fileName)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
