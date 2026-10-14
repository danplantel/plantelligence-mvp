"use client";

/**
 * user-profile-dialog — "who is this?", answered from the comments rail.
 *
 * A reader clicks a colleague's name and gets the person: their picture and standing from the one
 * identity resolver every other surface uses, then the same facts Settings → Profile shows — title,
 * role, their email, the organization's shared email, phone and extension, and their designations.
 * A labelled grid rather than a paragraph, because a row with no label cannot say whether an address
 * belongs to the person or to the firm they work for.
 *
 * TWO RULES SHAPE THIS COMPONENT:
 *
 *  - The BUTTON IS DRIVEN BY THE SERVER'S ANSWER, not by a guess. `person.canMessage` is the same
 *    directory verdict `POST /api/messages/threads` checks, so the button is present exactly when the
 *    call would succeed. When it is absent the card says so out loud rather than leaving the reader
 *    wondering whether the feature is broken.
 *  - It HANDS OFF rather than renders a conversation. Comments and Messages share one right-hand
 *    column, so after opening the thread the reader is moved to the Messages rail — the panel that
 *    already knows how to show a conversation, its typing signals and its composer.
 */

import { Fragment, useEffect, useState } from "react";
import useSWR from "swr";
import { MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Headshot } from "@/components/ui/headshot";
import { useOptionalMessagesMode } from "@/components/messages/messages-mode-provider";
import { formatPhoneWithExtension } from "@/lib/phone-utils";
import type { PersonCard } from "@/lib/teammates/person-card";

/** The route's envelope, unwrapped to the card or thrown as the server's own sentence. */
async function fetchPerson(url: string): Promise<PersonCard> {
  const response = await fetch(url, { credentials: "same-origin" });
  const payload = (await response.json().catch(() => null)) as
    | { person?: PersonCard; error?: string }
    | null;
  if (!response.ok || !payload?.person) {
    throw new Error(payload?.error ?? "Could not load this profile.");
  }
  return payload.person;
}

export function UserProfileDialog({
  userId,
  onOpenChange,
}: {
  /** The person to show. Null keeps the dialog closed — so the rail owns one piece of state. */
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  // Optional: a profile card is still useful if the Messages rail was never mounted, and a thrown
  // provider error would take the whole comments panel down with it.
  const messages = useOptionalMessagesMode();
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const {
    data: person,
    error,
    isLoading,
  } = useSWR(userId ? `/api/teammates/people/${userId}` : null, fetchPerson, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  // A fresh card gets a fresh slate: a failure from the last person must not hang over this one.
  useEffect(() => {
    setFailure(null);
    setStarting(false);
  }, [userId]);

  const startConversation = async () => {
    if (!userId || starting) return;
    setStarting(true);
    setFailure(null);
    try {
      const response = await fetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: userId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { threadId?: string; error?: string }
        | null;
      if (!response.ok || !payload?.threadId) {
        setFailure(payload?.error ?? "Could not start the conversation.");
        return;
      }
      // Refresh the inbox so the new conversation is in the list behind the thread, then open it.
      // The two panels share a column, so turning Messages on is what closes this one.
      messages?.refresh();
      messages?.setActiveThreadId(payload.threadId);
      messages?.setMode("on");
      onOpenChange(false);
    } catch {
      setFailure("Could not start the conversation.");
    } finally {
      setStarting(false);
    }
  };

  // Through the project's ONE phone formatter, so the card cannot print a number differently from
  // the Profile, the portal or a contact card: a bare `5550102030` becomes "(555) 010-2030" and the
  // extension rides along as "Ext. 412". A number the formatter cannot recognise is passed through
  // as stored rather than discarded.
  const phoneLine = person?.phone
    ? formatPhoneWithExtension(person.phone, person.phoneExtension)
    : null;

  // The role is a ROW rather than part of the standing line, so it can be labelled like every other
  // fact — and a standing that IS the role ("Owner") is simply not said twice.
  const showRole = Boolean(
    person?.roleLabel && person.roleLabel !== person.standingLabel,
  );

  // Every fact Settings → Profile shows, in the order that screen shows them: who they are, how to
  // reach them, then credentials (rendered below as chips). Only what is actually set — an empty row
  // claiming a phone number would be worse than no row.
  const details: { label: string; value: string }[] = [];
  if (person) {
    if (person.jobTitle) {
      details.push({ label: "Title", value: person.jobTitle });
    }
    if (showRole && person.roleLabel) {
      details.push({ label: "Role", value: person.roleLabel });
    }
    details.push({ label: "Email", value: person.email });
    if (person.organizationEmail) {
      details.push({
        label: "Organization email",
        value: person.organizationEmail,
      });
    }
    if (phoneLine) {
      details.push({ label: "Phone", value: phoneLine });
    }
  }

  return (
    <Dialog open={userId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
            <Headshot
              src={person?.headshot ?? null}
              alt={person?.name ?? "Profile"}
              monogramName={person?.name ?? null}
              wrapperClassName="rounded-full"
            />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">
              {person?.name ?? "Profile"}
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              {person?.standingLabel ??
                (isLoading ? "Loading…" : "This profile is not available.")}
            </DialogDescription>
          </div>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "Could not load this profile."}
          </p>
        ) : person ? (
          <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
            {details.map((detail) => (
              <Fragment key={detail.label}>
                <dt className="text-muted-foreground">{detail.label}</dt>
                <dd className="min-w-0 truncate">{detail.value}</dd>
              </Fragment>
            ))}

            {person.designations.length > 0 ? (
              <>
                <dt className="text-muted-foreground">Designations</dt>
                <dd className="flex flex-wrap gap-1">
                  {person.designations.map((designation) => (
                    <span
                      key={designation}
                      className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {designation}
                    </span>
                  ))}
                </dd>
              </>
            ) : null}
          </dl>
        ) : null}

        {failure ? (
          <p className="text-xs text-destructive" role="alert">
            {failure}
          </p>
        ) : null}

        {/* The standing is stated, not implied: a missing button has to explain itself, or it reads
            as a bug rather than as a rule. */}
        {person && !person.canMessage ? (
          <p className="text-[11px] text-muted-foreground">
            {person.isSelf
              ? "This is you."
              : "You can't message this person — the directory only opens a conversation with the Owner, your team, and collaborators who share a plan with you."}
          </p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {person?.canMessage ? (
            <Button
              type="button"
              className="w-full gap-2"
              disabled={starting}
              onClick={() => void startConversation()}
            >
              <MessageSquare className="h-4 w-4" />
              {starting ? "Opening…" : "Message"}
            </Button>
          ) : null}
          {/* A visible way out at the foot of the card. The dialog's own corner X is there too, but a
              card whose facts can run past the fold needs the control where the reading ends — and
              `DialogClose` (rather than a handler) keeps Escape and the overlay click meaning the
              same thing. */}
          <DialogClose asChild>
            <Button type="button" variant="outline" className="w-full">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
