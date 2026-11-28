"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { addStaffDepartment, updateStaffIdentity } from "~/server/staff-identity.functions";

export function StaffIdentityDialog({ user, departments }: {
  user?: { id: string; displayName: string | null; department: string | null };
  departments: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const changeOpen = (next: boolean) => {
    if (busy) return;
    setOpen(next); setConfirm(false); setError("");
    setName(user?.displayName ?? ""); setDepartment(user?.department ?? "");
  };
  const save = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = user ? await updateStaffIdentity({ id: user.id, fullName: name, department }) : await addStaffDepartment(name);
      if (!result.success) { setError(result.error); setConfirm(false); return; }
      setOpen(false); setConfirm(false); router.refresh();
    } catch { setError("Could not save. Please try again."); setConfirm(false); }
    finally { setBusy(false); }
  };
  return <>
    <Button variant="outline" size="sm" onClick={() => changeOpen(true)}>{user ? "Edit identity" : "Add department"}</Button>
    <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>{user ? "Edit staff identity" : "Add department"}</DialogTitle><DialogDescription>{user ? "Update the staff name and department. The Staff ID is permanent." : "Add a department to the list available for staff accounts."}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setConfirm(true); }}>
        <div className="space-y-2"><Label htmlFor={`staff-name-${user?.id ?? "department"}`}>{user ? "Full name" : "Department name"}</Label>
          <Input id={`staff-name-${user?.id ?? "department"}`} value={name} required maxLength={user ? 60 : 100} disabled={busy} onChange={(event) => setName(event.target.value)} /></div>
        {user && <div className="space-y-2"><Label htmlFor={`staff-department-${user.id}`}>Department</Label>
          <Select value={department ? `department:${department}` : "none"} disabled={busy} onValueChange={(value) => setDepartment(value === "none" ? "" : value.slice(11))}>
            <SelectTrigger id={`staff-department-${user.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Department not assigned</SelectItem>{departments.filter(Boolean).map((value) => <SelectItem key={value} value={`department:${value}`}>{value}</SelectItem>)}</SelectContent>
          </Select></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy || !name.trim()}>Review changes</Button>
      </form>
    </DialogContent></Dialog>
    <ConfirmDialog open={confirm} onOpenChange={(next) => { if (!busy) setConfirm(next); }} title={user ? "Update staff identity?" : "Add department?"}
      description={user ? `Save ${name} with department ${department || "not assigned"}?` : `Add ${name} to the staff department list?`}
      confirmLabel={busy ? "Saving…" : "Save"} loading={busy} onConfirm={save} />
  </>;
}
