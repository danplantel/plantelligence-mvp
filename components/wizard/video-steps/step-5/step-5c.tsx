"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVideoWizardStore } from "@/lib/video-wizard-store";
import { ensurePlanTelligenceTrademark } from "@/lib/disclaimer-constants";

const MAX_DISCLAIMER_LINES = 25;

const DEFAULT_DISCLAIMER_LINES = [
  "This content is for general educational purposes only and does not constitute ERISA, tax, legal, or investment advice.",
  "Individuals seeking advice tailored to their personal financial situation should obtain such services separately, outside the scope of this educational presentation.",
  "While the material has been compiled from sources believed to be reliable, accuracy is not guaranteed. For comprehensive information about your retirement plan, please refer to your Summary Plan Description.",
  "This video was developed by Waypoint Financial Advisors in collaboration with your employer. Securities and advisory services are offered through LPL Financial, a registered investment advisor, Member FINRA/SIPC.",
  "Waypoint Financial Advisors is a separate entity from LPL Financial. Some portions of this content were created for general informational use and may not be affiliated with any specific representative, broker-dealer, or registered investment advisor.",
  "Powered by PlanTelligence® | Branded Benefits Technology",
];

function normalizeDisclaimers(input: unknown): string[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .map((line) => (typeof line === "string" ? line.trim() : ""))
      .filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (typeof input === "object") {
    const obj = input as Record<string, string | undefined>;
    const keys = [
      "disclaimer",
      ...Array.from({ length: MAX_DISCLAIMER_LINES }, (_, index) => {
        return `disclaimer_line${index + 1}`;
      }),
    ];

    return keys.map((key) => (obj[key] || "").trim()).filter(Boolean);
  }

  return [];
}

export function VideoStep5c() {
  const { stepData, saveStepDataLocally } = useVideoWizardStore();
  const savedStep5c = (stepData as any).step5c || {};
  const selectedPlan =
    stepData.selectedPlan || (stepData as any).step1?.selectedPlan;

  const savedDisclaimerLines = normalizeDisclaimers(
    savedStep5c.disclaimer ?? savedStep5c.disclaimers,
  );

  const onboardingStepDisclaimers = normalizeDisclaimers(
    (stepData as any).disclaimers?.disclaimers,
  );

  const planDisclaimers = useMemo(() => {
    if (!selectedPlan) return [];

    const fromArray = normalizeDisclaimers(selectedPlan.disclaimers);
    if (fromArray.length > 0) {
      return fromArray;
    }

    return normalizeDisclaimers(selectedPlan.disclaimer);
  }, [selectedPlan]);

  const defaultDisclaimers =
    savedDisclaimerLines.length > 0
      ? savedDisclaimerLines
      : onboardingStepDisclaimers.length > 0
      ? onboardingStepDisclaimers
      : planDisclaimers.length > 0
      ? planDisclaimers
      : DEFAULT_DISCLAIMER_LINES;

  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [draftText, setDraftText] = useState(
    (savedStep5c.disclaimer as string) ||
      (defaultDisclaimers.length > 0 ? defaultDisclaimers.join("\n") : ""),
  );

  useEffect(() => {
    if (mode === "preview") {
      setDraftText(
        (savedStep5c.disclaimer as string) ||
          (defaultDisclaimers.length > 0 ? defaultDisclaimers.join("\n") : ""),
      );
    }
  }, [mode, savedStep5c.disclaimer, defaultDisclaimers]);

  const previewLines = useMemo(() => {
    const normalized = normalizeDisclaimers(
      savedStep5c.disclaimer ?? defaultDisclaimers,
    );
    return normalized;
  }, [savedStep5c.disclaimer, defaultDisclaimers]);

  const handleSave = useCallback(() => {
    saveStepDataLocally("step5c", {
      disclaimer: draftText,
      disclaimers: normalizeDisclaimers(draftText),
    });
    setMode("preview");
  }, [draftText, saveStepDataLocally]);

  const handleCancel = useCallback(() => {
    setDraftText(
      (savedStep5c.disclaimer as string) ||
        (defaultDisclaimers.length > 0 ? defaultDisclaimers.join("\n") : ""),
    );
    setMode("preview");
  }, [savedStep5c.disclaimer, defaultDisclaimers]);

  return (
    <Card className="flex flex-col items-center text-center gap-8 p-8">
      <CardTitle className="text-3xl font-semibold text-gray-900 dark:text-white">
        Disclaimer
      </CardTitle>

      {mode === "preview" ? (
        <>
          <CardContent className="flex flex-col gap-4 max-w-3xl text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            {previewLines.length > 0 ? (
              previewLines.map((line, index) => (
                <p key={index} className="text-center">
                  {line}
                </p>
              ))
            ) : (
              <p className="text-center text-gray-400">
                No disclaimer text available for this plan.
              </p>
            )}
          </CardContent>
          <Button
            variant="outline"
            type="button"
            onClick={() => setMode("edit")}
          >
            Edit Disclaimer
          </Button>
        </>
      ) : (
        <CardContent className="w-full max-w-3xl space-y-4 text-left">
          <Textarea
            className="min-h-[280px]"
            value={draftText}
            onChange={(event) =>
              setDraftText(ensurePlanTelligenceTrademark(event.target.value))
            }
            placeholder="Enter disclaimer text..."
          />
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" type="button" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
