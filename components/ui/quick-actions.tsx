import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface Action {
  icon: LucideIcon;
  label: string;
  href: string;
  description: string;
}

interface QuickActionsProps {
  actions: Action[];
  title?: string;
}

/**
 * Quick action row. Mirrors `QuickInsights`: the heading sits outside the tiles and the
 * section itself is unbordered, so each `outline` button reads as an individual tile
 * rather than being boxed inside a second card.
 */
export function QuickActions({
  actions,
  title = "Quick Actions",
}: QuickActionsProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold dark:text-gray-100">{title}</h3>

      <div className="flex gap-2.5">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            /* The dark hover background is not redundant: the `outline` variant already sets
               `dark:bg-gray-800`, which has the same specificity as `hover:bg-*` and is
               emitted later, so it would win in dark mode without an explicit dark:hover.
               The shadow needs no dark counterpart — the variant's resting `shadow-sm` has
               no dark: variant, so hover:shadow-md wins on specificity alone. */
            className="flex h-[112px] w-full flex-col items-center gap-2 p-0 hover:border-accent-blue hover:bg-accent-blue-light hover:shadow-md dark:hover:border-accent-blue dark:hover:bg-accent-blue-light"
            asChild
          >
            <Link href={action.href}>
              <action.icon className="size-6 text-accent-blue" />
              <div className="text-center">
                <div className="text-sm font-medium">{action.label}</div>
                <div className="text-[0.7em] font-normal text-muted-foreground">
                  {action.description}
                </div>
              </div>
            </Link>
          </Button>
        ))}
      </div>
    </section>
  );
}
