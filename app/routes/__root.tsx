import { createRootRoute, Outlet } from "@tanstack/react-router";
import { fetchCurrentUser } from "~/server/auth.functions";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
  beforeLoad: async () => ({ user: await fetchCurrentUser() }),
});

function RootComponent() {
  return <Outlet />;
}

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-celis-ink-secondary">
        The page you’re looking for doesn’t exist on Celis.
      </p>
    </main>
  );
}
