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
