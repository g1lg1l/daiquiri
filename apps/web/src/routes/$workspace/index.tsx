import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/$workspace/')({
  component: function WorkspaceHome() {
    const { workspace } = Route.useParams();
    return <Navigate to="/$workspace/my-tasks" params={{ workspace }} replace />;
  },
});
