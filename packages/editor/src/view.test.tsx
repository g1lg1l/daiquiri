import { render } from '@testing-library/react';
import { RichTextView } from './view';

describe('RichTextView', () => {
  it('renders documents as elements and never executes stored markup', () => {
    const { container } = render(
      <RichTextView
        doc={{
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'bad',
                  marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                },
              ],
            },
            {
              type: 'paragraph',
              content: [{ type: 'mention', attrs: { id: 'u1', label: 'Ana' } }],
            },
          ],
        }}
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('javascript:');
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('@Ana');
  });
});
