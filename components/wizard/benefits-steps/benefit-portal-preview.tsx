"use client";

import React, { useMemo, useState } from "react";
import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import {
    RetirementJourneySection,
    FeaturedJourneyVideo,
    JourneyVideo
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { BenefitsFAQAccordion } from "@/components/pages/client-portal/sections/benefits-faq-accordion";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { RetirementDocumentsAccordion } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { HaveQuestionsSection, ContactInfo } from "@/components/pages/client-portal/sections/have-questions-section";
import { Phone, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";

export function BenefitPortalPreview() {
    const { stepData } = useBenefitsWizardStore();
    const step1Data = stepData.step1;
    const step3Data = stepData.step3;
    const step4Data = stepData.step4;

    const category = step1Data?.benefitCategory || "Retirement";
    const isRetirement = category === "Retirement";

    // Colors mapping (using defaults or from context if we had it, but store might have it eventually)
    // For now, use sensible defaults that match the portal's base style
    const brandColor = "#1F3A60";
    const secondaryColor = "#C89B5B";

    // Map contacts from Step 3
    const contacts = useMemo(() => {
        const enabledContacts = step3Data?.supportContacts?.filter(sc => sc.enabled) || [];
        if (enabledContacts.length === 0) return undefined;

        // In a real scenario, we'd fetch the full contact object, but for preview 
        // we can try to find them in the selectedPlan's contacts if available
        const allContacts = step1Data?.selectedPlan?.keyContacts || [];
        const contactsList = Array.isArray(allContacts) ? allContacts : (allContacts.contacts || []);

        return enabledContacts.map(sc => {
            const fullContact = contactsList.find((c: any) => c.id === sc.contactId);
            return {
                id: sc.contactId,
                title: fullContact?.name || `${fullContact?.firstName} ${fullContact?.lastName}` || sc.title,
                description: sc.description || fullContact?.title || "Support Representative",
                icon: Phone,
                email: fullContact?.email,
                phone: fullContact?.phone,
                iconType: fullContact?.headshot ? "image" : undefined,
                iconSrc: fullContact?.headshot,
                iconAlt: fullContact?.name
            } as ContactInfo;
        });
    }, [step3Data?.supportContacts, step1Data?.selectedPlan]);

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

    // Map FAQs from Step 3
    const faqs = useMemo(() => {
        return (step3Data?.faqs || [])
            .filter(faq => faq.enabled && faq.question && faq.answer)
            .map(faq => ({
                id: faq.id,
                question: faq.question,
                answer: faq.answer,
                linkLabel: faq.linkLabel || "Learn More",
                linkHref: faq.linkHref || "#",
            }));
    }, [step3Data?.faqs]);

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
        <div className="min-h-screen bg-black overflow-hidden rounded-xl border border-white/10 shadow-2xl relative">
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
                            companyLogo: step1Data?.companyLogo?.url,
                            secondaryBannerImg: step1Data?.brandImages?.header?.url,
                        } as any}
                    />
                </div>

                {isRetirement && (
                    <div className="relative group">
                        {/* Retirement journey doesn't have a specific editor yet */}
                        <RetirementJourneySection
                            brandColor={brandColor}
                            featuredVideo={featuredVideo}
                            retirementVideos={mockVideos}
                            planningVideos={mockVideos}
                            onVideoClick={() => { }}
                            onFeaturedVideoClick={() => { }}
                        />
                    </div>
                )}

                <div className="relative group">
                    <HowCanWeHelpSection
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                        clientId={step1Data?.planId}
                    />
                </div>

                {faqs.length > 0 && (
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
                        <BenefitsFAQAccordion
                            items={faqs}
                            brandColor={brandColor}
                            accentColor={secondaryColor}
                        />
                    </div>
                )}

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

                <div
                    className={cn(
                        "relative cursor-pointer transition-all duration-200 rounded-lg m-1 mb-8",
                        hoveredSection === "messaging" ? "ring-4 ring-blue-500/50" : "hover:ring-4 hover:ring-blue-500/50"
                    )}
                    onMouseEnter={() => setHoveredSection("messaging")}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={() => handleEdit("messaging")}
                >
                    {hoveredSection === "messaging" && <EditPencil />}
                    <HaveQuestionsSection
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                        contacts={contacts}
                        cardWidth="390px"
                    />
                </div>
            </main>
        </div>
    );
}
