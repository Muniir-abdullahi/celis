import { db } from "~/db";
import { authUsers, profiles, users } from "~/db/schema";
import { getServiceSupabase } from "~/lib/supabase/server";
import { customerAccountSchema, provisionCustomerAccount } from "~/lib/customer-account";
import { requirePermission } from "./auth.server";
import { insertAuditLog } from "./audit.server";
import { generateUniqueSellerNumber } from "./seller-packages.server";

export async function createCustomerAccount(rawInput: unknown) {
  const actor = await requirePermission("users:manage");
  const input = customerAccountSchema.parse(rawInput);
  const supabase = getServiceSupabase();
  const result = await provisionCustomerAccount(input, {
    async createAuth(data) {
      const { data: authData, error } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        // This setting is never accepted from user-editable user_metadata.
        app_metadata: { play_reviewer: data.playReviewer },
        user_metadata: { display_name: data.displayName, role: data.role },
      });
      if (error || !authData.user) throw new Error(error?.message ?? "Account creation failed.");
      return authData.user.id;
    },
    async saveCustomer(id, data) {
      const sellerNumber = data.role === "seller" ? await generateUniqueSellerNumber() : null;
      await db.transaction(async (tx) => {
        // Supabase's new-user trigger may already have created these rows.
        await tx.insert(authUsers).values({ id, email: data.email })
          .onConflictDoNothing({ target: authUsers.id });
        const customer = {
          email: data.email, role: data.role, isInternal: false,
          isSuperAdmin: false, createdBy: actor.id,
        };
        await tx.insert(users).values({ id, ...customer })
          .onConflictDoUpdate({ target: users.id, set: customer });
        const profile = {
          displayName: data.displayName, phone: data.phone ?? null, sellerNumber,
          sellerType: data.role === "seller" ? data.sellerType : null,
          businessName: data.role === "seller" && data.sellerType === "shop" ? data.businessName : null,
          businessRegistrationNumber: data.role === "seller" && data.sellerType === "shop" ? data.businessRegistrationNumber || null : null,
          businessAddress: data.role === "seller" && data.sellerType === "shop" ? data.businessAddress || null : null,
        };
        await tx.insert(profiles).values({ id, ...profile })
          .onConflictDoUpdate({ target: profiles.id, set: profile });
      });
    },
    async deleteAuth(id) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) throw error;
    },
  });
  await insertAuditLog({
    action: "customer_created", resourceType: "user", resourceId: result.id,
    metadata: { role: input.role, playReviewer: input.playReviewer, actorId: actor.id },
  });
  return result;
}
