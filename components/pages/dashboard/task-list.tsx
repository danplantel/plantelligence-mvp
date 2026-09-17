"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Shield,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DashboardTasksResponse,
  ManualTask,
  SystemTask,
} from "@/lib/dashboard-tasks";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * The list moves as the advisor works — a plan edit clears a system task — so it revalidates
 * on mount and focus rather than being held like the profile/stats payloads.
 */
const SWR_OPTS = {
  revalidateOnMount: true,
  revalidateOnFocus: true,
  dedupingInterval: 2_000,
} as const;

const TASKS_KEY = "/api/dashboard/tasks";

/** Icon per system task kind. Presentation only, so it lives with the component. */
const KINDS: Record<SystemTask["kind"], { icon: LucideIcon; className: string }> = {
  "incomplete-benefit": { icon: AlertTriangle, className: "text-[#FF6900]" },
  "uncategorized-documents": { icon: FileText, className: "text-[#4A5565]" },
  "missing-disclaimers": { icon: Shield, className: "text-accent-blue" },
  "ready-to-publish": { icon: Rocket, className: "text-[#155DFC]" },
};

/**
 * One list, two sources. System tasks are derived from plan state and cannot be ticked off —
 * they clear when the plan is fixed, and each links to the exact page that fixes it. Manual
 * tasks are the advisor's own, ticked off with a checkbox.
 */
export function TaskList() {
  const { data, isLoading, error, mutate } = useSWR<DashboardTasksResponse>(
    TASKS_KEY,
    jsonFetcher,
    SWR_OPTS,
  );

  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const system = data?.data.system ?? [];
  const manual = data?.data.manual ?? [];
  const isEmpty = system.length === 0 && manual.length === 0;

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title || isAdding) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const response = await fetch(TASKS_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        // Surfaced rather than swallowed: a rejected write previously looked like a dead
        // button. The draft is left in place so the title is not lost.
        const payload = await response.json().catch(() => null);
        setAddError(
          payload?.error ?? `Could not add the task (${response.status})`,
        );
        return;
      }

      setDraft("");
      await mutate();
    } catch {
      setAddError("Could not reach the server. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  async function toggleTask(task: ManualTask) {
    // Optimistic so the checkbox responds immediately, then reconciled with the server — a
    // failed write is corrected by the refetch rather than being silently kept.
    if (data) {
      await mutate(
        {
          ...data,
          data: {
            ...data.data,
            manual: data.data.manual.map((item) =>
              item.id === task.id ? { ...item, done: !task.done } : item,
            ),
          },
        },
        { revalidate: false },
      );
    }

    try {
      await fetch(`${TASKS_KEY}/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
    } finally {
      await mutate();
    }
  }

  async function renameTask(task: ManualTask, title: string) {
    // Optimistic so the new title lands immediately, then reconciled — a rejected write is
    // corrected by the refetch rather than being silently kept.
    if (data) {
      await mutate(
        {
          ...data,
          data: {
            ...data.data,
            manual: data.data.manual.map((item) =>
              item.id === task.id ? { ...item, title } : item,
            ),
          },
        },
        { revalidate: false },
      );
    }

    try {
      await fetch(`${TASKS_KEY}/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } finally {
      await mutate();
    }
  }

  async function deleteTask(task: ManualTask) {
    if (data) {
      await mutate(
        {
          ...data,
          data: {
            ...data.data,
            manual: data.data.manual.filter((item) => item.id !== task.id),
          },
        },
        { revalidate: false },
      );
    }

    try {
      await fetch(`${TASKS_KEY}/${task.id}`, { method: "DELETE" });
    } finally {
      await mutate();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {isLoading ? (
        <TaskSkeleton />
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          Couldn’t load your tasks. Try again in a moment.
        </p>
      ) : isEmpty ? (
        <div className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground dark:border-gray-700">
          Nothing to do. Tasks appear here when a plan needs attention, or add
          your own below.
        </div>
      ) : (
        <ul>
          {system.map((task) => (
            <SystemTaskRow key={task.id} task={task} />
          ))}
          {manual.map((task) => (
            <ManualTaskRow
              key={task.id}
              task={task}
              onToggle={() => toggleTask(task)}
              onRename={(title) => renameTask(task, title)}
              onDelete={() => deleteTask(task)}
            />
          ))}
        </ul>
      )}

      {/* `mt-auto` keeps the entry row at the foot of the card whatever the list length.
          Exactly one add affordance: the labelled button. The field's placeholder names what
          to type rather than repeating the button's label. */}
      <form
        onSubmit={addTask}
        className="mt-auto border-t border-[#efefef] pt-3 dark:border-gray-700"
      >
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="New task…"
            aria-label="New task title"
            maxLength={200}
            className="min-w-0 flex-1 rounded-md border border-[#efefef] bg-transparent px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent-blue dark:border-gray-600"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isAdding}
            aria-busy={isAdding}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#efefef] px-2.5 py-1.5 text-xs font-medium text-accent-blue transition-colors hover:bg-accent-blue-light disabled:cursor-not-allowed dark:border-gray-600",
              // Dimmed only for the empty-input state. While a request is in flight the
              // button stays at full opacity so the spinner reads as working, not disabled.
              !draft.trim() && !isAdding && "opacity-40",
            )}
          >
            {/* The label stays put and only the icon swaps, so the button keeps its width
                while submitting instead of resizing around changing text. */}
            {isAdding ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-3.5" />
            )}
            Add Task
          </button>
        </div>

        {addError && (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {addError}
          </p>
        )}
      </form>
    </div>
  );
}

function SystemTaskRow({ task }: { task: SystemTask }) {
  const meta = KINDS[task.kind];
  const Icon = meta.icon;

  return (
    <li className="border-b border-[#efefef] last:border-b-0 dark:border-gray-700">
      <Link
        href={task.href}
        className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/50"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted",
            meta.className,
          )}
        >
          <Icon className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium dark:text-gray-100">
            {task.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {task.planName}
          </span>
        </span>

        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

function ManualTaskRow({
  task,
  onToggle,
  onRename,
  onDelete,
}: {
  task: ManualTask;
  onToggle: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const [isSaving, setIsSaving] = useState(false);

  function startEditing() {
    // Seeded from the task each time, so cancelling and reopening does not keep a stale draft.
    setValue(task.title);
    setIsEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = value.trim();

    // Blank or unchanged: nothing to write, just close.
    if (!title || title === task.title) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onRename(title);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <li className="border-b border-[#efefef] py-2.5 last:border-b-0 dark:border-gray-700">
        <form onSubmit={save} className="flex items-center gap-2">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            maxLength={200}
            aria-label={`Edit "${task.title}"`}
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsEditing(false);
            }}
            className="min-w-0 flex-1 rounded-md border border-[#efefef] bg-transparent px-2 py-1 text-sm outline-none transition-colors focus:border-accent-blue dark:border-gray-600"
          />
          <button
            type="submit"
            disabled={isSaving || !value.trim()}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent-blue transition-colors hover:bg-accent-blue-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 border-b border-[#efefef] py-2.5 last:border-b-0 dark:border-gray-700">
      <input
        type="checkbox"
        checked={task.done}
        onChange={onToggle}
        aria-label={
          task.done
            ? `Mark "${task.title}" as not done`
            : `Mark "${task.title}" as done`
        }
        className="size-4 shrink-0 cursor-pointer accent-[#23919c]"
      />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm",
            task.done
              ? "text-muted-foreground line-through"
              : "font-medium dark:text-gray-100",
          )}
        >
          {task.title}
        </span>
        {task.clientId && task.planName && (
          <Link
            href={`/edit-client/${task.clientId}`}
            className="block truncate text-xs text-muted-foreground hover:text-accent-blue hover:underline"
          >
            {task.planName}
          </Link>
        )}
      </span>

      {/* Revealed on row hover, or on focus so keyboard users can reach them. */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Edit "${task.title}"`}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete "${task.title}"`}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function TaskSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="flex items-center gap-3">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-4 w-48 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </li>
      ))}
    </ul>
  );
}
