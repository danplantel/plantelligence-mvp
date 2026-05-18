import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font- transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-accent-blue dark:bg-white text-primary-foreground hover:bg-[#23919C]/90 active:scale-95 ease-linear transition-all duration-100",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:scale-105 active:scale-95 ease-linear transition-all duration-100",
        outline:
          "border border-[#efefef] dark:border-[#1c1c1c] bg-transparent shadow-sm hover:border-accent-blue active:scale-95 ease-linear transition-all duration-100",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:scale-105 active:scale-95 ease-linear transition-all duration-100",
        ghost: "focus:outline-none",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3 py-2",
        sm: "h-7 px-2 text-xs",
        lg: "h-10 px-4",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
