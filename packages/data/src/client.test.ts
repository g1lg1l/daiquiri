import { fetchWithDeadline } from './client';

describe('fetchWithDeadline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('gives database API calls a deadline and leaves other requests alone', async () => {
    const seen: (AbortSignal | null | undefined)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        seen.push(init?.signal);
        return Promise.resolve(new Response('{}'));
      }),
    );
    await fetchWithDeadline('https://db.example.com/rest/v1/tasks');
    await fetchWithDeadline('https://db.example.com/storage/v1/object/attachments/a.png');
    expect(seen[0]).toBeInstanceOf(AbortSignal);
    expect(seen[1]).toBeUndefined();
  });

  it('keeps the caller’s own abort signal working', async () => {
    let received: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        received = init?.signal ?? undefined;
        return Promise.resolve(new Response('{}'));
      }),
    );
    const caller = new AbortController();
    await fetchWithDeadline('https://db.example.com/rest/v1/tasks', { signal: caller.signal });
    caller.abort();
    expect(received?.aborted).toBe(true);
  });
});
