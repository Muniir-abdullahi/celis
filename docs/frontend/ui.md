# Frontend UI

This guide covers the Next.js App Router, listing UI, admin UI, forms, dialogs,
tables, and the design-system pointer.

## Next.js Migration Status

- Vercel and local `dev`/`build`/`start` commands use Next.js 16 App Router.
- `app/layout.tsx` owns the document shell and global stylesheet.
- Define document metadata and viewport settings through Next.js exports in
  `app/layout.tsx`. Keep font loading in the global stylesheet; do not render a
  manual `<head>` in the root layout.
- All marketplace screens and the mobile payment endpoint use native App Router
  pages and Route Handlers. There is no catch-all compatibility router.
- Next public Supabase settings use `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Keep service-role and provider secrets
  server-only.

## Routing & Pages

Key files:

- `app/layout.tsx`
- `app/api/**/route.ts`
- `app/page.tsx` and route-specific `page.tsx` files

Rules:

- Keep route files as route shells plus page composition.
- Move large sections into components.
- Move data queries/mutations into server modules.
- Lazy-load secondary panels and expensive route data.

## Listings UI

Key files:

- `app/components/listings/listing-card.tsx`
- `app/components/listings/listing-grid.tsx`
- `app/components/listings/listing-wizard.tsx`
- `app/components/listings/search-filters.tsx`
- `app/components/listings/payment-modal.tsx`
- `app/components/listings/image-uploader.tsx`
- `app/components/listings/image-gallery.tsx`

Rules:

- Listing cards should show clear price, title, image, location, and seller context.
- Search filters should map to server-side query parameters.
- Listing wizard sections should be split if the file grows.
- Payment modal changes are high-risk and require docs/changelog updates.

## Admin UI

Key files:

- `app/admin/**`
- `app/components/admin/admin-table.tsx`
- `app/components/admin/confirm-dialog.tsx`
- `app/components/admin/status-badge.tsx`
- `app/components/admin/admin-shell.tsx`
- `app/components/admin/admin-chart.tsx`

Rules:

- Reuse admin table, status badge, confirmation dialog, and page header components.
- Admin tables must use server-side pagination/filtering for real data.
- Destructive, moderation, RBAC, package, payment, payout, and status actions require confirmation.
- Admin charts should load scoped data and avoid unbounded aggregates.
- Admin settings are split into Fees, WaafiPay gateway, Features & payments,
  Listing pricing tiers, and Audit log tabs. A tab requests its protected server
  data only when selected; hidden settings panels are not loaded by the route.
- The WaafiPay settings tab uses a form-shaped loading skeleton and closes its
  confirmation dialog only after the protected save succeeds. Fees can be saved
  individually or with the tab-level save action.

## Forms, Dialogs & Tables

Rules:

- Use existing UI primitives.
- Validate user input with Zod on the server.
- Keep long forms split into sections.
- Dialogs must name the record and consequence.
- Use `app/components/admin/confirm-dialog.tsx` or an equivalent shared confirmation pattern for high-risk actions.
- Server-side pagination/filtering is required for large datasets.
- Empty states, pagination, status badges, and row actions should be reusable.

## Design System

The full design source is `celis-design-system.md`.

Rules:

- Read `celis-design-system.md` before UI changes.
- Reuse established tokens, components, motion, and layout rules.
- Do not introduce another design language.
- Keep admin UI dense and listing UI marketplace-friendly.
- Admin category management uses a master-detail hierarchy: root categories load
  first in an expandable tree, subcategories load on expansion, and listing
  Conditions/Fields are configured from subcategory rows. Each row also carries
  an activate/deactivate switch and up/down reorder controls; deactivating a
  category that still has listings or children first asks for confirmation.
  Related actions only re-run the loader, so the expanded selection is kept.
- Admin package management (`/admin/packages`) gates create/edit/archive/delete
  on `settings:manage`. The Active switch is driven by freshly loaded data (not
  a stale dialog snapshot); turning it off, plus Archive and Delete, open a
  confirm dialog that names the package. Delete is blocked server-side for
  packages referenced by any subscription — archive instead.
