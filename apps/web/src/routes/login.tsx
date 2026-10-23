import { useAuthActions } from '@daiq/data';
import { safeRedirectPath } from '@daiq/domain';
import { Button, FieldError, Input, Label } from '@daiq/ui';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { AuthLayout } from '../features/auth/auth-layout';
import { useSubmit } from '../features/auth/use-form-error';
import { m } from '../i18n/auth';
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
      <AuthLayout title={m.auth.login.checkEmail}>
        <p className="text-fg-muted">{m.auth.login.linkSent}</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={m.auth.signIn}
      footer={
        <div className="flex flex-col gap-2">
          <span>
            {m.auth.login.newHere}{' '}
            <Link to="/signup" className="text-accent-text hover:underline">
              {m.auth.login.createAccount}
            </Link>
          </span>
          <span>
            {m.auth.login.justLooking}{' '}
            <Link to="/demo" className="text-accent-text hover:underline">
              {m.auth.login.tryDemo}
            </Link>
          </span>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate={false}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{m.auth.email}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        {mode === 'password' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{m.auth.password}</Label>
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
          {mode === 'password' ? m.auth.signIn : m.auth.login.sendLink}
        </Button>
        <Button
          type="button"
          variant="link"
          className="self-start"
          onClick={() => setMode(mode === 'password' ? 'link' : 'password')}
        >
          {mode === 'password' ? m.auth.login.linkInstead : m.auth.login.passwordInstead}
        </Button>
      </form>
    </AuthLayout>
  );
}
