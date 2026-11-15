/**
 * Seller listing edit rules, shared by the edit page, the dashboard and the
 * server action. Pure so they can be unit-tested.
 *
 * - Editable: draft, pending_review, active, rejected. Sold, expired,
 *   suspended and inactive listings are not edited by sellers (inactive could
 *   otherwise be reactivated with content moderation never saw).
 * - The category is locked: fields, conditions and fees depend on it.
 * - Editing a live (active) or rejected listing sends it back to review.
 * - Once a listing fee is paid, the price may change only while the new price
 *   does not fall in a more expensive fee tier.
 */

import type { ListingInput } from "./validation";

/** What the edit page needs to prefill the wizard. */
export type EditableListing = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  /** Root category when `categoryId` is a subcategory; otherwise null. */
  parentCategoryId: string | null;
  condition: string | null;
  price: number;
  deliveryMethod: ListingInput["deliveryMethod"];
  images: string[];
  metadata: ListingInput["metadata"];
  status: string;
  monetizationStatus: string;
};

export const EDITABLE_LISTING_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "rejected",
] as const;

export type EditableListingStatus = (typeof EDITABLE_LISTING_STATUSES)[number];

export function isListingEditable(status: string): status is EditableListingStatus {
  return (EDITABLE_LISTING_STATUSES as readonly string[]).includes(status);
}

/**
 * Status after a seller saves an edit.
 * - draft stays draft (not yet paid / submitted; the normal publish flow follows).
 * - pending_review stays in review.
 * - active and rejected go (back) to pending_review — unless the listing was
 *   never paid for, in which case a rejected listing returns to draft.
 */
export function statusAfterEdit(
  status: EditableListingStatus,
  monetizationStatus: string
): "draft" | "pending_review" {
  if (status === "draft") return "draft";
  if (status === "rejected" && monetizationStatus === "pending_paid") return "draft";
  return "pending_review";
}

export type PriceTierCheck =
  | { ok: true }
  | { ok: false; paidFeeCents: number; newFeeCents: number };

/**
 * A paid listing fee covers its tier. The new price is allowed when its fee is
 * not higher than the fee already paid (same or cheaper tier; no refunds).
 * Listings that never paid a per-listing fee (unpaid drafts, shop package
 * listings, commission-only) are not restricted.
 */
export function checkPaidPriceTier(options: {
  feePaid: boolean;
  paidFeeCents: number | null;
  newFeeCents: number;
}): PriceTierCheck {
  if (!options.feePaid) return { ok: true };
  const paid = options.paidFeeCents ?? 0;
  if (options.newFeeCents <= paid) return { ok: true };
  return { ok: false, paidFeeCents: paid, newFeeCents: options.newFeeCents };
}

/** Field names that differ between the stored listing and the edit. */
export function changedListingFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => stableStringify(before[key]) !== stableStringify(after[key]))
    .sort();
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}
