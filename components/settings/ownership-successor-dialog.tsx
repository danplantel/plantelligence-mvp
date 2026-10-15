"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { PRESET_ROLE_LABELS, type TeammateAssignmentRole } from "@/types/teammate";

/**
 * One person the organization can be handed to, as `GET /api/profile/delete-impact` reports them.
 *
 * Declared here rather than imported from `ownership.server.ts` on purpose, and it is the pattern
 * every other dialog in this module follows: a client component reaching into a `*.server.ts`
 * module for a type pulls the whole module — Prisma included — into the boundary's evaluation, and
 * the shape is small enough that restating it is cheaper than the coupling.
 */
export interface OwnershipSuccessorOption {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  headshot: string | null;
  role: TeammateAssignmentRole;
}

/**
 * "Who should take over?" — the middle step of deleting an Owner's account.
 *
 * ## Why this dialog exists at all
 *
 * The deletion flow used to go straight from a typed phrase to `DELETE /api/profile/delete`, which
 * for an Owner removes the Organization, every teammate's access, and every plan in it. The person
 * clicking it was never told any of that, and the dialog only ever spoke about "your profile".
 *
 * ## Why there is no "delete everything anyway"
 *
 * The escape hatch would be the exact accident this dialog prevents, and it would sit one click from
 * the button a user has already decided to press. An Owner who genuinely wants the organization gone
 * removes their teammates first — which is a deliberate act on a screen that explains itself.
 * Cancel is the only other way out, and the picker blocks until somebody is chosen.
 *
 * ## Why the consequence is stated, not implied
 *
 * Handing the organization over is immediate and complete: the caller loses access to it the moment
 * this succeeds, and their account is then deleted. Saying so in the dialog is the difference
 * between a handover and a surprise.
 */
export function OwnershipSuccessorDialog({
  open,
  onOpenChange,
  organizationName,
  successors,
  isSubmitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName: string;
  successors: OwnershipSuccessorOption[];
  isSubmitting: boolean;
  /** Receives the chosen person's `TeammateProfile` id — the server re-verifies it. */
  onConfirm: (profileId: string) => void;
}) {
  const [selectedProfileId, setSelectedProfileId] = useState("");

  // Cleared on every close, so a reopen cannot confirm a choice made in a previous visit — the
  // same rule the type-to-confirm phrase follows one dialog earlier.
  useEffect(() => {
    if (!open) setSelectedProfileId("");
  }, [open]);

  const selected =
    successors.find((person) => person.profileId === selectedProfileId) ?? null;

  return (
    <Dialog
      open={open}
      // Blocked while the request is in flight: the transfer cannot be cancelled once it lands, so
      // a dismiss that looked like it did would be a lie.
      onOpenChange={(next) => {
        if (isSubmitting) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(event) => {
          if (isSubmitting) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              Who should take over {organizationName}?
            </DialogTitle>
          </div>
          <DialogDescription className="text-left">
            You own this organization, so deleting your profile would delete it — the plans,
            the teammates and their access. Choose someone to take it over instead: they
            inherit the organization, its plans, its documents and its branding, and you lose
            access to it the moment you confirm.
          </DialogDescription>
        </DialogHeader>

        {successors.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nobody else can take over: only people who have accepted their invitation and signed in
            can own the organization.
          </p>
        ) : (
          <RadioGroup
            value={selectedProfileId}
            onValueChange={setSelectedProfileId}
            className="max-h-72 gap-1 overflow-y-auto"
            aria-label="Choose the new owner"
          >
            {successors.map((person) => (
              <label
                key={person.profileId}
                htmlFor={`ownership-successor-${person.profileId}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors",
                  selectedProfileId === person.profileId
                    ? "border-accent-blue bg-accent-blue/5"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <RadioGroupItem
                  value={person.profileId}
                  id={`ownership-successor-${person.profileId}`}
                  disabled={isSubmitting}
                />
                <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                  <Headshot
                    src={person.headshot}
                    alt={person.name}
                    monogramName={person.name}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{person.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {person.email}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                  {PRESET_ROLE_LABELS[person.role] ?? person.role}
                </span>
              </label>
            ))}
          </RadioGroup>
        )}

        <DialogFooter className="shrink-0 gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={!selected || isSubmitting}
            onClick={() => {
              if (selected) onConfirm(selected.profileId);
            }}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting
              ? "Handing over..."
              : selected
                ? `Hand over to ${selected.name} and delete`
                : "Hand over and delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
