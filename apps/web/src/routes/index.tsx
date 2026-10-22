import { useWorkspaces } from '@daiq/data';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { Splash } from '../components/splash';
import { lastWorkspace } from '../lib/last-workspace';
import { requireAuth } from '../app/router-context';

export const Route = createFileRoute('/')({
  beforeLoad: requireAuth,
  component: Home,
});

/** Sends the user to their last workspace, the first one, or onboarding. */
function Home() {
  const { auth } = Route.useRouteContext();
  const workspaces = useWorkspaces(auth.userId);
  if (!workspaces.data) return <Splash />;
  const remembered = lastWorkspace();
  const target = workspaces.data.find((w) => w.slug === remembered) ?? workspaces.data[0];
  if (!target) return <Navigate to="/onboarding" />;
  return <Navigate to="/$workspace" params={{ workspace: target.slug }} />;
}
