# Internal staff identity

Celis assigns one role per user. `roles.domain` separates internal staff from
customers; `users.is_internal`, `users.is_super_admin` and the built-in `admin`
role also identify staff. Authorization remains in existing server permission
checks. An `admin:access` permission alone does not mean the person is an
administrator. The identity panel labels the `admin` role or super-admin flag
as **Admin User**, and other staff as **Internal User**.

## Stored identity and migration

Migration `0039_common_madame_masque.sql` adds unique `users.staff_id` and the
`staff_departments` configuration table. It imports existing department names
before adding a foreign key and backfills existing internal/admin accounts.
The sequence generates `CELIS-000001` style IDs, expands beyond six digits,
allows gaps, and does not recycle numbers when accounts are deleted. A trigger
assigns IDs on insert or when an account becomes staff and prevents changing
an assigned ID, including after role changes. Customers receive no new ID.
Do not reset the sequence. The trigger and backfill use SQL because Drizzle
cannot express conditional immutable identifiers. The generated snapshot and
journal entry accompany the migration.

Departments use an RLS-protected table with no client policies. Read the list
with `users:read`; add departments or assign them with `users:manage`.
Department options are a small configuration vocabulary loaded in full, not
an unbounded staff dataset. Direct anon/authenticated department updates are
blocked by the database trigger. Names remain in `profiles.display_name`.
Staff creation now requires a real full name (1–60 characters); existing
email-derived names are preserved until corrected by an authorized operator.
Blank or absent departments display **Department not assigned**.

`staff-identity.functions.ts` validates actions with Zod, updates staff profiles
and departments in transactions, and records old/new values in audit logs.
Department additions are audited and duplicates rejected. The initial managed
list supports additions; renaming/removing departments is not exposed.
The UI confirms changes and never accepts an editable Staff ID.

## Interface

The expanded staff sidebar displays full name, Staff ID, department and account
type. The collapsed sidebar and mobile header expose the same information in
an accessible dropdown. Names and departments wrap. The server layout supplies
only the identity fields needed by the panel. Revalidation refreshes the shell
after identity edits. Existing permissions and navigation filtering are preserved.

The internal users table includes Staff ID and department, supports Staff ID
search through the existing server pagination, and offers **Edit identity**.
**Add department** and staff creation require `users:manage`.

## Verification and rollout

Apply migration 0039 before deploying this code with the normal reviewed
migration process. Existing migration history includes manually applied SQL;
reconcile the target database's journal before running `db:migrate`.
No live database migration is implied by generation of this file.

Automated tests cover identity labels, administrator classification, distinct
accounts, incomplete identity fallbacks, name validation and rejection of
client-supplied Staff IDs. Existing account-provisioning tests cover role
validation and compensation on transaction failure. Database sequence,
immutability, backfill, FK and concurrent-ID behavior still require a disposable
Postgres integration run. Authenticated responsive browser QA is also pending.

Local verification on 2026-11-28: all 11 focused tests and TypeScript pass;
Drizzle generation and snapshot consistency check pass. The pnpm shim could
not download its pinned version, so installed tools were invoked directly.
Lint cannot run because ESLint is absent. The default Turbopack build failed
at Windows junction creation; the webpack production build passed.
