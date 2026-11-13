import { cn } from "@/lib/utils";

/**
 * The number a document tab carries, e.g. `List (12)`.
 *
 * The document List tabs (Documents page surface, Create Client Step 4, Create/Edit
 * Benefit Step 4, Edit Client's documents tab) all show a count of the documents the
 * tab will list, so the advisor can tell at a glance whether anything was uploaded
 * without opening the tab.
 *
 * It is a pill that inherits the trigger's text colour, which keeps it legible both
 * idle and on the active (filled) tab, in light and dark themes.
 */
export function TabCount({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <span
      data-testid="tab-count"
      className={cn(
        "ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-black/10 px-1.5 text-[11px] font-semibold leading-4 tabular-nums dark:bg-white/20",
        className,
      )}
    >
      {count}
    </span>
  );
}
