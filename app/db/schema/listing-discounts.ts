import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import type { DiscountTerms } from "../../lib/listing-discounts";

export const listingDiscountPackages = pgTable("listing_discount_packages", {
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(),
  tierKey: text("tier_key").notNull(), tierLabel: text("tier_label").notNull(),
  type: text("type", { enum: ["percentage", "fixed"] }).notNull(), value: integer("value").notNull(),
  listingLimit: integer("listing_limit").notNull(), durationDays: integer("duration_days").notNull(),
  version: integer("version").notNull().default(1), isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ valid: check("discount_package_values", sql`${t.value} >= 0 AND ${t.listingLimit} > 0 AND ${t.durationDays} > 0 AND (${t.type} = 'fixed' OR (${t.type} = 'percentage' AND ${t.value} <= 10000))`) })).enableRLS();

export const sellerDiscountAssignments = pgTable("seller_discount_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").notNull().references(() => listingDiscountPackages.id),
  sellerId: uuid("seller_id").notNull().references(() => users.id), tierKey: text("tier_key").notNull(),
  terms: jsonb("terms").$type<DiscountTerms>().notNull(),
  status: text("status", { enum: ["active", "expired", "cancelled"] }).notNull().default("active"),
  assignedBy: uuid("assigned_by").notNull().references(() => users.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  cancelledBy: uuid("cancelled_by").references(() => users.id), cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: text("cancellation_reason"), cancellationNotes: text("cancellation_notes"),
}, (t) => ({ oneActive: uniqueIndex("one_active_seller_discount_tier").on(t.sellerId, t.tierKey).where(sql`${t.status} = 'active'`),
  browse: index("discount_assignment_package_status").on(t.packageId, t.status, t.expiresAt), seller: index("discount_assignment_seller").on(t.sellerId, t.tierKey, t.expiresAt) })).enableRLS();

/** One checkout per listing; retained quotes protect idempotency and paid history. */
export const listingFeeCheckouts = pgTable("listing_fee_checkouts", {
  id: uuid("id").primaryKey().defaultRandom(), listingId: uuid("listing_id").notNull().unique(),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  assignmentId: uuid("assignment_id").references(() => sellerDiscountAssignments.id),
  regularFeeCents: integer("regular_fee_cents").notNull(), discountCents: integer("discount_cents").notNull(), finalFeeCents: integer("final_fee_cents").notNull(),
  requestKey: text("request_key").notNull(), paymentKey: text("payment_key").notNull().unique(),
  merchantRef: text("merchant_ref"), status: text("status", { enum: ["processing", "completed", "failed", "pending_reconciliation"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ usage: index("discount_checkout_usage").on(t.assignmentId, t.status), valid: check("discount_checkout_amounts", sql`${t.regularFeeCents} >= 0 AND ${t.discountCents} >= 0 AND ${t.finalFeeCents} >= 0 AND ${t.regularFeeCents} = ${t.discountCents} + ${t.finalFeeCents}`) })).enableRLS();
