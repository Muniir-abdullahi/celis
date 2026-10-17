function canRetry(input: RequestInfo | URL, init?: RequestInit) {
  const request = input instanceof Request ? input : null;
  const url = new URL(request?.url ?? String(input));
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  return url.pathname.startsWith("/auth/v1/") && (
    method === "GET" ||
    (method === "POST" && url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password")
  );
}

/** Retry one interrupted auth read/password exchange; never replay account writes. */
export function createSupabaseFetch(transport: typeof fetch): typeof fetch {
  return async (input, init) => {
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    try {
      return await transport(input, { ...init, cache: "no-store" });
    } catch (error) {
      const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined;
      const aborted = signal?.aborted || (error instanceof Error && error.name === "AbortError");
      const retry = !aborted && canRetry(input, init) && !(input instanceof Request);
      console.warn("[supabase-network] connection interrupted", {
        code: cause?.code ?? "UNKNOWN",
        retry,
      });
      if (!retry) throw error;
      return transport(input, { ...init, cache: "no-store" });
    }
  };
}
