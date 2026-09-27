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

The browse, privacy, and terms screens are now native App Router pages. The
browse page loads featured listings and categories through the existing server
actions. Shared auth, theme, and query providers mount from the Next root
layout, and the shared site header, footer, and notification menu use Next
navigation. Other marketplace screens still run through TanStack Router inside
the Next catch-all page. Continue moving screens to App Router, then remove
TanStack Router/Start and the unused Vite configuration and dependencies.
