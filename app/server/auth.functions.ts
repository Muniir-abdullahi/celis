"use server";

import { z } from "zod";
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
  const data = (signUpSchema).parse(input.data);

    // Use the service-role client to create the user with a confirmed email.
    // This avoids Supabase's sign-up email rate limit and skips the
    // confirmation step in this environment.
    const serviceSupabase = getServiceSupabase();
    const { data: authData, error } = await serviceSupabase.auth.admin.createUser(
      {
        email: data.email,
        password: data.password,
        email_confirm: true,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (!authData.user?.email) {
      throw new Error("Sign up succeeded but user was not returned.");
    }

    await ensureLocalUserRecord(
      authData.user.id,
      authData.user.email,
      data.role
    );

    const { db } = await import("~/db");
    const { profiles } = await import("~/db/schema");
    const { eq } = await import("drizzle-orm");
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
      .where(eq(profiles.id, authData.user.id));

    // Sign in with the anon client so the session cookies are set for the user.
    const supabase = await getSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (signInError) {
      throw new Error(signInError.message);
    }

    return { success: true, userId: authData.user.id };
}

export async function signIn(input: { data: unknown }) {
  const data = (credentialsSchema).parse(input.data);

    const supabase = await getSupabaseServerClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error || !authData.user?.email) {
      throw new Error(error?.message ?? "Invalid email or password");
    }

    await ensureLocalUserRecord(authData.user.id, authData.user.email);
    return { success: true, userId: authData.user.id };
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
