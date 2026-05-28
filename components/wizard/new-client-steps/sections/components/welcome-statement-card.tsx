"use client";

import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileText, Pencil } from "lucide-react";
import type { WelcomeStatementData } from "@/types/new-client-wizard";

interface WelcomeStatementCardProps {
  welcomeData: WelcomeStatementData | undefined;
  companyName: string;
  errorFields: string[];
  useDefaultBody: boolean;
  onToggleDefaultBody?: (checked: boolean) => void;
  defaultBodyText?: string;
  onHeadlineChange?: (value: string) => void;
  onBodyChange: (value: string) => void;
  onCompanyNameEdit?: () => void;
  bannerTitleCardRef?: React.RefObject<HTMLDivElement>;
  isBannerTitleHighlighted?: boolean;
  isWelcomeBodyHighlighted?: boolean;
}

export function WelcomeStatementCard({
  welcomeData,
  companyName,
  errorFields,
  useDefaultBody,
  onToggleDefaultBody,
  defaultBodyText,
  onHeadlineChange,
  onBodyChange,
  onCompanyNameEdit,
  bannerTitleCardRef,
  isBannerTitleHighlighted,
  isWelcomeBodyHighlighted,
}: WelcomeStatementCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef<number | null>(null);
  const isUserInputRef = useRef(false);
  const isSyncingDefaultRef = useRef(false);

  const effectiveDefaultBodyText =
    defaultBodyText ||
    "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

  const currentUseDefaultBody = onToggleDefaultBody
    ? useDefaultBody
    : useDefaultBody;



  // NOTE: Removed local initialization. The parent component (NewClientStep2) 
  // now handles setting the default text when useDefaultBody is true.
  // This prevents an infinite loop or race condition where onBodyChange(defaultText)
  // would call onToggleDefaultBody(false) and uncheck the box.

  // NOTE: Removed conflicting sync logic that was preventing checkbox from being checked
  // The parent component (step-2-welcome-statement.tsx) now controls the checkbox state

  // Restore cursor position after value changes (only for user input)
  useEffect(() => {
    if (
      textareaRef.current &&
      cursorPositionRef.current !== null &&
      isUserInputRef.current
    ) {
      const textarea = textareaRef.current;
      const cursorPos = cursorPositionRef.current;

      // Use setTimeout to ensure DOM is updated after React re-render
      setTimeout(() => {
        if (textarea && cursorPos !== null) {
          // Ensure cursor position is within bounds
          const maxPos = textarea.value.length;
          const safePos = Math.min(cursorPos, maxPos);
          textarea.setSelectionRange(safePos, safePos);
          textarea.focus();
          cursorPositionRef.current = null; // Clear after restoring
          isUserInputRef.current = false; // Reset flag
        }
      }, 0);
    }
  }, [welcomeData?.bodyText]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="dark:text-gray-300">Banner Headline</Label>
          {onCompanyNameEdit && (
            <div
              ref={bannerTitleCardRef}
              className={`transition-all duration-500 ${isBannerTitleHighlighted
                ? "bg-white ring-2 ring-accent-blue/40 rounded-lg p-2 -m-2 scale-[1.02] shadow-sm dark:bg-gray-800"
                : ""
                }`}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCompanyNameEdit}
                className="flex items-center gap-2 h-7 text-xs"
              >
                <Pencil className="w-3 h-3" />
                Edit Banner Headline
              </Button>
            </div>
          )}
        </div>
        <Input
          value={welcomeData?.headline || ""}
          readOnly={!onHeadlineChange}
          disabled={!onHeadlineChange}
          onChange={(e) => onHeadlineChange?.(e.target.value)}
          data-field="headline"
          destructive={errorFields.includes("headline")}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="dark:text-gray-300">
              Welcome Message <span className="text-red-500">*</span>
            </Label>
            {effectiveDefaultBodyText && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="useDefaultBody"
                  checked={currentUseDefaultBody}
                  onCheckedChange={(checked) =>
                    onToggleDefaultBody?.(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="useDefaultBody"
                  className="text-sm cursor-pointer dark:text-gray-300"
                >
                  Use default
                </Label>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs ${(welcomeData?.bodyText?.length || 0) >= 250 &&
                (welcomeData?.bodyText?.length || 0) <= 500
                ? "text-muted-foreground dark:text-gray-400"
                : "text-muted-foreground dark:text-gray-400"
                }`}
            >
              {welcomeData?.bodyText?.length || 0}/500 characters
            </span>
          </div>
        </div>
        <Textarea
          ref={textareaRef}
          value={welcomeData?.bodyText || ""}
          onKeyDown={(e) => {
            // Save cursor position BEFORE the change happens
            const textarea = e.currentTarget;
            const currentPos = textarea.selectionStart;

            // Calculate where cursor should be after this key press
            let newCursorPos = currentPos;

            // Handle different key types
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              // Regular character - cursor moves forward by 1
              newCursorPos = currentPos + 1;
            } else if (e.key === "Backspace") {
              // Backspace - cursor moves back by 1 (if not at start)
              newCursorPos = Math.max(0, currentPos - 1);
            } else if (e.key === "Delete") {
              // Delete - cursor stays in place
              newCursorPos = currentPos;
            } else if (e.key === "Enter") {
              // Enter - cursor moves forward by 1 (newline)
              newCursorPos = currentPos + 1;
            } else {
              // Other keys (arrows, etc.) - don't mark as user input
              isUserInputRef.current = false;
              return;
            }

            cursorPositionRef.current = newCursorPos;
            isUserInputRef.current = true;
          }}
          onChange={(e) => {
            // Update value
            onBodyChange(e.target.value);
          }}
          onMouseUp={(e) => {
            // Save cursor position after mouse selection
            const textarea = e.currentTarget;
            cursorPositionRef.current = textarea.selectionStart;
            isUserInputRef.current = false; // Mouse click is not typing
          }}
          rows={5}
          maxLength={500}
          placeholder="This is the introduction on your Employee Benefits Hub"
          data-field="bodyText"
          destructive={errorFields.includes("bodyText")}
          className={`transition-all duration-500 ease-in-out origin-center ${isWelcomeBodyHighlighted ? "bg-white ring-2 ring-accent-blue/40 rounded-lg scale-[1.02] shadow-sm dark:bg-gray-800" : ""
            }`}
        />
      </div>
    </div>
  );
}
