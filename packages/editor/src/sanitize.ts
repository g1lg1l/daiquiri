import DOMPurify from 'dompurify';
import { isSafeHref } from './schema';

/*
 * Every HTML string that leaves the editor (export, email, clipboard) passes
 * through this allow-list (threat model T6). Stored content is JSON, never HTML.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'code',
  'pre',
  'span',
  'a',
  'blockquote',
  'hr',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'label',
  'input',
  'div',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'colgroup',
  'col',
];
const ALLOWED_ATTR = [
  'href',
  'rel',
  'target',
  'class',
  'data-type',
  'data-id',
  'data-checked',
  'type',
  'checked',
  'disabled',
  'colspan',
  'rowspan',
  'start',
  'style',
];

let hooked = false;

function purifier() {
  if (!hooked) {
    hooked = true;
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') ?? '';
        if (!isSafeHref(href)) node.removeAttribute('href');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
        node.setAttribute('target', '_blank');
      }
      if (node.tagName === 'INPUT' && node.getAttribute('type') !== 'checkbox') node.remove();
      // Only the column widths emitted by tables may use inline style.
      if (node.hasAttribute('style') && node.tagName !== 'COL') node.removeAttribute('style');
    });
  }
  return DOMPurify;
}

export function sanitizeHtml(html: string): string {
  return purifier().sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false });
}
