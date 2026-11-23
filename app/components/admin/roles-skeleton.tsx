import { Skeleton } from "~/components/ui/skeleton";

export function PermissionGroupsSkeleton() {
  return <div className="grid gap-4 xl:grid-cols-2" aria-hidden="true">{Array.from({ length: 6 }, (_, i) =>
    <div key={i} className="rounded-md border border-celis-border p-4">
      <Skeleton className="mb-5 h-4 w-28" />
      {[0, 1].map((row) => <div key={row} className="mt-4 flex items-center justify-between gap-4"><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-4/5" /></div><Skeleton className="h-5 w-9 rounded-full" /></div>)}
    </div>)}</div>;
}

export function RolesWorkspaceSkeleton() {
  return <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]" aria-hidden="true">
    <div className="space-y-3 rounded-md border border-celis-border bg-celis-surface-base p-4"><Skeleton className="h-5 w-24" /><Skeleton className="h-10 w-full" />{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
    <div className="space-y-5 rounded-md border border-celis-border bg-celis-surface-base p-5"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-3/5" /><Skeleton className="h-10 w-full" /><PermissionGroupsSkeleton /></div>
  </div>;
}
