"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";

import { ONBOARDING_RESUME_EMAIL_THROTTLE_MS } from "@/lib/desktop-only";

/** localStorage key prefix; one entry per account id. */
const STORAGE_KEY_PREFIX = "pt:onboarding-resume-email:";

/**
 * Returns a best-effort callback that asks the server to email the signed-in
 * user a link to resume onboarding on a computer ([MEDIUM]).
 *
 * Throttled per account to one send every `ONBOARDING_RESUME_EMAIL_THROTTLE_MS`
 * using localStorage, so revisiting `/onboarding` on a phone does not spam the
 * inbox. Every failure is swallowed — the blocking notice is shown regardless of
 * whether the mail could be sent.
 */
export function useOnboardingResumeEmail(): () => void {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  return useCallback(() => {
    if (typeof window === "undefined" || !userId) return;

    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;

    try {
      const lastSentAt = Number(window.localStorage.getItem(storageKey) || 0);
      if (Date.now() - lastSentAt < ONBOARDING_RESUME_EMAIL_THROTTLE_MS) {
        return;
      }
    } catch {
      // localStorage unavailable (private mode / blocked) — fall through and try
      // to send. The server-side send is idempotent enough for this [MEDIUM] ask.
    }

    void (async () => {
      try {
        const response = await fetch(
          "/api/onboarding-wizard/send-resume-email",
          { method: "POST" },
        );
        if (!response.ok) return;
        try {
          window.localStorage.setItem(storageKey, String(Date.now()));
        } catch {
          // Ignore storage failures; the send already succeeded.
        }
      } catch {
        // Best-effort: a failed send must never surface to the user.
      }
    })();
  }, [userId]);
}
