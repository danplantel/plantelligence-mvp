"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { BenefitsEditorPanel } from "@/components/wizard/benefits-steps/benefits-editor-panel";
import { BenefitEditPreview } from "@/components/wizard/benefits-steps/benefit-edit-preview";

/**
 * Tabs for the Edit Benefit page. Each surfaces sections that live in different
 * Create Benefit wizard steps, so a benefit can be edited without walking the
 * wizard.
 */
const EDIT_TABS = [
  { id: "branding", label: "Branding" },
  { id: "contacts", label: "Contacts" },
  { id: "faqs", label: "FAQs" },
  { id: "documents", label: "Documents" },
  { id: "disclaimers", label: "Disclaimers" },
] as const;

type EditTabId = (typeof EDIT_TABS)[number]["id"];

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

  const step1Data = useBenefitsWizardStore((s) => s.stepData.step1);
  const selectedPlan = step1Data?.selectedPlan as any;
  const companyName = selectedPlan?.companyName || "";
  const companyWebsite = selectedPlan?.companyWebsite || "";

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

  return (
    <div className="flex-1 py-4 pb-28">
      <div className="mx-auto max-w-[1500px] px-4">
        <div className="mb-4 flex items-center justify-between gap-4">
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
          <Button onClick={handleSave} disabled={saving || !isHydrated} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
          </Button>
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
            <TabsList className="sticky top-16 z-30 mb-4 flex h-auto flex-nowrap justify-start gap-1 overflow-x-auto rounded-none border-b bg-background p-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
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

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
              {/* Left column: the active tab's editor */}
              <div className="min-w-0">
                {/* Step 1 owns the benefit pre-fill effects. Keep exactly one
                    instance mounted: hidden while any other tab is active,
                    visible on the Contacts tab. */}
                {activeTab !== "contacts" && (
                  <div className="hidden" aria-hidden="true">
                    <BenefitsStep1 mode="edit" />
                  </div>
                )}

                <TabsContent value="branding" className="mt-0">
                  <div className="h-[calc(100vh-16rem)] min-h-[640px] overflow-hidden rounded-xl border dark:border-gray-700">
                    <BenefitsEditorPanel
                      isOpen
                      isAnimating
                      onClose={() => {}}
                      variant="inline"
                      planCompanyName={companyName}
                      companyWebsite={companyWebsite}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="contacts" className="mt-0 space-y-6">
                  <BenefitsStep1 mode="edit" />
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
              </div>

              {/* Right column: persistent live preview */}
              <aside className="hidden xl:block">
                <div className="sticky top-20 h-[calc(100vh-9rem)]">
                  <BenefitEditPreview />
                </div>
              </aside>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}
