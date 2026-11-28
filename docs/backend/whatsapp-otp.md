# WhatsApp OTP delivery through Celis

Supabase Auth still generates, rate-limits and verifies phone OTPs and creates
sessions. Its HTTPS Send SMS Hook can now call Celis directly, replacing the
`whatsapp-otp` Edge Function after deployment and verification. Mobile continues
to call `signInWithOtp`, `updateUser({ phone })` and `verifyOtp`; it never sends
a custom OTP or holds a WAHA credential.

## Endpoints

- `POST /api/auth/send-sms`: Supabase server-to-server webhook. Verifies the raw
  body with `standardwebhooks`, including signed timestamp tolerance. Invalid or
  missing signatures return 401, invalid payloads 400, oversized bodies 413,
  and missing configuration/persistence failures 503 with the Supabase hook
  error shape. It accepts only a phone number and numeric 6–10 digit OTP, and
  generates the fixed Celis message itself. No mobile bearer-token endpoint or
  arbitrary-message endpoint is exposed.
- `GET /api/internal/auth-deliveries`: retry and cleanup worker, protected by an
  exact `Authorization: Bearer <AUTH_DELIVERY_CRON_SECRET>` token. It fails
  closed if the secret is missing or shorter than 32 characters. Configure a
  trusted scheduler to call this every minute. Do not put the token in a URL.

The hook must respond within Supabase's short timeout. WAHA can take longer,
so the hook commits a durable encrypted outbox record before returning 200 `{}`.
Next.js `after()` wakes an immediate worker, with up to 60 seconds route duration.
A missed wake-up or interrupted process is recovered by the scheduled worker.
**200 means queued**, not delivered; **sent** means WAHA accepted the request,
not proof of handset receipt. Configure the retry scheduler before cutover.
No scheduler is silently provisioned in `vercel.json`; use a supported Vercel
plan or an external scheduler. This is required for retries and expiry cleanup.

## Data and privacy

Migration `0040_fine_ted_forrester.sql` creates `auth_message_deliveries` with
RLS enabled and no client policies. Only the trusted server database connection
may access the outbox. There are no plaintext OTP/phone columns. The minimal
payload is encrypted with AES-256-GCM, a random nonce and a dedicated key;
authenticated data binds ciphertext to its webhook ID. The payment encryption
key is not reused. Keep the key consistent across all web instances.

Webhook IDs are unique and retained for 24 hours; retries of the same signed
event cannot create another job or resend a completed job. Workers claim rows
with `FOR UPDATE SKIP LOCKED`, a 45-second lease, and an attempt counter used as
a write fence. Failed/interrupted sends are retried at most three times with
15-second backoff, within the configured OTP TTL measured from the signed event
timestamp. A provider call is limited to 15 seconds or remaining TTL, whichever
is shorter. The cron worker processes at most two sends per call.

Timeouts can be ambiguous: WAHA might accept a message before a connection
fails. Recovery is at-least-once delivery, so the same code can arrive twice
after an interruption; it cannot create another login/session or bypass OTP
verification. Supabase resends have distinct event IDs and may invalidate an
earlier code. Avoid requesting repeated resends while a delivery is pending.

Ciphertext is cleared on provider acceptance, terminal failure or expiry
cleanup. Terminal metadata is removed after 24 hours by bounded cleanup batches
(100 records per run). Cleanup requires the scheduler to run. Database backups
may retain historical ciphertext under the platform's backup policy.

Logs include only webhook ID, attempt and a generic or HTTP status error code.
Do not log raw hook bodies, OTPs, phone numbers, provider responses or credentials.
`SET LOCAL statement_timeout` is used only to bound persistence statements to
two seconds for the hook deadline; PostgreSQL row locks handle worker claims.

## Server environment

Set these in the deployed **Celis web server**, never in the mobile `.env`:

| Variable | Purpose |
| --- | --- |
| `SEND_SMS_HOOK_SECRET` | Supabase's signing secret for the active Send SMS hook; supports `v1,whsec_...`, `whsec_...` or raw base64 |
| `WAHA_BASE_URL` | Public HTTPS origin, currently `https://waha.rukun.com.so`; no path, query or embedded credentials |
| `WAHA_API_KEY` | Existing working server API key; the Contabo container uses legacy name `WHATSAPP_API_KEY` |
| `WAHA_SESSION` | Exact working session name, currently **`defualt`** |
| `OTP_DELIVERY_ENCRYPTION_KEY` | Separate random secret, at least 32 characters, stable across instances |
| `AUTH_DELIVERY_CRON_SECRET` | Separate random bearer secret, at least 32 characters, also held by the trusted scheduler |
| `OTP_DELIVERY_TTL_SECONDS` | Default 300; match Supabase phone OTP expiry, supported range 30–600 |
| `DATABASE_URL` | Existing trusted Drizzle database connection |

Generate the two new random secrets independently using
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Use your secret manager; do not paste secrets in issues, commits or chat.
Database query and pool acquisition latency must remain within the hook budget;
deploy the web endpoint near its database and monitor hook response latency.

## Cutover and rollback

1. Reconcile and apply pending migrations through 0040 using the normal migration
   process. Migration 0039 from staff identity must not be assumed applied just
   because it exists locally. Do not run a schema push against production.
2. Set the web environment variables and deploy the code. Protect the deployment
   from public debug logs. The hook URL must be reachable over public HTTPS and
   must not sit behind preview login protection, a browser challenge or redirects.
3. Configure the protected retry/cleanup scheduler to call the drain endpoint
   every minute. Verify a missing/incorrect bearer token gets 401. Configure
   monitoring for queue age, failures and expired jobs; no admin UI is added.
4. In Supabase Authentication > Auth Hooks, change the Send SMS hook endpoint to
   `https://celis.so/api/auth/send-sms`. The URL is proposed until the deployed
   route is verified. Keep the existing signing secret or coordinate its change
   with the server environment. Supabase's signature replaces a user session/JWT
   at this endpoint; do not disable signature verification.
5. The account owner requests one code in the app. Confirm the queue record is
   sent, the WhatsApp message arrives, `verifyOtp` succeeds, and the mobile
   session persists. Test phone-change confirmation too. A mock provider test
   does not establish live delivery. Confirm there are no unexpected expired or
   failed records and that no secrets appear in logs.
6. Only after the new route passes those checks, remove the old `whatsapp-otp`
   Edge Function. Its mobile-repository source remains available for rollback
   until cutover is accepted. Do not delete the shared WAHA session/container.

Rollback: point the Supabase hook back to its previously deployed Edge Function
and restore its matching secrets if needed. Stop draining queued web deliveries
before rollback to avoid delayed duplicate sends. Existing Supabase users,
verification rules and RLS are unchanged. Do not rotate the encryption key
while encrypted jobs remain queued unless intentionally invalidating them.

## Verification

`tests/whatsapp-otp.test.ts` covers signing, tampering, replay time windows,
payload limits, expiry, encryption binding, persistence failures, wake-up
failures, provider request shape, redirection blocking and cron authorization.

`tests/integration/auth-message-deliveries.integration.ts` applies the shipped
migration to a disposable Postgres fixture on `127.0.0.1:55439/postgres`, tests
duplicate inserts/concurrent claims, retries, lease recovery and fencing, RLS,
expiry and retention. It refuses other database targets. Run with
`CELIS_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/postgres` and
`node --import tsx --test tests/integration/auth-message-deliveries.integration.ts`.
Provider calls are stubbed; tests send no messages.

Local verification on 2026-11-28: 15 unit tests and 8 Postgres integration tests
pass, including actual migration execution. The production database, live hook
configuration and Edge Function are not changed by this implementation.
`pnpm typecheck`, Drizzle snapshot checks and the webpack production build pass;
regeneration reports no schema drift. Npm and pnpm audits report zero known
vulnerabilities. The temporary Postgres fixture was stopped after testing.
The default Turbopack build hit a Windows junction permission error; webpack
completed successfully. Lint is unavailable because ESLint is not installed
in this checkout. These are focused checks, not a full-suite or live-login result.

References: [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook),
[Next.js after](https://nextjs.org/docs/app/api-reference/functions/after).
