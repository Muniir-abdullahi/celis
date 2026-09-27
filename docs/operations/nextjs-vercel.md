# Next.js and Vercel

The root project builds with Next.js 16.3.6 and React 19.3.0. Vercel should use
the repository root, install with pnpm, and run `pnpm build`; the Next.js
integration supplies the app and Route Handler deployment output. There is no
catch-all Vercel rewrite because it would intercept API requests.

## Required Environment Variables

Configure these for local development and in Vercel's Production and Preview
environments as appropriate:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `APP_URL`
- `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`
- `FIREBASE_SERVICE_ACCOUNT` when push notifications are enabled

Never prefix service-role, database, payment encryption, or provider secrets
with `NEXT_PUBLIC_`.

## Migration Status

Marketplace UI routes still run through the existing TanStack client router
inside the Next.js catch-all page. The server-function modules have been
converted to validated Next.js Server Actions, and the mobile listing-fee
endpoint is a Next.js Route Handler. Remaining work is to move each screen to
the Next.js App Router, then remove TanStack Router/Start and the unused Vite
configuration and dependencies.
