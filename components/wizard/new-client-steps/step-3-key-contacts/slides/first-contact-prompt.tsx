"use client";

import { useMemo } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandingImage } from "@/components/ui/branding-image";

export interface FirstContactPromptProps {
  /** Called when user clicks Continue (always Company/Plan Sponsor) */
  onContinue: () => void;
}

export function FirstContactPrompt({ onContinue }: FirstContactPromptProps) {
  const stepData = useNewClientWizardStore((s) => s.stepData);

  const companyName =
    stepData?.companyBasics?.companyName || "your company";
  const companyLogo = stepData?.companyBasics?.companyLogo?.url || "";

  const displayName = useMemo(() => {
    if (!companyName || companyName === "your company") return "your company";
    return companyName;
  }, [companyName]);

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-3 py-2">
      {/* Company Logo above header */}
      {companyLogo?.trim() ? (
        <div className="mb-1">
          <BrandingImage
            src={companyLogo}
            alt={`${displayName} logo`}
            className="w-16 h-16 object-contain mx-auto"
          />
        </div>
      ) : null}

      {/* Question */}
      <div className="space-y-2 max-w-xl">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
          Who's the main point of contact for{" "}
          <span className="text-accent-blue">{displayName}</span>
          's benefits plan?
        </h2>
        <p className="py-4 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Start by adding your Company / Plan Sponsor contact. This is normally an HR manager, benefits coordinator, or someone in a similar role who oversees employee benefits.
        </p>
      </div>

      {/* Single Clickable Card — replaces card + separate button */}
      <button
        type="button"
        onClick={onContinue}
        className={cn(
          "group rounded-xl w-full max-w-sm mx-auto p-4",
          "bg-accent-blue-light hover:bg-accent-blue-light/80 dark:bg-accent-blue-dark/30 dark:hover:bg-accent-blue-dark/40 transition-all cursor-pointer",
          "text-left shadow-sm hover:shadow-md",
        )}
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-accent-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
              />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          {/* Label */}
          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-accent-blue">
              Company / Plan Sponsor
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Main point of contact
            </p>
          </div>

          {/* Right side: Continue → horizontally aligned */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs font-semibold text-accent-blue whitespace-nowrap">
              Continue
            </span>
            <ArrowRight className="w-4 h-4 text-accent-blue group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </button>
    </div>
  );
}
