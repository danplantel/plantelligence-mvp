"use client";

import { cn } from "@/lib/utils";
import { getNameMonogram } from "@/lib/name-monogram";

export function MonogramAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = getNameMonogram(name);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-muted font-semibold uppercase tracking-tight text-muted-foreground select-none",
        className,
      )}
      aria-hidden={!name.trim()}
      aria-label={name.trim() ? `Avatar for ${name}` : undefined}
    >
      {initials}
    </span>
  );
}
