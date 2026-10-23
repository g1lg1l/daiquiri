import { useAcceptInvitation, useInvitationPreview } from '@daiq/data';
import { Button, FieldError, Skeleton } from '@daiq/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AuthLayout } from '../features/auth/auth-layout';
import { useSubmit } from '../features/auth/use-form-error';
import { requireAuth } from '../app/router-context';
import { m } from '../i18n/auth';

export const Route = createFileRoute('/invite/$token')({
  beforeLoad: requireAuth,
  component: Invite,
});

function Invite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();
  const { pending, error, run } = useSubmit();

  if (preview.isPending) {
    return (
      <AuthLayout title={m.auth.invite.joining}>
        <Skeleton className="h-10 w-full" />
      </AuthLayout>
    );
  }
  if (!preview.data) {
    return (
      <AuthLayout title={m.auth.invite.unusable}>
        <p className="text-fg-muted">{m.auth.invite.unusableHint}</p>
      </AuthLayout>
    );
  }
  const invitation = preview.data;
  return (
    <AuthLayout title={m.auth.invite.join(invitation.workspace_name)}>
      <p className="mb-6 text-fg-muted">
        {m.auth.invite.invitedAs}{' '}
        <strong className="text-fg">{m.auth.invite.roles[invitation.role]}</strong> (
        {invitation.email}).
      </p>
      {error && <FieldError className="mb-4">{error}</FieldError>}
      <Button
        variant="primary"
        size="lg"
        disabled={pending}
        onClick={() =>
          void run(async () => {
            const workspace = await accept.mutateAsync(token);
            await navigate({ to: '/$workspace', params: { workspace: workspace.slug } });
          })
        }
      >
        {m.auth.invite.accept}
      </Button>
    </AuthLayout>
  );
}
