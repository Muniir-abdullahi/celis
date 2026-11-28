import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

/** Server-only outbox. No plaintext phone numbers or OTPs. */
export const authMessageDeliveries = pgTable("auth_message_deliveries", {
  id: text("id").primaryKey(),
  payload: text("payload"),
  status: text("status", { enum: ["queued", "sending", "sent", "failed", "expired"] }).notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  due: index("idx_auth_message_deliveries_due").on(table.status, table.nextAttemptAt),
  expiry: index("idx_auth_message_deliveries_expiry").on(table.expiresAt),
  retention: index("idx_auth_message_deliveries_retention").on(table.updatedAt),
})).enableRLS();
