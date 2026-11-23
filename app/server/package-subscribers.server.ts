import { and, count, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "~/db";
import {
  listingPackages,
  profiles,
  sellerSubscriptions,
  users,
} from "~/db/schema";
import { CelisError } from "~/lib/errors";

export const PACKAGE_SUBSCRIBER_FILTERS = ["active", "expired", "cancelled", "all"] as const;
export type PackageSubscriberFilter = (typeof PACKAGE_SUBSCRIBER_FILTERS)[number];

/**
 * A subscription is "active" only while status = active AND it has not passed
 * its expiry date (no cron flips expired rows, so expiry is derived here, the
 * same way getActiveSellerSubscription treats it).
 */
function filterCondition(filter: PackageSubscriberFilter) {
  const now = new Date();
  switch (filter) {
    case "active":
      return and(
        eq(sellerSubscriptions.status, "active"),
        gte(sellerSubscriptions.expiresAt, now)
      );
    case "expired":
      return or(
        eq(sellerSubscriptions.status, "expired"),
        and(eq(sellerSubscriptions.status, "active"), lt(sellerSubscriptions.expiresAt, now))
      );
    case "cancelled":
      return eq(sellerSubscriptions.status, "cancelled");
    default:
      return undefined;
  }
}

/** Package plus how many sellers hold it, for the admin detail header. */
export async function getAdminPackageSummary(packageId: string) {
  const [pkg] = await db
    .select()
    .from(listingPackages)
    .where(eq(listingPackages.id, packageId))
    .limit(1);
  if (!pkg) throw new CelisError("Package not found", "PACKAGE_NOT_FOUND", 404);

  const [counts] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${sellerSubscriptions.status} = 'active' and ${sellerSubscriptions.expiresAt} >= now())`,
      uniqueSellers: sql<number>`count(distinct ${sellerSubscriptions.sellerId})`,
    })
    .from(sellerSubscriptions)
    .where(eq(sellerSubscriptions.packageId, packageId));

  return {
    package: pkg,
    counts: {
      totalAssignments: Number(counts?.total ?? 0),
      activeSellers: Number(counts?.active ?? 0),
      uniqueSellers: Number(counts?.uniqueSellers ?? 0),
    },
  };
}

/**
 * Sellers assigned to a package (one row per assignment, newest first),
 * filtered, searched and paginated on the server.
 */
export async function getPackageSubscribers(options: {
  packageId: string;
  filter: PackageSubscriberFilter;
  search?: string;
  page: number;
  limit: number;
}) {
  const assigner = alias(users, "assigner");
  const offset = (options.page - 1) * options.limit;
  const term = options.search?.trim();
  const searchCondition = term
    ? or(
        ilike(profiles.displayName, `%${term}%`),
        ilike(profiles.businessName, `%${term}%`),
        ilike(users.email, `%${term}%`)
      )
    : undefined;
  const where = and(
    eq(sellerSubscriptions.packageId, options.packageId),
    filterCondition(options.filter),
    searchCondition
  );

  const rows = await db
    .select({
      subscriptionId: sellerSubscriptions.id,
      sellerId: sellerSubscriptions.sellerId,
      sellerName: profiles.displayName,
      businessName: profiles.businessName,
      sellerType: profiles.sellerType,
      email: users.email,
      status: sellerSubscriptions.status,
      listingsUsed: sellerSubscriptions.listingsUsed,
      cancelledAt: sellerSubscriptions.cancelledAt,
      cancelledBy: sellerSubscriptions.cancelledBy,
      cancellationReason: sellerSubscriptions.cancellationReason,
      cancellationNotes: sellerSubscriptions.cancellationNotes,
      startedAt: sellerSubscriptions.startedAt,
      expiresAt: sellerSubscriptions.expiresAt,
      assignmentSource: sellerSubscriptions.assignmentSource,
      pricePaidCents: sellerSubscriptions.pricePaidCents,
      assignedByEmail: assigner.email,
    })
    .from(sellerSubscriptions)
    .innerJoin(users, eq(users.id, sellerSubscriptions.sellerId))
    .leftJoin(profiles, eq(profiles.id, sellerSubscriptions.sellerId))
    .leftJoin(assigner, eq(assigner.id, sellerSubscriptions.assignedBy))
    .where(where)
    .orderBy(desc(sellerSubscriptions.startedAt))
    .limit(options.limit)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(sellerSubscriptions)
    .innerJoin(users, eq(users.id, sellerSubscriptions.sellerId))
    .leftJoin(profiles, eq(profiles.id, sellerSubscriptions.sellerId))
    .where(where);

  const now = Date.now();
  return {
    items: rows.map((r) => ({
      ...r,
      // Derived status so a lapsed "active" row reads as expired.
      effectiveStatus:
        r.status === "active" && r.expiresAt.getTime() < now ? ("expired" as const) : r.status,

    })),
    total: Number(total),
    page: options.page,
    limit: options.limit,
    totalPages: Math.max(1, Math.ceil(Number(total) / options.limit)),
  };
}
