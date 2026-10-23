"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { createAdminCustomer } from "~/server/admin-customers.functions";

const initialForm = {
  email: "", password: "", displayName: "", phone: "",
  role: "buyer" as "buyer" | "seller",
  sellerType: "individual" as "individual" | "shop",
  businessName: "", businessRegistrationNumber: "", businessAddress: "", playReviewer: false,
};

export function CreateCustomerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; role: string; playReviewer: boolean } | null>(null);
  const changeOpen = (next: boolean) => {
    if (busy) return;
    setOpen(next);
    setForm(initialForm);
    setCreated(null);
    setError("");
  };
  const field = (key: "email" | "password" | "displayName" | "phone" | "businessName" | "businessRegistrationNumber" | "businessAddress", label: string, required = false) => (
    <div className="space-y-2">
      <Label htmlFor={`customer-${key}`}>{label}</Label>
      <Input id={`customer-${key}`} value={form[key]} required={required} disabled={busy}
        type={key === "password" ? "password" : key === "email" ? "email" : "text"}
        minLength={key === "password" ? 12 : undefined}
        maxLength={key === "password" ? 72 : key === "displayName" ? 60 : key === "businessName" ? 120 : key === "businessRegistrationNumber" ? 60 : key === "businessAddress" ? 500 : key === "phone" ? 15 : 255}
        autoComplete={key === "password" ? "new-password" : "off"}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );
  return <>
    <Button onClick={() => changeOpen(true)}>Create customer</Button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{created ? "Customer created" : "Create buyer or seller"}</DialogTitle></DialogHeader>
        {created ? <div className="space-y-4">
          <p>{created.email} — {created.role}</p>
          <p>On mobile: Profile → Sign in or create account → Sign in with email. Use the password you entered.</p>
          {created.playReviewer && <p>This reviewer account can sign in without a phone or OTP. Add its email, password, and test instructions to Google Play Console → App access.</p>}
          <Button onClick={() => changeOpen(false)}>Done</Button>
        </div> : <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault(); setBusy(true); setError("");
          try {
            const result = await createAdminCustomer({ data: { ...form, phone: form.phone.trim() || undefined } });
            setCreated(result); setForm(initialForm); router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Account creation failed.");
          } finally { setBusy(false); }
        }}>
          {field("displayName", "Name", true)}
          {field("email", "Email", true)}
          {field("password", "Password (12–72 characters)", true)}
          {field("phone", "Contact phone (optional, e.g. +252611234567)")}
          <div className="space-y-2">
            <Label htmlFor="customer-role">Account type</Label>
            <Select value={form.role} disabled={busy} onValueChange={(value) => setForm({ ...form, role: value as "buyer" | "seller" })}>
              <SelectTrigger id="customer-role"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="buyer">Buyer</SelectItem><SelectItem value="seller">Seller</SelectItem></SelectContent>
            </Select>
          </div>
          {form.role === "seller" && <>
            <div className="space-y-2">
              <Label htmlFor="customer-seller-type">Seller type</Label>
              <Select value={form.sellerType} disabled={busy} onValueChange={(value) => setForm({ ...form, sellerType: value as "individual" | "shop" })}>
                <SelectTrigger id="customer-seller-type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="shop">Shop</SelectItem></SelectContent>
              </Select>
            </div>
            {form.sellerType === "shop" && <>{field("businessName", "Shop name", true)}{field("businessRegistrationNumber", "Business registration number")}{field("businessAddress", "Business address")}</>}
          </>}
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="customer-reviewer">Google Play reviewer account</Label>
            <Switch id="customer-reviewer" checked={form.playReviewer} disabled={busy} onCheckedChange={(playReviewer) => setForm({ ...form, playReviewer })} />
          </div>
          <p className="text-sm text-muted-foreground">Reviewer accounts skip phone onboarding and use email/password. They have ordinary buyer or seller permissions. Save the password securely before creating the account.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Creating…" : `Create ${form.role}`}</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}
