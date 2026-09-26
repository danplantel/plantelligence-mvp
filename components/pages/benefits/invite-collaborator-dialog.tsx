"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Search, UserPlus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Headshot } from "@/components/ui/headshot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  WHO_IS_THIS_OPTIONS,
  isWhoIsThisContext,
  type WhoIsThisContext,
} from "@/types/teammate";

/** A collaborator returned by the "Add Existing Collaborator" search. */
interface CollaboratorSearchRow {
  profileId: string;
  name: string;
  email: string;
  headshot: string | null;
  companyName: string | null;
  state: string;
}

export interface InviteCollaboratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plan and category the invite is pinned to — both come from the card. */
  planId: string;
  planName: string;
  category: string;
  /**
   * Which flow raised the invite. This step is rendered by both Create Benefit and
   * Edit Benefit, so the audit row would otherwise be unable to tell them apart.
   */
  source?: "create_benefits" | "edit_benefit";
  /** Called after a successful invite so the page can refresh its assignment chips. */
  onInvited?: () => void;
}

/**
 * T4 — "Invite Collaborator" from a Create Benefits category card.
 *
 * The plan and the category are NOT fields: they are shown as locked chips because
 * the invite is scoped to exactly where the advisor clicked (Part A item 2, and the
 * acceptance criterion "an invite from Ayres → Group Health creates an assignment
 * for exactly that plan and category"). Everything the dialog does ask for is what
 * the spec lists: the address, who the person is, an optional note and due date,
 * and optionally picking someone the organization already knows.
 *
 * "Customize access" is rendered disabled on purpose: it expands the plan-first grid
 * from T2a, which is a separate unbuilt ticket. Offering a real doorway into a grid
 * that does not exist yet would be worse than saying so.
 */
export function InviteCollaboratorDialog({
  open,
  onOpenChange,
  planId,
  planName,
  category,
  source,
  onInvited,
}: InviteCollaboratorDialogProps) {
  const [email, setEmail] = useState("");
  const [whoIsThis, setWhoIsThis] = useState<WhoIsThisContext>("outside_advisor");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [picked, setPicked] = useState<CollaboratorSearchRow | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CollaboratorSearchRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Once the advisor answers "Who is this?" themselves, the domain guess stops
  // overwriting them (Part B item 2 is a pre-selection, never a correction).
  const answerTouchedRef = useRef(false);

  // Fresh state every time the dialog is opened for a different card.
  useEffect(() => {
    if (!open) return;
    setEmail("");
    setWhoIsThis("outside_advisor");
    setName("");
    setNote("");
    setDueDate("");
    setPicked(null);
    setSuggestion(null);
    setQuery("");
    setResults([]);
    answerTouchedRef.current = false;
  }, [open, planId, category]);

  // ── Domain guess: a sponsor domain pre-selects "Plan Sponsor HR" ──
  useEffect(() => {
    if (!open) return;
    const address = email.trim();
    if (!address.includes("@")) {
      setSuggestion(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/teammates/invite-collaborator?clientId=${encodeURIComponent(
            planId,
          )}&email=${encodeURIComponent(address)}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const body = (await response.json()) as {
          suggestion?: { context: string; reason: string } | null;
        };
        const found = body.suggestion;
        if (!found || !isWhoIsThisContext(found.context)) {
          setSuggestion(null);
          return;
        }
        setSuggestion(found.reason);
        if (!answerTouchedRef.current) setWhoIsThis(found.context);
      } catch {
        // A suggestion is optional; a failed lookup must not interrupt typing.
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [email, open, planId]);

  // ── "Add Existing Collaborator" search ──
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/teammates/collaborators/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setResults([]);
          return;
        }
        const body = (await response.json()) as { results?: CollaboratorSearchRow[] };
        setResults(body.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  const categoryLabel = useMemo(
    () => category.replace(/\s*\/\s*/g, " / "),
    [category],
  );

  const canSubmit = email.trim().length > 3 && !isSubmitting;

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/teammates/invite-collaborator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: planId,
          category,
          email: email.trim(),
          whoIsThis,
          name: name.trim() || picked?.name || null,
          note: note.trim() || null,
          dueDate: dueDate || null,
          profileId: picked?.profileId ?? null,
          // Omitted when the caller does not say — the endpoint then defaults to the
          // Create Benefits label rather than refusing the invite.
          ...(source ? { source } : {}),
        }),
      });

      const body = (await response.json()) as {
        error?: string;
        invite?: {
          missingFields: string[];
          reusedProfile: boolean;
          role: string;
          emailSent: boolean;
          emailError: string | null;
        };
      };

      if (!response.ok) {
        toast.error(body.error ?? "Could not send the invite");
        return;
      }

      const invite = body.invite;
      toast.success(
        `${email.trim()} invited to ${categoryLabel} on ${planName}${
          invite?.reusedProfile ? " (existing profile reused)" : ""
        }.`,
      );
      // The assignment exists even if the mail failed, so this is a warning and
      // not an error — the advisor can resend rather than re-invite.
      if (invite && !invite.emailSent) {
        toast.warning(
          `The invite was saved, but the email could not be sent${
            invite.emailError ? `: ${invite.emailError}` : "."
          }`,
        );
      }

      onInvited?.();
      onOpenChange(false);
    } catch {
      toast.error("Could not send the invite");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite Collaborator</DialogTitle>
          <DialogDescription>
            They get access to this section only — no seat is used, and they can
            never publish, invite, delete, or see organization settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Locked scope, from where the invite was raised. */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-3">
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Scoped to</span>
            <Badge variant="secondary">{planName}</Badge>
            <span className="text-xs text-muted-foreground">·</span>
            <Badge variant="secondary">{categoryLabel}</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-collaborator-email">Email</Label>
            <Input
              id="invite-collaborator-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jane@abbenefits.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-collaborator-who">Who is this?</Label>
            <Select
              value={whoIsThis}
              onValueChange={(value) => {
                if (!isWhoIsThisContext(value)) return;
                answerTouchedRef.current = true;
                setWhoIsThis(value);
                setSuggestion(null);
              }}
            >
              <SelectTrigger id="invite-collaborator-who">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WHO_IS_THIS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suggestion ? (
              <p className="text-[11px] text-muted-foreground">{suggestion}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-collaborator-name">
              Name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="invite-collaborator-name"
              value={picked ? picked.name : name}
              disabled={Boolean(picked)}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Smith"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-collaborator-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="invite-collaborator-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Could you add the group numbers?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-collaborator-due">
                Due date <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="invite-collaborator-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          {/* ── Add Existing Collaborator ── */}
          <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor="invite-collaborator-search">
              Add Existing Collaborator
            </Label>
            {picked ? (
              <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-2">
                <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                  <Headshot
                    src={picked.headshot}
                    alt={picked.name}
                    monogramName={picked.name}
                    wrapperClassName="rounded-full"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {picked.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {picked.email}
                    {picked.companyName ? ` · ${picked.companyName}` : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPicked(null);
                    setEmail("");
                    setName("");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Clear selection</span>
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="invite-collaborator-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by person or company"
                    className="pl-9"
                  />
                  {isSearching ? (
                    <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                {results.length > 0 ? (
                  <ul className="space-y-1">
                    {results.map((result) => (
                      <li key={result.profileId}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-muted"
                          onClick={() => {
                            setPicked(result);
                            setEmail(result.email);
                            setName(result.name);
                            setResults([]);
                            setQuery("");
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {result.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {result.email}
                              {result.companyName ? ` · ${result.companyName}` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>

          {/* T2a is a separate ticket: the affordance is visible so the path is
              discoverable, but disabled rather than pretending it works. */}
          <div className="space-y-1">
            <Button type="button" variant="link" className="h-auto p-0" disabled>
              Customize access
            </Button>
            <p className="text-[11px] text-muted-foreground">
              The plan-first permission grid arrives with custom roles (T2a). Until
              then the role comes from the answer above, scoped to this section.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
