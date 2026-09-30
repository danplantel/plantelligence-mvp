import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The route-level skeleton for Browse Benefits.
 *
 * This page is a Server Component — it resolves the "Your organization offers" strip from the
 * session before the client takes over — so arriving here now has a short server phase. Without
 * this file the segment would fall back to the dashboard group's generic skeleton
 * (`app/(dashboard)/loading.tsx`), whose shape is a card grid and has nothing to do with this
 * page. Mirroring the page's own three blocks instead — picker, organization strip, plan card —
 * and using the same shapes `BenefitsListPage` renders for its client reads means both phases
 * read as one load rather than as a layout change.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Plan picker */}
      <Card className="mb-6 shadow-sm dark:bg-gray-800">
        <CardContent className="space-y-2 p-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>

      {/* Your organization offers */}
      <Card className="mb-6 shadow-sm dark:bg-gray-800">
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="ml-auto h-8 w-28" />
        </CardContent>
      </Card>

      {/* The selected plan's benefit pages */}
      <Card aria-busy="true" className="dark:bg-gray-800">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 py-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
