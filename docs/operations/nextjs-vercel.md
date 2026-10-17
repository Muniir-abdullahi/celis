# Next.js and Vercel

The root project builds with Next.js 16.3.6 and React 19.3.0. Vercel should use
the repository root, install with pnpm, and run `pnpm build`; the Next.js
integration supplies the app and Route Handler deployment output. There is no
catch-all Vercel rewrite because it would intercept API requests.
The Framework Preset must be **Next.js**, with no Output Directory override.
`vercel.json` pins the framework so an older "Other" preset cannot publish only
static assets and return a Vercel 404 for application routes.

## Required Environment Variables

If sign-in reports a connection failure, check the configured Supabase project's
`/auth/v1/health` endpoint from the same environment as the Next.js process.
Supply the configured anon key as the `apikey` header without logging it.
Check DNS, VPN/proxy settings, and outbound HTTPS connectivity before changing
credentials. A successful health response confirms reachability at that moment;
it does not validate a user's password. Restart the dev server after changing
environment variables. Do not bypass Supabase authentication to recover access.

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

All marketplace, auth, seller, admin, legal, and mobile API routes are native
Next.js App Router pages or Route Handlers. Protected account, dashboard,
notification, and admin routes verify the Supabase session and permissions on
the server. Home and browse load live marketplace data through existing server
actions; search reads filters from the URL and renders results on the server.
Shared auth, theme, and query providers mount from the Next root layout, and
shared navigation uses Next.js links. The legacy TanStack Router tree and Vite
configuration have been removed; TanStack Query remains for client-side cache
management.

2026-10-16 sign-in verification: authenticated Supabase health checks returned
HTTP 200 twice, and a direct SDK sign-in with the supplied development admin
credentials succeeded. This verifies the provider/account at test time, not the
full Next.js cookie/database path. TypeScript and 10 focused auth/payment tests
pass. No authentication bypass or credential changes were introduced. Lint and
production-build limitations remain as recorded for v1.6.6.

Follow-up verification for v1.6.8: the running Next.js sign-in action returned
success and session cookies; requesting `/dashboard` with those cookies returned
the expected admin redirect to `/admin`. Three earlier Next.js sign-in attempts
also succeeded. Both resolved provider IPv4 addresses returned health HTTP 200.
The intermittent network cause was not reproduced. A single transport retry is
now covered by focused tests (15 auth/payment checks pass), and TypeScript passes.
If a failure recurs, inspect `[supabase-network]` for the transport error code;
never print the action's credentials, session cookies, or tokens.
