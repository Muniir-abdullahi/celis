"use server";

import { z } from "zod";
import type { UserRole } from "~/db/schema";
import {
  getAdminDashboardStats,
  getAdminRecentActivity,
  getAdminUsers,
  createInternalUser,
  updateUserRole,
  toggleUserVerification,
  toggleUserSuperAdmin,
  getUnverifiedSellers,
  reviewSellerVerification,
  getAdminListings,
  updateListingStatus,
  approveListing,
  rejectListing,
  extendListingExpiry,
  markListingPaidManually,
  notifyExpiringSeller,
  getAdminCategories,
  createCategory,
  updateCategory,
  reorderCategory,
  deleteCategory,
  getAdminCategoryFees,
  createCategoryFee,
  updateCategoryFee,
  deleteCategoryFee,
  getAdminOrders,
  updateOrderStatus,
  getAdminPayouts,
  retryPayout,
  markPayoutCompleted,
  getAdminLedger,
  exportAdminLedger,
  getFailedPaymentsReport,
  getNewUsersReport,
  getNewListingsReport,
  exportFailedPaymentsReport,
  exportNewUsersReport,
  exportNewListingsReport,
  getPlatformConfigAll,
  getPlatformConfigSection,
  updatePlatformConfig,
  runListingExpirySweep,
} from "./admin.server";
import { getAdminAuditLogs } from "./audit.server";
import {
  listAllListingPackages,
  assignSellerPackage,
} from "./seller-packages.server";
import { requirePermission } from "./auth.server";

const userRoleSchema = z.string();

export async function fetchAdminStats() {

  return getAdminDashboardStats();
}

export async function fetchAdminRecentActivity() {

    return getAdminRecentActivity();
}

const usersQuerySchema = z
  .object({
    search: z.string().optional(),
    role: userRoleSchema.optional(),
    domain: z.enum(["customer", "internal"]).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  })
  .default({});

export async function fetchAdminUsers(input: { data: unknown }) {
  const data = (usersQuerySchema).parse(input.data);

    return getAdminUsers(data);
}

const createInternalUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: userRoleSchema,
  department: z.string().optional(),
});

export async function createAdminInternalUser(input: { data: unknown }) {
  const data = (createInternalUserSchema).parse(input.data);

    return createInternalUser(data);
}

const updateRoleSchema = z.object({
  id: z.string().uuid(),
  role: userRoleSchema,
});

export async function updateAdminUserRole(input: { data: unknown }) {
  const data = (updateRoleSchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return updateUserRole(data.id, data.role as UserRole, user.id);
}

const userIdSchema = z.object({ id: z.string().uuid() });

export async function toggleAdminUserVerification(input: { data: unknown }) {
  const data = (userIdSchema).parse(input.data);

    return toggleUserVerification(data.id);
}

export async function toggleAdminUserSuperAdmin(input: { data: unknown }) {
  const data = (userIdSchema).parse(input.data);

    return toggleUserSuperAdmin(data.id);
}

const unverifiedSellersQuerySchema = z
  .object({
    search: z.string().optional(),
    status: z.enum(["pending", "rejected", "suspended"]).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  })
  .default({});

export async function fetchUnverifiedSellers(input: { data: unknown }) {
  const data = (unverifiedSellersQuerySchema).parse(input.data);

    return getUnverifiedSellers(data);
}

const reviewSellerVerificationSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "suspend"]),
  reason: z.string().optional(),
});

export async function reviewAdminSellerVerification(input: { data: unknown }) {
  const data = (reviewSellerVerificationSchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return reviewSellerVerification(data.id, data.action, data.reason ?? "", user.id);
}

const listingsQuerySchema = z
  .object({
    status: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    sellerId: z.string().uuid().optional(),
    expiryWindow: z.coerce.number().int().min(0).optional(),
    packageId: z.string().uuid().optional(),
    paymentStatus: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  })
  .default({});

export async function fetchAdminListings(input: { data: unknown }) {
  const data = (listingsQuerySchema).parse(input.data);

    return getAdminListings(data);
}

const listingStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "active",
    "draft",
    "pending_review",
    "sold",
    "expired",
    "rejected",
    "suspended",
  ]),
});

const extendExpirySchema = z.object({
  id: z.string().uuid(),
  days: z.coerce.number().int().min(1),
  reason: z.string().min(1),
});

export async function extendAdminListingExpiry(input: { data: unknown }) {
  const data = (extendExpirySchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return extendListingExpiry(data.id, data.days, data.reason, user.id);
}

const markListingPaidSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

export async function markAdminListingPaid(input: { data: unknown }) {
  const data = (markListingPaidSchema).parse(input.data);

    return markListingPaidManually(data.id, data.reason);
}

const notifySellerSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(["sms", "email", "push"]).default("sms"),
});

export async function notifyAdminExpiringSeller(input: { data: unknown }) {
  const data = (notifySellerSchema).parse(input.data);

    const { getCurrentUser } = await import("./auth.server");
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return notifyExpiringSeller(data.id, data.channel, user.id);
}

export async function updateAdminListingStatus(input: { data: unknown }) {
  const data = (listingStatusSchema).parse(input.data);

    return updateListingStatus(data.id, data.status);
}

const reviewListingSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export async function reviewAdminListing(input: { data: unknown }) {
  const data = (reviewListingSchema).parse(input.data);

    const { requirePermission } = await import("./auth.server");
    const user = await requirePermission("listings:moderate");
    const { insertAuditLog } = await import("./audit.server");
    if (data.action === "approve") {
      await approveListing(data.id, user.id);
      await insertAuditLog({
        action: "listing_approved",
        resourceType: "listing",
        resourceId: data.id,
        metadata: { actorId: user.id },
      });
      return { success: true, id: data.id, status: "active" as const };
    }
    await rejectListing(data.id, user.id, data.reason ?? "");
    await insertAuditLog({
      action: "listing_rejected",
      resourceType: "listing",
      resourceId: data.id,
      metadata: { actorId: user.id, reason: data.reason },
    });
    return { success: true, id: data.id, status: "rejected" as const };
}

const categoriesQuerySchema = z
  .object({
    parentId: z.string().uuid().nullable().optional().default(null),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  })
  .default({});

export async function fetchAdminCategories(input: { data: unknown }) {
  const data = (categoriesQuerySchema).parse(input.data);

    return getAdminCategories(data);
}

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
});

export async function createAdminCategory(input: { data: unknown }) {
  const data = (categorySchema).parse(input.data);

    return createCategory(data);
}

const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function updateAdminCategory(input: { data: unknown }) {
  const data = (updateCategorySchema).parse(input.data);

    return updateCategory(data.id, {
      name: data.name,
      slug: data.slug,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    });
}

const reorderCategorySchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export async function reorderAdminCategory(input: { data: unknown }) {
  const data = (reorderCategorySchema).parse(input.data);

    return reorderCategory(data.id, data.direction);
}

const deleteCategorySchema = z.object({ id: z.string().uuid() });

export async function deleteAdminCategory(input: { data: unknown }) {
  const data = (deleteCategorySchema).parse(input.data);

    return deleteCategory(data.id);
}

const categoryFeesQuerySchema = z.object({
  categoryId: z.string().uuid(),
});

export async function fetchAdminCategoryFees(input: { data: unknown }) {
  const data = (categoryFeesQuerySchema).parse(input.data);

    return getAdminCategoryFees(data.categoryId);
}

const categoryFeeSchema = z.object({
  categoryId: z.string().uuid(),
  feeType: z.enum(["listing_fee", "commission"]),
  amount: z.coerce.number().int().min(0).optional().default(0),
  percentage: z.coerce.number().int().min(0).max(10000).optional().default(0),
  isActive: z.boolean().optional().default(true),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
});

export async function createAdminCategoryFee(input: { data: unknown }) {
  const data = (categoryFeeSchema).parse(input.data);

    return createCategoryFee({
      categoryId: data.categoryId,
      feeType: data.feeType,
      amount: data.amount,
      percentage: data.percentage,
      isActive: data.isActive,
      effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
      effectiveUntil: data.effectiveUntil ? new Date(data.effectiveUntil) : undefined,
    });
}

const updateCategoryFeeSchema = categoryFeeSchema
  .omit({ categoryId: true })
  .partial()
  .extend({ id: z.string().uuid() });

export async function updateAdminCategoryFee(actionInput: { data: unknown }) {
  const data = (updateCategoryFeeSchema).parse(actionInput.data);

    const { id, ...input } = data;
    return updateCategoryFee(id, {
      ...input,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveUntil: input.effectiveUntil ? new Date(input.effectiveUntil) : null,
    });
}

const categoryFeeIdSchema = z.object({ id: z.string().uuid() });

export async function deleteAdminCategoryFee(input: { data: unknown }) {
  const data = (categoryFeeIdSchema).parse(input.data);

    return deleteCategoryFee(data.id);
}

const ordersQuerySchema = z
  .object({
    status: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  })
  .default({});

export async function fetchAdminOrders(input: { data: unknown }) {
  const data = (ordersQuerySchema).parse(input.data);

    return getAdminOrders(data);
}

const orderStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "pending",
    "confirmed",
    "shipped",
    "delivered",
    "completed",
    "cancelled",
    "disputed",
  ]),
});

export async function updateAdminOrderStatus(input: { data: unknown }) {
  const data = (orderStatusSchema).parse(input.data);

    return updateOrderStatus(data.id, data.status);
}

const createOrderSchema = z.object({
  listingId: z.string().uuid(),
  buyerEmail: z.string().email(),
  salePrice: z.coerce.number().int().min(0),
});

export async function createAdminOrder(input: { data: unknown }) {
  const data = (createOrderSchema).parse(input.data);

    await requirePermission("orders:manage");
    const { db } = await import("~/db");
    const { users, listings } = await import("~/db/schema");
    const { eq } = await import("drizzle-orm");
    const { createOrder } = await import("./orders.server");

    const [buyer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.buyerEmail))
      .limit(1);
    if (!buyer) throw new Error("Buyer not found");

    const [listing] = await db
      .select({ sellerId: listings.sellerId })
      .from(listings)
      .where(eq(listings.id, data.listingId))
      .limit(1);
    if (!listing) throw new Error("Listing not found");

    return createOrder({
      listingId: data.listingId,
      buyerId: buyer.id,
      sellerId: listing.sellerId,
      salePrice: data.salePrice,
    });
}

const payoutsQuerySchema = z
  .object({
    status: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  })
  .default({});

export async function fetchAdminPayouts(input: { data: unknown }) {
  const data = (payoutsQuerySchema).parse(input.data);

    return getAdminPayouts(data);
}

const payoutActionSchema = z.object({
  id: z.string().uuid(),
  note: z.string().optional(),
});

export async function retryAdminPayout(input: { data: unknown }) {
  const data = (payoutActionSchema).parse(input.data);

    return retryPayout(data.id);
}

export async function completeAdminPayout(input: { data: unknown }) {
  const data = (payoutActionSchema).parse(input.data);

    return markPayoutCompleted(data.id, data.note);
}

const ledgerQuerySchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    type: z.enum(["all", "payment", "payout", "refund"]).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  })
  .default({ type: "all" as const });

export async function fetchAdminLedger(input: { data: unknown }) {
  const data = (ledgerQuerySchema).parse(input.data);

    return getAdminLedger(data);
}

export async function exportAdminLedgerCsv(input: { data: unknown }) {
  const data = (ledgerQuerySchema).parse(input.data);

    return exportAdminLedger(data);
}

const failedPaymentsBaseSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  includePending: z.coerce.boolean().optional().default(false),
});

const failedPaymentsQuerySchema = failedPaymentsBaseSchema.extend({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export async function fetchFailedPaymentsReport(input: { data: unknown }) {
  const data = (failedPaymentsQuerySchema).parse(input.data);

    return getFailedPaymentsReport(data);
}

export async function exportFailedPaymentsReportCsv(input: { data: unknown }) {
  const data = (failedPaymentsBaseSchema).parse(input.data);

    return exportFailedPaymentsReport(data);
}

const dateRangeBaseSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const dateRangeQuerySchema = dateRangeBaseSchema.extend({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export async function fetchNewUsersReport(input: { data: unknown }) {
  const data = (dateRangeQuerySchema).parse(input.data);

    return getNewUsersReport(data);
}

export async function exportNewUsersReportCsv(input: { data: unknown }) {
  const data = (dateRangeBaseSchema).parse(input.data);

    return exportNewUsersReport(data);
}

export async function fetchNewListingsReport(input: { data: unknown }) {
  const data = (dateRangeQuerySchema).parse(input.data);

    return getNewListingsReport(data);
}

export async function exportNewListingsReportCsv(input: { data: unknown }) {
  const data = (dateRangeBaseSchema).parse(input.data);

    return exportNewListingsReport(data);
}

const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export async function fetchAdminAuditLogs(input: { data: unknown }) {
  const data = (auditLogQuerySchema).parse(input.data);

    await requirePermission("audit:read");
    return getAdminAuditLogs(data);
}

export async function fetchPlatformConfigAll() {

    return getPlatformConfigAll();
}

const platformConfigSectionSchema = z.object({
  section: z.enum(["fees", "features", "pricing", "audit"]),
});

export async function fetchPlatformConfigSection(input: { data: unknown }) {
  const data = (platformConfigSectionSchema).parse(input.data);
return getPlatformConfigSection(data.section);
}

export async function runAdminExpirySweep() {

    return runListingExpirySweep();
}

const updateConfigSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown())]),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
});

export async function updateAdminPlatformConfig(input: { data: unknown }) {
  const data = (updateConfigSchema).parse(input.data);

    // adminId will be resolved inside the server function via requireAdmin
    const { getCurrentUser } = await import("./auth.server");
    const admin = await getCurrentUser();
    if (!admin) throw new Error("Unauthorized");
    return updatePlatformConfig(
      data.key,
      data.value,
      admin.id,
      data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
      data.effectiveUntil ? new Date(data.effectiveUntil) : undefined
    );
}

const packageSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  sellerTypeEligibility: z.enum(["individual", "shop"]).optional(),
  listingAllowance: z.coerce.number().int().min(1),
  isUnlimited: z.boolean().optional(),
  featuredAllowance: z.coerce.number().int().min(0).optional(),
  durationDays: z.coerce.number().int().min(1),
  price: z.coerce.number().int().min(0),
  currency: z.string().max(3).optional(),
  autoRenew: z.boolean().optional(),
  gracePeriodDays: z.coerce.number().int().min(0).optional(),
});

export async function fetchAdminListingPackages() {

    await requirePermission("settings:manage");
    return listAllListingPackages();
}

export async function createAdminListingPackage(input: { data: unknown }) {
  const data = (packageSchema).parse(input.data);

    await requirePermission("settings:manage");
    const { createListingPackage } = await import("./seller-packages.server");
    return createListingPackage(data);
}

export async function updateAdminListingPackage(actionInput: { data: unknown }) {
  const data = (packageSchema.partial().extend({
      id: z.string().uuid(),
      isActive: z.boolean().optional(),
    })).parse(actionInput.data);

    await requirePermission("settings:manage");
    const { id, ...input } = data;
    const { updateListingPackage } = await import("./seller-packages.server");
    return updateListingPackage(id, input);
}

const listingPackageIdSchema = z.object({ id: z.string().uuid() });

export async function archiveAdminListingPackage(input: { data: unknown }) {
  const data = (listingPackageIdSchema).parse(input.data);

    await requirePermission("settings:manage");
    const { archiveListingPackage } = await import("./seller-packages.server");
    return archiveListingPackage(data.id);
}

export async function deleteAdminListingPackage(input: { data: unknown }) {
  const data = (listingPackageIdSchema).parse(input.data);

    await requirePermission("settings:manage");
    const { deleteListingPackage } = await import("./seller-packages.server");
    return deleteListingPackage(data.id);
}

const sellerNumberSchema = z.object({ sellerNumber: z.string().min(1).max(20) });

export async function fetchSellerByNumber(input: { data: unknown }) {
  const data = (sellerNumberSchema).parse(input.data);

    await requirePermission("users:manage");
    const { db } = await import("~/db");
    const { users, profiles } = await import("~/db/schema");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: profiles.id,
        email: users.email,
        displayName: profiles.displayName,
        sellerType: profiles.sellerType,
        verificationStatus: users.verificationStatus,
        verifiedAt: users.verifiedAt,
        role: users.role,
        isInternal: users.isInternal,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.id, users.id))
      .where(eq(profiles.sellerNumber, data.sellerNumber))
      .limit(1);

    const seller = rows[0];
    if (!seller || seller.role !== "seller" || seller.isInternal) {
      throw new Error("No external seller found with that seller number.");
    }

    return {
      id: seller.id,
      email: seller.email,
      displayName: seller.displayName,
      sellerType: seller.sellerType,
      verificationStatus: seller.verificationStatus,
      isVerified: seller.verifiedAt !== null,
    };
}

const assignPackageSchema = z.object({
  sellerEmail: z.string().email().optional(),
  sellerNumber: z.string().min(1).max(20).optional(),
  packageId: z.string().uuid(),
  assignmentSource: z.string().max(50).optional(),
  paymentReference: z.string().max(255).optional(),
  pricePaidCents: z.coerce.number().int().min(0).optional(),
});

export async function assignAdminSellerPackage(input: { data: unknown }) {
  const data = (assignPackageSchema).parse(input.data);

    await requirePermission("users:manage");
    const { db } = await import("~/db");
    const { users, profiles } = await import("~/db/schema");
    const { eq } = await import("drizzle-orm");
    const { getCurrentUser } = await import("./auth.server");
    const actor = await getCurrentUser();

    let sellerId: string | undefined;
    if (data.sellerNumber) {
      const rows = await db
        .select({ userId: profiles.id })
        .from(profiles)
        .where(eq(profiles.sellerNumber, data.sellerNumber))
        .limit(1);
      sellerId = rows[0]?.userId;
    } else if (data.sellerEmail) {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, data.sellerEmail))
        .limit(1);
      sellerId = rows[0]?.id;
    }

    if (!sellerId) throw new Error("Seller not found");

    const sellerRows = await db
      .select({ role: users.role, isInternal: users.isInternal, email: users.email })
      .from(users)
      .where(eq(users.id, sellerId))
      .limit(1);
    const seller = sellerRows[0];
    if (!seller || seller.role !== "seller" || seller.isInternal) {
      throw new Error(
        "Packages can only be assigned to external seller accounts."
      );
    }

    return assignSellerPackage(sellerId, data.packageId, {
      assignedBy: actor?.id,
      assignmentSource: data.assignmentSource,
      paymentReference: data.paymentReference,
      pricePaidCents: data.pricePaidCents,
    });
}
