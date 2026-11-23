import { and, count, eq, gt, ne } from "drizzle-orm";
import { db } from "~/db";
import { listingFeeCheckouts, sellerDiscountAssignments } from "~/db/schema";

type Reader = Pick<typeof db, "select">;
export async function discountUsage(assignmentId: string, reader: Reader = db) {
  const [row] = await reader.select({ used: count() }).from(listingFeeCheckouts).where(and(eq(listingFeeCheckouts.assignmentId, assignmentId), ne(listingFeeCheckouts.status, "failed")));
  return Number(row.used);
}
export async function findSellerDiscount(sellerId: string, tierKey: string, reader: Reader = db) {
  const [assignment] = await reader.select().from(sellerDiscountAssignments).where(and(
    eq(sellerDiscountAssignments.sellerId, sellerId), eq(sellerDiscountAssignments.tierKey, tierKey),
    eq(sellerDiscountAssignments.status, "active"), gt(sellerDiscountAssignments.expiresAt, new Date()),
  )).limit(1);
  if (!assignment || await discountUsage(assignment.id, reader) >= assignment.terms.listingLimit) return null;
  return assignment;
}
