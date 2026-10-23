import { useAuthActions } from '@daiq/data';
import { Button, FieldError, Input, Label } from '@daiq/ui';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AuthLayout } from '../features/auth/auth-layout';
import { useSubmit } from '../features/auth/use-form-error';
import { m } from '../i18n/auth';
import { formString } from '../lib/forms';

export const Route = createFileRoute('/signup')({ component: Signup });

function Signup() {
  const navigate = useNavigate();
  const auth = useAuthActions();
  const { pending, error, run } = useSubmit();
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = formString(form, 'email');
    void run(async () => {
      const { needsConfirmation } = await auth.signUp(
        email,
        formString(form, 'password'),
        formString(form, 'name').trim(),
        `${window.location.origin}${import.meta.env.BASE_URL}onboarding`,
      );
      if (needsConfirmation) setConfirmEmail(email);
      else await navigate({ to: '/onboarding' });
    });
  };

  if (confirmEmail) {
    return (
      <AuthLayout title={m.auth.signup.confirmTitle}>
        <p className="text-fg-muted">
          {m.auth.signup.confirmSentTo} <strong className="text-fg">{confirmEmail}</strong>
          {m.auth.signup.confirmOpen}
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={m.auth.signup.title}
      footer={
        <span>
          {m.auth.signup.haveAccount}{' '}
          <Link to="/login" className="text-accent-text hover:underline">
            {m.auth.signIn}
          </Link>
        </span>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{m.auth.signup.name}</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={80} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{m.auth.signup.workEmail}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{m.auth.password}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="text-xs text-fg-subtle">{m.auth.signup.passwordHint}</p>
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {m.auth.signup.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
