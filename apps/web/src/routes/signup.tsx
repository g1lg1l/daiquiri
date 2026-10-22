import { useAuthActions } from '@daiq/data';
import { Button, FieldError, Input, Label } from '@daiq/ui';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AuthLayout } from '../features/auth/auth-layout';
import { useSubmit } from '../features/auth/use-form-error';
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
      <AuthLayout title="Confirm your email">
        <p className="text-fg-muted">
          We sent a confirmation link to <strong className="text-fg">{confirmEmail}</strong>. Open
          it to finish creating your account.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="text-accent-text hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={80} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="text-xs text-fg-subtle">At least 8 characters.</p>
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
