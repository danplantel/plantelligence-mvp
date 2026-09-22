"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useDismissibleAlert } from "@/hooks/use-dismissible-alert";

interface DismissibleAlertProps extends React.ComponentProps<typeof Alert> {
  /**
   * Stable identifier used to persist the dismissal in localStorage so the
   * alert never renders again on this device.
   */
  alertKey: string;
  /** Optional extra classes for the close button (e.g. to match the alert color). */
  closeButtonClassName?: string;
}

/**
 * An {@link Alert} with a top-right close button. Once dismissed, the alert is
 * permanently hidden for the current device (persisted in localStorage).
 */
export function DismissibleAlert({
  alertKey,
  className,
  closeButtonClassName,
  children,
  ...props
}: DismissibleAlertProps) {
  const { isDismissed, dismiss } = useDismissibleAlert(alertKey);

  if (isDismissed) return null;

  return (
    <Alert className={cn("pr-10", className)} {...props}>
      {/*
        The close button is rendered BEFORE {children} on purpose.
        `alertVariants` styles every direct child that follows a leading icon
        (`[&>svg~*]:pl-7`). When children start with an icon, rendering this
        button last made it a following sibling of that icon, so it inherited a
        1.75rem padding-left inside its fixed 1.5rem box — collapsing the content
        box and pushing the "X" out of the button. Coming first, it is never a
        following sibling. Absolute positioning means DOM order is invisible.
      */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className={cn(
          "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-colors hover:bg-black/5 hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:bg-white/10",
          closeButtonClassName,
        )}
      >
        <X className="h-4 w-4" />
      </button>
      {children}
    </Alert>
  );
}
