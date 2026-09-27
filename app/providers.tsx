"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "~/lib/auth-context";
import { ThemeProvider } from "~/lib/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
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
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider initialUser={null}>{children}</AuthProvider>
      </ThemeProvider>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
}
