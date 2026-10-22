import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import type { RouterContext } from '../app/router-context';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-24">
      <h1 className="text-xl font-semibold font-display">Nothing here</h1>
      <p className="text-fg-muted">The page doesn’t exist, or you don’t have access to it.</p>
      <Link to="/" className="text-accent-text underline-offset-4 hover:underline">
        Go to your workspace
      </Link>
    </main>
  );
}
