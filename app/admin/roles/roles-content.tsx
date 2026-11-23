"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  fetchCurrentUser,
  fetchAllPermissions,
  fetchRoles,
} from "~/server/auth.functions";
import { RolesWorkspace } from "~/components/admin/roles-workspace";
import { useRolePermissions } from "./use-role-permissions";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PageHeader } from "~/components/admin/page-header";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import {

  createRoleFn,
  updateRoleFn,
  deleteRoleFn,
} from "~/server/auth.functions";
import type { RoleRecord } from "~/server/auth.server";

type RolesData = {
  user: Awaited<ReturnType<typeof fetchCurrentUser>>;
  permissions: Awaited<ReturnType<typeof fetchAllPermissions>>;
  roles: Awaited<ReturnType<typeof fetchRoles>>;
};
export function RolesContent({ data }: { data: RolesData }) {
  const { user, permissions, roles } = data;
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<string>(roles.find((role) => role.key === "admin")?.key ?? roles[0]?.key ?? "");
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const canManage = user?.isSuperAdmin ?? false;
  const editor = useRolePermissions(selectedRole, canManage);

  const [confirmAction, setConfirmAction] = useState<"role" | "permissions" | null>(null);

  const [roleDialog, setRoleDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    role?: RoleRecord;
  }>({ open: false, mode: "create" });
  const [roleForm, setRoleForm] = useState({
    key: "",
    label: "",
    description: "",
    domain: "internal" as "customer" | "internal",
  });
  const [roleFormLoading, setRoleFormLoading] = useState(false);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    role?: RoleRecord;
  }>({ open: false });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const selectRole = (key: string) => {
    if (key === selectedRole || editor.saving) return;
    if (editor.dirty) setPendingRole(key);
    else setSelectedRole(key);
  };

  const openCreateRole = () => {
    setRoleForm({ key: "", label: "", description: "", domain: "internal" });
    setRoleFormError(null);
    setRoleDialog({ open: true, mode: "create" });
  };

  const openEditRole = (role: RoleRecord) => {
    setRoleForm({
      key: role.key,
      label: role.label,
      description: role.description ?? "",
      domain: role.domain,
    });
    setRoleFormError(null);
    setRoleDialog({ open: true, mode: "edit", role });
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmAction("role");
  };

  const saveRole = async () => {
    if (!canManage) return;
    setRoleFormLoading(true);
    setRoleFormError(null);
    try {
      const result = roleDialog.mode === "create"
        ? await createRoleFn({ data: roleForm })
        : await updateRoleFn({ data: roleForm });
      setConfirmAction(null);
      if (!result.success) { setRoleFormError(result.error); return; }
      selectRole(result.data.key);
      router.refresh();
      setRoleDialog({ open: false, mode: "create" });
    } catch (err) {
      setConfirmAction(null);
      setRoleFormError("Could not save the role. Please try again.");
    } finally {
      setRoleFormLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!canManage || !deleteDialog.role) return;
    setDeleteLoading(true);
    try {
      await deleteRoleFn({ data: { key: deleteDialog.role.key } });
      router.refresh();
      if (selectedRole === deleteDialog.role.key) {
        setSelectedRole(roles.find((role) => role.key !== deleteDialog.role?.key)?.key ?? "");
      }
      setDeleteDialog({ open: false });
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectedRoleRecord = roles.find((r) => r.key === selectedRole);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & permissions"
        description="Control what each role can do in the admin dashboard"
        action={
          canManage ? (
            <Button disabled={editor.saving} onClick={openCreateRole}><Plus className="mr-2 h-4 w-4" />Create role</Button>
          ) : undefined
        }
      />

      {!canManage && (
        <p className="rounded-md border border-celis-caution bg-celis-caution-subtle p-3 text-sm text-celis-ink">
          Only super admins can manage role permissions.
        </p>
      )}

      <RolesWorkspace roles={roles} permissions={permissions} selectedRole={selectedRole} selectedKeys={editor.keys}
        canManage={canManage} loading={editor.loading} saving={editor.saving} saved={editor.saved} dirty={editor.dirty} error={editor.error}
        onSelect={selectRole} onToggle={editor.toggle} onEdit={openEditRole} onDelete={(role) => setDeleteDialog({ open: true, role })}
        onSave={() => setConfirmAction("permissions")} onReset={editor.reset} onRetry={editor.retry} />

      <ConfirmDialog open={pendingRole !== null} onOpenChange={(open) => { if (!open) setPendingRole(null); }}
        title="Discard unsaved changes?" description="Your permission changes have not been saved. Discard them and switch to the selected role?"
        confirmLabel="Discard and switch" destructive onConfirm={() => { if (pendingRole) setSelectedRole(pendingRole); setPendingRole(null); }} />

      <Dialog open={roleDialog.open} onOpenChange={(open) => { if (!roleFormLoading) setRoleDialog((d) => ({ ...d, open })); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {roleDialog.mode === "create" ? "Create role" : "Edit role"}
            </DialogTitle>
            <DialogDescription>
              {roleDialog.mode === "create"
                ? "Define a new role and assign permissions to it."
                : "Update the role name, description or domain."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRoleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-key">Role key</Label>
              <Input
                id="role-key"
                value={roleForm.key}
                onChange={(e) =>
                  setRoleForm((f) => ({ ...f, key: e.target.value }))
                }
                placeholder="e.g. finance_officer"
                disabled={roleDialog.mode === "edit"}
                minLength={2}
                maxLength={60}
                required
              />
              <p className="text-xs text-celis-ink-tertiary">
                Machine identifier. Cannot be changed after creation.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-label">Display name</Label>
              <Input
                id="role-label"
                value={roleForm.label}
                onChange={(e) =>
                  setRoleForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="e.g. Finance Officer"
                minLength={2}
                maxLength={80}
                disabled={roleFormLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={roleForm.description}
                onChange={(e) =>
                  setRoleForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="What can this role do?"
                rows={3}
                maxLength={500}
                disabled={roleFormLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-domain">Domain</Label>
              <Select
                value={roleForm.domain}
                onValueChange={(v) =>
                  setRoleForm((f) => ({ ...f, domain: v as "customer" | "internal" }))
                }
              >
                <SelectTrigger id="role-domain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal staff</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {roleFormError && (
              <p role="alert" className="text-sm text-destructive">{roleFormError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoleDialog({ open: false, mode: "create" })}
                disabled={roleFormLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={roleFormLoading}>
                {roleFormLoading ? "Saving..." : "Save role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open && !roleFormLoading && !editor.saving) setConfirmAction(null); }}
        title={confirmAction === "permissions" ? "Save role permissions?" : roleDialog.mode === "create" ? "Create role?" : "Update role?"}
        description={confirmAction === "permissions"
          ? `Apply the selected permissions to ${selectedRoleRecord?.label ?? selectedRole}? Users assigned to this role will receive these permissions.`
          : `${roleDialog.mode === "create" ? "Create" : "Update"} ${roleForm.label} as a ${roleForm.domain} role? New roles start without permissions; configure and save their permissions after creation.`}
        loading={roleFormLoading || editor.saving} confirmLabel="Confirm"
        onConfirm={() => { if (confirmAction === "role") void saveRole(); else { setConfirmAction(null); void editor.save(); } }} />

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteDialog.role?.label}</strong>? This will also remove
              all permission assignments for this role.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false })}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRole}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
