"use client";

import { useMemo } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Button } from "@/components/ui/button";
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
      {/* Question - compact, fits above fold */}
      <div className="space-y-2 max-w-xl">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
          Who's the main point of contact for{" "}
          <span className="text-accent-blue">{displayName}</span>
          's benefits plan?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Start by adding your Company / Plan Sponsor contact.
        </p>
      </div>

      {/* Single Prominent Card - compact */}
      <div
        className={cn(
          "rounded-xl border-2 border-accent-blue bg-accent-blue/5 w-full max-w-xs mx-auto p-4",
          "shadow-sm",
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

          {/* Label + Logo */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex flex-col text-left">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Company / Plan Sponsor
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Main point of contact
              </p>
            </div>

            {/* Company Logo */}
            {companyLogo?.trim() ? (
              <div className="ml-auto flex-shrink-0">
                <BrandingImage
                  src={companyLogo}
                  alt={`${displayName} logo`}
                  className="w-10 h-10 object-contain"
                />
              </div>
            ) : (
              <div className="ml-auto flex-shrink-0">
                <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-[10px]">
                  No logo
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={onContinue}
        size="default"
        className="px-6 text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
      >
        Continue
        <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );
}
