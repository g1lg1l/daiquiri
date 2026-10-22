import { useAuthActions } from '@daiq/data';
import { safeRedirectPath } from '@daiq/domain';
import { Button, FieldError, Input, Label } from '@daiq/ui';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { AuthLayout } from '../features/auth/auth-layout';
import { useSubmit } from '../features/auth/use-form-error';
import { formString } from '../lib/forms';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.status === 'signed-in' && !context.auth.isAnonymous) {
      throw redirect({ to: safeRedirectPath(search.redirect) });
    }
  },
  component: Login,
});

function Login() {
  const { redirect: target } = Route.useSearch();
  const navigate = useNavigate();
  const auth = useAuthActions();
  const { pending, error, run } = useSubmit();
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [linkSent, setLinkSent] = useState(false);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = formString(form, 'email');
    void run(async () => {
      if (mode === 'link') {
        await auth.sendMagicLink(email, `${window.location.origin}${import.meta.env.BASE_URL}`);
        setLinkSent(true);
      } else {
        await auth.signInWithPassword(email, formString(form, 'password'));
        await navigate({ to: safeRedirectPath(target) });
      }
    });
  };

  if (linkSent) {
    return (
      <AuthLayout title="Check your email">
        <p className="text-fg-muted">
          We sent you a sign-in link. Open it in this browser to continue.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in"
      footer={
        <div className="flex flex-col gap-2">
          <span>
            New to Daiquiri?{' '}
            <Link to="/signup" className="text-accent-text hover:underline">
              Create an account
            </Link>
          </span>
          <span>
            Just looking?{' '}
            <Link to="/demo" className="text-accent-text hover:underline">
              Try the demo workspace
            </Link>
          </span>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate={false}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        {mode === 'password' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
        )}
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {mode === 'password' ? 'Sign in' : 'Email me a sign-in link'}
        </Button>
        <Button
          type="button"
          variant="link"
          className="self-start"
          onClick={() => setMode(mode === 'password' ? 'link' : 'password')}
        >
          {mode === 'password' ? 'Use a sign-in link instead' : 'Use a password instead'}
        </Button>
      </form>
    </AuthLayout>
  );
}
