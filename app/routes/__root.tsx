import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "~/lib/auth-context";
import { ThemeProvider } from "~/lib/theme-provider";
import { fetchCurrentUser } from "~/server/auth.functions";
import type { CurrentUser } from "~/server/auth.server";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
  beforeLoad: async () => ({ user: await fetchCurrentUser() }),
});

function RootComponent() {
  const { user } = Route.useRouteContext();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (error instanceof Response && error.status === 401) return false;
              return failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider initialUser={(user as CurrentUser | null) ?? null}>
          <Outlet />
        </AuthProvider>
      </ThemeProvider>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
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
