import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  destructive?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, destructive, icon, iconPosition = "left", ...props },
    ref,
  ) => {
    if (!icon) {
      // If no icon, render regular input
      return (
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded-lg border bg-white dark:bg-gray-800 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 outline-none focus:outline-none",
            destructive
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
              : "border-gray-300 dark:border-gray-600 focus:border-accent-blue dark:focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 dark:focus:ring-accent-blue/30",
            className,
          )}
          ref={ref}
          {...props}
        />
      );
    }

    // With icon, wrap in container
    return (
      <div className="relative w-full">
        {iconPosition === "left" && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded-lg border bg-white dark:bg-gray-800 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 outline-none focus:outline-none",
            destructive
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
              : "border-gray-300 dark:border-gray-600 focus:border-accent-blue dark:focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 dark:focus:ring-accent-blue/30",
            iconPosition === "left" ? "pl-9 pr-3" : "pl-3 pr-9",
            className,
          )}
          ref={ref}
          {...props}
        />
        {iconPosition === "right" && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
