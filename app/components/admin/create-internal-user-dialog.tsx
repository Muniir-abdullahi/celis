"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ConfirmDialog } from "./confirm-dialog";
import { createAdminInternalUser } from "~/server/admin.functions";

export function CreateInternalUserDialog({ roles }: { roles: { value: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", role: "", department: "" });
  const selectedRole = roles.find((role) => role.value === form.role);
  const changeOpen = (value: boolean) => {
    if (busy) return;
    setOpen(value); setConfirm(false); setError("");
    setForm({ email: "", password: "", role: roles[0]?.value ?? "", department: "" });
  };
  const create = async () => {
    if (busy || !selectedRole) return;
    setBusy(true); setError("");
    try {
      const result = await createAdminInternalUser({ data: form });
      if (!result.success) { setError(result.error); setConfirm(false); return; }
      setOpen(false); setConfirm(false);
      setForm({ email: "", password: "", role: "", department: "" });
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again."); setConfirm(false);
    } finally { setBusy(false); }
  };
  return <>
    <Button onClick={() => changeOpen(true)} disabled={!roles.length}>Create internal user</Button>
    {!roles.length && <p className="text-sm text-muted-foreground">Create an internal role before adding staff.</p>}
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create internal user</DialogTitle>
          <DialogDescription>Create a staff account with the selected role. Save the password securely.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setError(""); if (selectedRole) setConfirm(true); }}>
          <div className="space-y-2"><Label htmlFor="ci-email">Email</Label>
            <Input id="ci-email" type="email" required maxLength={255} disabled={busy} autoComplete="off"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="ci-password">Password (8–72 characters)</Label>
            <Input id="ci-password" type="password" required minLength={8} maxLength={72} disabled={busy} autoComplete="new-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="ci-role">Role</Label>
            <Select value={form.role} disabled={busy} onValueChange={(role) => setForm({ ...form, role })}>
              <SelectTrigger id="ci-role"><SelectValue placeholder="Select an internal role" /></SelectTrigger>
              <SelectContent>{roles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-2"><Label htmlFor="ci-department">Department</Label>
            <Input id="ci-department" maxLength={100} disabled={busy} value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !selectedRole}>Review account</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={confirm} onOpenChange={(value) => { if (!busy) setConfirm(value); }} title="Create internal user?"
      description={`Create ${form.email} with the ${selectedRole?.label ?? "selected"} role${form.department ? ` in ${form.department}` : ""}? This account will receive that role's permissions.`}
      confirmLabel={busy ? "Creating…" : "Create user"} loading={busy} onConfirm={create} />
  </>;
}
