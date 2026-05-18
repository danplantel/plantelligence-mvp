export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-md bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-72 rounded-md bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* Content area skeleton */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        {/* Toolbar row */}
        <div className="flex items-center gap-4">
          <div className="h-9 w-64 rounded-md bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-36 rounded-md bg-gray-200 dark:bg-gray-800" />
          <div className="ml-auto h-9 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
        </div>

        {/* Card grid skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              <div className="aspect-video w-full bg-gray-200 dark:bg-gray-800" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
