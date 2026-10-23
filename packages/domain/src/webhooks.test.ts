import { isSafeWebhookUrl } from './webhooks';

describe('webhook URLs', () => {
  it('allows public https endpoints', () => {
    expect(isSafeWebhookUrl('https://hooks.zapier.com/hooks/catch/1/abc')).toBe(true);
    expect(isSafeWebhookUrl('https://api.example.org:443/in')).toBe(true);
  });

  it.each([
    'http://hooks.zapier.com/x',
    'https://10.0.0.5/x',
    'https://169.254.169.254/latest',
    'https://[::1]/x',
    'https://localhost/x',
    'https://kong:8000/x',
    'https://api.example.org:8443/x',
    'https://db.internal/x',
    'https://printer.local/x',
    'https://user@evil.com/x',
  ])('refuses %s, which could reach inside', (url) => {
    expect(isSafeWebhookUrl(url)).toBe(false);
  });
});
