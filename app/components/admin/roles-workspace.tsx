"use client";

import { useState } from "react";
import { KeyRound, Search, Shield, Pencil, Trash2, Check, LockKeyhole } from "lucide-react";
import type { RoleRecord } from "~/server/auth.server";
import { groupPermissions, type PermissionOption } from "~/lib/role-permissions";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { PermissionGroupsSkeleton } from "./roles-skeleton";

type Props = {
  roles: RoleRecord[]; permissions: PermissionOption[]; selectedRole: string; selectedKeys: string[];
  canManage: boolean; loading: boolean; saving: boolean; saved: boolean; dirty: boolean; error: string;
  onSelect: (role: string) => void; onToggle: (key: string) => void; onEdit: (role: RoleRecord) => void;
  onDelete: (role: RoleRecord) => void; onSave: () => void; onReset: () => void; onRetry: () => void;
};

export function RolesWorkspace(props: Props) {
  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const role = props.roles.find((item) => item.key === props.selectedRole);
  const selected = new Set(props.selectedKeys);
  const visibleRoles = props.roles.filter((item) => `${item.label} ${item.description ?? ""}`.toLowerCase().includes(roleSearch.toLowerCase().trim()));
  const groups = groupPermissions(props.permissions, permissionSearch);
  const locked = !role || !props.canManage || props.selectedRole === "super_admin";
  return <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
    <aside className="min-w-0 overflow-hidden rounded-md border border-celis-border bg-celis-surface-base">
      <div className="space-y-4 border-b border-celis-border p-4">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Roles</h2><Badge variant="outline">{props.roles.length}</Badge></div>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-celis-ink-tertiary" /><Input aria-label="Search roles" placeholder="Find a role…" className="pl-9" value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} /></div>
      </div>
      <nav aria-label="Roles" className="max-h-72 space-y-1 overflow-y-auto p-2 lg:max-h-[650px]">
        {(["internal", "customer"] as const).map((domain) => <div key={domain}>
          {visibleRoles.some((item) => item.domain === domain) && <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-celis-ink-tertiary">{domain === "internal" ? "Internal staff" : "Customers"}</p>}
          {visibleRoles.filter((item) => item.domain === domain).map((item) => <button key={item.key} type="button" aria-current={item.key === props.selectedRole ? "true" : undefined}
            disabled={props.saving} onClick={() => { props.onSelect(item.key); setPermissionSearch(""); }}
            className={cn("flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celis-primary disabled:opacity-50", item.key === props.selectedRole ? "bg-celis-primary-subtle text-celis-primary" : "text-celis-ink-secondary hover:bg-celis-surface-inset")}>
            <Shield className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-5">{item.label}</span><span className="mt-0.5 block text-xs text-celis-ink-tertiary">{item.isSystem ? "System role" : "Custom role"}</span></span>
          </button>)}
        </div>)}
        {!visibleRoles.length && <p className="p-4 text-sm text-celis-ink-secondary">No roles match your search.</p>}
      </nav>
    </aside>
    <section className="min-w-0 rounded-md border border-celis-border bg-celis-surface-base" aria-label="Role permissions" aria-busy={props.loading}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-celis-border p-5">
        <div className="flex min-w-0 items-start gap-3"><span className="rounded-md bg-celis-primary-subtle p-2.5 text-celis-primary"><Shield className="h-5 w-5" /></span><div className="min-w-0"><h2 className="text-lg font-semibold">{role?.label ?? "Select a role"}</h2><p className="mt-1 max-w-xl text-sm text-celis-ink-secondary">{role?.description || "Choose the actions people with this role can perform."}</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{role?.domain === "customer" ? "Customer" : "Internal staff"}</Badge>{role?.isSystem && <Badge variant="outline">System role</Badge>}<span className="inline-flex items-center gap-1.5 text-xs text-celis-ink-secondary"><KeyRound className="h-3.5 w-3.5" />{props.loading ? "Loading permissions…" : `${selected.size} of ${props.permissions.length} enabled`}</span></div></div></div>
        {props.canManage && role && <div className="flex gap-1"><Button variant="outline" size="sm" disabled={props.saving} onClick={() => props.onEdit(role)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit role</Button>{!role.isSystem && <Button variant="ghost" size="sm" className="text-destructive" aria-label={`Delete ${role.label}`} disabled={props.saving} onClick={() => props.onDelete(role)}><Trash2 className="h-4 w-4" /></Button>}</div>}
      </div>
      <div className="space-y-5 p-5">
        {locked && <p className="flex items-center gap-2 rounded-md bg-celis-surface-inset p-3 text-sm text-celis-ink-secondary"><LockKeyhole className="h-4 w-4 shrink-0" />{props.canManage ? "This role's permissions are managed automatically." : "Read-only access. A super admin can change permissions."}</p>}
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-celis-ink-tertiary" /><Input aria-label="Search permissions" placeholder="Search permissions or modules…" value={permissionSearch} onChange={(e) => setPermissionSearch(e.target.value)} className="pl-9" /></div>
        {props.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-celis-destructive/30 bg-celis-destructive-subtle p-3 text-sm"><p>{props.error}</p>{!props.dirty && <Button variant="outline" size="sm" onClick={props.onRetry}>Try again</Button>}</div>}
        {props.loading ? <PermissionGroupsSkeleton /> : <div className="grid items-start gap-4 xl:grid-cols-2">{groups.map((group) => <div key={group.label} className="overflow-hidden rounded-md border border-celis-border">
          <div className="flex items-center justify-between gap-3 bg-celis-surface-inset px-4 py-3"><h3 className="text-sm font-semibold">{group.label}</h3><span className="text-xs tabular-nums text-celis-ink-tertiary">{group.items.filter((item) => selected.has(item.key)).length}/{group.items.length}</span></div>
          <div className="divide-y divide-celis-border">{group.items.map((permission) => <label key={permission.key} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-celis-surface-inset/50"><span className="min-w-0"><span className="block text-sm font-medium">{permission.label}</span>{permission.description && <span className="mt-1 block text-xs leading-relaxed text-celis-ink-secondary">{permission.description}</span>}</span><Switch aria-label={permission.label} checked={selected.has(permission.key)} disabled={locked || props.saving || (!!props.error && !props.dirty)} onCheckedChange={() => props.onToggle(permission.key)} /></label>)}</div>
        </div>)}</div>}
        {!props.loading && !groups.length && <div className="py-12 text-center"><Search className="mx-auto mb-3 h-6 w-6 text-celis-ink-tertiary" /><p className="text-sm font-medium">No matching permissions</p><p className="mt-1 text-xs text-celis-ink-secondary">Try another action or module name.</p></div>}
      </div>
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-md border-t border-celis-border bg-celis-surface-base p-4">
        <p role="status" className="text-sm text-celis-ink-secondary">{props.loading ? "Loading permissions…" : props.dirty ? "You have unsaved changes" : props.error ? "Permissions are unavailable" : props.saved ? <span className="inline-flex items-center gap-2 text-celis-success"><Check className="h-4 w-4" />Changes saved</span> : locked ? "Read-only view" : "All changes saved"}</p>
        {props.canManage && <div className="flex gap-2"><Button variant="ghost" disabled={!props.dirty || props.saving} onClick={props.onReset}>Discard</Button><Button disabled={locked || !props.dirty || props.loading || props.saving} onClick={props.onSave}>{props.saving ? "Saving…" : "Save changes"}</Button></div>}
      </div>
    </section>
  </div>;
}
