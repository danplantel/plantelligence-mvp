"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Headshot } from "@/components/ui/headshot";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDirectDirectory } from "@/hooks/useDirectDirectory";
import type { DirectDirectoryEntry } from "@/lib/messages/types";

/**
 * Who to start a conversation with.
 *
 * The list comes straight from `GET /api/messages/directory`, which is also the predicate the API
 * consults before opening a thread — so a row that is selectable here is a row the server will
 * accept. Nothing in this component re-derives "who may I message".
 *
 * A seat with no login is rendered GREYED as "Invite pending" rather than hidden: an advisor who
 * has just invited somebody should be able to see that the person exists and why they cannot be
 * messaged yet, instead of concluding the directory is broken.
 */
function PickerRow({
  entry,
  starting,
  onStart,
}: {
  entry: DirectDirectoryEntry;
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onStart}
        disabled={!entry.selectable || starting}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
          entry.selectable
            ? "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            : "cursor-not-allowed opacity-60",
        )}
      >
        <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
          <Headshot
            src={entry.headshot}
            alt={entry.name}
            monogramName={entry.name}
            wrapperClassName="rounded-full"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{entry.name}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {entry.email}
          </span>
        </span>
        {starting ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 text-[9px] font-semibold uppercase tracking-wide",
              entry.selectable
                ? "bg-accent-blue/10 text-accent-blue"
                : "bg-muted text-muted-foreground",
            )}
          >
            {entry.selectable ? entry.label : "Invite pending"}
          </span>
        )}
      </button>
    </li>
  );
}

export function DirectoryPicker({
  onPicked,
}: {
  /** Handed the conversation's id once it exists (created or already open). */
  onPicked: (threadId: string) => void;
}) {
  const { entries, isLoading, error, refresh } = useDirectDirectory(true);
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? entries.filter(
          (entry) =>
            entry.name.toLowerCase().includes(q) ||
            entry.email.toLowerCase().includes(q),
        )
      : entries;
    return {
      // The Owner and the internal seats first: they are the people an advisor messages by
      // default, and the Collaborators are the longer list.
      team: matches.filter((entry) => entry.kind !== "collaborator"),
      collaborators: matches.filter((entry) => entry.kind === "collaborator"),
    };
  }, [entries, query]);

  const start = async (entry: DirectDirectoryEntry) => {
    if (!entry.userId || starting) return;
    setStarting(entry.userId);
    try {
      const response = await fetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: entry.userId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        threadId?: string;
        error?: string;
      };
      if (!response.ok || !payload.threadId) {
        throw new Error(payload.error ?? "Could not start that conversation.");
      }
      onPicked(payload.threadId);
    } catch (startError) {
      toast.error(
        (startError as Error)?.message ?? "Could not start that conversation.",
      );
    } finally {
      setStarting(null);
    }
  };

  const sections: { title: string; rows: DirectDirectoryEntry[] }[] = [
    { title: "Team", rows: grouped.team },
    { title: "Collaborators", rows: grouped.collaborators },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-10" aria-busy="true">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading people…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-xs font-medium">Nobody to message yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              An advisor has to invite you to a plan before you can reach its team.
            </p>
          </div>
        ) : (
          sections.map((section) =>
            section.rows.length === 0 ? null : (
              <div key={section.title}>
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </p>
                <ul>
                  {section.rows.map((entry) => (
                    <PickerRow
                      key={entry.userId ?? `pending-${entry.email}`}
                      entry={entry}
                      starting={starting !== null && starting === entry.userId}
                      onStart={() => void start(entry)}
                    />
                  ))}
                </ul>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
