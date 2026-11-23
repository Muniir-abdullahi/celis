import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "~/db";
import { auditLogs, listings, listingPackages, sellerSubscriptions, sellerPackageUsages, users } from "~/db/schema";
import { cancellationSchema } from "~/lib/package-cancellation";
import { AdminInputError } from "~/lib/admin-mutation";
import { requirePermission } from "./auth.server";

export async function cancelSellerPackage(raw: unknown, authorize: typeof requirePermission = requirePermission) {
  const actor = await authorize("settings:manage");
  const input = cancellationSchema.parse(raw);
  const [assignment] = await db.select().from(sellerSubscriptions).where(eq(sellerSubscriptions.id, input.assignmentId)).limit(1);
  if (!assignment) throw new AdminInputError("Assignment not found.");
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, assignment.sellerId)).for("update");
    const [current] = await tx.select().from(sellerSubscriptions).where(eq(sellerSubscriptions.id, input.assignmentId)).for("update");
    if (current.status === "cancelled") return { cancelled: true };
    if (current.status !== "active" || current.expiresAt <= new Date()) throw new AdminInputError("Only an active assignment can be cancelled.");
    const now = new Date();
    await tx.update(sellerSubscriptions).set({ status: "cancelled", cancelledBy: actor.id, cancelledAt: now,
      cancellationReason: input.reason, cancellationNotes: input.notes || null, updatedAt: now }).where(eq(sellerSubscriptions.id, current.id));
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "seller_package_cancelled", resourceType: "seller_subscription", resourceId: current.id,
      metadata: { sellerId: current.sellerId, packageId: current.packageId, previousStatus: current.status, reason: input.reason, notes: input.notes ?? null, refund: false } });
    return { cancelled: true };
  });
}

/** Seller lock is shared with cancellation and reassignment; no external IO in transaction. */
export async function consumeSellerPackage(listingId: string, sellerId: string) {
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, sellerId)).for("update");
    const [listing] = await tx.select().from(listings).where(eq(listings.id, listingId)).for("update");
    if (!listing || listing.sellerId !== sellerId) throw new AdminInputError("Listing not found.");
    const [used] = await tx.select().from(sellerPackageUsages).where(eq(sellerPackageUsages.listingId, listingId)).limit(1);
    if (used) return listing;
    if (listing.status !== "draft") throw new AdminInputError("Only draft listings can be submitted.");
    const [row] = await tx.select({ sub: sellerSubscriptions, pkg: listingPackages }).from(sellerSubscriptions)
      .innerJoin(listingPackages, eq(listingPackages.id, sellerSubscriptions.packageId))
      .where(and(eq(sellerSubscriptions.sellerId, sellerId), eq(sellerSubscriptions.status, "active"),
        gt(sellerSubscriptions.expiresAt, new Date()), eq(listingPackages.isActive, true)))
      .orderBy(desc(sellerSubscriptions.startedAt)).limit(1).for("update", { of: sellerSubscriptions });
    if (!row || (!row.pkg.isUnlimited && row.sub.listingsUsed >= row.pkg.listingAllowance)) throw new AdminInputError("No active package with remaining listing credits.");
    await tx.insert(sellerPackageUsages).values({ subscriptionId: row.sub.id, listingId });
    await tx.update(sellerSubscriptions).set({ listingsUsed: sql`${sellerSubscriptions.listingsUsed} + 1`, updatedAt: new Date() }).where(eq(sellerSubscriptions.id, row.sub.id));
    const [updated] = await tx.update(listings).set({ status: "pending_review", monetizationStatus: "active", feeAmountCents: 0, updatedAt: new Date() }).where(eq(listings.id, listingId)).returning();
    await tx.insert(auditLogs).values({ actorId: sellerId, action: "package_credit_used", resourceType: "listing", resourceId: listingId, metadata: { subscriptionId: row.sub.id } });
    return updated;
  });
}
