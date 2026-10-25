"use client";

import React, { useMemo, useState, useEffect } from "react";

// The preview is a scaled render of the real portal, so the sections keep their
// own live max-widths. Anything that stretched them to the 1400px canvas made the
// preview wider than the Benefit Hub pages it is meant to represent.
const previewStyles = `
  .preview-portal-container {
    width: 100% !important;
    max-width: none !important;
  }
`;

/** Copy the four live hub pages use for their document band. */
const DOCUMENT_SECTION_COPY: Record<
  string,
  { title: string; description: string; accordionHeaderTitle?: string }
> = {
  Retirement: {
    title: "Retirement Plan Documents & Forms",
    description:
      "Access all your important retirement plan documents, forms, and notices in one convenient location.",
  },
  "Group Health": {
    title: "Health Plan Documents & Forms",
    description:
      "Access all your important health plan documents, forms, and notices in one convenient location.",
    accordionHeaderTitle: "Health Plan Documents",
  },
  "Group Life": {
    title: "Life Insurance Documents & Forms",
    description:
      "Access all your important life insurance plan documents, forms, and notices in one convenient location.",
    accordionHeaderTitle: "Life Insurance Documents",
  },
  "Company / Plan Sponsor": {
    title: "Wellness Program Documents & Forms",
    description:
      "Access all your important wellness program documents, forms, and notices in one convenient location.",
    accordionHeaderTitle: "Wellness Program Documents",
  },
};

import { useBenefitsWizardStore } from "@/lib/benefits-wizard-store";
import { webinarPlacementForCategory } from "@/lib/webinar-placements";
import { PortalWelcomeBanner } from "@/components/pages/client-portal/sections/portal-welcome-banner";
import { BenefitsVideoSection } from "@/components/pages/client-portal/sections/benefits-video-section";
import {
  HowCanWeHelpSection,
  formatPlanGroupIdLabel,
  ACCOUNT_ACCESS_CARD_ID,
} from "@/components/pages/client-portal/sections/how-can-we-help-section";
import { BenefitDocumentSection } from "@/components/pages/client-portal/sections/benefit-document-section";
import { HaveQuestions } from "@/components/pages/client-portal/sections/have-questions";
import {
  FAQSection,
  DynamicFAQItem,
  FAQContact,
} from "@/components/faq-section";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import {
  getCategoryHeroBackgroundUrl,
  DEFAULT_WELCOME_BG,
} from "@/lib/portal-category-hero-background";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import { fetchProfileOnce } from "@/lib/fetch-profile";

export function BenefitPortalPreview({
  mobile,
  brandColor: brandColorOverride,
  secondaryColor: secondaryColorOverride,
}: {
  mobile?: boolean;
  brandColor?: string;
  secondaryColor?: string;
}) {
  const { stepData } = useBenefitsWizardStore();
  const [userName, setUserName] = useState<string | null>(null);
  const [userDesignations, setUserDesignations] = useState<string[]>([]);
  const [userPrimaryCategories, setUserPrimaryCategories] = useState<string[]>(
    [],
  );
  const [userOrganizationName, setUserOrganizationName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    // Single-flight + TTL (lib/fetch-profile): the wizard page and Step 1 already
    // fetched the profile, so reuse that result. This component is mounted twice
    // (desktop + mobile), so a raw fetch here meant two extra full GET /api/profile
    // requests — each up to ~2.7 MB because User images are stored inline.
    fetchProfileOnce()
      .then((data) => {
        if (cancelled) return;
        setUserName((data as any)?.name || (data as any)?.user?.name || null);
        setUserDesignations(
          Array.isArray((data as any)?.designations)
            ? (data as any).designations
            : (data as any)?.user?.designations || [],
        );
        setUserPrimaryCategories(
          Array.isArray((data as any)?.primaryServiceCategories)
            ? (data as any).primaryServiceCategories
            : [],
        );
        setUserOrganizationName(
          (data as any)?.organizationName ||
            (data as any)?.user?.organizationName ||
            "",
        );
        setUserEmail((data as any)?.email || (data as any)?.user?.email || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const step1Data = stepData.step1;
  const step3Data = stepData.step3;
  const step4Data = stepData.step4;

  const category = step1Data?.benefitCategory || "Retirement";
  // "Custom" is the legacy deep-link spelling of the hub whose stored label is
  // "Company / Plan Sponsor" — the live pages use the latter.
  const canonicalCategory =
    category === "Custom" ? "Company / Plan Sponsor" : category;

  // Whether the current benefit category is one of the advisor's primary service categories.
  // Gates User.designations so they only show for categories the user actually serves.
  const isCategoryPrimary = useMemo(() => {
    const cat = category === "Custom" ? "Company / Plan Sponsor" : category;
    const norm = (s: string) =>
      (s || "").toLowerCase().trim().replace(/\s+/g, " ");
    return userPrimaryCategories.some(
      (pc) =>
        norm(String(pc)) === norm(cat) ||
        (norm(String(pc)) === "other" &&
          norm(cat) === "company / plan sponsor"),
    );
  }, [category, userPrimaryCategories]);

  // Build a clientData-like object for resolving background images (matches retirement/page.tsx).
  // The live editor settings (heroBackgroundOpacity etc.) are overlaid onto the plan's
  // employeePortalPreview so the Background Opacity slider takes effect immediately in the
  // preview instead of being shadowed by stale persisted plan data.
  const previewClientData = useMemo(
    () => ({
      secondaryBannerImg: step1Data?.brandImages?.header?.url,
      employeePortalPreview: {
        ...(step1Data?.selectedPlan?.employeePortalPreview || {}),
        heroBackgroundOpacity: step1Data?.heroBackgroundOpacity,
        heroContainerBlockOpacity: step1Data?.heroContainerBlockOpacity,
        heroContainerInverted: step1Data?.heroContainerInverted,
        heroBackgroundInverted: step1Data?.heroBackgroundInverted,
        heroUseGradient: step1Data?.heroUseGradient,
      },
    }),
    [
      step1Data?.brandImages?.header?.url,
      step1Data?.selectedPlan?.employeePortalPreview,
      step1Data?.heroBackgroundOpacity,
      step1Data?.heroContainerBlockOpacity,
      step1Data?.heroContainerInverted,
      step1Data?.heroBackgroundInverted,
      step1Data?.heroUseGradient,
    ],
  );

  const categoryHeroBg = useMemo(
    () => getCategoryHeroBackgroundUrl(previewClientData as any),
    [previewClientData],
  );

  // Colors from plan data — matches how retirement/page.tsx reads clientData.brandColor / .secondaryColor
  const brandColor =
    brandColorOverride ||
    step1Data?.selectedPlan?.brandColor ||
    step1Data?.selectedPlan?.primaryColor ||
    "#1F3A60";
  // The plan's own logo — what a Company / Plan Sponsor card shows.
  const planCompanyLogoUrl =
    step1Data?.companyLogo?.url ||
    (typeof (step1Data?.selectedPlan as any)?.companyLogo === "object"
      ? (step1Data?.selectedPlan as any)?.companyLogo?.url
      : (step1Data?.selectedPlan as any)?.companyLogo) ||
    "";

  const secondaryColor =
    secondaryColorOverride ||
    step1Data?.selectedPlan?.secondaryColor ||
    "#6B7280";

  // ── Resolve per-category benefit from the `Benefit` table (source of truth) ──
  // Used for FAQs, planVideo, supportContacts, etc. We intentionally do NOT fall back to the
  // stale legacy employeePortalPreview.benefits JSON, which survives Benefit-row deletion and
  // would otherwise resurface the last benefit the user created.
  const categoryBenefit = useMemo(() => {
    const byCategory = step1Data?.categoryBenefitByApi;
    if (!byCategory) return undefined;
    const norm = (s: string) =>
      (s || "").toLowerCase().trim().replace(/\s+/g, " ");
    const apiCat = category === "Custom" ? "Company / Plan Sponsor" : category;
    return byCategory[norm(apiCat)] ?? undefined;
  }, [step1Data?.categoryBenefitByApi, category]);

  // The welcome banner's circular portrait is the key contact's headshot. Pass the
  // advisor's explicit Step 1 selection when there is one, so the preview shows the
  // same person the published portal will feature for this benefit.
  const previewKeyContacts = useMemo(() => {
    const raw = (step1Data?.selectedPlan as any)?.keyContacts;
    const contacts: any[] = Array.isArray(raw) ? raw : raw?.contacts || [];
    const contactId = step1Data?.contactId;
    if (!contactId) return contacts;
    const selected = contacts.filter((contact) => contact?.id === contactId);
    return selected.length > 0 ? selected : contacts;
  }, [step1Data?.selectedPlan, step1Data?.contactId]);

  // ── Plan Video: wizard-in-progress first, then persisted (unless explicitly removed), then localStorage fallback ──
  // R2 keys are stored raw; preview uses the admin-authenticated /api/r2/object endpoint
  const planVideoUrl = useMemo(() => {
    // Wizard-in-progress takes priority; only fall back to persisted categoryBenefit.planVideo if not explicitly removed
    const rawValue =
      step1Data?.planVideo ||
      (!step1Data?.planVideoRemoved && categoryBenefit?.planVideo);
    if (!rawValue) return undefined;
    // If it's already a full URL (e.g. presigned), use directly
    if (rawValue.startsWith("http") || rawValue.startsWith("/api/"))
      return rawValue;
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
      const enabled = persistedFaqs.filter(
        (f: any) => f.enabled !== false,
      ) as DynamicFAQItem[];
      if (enabled.length > 0) return enabled;
    }
    // Check wizard-in-progress Step 3 data
    const wizardFaqs = (step3Data?.faqs || [])
      .filter((faq) => faq.enabled && faq.question && faq.answer)
      .map((faq) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        linkLabel: faq.linkLabel || undefined,
        linkHref:
          faq.linkHref && faq.linkHref !== "#" ? faq.linkHref : undefined,
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

    const mapContacts = (list: any[]) =>
      list
        .filter((sc: any) => sc.enabled !== false)
        .map((sc: any) => {
          const matched = rawContacts.find((c: any) => c.id === sc.contactId);
          const personName =
            sc.title ||
            matched?.name ||
            `${matched?.firstName ?? ""} ${matched?.lastName ?? ""}`.trim() ||
            "Support Contact";
          return {
            id: sc.contactId,
            // The card shows the name and, under it, the role — the same split
            // `buildFaqSupportContacts` produces for the live hubs.
            name: personName,
            title: personName,
            // The person's role, matching My Benefits Team — the per-benefit
            // blurb is only a fallback.
            description:
              matched?.customRole || matched?.title || sc.description || "",
            email: matched?.email || "",
            phone: matched?.phone || "",
            phoneExtension: matched?.phoneExtension,
            headshot: matched?.headshot || undefined,
            // Same affordances as the live hub cards: a booking link, the company
            // that owns the card, and the outbound URL.
            schedulingUrl: matched?.schedulingUrl || undefined,
            companyName: matched?.companyName || undefined,
            companyLogo: matched?.companyLogo || undefined,
            websiteUrl: matched?.websiteUrl || undefined,
            // The CTA the advisor configured — passed through, never inferred.
            enableContactButton: matched?.enableContactButton,
            contactButtonType: matched?.contactButtonType,
            // Which categories the person serves, so the plan-sponsor card can
            // borrow the plan's logo exactly as it does on the live hub.
            benefitsCategories: matched?.benefitsCategories || undefined,
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
    const fromPlan =
      Array.isArray(planApiDocs) && fromStep4.length === 0 ? planApiDocs : [];
    const source = fromStep4.length > 0 ? fromStep4 : fromPlan;

    const targetHub = step1Data?.benefitCategory
      ? resolvePersistedDocumentCategory("Document", step1Data.benefitCategory)
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
        title: doc.name || doc.title || doc.originalFileName || "Document",
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

  // The live hub's document band and webinar placement for this category.
  const documentSectionCopy =
    DOCUMENT_SECTION_COPY[canonicalCategory] ||
    DOCUMENT_SECTION_COPY.Retirement;
  // Same mapping the hub pages hard-code in their props, from one helper.
  const webinarPlacement = canonicalCategory
    ? webinarPlacementForCategory(canonicalCategory)
    : "retirement";

  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  const handleEdit = (sectionId: string, fieldId?: string) => {
    window.dispatchEvent(
      new CustomEvent("openBenefitsEditor", {
        detail: { sectionId, fieldId },
      }),
    );
  };

  // ── Scroll the preview to a field when its editor input is focused ──
  useEffect(() => {
    // Fields whose editor input maps to a section-level preview element. The three
    // account-access fields are edited on the wide Account Access card inside the
    // help section, so they target that card itself rather than the whole section.
    const sectionFallback: Record<string, string> = {
      benefitTitle: "messaging",
      shortDescription: "messaging",
      signatureMode: "messaging",
      customClosing: "messaging",
      customSignatureName: "messaging",
      customSignatureCompany: "messaging",
      companyLogo: "messaging",
      brandImagesHeader: "messaging",
      insurancePlanId: ACCOUNT_ACCESS_CARD_ID,
      insuranceLoginUrl: ACCOUNT_ACCESS_CARD_ID,
      providerContact: ACCOUNT_ACCESS_CARD_ID,
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

      // Queue scroll via rAF so it executes after any pending React re-renders
      // (e.g., from the editor input's onChange auto-formatting).
      requestAnimationFrame(() => {
        // The Account Access card is a marker INSIDE the help section, so it is
        // looked up by its card id rather than by a section field marker.
        const el =
          selector === ACCOUNT_ACCESS_CARD_ID
            ? document.querySelector(
                `[data-help-card="${ACCOUNT_ACCESS_CARD_ID}"]`,
              )
            : document.querySelector(
                `[data-preview-field="${selector}"]`,
              );
        if (!el) return;

        // Resolve the scroll container FROM the element. The Edit page mounts two
        // previews (desktop + phone frame), so the first container in the document
        // is not necessarily the one holding this element — measuring against the
        // wrong viewport produced a huge delta that clamped to its end, which is
        // what made these fields appear to "jump to the bottom".
        const container =
          (el.closest(
            "[data-preview-scroll-container]",
          ) as HTMLElement | null) ??
          (document.querySelector(
            "[data-preview-scroll-container]",
          ) as HTMLElement | null);
        if (!container) return;

        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const elCenter = elRect.top + elRect.height / 2;
        const containerCenter = containerRect.top + container.clientHeight / 2;
        const delta = elCenter - containerCenter;
        const maxScroll = container.scrollHeight - container.clientHeight;
        const targetScroll = Math.min(
          Math.max(0, container.scrollTop + delta),
          maxScroll,
        );
        container.scrollTo({ top: targetScroll, behavior: "smooth" });
      });
    };
    window.addEventListener("benefitsPreviewScrollTo", handlePreviewScroll);
    return () => {
      window.removeEventListener(
        "benefitsPreviewScrollTo",
        handlePreviewScroll,
      );
    };
  }, []);

  const EditPencil = () => (
    <div className="absolute -top-2 -left-2 z-20 bg-[#3b82f6] rounded-full p-1.5 shadow-lg border border-white/20">
      <Pencil className="w-3 h-3 text-white" strokeWidth={2.5} />
    </div>
  );

  return (
    <div className="min-h-screen bg-black overflow-x-hidden relative w-full preview-portal-container">
      {/* Preview CSS overrides */}
      {!mobile && <style>{previewStyles}</style>}
      {/* Mobile mode: force framer-motion animated elements visible
                (useInView / IntersectionObserver may not fire inside the iframe) */}
      {mobile && (
        <style>{`
                    /* The help section's caret is positioned by its own transform, so
                       it must be skipped or it snaps to the corner un-rotated. */
                    .force-visible [style*="opacity: 0"]:not([data-help-caret]) {
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
            customHeadline={
              step1Data?.benefitTitle || `Welcome to your ${category} benefits!`
            }
            customDescription={
              step1Data?.shortDescription ||
              "Explore your comprehensive benefits package."
            }
            customImage={step1Data?.companyLogo?.url}
            backgroundOpacity={step1Data?.heroBackgroundOpacity ?? 1.0}
            containerBlockOpacity={step1Data?.heroContainerBlockOpacity ?? 0.67}
            containerInverted={step1Data?.heroContainerInverted ?? false}
            backgroundInverted={step1Data?.heroBackgroundInverted ?? false}
            useGradient={step1Data?.heroUseGradient ?? false}
            clientData={
              {
                companyName:
                  step1Data?.selectedPlan?.companyName || "Your Company",
                // Drives the banner's key-contact portrait (headshot).
                keyContacts: previewKeyContacts,
                // The portrait chosen in Step 2's Branding section wins; empty
                // leaves the key contact headshot in place.
                heroPortraitImage:
                  step1Data?.heroPortraitImage ||
                  (step1Data?.selectedPlan as any)?.heroPortraitImage ||
                  "",
                // Top-left: use the Provider Logo from the editor panel (Step 2), fall back to plan-level
                companyLogo:
                  step1Data?.companyLogo?.url ||
                  (typeof step1Data?.selectedPlan?.companyLogo === "object"
                    ? (step1Data?.selectedPlan?.companyLogo as any)?.url
                    : step1Data?.selectedPlan?.companyLogo),
                // Priority: Editor Panel upload → plan-level hero background → plan-level backgroundImg → default
                backgroundImg:
                  step1Data?.brandImages?.header?.url ||
                  (step1Data as any)?.heroBackgroundImage ||
                  (step1Data?.selectedPlan as any)?.backgroundImg ||
                  DEFAULT_WELCOME_BG,
                secondaryBannerImg: step1Data?.brandImages?.header?.url,
              } as any
            }
            profile={{
              name: userName ?? undefined,
              designations: userDesignations,
              organizationName: userOrganizationName,
              email: userEmail,
            }}
            customDesignations={isCategoryPrimary ? userDesignations : []}
            customClosing={
              step1Data?.signatureMode === "custom"
                ? step1Data.customClosing || "Custom closing message"
                : undefined
            }
            customSignature={
              step1Data?.signatureMode === "custom"
                ? step1Data.customSignatureName || "Your Name, Your Title"
                : userName || undefined
            }
            customSignatureCompany={
              step1Data?.signatureMode === "custom"
                ? step1Data.customSignatureCompany || "Your Company"
                : undefined
            }
            // Closing & Signature style flags (per-line bold/italic)
            customClosingBold={step1Data?.customClosingBold ?? true}
            customClosingItalic={step1Data?.customClosingItalic ?? false}
            customSignatureNameBold={
              step1Data?.customSignatureNameBold ?? false
            }
            customSignatureNameItalic={
              step1Data?.customSignatureNameItalic ?? false
            }
            customSignatureCompanyBold={
              step1Data?.customSignatureCompanyBold ?? false
            }
            customSignatureCompanyItalic={
              step1Data?.customSignatureCompanyItalic ?? true
            }
            onTitleClick={() => handleEdit("messaging", "benefitTitle")}
            onDescriptionClick={() =>
              handleEdit("messaging", "shortDescription")
            }
            desktopHeroBackgroundPosition={
              (step1Data as any)?.desktopHeroBackgroundPosition
            }
            mobileHeroBackgroundPosition={
              (step1Data as any)?.mobileHeroBackgroundPosition
            }
          />
        </div>

        {/* Section order mirrors the live Benefit Hub pages:
            Video → How Can We Help → Webinars → FAQs → Documents → Have Questions. */}

        {/* Mirrors the live hub: "Show on page" off removes the whole section. */}
        {step1Data?.planVideoVisible !== false && (
        <div className={mobile ? "force-visible relative" : "relative"}>
          <BenefitsVideoSection
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            keyContacts={previewKeyContacts}
            category={category}
            // Omitted → the section fills in its per-category default headline and
            // subhead, the same strings the live hub shows.
            mainTitle={step1Data?.journeyHeader || undefined}
            subtitle={step1Data?.journeySubtitle || undefined}
            description={
              step1Data?.journeyBodyText ||
              (() => {
                const map: Record<string, string> = {
                  Retirement:
                    "Take control of your financial future with our comprehensive retirement planning resources.",
                  "Group Health":
                    "Explore your health benefits and find the coverage that fits your needs.",
                  "Group Life":
                    "Understand your life insurance options and secure peace of mind for your loved ones.",
                  "Company / Plan Sponsor":
                    "Discover wellness programs designed to support your overall well-being.",
                };
                return map[category] || map["Retirement"];
              })()
            }
            planVideoUrl={planVideoUrl}
            // The plan's own no-video image; the section fills in the category's
            // stock image when this is empty (lib/benefits-video-fallback.ts).
            planVideoFallbackImage={step1Data?.planVideoFallbackImage}
            videoLabel={step1Data?.planVideoLabel}
            videoThumbnail={
              step1Data?.planVideoThumbnail?.startsWith("data:") ||
              step1Data?.planVideoThumbnail?.startsWith("http")
                ? step1Data.planVideoThumbnail
                : step1Data?.planVideoThumbnail
                ? `/api/r2/object?key=${encodeURIComponent(
                    step1Data.planVideoThumbnail,
                  )}`
                : undefined
            }
            onMainTitleClick={() => handleEdit("planVideo")}
            onSubtitleClick={() => handleEdit("planVideo")}
            onDescriptionClick={() => handleEdit("planVideo")}
            onVideoClick={() => handleEdit("planVideo")}
            // Videos published to this page from Communications → Webinars, as the
            // closing rail of this section — exactly where the live hub puts them.
            webinarsPlacement={webinarPlacement}
            clientId={step1Data?.planId}
          />
        </div>
        )}

        {/* Hover shows the blue edit pencil and a click opens the Editing Panel at
            this section — the same affordance every other preview section offers. */}
        <div
          className={cn(
            mobile ? "force-visible relative" : "relative",
            "group cursor-pointer",
          )}
          data-preview-field="helpCards"
          onClick={(event) => {
            const target = event.target as HTMLElement;
            // Links and buttons (the login CTA, a panel's close button) act on
            // their own.
            if (target.closest("a, button")) return;
            const card = target.closest("[data-help-card]");
            // Topic tiles report themselves through `onCardEdit`; the Account
            // Access card has no panel of its own, so clicking it edits the
            // section its fields live in.
            if (
              card &&
              card.getAttribute("data-help-card") !== ACCOUNT_ACCESS_CARD_ID
            ) {
              return;
            }
            handleEdit("helpCards");
          }}
          onMouseEnter={() => setHoveredSection("helpCards")}
          onMouseLeave={() => setHoveredSection(null)}
        >
          {hoveredSection === "helpCards" && <EditPencil />}
          <HowCanWeHelpSection
            brandColor={brandColor}
            secondaryColor={secondaryColor}
            clientId={step1Data?.planId}
            // Fills `[Benefit Category]` in the default copy, so the preview reads
            // exactly like the live hub ("Retirement Account Access").
            category={step1Data?.benefitCategory || undefined}
            // The Account Access card's own fields — the ones the editor panel edits.
            accountAccessHref={step1Data?.insuranceLoginUrl || undefined}
            planIdLabel={
              formatPlanGroupIdLabel(step1Data?.insurancePlanId) || undefined
            }
            provider={step1Data?.providerContact ?? null}
            // Undefined lets the section use its own default topics — the same set
            // the live hub falls back to, so the preview cannot drift from the portal.
            cards={
              step1Data?.helpCards?.length ? step1Data.helpCards : undefined
            }
            onCardEdit={(cardId) => handleEdit("helpCards", cardId)}
          />
        </div>

        <FAQSection
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          faqs={faqsForCategory}
          contacts={faqContacts}
        />

        {/* The account-access band is the Account Access card in "How Can We
            Help You Today?" — there is no separate Access & Materials section. */}
        <BenefitDocumentSection
          brandColor={brandColor}
          accentColor={secondaryColor}
          retirementDocs={documents}
          title={documentSectionCopy.title}
          description={documentSectionCopy.description}
          accordionHeaderTitle={documentSectionCopy.accordionHeaderTitle}
          // The rows are already scoped to the category being edited, so the
          // category badge would only repeat it (same reason as the Branding tab).
          hideCategoryBadge
        />

        <HaveQuestions
          brandColor={brandColor}
          secondaryColor={secondaryColor}
          contacts={faqContacts}
          companyLogo={planCompanyLogoUrl}
        />
      </main>
    </div>
  );
}
