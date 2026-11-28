"use server";

import { z } from "zod";
import { and, eq, or, exists } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "~/db";
import { users, profiles, staffDepartments, auditLogs, roles } from "~/db/schema";
import { requirePermission } from "./auth.server";
import { adminMutation, AdminInputError } from "~/lib/admin-mutation";

export async function listStaffDepartments() {
  await requirePermission("users:read");
  // Small configuration vocabulary, not a user or transactional dataset.
  const rows = await db.select({ name: staffDepartments.name }).from(staffDepartments).orderBy(staffDepartments.name);
  return rows.map((row) => row.name);
}

export async function addStaffDepartment(raw: unknown) {
  return adminMutation(async () => {
    const actor = await requirePermission("users:manage");
    const name = z.string().trim().min(1).max(100).parse(raw);
    await db.transaction(async (tx) => {
      const added = await tx.insert(staffDepartments).values({ name }).onConflictDoNothing().returning();
      if (!added.length) throw new AdminInputError("This department already exists.");
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "staff_department_created", resourceType: "department", metadata: { name } });
    });
    revalidatePath("/admin/users");
    return { name };
  });
}

export async function updateStaffIdentity(raw: unknown) {
  return adminMutation(async () => {
    const actor = await requirePermission("users:manage");
    const input = z.object({ id: z.string().uuid(), fullName: z.string().trim().min(1).max(60), department: z.string().trim().max(100) }).strict().parse(raw);
    await db.transaction(async (tx) => {
      const [target] = await tx.select({ id: users.id, department: users.department }).from(users)
        .where(and(eq(users.id, input.id), or(eq(users.isInternal, true), eq(users.role, "admin"), eq(users.isSuperAdmin, true),
          exists(tx.select({ key: roles.key }).from(roles).where(and(eq(roles.key, users.role), eq(roles.domain, "internal")))))))
        .for("update").limit(1);
      if (!target) throw new AdminInputError("Internal staff account not found.");
      if (input.department) {
        const [department] = await tx.select().from(staffDepartments).where(eq(staffDepartments.name, input.department)).limit(1);
        if (!department) throw new AdminInputError("Select an existing department.");
      }
      const [oldProfile] = await tx.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, input.id)).limit(1);
      await tx.update(users).set({ department: input.department || null, updatedAt: new Date() }).where(eq(users.id, input.id));
      await tx.insert(profiles).values({ id: input.id, displayName: input.fullName }).onConflictDoUpdate({ target: profiles.id, set: { displayName: input.fullName, updatedAt: new Date() } });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "staff_identity_updated", resourceType: "user", resourceId: input.id,
        metadata: { before: { fullName: oldProfile?.displayName, department: target.department }, after: { fullName: input.fullName, department: input.department || null } } });
    });
    revalidatePath("/admin", "layout");
    return { id: input.id };
  });
}
