# Next.js and Vercel

The root project builds with Next.js 16.4.6 and React 19.3.0. Vercel should use
the repository root, install with pnpm, and run `pnpm build`; the Next.js
integration supplies the app and Route Handler deployment output. There is no
catch-all Vercel rewrite because it would intercept API requests.
The Framework Preset must be **Next.js**, with no Output Directory override.
`vercel.json` pins the framework so an older "Other" preset cannot publish only
static assets and return a Vercel 404 for application routes.

## Dependency security maintenance

The 2026-11-23 security refresh upgrades Next.js to 16.4.6, Firebase Admin to
14.5.1, and Zod to 4.6.7. Both `package-lock.json` and `pnpm-lock.yaml` contain
the patched resolutions. Keep npm `overrides` and `pnpm.overrides` aligned:
pnpm 9 does not apply the top-level npm overrides. Run both `npm audit` and
`pnpm audit` when updating the two lockfiles.

Firebase's upstream `node-fetch` / `fetch-blob` chain still includes deprecated
`node-domexception`; it has no reported audit finding at this verification.
The deprecated `glob` chain was removed by the Firebase upgrade.

The guarded `_global-error` build patch was reviewed against Next.js 16.4.6;
its target still uses the same synthetic-route classification. Review the
patch before each Next.js version update.

Verification on 2026-11-23: both audits report zero vulnerabilities;
`pnpm typecheck` and eight focused account/metadata validation tests pass.
The full suite reports 101 passing and three failing checks (two obsolete
`app/routes/admin` file references and a public-profile SQL assertion).
Production compilation and build TypeScript checks pass, but page-data
collection stops because local database/Supabase environment variables are
absent. Lint cannot start because ESLint is not installed/configured here.

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
