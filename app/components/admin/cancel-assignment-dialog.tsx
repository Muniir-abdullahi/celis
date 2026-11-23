"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { cancellationReasons } from "~/lib/package-cancellation";

export function CancelAssignmentDialog({ seller, packageName, onCancel }: {
  seller: string; packageName: string;
  onCancel: (data: { reason: typeof cancellationReasons[number]; notes: string; confirmed: true }) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState<typeof cancellationReasons[number]>("admin_decision");
  const [notes, setNotes] = useState(""), [error, setError] = useState("");
  return <><Button size="sm" variant="outline" onClick={() => { setOpen(true); setConfirmed(false); setError(""); }}>Cancel package</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}><DialogContent>
      <DialogHeader><DialogTitle>Cancel seller package?</DialogTitle><DialogDescription>Cancel {packageName} for {seller}? Unused benefits stop immediately. Existing listings and completed payments stay unchanged. This does not issue a refund.</DialogDescription></DialogHeader>
      <fieldset disabled={busy} className="space-y-3"><legend className="mb-3 text-sm font-medium">Cancellation reason</legend>{cancellationReasons.map((value) => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name="cancel-reason" checked={reason === value} onChange={() => setReason(value)} />{value.replaceAll("_", " ")}</label>)}
        <label className="block text-sm">Notes (optional)<textarea className="mt-2 w-full rounded-md border border-input bg-background p-2" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I confirm that I want to cancel this assignment.</label>
      </fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep active</Button><Button variant="destructive" disabled={busy || !confirmed} onClick={async () => { setBusy(true); setError(""); try { const result = await onCancel({ reason, notes, confirmed: true }); if (!result.success) setError(result.error ?? "Cancellation failed."); else { setOpen(false); router.refresh(); } } catch { setError("Could not reach the server."); } finally { setBusy(false); } }}>{busy ? "Cancelling…" : "Confirm cancellation"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
