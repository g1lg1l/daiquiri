import { toDaiqError } from '@daiq/data';
import { useState } from 'react';

/** Runs an async submit, exposing a pending flag and a user-facing error message. */
export function useSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(toDaiqError(cause).message);
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run, setError };
}
