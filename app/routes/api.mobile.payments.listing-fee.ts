import { createFileRoute } from "@tanstack/react-router";

// The mobile payment endpoint is now implemented as a Next.js Route Handler at
// app/api/mobile/payments/listing-fee/route.ts. This client route remains only
// until the generated TanStack route tree is retired.
export const Route = createFileRoute("/api/mobile/payments/listing-fee")({
  component: () => null,
});
