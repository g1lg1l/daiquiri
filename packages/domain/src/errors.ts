/**
 * Typed application error. `code` is stable and machine-readable; `message`
 * is safe to show to users. The original error (if any) is kept as `cause`.
 */
export type DaiqErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export class DaiqError extends Error {
  override readonly name = 'DaiqError';

  constructor(
    readonly code: DaiqErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export function isDaiqError(error: unknown): error is DaiqError {
  return error instanceof DaiqError;
}
