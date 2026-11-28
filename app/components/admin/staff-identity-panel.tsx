"use client";

import { UserRound } from "lucide-react";
import { staffIdentityLabels, type StaffIdentity } from "~/lib/staff-identity";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "~/components/ui/dropdown-menu";

export function StaffIdentityPanel({ user, compact = false }: { user: StaffIdentity; compact?: boolean }) {
  const identity = staffIdentityLabels(user);
  const details = <div className="min-w-0 space-y-1 p-3 text-sm" aria-label="Signed-in staff identity">
    <p className="break-words font-semibold text-celis-ink">{identity.name}</p>
    <p className="break-words font-mono text-xs text-celis-ink-secondary">{identity.staffId}</p>
    <p className="break-words text-xs text-celis-ink-secondary">{identity.department}</p>
    <p className="text-xs font-medium text-celis-primary">{identity.accountType}</p>
  </div>;
  if (!compact) return details;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><button type="button" aria-label="View signed-in staff identity" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-celis-ink hover:bg-celis-surface-elevated focus-visible:outline focus-visible:outline-2"><UserRound className="h-5 w-5" /></button></DropdownMenuTrigger>
    <DropdownMenuContent side="bottom" align="start" className="w-60 max-w-[calc(100vw-2rem)]">{details}</DropdownMenuContent>
  </DropdownMenu>;
}
