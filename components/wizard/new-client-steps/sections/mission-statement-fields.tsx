"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";

interface MissionStatementFieldsProps {
  missionHeadline: string;
  missionBody: string;
  defaultHeadline: string;
  defaultBodyText: string;
  useDefaultHeadline: boolean;
  useDefaultBody: boolean;
  headlineCharCount: number;
  bodyCharCount: number;
  isHeadlineValid: boolean;
  isBodyValid: boolean;
  errorFields: string[];
  headlineRef: React.RefObject<HTMLInputElement>;
  bodyTextRef: React.RefObject<HTMLTextAreaElement>;
  onHeadlineChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onUseDefaultHeadlineChange: (checked: boolean) => void;
  onUseDefaultBodyChange: (checked: boolean) => void;
  // Optional AI generation handlers (only for edit-client page)
  onGenerateMissionHeadline?: () => void;
  onGenerateMissionBody?: () => void;
  // Optional: show "Use default" checkboxes (default: true for wizard, false for edit-client page)
  showUseDefault?: boolean;
  // Optional: show message when generation limit is reached
  missionGenerationLimitReached?: boolean;
  highlightedField?: "headline" | "body" | null;
}

export function MissionStatementFields({
  missionHeadline,
  missionBody,
  defaultHeadline,
  defaultBodyText,
  useDefaultHeadline,
  useDefaultBody,
  headlineCharCount,
  bodyCharCount,
  isHeadlineValid,
  isBodyValid,
  errorFields,
  headlineRef,
  bodyTextRef,
  onHeadlineChange,
  onBodyChange,
  onUseDefaultHeadlineChange,
  onUseDefaultBodyChange,
  onGenerateMissionHeadline,
  onGenerateMissionBody,
  showUseDefault = true,
  missionGenerationLimitReached = false,
  highlightedField = null,
}: MissionStatementFieldsProps) {
  return (
    <>
      <div className="mb-3">
        <Label className="font-bold text-start dark:text-gray-100">
          Company Mission Statement
        </Label>
      </div>
      <div className="space-y-8">
        <div className="space-y-3">
          <div
            className={`space-y-2`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="font-bold dark:text-gray-300">Mission Headline *</Label>
                {onUseDefaultHeadlineChange && defaultHeadline && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="useDefaultHeadline"
                      checked={useDefaultHeadline}
                      onCheckedChange={(checked) =>
                        onUseDefaultHeadlineChange(Boolean(checked))
                      }
                    />
                    <Label
                      htmlFor="useDefaultHeadline"
                      className="text-sm cursor-pointer dark:text-gray-300"
                    >
                      Use default
                    </Label>
                  </div>
                )}
              </div>
              {onGenerateMissionHeadline && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onGenerateMissionHeadline}
                  className="flex items-center gap-2 h-7 text-xs"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate with AI
                </Button>
              )}
            </div>
            <Input
              ref={headlineRef}
              value={missionHeadline}
              onChange={(e) => onHeadlineChange(e.target.value)}
              maxLength={60}
              placeholder="Write a short, one-sentence mission headline that supports the Company Mission Statement."
              data-field="missionHeadline"
              destructive={errorFields.includes("missionHeadline")}
              className={`transition-all duration-500 ${highlightedField === "headline"
                ? "bg-white ring-2 ring-accent-blue/40 scale-[1.02] z-10 relative border-accent-blue/20 shadow-sm rounded-lg dark:bg-gray-800"
                : ""
                }`}
            />
            {errorFields.includes("missionHeadline") && (
              <FormError
                message={
                  !missionHeadline || missionHeadline.trim() === ""
                    ? "Mission Headline is required"
                    : !isHeadlineValid
                      ? "Mission Headline must be 60 characters or less"
                      : undefined
                }
              />
            )}
            {!errorFields.includes("missionHeadline") &&
              headlineCharCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1 dark:text-gray-400">
                  {headlineCharCount}/60 characters
                </p>
              )}
          </div>
          <div
            className={`space-y-2`}
          >
            <div className="flex items-center justify-between">
              <Label className="font-bold dark:text-gray-300">Mission Statement *</Label>
              {onGenerateMissionBody && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onGenerateMissionBody}
                  className="flex items-center gap-1.5 h-7 text-xs whitespace-nowrap"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate with AI
                </Button>
              )}
            </div>
            <Textarea
              ref={bodyTextRef}
              value={missionBody}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={6}
              maxLength={800}
              placeholder="Share the bigger mission behind your organization..."
              data-field="missionBody"
              destructive={errorFields.includes("missionBody")}
              className={`transition-all duration-500 ${highlightedField === "body"
                ? "bg-white ring-2 ring-accent-blue/40 scale-[1.02] z-10 relative border-accent-blue/20 shadow-sm rounded-lg dark:bg-gray-800"
                : ""
                }`}
            />
            {errorFields.includes("missionBody") && (
              <FormError
                message={
                  !missionBody || missionBody.trim() === ""
                    ? "Mission Statement is required"
                    : !isBodyValid
                      ? bodyCharCount < 250
                        ? "Mission Statement must be at least 250 characters"
                        : "Mission Statement must be 800 characters or less"
                      : undefined
                }
              />
            )}
            {!errorFields.includes("missionBody") && bodyCharCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1 dark:text-gray-400">
                {bodyCharCount}/800 characters
                {bodyCharCount < 250 && (
                  <span className="text-amber-600 ml-2 dark:text-amber-400">
                    (minimum 250 characters)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        {missionGenerationLimitReached && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Generation limit reached. Cycling through previous selections.
          </p>
        )}
      </div>
    </>
  );
}
