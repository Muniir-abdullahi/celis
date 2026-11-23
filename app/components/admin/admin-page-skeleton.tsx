import { Skeleton } from "~/components/ui/skeleton";
import { RolesWorkspaceSkeleton } from "./roles-skeleton";

export function AdminFieldsSkeleton() {
  return <div role="status" aria-label="Loading fields" aria-busy="true" className="space-y-3 py-2">
    <span className="sr-only">Loading fields…</span>
    {[0, 1, 2].map((i) => <div key={i} aria-hidden="true" className="space-y-3 rounded-md border border-celis-border p-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>)}
  </div>;
}

export function AdminTableSkeleton({ columns = 5 }: { columns?: number }) {
  return <div aria-hidden="true" className="overflow-hidden rounded-md border border-celis-border bg-celis-surface-base">
    <div className="flex gap-6 border-b border-celis-border bg-celis-surface-inset p-4">{Array.from({ length: columns }, (_, i) => <Skeleton key={i} className="h-4 flex-1" />)}</div>
    {Array.from({ length: 6 }, (_, row) => <div key={row} className="flex items-center gap-6 border-b border-celis-border p-4 last:border-0">{Array.from({ length: columns }, (_, i) => <div key={i} className="min-w-0 flex-1 space-y-2"><Skeleton className={i === 0 ? "h-4 w-4/5" : "h-4 w-3/5"} />{i === 0 && <Skeleton className="h-3 w-3/5" />}</div>)}</div>)}
  </div>;
}

export function AdminPageSkeleton({ variant = "table", columns = 5 }: { variant?: "dashboard" | "table" | "roles" | "settings" | "detail"; columns?: number }) {
  return <div role="status" aria-label="Loading admin page" aria-busy="true" className="space-y-6">
    <span className="sr-only">Loading page. Please wait.</span>
    <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-3"><Skeleton className="h-7 w-52" /><Skeleton className="h-4 w-64 max-w-full sm:w-80" /></div><Skeleton className="h-10 w-28" /></div>
    {variant === "roles" ? <RolesWorkspaceSkeleton /> : variant === "dashboard" ? <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 9 }, (_, i) => <div key={i} className="space-y-3 rounded-md border border-celis-border bg-celis-surface-base p-5"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-32" /></div>)}</div>
      <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-80 lg:col-span-2" /><Skeleton className="h-80" /></div><AdminTableSkeleton />
    </> : variant === "settings" || variant === "detail" ? <>
      <div aria-hidden="true" className="flex gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-24" />)}</div>
      <div className="space-y-6 rounded-md border border-celis-border bg-celis-surface-base p-6"><Skeleton className="h-5 w-40" /><div className="grid gap-6 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>)}</div></div>
      {variant === "detail" && <AdminTableSkeleton columns={columns} />}
    </> : <>
      <div aria-hidden="true" className="flex flex-wrap gap-3 rounded-md border border-celis-border bg-celis-surface-base p-4"><Skeleton className="h-10 min-w-0 flex-1" /><Skeleton className="h-10 w-36" /><Skeleton className="h-10 w-24" /></div>
      <AdminTableSkeleton columns={columns} /><div aria-hidden="true" className="flex justify-end gap-2"><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-28" /></div>
    </>}
  </div>;
}
