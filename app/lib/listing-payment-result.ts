import type { WaafiPurchaseResult } from "./waafi";

/** Unrecognized/malformed responses are not evidence that no charge occurred. */
export function listingPaymentStatus(response: WaafiPurchaseResult, amountCents: number) {
  if (response.approved && response.amountCents === amountCents) return "completed" as const;
  if (!response.approved && ["FAILED", "DECLINED", "CANCELLED", "REJECTED"].includes(response.state ?? "")) return "failed" as const;
  return "pending_reconciliation" as const;
}
