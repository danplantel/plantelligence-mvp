import { cn } from "@/lib/utils";

/**
 * Shared recipes for the tab strips that dashboard pages portal into the fixed
 * header (`#header-tabs-portal`): Settings, Edit Plan (`/edit-client/[id]`) and
 * Edit Benefit (`/benefits/[id]`).
 *
 * These tabs do not sit in the page body — they live in the header's centre
 * column, which shares one row with the page title on the left and the action
 * cluster on the right. A full-size six-tab strip (Edit Benefit) is wider than
 * that column even at 1280px, so sizing the tabs off the header's own `xl`
 * breakpoint left the last tabs outside the scrollbar-less strip. The ramp
 * below is driven by the space the strip actually has:
 *
 * - 1024–1279px (base): 11px labels, tight padding — every strip fits.
 * - 1280–1535px (`xl`): 12px labels, a little looser.
 * - 1536px+ (`2xl`): 13px labels, looser again.
 *
 * The ramp is deliberately gentler than the header's own `xl` step-up: the
 * title/subtitle column now keeps its full, un-ellipsised width on one line,
 * so the strip has to share the row with that text and the action cluster. It
 * steps up as the viewport (and therefore the centre column) grows rather than
 * jumping to the old full-size tab at a fixed breakpoint.
 *
 * [`Header`](components/layout/header.tsx) repeats the same values as
 * descendant rules on the portal target, so any other page that portals a
 * TabsList (now or later) is scaled the same way even if it does not import
 * these constants.
 */
export const HEADER_TABS_LIST_CLASS = cn(
  "w-full gap-1 rounded-none border-0 bg-transparent p-0 dark:bg-transparent",
  "flex-nowrap h-auto min-h-fit overflow-x-auto",
  "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
);

export const HEADER_TAB_TRIGGER_CLASS = cn(
  "relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-none",
  // Compact 1024–1279px look: the centre column can be as narrow as ~350px
  // there, which is what the full title/subtitle and the action cluster leave.
  "px-1 py-1.5 text-[11px] font-medium",
  // 1280–1535px: one step up, still compact enough for a six-tab strip.
  "xl:gap-1.5 xl:px-1.5 xl:text-xs",
  // 1536px+: one more step, with room to breathe.
  "2xl:gap-1.5 2xl:px-2 2xl:py-2.5 2xl:text-[13px]",
  // Tab icons follow the label: 14px below `xl`, 16px at `xl` and up.
  "[&_svg]:size-3.5 [&_svg]:shrink-0 xl:[&_svg]:size-4",
  // The active underline every portalled strip uses.
  "data-[state=active]:border-b-2 data-[state=active]:border-accent-blue",
  "data-[state=active]:font-bold data-[state=active]:text-accent-blue",
);
