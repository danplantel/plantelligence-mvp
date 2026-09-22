"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { PortalHeader } from "@/components/pages/client-portal/sections/portal-header";
import { BenefitPortalPreview } from "./benefit-portal-preview";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";

/** Reference widths the portal content is laid out at, then visually scaled to fit. */
const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 390;

/**
 * Persistent live portal preview shown beside the Edit Benefit tabs. Reuses the
 * Create Benefit Step 2 preview (`BenefitPortalPreview` + `PortalHeader`) so
 * edits in any tab are reflected immediately, and scales the fixed-width canvas
 * down to the available column width.
 */
export function BenefitEditPreview() {
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  const step1Data = useBenefitsWizardStore((s) => s.stepData.step1);
  const selectedPlan = step1Data?.selectedPlan as any;

  const brandColor =
    selectedPlan?.brandColor || selectedPlan?.brandColors?.primary || "#1F3A60";
  const secondaryColor =
    selectedPlan?.secondaryColor || selectedPlan?.brandColors?.secondary || "#6B7280";
  const planCompanyLogo = step1Data?.companyLogo?.url || "";

  const referenceWidth = mode === "desktop" ? DESKTOP_WIDTH : MOBILE_WIDTH;

  // Scale the fixed-width canvas to the column width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(Math.min(1, width / referenceWidth));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [referenceWidth]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-3 py-2 dark:border-gray-700">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Live Preview
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("desktop")}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
              mode === "desktop"
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            title="Desktop preview"
            aria-label="Desktop preview"
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMode("mobile")}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
              mode === "mobile"
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            title="Mobile preview"
            aria-label="Mobile preview"
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-gray-200 dark:bg-gray-950"
      >
        {/* `zoom` (rather than transform: scale) keeps the layout box in sync, so
            the scroll area's height reflects the scaled content. */}
        <div
          style={
            {
              width: `${referenceWidth}px`,
              zoom: scale,
            } as CSSProperties
          }
        >
          <div className="sticky top-0 z-10 shadow-md">
            <PortalHeader
              companyData={{ companyLogo: planCompanyLogo }}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              clientId={step1Data?.planId}
              categoryPortalVisibility={step1Data?.benefitVisibility ?? null}
              benefits={selectedPlan?.employeePortalPreview?.benefits ?? null}
              enableNavigation={false}
            />
          </div>
          <BenefitPortalPreview
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            mobile={mode === "mobile"}
          />
        </div>
      </div>
    </div>
  );
}
