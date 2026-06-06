"use client";

import { useMemo, useState } from "react";
import { useNewClientWizardStore } from "@/lib/new-client-wizard-store";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandingImage } from "@/components/ui/branding-image";

export const SOMEONE_ELSE_OPTIONS = [
  "3rd Party Administrator",
  "Retirement Benefits Advisor",
  "Group Health Advisor",
  "Group Life Advisor",
  "Custom Benefits Advisor",
] as const;

export type SomeoneElseOption = (typeof SOMEONE_ELSE_OPTIONS)[number];

export interface FirstContactPromptProps {
  /** Called when user clicks Continue (always Company/Plan Sponsor) */
  onContinue: () => void;
  /** Called when user selects a "Someone Else" option */
  onSomeoneElseSelect?: (option: SomeoneElseOption) => void;
}

export function FirstContactPrompt({ onContinue, onSomeoneElseSelect }: FirstContactPromptProps) {
  const stepData = useNewClientWizardStore((s) => s.stepData);
  const [isSomeoneElseExpanded, setIsSomeoneElseExpanded] = useState(false);

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
          Who{'\''}s the main point of contact for{" "}
          <span className="text-accent-blue">{displayName}</span>
          {'\''}s benefits plan?
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
          "bg-accent-blue hover:bg-accent-blue-light/80 dark:hover:bg-accent-blue-dark/40 transition-all cursor-pointer",
          "text-left shadow-sm hover:shadow-md",
        )}
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-gray-100"
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
            <h3 className="text-sm font-semibold text-white">
              Company / Plan Sponsor
            </h3>
            <p className="text-xs text-gray-100">
              Main point of contact
            </p>
          </div>

          {/* Right side: Continue → horizontally aligned */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-100 whitespace-nowrap">
              Continue
            </span>
            <ArrowRight className="w-4 h-4 text-gray-100 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 w-full max-w-sm mx-auto">
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">or</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Someone Else Button */}
      <div className="w-full max-w-sm mx-auto">
        <button
          type="button"
          onClick={() => setIsSomeoneElseExpanded(!isSomeoneElseExpanded)}
          className={cn(
            "group rounded-xl w-full p-4 transition-all cursor-pointer text-left",
            isSomeoneElseExpanded
              ? "bg-gray-100 dark:bg-gray-800 shadow-sm"
              : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm hover:shadow-md",
          )}
        >
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
            </div>

            {/* Label */}
            <div className="flex flex-col flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Someone Else
              </h3>
              <p className="text-xs text-muted-foreground">
                3rd party or external contact
              </p>
            </div>

            {/* Chevron */}
            <div className="flex-shrink-0">
              {isSomeoneElseExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </button>

        {/* Expanded Options List */}
        {isSomeoneElseExpanded && (
          <div className="mt-1 space-y-0.5 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            {SOMEONE_ELSE_OPTIONS.map((option, index) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setIsSomeoneElseExpanded(false);
                  onSomeoneElseSelect?.(option);
                }}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm transition-colors",
                  "text-muted-foreground hover:bg-gray-50 dark:hover:bg-gray-700/50",
                  index < SOMEONE_ELSE_OPTIONS.length - 1 && "border-b border-gray-100 dark:border-gray-700",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
