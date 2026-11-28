export interface StaffIdentity {
  displayName: string | null;
  staffId: string | null;
  department: string | null;
  role: string;
  isSuperAdmin: boolean;
}

/** Presentation only. Authorization continues to use server permissions. */
export function staffIdentityLabels(user: StaffIdentity) {
  return {
    name: user.displayName?.trim() || "Name not assigned",
    staffId: user.staffId || "Staff ID not assigned",
    department: user.department?.trim() || "Department not assigned",
    accountType: user.isSuperAdmin || user.role === "admin" ? "Admin User" : "Internal User",
  };
}
