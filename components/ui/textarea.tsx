import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  destructive?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, destructive, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[40px] w-full rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
          destructive
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
            : "border-gray-300 dark:border-gray-500 focus:border-accent-blue dark:focus:border-accent-blue focus:ring-accent-blue/20 dark:focus:ring-accent-blue/30",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
