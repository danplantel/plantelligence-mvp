"use client";

import React, { useMemo, useState } from "react";

// Preview-specific overrides so child sections expand to fill the wide container
const previewStyles = `
  .preview-portal-container {
    width: 1400px !important;
    max-width: none !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  .preview-portal-container section > div:first-child,
  .preview-portal-container .max-w-4xl,
  .preview-portal-container .max-w-3xl,
  .preview-portal-container .max-w-7xl,
  .preview-portal-container .max-w-5xl,
  .preview-portal-container .max-w-6xl {
    max-width: 100% !important;
    width: 100% !important;
  }
`;

import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import {
    RetirementJourneySection,
    FeaturedJourneyVideo,
    JourneyVideo
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { RetirementDocumentsAccordion } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { getCategoryHeroBackgroundUrl } from "@/lib/portal-category-hero-background";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";

export function BenefitPortalPreview() {
    const { stepData } = useBenefitsWizardStore();
    const step1Data = stepData.step1;
    const step3Data = stepData.step3;
    const step4Data = stepData.step4;

    const category = step1Data?.benefitCategory || "Retirement";

    // Build a clientData-like object for resolving background images (matches retirement/page.tsx)
    const previewClientData = useMemo(() => ({
        secondaryBannerImg: step1Data?.brandImages?.header?.url,
        employeePortalPreview: step1Data?.selectedPlan?.employeePortalPreview,
    }), [step1Data?.brandImages?.header?.url, step1Data?.selectedPlan?.employeePortalPreview]);

    const categoryHeroBg = useMemo(
        () => getCategoryHeroBackgroundUrl(previewClientData as any),
        [previewClientData],
    );

    // Colors from plan data — matches how retirement/page.tsx reads clientData.brandColor / .secondaryColor
    const brandColor = step1Data?.selectedPlan?.brandColor
        || step1Data?.selectedPlan?.brandColors?.primary
        || "#1F3A60";
    const secondaryColor = step1Data?.selectedPlan?.secondaryColor
        || step1Data?.selectedPlan?.brandColors?.secondary
        || "#6B7280";

    // ── FAQ extraction: matches retirement/page.tsx logic ──
    // 1. Check employeePortalPreview.benefits[].faqs (persisted from wizard Step 3)
    // 2. Fall back to step3Data.faqs (wizard-in-progress, not yet persisted)
    // 3. Fall back to DEFAULT_FAQS[category]
    const faqsForCategory = useMemo(() => {
        const benefits = (step1Data?.selectedPlan as any)?.employeePortalPreview?.benefits ?? [];
        const categoryBenefit = benefits.find((b: any) =>
            (b.category || "").toLowerCase() === category.toLowerCase(),
        );
        const persistedFaqs = categoryBenefit?.faqs;
        if (persistedFaqs && Array.isArray(persistedFaqs)) {
            const enabled = persistedFaqs.filter((f: any) => f.enabled !== false) as DynamicFAQItem[];
            if (enabled.length > 0) return enabled;
        }
        // Check wizard-in-progress Step 3 data
        const wizardFaqs = (step3Data?.faqs || [])
            .filter(faq => faq.enabled && faq.question && faq.answer)
            .map(faq => ({
                id: faq.id,
                question: faq.question,
                answer: faq.answer,
                linkLabel: faq.linkLabel || undefined,
                linkHref: faq.linkHref && faq.linkHref !== "#" ? faq.linkHref : undefined,
            })) as DynamicFAQItem[];
        if (wizardFaqs.length > 0) return wizardFaqs;
        // Fall back to defaults
        const defaults = DEFAULT_FAQS[category];
        if (defaults && defaults.length > 0) return defaults as DynamicFAQItem[];
        return undefined;
    }, [step1Data?.selectedPlan, category, step3Data?.faqs]);

    // ── Support contacts extraction: matches retirement/page.tsx logic ──
    const faqContacts = useMemo(() => {
        const rawContacts = Array.isArray(step1Data?.selectedPlan?.keyContacts)
            ? step1Data?.selectedPlan?.keyContacts
            : (step1Data?.selectedPlan as any)?.keyContacts?.contacts || [];
        const benefits = (step1Data?.selectedPlan as any)?.employeePortalPreview?.benefits ?? [];
        const categoryBenefit = benefits.find((b: any) =>
            (b.category || "").toLowerCase() === category.toLowerCase(),
        );
        const rawSupportContacts = categoryBenefit?.supportContacts;
        if (!Array.isArray(rawSupportContacts)) return undefined;
        const enabled = rawSupportContacts.filter((sc: any) => sc.enabled !== false);
        if (enabled.length === 0) return undefined;
        return enabled.map((sc: any) => {
            const matched = rawContacts.find((c: any) => c.id === sc.contactId);
            return {
                id: sc.contactId,
                title: sc.title || matched?.name || `${matched?.firstName ?? ""} ${matched?.lastName ?? ""}`.trim() || "Support Contact",
                description: sc.description || matched?.customRole || matched?.title || "",
                email: matched?.email || "",
                phone: matched?.phone || "",
                phoneExtension: matched?.phoneExtension,
                headshot: matched?.headshot || undefined,
            } as FAQContact;
        });
    }, [step1Data?.selectedPlan, category]);

    // Map documents: Step 4 (wizard) or, when empty, `selectedPlan.documents` from the plan API
    const documents = useMemo(() => {
        const fromStep4 = (step4Data?.documents || []) as any[];
        const planApiDocs = (step1Data?.selectedPlan as any)?.documents;
        const fromPlan = Array.isArray(planApiDocs) && fromStep4.length === 0
            ? planApiDocs
            : [];
        const source = fromStep4.length > 0 ? fromStep4 : fromPlan;

        const targetHub = step1Data?.benefitCategory
            ? resolvePersistedDocumentCategory(
                "Document",
                step1Data.benefitCategory,
            )
            : "Retirement";

        return source
            .filter(
                (doc: any) =>
                    resolvePersistedDocumentCategory(
                        doc.type || "Document",
                        doc.category,
                        doc.storageKey,
                    ) === targetHub,
            )
            .map((doc: any) => ({
                id: String(doc.id ?? doc.name),
                title:
                    doc.name || doc.title || doc.originalFileName || "Document",
                description: doc.shortDescription || "Plan document",
                href:
                    doc.id && /^[0-9a-fA-F]{24}$/.test(String(doc.id))
                        ? `/api/documents/${doc.id}/view`
                        : "#",
                language: normalizePortalDocumentLanguage(doc.language, "EN"),
            }));
    }, [
        step4Data?.documents,
        step1Data?.selectedPlan,
        step1Data?.benefitCategory,
    ]);


    // Mock videos for retirement preview
    const featuredVideo: FeaturedJourneyVideo = {
        id: "preview-featured",
        title: "Your Retirement Journey Starts Here",
        description: "Preview of the featured retirement video.",
        thumbnail: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80",
        duration: "8:30",
        rating: "4.9",
        category: "Getting Started",
        embedUrl: "https://www.youtube.com/embed/ysz5S6PUM-U?rel=0",
    };

    const mockVideos: JourneyVideo[] = [
        { id: "v1", title: "Charting Your Course", thumbnail: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&q=80", duration: "18:30", tag: "New" },
        { id: "v2", title: "Market Volatility", thumbnail: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80", duration: "15:20" },
    ];

    const [hoveredSection, setHoveredSection] = useState<string | null>(null);

    const handleEdit = (sectionId: string, fieldId?: string) => {
        window.dispatchEvent(new CustomEvent("openBenefitsEditor", {
            detail: { sectionId, fieldId }
        }));
    };

    const EditPencil = () => (
        <div className="absolute -top-2 -left-2 z-20 bg-[#3b82f6] rounded-full p-1.5 shadow-lg border border-white/20">
            <Pencil className="w-3 h-3 text-white" strokeWidth={2.5} />
        </div>
    );

    return (
        <div className="min-h-screen bg-black overflow-x-auto rounded-xl border border-white/10 shadow-2xl relative w-full preview-portal-container">
            <style>{previewStyles}</style>
            <main>
                <div
                    className={cn(
                        "relative cursor-pointer transition-all duration-200 rounded-lg m-1",
                        hoveredSection === "branding" ? "ring-4 ring-blue-500/50" : "hover:ring-4 hover:ring-blue-500/50"
                    )}
                    onMouseEnter={() => setHoveredSection("branding")}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={() => handleEdit("branding")}
                >
                    {hoveredSection === "branding" && <EditPencil />}
                    <PortalWelcomeBanner
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                        category={category}
                        customHeadline={step1Data?.benefitTitle || `Welcome to your ${category} benefits!`}
                        customDescription={step1Data?.shortDescription || "Explore your comprehensive benefits package."}
                        customImage={step1Data?.companyLogo?.url}
                        clientData={{
                            companyName: step1Data?.selectedPlan?.companyName || "Your Company",
                            // Top-left: use the plan-level Company Logo (not the Step 1 Benefits Logo)
                            companyLogo: typeof step1Data?.selectedPlan?.companyLogo === 'object'
                                ? (step1Data?.selectedPlan?.companyLogo as any)?.url
                                : step1Data?.selectedPlan?.companyLogo,
                            secondaryBannerImg: step1Data?.brandImages?.header?.url,
                        } as any}
                    />
                </div>

                <div className="relative group">
                    <RetirementJourneySection
                        brandColor={brandColor}
                        featuredVideo={featuredVideo}
                        retirementVideos={mockVideos}
                        planningVideos={mockVideos}
                        onVideoClick={() => { }}
                        onFeaturedVideoClick={() => { }}
                        backgroundImage={categoryHeroBg}
                    />
                </div>

                <div className="relative group">
                    <HowCanWeHelpSection
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                        clientId={step1Data?.planId}
                        cards={step1Data?.helpCards}
                    />
                </div>

                <div
                    className={cn(
                        "relative cursor-pointer transition-all duration-200 rounded-lg m-1",
                        hoveredSection === "faqs" ? "ring-4 ring-blue-500/50" : "hover:ring-4 hover:ring-blue-500/50"
                    )}
                    onMouseEnter={() => setHoveredSection("faqs")}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={() => handleEdit("faqs")}
                >
                    {hoveredSection === "faqs" && <EditPencil />}
                    <FAQSection
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                        faqs={faqsForCategory}
                        contacts={faqContacts}
                    />
                </div>

                <PortalMaterialsHero brandColor={brandColor} />

                <div className="relative group">
                    {/* Documents section */}
                    <RetirementDocumentsAccordion
                        brandColor={brandColor}
                        accentColor={secondaryColor}
                        retirementDocs={documents}
                        title={`${category} Documents & Forms`}
                        description={`Access all your important ${category.toLowerCase()} plan documents and forms.`}
                    />
                </div>
            </main>
        </div>
    );
}
