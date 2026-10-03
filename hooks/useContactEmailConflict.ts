"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  findContactEmailConflict,
  normalizeContactEmail,
  type ContactEmailConflict,
  type ContactEmailEntry,
  type TeammateEmailEntry,
} from "@/lib/contact-email-conflict";

interface PlanAssignmentsResponse {
  assignments?: TeammateEmailEntry[];
  ownerEmails?: string[];
}

/**
 * Resolve the email conflict for a contact form, live.
 *
 * Two sources, in order:
 *  1. The in-memory roster the caller already holds — catches a duplicate contact
 *     immediately, with no round trip, and works in the wizard where the plan's
 *     contacts are draft-only and not yet persisted.
 *  2. `/api/teammates/plan-assignments` — the owner + Team Member addresses, the
 *     seats the cards are matched against. Fetched only when the address is not
 *     already a local duplicate and the plan id is known (a brand-new draft has no
 *     plan to ask about; the duplicate check above still applies).
 *
 * SWR dedupes the shared request across both contact editors, so opening the two
 * dialogs does not double-fetch.
 */
export function useContactEmailConflict({
  planId,
  email,
  excludeContactId,
  originalEmail,
  contacts,
}: {
  planId?: string | null;
  email?: string | null;
  excludeContactId?: string | null;
  originalEmail?: string | null;
  contacts?: ContactEmailEntry[] | null;
}): { conflict: ContactEmailConflict | null; checking: boolean } {
  const normalized = normalizeContactEmail(email);

  const localConflict = useMemo(
    () =>
      findContactEmailConflict({ email, excludeContactId, originalEmail, contacts }),
    [email, excludeContactId, originalEmail, contacts],
  );

  const shouldFetch = !!planId && !!normalized && !localConflict;
  const { data, isLoading } = useSWR<PlanAssignmentsResponse>(
    shouldFetch
      ? `/api/teammates/plan-assignments?planId=${encodeURIComponent(planId as string)}`
      : null,
    (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null)),
    { revalidateOnFocus: false },
  );

  const conflict = useMemo(() => {
    if (localConflict) return localConflict;
    if (!normalized || !data) return null;
    return findContactEmailConflict({
      email,
      excludeContactId,
      originalEmail,
      contacts: [],
      ownerEmails: data.ownerEmails ?? [],
      teammates: data.assignments ?? [],
    });
  }, [localConflict, normalized, data, email, excludeContactId, originalEmail]);

  return { conflict, checking: shouldFetch && isLoading };
}
