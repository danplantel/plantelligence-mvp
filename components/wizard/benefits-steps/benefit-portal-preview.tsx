"use client";

import React, { useMemo, useState, useEffect } from "react";

// Preview-specific overrides so child sections expand to fill the wide container.
// Preserve PortalWelcomeBanner inner content width (max-w-7xl).
const previewStyles = `
  .preview-portal-container {
    width: 100% !important;
    max-width: none !important;
  }
  .preview-portal-container section {
    width: 100% !important;
    max-width: 100% !important;
  }
  .preview-portal-container .max-w-4xl,
  .preview-portal-container .max-w-7xl,
  .preview-portal-container .max-w-5xl,
  .preview-portal-container .max-w-6xl {
    max-width: 100% !important;
    width: 100% !important;
  }
  /* FAQ section — restore benefits hub width (max-w-3xl = 48rem) */
  .preview-portal-container section.py-20.bg-white > .max-w-3xl {
    max-width: 48rem !important;
    width: 100% !important;
  }
`;

import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import {
    RetirementJourneySection,
} from "@/components/pages/client-portal/sections/retirement-journey-section";
import { HowCanWeHelpSection } from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { PortalMaterialsHero } from "@/components/pages/client-portal/sections/portal-materials-hero";
import { RetirementDocumentsAccordion } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { FAQSection, DynamicFAQItem, FAQContact } from "@/components/faq-section";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { getCategoryHeroBackgroundUrl, DEFAULT_WELCOME_BG } from "@/lib/portal-category-hero-background";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { DEFAULT_HELP_CARDS } from "./benefits-editor-panel";

export function BenefitPortalPreview({ mobile, brandColor: brandColorOverride, secondaryColor: secondaryColorOverride }: { mobile?: boolean; brandColor?: string; secondaryColor?: string }) {
    const { stepData } = useBenefitsWizardStore();
    const [userName, setUserName] = useState<string | null>(null);
    const [userDesignations, setUserDesignations] = useState<string[]>([]);
    const [userPrimaryCategories, setUserPrimaryCategories] = useState<string[]>([]);
    useEffect(() => {
        let cancelled = false;
        fetch("/api/profile", { credentials: "same-origin" })
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                setUserName((data as any)?.name || (data as any)?.user?.name || null);
                setUserDesignations(
                    Array.isArray((data as any)?.designations)
                        ? (data as any).designations
                        : ((data as any)?.user?.designations || []),
                );
                setUserPrimaryCategories(
                    Array.isArray((data as any)?.primaryServiceCategories)
                        ? (data as any).primaryServiceCategories
                        : [],
                );
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);
    const step1Data = stepData.step1;
    const step3Data = stepData.step3;
    const step4Data = stepData.step4;

    const category = step1Data?.benefitCategory || "Retirement";

    // Whether the current benefit category is one of the advisor's primary service categories.
    // Gates User.designations so they only show for categories the user actually serves.
    const isCategoryPrimary = useMemo(() => {
        const cat = category === "Custom" ? "Company / Plan Sponsor" : category;
        const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");
        return userPrimaryCategories.some(
            (pc) =>
                norm(String(pc)) === norm(cat) ||
                (norm(String(pc)) === "other" && norm(cat) === "company / plan sponsor"),
        );
    }, [category, userPrimaryCategories]);

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
    const brandColor = brandColorOverride
        || step1Data?.selectedPlan?.brandColor
        || step1Data?.selectedPlan?.primaryColor
        || "#1F3A60";
    const secondaryColor = secondaryColorOverride
        || step1Data?.selectedPlan?.secondaryColor
        || "#6B7280";

    // ── Resolve per-category benefit from the `Benefit` table (source of truth) ──
    // Used for FAQs, planVideo, supportContacts, etc. We intentionally do NOT fall back to the
    // stale legacy employeePortalPreview.benefits JSON, which survives Benefit-row deletion and
    // would otherwise resurface the last benefit the user created.
    const categoryBenefit = useMemo(() => {
        const byCategory = step1Data?.categoryBenefitByApi;
        if (!byCategory) return undefined;
        const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");
        const apiCat = category === "Custom" ? "Company / Plan Sponsor" : category;
        return byCategory[norm(apiCat)] ?? undefined;
    }, [step1Data?.categoryBenefitByApi, category]);

    // ── Plan Video: wizard-in-progress first, then persisted (unless explicitly removed), then localStorage fallback ──
    // R2 keys are stored raw; preview uses the admin-authenticated /api/r2/object endpoint
    const planVideoUrl = useMemo(() => {
        // Wizard-in-progress takes priority; only fall back to persisted categoryBenefit.planVideo if not explicitly removed
        const rawValue = step1Data?.planVideo
            || (!step1Data?.planVideoRemoved && categoryBenefit?.planVideo);
        if (!rawValue) return undefined;
        // If it's already a full URL (e.g. presigned), use directly
        if (rawValue.startsWith("http") || rawValue.startsWith("/api/")) return rawValue;
        // Raw R2 key — construct admin URL (preview user is authenticated)
        return `/api/r2/object?key=${encodeURIComponent(rawValue)}`;
    }, [categoryBenefit, step1Data?.planVideo, step1Data?.planVideoRemoved]);

    // ── FAQ extraction: matches retirement/page.tsx logic ──
    // 1. Check employeePortalPreview.benefits[].faqs (persisted from wizard Step 3)
    // 2. Fall back to step3Data.faqs (wizard-in-progress, not yet persisted)
    // 3. Fall back to DEFAULT_FAQS[category]
    const faqsForCategory = useMemo(() => {
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
    }, [categoryBenefit, step3Data?.faqs, category]);

    // ── Support contacts extraction: matches retirement/page.tsx logic ──
    // 1. Check employeePortalPreview.benefits[].supportContacts (persisted from wizard Step 3)
    // 2. Fall back to step3Data.supportContacts (wizard-in-progress, not yet persisted)
    const faqContacts = useMemo(() => {
        const rawContacts = Array.isArray(step1Data?.selectedPlan?.keyContacts)
            ? step1Data?.selectedPlan?.keyContacts
            : (step1Data?.selectedPlan as any)?.keyContacts?.contacts || [];

        const mapContacts = (list: any[]) => list
            .filter((sc: any) => sc.enabled !== false)
            .map((sc: any) => {
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

        // Persisted support contacts take priority (matches how the live portal resolves them)
        const persisted = mapContacts(
            Array.isArray(categoryBenefit?.supportContacts)
                ? categoryBenefit.supportContacts
                : [],
        );
        if (persisted.length > 0) return persisted;
        // Fall back to wizard-in-progress Step 3 selections
        const wizardRaw = step3Data?.supportContacts;
        const wizardContacts = mapContacts(
            Array.isArray(wizardRaw) ? wizardRaw : [],
        );
        if (wizardContacts.length === 0) return undefined;
        return wizardContacts;
    }, [step1Data?.selectedPlan, categoryBenefit, step3Data?.supportContacts]);

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


    // Per-category default image shown when no plan video is uploaded
    const categoryDefaultImage = useMemo(() => {
        const map: Record<string, string> = {
            Retirement: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&q=80",
            "Group Health": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
            "Group Life": "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&q=80",
            "Company / Plan Sponsor": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1600&q=80",
        };
        return map[category] || map["Retirement"];
    }, [category]);


    const [hoveredSection, setHoveredSection] = useState<string | null>(null);

    const handleEdit = (sectionId: string, fieldId?: string) => {
        window.dispatchEvent(new CustomEvent("openBenefitsEditor", {
            detail: { sectionId, fieldId }
        }));
    };

    // ── Scroll the preview to a field when its editor input is focused ──
    useEffect(() => {
        // Fields whose editor input maps to a section-level preview element
        const sectionFallback: Record<string, string> = {
            benefitTitle: "messaging",
            shortDescription: "messaging",
            signatureMode: "messaging",
            customClosing: "messaging",
            customSignatureName: "messaging",
            customSignatureCompany: "messaging",
            companyLogo: "messaging",
            brandImagesHeader: "messaging",
            innerHeaderImage: "messaging",
            insuranceBackgroundImage: "insurance",
            insuranceContainerBlockOpacity: "insurance",
            insurancePlanId: "insurance",
            insuranceLoginUrl: "insurance",
            helpCards: "helpCards",
            journeyHeader: "journeyHeader",
            journeySubtitle: "journeySubtitle",
            journeyBodyText: "journeyBodyText",
            planVideo: "planVideo",
            planVideoFileName: "planVideo",
        };

        const handlePreviewScroll = (e: Event) => {
            const field = (e as CustomEvent<{ field?: string }>).detail?.field;
            if (!field) return;
            const selector = sectionFallback[field] || field;
            const container =
                document.querySelector("[data-preview-scroll-container]");
            if (!container) return;

            // Queue scroll via rAF so it executes after any pending React re-renders
            // (e.g., from the editor input's onChange auto-formatting).
            requestAnimationFrame(() => {
                // Insurance is the last section — simply scroll to the bottom.
                if (selector === "insurance") {
                    const maxScroll =
                        (container as HTMLElement).scrollHeight -
                        (container as HTMLElement).clientHeight;
                    (container as HTMLElement).scrollTo({
                        top: Math.max(0, maxScroll),
                        behavior: "smooth",
                    });
                    return;
                }

                const el = document.querySelector(
                    `[data-preview-field="${selector}"]`,
                );
                if (el) {
                    const elRect = el.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const elCenter = elRect.top + elRect.height / 2;
                    const containerCenter =
                        containerRect.top + container.clientHeight / 2;
                    const delta = elCenter - containerCenter;
                    const maxScroll =
                        (container as HTMLElement).scrollHeight -
                        (container as HTMLElement).clientHeight;
                    const targetScroll = Math.min(
                        Math.max(
                            0,
                            (container as HTMLElement).scrollTop + delta,
                        ),
                        maxScroll,
                    );
                    (container as HTMLElement).scrollTo({
                        top: targetScroll,
                        behavior: "smooth",
                    });
                }
            });
        };
        window.addEventListener("benefitsPreviewScrollTo", handlePreviewScroll);
        return () => {
            window.removeEventListener("benefitsPreviewScrollTo", handlePreviewScroll);
        };
    }, []);

    const EditPencil = () => (
        <div className="absolute -top-2 -left-2 z-20 bg-[#3b82f6] rounded-full p-1.5 shadow-lg border border-white/20">
            <Pencil className="w-3 h-3 text-white" strokeWidth={2.5} />
        </div>
    );

    return (
        <div
            className="min-h-screen bg-black overflow-x-hidden relative w-full preview-portal-container"
        >
            {/* Preview CSS overrides */}
            {!mobile && <style>{previewStyles}</style>}
            {/* Mobile mode: force framer-motion animated elements visible
                (useInView / IntersectionObserver may not fire inside the iframe) */}
            {mobile && (
                <style>{`
                    .force-visible [style*="opacity: 0"] {
                        opacity: 1 !important;
                        transform: translateY(0) !important;
                    }
                `}</style>
            )}
            <main>
                <div className="relative" data-preview-field="messaging">
                    <PortalWelcomeBanner
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                        category={category}
                        customHeadline={step1Data?.benefitTitle || `Welcome to your ${category} benefits!`}
                        customDescription={step1Data?.shortDescription || "Explore your comprehensive benefits package."}
                        customImage={step1Data?.companyLogo?.url}
                        customInnerHeaderImage={step1Data?.innerHeaderImage?.url}
                        backgroundOpacity={step1Data?.heroBackgroundOpacity ?? 1.0}
                        containerBlockOpacity={step1Data?.heroContainerBlockOpacity ?? 0.67}
                        containerInverted={step1Data?.heroContainerInverted ?? false}
                        backgroundInverted={step1Data?.heroBackgroundInverted ?? false}
                        useGradient={step1Data?.heroUseGradient ?? false}
                        clientData={{
                            companyName: step1Data?.selectedPlan?.companyName || "Your Company",
                            // Top-left: use the Provider Logo from the editor panel (Step 2), fall back to plan-level
                            companyLogo: step1Data?.companyLogo?.url
                                || (typeof step1Data?.selectedPlan?.companyLogo === 'object'
                                    ? (step1Data?.selectedPlan?.companyLogo as any)?.url
                                    : step1Data?.selectedPlan?.companyLogo),
                            // Priority: Editor Panel upload → plan-level hero background → plan-level backgroundImg → default
                            backgroundImg: step1Data?.brandImages?.header?.url
                                || (step1Data as any)?.heroBackgroundImage
                                || (step1Data?.selectedPlan as any)?.backgroundImg
                                || DEFAULT_WELCOME_BG,
                            secondaryBannerImg: step1Data?.brandImages?.header?.url,
                        } as any}
                        customDesignations={isCategoryPrimary ? userDesignations : []}
                        customClosing={step1Data?.signatureMode === "custom" ? (step1Data.customClosing || "Custom closing message") : undefined}
                        customSignature={
                            step1Data?.signatureMode === "custom"
                                ? (step1Data.customSignatureName || "Your Name, Your Title")
                                : (userName || undefined)
                        }
                        customSignatureCompany={
                            step1Data?.signatureMode === "custom"
                                ? (step1Data.customSignatureCompany || "Your Company")
                                : undefined
                        }
                        // Closing & Signature style flags (per-line bold/italic)
                        customClosingBold={step1Data?.customClosingBold ?? true}
                        customClosingItalic={step1Data?.customClosingItalic ?? false}
                        customSignatureNameBold={step1Data?.customSignatureNameBold ?? false}
                        customSignatureNameItalic={step1Data?.customSignatureNameItalic ?? false}
                        customSignatureCompanyBold={step1Data?.customSignatureCompanyBold ?? false}
                        customSignatureCompanyItalic={step1Data?.customSignatureCompanyItalic ?? true}
                        onTitleClick={() => handleEdit("messaging", "benefitTitle")}
                        onDescriptionClick={() => handleEdit("messaging", "shortDescription")}
                        desktopHeroBackgroundPosition={(step1Data as any)?.desktopHeroBackgroundPosition}
                        mobileHeroBackgroundPosition={(step1Data as any)?.mobileHeroBackgroundPosition}
                    />
                </div>

                <div className={mobile ? "force-visible relative" : "relative"}>
                <RetirementJourneySection
                    brandColor={brandColor}
                    mainTitle={step1Data?.journeyHeader || (() => { const map: Record<string, string> = { Retirement: "Your Retirement Journey Starts Here", "Group Health": "Your Health Benefits Journey Starts Here", "Group Life": "Your Life Insurance Journey Starts Here", "Company / Plan Sponsor": "Whole-Person Wellness Programs" }; return map[category] || map["Retirement"]; })()}
                    subtitle={step1Data?.journeySubtitle || (() => { const map: Record<string, string> = { Retirement: "Build your future with confidence.", "Group Health": "Your health, your way.", "Group Life": "Protecting what matters most.", "Company / Plan Sponsor": "Thrive in every aspect of life." }; return map[category] || map["Retirement"]; })()}
                    description={step1Data?.journeyBodyText || (() => { const map: Record<string, string> = { Retirement: "Take control of your financial future with our comprehensive retirement planning resources.", "Group Health": "Explore your health benefits and find the coverage that fits your needs.", "Group Life": "Understand your life insurance options and secure peace of mind for your loved ones.", "Company / Plan Sponsor": "Discover wellness programs designed to support your overall well-being." }; return map[category] || map["Retirement"]; })()}
                    planVideoUrl={planVideoUrl}
                    planVideoFallbackImage={categoryDefaultImage}
                    onMainTitleClick={() => handleEdit("planVideo")}
                    onSubtitleClick={() => handleEdit("planVideo")}
                    onDescriptionClick={() => handleEdit("planVideo")}
                    onVideoClick={() => handleEdit("planVideo")}
                />
                </div>

                <div className={mobile ? "force-visible relative" : "relative"} data-preview-field="helpCards">
                    <HowCanWeHelpSection
                        brandColor={brandColor}
                        secondaryColor={secondaryColor}
                        clientId={step1Data?.planId}
                        cards={step1Data?.helpCards?.length ? step1Data.helpCards : DEFAULT_HELP_CARDS}
                        onCardEdit={(cardId) => handleEdit("helpCards", cardId)}
                    />
                </div>

                <div
                    className="relative group cursor-pointer"
                    data-preview-field="insurance"
                    onClick={() => handleEdit("insurance")}
                    onMouseEnter={() => setHoveredSection("insurance")}
                    onMouseLeave={() => setHoveredSection(null)}
                >
                    {hoveredSection === "insurance" && <EditPencil />}
                    <PortalMaterialsHero
                        brandColor={brandColor}
                        category={category}
                        cardHeading={
                            category === "Retirement" ? "Retirement Plan Account Access" :
                            category === "Group Health" ? "Group Health Insurance Account Access" :
                            category === "Group Life" ? "Group Life Insurance Account Access" :
                            category === "Company / Plan Sponsor" ? "Wellness Program Account Access" :
                            "Insurance Benefits Account Access"
                        }
                        backgroundImage={step1Data?.insuranceBackgroundImage || undefined}
                        containerBlockOpacity={step1Data?.insuranceContainerBlockOpacity ?? 0.8}
                        planIdLabel={step1Data?.insurancePlanId ? `PLAN ID: ${step1Data.insurancePlanId}` : "PLAN ID: [Not Set]"}
                        buttonLabel="REGISTER OR LOGIN HERE"
                        onPlanIdClick={() => handleEdit("insurance", "planId")}
                    />
                </div>
            </main>
        </div>
    );
}
