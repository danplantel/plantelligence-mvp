"use client";

import { AlertTriangle } from "lucide-react";
import { useContactEmailConflict } from "@/hooks/useContactEmailConflict";
import type {
  ContactEmailConflict,
  ContactEmailEntry,
} from "@/lib/contact-email-conflict";

/**
 * Inline, blocking explanation for a reused contact email.
 *
 * Rendered directly under the Email field in both contact editors so the reason a
 * save is refused sits next to the value that caused it, naming the owner / teammate
 * / contact that already holds the address.
 */
export function ContactEmailConflictNotice({
  conflict,
}: {
  conflict: ContactEmailConflict | null;
}) {
  if (!conflict) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 text-[10px] leading-snug text-red-500"
    >
      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
      <span>{conflict.message}</span>
    </p>
  );
}

/**
 * Self-contained conflict hint for lists that render many contacts in one map.
 *
 * A hook cannot be called inside the map body, so this tiny component owns the hook
 * call per row — the auto-saving Create Plan inline editor (`ContactSectionEditor`)
 * uses it under each Email field. There is no save gate to block (the row persists on
 * every keystroke), so this surfaces the conflict rather than refusing the write.
 * Pass `planId={null}` to keep it to the in-memory duplicate check and avoid an
 * owner/teammate false positive on a row that legitimately is that person.
 */
export function ContactEmailConflictHint({
  planId = null,
  email,
  excludeContactId,
  originalEmail,
  genericMessage = false,
  contacts,
}: {
  planId?: string | null;
  email?: string | null;
  excludeContactId?: string | null;
  originalEmail?: string | null;
  /** Replace the specific holder with one generic sentence (Create Plan). */
  genericMessage?: boolean;
  contacts?: ContactEmailEntry[] | null;
}) {
  const { conflict } = useContactEmailConflict({
    planId,
    email,
    excludeContactId,
    originalEmail,
    genericMessage,
    contacts,
  });
  return <ContactEmailConflictNotice conflict={conflict} />;
}
