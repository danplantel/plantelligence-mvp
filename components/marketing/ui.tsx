import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type MarketingButtonVariant = "primary" | "secondary" | "light" | "ghost";

const buttonVariants: Record<MarketingButtonVariant, string> = {
  primary:
    "bg-[#1F3A60] text-white shadow-[0_12px_30px_-18px_rgba(31,58,96,0.9)] hover:bg-[#162C4A] focus-visible:ring-[#1F3A60]",
  secondary:
    "border border-[#D8D1C4] bg-white/80 text-[#1F3A60] hover:border-[#1F3A60] hover:bg-white focus-visible:ring-[#1F3A60]",
  light:
    "bg-white text-[#1F3A60] shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)] hover:bg-[#F3F8F8] focus-visible:ring-white",
  ghost:
    "text-[#1F3A60] hover:bg-[#F0ECE4] focus-visible:ring-[#1F3A60]",
};

interface MarketingButtonProps
  extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: MarketingButtonVariant;
  children: ReactNode;
}

export function MarketingButton({
  href,
  variant = "primary",
  className,
  children,
  ...props
}: MarketingButtonProps) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none",
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export function MarketingEyebrow({
  children,
  className,
  tone = "teal",
}: {
  children: ReactNode;
  className?: string;
  tone?: "teal" | "light";
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.2em]",
        tone === "teal" ? "text-[#1B7C86]" : "text-[#9FD9DE]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function MarketingSectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "dark",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl",
        className,
      )}
    >
      {eyebrow ? (
        <MarketingEyebrow tone={tone === "dark" ? "teal" : "light"}>
          {eyebrow}
        </MarketingEyebrow>
      ) : null}
      <h2
        className={cn(
          "mt-3 font-dm-serif text-3xl leading-[1.08] tracking-[-0.015em] sm:text-4xl lg:text-[2.9rem]",
          tone === "dark" ? "text-[#14243A]" : "text-white",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-5 font-red-hat text-base leading-relaxed sm:text-lg",
            tone === "dark" ? "text-[#526072]" : "text-white/75",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function MarketingCheckItem({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  tone?: "dark" | "light";
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
          tone === "dark"
            ? "bg-[#E4F3F4] text-[#1B7C86]"
            : "bg-white/15 text-[#9FD9DE]",
        )}
        aria-hidden="true"
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span
        className={cn(
          "font-red-hat text-sm leading-relaxed sm:text-[15px]",
          tone === "dark" ? "text-[#3E4C5E]" : "text-white/80",
        )}
      >
        {children}
      </span>
    </li>
  );
}

export function MarketingIconBadge({
  children,
  tone = "light",
  className,
}: {
  children: ReactNode;
  tone?: "light" | "navy" | "teal";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-11 place-items-center rounded-xl",
        tone === "light" && "bg-[#EAF5F6] text-[#1B7C86]",
        tone === "teal" && "bg-[#23919C] text-white",
        tone === "navy" && "bg-[#1F3A60] text-white",
        className,
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
