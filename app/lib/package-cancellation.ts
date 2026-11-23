import { z } from "zod";

export const cancellationReasons = ["admin_decision", "seller_request", "policy_violation"] as const;
export const cancellationSchema = z.object({
  assignmentId: z.string().uuid(),
  reason: z.enum(cancellationReasons),
  notes: z.string().trim().max(500).optional(),
  confirmed: z.literal(true),
});
