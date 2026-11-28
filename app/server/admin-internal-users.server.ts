import { db } from "~/db";
import { authUsers, users, profiles, auditLogs, staffDepartments } from "~/db/schema";
import { eq } from "drizzle-orm";
import { internalAccountSchema, provisionInternalAccount } from "~/lib/internal-account";
import { AdminInputError } from "~/lib/admin-mutation";
import { getServiceSupabase } from "~/lib/supabase/server";
import { isInternalRole, requirePermission } from "./auth.server";

export async function createInternalUser(rawInput: unknown) {
  const actor = await requirePermission("users:manage");
  const input = internalAccountSchema.parse(rawInput);
  const supabase = getServiceSupabase();
  return provisionInternalAccount(input, {
    isInternalRole,
    async createAuth(data) {
      const { data: auth, error } = await supabase.auth.admin.createUser({
        email: data.email, password: data.password, email_confirm: true,
      });
      if (error || !auth.user) {
        const message = error?.code === "email_exists" || error?.code === "user_already_exists"
          ? "An account with this email already exists. Use a different email or manage the existing account."
          : error?.code === "weak_password"
            ? "The password does not meet the authentication provider's requirements. Choose a stronger password."
            : "The authentication provider could not create this account. Check its availability and try again.";
        throw new AdminInputError(message);
      }
      return auth.user.id;
    },
    async saveAccount(id, data) {
      await db.transaction(async (tx) => {
        // Supabase triggers can already have provisioned these records.
        if (data.department) {
          const [department] = await tx.select().from(staffDepartments).where(eq(staffDepartments.name, data.department)).limit(1);
          if (!department) throw new AdminInputError("Select an existing department.");
        }
        await tx.insert(authUsers).values({ id, email: data.email })
          .onConflictDoNothing({ target: authUsers.id });
        const account = {
          email: data.email, role: data.role, isInternal: true, isSuperAdmin: false,
          department: data.department || null, verificationStatus: "approved" as const,
          verifiedAt: new Date(), createdBy: actor.id,
        };
        await tx.insert(users).values({ id, ...account })
          .onConflictDoUpdate({ target: users.id, set: account });
        const profile = { displayName: data.fullName, sellerNumber: null, sellerType: null };
        await tx.insert(profiles).values({ id, ...profile })
          .onConflictDoUpdate({ target: profiles.id, set: profile });
        await tx.insert(auditLogs).values({
          actorId: actor.id, action: "internal_user_created", resourceType: "user", resourceId: id,
          metadata: { email: data.email, role: data.role, department: data.department ?? null },
        });
      });
    },
    async deleteAuth(id) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) throw error;
    },
  });
}
