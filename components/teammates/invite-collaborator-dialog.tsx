"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, UserRoundPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BENEFIT_CONTACT_CATEGORIES } from "@/lib/benefit-contacts";

/** A person returned by the "Add Existing Contact / Collaborator" search. */
interface CollaboratorSearchRow {
  profileId: string;
  name: string;
  email: string;
  headshot: string | null;
  companyName: string | null;
  state: string;
}

/** One entry in the plan picker used when the caller has no single plan in hand. */
export interface InvitePlanChoice {
  id: string;
  name?: string | null;
}

export interface InviteCollaboratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * A plan the caller already knows (Edit Client's Key Contacts tab). Shown as a
   * read-only chip rather than a field, because the invite is meant to be scoped to
   * exactly where the advisor clicked.
   */
  planId?: string;
  /** The fixed plan's display name. */
  planName?: string;
  /**
   * When given, the advisor chooses the plan here (Settings → Team Members, which has
   * no plan in context). Mutually exclusive with `planId` in practice: a caller either
   * knows the plan or offers a list.
   */
  planOptions?: InvitePlanChoice[];
  /**
   * The wizard path (T5): there is no plan row yet, so the caller persists the draft on
   * demand and returns its id. Resolving to null refuses the invite instead of writing
   * an assignment against nothing.
   */
  ensurePlanId?: () => Promise<string | null>;
  /** Filled in when the invite was opened from an existing contact. */
  prefill?: {
    name?: string | null;
    email?: string | null;
    categories?: string[];
  } | null;
  /** Which surface raised the invite — recorded on the audit row. */
  source?: "create_benefits" | "key_contacts" | "edit_client" | "settings";
  onInvited?: () => void;
}

/**
 * The single "Invite Collaborator to Complete Profile" dialog.
 *
 * Four entry points share this component so the wording, the validation and the
 * request body cannot drift apart: T4's benefit card, T5's Create Plan → Key Contacts
 * prompt, Edit Client's Key Contacts tab, and Settings → Team Members. All four POST to
 * the same endpoint and therefore land on [`inviteCollaboratorToPlan`], which owns the
 * guards, the profile reuse, the assignment merge and the email.
 *
 * The only thing that varies is how the plan is resolved, in this order:
 *   1. the plan the advisor picked here (`planOptions`),
 *   2. the plan the caller pinned (`planId`),
 *   3. the caller's `ensurePlanId()` — the wizard's draft-on-demand path.
 * If none yields a plan the invite is refused, because an assignment with no plan is
 * not a thing that can be created.
 */
export function InviteCollaboratorDialog({
  open,
  onOpenChange,
  planId,
  planName,
  planOptions,
  ensurePlanId,
  prefill,
  source,
  onInvited,
}: InviteCollaboratorDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [chosenPlanId, setChosenPlanId] = useState("");
  const [picked, setPicked] = useState<CollaboratorSearchRow | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CollaboratorSearchRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPlanPicker = Boolean(planOptions && planOptions.length > 0);

  /**
   * The canonical four benefit categories, plus anything the caller pre-filled that is
   * not among them (a "Third Party Contact" from Edit Client, say). Dropping the extras
   * would silently leave the checkbox list empty for a contact the advisor explicitly
   * asked to invite, so instead they appear as an extra ticked row.
   */
  const categoryOptions = useMemo(() => {
    const extras = [...new Set(prefill?.categories ?? [])].filter(
      (value) => !(BENEFIT_CONTACT_CATEGORIES as string[]).includes(value),
    );
    return [...BENEFIT_CONTACT_CATEGORIES, ...extras];
  }, [prefill]);

  // Fresh state per opening, seeded from whatever the caller handed us.
  useEffect(() => {
    if (!open) return;
    setEmail((prefill?.email ?? "").trim());
    setName((prefill?.name ?? "").trim());
    setNote("");
    setCategories([...new Set(prefill?.categories ?? [])]);
    // Default the picker to the only plan when there is no real choice to make.
    setChosenPlanId(
      planId ?? (planOptions?.length === 1 ? planOptions[0].id : ""),
    );
    setPicked(null);
    setQuery("");
    setResults([]);
  }, [open, prefill, planId, planOptions]);

  // ── "Add Existing Contact / Collaborator" search ──
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
        const body = (await response.json()) as {
          results?: CollaboratorSearchRow[];
        };
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

  const toggleCategory = (category: string) =>
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((entry) => entry !== category)
        : [...prev, category],
    );

  /** The label for whatever plan the invite will land on, for the toast and the chip. */
  const resolvedPlanName = useMemo(() => {
    if (hasPlanPicker) {
      const found = planOptions?.find((option) => option.id === chosenPlanId);
      return found?.name?.trim() || planName?.trim() || "the selected plan";
    }
    return planName?.trim() || "this plan";
  }, [hasPlanPicker, planOptions, chosenPlanId, planName]);

  // The picker must be answered before submitting; the wizard path resolves later, so
  // it cannot be part of this check.
  const canSubmit =
    email.trim().length > 3 &&
    categories.length > 0 &&
    !isSubmitting &&
    (!hasPlanPicker || chosenPlanId.length > 0);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const resolved =
        chosenPlanId ||
        planId ||
        (ensurePlanId ? await ensurePlanId() : null) ||
        "";
      if (!resolved) {
        toast.error(
          hasPlanPicker
            ? "Choose the plan this collaborator should work on."
            : "Could not save this plan yet — try again in a moment.",
        );
        return;
      }

      const response = await fetch("/api/teammates/invite-collaborator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: resolved,
          categories,
          email: email.trim(),
          name: name.trim() || picked?.name || null,
          note: note.trim() || null,
          profileId: picked?.profileId ?? null,
          ...(source ? { source } : {}),
        }),
      });

      const body = (await response.json()) as {
        error?: string;
        invite?: {
          reusedProfile: boolean;
          emailSent: boolean;
          emailError: string | null;
        };
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not send the invite");
        return;
      }

      toast.success(
        `${email.trim()} invited to complete ${categories.length} section${
          categories.length === 1 ? "" : "s"
        } of ${resolvedPlanName}${
          body.invite?.reusedProfile ? " (existing profile reused)" : ""
        }.`,
      );
      if (body.invite && !body.invite.emailSent) {
        toast.warning(
          `The invite was saved, but the email could not be sent${
            body.invite.emailError ? `: ${body.invite.emailError}` : "."
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
          <DialogTitle>Invite Collaborator to Complete Profile</DialogTitle>
          <DialogDescription>
            They fill in their own details and get access to the chosen sections of one
            plan. No seat is used, and they can never publish, invite, delete, or see
            organization settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasPlanPicker ? (
            <div className="space-y-2">
              <Label htmlFor="invite-plan">Which plan?</Label>
              <Select value={chosenPlanId} onValueChange={setChosenPlanId}>
                <SelectTrigger id="invite-plan">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {(planOptions ?? []).map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name?.trim() || option.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                One plan per invite. Send another to widen their access later.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-3">
              <Badge variant="secondary">This Plan</Badge>
              <span className="truncate text-xs text-muted-foreground">{planName}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jane@abbenefits.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-name">
              Name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="invite-name"
              value={picked ? picked.name : name}
              disabled={Boolean(picked)}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Smith"
            />
          </div>

          <div className="space-y-2">
            <Label>Which sections may they complete?</Label>
            <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
              {categoryOptions.map((category) => (
                <label key={category} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={categories.includes(category)}
                    onCheckedChange={() => toggleCategory(category)}
                  />
                  {category}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pick at least one. They see only the sections you tick.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="invite-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Please fill in the plan details and upload the SPD."
              rows={3}
            />
          </div>

          {/* ── Add Existing Contact / Collaborator ── */}
          <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor="invite-search">Add Existing Contact / Collaborator</Label>
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
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="invite-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by person or company"
                    className="pl-9"
                  />
                  {isSearching ? (
                    <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Already in your organization? Pick them and their saved profile is
                  reused instead of a duplicate being created.
                </p>
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
                          <UserRoundPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
              <UserRoundPlus className="mr-2 h-4 w-4" />
            )}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
