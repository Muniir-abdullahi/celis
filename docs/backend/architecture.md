# Backend Architecture

This guide covers Next.js Server Actions and Route Handlers, Drizzle/Postgres,
Supabase storage, validation, and errors.

## Server Actions and Route Handlers

Server/data behavior lives under `app/server`.

Patterns:

- `*.server.ts` for data access and server-side operations.
- `*.functions.ts` for exported Next.js Server Actions (`"use server"`).
- `app/api/**/route.ts` for HTTP integrations, mobile endpoints, and webhooks.
- `app/lib/supabase/server.ts` reads and writes Supabase auth cookies through
  Next.js `cookies()` in the action or route-handler request context.

Rules:

- Keep server files focused.
- Split large server modules into query and mutation modules when needed.
- Validate every Server Action input with Zod, even when called by our own UI.
- Enforce RBAC on the server.
- Use transactions for multi-record writes.
- Return only the data the UI needs.
- Avoid unbounded queries.

## Drizzle & Postgres

Key files:

- `app/db/schema/*.ts`
- `app/db/index.ts`
- `drizzle/*.sql`
- `drizzle/meta/*.json`
- `drizzle.config.ts`

Rules:

- Use Drizzle ORM and schema types.
- Avoid raw SQL unless documented.
- Add indexes for repeated filter/search/sort paths.
- Keep migrations committed with schema changes.
- Use transactions for order, payment, payout, package, moderation, and RBAC mutations.
- Update `docs/domain/marketplace.md` when tables or relationships change.

## Supabase Storage

The mobile account privacy boundary and limited public identity RPC are
documented in `docs/backend/mobile-account-privacy.md`.

Key files:

- `app/lib/supabase/client.ts`
- `app/lib/supabase/server.ts`
- `app/server/storage.server.ts`
- `app/server/storage.functions.ts`
- `scripts/create-storage-bucket.ts`
- `scripts/create-storage-bucket.mjs`

Rules:

- Keep storage operations in storage server modules.
- Validate file type, size, and ownership.
- Listing image changes should remain tied to listing ownership and moderation rules.
- Storage setup changes must update operations docs.

## Validation & Errors

Sign-in returns a discriminated success/error result for validation and Supabase
authentication failures. The form shows the returned message and does not
refresh or navigate on failure. Network failures and provider outages show a
retry message; invalid credentials, rate limits, and unconfirmed email addresses
have separate messages. Provider internals are not returned. Unexpected local
database failures still propagate as server errors.

Sign-up also returns a success/error result so the form can show recoverable
setup failures without exposing a framework error digest. If Supabase Auth
created an account before local `users`/`profiles` provisioning failed, a retry
must authenticate with that account's password before repairing the local
records. Existing profile data is preserved during that recovery path.

### Password recovery

Password recovery uses Supabase Auth `resetPasswordForEmail` with the
application's configured SMTP provider (Brevo). Configure the production
Supabase Auth SMTP settings and allowlist `https://www.celis.so/auth/reset-password`
as a redirect URL (the production recovery link uses the canonical `www` host).
Keep the Supabase Site URL set to `https://www.celis.so` as well. The request action always returns the same success response so
unknown addresses cannot be enumerated. The recovery link establishes a
short-lived Supabase recovery session; the reset form changes the password
through `auth.updateUser`, so no app-generated reset token or email address is
returned in a URL or stored in the legacy `password_resets` table. Provider
errors are logged server-side and the UI remains generic.

The cookie-based Supabase server client uses `app/lib/supabase/fetch.ts` with
`cache: no-store`. It retries one transport failure for auth GET requests and
password token exchanges, retaining the request body and headers. It does not
retry HTTP responses, canceled requests, refresh-token exchanges, or account
writes. Network logs contain only an error code and retry flag, never credentials.

Rules:

- Use Zod for user input.
- Validate route params, search params, and form data.
- Keep validation close to the Server Action or shared when reused.
- Return clear user-facing errors for recoverable marketplace actions.
- Do not leak secrets, database internals, or stack traces.
- Payment/payout errors need enough logging/audit context for support.
