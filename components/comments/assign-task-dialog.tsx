"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { CheckCircle2, ClipboardList, ListTodo, Loader2 } from "lucide-react";
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
  CommentTargetType,
  ThreadAssignable,
} from "@/lib/comments/types";

/**
 * Hand work to somebody from the comments panel.
 *
 * The dialog is drawn from what the SERVER says this surface may offer — `/assignable` returns the
 * people, the plan's delegable automated tasks, and the assigner's OWN dashboard tasks on that plan,
 * and refuses outright for anyone who is not an Owner or Admin. So the picker cannot present a choice
 * the write would turn down, and the rule lives in one place rather than being re-implemented as a
 * filter here.
 *
 * Three ways to name the work, one result: an automated task, one of your OWN tasks (which is
 * MIRRORED onto the assignee — your copy stays exactly where it is), or a title typed fresh. All three
 * become the same kind of stored task on the assignee's dashboard; the automated one simply remembers
 * which row it stands in for.
 *
 * Assigning from here does not need an open thread: when there is none, the assignment creates the
 * thread it will live in, which is why the surface (and not a thread id) is what this needs.
 */

const STANDING_LABELS: Record<AssignableStanding, string> = {
  owner: "Owner",
  team_member: "Team Member",
  collaborator: "Collaborator",
};

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

/** Which of the three sources the assigner has picked. */
type TaskChoice = "derived" | "own" | "new";

export function AssignTaskDialog({
  open,
  onOpenChange,
  clientId,
  targetType,
  category,
  onAssign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plan, and — for a benefit surface — the category the panel is scoped to. */
  clientId: string;
  targetType: CommentTargetType;
  category: string | null;
  /** Resolves to an error message, or null when the assignment landed. */
  onAssign: (input: {
    assigneeUserId: string;
    assigneeName: string;
    title: string;
    derivedTaskId?: string;
    sourceTaskId?: string;
  }) => Promise<string | null>;
}) {
  const [assigneeId, setAssigneeId] = useState("");
  const [choice, setChoice] = useState<TaskChoice>("derived");
  const [derivedTaskId, setDerivedTaskId] = useState("");
  const [sourceTaskId, setSourceTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetched only while the dialog is open, and re-fetched each time it opens: the candidate list is
  // permission-shaped, the plan's automated tasks change as the plan is worked on, and your own tasks
  // change as you tick them off.
  const query = new URLSearchParams({ targetType });
  if (targetType === "benefit" && category) query.set("category", category);
  // The automated list is the ORGANISATION's outstanding work, narrowed by who it is for — so the
  // request is re-made the moment a person is picked, and the offer can never include a plan they
  // cannot open. Before anyone is picked it is the whole of what the reader can reach.
  if (assigneeId) query.set("assigneeUserId", assigneeId);
  const key = open && clientId
    ? `/api/clients/${encodeURIComponent(clientId)}/comments/assignable?${query.toString()}`
    : null;
  const { data, isLoading } = useSWR<{ success: boolean; data?: ThreadAssignable }>(
    key,
    jsonFetcher,
  );

  // A reopened dialog starts clean: the previous choice may no longer be legal.
  useEffect(() => {
    if (open) return;
    setAssigneeId("");
    setChoice("derived");
    setDerivedTaskId("");
    setSourceTaskId("");
    setTitle("");
    setError(null);
  }, [open]);

  const candidates = data?.data?.users ?? [];
  const derivedTasks = data?.data?.derivedTasks ?? [];
  const myTasks = data?.data?.myTasks ?? [];
  // One group per issue, in the order the server returned them, so the dialog reads like the
  // dashboard's panel rather than as a flat wall of rows.
  const groupedDerived: { label: string; tasks: typeof derivedTasks }[] = [];
  for (const task of derivedTasks) {
    const group = groupedDerived.find((entry) => entry.label === task.groupLabel);
    if (group) group.tasks.push(task);
    else groupedDerived.push({ label: task.groupLabel, tasks: [task] });
  }
  const assignee = candidates.find((person) => person.userId === assigneeId);

  // The first source with anything in it, so the dialog opens on something selectable rather than on
  // an empty list the reader has to navigate away from.
  useEffect(() => {
    if (!data?.data) return;
    if (derivedTasks.length > 0) setChoice("derived");
    else if (myTasks.length > 0) setChoice("own");
    else setChoice("new");
    // Only when the payload arrives, not on every render — choosing is the reader's job after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const chosen =
    choice === "derived"
      ? derivedTaskId
      : choice === "own"
        ? sourceTaskId
        : title.trim();
  const canSubmit = Boolean(assignee) && Boolean(chosen) && !isSubmitting;

  async function submit() {
    if (!assignee || !canSubmit) return;
    const selected = choice === "derived" ? derivedTasks.find((t) => t.id === derivedTaskId) : null;
    const own = choice === "own" ? myTasks.find((t) => t.id === sourceTaskId) : null;
    setIsSubmitting(true);
    setError(null);
    try {
      const message = await onAssign({
        assigneeUserId: assignee.userId,
        assigneeName: assignee.name,
        title: selected?.title ?? own?.title ?? title.trim(),
        ...(selected ? { derivedTaskId: selected.id } : {}),
        ...(own ? { sourceTaskId: own.id } : {}),
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

  /** One selectable task row, shared by both task lists so they cannot look like two features. */
  function TaskOption({
    id,
    title: label,
    meta,
    done,
    selected,
    onSelect,
  }: {
    id: string;
    title: string;
    meta: string;
    done?: boolean;
    selected: boolean;
    onSelect: () => void;
  }) {
    return (
      <li key={id}>
        <button
          type="button"
          onClick={onSelect}
          role="radio"
          aria-checked={selected}
          className={cn(
            "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
            selected
              ? "border-accent-blue/50 bg-accent-blue/10"
              : "border-border hover:bg-muted/60",
          )}
        >
          {/* A radio, because choosing the work is a choice of ONE — and the dot says so before the
              label is read. */}
          <span
            className={cn(
              "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
              selected ? "border-accent-blue" : "border-muted-foreground/50",
            )}
            aria-hidden="true"
          >
            {selected ? (
              <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
            ) : null}
          </span>
          {done ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">
            <span className="block text-xs font-medium">{label}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {meta}
            </span>
          </span>
        </button>
      </li>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a task</DialogTitle>
          <DialogDescription>
            This lands on the assignee&rsquo;s dashboard and notifies them, with a link to the thread
            it creates or joins.
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
                <ul
                  className="max-h-40 overflow-y-auto rounded-md border border-border"
                  role="radiogroup"
                  aria-label="Assign to"
                >
                  {candidates.map((person) => {
                    const selected = assigneeId === person.userId;
                    return (
                      <li key={person.userId}>
                        <button
                          type="button"
                          onClick={() => setAssigneeId(person.userId)}
                          // A radio here too: picking the person is the same kind of choice as picking
                          // the work — one, and only one — so the two sections read alike.
                          role="radio"
                          aria-checked={selected}
                          className={cn(
                            "flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors",
                            selected ? "bg-accent-blue/10" : "hover:bg-muted/60",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                              selected
                                ? "border-accent-blue"
                                : "border-muted-foreground/50",
                            )}
                            aria-hidden="true"
                          >
                            {selected ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
                            ) : null}
                          </span>
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
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* What */}
            <div>
              <p className="mb-1.5 text-xs font-medium">What</p>

              {derivedTasks.length > 0 ? (
                <div className="mb-2">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    From the dashboard — Needs Attention
                  </p>
                  {/* Grouped by the ISSUE they come from, because that is how the dashboard's panel
                      reads, while each row is one thing that is actually missing — the unit of work
                      somebody can be handed. */}
                  {groupedDerived.map((group) => (
                    <div key={group.label} className="mb-1.5">
                      <p
                        className="mb-1 truncate text-[10px] font-medium text-[#FF6900]"
                        title={group.label}
                      >
                        {group.label}
                      </p>
                      <ul
                        className="space-y-1 pl-1"
                        role="radiogroup"
                        aria-label={group.label}
                      >
                        {group.tasks.map((task) => (
                          <TaskOption
                            key={task.id}
                            id={task.id}
                            title={task.title}
                            meta={task.planName}
                            selected={choice === "derived" && derivedTaskId === task.id}
                            onSelect={() => {
                              setChoice("derived");
                              setDerivedTaskId(task.id);
                            }}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}

              {myTasks.length > 0 ? (
                <div className="mb-2">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <ListTodo className="h-3 w-3" />
                    From the dashboard — your To-Do list
                  </p>
                  <ul className="space-y-1">
                    {myTasks.map((task) => (
                      <TaskOption
                        key={task.id}
                        id={task.id}
                        title={task.title}
                        meta={`${task.planName ?? "No plan"} · mirrored to them, yours stays on your list`}
                        done={task.done}
                        selected={choice === "own" && sourceTaskId === task.id}
                        onSelect={() => {
                          setChoice("own");
                          setSourceTaskId(task.id);
                        }}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}

              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (event.target.value) {
                    setChoice("new");
                    setDerivedTaskId("");
                    setSourceTaskId("");
                  }
                }}
                placeholder="…or type a new task"
                aria-label="Task title"
                maxLength={200}
                className="w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent-blue"
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
