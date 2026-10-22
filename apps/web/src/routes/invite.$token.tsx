import { useAcceptInvitation, useInvitationPreview } from '@daiq/data';
import { Button, FieldError, Skeleton } from '@daiq/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AuthLayout } from '../features/auth/auth-layout';
import { useSubmit } from '../features/auth/use-form-error';
import { requireAuth } from '../app/router-context';

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
      <AuthLayout title="Joining workspace">
        <Skeleton className="h-10 w-full" />
      </AuthLayout>
    );
  }
  if (!preview.data) {
    return (
      <AuthLayout title="This invitation can’t be used">
        <p className="text-fg-muted">
          It may have expired, been revoked, or already been accepted. Ask for a new one.
        </p>
      </AuthLayout>
    );
  }
  const invitation = preview.data;
  return (
    <AuthLayout title={`Join ${invitation.workspace_name}`}>
      <p className="mb-6 text-fg-muted">
        You were invited as <strong className="text-fg">{invitation.role}</strong> (
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
        Accept invitation
      </Button>
    </AuthLayout>
  );
}
