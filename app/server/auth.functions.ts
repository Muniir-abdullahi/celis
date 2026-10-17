"use server";

import { z } from "zod";
import { getSignInErrorMessage } from "~/lib/auth-errors";
import {
  getSupabaseServerClient,
  getServiceSupabase,
} from "~/lib/supabase/server";
import {
  getCurrentUser,
  getCurrentUserProfile,
  updateUserProfile,
  ensureLocalUserRecord,
  listPermissions,
  getRolePermissions,
  getUserPermissions,
  setRolePermissions,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} from "./auth.server";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function fetchCurrentUser() {

    return getCurrentUser();
}

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2).max(60),
  role: z.enum(["buyer", "seller"]).default("buyer"),
  sellerType: z.enum(["individual", "shop"]).optional(),
  businessName: z.string().max(120).optional(),
  businessRegistrationNumber: z.string().max(60).optional(),
  businessAddress: z.string().max(500).optional(),
  shopSlug: z.string().max(120).optional(),
});

export async function signUp(input: { data: unknown }) {
  const parsed = signUpSchema.safeParse(input.data);
  if (!parsed.success) {
    return { success: false as const, error: "Check the details and try again." };
  }

  const data = parsed.data;
  let phase = "create_auth_user";
  try {
    const serviceSupabase = getServiceSupabase();
    const { data: created, error: createError } =
      await serviceSupabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      });

    let authUser = created.user;
    let alreadySignedIn = false;
    if (createError) {
      const isExistingEmail =
        createError.code === "email_exists" ||
        /already registered|already exists/i.test(createError.message);
      if (!isExistingEmail) throw createError;

      // A previous attempt may have created the Auth account but failed while
      // provisioning the local user/profile. Verify ownership before repair.
      phase = "verify_existing_auth_user";
      const supabase = await getSupabaseServerClient();
      const { data: signedIn, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
      if (signInError || !signedIn.user) {
        return {
          success: false as const,
          error: "An account already exists for this email. Sign in or reset your password.",
        };
      }
      authUser = signedIn.user;
      alreadySignedIn = true;
    }

    if (!authUser?.email) throw new Error("Auth user was not returned");

    phase = "provision_local_user";
    const { db } = await import("~/db");
    const { profiles, users } = await import("~/db/schema");
    const { eq } = await import("drizzle-orm");
    const localUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);
    const [localProfile] = await db
      .select({ displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, authUser.id))
      .limit(1);
    await ensureLocalUserRecord(authUser.id, authUser.email, data.role);

    // An authenticated retry may be repairing an interrupted first signup.
    // Preserve profile data when this is already a fully provisioned account.
    const profileNeedsSetup =
      !localProfile || localProfile.displayName === authUser.email.split("@")[0];
    if (!alreadySignedIn || localUser.length === 0 || profileNeedsSetup) {
      phase = "update_profile";
      await db
        .update(profiles)
        .set({
          displayName: data.displayName,
          sellerType: data.sellerType,
          businessName: data.businessName || null,
          businessRegistrationNumber:
            data.businessRegistrationNumber || null,
          businessAddress: data.businessAddress || null,
          shopSlug: data.shopSlug || null,
        })
        .where(eq(profiles.id, authUser.id));
    }

    if (!alreadySignedIn) {
      phase = "sign_in_new_user";
      const supabase = await getSupabaseServerClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInError) throw signInError;
    }

    return { success: true as const, userId: authUser.id };
  } catch (error) {
    const providerError = error as { code?: unknown; name?: unknown };
    console.error("[signup] account setup failed", {
      phase,
      errorName: typeof providerError.name === "string" ? providerError.name : "Error",
      errorCode: typeof providerError.code === "string" ? providerError.code : undefined,
    });
    return {
      success: false as const,
      error:
        phase === "sign_in_new_user"
          ? "Your account was created, but sign-in could not be completed. Please sign in."
          : "We could not finish creating your account. Please try again or contact Celis support if the problem continues.",
    };
  }
}

export async function signIn(input: { data: unknown }) {
  const parsed = credentialsSchema.safeParse(input.data);
  if (!parsed.success) {
    return { success: false as const, error: "Enter a valid email address and password." };
  }
  const data = parsed.data;

    const supabase = await getSupabaseServerClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error || !authData.user?.email) {
      return {
        success: false as const,
        error: getSignInErrorMessage(error ?? {}),
      };
    }

    await ensureLocalUserRecord(authData.user.id, authData.user.email);
    return { success: true as const, userId: authData.user.id };
}

export async function signOut() {

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function fetchCurrentUserProfile() {

    return getCurrentUserProfile();
}

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(60),
  phone: z.string().max(15).optional(),
  bio: z.string().max(500).optional(),
  sellerType: z.enum(["individual", "shop"]).optional(),
  businessName: z.string().max(120).optional(),
  businessRegistrationNumber: z.string().max(60).optional(),
  businessAddress: z.string().max(500).optional(),
  businessLogoUrl: z.string().url().optional(),
  shopSlug: z.string().max(120).optional(),
});

export async function updateCurrentUserProfile(input: { data: unknown }) {
  const data = (updateProfileSchema).parse(input.data);

    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return updateUserProfile(user.id, data);
}

export async function fetchCurrentUserPermissions() {

    const user = await getCurrentUser();
    if (!user) return [];
    return getUserPermissions(user);
}

export async function fetchAllPermissions() {
return listPermissions();
}

const rolePermissionsQuerySchema = z.object({
  role: z.string(),
});

export async function fetchRolePermissions(input: { data: unknown }) {
  const data = (rolePermissionsQuerySchema).parse(input.data);
return getRolePermissions(data.role);
}

const updateRolePermissionsSchema = z.object({
  role: z.string(),
  permissionKeys: z.array(z.string()),
});

export async function updateRolePermissions(input: { data: unknown }) {
  const data = (updateRolePermissionsSchema).parse(input.data);

    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return setRolePermissions(data.role, data.permissionKeys, user);
}

export async function fetchRoles() {

  return listRoles();
}

const createRoleSchema = z.object({
  key: z.string().min(2).max(60),
  label: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  domain: z.enum(["customer", "internal"]).default("internal"),
});

export async function createRoleFn(input: { data: unknown }) {
  const data = (createRoleSchema).parse(input.data);
return createRole(data);
}

const updateRoleSchema = z.object({
  key: z.string(),
  label: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  domain: z.enum(["customer", "internal"]).default("internal"),
});

export async function updateRoleFn(input: { data: unknown }) {
  const data = (updateRoleSchema).parse(input.data);
return updateRole(data.key, data);
}

const deleteRoleSchema = z.object({ key: z.string() });

export async function deleteRoleFn(input: { data: unknown }) {
  const data = (deleteRoleSchema).parse(input.data);
return deleteRole(data.key);
}
