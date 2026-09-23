"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { saveBenefit } from "@/lib/save-benefit";
import { persistPlanSelection } from "@/lib/plan-selector-storage";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import {
  BenefitsStep1,
  BenefitsStep3,
  BenefitsStep4,
  BenefitsStep5,
} from "@/components/wizard/benefits-steps";
import { EditBenefitPreviewSection } from "@/components/pages/benefits/edit-benefit-preview-section";

/**
 * Edit Benefit tabs — mirrors the Edit Plan page (`/edit-client/[id]`): the tab
 * bar renders inside the fixed header.
 *
 * - **Branding** renders Step 1's accordions exactly as the wizard does
 *   (Benefit Logo, Messaging, Key Contact, Documents).
 * - **Preview** renders [`EditBenefitPreviewSection`](components/pages/benefits/edit-benefit-preview-section.tsx)
 *   — the live portal preview beside an inline Editing Panel (typography,
 *   branding, messaging, plan video, help cards, insurance). Like Edit Plan's
 *   Preview tab, the in-page header is hidden there; Cancel + Save Changes live
 *   in the fixed bottom action bar (which owns Save on every tab) and the preview
 *   shrinks while the panel is open.
 */
const EDIT_TABS = [
  { id: "branding", label: "Branding" },
  { id: "preview", label: "Preview" },
  { id: "contacts", label: "Contacts" },
  { id: "faqs", label: "FAQs" },
  { id: "documents", label: "Documents" },
  { id: "disclaimers", label: "Disclaimers" },
] as const;

type EditTabId = (typeof EDIT_TABS)[number]["id"];

/** Tabs that mount their own instance of Step 1. */
const STEP1_TABS: EditTabId[] = ["branding", "contacts"];

interface BenefitEditPageProps {
  planId: string;
  category: string;
}

export function BenefitEditPage({ planId, category }: BenefitEditPageProps) {
  const router = useRouter();
  const { setTitle, setSubtitle } = usePageTitleContext();
  const [activeTab, setActiveTab] = useState<EditTabId>("branding");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  // Portal target for the tab bar — the Header renders <div id="header-tabs-portal" />
  // and we portal the TabsList into it so it appears inside the fixed header while
  // staying within the <Tabs> React context (same pattern as Edit Plan).
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(
    null,
  );

  const step1Data = useBenefitsWizardStore((s) => s.stepData.step1);
  const selectedPlan = step1Data?.selectedPlan as any;
  const companyName = selectedPlan?.companyName || "";

  useEffect(() => {
    setHeaderPortalTarget(document.getElementById("header-tabs-portal"));
  }, []);

  // Load the persisted draft, then point Step 1 at this plan + category so its
  // pre-fill effects populate the store for every tab.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useBenefitsWizardStore.persist.rehydrate();
      if (cancelled) return;
      const current = useBenefitsWizardStore.getState().stepData.step1 || {
        planId: "",
        benefitCategory: "",
        contactId: "",
        benefitTitle: "",
      };
      useBenefitsWizardStore.getState().saveStepData(1, {
        ...current,
        planId,
        benefitCategory: category,
        benefitTitle: current.benefitTitle || category,
      });
      persistPlanSelection("benefits", planId);
      setIsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, category]);

  useEffect(() => {
    setTitle("Edit Benefit");
  }, [setTitle]);

  useEffect(() => {
    setSubtitle(
      companyName ? `${companyName} - ${category || ""}`.replace(/ - $/, "") : "",
    );
    return () => setSubtitle("");
  }, [companyName, category, setSubtitle]);

  // Deep link may target a tab, e.g. "/edit-benefit/<planId>/<category>?tab=documents".
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && EDIT_TABS.some((t) => t.id === requested)) {
      setActiveTab(requested as EditTabId);
    }
  }, []);

  // True while the Preview tab's inline Editing Panel is open
  // (`EditBenefitPreviewSection` dispatches `step5EditorStateChange`). Mirrors
  // Edit Client's `planEditorOpen`: used to offset the fixed bottom action bar so
  // its buttons clear the rail-collapsed sidebar *and* the panel.
  const [previewEditorOpen, setPreviewEditorOpen] = useState(false);
  useEffect(() => {
    const handler = (e: any) => setPreviewEditorOpen(!!e?.detail?.isOpen);
    window.addEventListener("step5EditorStateChange" as any, handler);
    return () =>
      window.removeEventListener("step5EditorStateChange" as any, handler);
  }, []);

  /**
   * Persist every section using the shared `saveBenefit()` helper (identical
   * merge logic to the Create Benefit wizard). Per-field autosave from the step
   * components keeps the draft current in between.
   */
  const handleSave = async () => {
    const stepData = useBenefitsWizardStore.getState().stepData;
    if (!stepData.step1?.planId) {
      toast.error("Plan ID missing. Cannot save benefit.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveBenefit(stepData);
      if (!result.success) throw new Error(result.error || "Failed to save benefit");
      setSaved(true);
      toast.success("Benefit saved successfully!");
      setTimeout(() => setSaved(false), 2500);
    } catch (error: any) {
      console.error("Benefit save error:", error);
      toast.error("Cannot save benefit:", {
        description: error.message,
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const tabList = (
    // `border-0` kills the shared TabsList border so the nav has no outline,
    // and `bg-transparent dark:bg-transparent` overrides the base TabsList
    // background so the nav element stays fully transparent.
    <TabsList
      className={cn(
        "w-full gap-1 rounded-none border-0 bg-transparent dark:bg-transparent p-0 flex-nowrap h-auto min-h-fit overflow-x-auto",
        "justify-center [&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
      )}
    >
      {EDIT_TABS.map((tab) => (
        <TabsTrigger
          key={tab.id}
          value={tab.id}
          className="rounded-none px-4 py-3 text-sm font-medium whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-accent-blue data-[state=active]:font-bold data-[state=active]:text-accent-blue"
        >
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );

  return (
    <div className="flex-1 pb-24 pt-4">
      <div className="mx-auto max-w-4xl px-4">
        {/* In-page header — hidden on the Preview tab, exactly like Edit Plan
            hides its EditClientHeader there: the preview is a full-bleed fixed
            layout, and Save lives in the fixed bottom action bar on every tab. */}
        <div
          className={cn(
            "mb-4 flex items-center justify-between gap-4",
            activeTab === "preview" && "hidden",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/benefits")}
              title="Back to Benefits"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">Edit Benefit</h1>
              <p className="truncate text-sm text-muted-foreground">
                {[companyName, category].filter(Boolean).join(" - ") ||
                  "Editing benefit"}
              </p>
            </div>
          </div>
          {/* No Save button here — the fixed bottom action bar owns Save on every
              tab (see the bar at the end of this component). */}
        </div>

        {!isHydrated ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading benefit...
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as EditTabId)}
          >
            {/* Tab bar renders inside the fixed header via portal; falls back to
                an inline bar if the header portal isn't mounted. */}
            {headerPortalTarget
              ? createPortal(tabList, headerPortalTarget)
              : tabList}

            {/* Step 1 owns the benefit pre-fill effects. Tabs that don't render
                it themselves keep one hidden instance mounted so every tab has
                the same populated state (the Preview tab included — its preview
                reads the same store data). */}
            {!STEP1_TABS.includes(activeTab) && (
              <div className="hidden" aria-hidden="true">
                <BenefitsStep1 mode="edit" />
              </div>
            )}

            {/* Branding — the wizard's Step 1 accordions, unchanged. */}
            <TabsContent value="branding" className="mt-0">
              <BenefitsStep1 mode="edit" />
            </TabsContent>

            {/* Preview — live portal preview + inline Editing Panel, scaled down
                while the panel is open (mirrors Edit Plan's Preview tab). */}
            <TabsContent value="preview" className="mt-0">
              {/* Save lives in the fixed bottom action bar, not the toolbar. */}
              <EditBenefitPreviewSection />
            </TabsContent>

            <TabsContent value="contacts" className="mt-0 space-y-6">
              <BenefitsStep1 mode="edit" sections={["contacts"]} />
              <BenefitsStep3 section="contacts" />
            </TabsContent>

            <TabsContent value="faqs" className="mt-0">
              <BenefitsStep3 section="faqs" />
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <BenefitsStep4 />
            </TabsContent>

            <TabsContent value="disclaimers" className="mt-0">
              <BenefitsStep5 />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Fixed bottom action bar — mirrors Edit Client's bar (`/edit-client/[id]`):
          Cancel leaves the editor, Save Changes persists every section. With the
          Preview tab's inline Editing Panel open the bar shifts right past the
          rail-collapsed sidebar *and* the panel, exactly like Edit Client. */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg">
        <div
          className={cn(
            "px-4 py-4 flex justify-end gap-3 transition-all duration-200",
            // Default: center the actions in the same max-width column the page
            // content uses (this page's column is `max-w-4xl`). While the Editing
            // Panel is open, align them to the right of the bar instead.
            !previewEditorOpen && "mx-auto max-w-4xl",
          )}
          style={
            previewEditorOpen
              ? {
                  marginLeft:
                    "calc(var(--sidebar-width, 16rem) + var(--editor-inset, 0px))",
                }
              : undefined
          }
        >
          <Button
            variant="outline"
            onClick={() => router.push("/benefits")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !isHydrated}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
