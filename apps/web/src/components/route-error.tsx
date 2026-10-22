import { isDaiqError } from '@daiq/domain';
import { Button } from '@daiq/ui';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useEffect } from 'react';
import { logger } from '../lib/logger';

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => logger.error('route.error', error), [error]);
  const message = isDaiqError(error) ? error.message : 'This page failed to load.';
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-20">
      <h1 className="text-lg font-semibold font-display">{message}</h1>
      <p className="text-fg-muted">Try again. If it keeps happening, reload the app.</p>
      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Try again
        </Button>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    </div>
  );
}
