"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "~/components/admin/page-header";
import { AdminTable } from "~/components/admin/admin-table";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { CancelAssignmentDialog } from "~/components/admin/cancel-assignment-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Pagination } from "~/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "~/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select";
import { saveDiscount, activateDiscount, assignDiscount, cancelDiscount, findDiscountSellers } from "~/server/discount-packages.functions";
import type { getDiscountAdminData } from "~/server/discount-packages.server";
import { discountedFee, listingTierKey } from "~/lib/listing-discounts";
import { formatDate, formatPrice } from "~/lib/format";

type Data = Awaited<ReturnType<typeof getDiscountAdminData>>;
type Definition = Data["definitions"][number];
type ActionResult = { success: boolean; error?: string };
const initialForm = { id: undefined as string | undefined, name: "", tierKey: "", type: "percentage" as "percentage" | "fixed", value: "25", listingLimit: "50", durationDays: "30" };

export function DiscountPackagesContent({ data }: { data: Data }) {
  const router = useRouter();
  const [q, setQ] = useState(data.query.q), [error, setError] = useState("");
  const [form, setForm] = useState(initialForm), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState<Definition | null>(null), [sellerQuery, setSellerQuery] = useState("");
  const [sellerBusy, setSellerBusy] = useState(false), [searchError, setSearchError] = useState("");
  const [sellers, setSellers] = useState<{ id: string; email: string; name: string | null }[]>([]);
  const [selected, setSelected] = useState<{ id: string; email: string }[]>([]), [replace, setReplace] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; run: () => Promise<ActionResult> } | null>(null);
  const tier = data.tiers.find((item) => listingTierKey(item) === form.tierKey);
  const amount = Math.round(Number(form.value) * 100);
  const previewValid = !!tier && Number.isFinite(amount) && amount >= 0 && (form.type === "percentage" ? amount <= 10000 : amount <= tier.feeCents);
  const finalFee = previewValid ? discountedFee(tier!.feeCents, form.type, amount) : null;
  const go = (updates: Record<string, string>) => {
    const params = new URLSearchParams({ page: String(data.query.page), q: data.query.q, status: data.query.status, ...(data.query.packageId ? { packageId: data.query.packageId } : {}), ...updates });
    router.push(`/admin/discount-packages?${params}`);
  };
  const edit = (row?: Definition) => {
    setError(""); setForm(row ? { id: row.id, name: row.name, tierKey: row.tierKey, type: row.type, value: String(row.value / 100), listingLimit: String(row.listingLimit), durationDays: String(row.durationDays) } : { ...initialForm, tierKey: data.tiers[0] ? listingTierKey(data.tiers[0]) : "" }); setOpen(true);
  };
  const confirm = (title: string, description: string, run: () => Promise<ActionResult>) => { setError(""); setConfirmation({ title, description, run }); };
  return <div className="space-y-6">
    <PageHeader title="Discount packages" description="Seller-specific listing fees. Regular marketplace prices stay unchanged." action={<Button onClick={() => edit()}>Create discount package</Button>} />
    <p className="rounded-md border border-celis-border bg-celis-surface-base p-4 text-sm text-celis-ink-secondary">Discounts apply to listing fees only. Allowance packages take priority. Editing or deactivating a definition does not change existing assignments.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); go({ q, page: "1" }); }}><Input className="min-w-0 flex-1" placeholder="Search package or seller name/email" aria-label="Search packages and sellers" value={q} onChange={(e) => setQ(e.target.value)} /><Button variant="outline">Search</Button><Select value={data.query.status} onValueChange={(status) => go({ status, page: "1" })}><SelectTrigger className="w-40" aria-label="Assignment status"><SelectValue /></SelectTrigger><SelectContent>{["active", "expired", "cancelled", "all"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>{data.query.packageId && <Button type="button" variant="outline" onClick={() => go({ packageId: "", page: "1" })}>All packages</Button>}</form>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Package definitions</h2><AdminTable rows={data.definitions} keyExtractor={(row) => row.id} columns={[
      { key: "name", header: "Package", cell: (row) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-celis-ink-secondary">{row.tierLabel} · version {row.version}</p></div> },
      { key: "discount", header: "Discount", cell: (row) => row.type === "percentage" ? `${row.value / 100}%` : formatPrice(row.value) },
      { key: "terms", header: "Allowance / validity", cell: (row) => `${row.listingLimit} listings · ${row.durationDays} days` },
      { key: "status", header: "Status", cell: (row) => <Badge variant="outline">{row.isActive ? "Active" : "Inactive"}</Badge> },
      { key: "actions", header: "Actions", cell: (row) => <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => edit(row)}>Edit</Button><Button size="sm" variant="outline" disabled={!row.isActive} onClick={() => { setAssigning(row); setSelected([]); setSellers([]); setSellerQuery(""); setSearchError(""); setReplace(false); }}>Assign sellers</Button><Button size="sm" variant="ghost" onClick={() => go({ packageId: row.id, page: "1", q: "" })}>Assignments</Button><Button size="sm" variant="ghost" onClick={() => confirm(row.isActive ? "Deactivate package?" : "Activate package?", `${row.name}: only future assignments are affected. Existing assignments keep their terms.`, () => activateDiscount({ data: { id: row.id, active: !row.isActive, confirmed: true } }))}>{row.isActive ? "Deactivate" : "Activate"}</Button></div> },
    ]} /></section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Seller assignments</h2><AdminTable rows={data.assignments} keyExtractor={(row) => row.assignment.id} columns={[
      { key: "seller", header: "Seller / package", cell: (row) => <div><p>{row.sellerName ?? row.email}</p><p className="text-xs text-celis-ink-secondary">{row.email} · {row.assignment.terms.name}</p></div> },
      { key: "pricing", header: "Tier / fee", cell: (row) => { const currentTier = data.tiers.find((item) => listingTierKey(item) === row.assignment.tierKey); return <div><p>{row.assignment.terms.tierLabel}</p><p className="text-xs text-celis-ink-secondary">{row.assignment.terms.type === "percentage" ? `${row.assignment.terms.value / 100}%` : formatPrice(row.assignment.terms.value)} off</p>{currentTier ? <p className="text-xs">{formatPrice(currentTier.feeCents)} → {formatPrice(discountedFee(currentTier.feeCents, row.assignment.terms.type, row.assignment.terms.value))}</p> : <p className="text-xs text-destructive">Tier changed; no new discount</p>}</div>; } },
      { key: "usage", header: "Used / limit", cell: (row) => `${row.used} / ${row.assignment.terms.listingLimit}` },
      { key: "period", header: "Period", cell: (row) => <span className="text-xs">{formatDate(row.assignment.startedAt)} – {formatDate(row.assignment.expiresAt)}</span> },
      { key: "status", header: "Status", cell: (row) => <Badge variant="outline">{row.effectiveStatus}</Badge> },
      { key: "actions", header: "Actions / history", cell: (row) => row.effectiveStatus === "active" ? <CancelAssignmentDialog seller={row.sellerName ?? row.email} packageName={row.assignment.terms.name} onCancel={(input) => cancelDiscount({ data: { ...input, assignmentId: row.assignment.id } })} /> : <div className="text-xs"><p>{row.assignment.cancellationReason?.replaceAll("_", " ")}</p>{row.assignment.cancelledAt && <p>{formatDate(row.assignment.cancelledAt)} · {row.assignment.cancelledBy}</p>}<p>{row.assignment.cancellationNotes}</p></div> },
    ]} /><p className="text-xs text-celis-ink-tertiary">Usage includes successful purchases and credits reserved for payments in progress or reconciliation.</p></section>
    <Pagination page={data.query.page} totalPages={Math.max(1, Math.ceil(Math.max(data.total, data.packageTotal) / 20))} onPageChange={(page) => go({ page: String(page) })} />
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{form.id ? "Edit" : "Create"} discount package</DialogTitle><DialogDescription>Changes apply to future assignments. The calculator uses current listing fees.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); confirm("Save discount package?", `${form.name}: ${form.value}${form.type === "percentage" ? "%" : " USD"} off, ${form.listingLimit} listings for ${form.durationDays} days.`, () => saveDiscount({ data: { ...form, value: amount, listingLimit: Number(form.listingLimit), durationDays: Number(form.durationDays) } })); }}>
        <div className="space-y-2"><Label htmlFor="discount-name">Package name</Label><Input id="discount-name" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="discount-tier">Listing tier</Label><Select value={form.tierKey} onValueChange={(tierKey) => setForm({ ...form, tierKey })}><SelectTrigger id="discount-tier"><SelectValue /></SelectTrigger><SelectContent>{data.tiers.map((item) => <SelectItem key={listingTierKey(item)} value={listingTierKey(item)}>{item.label} · {formatPrice(item.feeCents)}</SelectItem>)}</SelectContent></Select></div>
        <fieldset className="flex gap-4"><legend className="mb-2 text-sm font-medium">Discount type</legend>{(["percentage", "fixed"] as const).map((type) => <label key={type} className="flex items-center gap-2 text-sm"><input type="radio" checked={form.type === type} onChange={() => setForm({ ...form, type })} />{type === "percentage" ? "Percentage (%)" : "Fixed amount ($)"}</label>)}</fieldset>
        <div className="grid grid-cols-2 gap-4">{([['value', form.type === "percentage" ? "Discount (%)" : "Discount ($)"], ['listingLimit', 'Eligible listings'], ['durationDays', 'Duration (days)']] as const).map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`discount-${key}`}>{label}</Label><Input id={`discount-${key}`} type="number" required min={key === "value" ? 0 : 1} step={key === "value" ? "0.01" : "1"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>)}</div>
        <div className="rounded-md bg-celis-surface-inset p-4"><p className="text-xs text-celis-ink-secondary">Seller's discounted listing fee</p><p className="mt-1 text-2xl font-semibold text-celis-success">{finalFee === null ? "Check the discount value" : formatPrice(finalFee)}</p>{tier && finalFee !== null && <p className="mt-1 text-xs text-celis-ink-secondary">Regular {formatPrice(tier.feeCents)} · saves {formatPrice(tier.feeCents - finalFee)} per listing</p>}</div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!previewValid || busy}>Review package</Button></DialogFooter>
      </form></DialogContent></Dialog>
    <Dialog open={!!assigning} onOpenChange={(value) => { if (!busy && !value) setAssigning(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Assign {assigning?.name}</DialogTitle><DialogDescription>Choose up to 50 external sellers. Shops keep their existing allowance-package requirement.</DialogDescription></DialogHeader>
      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); setSellerBusy(true); setSearchError(""); try { const result = await findDiscountSellers({ data: sellerQuery }); if (result.success) setSellers(result.data); else setSearchError(result.error); } catch { setSearchError("Search failed. Try again."); } finally { setSellerBusy(false); } }}><Input aria-label="Search sellers" required minLength={2} placeholder="Seller name, email or number" value={sellerQuery} onChange={(e) => setSellerQuery(e.target.value)} /><Button variant="outline" disabled={sellerBusy}>{sellerBusy ? "Searching…" : "Search"}</Button></form>
      {searchError && <p role="alert" className="text-sm text-destructive">{searchError}</p>}<div className="max-h-52 space-y-2 overflow-y-auto">{sellers.map((seller) => <label key={seller.id} className="flex items-center gap-2 rounded-md border border-celis-border p-2 text-sm"><input type="checkbox" checked={selected.some((item) => item.id === seller.id)} onChange={(e) => setSelected((items) => e.target.checked ? [...items, seller] : items.filter((item) => item.id !== seller.id))} />{seller.name ?? seller.email}<span className="text-xs text-celis-ink-secondary">{seller.email}</span></label>)}</div><p className="text-sm">{selected.length} selected: {selected.map((item) => item.email).join(", ")}</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Replace an existing assignment for the same tier</label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" onClick={() => setAssigning(null)}>Cancel</Button><Button disabled={selected.length === 0 || selected.length > 50 || busy} onClick={() => confirm("Assign discount package?", `Activate ${assigning?.name} for ${selected.length} sellers now${replace ? ", cancelling existing assignments for this tier" : ""}? Existing payments keep their original quotes.`, () => assignDiscount({ data: { packageId: assigning!.id, sellerIds: selected.map((item) => item.id), replace, confirmed: true } }))}>Review assignments</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmDialog open={!!confirmation} onOpenChange={(value) => { if (!busy && !value) setConfirmation(null); }} title={confirmation?.title ?? "Confirm"} description={confirmation?.description ?? ""} loading={busy} onConfirm={async () => { if (!confirmation || busy) return; setBusy(true); try { const result = await confirmation.run(); setConfirmation(null); if (!result.success) setError(result.error ?? "Operation failed."); else { setOpen(false); setAssigning(null); router.refresh(); } } catch { setConfirmation(null); setError("Could not reach the server."); } finally { setBusy(false); } }} />
  </div>;
}
