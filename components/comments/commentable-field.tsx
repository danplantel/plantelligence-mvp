import type { ReactNode } from "react";

export interface CommentableFieldProps {
  /** Accepted for compatibility with the call sites; currently inert. */
  sectionKey?: string;
  /** Accepted for compatibility with the call sites; currently inert. */
  fieldKey?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A plain wrapper around a field.
 *
 * Text-range commenting is no longer surfaced — selecting text sets nothing and nothing is
 * highlighted — so this is intentionally inert. It is kept as the structural seam the
 * surfaces already use, so the behaviour could be switched back on without touching them.
 */
export function CommentableField({ className, children }: CommentableFieldProps) {
  return <div className={className}>{children}</div>;
}
