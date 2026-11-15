# Operations Runbook

## Local Development

The web app runs on Next.js 16 App Router. Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` alongside the existing
server-only database and Supabase settings.

Commands:

```bash
pnpm dev
pnpm typecheck
pnpm build
pnpm lint
```

Database:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
pnpm db:push
```

Scripts:

```bash
pnpm db:seed-admin
pnpm storage:create-bucket
pnpm cron:expire-listings
```

## Migrations & Seeding

Rules:

- Commit Drizzle schema and generated migrations together.
- Keep seed scripts deterministic.
- `drizzle/0032_*`, `0033_*` and `0034_conditional_warranty_fields.sql` are
  hand-written and not in `drizzle/meta/_journal.json`; apply them with
  `psql "$DIRECT_URL" -f <file>` (or the Supabase SQL editor) in order. Each has
  a `.down.sql` to revert. `0034` adds the "Warranty available?" parent field
  to every category with `warranty_months`, makes the duration conditional
  (1–120 whole months) and backfills existing listings without removing values.
- Document new tables in `docs/domain/marketplace.md`.
- Add indexes for repeated admin filters/search/sorts.

## Listing Expiry Cron

Key file:

- `scripts/expire-listings.ts`

Rules:

- Expiry behavior must match listing lifecycle rules.
- Expiry changes can affect seller package value and marketplace trust.
- Log enough information to support audit/debugging.
- Test expiry logic with active, expired, and boundary-time listings when test tooling exists.
