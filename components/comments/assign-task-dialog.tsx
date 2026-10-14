"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { ClipboardList, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Headshot } from "@/components/ui/headshot";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  AssignableStanding,
  ThreadAssignable,
} from "@/lib/comments/types";

/**
 * Hand work to somebody from inside a comment thread.
 *
 * The dialog is drawn from what the SERVER says this thread may offer — `/assignable` returns the
 * people and the plan's delegable tasks, and refuses outright for anyone who is not an Owner or
 * Admin. So the picker cannot present a choice the write would turn down, and the rule lives in one
 * place rather than being re-implemented as a filter here.
 *
 * Two ways to name the work, one result: pick one of the plan's automated tasks, or type a title.
 * Both become the same kind of stored task on the assignee's dashboard — the derived one simply
 * remembers which row it stands in for.
 */

const STANDING_LABELS: Record<AssignableStanding, string> = {
  owner: "Owner",
  team_member: "Team Member",
  collaborator: "Collaborator",
};

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

export function AssignTaskDialog({
  open,
  onOpenChange,
  threadId,
  onAssign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  /** Resolves to an error message, or null when the assignment landed. */
  onAssign: (input: {
    assigneeUserId: string;
    assigneeName: string;
    title: string;
    derivedTaskId?: string;
  }) => Promise<string | null>;
}) {
  const [assigneeId, setAssigneeId] = useState("");
  const [derivedTaskId, setDerivedTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetched only while the dialog is open, and re-fetched each time it opens: the candidate list is
  // permission-shaped, and a plan's derived tasks change as the plan is worked on.
  const { data, isLoading } = useSWR<{ success: boolean; data?: ThreadAssignable }>(
    open ? `/api/comments/threads/${encodeURIComponent(threadId)}/assignable` : null,
    jsonFetcher,
  );

  // A reopened dialog starts clean: the previous choice may no longer be legal.
  useEffect(() => {
    if (open) return;
    setAssigneeId("");
    setDerivedTaskId("");
    setTitle("");
    setError(null);
  }, [open]);

  const candidates = data?.data?.users ?? [];
  const derivedTasks = data?.data?.derivedTasks ?? [];
  const assignee = candidates.find((person) => person.userId === assigneeId);
  const canSubmit =
    Boolean(assignee) && Boolean(derivedTaskId || title.trim()) && !isSubmitting;

  async function submit() {
    if (!assignee || !canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const message = await onAssign({
        assigneeUserId: assignee.userId,
        assigneeName: assignee.name,
        title: title.trim(),
        ...(derivedTaskId ? { derivedTaskId } : {}),
      });
      if (message) {
        setError(message);
        return;
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a task</DialogTitle>
          <DialogDescription>
            This lands on the assignee&rsquo;s dashboard and notifies them, with a link back to this
            thread.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading who can be assigned…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Who */}
            <div>
              <p className="mb-1.5 text-xs font-medium">Assign to</p>
              {candidates.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                  Nobody on this comment can be assigned work.
                </p>
              ) : (
                <ul className="max-h-44 overflow-y-auto rounded-md border border-border">
                  {candidates.map((person) => (
                    <li key={person.userId}>
                      <button
                        type="button"
                        onClick={() => setAssigneeId(person.userId)}
                        aria-pressed={assigneeId === person.userId}
                        className={cn(
                          "flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors",
                          assigneeId === person.userId
                            ? "bg-accent-blue/10"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
                          <Headshot
                            src={person.headshot}
                            alt={person.name}
                            monogramName={person.name}
                            wrapperClassName="rounded-full"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">
                            {person.name}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {STANDING_LABELS[person.kind]}
                          </span>
                        </span>
                        {assigneeId === person.userId ? (
                          <UserRound className="h-3.5 w-3.5 shrink-0 text-accent-blue" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* What */}
            <div>
              <p className="mb-1.5 text-xs font-medium">What</p>
              {derivedTasks.length > 0 ? (
                <ul className="mb-2 space-y-1">
                  {derivedTasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setDerivedTaskId(
                            derivedTaskId === task.id ? "" : task.id,
                          );
                          setTitle("");
                        }}
                        aria-pressed={derivedTaskId === task.id}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                          derivedTaskId === task.id
                            ? "border-accent-blue/50 bg-accent-blue/10"
                            : "border-border hover:bg-muted/60",
                        )}
                      >
                        <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium">{task.title}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {task.planName}
                            {task.category ? ` · ${task.category}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (event.target.value) setDerivedTaskId("");
                }}
                placeholder={
                  derivedTasks.length > 0
                    ? "…or type a task"
                    : "What needs doing?"
                }
                aria-label="Task title"
                maxLength={200}
                disabled={Boolean(derivedTaskId)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent-blue disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
