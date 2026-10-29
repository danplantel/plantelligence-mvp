"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

import { MARKETING_NAV_LINKS } from "@/config/marketing";
import { cn } from "@/lib/utils";

interface MarketingHeaderProps {
  appOrigin: string;
  isSignedIn: boolean;
}

export function MarketingHeader({
  appOrigin,
  isSignedIn,
}: MarketingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;

    // Move focus into the panel so keyboard and screen-reader users land on
    // the first link instead of continuing behind the open sheet.
    panel?.querySelector<HTMLAnchorElement>("a")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        // Return focus to the control that opened the panel.
        toggleRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !panel) return;

      // Keep Tab inside the open sheet. The page behind it is
      // `overflow: hidden`, so tabbing out would move focus to content the
      // viewer cannot see. The toggle joins the cycle so Shift+Tab from the
      // first link reaches the control that closes the panel.
      const focusable = [
        toggleRef.current,
        ...panel.querySelectorAll<HTMLElement>("a[href], button"),
      ].filter((node): node is HTMLElement => Boolean(node));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const primaryHref = isSignedIn
    ? `${appOrigin}/dashboard`
    : `${appOrigin}/signin`;
  const primaryLabel = isSignedIn ? "Go to dashboard" : "Sign in";

  return (
    <header className="sticky top-0 z-50 border-b border-[#E7E1D8]/80 bg-[#FBF9F6]/90 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-[#1F3A60] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <a
          href="#top"
          className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] focus-visible:ring-offset-2"
          aria-label="PlanTelligence home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/plantelligence-logos/pt_web_light.png"
            alt="PlanTelligence"
            className="h-7 w-auto sm:h-8"
          />
        </a>

        <nav
          aria-label="Marketing"
          className="hidden items-center gap-1 lg:flex"
        >
          {MARKETING_NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-[13px] font-medium text-[#526072] transition-colors hover:bg-[#F0ECE4] hover:text-[#14243A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] motion-reduce:transition-none"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href={`${appOrigin}/dashboard`}
            className="rounded-full px-3 py-2 text-[13px] font-medium text-[#526072] transition-colors hover:text-[#14243A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] motion-reduce:transition-none"
          >
            Go to dashboard
          </a>
          <a
            href={primaryHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#1F3A60] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#162C4A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            {primaryLabel}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="grid size-10 place-items-center rounded-full border border-[#D8D1C4] bg-white/70 text-[#1F3A60] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] focus-visible:ring-offset-2 lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="marketing-mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      <div
        ref={panelRef}
        id="marketing-mobile-nav"
        className={cn(
          "fixed inset-x-0 top-[72px] z-40 max-h-[calc(100dvh-72px)] overflow-y-auto border-b border-[#E7E1D8] bg-[#FBF9F6] px-5 pb-8 pt-4 shadow-[0_24px_40px_-24px_rgba(20,36,58,0.35)] lg:hidden",
          menuOpen ? "block" : "hidden",
        )}
      >
        <nav aria-label="Marketing mobile" className="flex flex-col">
          {MARKETING_NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between border-b border-[#EDE7DC] py-3.5 text-base font-medium text-[#14243A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60]"
            >
              {link.label}
              <ArrowRight className="size-4 text-[#5F6B7A]" aria-hidden="true" />
            </a>
          ))}
        </nav>
        <div className="mt-5 grid gap-2">
          <a
            href={primaryHref}
            onClick={() => setMenuOpen(false)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1F3A60] px-5 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] focus-visible:ring-offset-2"
          >
            {primaryLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
          <a
            href={`${appOrigin}/dashboard`}
            onClick={() => setMenuOpen(false)}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#D8D1C4] bg-white px-5 py-2.5 text-sm font-semibold text-[#1F3A60] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3A60] focus-visible:ring-offset-2"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </header>
  );
}
