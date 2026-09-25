"use client";

import { Button } from "@/components/ui/button";

/**
 * T2 Part A item 2: what a user sees when they reach a restricted page
 * directly — "You don't have access to this plan/section" with a link back to
 * the dashboard.
 *
 * `DEFAULT_NO_ACCESS_MESSAGE` is duplicated from the server constant on purpose:
 * the API sends its own copy in the response (`message`), and this is only the
 * fallback for a client-side denial that never reached the API. Keep the two
 * strings identical.
 */
export const DEFAULT_NO_ACCESS_MESSAGE =
  "You don't have access to this plan/section";

export function NoAccessNotice({
  message = DEFAULT_NO_ACCESS_MESSAGE,
  reason,
}: {
  message?: string;
  /** Machine-readable denial reason, shown small for support/debugging. */
  reason?: string;
}) {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mb-16 items-center justify-center text-center">
      <h2 className="my-2 font-heading text-2xl font-bold">{message}</h2>
      <p className="text-muted-foreground">
        Your access is limited to the plans and categories you have been assigned.
      </p>
      {reason ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Reference: {reason}
        </p>
      ) : null}
      <div className="mt-8 flex justify-center gap-2">
        <Button
          onClick={() => {
            // Mirror app/not-found.tsx: stay on the current host so a preview
            // deployment doesn't bounce the user to production.
            window.location.href = `${window.location.origin}/dashboard`;
          }}
          variant="default"
          size="lg"
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
