import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "~/db";
import { auditLogs, listingDiscountPackages as packages, sellerDiscountAssignments as assignments, listingFeeCheckouts as checkouts, users, profiles } from "~/db/schema";
import { discountInputSchema, listingTierKey } from "~/lib/listing-discounts";
import { cancellationSchema } from "~/lib/package-cancellation";
import { AdminInputError } from "~/lib/admin-mutation";
import { requirePermission } from "./auth.server";
import { getListingTiersConfig } from "./config.server";
import { z } from "zod";

export async function saveDiscountPackage(raw: unknown, authorize: typeof requirePermission = requirePermission) {
  const actor = await authorize("settings:manage");
  const input = discountInputSchema.parse(raw);
  const tier = (await getListingTiersConfig()).tiers.find((item) => listingTierKey(item) === input.tierKey);
  if (!tier) throw new AdminInputError("Select an existing listing tier.");
  if ((input.type === "percentage" && input.value > 10000) || (input.type === "fixed" && input.value > tier.feeCents)) throw new AdminInputError("The discount cannot exceed the regular listing fee.");
  return db.transaction(async (tx) => {
    const { id, ...values } = input;
    const [row] = id ? await tx.update(packages).set({ ...values, tierLabel: tier.label, version: sql`${packages.version} + 1` }).where(eq(packages.id, id)).returning()
      : await tx.insert(packages).values({ ...values, tierLabel: tier.label }).returning();
    if (!row) throw new AdminInputError("Discount package not found.");
    await tx.insert(auditLogs).values({ actorId: actor.id, action: id ? "discount_package_updated" : "discount_package_created", resourceType: "discount_package", resourceId: row.id, metadata: { ...values, version: row.version } });
    return row;
  });
}

export async function setDiscountPackageActive(raw: unknown, authorize: typeof requirePermission = requirePermission) {
  const actor = await authorize("settings:manage");
  const input = z.object({ id: z.string().uuid(), active: z.boolean(), confirmed: z.literal(true) }).parse(raw);
  return db.transaction(async (tx) => {
    const [row] = await tx.update(packages).set({ isActive: input.active }).where(eq(packages.id, input.id)).returning();
    if (!row) throw new AdminInputError("Package not found.");
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "discount_package_activation_changed", resourceType: "discount_package", resourceId: row.id, metadata: { active: input.active, existingAssignmentsUnchanged: true } });
    return row;
  });
}

export async function assignDiscountPackage(raw: unknown, authorize: typeof requirePermission = requirePermission) {
  const actor = await authorize("settings:manage");
  const input = z.object({ packageId: z.string().uuid(), sellerIds: z.array(z.string().uuid()).min(1).max(50), replace: z.boolean().default(false), confirmed: z.literal(true) }).parse(raw);
  const configuredTiers = (await getListingTiersConfig()).tiers;
  return db.transaction(async (tx) => {
    // Sorted seller locks prevent batch deadlocks; same lock as cancellation/checkout.
    const sellerIds = [...new Set(input.sellerIds)].sort();
    for (const id of sellerIds) {
      const [seller] = await tx.select().from(users).where(eq(users.id, id)).for("update");
      if (!seller || seller.role !== "seller" || seller.isInternal) throw new AdminInputError("All selected accounts must be external sellers.");
    }
    const [pkg] = await tx.select().from(packages).where(eq(packages.id, input.packageId)).for("share");
    if (!pkg?.isActive) throw new AdminInputError("Choose an active discount package.");
    const tier = configuredTiers.find((item) => listingTierKey(item) === pkg.tierKey);
    if (!tier || (pkg.type === "fixed" && pkg.value > tier.feeCents)) throw new AdminInputError("Pricing changed. Update this discount before assigning it.");
    for (const sellerId of sellerIds) {
      const [previous] = await tx.select().from(assignments).where(and(eq(assignments.sellerId, sellerId), eq(assignments.tierKey, pkg.tierKey), eq(assignments.status, "active"))).for("update");
      const now = new Date();
      if (previous) {
        if (!input.replace && previous.expiresAt > now) throw new AdminInputError("A selected seller already has an assignment for this tier. Confirm replacement.");
        await tx.update(assignments).set({ status: previous.expiresAt <= now ? "expired" : "cancelled", cancelledAt: now, cancelledBy: actor.id, cancellationReason: "admin_decision", cancellationNotes: "Replaced by a new assignment" }).where(eq(assignments.id, previous.id));
        await tx.insert(auditLogs).values({ actorId: actor.id, action: "discount_assignment_replaced", resourceType: "discount_assignment", resourceId: previous.id, metadata: { sellerId, previousStatus: previous.status, reason: "admin_decision" } });
      }
      const expiresAt = new Date(now.getTime() + pkg.durationDays * 86400000);
      const [created] = await tx.insert(assignments).values({ packageId: pkg.id, sellerId, tierKey: pkg.tierKey, terms: { name: pkg.name, tierKey: pkg.tierKey, tierLabel: pkg.tierLabel, type: pkg.type, value: pkg.value, listingLimit: pkg.listingLimit, durationDays: pkg.durationDays, version: pkg.version }, assignedBy: actor.id, startedAt: now, expiresAt }).returning();
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "discount_assigned", resourceType: "discount_assignment", resourceId: created.id, metadata: { sellerId, packageId: pkg.id, terms: created.terms, expiresAt } });
    }
    return { assigned: sellerIds.length };
  });
}

export async function cancelDiscountAssignment(raw: unknown, authorize: typeof requirePermission = requirePermission) {
  const actor = await authorize("settings:manage"); const input = cancellationSchema.parse(raw);
  const [row] = await db.select().from(assignments).where(eq(assignments.id, input.assignmentId)).limit(1);
  if (!row) throw new AdminInputError("Assignment not found.");
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, row.sellerId)).for("update");
    const [current] = await tx.select().from(assignments).where(eq(assignments.id, row.id)).for("update");
    if (current.status === "cancelled") return { cancelled: true };
    if (current.status !== "active" || current.expiresAt <= new Date()) throw new AdminInputError("Only active assignments can be cancelled.");
    await tx.update(assignments).set({ status: "cancelled", cancelledBy: actor.id, cancelledAt: new Date(), cancellationReason: input.reason, cancellationNotes: input.notes || null }).where(eq(assignments.id, row.id));
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "discount_assignment_cancelled", resourceType: "discount_assignment", resourceId: row.id, metadata: { sellerId: row.sellerId, packageId: row.packageId, previousStatus: current.status, reason: input.reason, notes: input.notes ?? null } });
    return { cancelled: true };
  });
}

export async function getDiscountAdminData(raw: unknown) {
  await requirePermission("settings:manage");
  const input = z.object({ page: z.coerce.number().int().min(1).default(1), q: z.string().max(120).default(""), status: z.enum(["active", "expired", "cancelled", "all"]).default("active"), packageId: z.string().uuid().optional() }).parse(raw);
  const used = sql<number>`(select count(*) from ${checkouts} where ${checkouts.assignmentId} = ${assignments.id} and ${checkouts.status} <> 'failed')`;
  const effective = sql<string>`case when ${assignments.status} = 'cancelled' then 'cancelled' when ${assignments.status} = 'expired' or ${assignments.expiresAt} <= now() or ${used} >= (${assignments.terms}->>'listingLimit')::int then 'expired' else 'active' end`;
  const where = and(input.status === "all" ? undefined : eq(effective, input.status), input.packageId ? eq(assignments.packageId, input.packageId) : undefined,
    input.q ? or(ilike(users.email, `%${input.q}%`), ilike(profiles.displayName, `%${input.q}%`)) : undefined);
  const rows = await db.select({ assignment: assignments, sellerName: profiles.displayName, email: users.email, used, effectiveStatus: effective }).from(assignments)
    .innerJoin(users, eq(users.id, assignments.sellerId)).leftJoin(profiles, eq(profiles.id, users.id)).where(where).orderBy(desc(assignments.startedAt)).limit(20).offset((input.page - 1) * 20);
  const [total] = await db.select({ value: count() }).from(assignments).innerJoin(users, eq(users.id, assignments.sellerId)).leftJoin(profiles, eq(profiles.id, users.id)).where(where);
  const packageWhere = input.q ? ilike(packages.name, `%${input.q}%`) : undefined;
  const definitions = await db.select().from(packages).where(packageWhere).orderBy(desc(packages.createdAt)).limit(20).offset((input.page - 1) * 20);
  const [packageTotal] = await db.select({ value: count() }).from(packages).where(packageWhere);
  return { definitions, assignments: rows, total: Number(total.value), packageTotal: Number(packageTotal.value), query: input, tiers: (await getListingTiersConfig()).tiers };
}

export async function searchDiscountSellers(raw: unknown) {
  await requirePermission("settings:manage"); const q = z.string().trim().min(2).max(120).parse(raw);
  return db.select({ id: users.id, email: users.email, name: profiles.displayName }).from(users).leftJoin(profiles, eq(users.id, profiles.id))
    .where(and(eq(users.role, "seller"), eq(users.isInternal, false), or(ilike(users.email, `%${q}%`), ilike(profiles.displayName, `%${q}%`), ilike(profiles.sellerNumber, `%${q}%`)))).orderBy(users.email).limit(20);
}
