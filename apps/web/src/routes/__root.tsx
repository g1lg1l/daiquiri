import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import type { RouterContext } from '../app/router-context';
import { m } from '../i18n';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-24">
      <h1 className="text-xl font-semibold font-display">{m.shell.notFound.title}</h1>
      <p className="text-fg-muted">{m.shell.notFound.body}</p>
      <Link to="/" className="text-accent-text underline-offset-4 hover:underline">
        {m.shell.notFound.home}
      </Link>
    </main>
  );
}
