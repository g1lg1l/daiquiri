/*
 * Structured client logging (ADR-0015). Events have a stable `event` name and
 * context fields; in production only warnings and errors are emitted, and an
 * optional reporter can forward them.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: Level;
  event: string;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

type Reporter = (entry: LogEntry) => void;
let reporter: Reporter | null = null;

export function setLogReporter(next: Reporter | null): void {
  reporter = next;
}

function emit(entry: LogEntry): void {
  if (entry.level === 'warn' || entry.level === 'error') {
    const write = entry.level === 'warn' ? console.warn : console.error;
    write(`[daiq] ${entry.event}: ${entry.message}`, entry.context ?? '', entry.error ?? '');
    reporter?.(entry);
  } else if (import.meta.env.DEV) {
    console.warn(`[daiq:${entry.level}] ${entry.event}: ${entry.message}`, entry.context ?? '');
  }
}

export const logger = {
  debug: (event: string, message: string, context?: Record<string, unknown>) =>
    emit({ level: 'debug', event, message, ...(context && { context }) }),
  info: (event: string, message: string, context?: Record<string, unknown>) =>
    emit({ level: 'info', event, message, ...(context && { context }) }),
  warn: (event: string, message: string, context?: Record<string, unknown>) =>
    emit({ level: 'warn', event, message, ...(context && { context }) }),
  error: (event: string, error: unknown, context?: Record<string, unknown>) =>
    emit({
      level: 'error',
      event,
      message: error instanceof Error ? error.message : String(error),
      error,
      ...(context && { context }),
    }),
};
