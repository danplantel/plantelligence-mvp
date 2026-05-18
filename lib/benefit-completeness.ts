import { BenefitsCategory } from "@/types/new-client-wizard";
import { resolvePersistedDocumentCategory } from "@/lib/document-category";

/** Map card titles, slugs, and variants to wizard `BenefitsCategory` for checks vs contacts/docs. */
const CATEGORY_ALIASES: Record<string, BenefitsCategory> = {
  retirement: "Retirement",
  "retirement plan benefits": "Retirement",
  "group health": "Group Health",
  "health insurance": "Group Health",
  "group life": "Group Life",
  "life insurance": "Group Life",
  /** Benefits wizard Step 1 card id; portal rows often use `Other Benefits`. */
  custom: "Other Benefits",
  "custom benefit": "Other Benefits",
  "other benefits": "Other Benefits",
  "company / plan sponsor": "Company / Plan Sponsor",
  "wellness programs": "Company / Plan Sponsor",
  wellness: "Company / Plan Sponsor",
  "recordkeeper / vendor": "Recordkeeper / Vendor",
};

const KNOWN_CATEGORIES: BenefitsCategory[] = [
  "Retirement",
  "Group Health",
  "Group Life",
  "Other Benefits",
  "Company / Plan Sponsor",
  "Recordkeeper / Vendor",
];

/**
 * Hub cards often use display titles (e.g. "Retirement Plan Benefits") while contacts use
 * `BenefitsCategory` ("Retirement"). Normalize so completeness does not false-flag missing data.
 */
export function normalizeBenefitsCategoryForCompleteness(
  raw: string | null | undefined,
): BenefitsCategory {
  const s = (raw || "").trim();
  if (!s) return s as BenefitsCategory;
  const lower = s.toLowerCase().replace(/\s+/g, " ");
  const alias = CATEGORY_ALIASES[lower];
  if (alias) return alias;
  const direct = KNOWN_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (direct) return direct;
  return s as BenefitsCategory;
}

function getBenefitsArrayFromPortalPreview(clientData: any): any[] {
  const ep = clientData?.employeePortalPreview;
  if (!ep || typeof ep !== "object") return [];
  const previewData =
    ep.previewData && typeof ep.previewData === "object" ? ep.previewData : null;
  const nested = Array.isArray(previewData?.benefits)
    ? previewData!.benefits
    : [];
  const root = Array.isArray((ep as { benefits?: unknown }).benefits)
    ? (ep as { benefits: any[] }).benefits
    : [];
  if (nested.length > 0) return nested;
  return root;
}

/**
 * Merge top-level + nested `companyData` (Client portal / Step 5) so
 * getBenefitCompleteness sees the same plan fields as the benefits wizard
 * (full merged `basePlan` in step-1a).
 */
function mergeCompanyDataForCompleteness(clientData: any): any {
  if (clientData == null || typeof clientData !== "object")
    return clientData;
  const c = (clientData as { companyData?: any }).companyData;
  if (!c || typeof c !== "object") return clientData;

  const str = (a: unknown, b: unknown) => {
    const s = (v: unknown) =>
      typeof v === "string" ? v.trim() : "";
    const A = s(a);
    if (A) return A;
    return s(b);
  };

  return {
    ...clientData,
    companyLogo: str(clientData.companyLogo, c.companyLogo),
    missionBody: str(clientData.missionBody, c.missionBody),
    heroDescription: str(clientData.heroDescription, c.heroDescription),
    backgroundImg: str(clientData.backgroundImg, c.backgroundImg),
    secondaryBannerImg: str(
      (clientData as { secondaryBannerImg?: string }).secondaryBannerImg,
      (c as { secondaryBannerImg?: string }).secondaryBannerImg,
    ),
  };
}

function isPresentAssetUrl(url: string | null | undefined): boolean {
  if (url == null || typeof url !== "string") return false;
  const u = url.trim();
  if (!u) return false;
  if (u.includes("placeholder")) return false;
  return true;
}

/** Plan-level company logo from wizard step 1 (string or { url }). */
function planCompanyLogoFromClient(clientData: any): string {
  const v = clientData?.companyLogo;
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v && typeof v === "object" && typeof v.url === "string" && v.url.trim()) {
    return v.url.trim();
  }
  return "";
}

/**
 * Step 5 “Partner logo” is stored on the key contact’s `companyLogo`, not always on `benefit.partnerLogo`.
 */
function categoryContactCompanyLogo(
  contacts: any[],
  canonical: BenefitsCategory,
): string {
  for (const c of contacts) {
    const single = normalizeBenefitsCategoryForCompleteness(
      c.benefitsCategory || "",
    );
    if (single === canonical && isPresentAssetUrl(c.companyLogo)) {
      return String(c.companyLogo).trim();
    }
    const cats = (c.benefitsCategories || []).map((s: string) =>
      normalizeBenefitsCategoryForCompleteness(String(s)),
    );
    if (
      cats.includes(canonical) &&
      isPresentAssetUrl(c.companyLogo)
    ) {
      return String(c.companyLogo).trim();
    }
  }
  return "";
}

export interface BenefitCompleteness {
    isComplete: boolean;
    missingInfo: string[];
    sections: {
        branding: boolean;
        messaging: boolean;
        contacts: boolean;
        documents: boolean;
    };
}

export function getBenefitCompleteness(
    category: BenefitsCategory,
    clientData: any
): BenefitCompleteness {
    const missingInfo: string[] = [];

    const ctx = mergeCompanyDataForCompleteness(clientData);
    const canonical = normalizeBenefitsCategoryForCompleteness(
        category as unknown as string,
    );

    // Diagnostic log
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.group(`[Completeness Check] ${category} → ${canonical}`);
        console.log("Client Data:", ctx);
        console.groupEnd();
    }

    const benefits = getBenefitsArrayFromPortalPreview(ctx);
    const actualBenefit = benefits.find((b: any) => {
        const bKey = normalizeBenefitsCategoryForCompleteness(
            String(b?.category ?? b?.title ?? ""),
        );
        return bKey === canonical;
    });

    // Fallback to category name as title if not explicitly set, 
    // matching the wizard's default behavior and avoiding validation "jumps".
    const configuredBenefit = actualBenefit || {
        category: canonical,
        title: canonical,
    };

    const contacts = Array.isArray(ctx?.keyContacts)
        ? ctx.keyContacts
        : ctx?.keyContacts?.contacts || [];

    // SECTION 1: BRANDING — align with Step 5: partner logo often lives on key contact + plan logo; header with plan/category hero
    const logoFromBenefitCard = isPresentAssetUrl(configuredBenefit?.partnerLogo);
    const logoFromContact = isPresentAssetUrl(
        categoryContactCompanyLogo(contacts, canonical),
    );
    const logoFromPlan = isPresentAssetUrl(planCompanyLogoFromClient(ctx));
    const hasLogo = logoFromBenefitCard || logoFromContact || logoFromPlan;

    // Require the **benefit card** header image (not only plan/hero) so the hub card cannot look
    // "complete" in the wizard while the card still shows a broken/empty top image.
    const hasBenefitCardHeaderImage = isPresentAssetUrl(configuredBenefit?.image);
    const hasImage = hasBenefitCardHeaderImage;

    const brandingComplete = hasLogo && hasImage;

    if (!hasLogo) missingInfo.push("Provider logo missing");
    if (!hasImage) missingInfo.push("Benefit card header image missing");

    // SECTION 2: MESSAGING — Only this benefit’s copy counts (not plan mission/hero), so “Create
    // benefits” does not mark messaging complete when the card text is still empty.
    const descriptionText = (
        configuredBenefit?.shortDescription ??
        configuredBenefit?.description ??
        ""
    ).trim();
    const hasCustomTitle = !!(
        configuredBenefit?.title &&
        configuredBenefit.title !== ""
    );
    const hasDescription = descriptionText.length >= 50;
    // Button copy is not collected in the Create Benefits wizard; it is filled from hub
    // defaults on save. Do not block completeness on `buttonText`.
    const messagingComplete = hasCustomTitle && hasDescription;

    if (!hasCustomTitle) missingInfo.push("Custom title missing");
    if (!hasDescription) missingInfo.push("Description missing (min 50 chars on this benefit card)");

    // SECTION 3: CONTACTS

    const hasContact = contacts.some((c: any) => {
        const single = normalizeBenefitsCategoryForCompleteness(
            c.benefitsCategory || "",
        );
        if (single === canonical) return true;
        const cats = (c.benefitsCategories || []).map((s: string) =>
            normalizeBenefitsCategoryForCompleteness(s),
        );
        return cats.includes(canonical);
    });
    const contactsComplete = hasContact;

    if (!hasContact) missingInfo.push("No support contact assigned");

    // SECTION 4: DOCUMENTS — same hub resolution as portal lists / persist (category + R2 storageKey path).
    const documents = Array.isArray(ctx?.documents) ? ctx.documents : [];
    const hasDocuments = documents.some((d: any) => {
        if (d.archivedAt) return false;
        const hub = resolvePersistedDocumentCategory(
            d.type || "Document",
            d.category,
            d.storageKey,
        );
        return normalizeBenefitsCategoryForCompleteness(hub) === canonical;
    });
    const documentsComplete = hasDocuments;

    if (!hasDocuments) missingInfo.push("Plan documents missing");

    return {
        isComplete: brandingComplete && messagingComplete && contactsComplete && documentsComplete,
        missingInfo,
        sections: {
            branding: brandingComplete,
            messaging: messagingComplete,
            contacts: contactsComplete,
            documents: documentsComplete
        }
    };
}
