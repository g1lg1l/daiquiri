import { attachmentPath, formatBytes, isPreviewableImage, safeFileName } from './attachments';

describe('attachments', () => {
  it('previews raster images only, never SVG or HTML', () => {
    expect(isPreviewableImage('image/png')).toBe(true);
    expect(isPreviewableImage('IMAGE/JPEG')).toBe(true);
    expect(isPreviewableImage('image/svg+xml')).toBe(false);
    expect(isPreviewableImage('text/html')).toBe(false);
  });

  it('keeps file names safe as one path segment', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\me\\Q3 report?.pdf')).toBe('Q3 report-.pdf');
    expect(safeFileName('.env')).toBe('env');
    expect(safeFileName('\u0000')).toBe('file');
    const long = `${'a'.repeat(200)}.tar.gz`;
    expect(safeFileName(long)).toHaveLength(120);
    expect(safeFileName(long).endsWith('.gz')).toBe(true);
  });

  it('builds the storage path from workspace, task and attachment', () => {
    expect(attachmentPath('w', 't', 'a', 'my file.png')).toBe('w/t/a/my file.png');
  });

  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });
});
