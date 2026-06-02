"use client";

import { useMemo } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
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
    <div className="flex flex-col items-center justify-center text-center space-y-8 py-8">
      {/* Question - TypeForm style large centered text */}
      <div className="space-y-3 max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Who's the main point of contact for{" "}
          <span className="text-accent-blue">{displayName}</span>
          's benefits plan?
        </h2>
        <p className="text-base text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
          Start by adding your Company / Plan Sponsor contact. This is typically
          the HR representative or benefits manager.
        </p>
      </div>

      {/* Single Prominent Card */}
      <div
        className={cn(
          "rounded-xl border-2 border-accent-blue bg-accent-blue/5 w-full max-w-sm mx-auto p-6",
          "shadow-sm",
        )}
      >
        <div className="flex flex-col items-center space-y-4">
          {/* Icon + Label */}
          <div className="w-14 h-14 rounded-full bg-accent-blue/10 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-accent-blue"
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

          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Company / Plan Sponsor
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This person will appear on your Benefits Team page
            </p>
          </div>

          {/* Company Logo */}
          {companyLogo?.trim() ? (
            <div className="relative">
              <BrandingImage
                src={companyLogo}
                alt={`${displayName} logo`}
                className="w-24 h-24 object-contain"
              />
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-accent-blue rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="w-24 h-14 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-xs">
                No logo
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-accent-blue rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={onContinue}
        size="lg"
        className="px-8 py-6 text-base font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
      >
        Continue
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
}
