"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useOptionalMessagesMode } from "@/components/messages/messages-mode-provider";
import { categoryToSlug } from "@/lib/benefit-category-slug";

/**
 * T2 Part A item 2: what a user sees when they reach a restricted page
 * directly — "You don't have access to this plan/section" with a link back to a
 * page the viewer CAN use (the Dashboard by default).
 *
 * `DEFAULT_NO_ACCESS_MESSAGE` is duplicated from the server constant on purpose:
 * the API sends its own copy in the response (`message`), and this is only the
 * fallback for a client-side denial that never reached the API. Keep the two
 * strings identical.
 *
 * When the refusal arrives WITH its context (see the server's
 * `PlanAccessDenialContext`) the notice tells the whole story instead:
 *
 *     This area isn't part of your access
 *     <Organization> invited you to collaborate on <Plan> → <Section>
 *     [Go to <the section they DO cover>] [Message Organization]
 *
 * The generic copy above remains for the denials that carry no context — the
 * layout's collaborator gate, and every refusal from a lookup that never reached
 * the server.
 */

export const DEFAULT_NO_ACCESS_MESSAGE =
  "You don't have access to this plan/section";

export function NoAccessNotice({
  message = DEFAULT_NO_ACCESS_MESSAGE,
  reason,
  backHref = "/dashboard",
  backLabel = "Back to Dashboard",
  planId,
  organizationName,
  planCompanyName,
  category,
  assignedCategories = [],
  ownerUserId,
}: {
  message?: string;
  /** Machine-readable denial reason, shown small for support/debugging. */
  reason?: string;
  /**
   * Where the primary action leads. Defaults to the Dashboard, which is right for the
   * plan/section case; a caller refusing the Dashboard itself must point somewhere the
   * viewer can actually reach.
   */
  backHref?: string;
  /** The primary action's label, matching `backHref`. */
  backLabel?: string;
  /** The plan that was refused — with `assignedCategories`, it builds the "Go to …" link. */
  planId?: string | null;
  /** The inviting firm's display name — named in the sentence and on the message button. */
  organizationName?: string | null;
  /** The plan's own company name — named in the sentence. */
  planCompanyName?: string | null;
  /** The section that was refused, in display form ("Group Health"). */
  category?: string | null;
  /** The section labels the viewer DOES cover on that plan. */
  assignedCategories?: string[];
  /** The organization owner's userId — who a message about access should reach. */
  ownerUserId?: string | null;
}) {
  const messages = useOptionalMessagesMode();
  const [isStartingThread, setIsStartingThread] = useState(false);

  // One section covered is the "Go to Group Health" case; `assignedCategories` is empty for an
  // assignment that covers everything, which is exactly when there is no single section to name.
  const coveredSection = assignedCategories[0] ?? null;
  const canGoToSection = Boolean(planId && coveredSection);
  // The rail is only reachable inside `MessagesModeProvider`, so the button is withheld rather
  // than offered and then failing.
  const canMessageOrganization = Boolean(
    ownerUserId && organizationName && messages,
  );
  /**
   * Whether to tell the whole story.
   *
   * Any ONE of these facts is enough — the section being refused included. Keying this on the
   * organization alone was the bug: a refusal for a plan/section route whose organization name
   * or plan name did not resolve (a legacy plan with no `organizationId`, a plan row the viewer
   * cannot see) fell back to the generic copy, which is pixel-identical to the notice this page
   * had before — so the page looked unchanged. The generic branch is now reserved for the
   * refusals that genuinely have no plan or section to name (the layout's chrome gate, and a
   * lookup that never reached the server).
   */
  const hasContext = Boolean(organizationName || planCompanyName || category);

  const goTo = (href: string) => {
    // Mirror app/not-found.tsx: stay on the current host so a preview deployment doesn't
    // bounce the user to production.
    window.location.href = `${window.location.origin}${href}`;
  };

  /**
   * Open the Messages rail on the conversation with the organization's owner.
   *
   * The same call the directory picker makes — the server owns "who may I message", and the
   * thread is created on first use, so this is one POST whether or not one already exists.
   */
  const messageOrganization = async () => {
    if (!ownerUserId || !messages || isStartingThread) return;
    setIsStartingThread(true);
    try {
      const response = await fetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: ownerUserId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        threadId?: string;
        error?: string;
      };
      if (!response.ok || !payload.threadId) {
        throw new Error(payload.error ?? "Could not open that conversation.");
      }
      messages.setActiveThreadId(payload.threadId);
      messages.setMode("on");
    } catch (error) {
      toast.error(
        (error as Error)?.message ?? "Could not open that conversation.",
      );
    } finally {
      setIsStartingThread(false);
    }
  };

  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mb-16 items-center justify-center text-center">
      <h2 className="my-2 font-heading text-2xl font-bold">
        {hasContext ? "This area isn’t part of your access" : message}
      </h2>
      {hasContext ? (
        <p className="text-muted-foreground">
          {organizationName ?? "Your organization"} invited you to collaborate
          on{" "}
          <span className="font-medium text-foreground">
            {planCompanyName ?? "this plan"}
          </span>
          {category ? (
            <>
              {" → "}
              <span className="font-medium text-foreground">{category}</span>
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Your access is limited to the plans and categories you have been
          assigned.
        </p>
      )}
      {/* The reference is for support, and only the generic copy needs it: with the story
          rendered above, the reason is already legible as what it is. */}
      {!hasContext && reason ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Reference: {reason}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {canGoToSection ? (
          <Button
            onClick={() =>
              goTo(`/edit-benefit/${planId}/${categoryToSlug(coveredSection)}`)
            }
            variant="default"
            size="lg"
          >
            Go to {coveredSection}
          </Button>
        ) : (
          <Button onClick={() => goTo(backHref)} variant="default" size="lg">
            {backLabel}
          </Button>
        )}
        {canMessageOrganization ? (
          <Button
            onClick={() => void messageOrganization()}
            disabled={isStartingThread}
            variant="outline"
            size="lg"
          >
            {isStartingThread ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Message Organization
          </Button>
        ) : null}
      </div>
    </div>
  );
}
