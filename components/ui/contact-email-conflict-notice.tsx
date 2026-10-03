"use client";

import { AlertTriangle } from "lucide-react";
import type { ContactEmailConflict } from "@/lib/contact-email-conflict";

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
