"use client";

import { CheckCircle2, ClipboardList, Undo2 } from "lucide-react";
import { Headshot } from "@/components/ui/headshot";
import { cn } from "@/lib/utils";
import { DERIVED_TASK_LABELS } from "@/lib/dashboard-tasks";
import type { CommentTaskView } from "@/lib/comments/types";

/**
 * An assignment, as the thread shows it.
 *
 * A CARD rather than a sentence, which is the whole reason a message carries a `kind`: the reader
 * has to be able to see who was asked for what, and whether it is still outstanding, without reading
 * prose and without the rail guessing at English. Everything it renders comes from the message's
 * `task` — never from parsing the message body, which is only the fallback for the one case where
 * there is no task left to report on.
 *
 * The state is LIVE, resolved with the thread: ticking the work off on the dashboard is visible here
 * the next time the thread is read, and nobody has to remember to update the conversation.
 */

export function CommentTaskCard({
  task,
  body,
  assignedByName,
  mayWithdraw,
  onWithdraw,
  onOpenAssignee,
  className,
}: {
  /** Null when the task is GONE — withdrawn, or deleted with its plan. */
  task: CommentTaskView | null;
  /** The message's plain-text fallback, shown when there is no task left to describe. */
  body: string;
  /** The assigner, from the message's own author row. */
  assignedByName: string;
  /** The assigner, or a moderator. Rendered only when it could actually succeed. */
  mayWithdraw: boolean;
  onWithdraw: () => void;
  /**
   * Opens the assignee's profile card, or null when there is nobody to open.
   *
   * Null — rather than a callback that does nothing — because the card has to know the difference:
   * a name that looks clickable and is not is worse than a plain one. The caller decides (that is
   * where the reader's own id and the `"pending"` placeholder are known), and this card only draws.
   */
  onOpenAssignee: (() => void) | null;
  className?: string;
}) {
  const withdrawn = task === null;
  const done = Boolean(task?.done);
  const derivedLabel = task?.derivedKind
    ? DERIVED_TASK_LABELS[task.derivedKind]
    : null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background p-2.5",
        // A withdrawn card is deliberately quieter than a live one: it is history, and it should
        // read that way at a glance rather than competing with the work still outstanding.
        withdrawn && "border-dashed bg-muted/20",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            done
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : withdrawn
                ? "bg-muted text-muted-foreground"
                : "bg-accent-blue/10 text-accent-blue",
          )}
        >
          {done ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          {/* The HEADING it came from, above the work itself: "Incomplete benefit: Group Life" is the
              problem, and "No support contact assigned" is what somebody has to do about it. Neither
              is much use on its own, which is why both travel. */}
          {task?.derivedGroupLabel ? (
            <p
              className="mb-0.5 truncate text-[10px] font-medium text-[#FF6900]"
              title={task.derivedGroupLabel}
            >
              {task.derivedGroupLabel}
            </p>
          ) : null}
          <p className="text-xs font-medium">
            {task ? task.title : body}
          </p>

          {task ? (
            <>
              {/* Who asked, and then — on its OWN line — who it is for. Two different people, and
                  running them together in one sentence made the assignee the hard part to find. */}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Assigned by {assignedByName}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="shrink-0">To</span>
                <span className="h-4 w-4 shrink-0 overflow-hidden rounded-full bg-muted">
                  <Headshot
                    src={task.assignedToHeadshot}
                    alt={task.assignedToName}
                    monogramName={task.assignedToName}
                    wrapperClassName="rounded-full"
                  />
                </span>
                {onOpenAssignee ? (
                  <button
                    type="button"
                    onClick={onOpenAssignee}
                    title={`View ${task.assignedToName}'s profile`}
                    className="truncate rounded-sm font-medium text-foreground/80 underline-offset-2 transition-colors hover:text-accent-blue hover:underline"
                  >
                    {task.assignedToName}
                  </button>
                ) : (
                  <span className="truncate font-medium text-foreground/80">
                    {task.assignedToName}
                  </span>
                )}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-medium",
                    done
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-accent-blue/10 text-accent-blue",
                  )}
                >
                  {done ? "Completed" : "To do"}
                </span>
                {/* The kind chip is a FALLBACK, not a second label: the heading above already says
                    which problem this belongs to, and printing both made the card say the same thing
                    twice in two colours. Kept only for a derived assignment made BEFORE the heading
                    was stored, where losing the kind entirely would be worse than a second line. */}
                {derivedLabel && !task.derivedGroupLabel ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5">
                    {derivedLabel}
                    {task.benefitCategory ? ` · ${task.benefitCategory}` : ""}
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-[11px] italic text-muted-foreground">
              This assignment was withdrawn — the task is no longer on anyone&rsquo;s dashboard.
            </p>
          )}
        </div>

        {/* Only ever offered where it would succeed: the assigner taking back their own request, or a
            moderator tidying up after a colleague. */}
        {task && mayWithdraw ? (
          <button
            type="button"
            onClick={onWithdraw}
            title="Withdraw this assignment"
            aria-label="Withdraw this assignment"
            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
