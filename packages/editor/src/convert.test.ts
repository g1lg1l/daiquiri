import type { JsonValue, RichDocument } from '@daiq/domain';
import { documentToHtml, documentToMarkdown, markdownToDocument } from './convert';
import { sanitizeHtml } from './sanitize';
import { isSafeHref } from './schema';

const doc = (...content: JsonValue[]): RichDocument => ({ type: 'doc', content });
const paragraph = (...content: JsonValue[]): JsonValue => ({ type: 'paragraph', content });

// Classic XSS vectors (OWASP cheat sheet subset). None may survive sanitising.
const PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<script>alert(1)</script>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<iframe src="https://evil.example"></iframe>',
  '<p style="background:url(javascript:alert(1))">x</p>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<form action="https://evil.example"><input type="submit"></form>',
  '<div onclick="alert(1)">click</div>',
  '<input type="text" value="x" onfocus="alert(1)" autofocus>',
];

describe('sanitizeHtml', () => {
  it.each(PAYLOADS)('neutralises %s', (payload) => {
    const clean = sanitizeHtml(payload).toLowerCase();
    expect(clean).not.toMatch(
      /<script|onerror|onload|onclick|onfocus|javascript:|data:text|<iframe|<form|<svg|<math|style=/,
    );
  });

  it('keeps safe formatting and hardens links', () => {
    const clean = sanitizeHtml('<p><strong>Hi</strong> <a href="https://daiq.dev">link</a></p>');
    expect(clean).toContain('<strong>Hi</strong>');
    expect(clean).toContain('href="https://daiq.dev"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe('isSafeHref', () => {
  it.each(['https://x.dev', 'http://x.dev', 'mailto:a@b.c', '/acme/inbox'])('allows %s', (href) =>
    expect(isSafeHref(href)).toBe(true),
  );
  it.each([
    'javascript:alert(1)',
    '//evil.example',
    'data:text/html,x',
    'vbscript:x',
    'file:///etc/passwd',
  ])('rejects %s', (href) => expect(isSafeHref(href)).toBe(false));
});

describe('document conversion', () => {
  it('renders documents to sanitised HTML without a browser editor', () => {
    const html = documentToHtml(
      doc(
        paragraph(
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
        ),
        paragraph({ type: 'text', text: '<img src=x onerror=alert(1)>' }),
      ),
    );
    expect(html).toContain('<strong>world</strong>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('drops javascript: links stored in a document', () => {
    const html = documentToHtml(
      doc(
        paragraph({
          type: 'text',
          text: 'click',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        }),
      ),
    );
    expect(html).not.toContain('javascript:');
  });

  it('round-trips common Markdown', () => {
    const markdown =
      '# Title\n\nSome **bold** and `code`.\n\n- one\n- two\n\n- [ ] todo\n- [x] done';
    const parsed = markdownToDocument(markdown);
    const types = (parsed.content ?? []).map((node) =>
      typeof node === 'object' && node !== null && !Array.isArray(node) ? node.type : null,
    );
    expect(types).toEqual(['heading', 'paragraph', 'bulletList', 'taskList']);
    const back = documentToMarkdown(parsed);
    expect(back).toContain('# Title');
    expect(back).toContain('**bold**');
    expect(back).toMatch(/- \[x\] done/);
  });
});
