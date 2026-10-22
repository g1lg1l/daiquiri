import { toDaiqError, useAuth, useAuthActions, useCreateDemoWorkspace } from '@daiq/data';
import { Button } from '@daiq/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { AuthLayout } from '../features/auth/auth-layout';

export const Route = createFileRoute('/demo')({ component: Demo });

/** Signs the visitor in anonymously and opens a private, disposable sandbox workspace. */
function Demo() {
  const auth = useAuth();
  const actions = useAuthActions();
  const createDemo = useCreateDemoWorkspace();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (auth.status === 'signed-out' && !started.current) {
      started.current = true;
      actions.signInAnonymously().catch((cause: unknown) => setError(toDaiqError(cause).message));
    }
  }, [auth.status, actions]);

  const signedIn = auth.status === 'signed-in';
  const { mutate } = createDemo;
  useEffect(() => {
    if (!signedIn) return;
    mutate(undefined, {
      onSuccess: (workspace) =>
        void navigate({
          to: '/$workspace/team/$teamKey/tasks',
          params: { workspace: workspace.slug, teamKey: 'ENG' },
        }),
      onError: (cause) => setError(toDaiqError(cause).message),
    });
  }, [signedIn, mutate, navigate]);

  return (
    <AuthLayout title={error ? 'The demo could not start' : 'Preparing your demo workspace…'}>
      {error ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-fg-muted">{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-fg-muted" aria-live="polite">
          You’ll get a private copy of a sample company with three teams, projects and tasks. It
          disappears after 24 hours.
        </p>
      )}
    </AuthLayout>
  );
}
