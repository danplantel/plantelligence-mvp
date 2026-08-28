"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetchProfileOnce } from "@/lib/fetch-profile";
import {
  getBenefitsHubAbsoluteUrl,
  getBenefitsHubPath,
} from "@/lib/marketing/hub-url";
import {
  BenefitsStep1Data,
  BenefitsStep3Data,
  useBenefitsWizardStore,
} from "@/lib/benefits-wizard-store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { persistPlanSelection, getRecentPlanIds } from "@/lib/plan-selector-storage";
import { storePendingDraftSelection } from "@/lib/draft-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Activity,
  Coins,
  ShieldCheck,
  User,
  Building2,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Plus,
  Pencil,
  Search,
  Check,
  ChevronsUpDown,
  FileText,
  Mail,
  Info,
  Layout,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { ContactFormFields } from "@/components/wizard/new-client-steps/step-3-key-contacts/components/contact-form-fields";
import {
  BenefitsCategory,
  KeyContact,
  CompanyLogoData,
  BrandImageData,
  BrandImagesData,
} from "@/types/new-client-wizard";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { BrandingImage } from "@/components/ui/branding-image";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
} from "@/components/wizard/steps/sections/user-setup-section/user-setup-section.funcs";
import { normalizeExtension } from "@/lib/phone-utils";
import { toast } from "sonner";
import { AddContactModal } from "@/components/wizard/new-client-steps/step-3-key-contacts/components/add-contact-modal";
import {
  getBenefitCompleteness,
  normalizeBenefitsCategoryForCompleteness,
} from "@/lib/benefit-completeness";
import { convertToDocumentFormat } from "@/lib/compliance-document-utils";
import { mergeOnboardingAdvisorContactsIntoKeyContacts } from "@/lib/seed-onboarding-advisor-contacts";
import { BenefitsDocumentsSection } from "./benefits-documents-section";
/** Wizard order — matches accordion below (Branding → Messaging → Contacts → Documents). */
const BENEFIT_SETUP_SECTION_ORDER = [
  { key: "branding" as const, label: "Branding" },
  { key: "messaging" as const, label: "Messaging" },
  { key: "contacts" as const, label: "Contacts" },
  { key: "documents" as const, label: "Documents" },
];

export function BenefitsStep1() {
  const { stepData, saveStepData } = useBenefitsWizardStore();
  // Use fetchProfileOnce (single-flight + TTL) so this coalesces with the layout
  // header's profile fetch — one /api/profile request for the whole page.
  const { data: profileData } = useSWR("/api/profile", fetchProfileOnce, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
  });
  const userSubdomain: string | undefined = profileData?.subdomain || undefined;
  const accordionRef = useRef<HTMLDivElement>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [primaryServiceCategories, setPrimaryServiceCategories] = useState<string[]>([]);
  const [selectedPlanContacts, setSelectedPlanContacts] = useState<
    KeyContact[]
  >([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [modalCategory, setModalCategory] =
    useState<BenefitsCategory>("Retirement");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeAccordions, setActiveAccordions] = useState<string[]>([]);
  const [togglingCategories, setTogglingCategories] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftPlanName, setDraftPlanName] = useState("");

  // Plan search bar state
  const [planSearchOpen, setPlanSearchOpen] = useState(false);
  const [planSearchQuery, setPlanSearchQuery] = useState("");
  const [planSearchHighlight, setPlanSearchHighlight] = useState(0);
  const planSearchInputRef = useRef<HTMLInputElement>(null);
  const planSearchContainerRef = useRef<HTMLDivElement>(null);
  const planSearchDropdownRef = useRef<HTMLDivElement>(null);

  // Contact form state — a mini version of the new-client ContactFormSlide
  // (individual/team contacts, phone+email with at-least-one, CTA, visibility).
  const [contactForm, setContactForm] = useState<{
    contactType: "individual" | "team_support";
    firstName: string;
    lastName: string;
    title: string;
    displayName: string;
    email: string;
    phone: string;
    phoneExtension: string;
    headshot: string;
    headshotFileName: string;
    teamImage: string;
    teamImageFileName: string;
    companyName: string;
    companyLogo: string;
    companyLogoFileName: string;
    isPrimary: boolean;
    enableContactButton: boolean;
    ctaType: "schedule" | "call" | "email" | "contact";
    schedulingUrl: string;
    websiteUrl: string;
    displayEmail: boolean;
    displayPhone: boolean;
  }>({
    contactType: "individual",
    firstName: "",
    lastName: "",
    title: "",
    displayName: "",
    email: "",
    phone: "",
    phoneExtension: "",
    headshot: "",
    headshotFileName: "",
    teamImage: "",
    teamImageFileName: "",
    companyName: "",
    companyLogo: "",
    companyLogoFileName: "",
    isPrimary: true,
    enableContactButton: false,
    ctaType: "schedule",
    schedulingUrl: "",
    websiteUrl: "",
    displayEmail: true,
    displayPhone: true,
  });
  // Validation errors for the Create New Contact modal (field names).
  const [contactFormErrors, setContactFormErrors] = useState<string[]>([]);
  // Refs for focusing the first invalid field on submit.
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const schedulingUrlRef = useRef<HTMLInputElement>(null);
  const websiteUrlRef = useRef<HTMLInputElement>(null);

  /** Update the contact form and optionally clear the given error fields. */
  const updateContactForm = (
    patch: Partial<typeof contactForm>,
    clearErrors: string[] = [],
  ) => {
    setContactForm((prev) => ({ ...prev, ...patch }));
    if (clearErrors.length > 0) {
      setContactFormErrors((prev) =>
        prev.filter((err) => !clearErrors.includes(err)),
      );
    }
  };

  /** The "Custom" benefit maps to the Company / Plan Sponsor hub — those contacts
   *  are always primary and don't require a Company / Org or custom logo. */
  const isPlanSponsorContact =
    modalCategory === "Company / Plan Sponsor" ||
    String(modalCategory) === "Custom";

  const currentStepData = stepData.step1 || {
    planId: "",
    benefitCategory: "",
    contactId: "",
    benefitTitle: "",
    companyLogo: null,
    brandImages: {
      header: null,
      thumbnail: null,
      secondaryBanner: null,
      favicon: null,
    },
  };

  /** Only a value that exists in `plans` — Radix Select shows a blank trigger if `value` has no matching item. */
  const resolvedPlanId = useMemo(() => {
    const id = (currentStepData.planId || "").trim();
    if (!id || plans.length === 0) return "";
    return plans.some((p) => p.id === id) ? id : "";
  }, [currentStepData.planId, plans]);

  /** Whether the currently selected plan is a Draft (in progress). Draft benefit hubs
   *  are forced Hidden so the advisor explicitly publishes each category from the wizard. */
  const isSelectedPlanDraft = useMemo(() => {
    const plan =
      currentStepData.selectedPlan ||
      plans.find((p) => p.id === currentStepData.planId);
    return (plan as any)?.status === "Draft";
  }, [currentStepData.selectedPlan, currentStepData.planId, plans]);

  // Show the "Draft plan" dialog whenever a Draft plan is selected (via the plan
  // picker or deep-link rehydration). Benefits cannot be created for Drafts — the
  // advisor must finish setting up the plan first.
  useEffect(() => {
    if (!isSelectedPlanDraft || !resolvedPlanId) return;
    const plan =
      currentStepData.selectedPlan ||
      plans.find((p) => p.id === resolvedPlanId);
    setDraftPlanName(((plan as any)?.companyName || "").trim() || "This");
    setDraftDialogOpen(true);
  }, [isSelectedPlanDraft, resolvedPlanId, currentStepData.selectedPlan, plans]);

  /** Plans recently selected across any module (via plan-selector-storage). */
  const recentPlans = useMemo(() => {
    if (plans.length === 0) return [];
    const recentIds = getRecentPlanIds();
    if (recentIds.length === 0) return [];
    const planById = new Map(plans.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const result: { id: string; companyName: string; isCurrent: boolean }[] =
      [];
    for (const id of recentIds) {
      const plan = planById.get(id);
      if (plan && !seen.has(id)) {
        seen.add(id);
        result.push({
          id,
          companyName: plan.companyName,
          isCurrent: id === resolvedPlanId,
        });
      }
    }
    return result;
  }, [plans, resolvedPlanId]);

  // ── Plan search bar logic ──

  /** All plans sorted: recents first, then alphabetical. */
  const allPlansSorted = useMemo(() => {
    const recentIdsFromStorage = getRecentPlanIds();
    const recentSet = new Set(recentIdsFromStorage);
    const recents: typeof plans = [];
    const others: typeof plans = [];
    for (const p of plans) {
      if (recentSet.has(p.id)) recents.push(p);
      else others.push(p);
    }
    others.sort((a, b) =>
      a.companyName.localeCompare(b.companyName, undefined, {
        sensitivity: "base",
      }),
    );
    return [...recents, ...others];
  }, [plans]);

  const planSearchDropdownItems = useMemo(() => {
    if (!planSearchQuery.trim()) return allPlansSorted;
    const q = planSearchQuery.toLowerCase();
    return allPlansSorted.filter((p) =>
      p.companyName.toLowerCase().includes(q),
    );
  }, [planSearchQuery, allPlansSorted]);

  const selectedPlanName = useMemo(
    () => plans.find((p) => p.id === resolvedPlanId)?.companyName ?? "",
    [plans, resolvedPlanId],
  );

  const selectPlan = (planId: string) => {
    handlePlanChange(planId);
    setPlanSearchOpen(false);
    setPlanSearchQuery("");
  };

  const handlePlanSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!planSearchOpen) return;
    if (e.key === "Escape") {
      setPlanSearchOpen(false);
      setPlanSearchQuery("");
      return;
    }
    if (planSearchDropdownItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPlanSearchHighlight(
        (h) => (h + 1) % planSearchDropdownItems.length,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPlanSearchHighlight(
        (h) =>
          (h - 1 + planSearchDropdownItems.length) %
          planSearchDropdownItems.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = planSearchDropdownItems[planSearchHighlight];
      if (item) selectPlan(item.id);
    }
  };

  // Close on outside click
  useEffect(() => {
    if (!planSearchOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (planSearchContainerRef.current?.contains(t)) return;
      if (planSearchDropdownRef.current?.contains(t)) return;
      setPlanSearchOpen(false);
      setPlanSearchQuery("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [planSearchOpen]);

  // Reset highlight when items change
  useEffect(() => {
    setPlanSearchHighlight(0);
  }, [planSearchDropdownItems.length, planSearchOpen]);

  // Filter and sort contacts for the dropdown
  const filteredContacts = useMemo(() => {
    const target = (currentStepData.benefitCategory || "").toLowerCase();

    const matchingCategory = selectedPlanContacts.filter((contact) => {
      if (!currentStepData.benefitCategory) return true;

      const cat = (contact.benefitsCategory || "").toLowerCase();
      const cats = (contact.benefitsCategories || []).map((s: string) =>
        s.toLowerCase(),
      );
      const catOther = (contact as any).benefitsCategoryOther || "";

      const matches =
        cat === target ||
        cats.includes(target) ||
        catOther.toLowerCase() === target;

      return matches;
    });

    const sorted = [...matchingCategory].sort((a, b) => {
      const nameA = (
        a.name ||
        `${a.firstName} ${a.lastName}` ||
        a.email
      ).toLowerCase();
      const nameB = (
        b.name ||
        `${b.firstName} ${b.lastName}` ||
        b.email
      ).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    if (!searchTerm) return sorted;

    return sorted.filter((contact) => {
      const searchStr = searchTerm.toLowerCase();
      const name = (
        contact.name ||
        `${contact.firstName} ${contact.lastName}` ||
        ""
      ).toLowerCase();
      const email = (contact.email || "").toLowerCase();
      const company = (contact.companyName || "").toLowerCase();
      return (
        name.includes(searchStr) ||
        email.includes(searchStr) ||
        company.includes(searchStr)
      );
    });
  }, [selectedPlanContacts, currentStepData.benefitCategory, searchTerm]);

  const activeContact = selectedPlanContacts.find(
    (c) => c.id === currentStepData.contactId,
  );

  // Merged client data for completeness checks
  const getMergedClientData = useMemo(() => {
    const basePlan =
      currentStepData.selectedPlan ||
      (currentStepData.planId
        ? plans.find((p) => p.id === currentStepData.planId)
        : null);
    if (!basePlan) return null;

    const merged = { ...basePlan };

    // Base benefits come from the `Benefit` table (source of truth) once loaded, so
    // completeness + category status reflect DB truth instead of the stale legacy
    // employeePortalPreview JSON (which survives Benefit-row deletion).
    const dbBenefits =
      currentStepData.categoryBenefitByApi !== undefined
        ? Object.values(currentStepData.categoryBenefitByApi).filter(
            (b): b is any => b != null,
          )
        : null;

    // Sync current wizard state to employeePortalPreview.benefits
    if (currentStepData.benefitCategory) {
      const benefits = dbBenefits !== null ? dbBenefits : (merged.employeePortalPreview?.benefits || []);
      const canonicalCategory = normalizeBenefitsCategoryForCompleteness(
        currentStepData.benefitCategory,
      );
      const existingIdx = benefits.findIndex((b: any) => {
        const bKey = normalizeBenefitsCategoryForCompleteness(
          String(b?.category ?? ""),
        );
        return bKey === canonicalCategory;
      });

      const currentBenefitData = {
        category: canonicalCategory,
        title:
          currentStepData.benefitTitle ||
          currentStepData.benefitCategory,
        shortDescription: currentStepData.shortDescription || "",
        partnerLogo: currentStepData.companyLogo?.url || "",
        image: currentStepData.brandImages?.header?.url || "",
        contactId: currentStepData.contactId || "",
      };

      if (existingIdx !== -1) {
        benefits[existingIdx] = {
          ...benefits[existingIdx],
          ...currentBenefitData,
        };
      } else {
        benefits.push(currentBenefitData);
      }

      merged.employeePortalPreview = {
        ...merged.employeePortalPreview,
        benefits,
      };
    }

    // Apply benefitVisibility to ALL benefits (including defaults) so isEnabled
    // is persisted to the API via auto-save and the portal picks it up immediately.
    const visibility = currentStepData.benefitVisibility ?? {};
    const allBenefits: any[] = merged.employeePortalPreview?.benefits ?? [];
    if (Object.keys(visibility).length > 0) {
      // Map from toggle label → benefit category/id for 4 default categories
      const categoryMap: Record<string, { category: string; id: string }> = {
        Retirement: { category: "Retirement", id: "retirement" },
        "Group Health": { category: "Group Health", id: "health" },
        "Group Life": { category: "Group Life", id: "life" },
        Custom: { category: "Company / Plan Sponsor", id: "wellness" },
      };

      if (allBenefits.length > 0) {
        merged.employeePortalPreview = {
          ...merged.employeePortalPreview,
          benefits: allBenefits.map((b: any) => {
            const bNorm = (b.category || "").toLowerCase().trim().replace(/\s+/g, " ");
            let matchKey: string | null = null;
            for (const key of Object.keys(visibility)) {
              const keyNorm = key.toLowerCase().trim().replace(/\s+/g, " ");
              if (bNorm === keyNorm) { matchKey = key; break; }
              if (bNorm === "company / plan sponsor" && keyNorm === "custom") { matchKey = key; break; }
              if (bNorm === "custom" && keyNorm === "custom") { matchKey = key; break; }
            }
            if (matchKey && visibility[matchKey] !== undefined) {
              return { ...b, isEnabled: visibility[matchKey] };
            }
            return b;
          }),
        };
      } else {
        // No benefits yet — create default placeholders so isEnabled is saved
        const defaultBenefits = Object.entries(categoryMap).map(([label, { category, id }]) => ({
          id,
          category,
          title: label === "Custom" ? "Wellness Programs" : label,
          isEnabled: visibility[label] !== false,
        }));
        merged.employeePortalPreview = {
          ...merged.employeePortalPreview,
          benefits: defaultBenefits,
        };
      }
    }

    // Merge Step 4 documents into the client data for completeness checks
    if (stepData.step4?.documents) {
      merged.documents = stepData.step4.documents;
    }

    return merged;
  }, [currentStepData, stepData.step4, plans]);

  // Calculate completeness for current category
  const currentCompleteness = useMemo(() => {
    if (!currentStepData.benefitCategory || !getMergedClientData) return null;
    return getBenefitCompleteness(
      currentStepData.benefitCategory as BenefitsCategory,
      getMergedClientData,
    );
  }, [currentStepData.benefitCategory, getMergedClientData]);

  // Auto-expand incomplete sections (e.g. when the category changes or data loads) by adding
  // them to whatever the user already has open. Never auto-closes sections: collapsing the
  // active section (e.g. Messaging) as soon as its field becomes valid is jarring mid-edit.
  useEffect(() => {
    if (!currentCompleteness?.sections) return;

    const incomplete = Object.entries(currentCompleteness.sections)
      .filter(([_, isDone]) => !isDone)
      .map(([name]) => name);

    if (incomplete.length > 0) {
      setActiveAccordions((prev) =>
        Array.from(new Set([...prev, ...incomplete])),
      );
    }
  }, [currentStepData.benefitCategory, currentCompleteness?.isComplete]);

  // Debounced auto-save to database (also saves isEnabled from benefitVisibility toggles).
  // Only writes to the dedicated Benefit API, and only when the benefit draft fields have
  // actually changed since the last save. `categoryPortalVisibility` is intentionally NOT
  // written here — the explicit publish/hide toggle handler persists it, so merely opening
  // this page never triggers a PUT to /api/clients.
  const lastAutoSavedPayloadRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !getMergedClientData ||
      !currentStepData.planId
    )
      return;

    const timer = setTimeout(async () => {
      try {
        if (!currentStepData.benefitCategory) return;

        const category = currentStepData.benefitCategory === "Custom"
          ? "Company / Plan Sponsor"
          : currentStepData.benefitCategory;

        const visKey =
          currentStepData.benefitCategory === "Company / Plan Sponsor"
            ? "Custom"
            : currentStepData.benefitCategory;
        const isEnabled =
          (currentStepData.benefitVisibility ?? {})[visKey] !== false;

        const payload = {
          isEnabled,
          // Persist brand logo + description so they survive page refreshes
          // and are available whenever the wizard is re-entered.
          partnerLogo: currentStepData.companyLogo?.url || null,
          shortDescription: currentStepData.shortDescription || null,
          insurancePlanId: currentStepData.insurancePlanId || "",
          insuranceLoginUrl: currentStepData.insuranceLoginUrl || "",
          insuranceBackgroundImage: currentStepData.insuranceBackgroundImage || "",
          insuranceContainerBlockOpacity: currentStepData.insuranceContainerBlockOpacity ?? 0.8,
          // Header background image (uploaded in the Branding section) — the
          // Benefit row stores this as `backgroundImage` (legacy: `image`).
          backgroundImage: currentStepData.brandImages?.header?.url || null,
          // Plan video (uploaded in Step 2 Editor Panel). Must be included
          // so the dual-write doesn't wipe the video from employeePortalPreview.
          planVideo: currentStepData.planVideo || null,
          planVideoFileName: currentStepData.planVideoFileName || null,
          // Journey section overrides (Section 2 & 3 in the editor panel).
          // Persist so the live portal page shows these values even before
          // the wizard is completed.
          journeyHeader: currentStepData.journeyHeader || null,
          journeySubtitle: currentStepData.journeySubtitle || null,
          journeyBodyText: currentStepData.journeyBodyText || null,
        };
        const payloadKey = JSON.stringify(payload);

        // First run records the rehydration baseline WITHOUT writing; subsequent runs only
        // write when the draft actually changed. This removes the flurry of duplicate
        // auto-save PUTs that fired on page load.
        if (lastAutoSavedPayloadRef.current === null) {
          lastAutoSavedPayloadRef.current = payloadKey;
          return;
        }
        if (lastAutoSavedPayloadRef.current === payloadKey) return;
        lastAutoSavedPayloadRef.current = payloadKey;

        // NOTE: `?updateOnly=1` — this debounced draft auto-save must NEVER create
        // a Benefit row, only update one that already exists. Otherwise merely
        // opening this page would re-create Benefit rows the user deleted from the
        // database. New rows are created only by explicit actions (publish/hide
        // toggle, FAQ save, editor save).
        await fetch(`/api/clients/${currentStepData.planId}/benefits/${encodeURIComponent(category)}?updateOnly=1`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error("Auto-save error:", error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [getMergedClientData, currentStepData.planId, currentStepData.benefitCategory]);

  // Derive user's primary service categories from the shared /api/profile SWR fetch
  // (deduped — no separate manual fetch that would duplicate the request).
  useEffect(() => {
    const cats: string[] = (profileData as any)?.primaryServiceCategories ?? [];
    if (cats.length > 0) setPrimaryServiceCategories(cats);
  }, [profileData]);

  // Guard so React StrictMode (dev double-invoke) doesn't fetch the plans list twice.
  const plansFetchStartedRef = useRef(false);
  useEffect(() => {
    if (plansFetchStartedRef.current) return;
    plansFetchStartedRef.current = true;
    async function fetchPlans() {
      try {
        // Include Draft — most in-progress setups are not Active yet; Archived stays out of the picker.
        const response = await fetch(
          "/api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc",
          { credentials: "same-origin", cache: "no-store" },
        );
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          const msg =
            typeof (result as { error?: string }).error === "string"
              ? (result as { error: string }).error
              : `Could not load plans (${response.status})`;
          toast.error(
            msg === "Unauthorized"
              ? "Please sign in to load your plans."
              : msg,
          );
          setPlans([]);
          return;
        }

        if (result.success && Array.isArray(result.data)) {
          const selectable = result.data.filter(
            (p: any) => p.status !== "Archived",
          );
          setPlans(selectable);
        } else {
          toast.error("Failed to load plans");
          setPlans([]);
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
        toast.error("An error occurred while loading plans");
        setPlans([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  /** Drop persisted planId that isn't in the loaded list (archived, other account, stale storage). */
  useEffect(() => {
    if (loading) return;
    const pid = (currentStepData.planId || "").trim();
    if (!pid || plans.length === 0) return;
    if (plans.some((p) => p.id === pid)) return;

    const s1 = useBenefitsWizardStore.getState().stepData.step1;
    if (!s1) return;

    toast.message("Pick a plan", {
      description:
        "Your saved selection isn't in this list anymore (for example archived).",
    });

    saveStepData(1, {
      ...s1,
      planId: "",
      selectedPlan: null,
      benefitCategory: "",
      contactId: "",
      benefitTitle: "",
      shortDescription: "",
      companyLogo: null,
      brandImages: {
        header: null,
        thumbnail: null,
        secondaryBanner: null,
        favicon: null,
      },
    });
  }, [loading, plans, currentStepData.planId, saveStepData]);

  // Portal deep link sets planId + benefitCategory before `selectedPlan` exists — fetch full client so
  // completeness, contacts, and merged preview data work without re-picking the plan in the dropdown.
  // Guarded so React StrictMode (dev double-invoke) doesn't fetch the same client twice.
  const fullPlanFetchRef = useRef<string | null>(null);
  useEffect(() => {
    const planId = currentStepData.planId;
    if (!planId?.trim() || plans.length === 0) return;
    if (currentStepData.selectedPlan?.id === planId) return;
    if (fullPlanFetchRef.current === planId) return;
    fullPlanFetchRef.current = planId;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/clients/${planId}`);
        const result = await response.json();
        if (cancelled) return;
        const latest = useBenefitsWizardStore.getState().stepData.step1;
        if (!latest?.planId || latest.planId !== planId) return;

        if (result.success && result.data) {
          const fullPlan = result.data;
          let convertedDocs: any[] = [];
          if (fullPlan.documents && Array.isArray(fullPlan.documents)) {
            convertedDocs = await Promise.all(
              fullPlan.documents.map((doc: any, index: number) =>
                convertToDocumentFormat(
                  {
                    ...doc,
                    name: doc.title,
                    fileUrl: doc.fileUrl,
                    storageKey: doc.storageKey,
                  },
                  index,
                ),
              ),
            );
          }
          // Deduplicate by (id || name) + category to allow the same document in different categories
          // while preventing duplicates within the same category.
          const dedupedInitialDocs = convertedDocs.filter((doc: any, i: number, arr: any[]) =>
            arr.findIndex((d: any) =>
              (d.id || d.name) === (doc.id || doc.name) &&
              (d.category || '') === (doc.category || '')
            ) === i
          );
          saveStepData(4, { documents: dedupedInitialDocs });

          const planBackground =
            fullPlan.brandImages?.secondaryBanner ||
            (fullPlan.secondaryBannerImg
              ? {
                  url: fullPlan.secondaryBannerImg,
                  fileName:
                    fullPlan.secondaryBannerImgName || "background.png",
                  fileSize: 0,
                  width: 0,
                  height: 0,
                  recommendedSize: "1920 px—1080 px",
                  status: "ok" as const,
                  warnings: [],
                }
              : null);

          // Sync insurance fields from persisted plan data into step1Data
          const fullPlanEpp = fullPlan.employeePortalPreview || {};
          saveStepData(1, {
            ...latest,
            planId,
            selectedPlan: fullPlan,
            // Draft plans must never inherit a stale all-visible benefitVisibility (the
            // new-client wizard defaults drafts to all-visible at the API level). Force
            // every hub Hidden when a Draft is loaded so the advisor explicitly publishes
            // each category from the wizard. Active plans keep their saved visibility.
            ...((fullPlan as any)?.status === "Draft"
              ? {
                  benefitVisibility: {
                    Retirement: false,
                    "Group Health": false,
                    "Group Life": false,
                    Custom: false,
                    "Company / Plan Sponsor": false,
                  },
                }
              : {}),
            insuranceBackgroundImage:
              fullPlanEpp.insuranceBackgroundImage ||
              latest.insuranceBackgroundImage ||
              "",
            insurancePlanId:
              fullPlanEpp.insurancePlanId ||
              latest.insurancePlanId ||
              "",
            insuranceLoginUrl:
              fullPlanEpp.insuranceLoginUrl ||
              latest.insuranceLoginUrl ||
              "",
            insuranceContainerBlockOpacity:
              fullPlanEpp.insuranceContainerBlockOpacity ??
              latest.insuranceContainerBlockOpacity ??
              0.8,
            brandImages: {
              ...(latest.brandImages || {
                header: null,
                thumbnail: null,
                secondaryBanner: null,
                favicon: null,
              }),
              // When a benefit category is already active, the per-category header
              // (set by the pre-fill effect from the Benefit row / User profile)
              // wins — never override it with the plan-level background, which
              // otherwise resurfaced a stale image across all categories.
              header:
                latest.benefitCategory
                  ? latest.brandImages?.header ?? null
                  : planBackground ?? latest.brandImages?.header ?? null,
            },
          });
        } else {
          const plan = plans.find((p: any) => p.id === planId);
          if (plan && !cancelled) {
            const latest2 = useBenefitsWizardStore.getState().stepData.step1;
            saveStepData(1, { ...latest2, planId, selectedPlan: plan });
          }
        }
      } catch {
        if (cancelled) return;
        const plan = plans.find((p: any) => p.id === planId);
        if (plan) {
          const latest3 = useBenefitsWizardStore.getState().stepData.step1;
          saveStepData(1, { ...latest3, planId, selectedPlan: plan });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentStepData.planId,
    currentStepData.selectedPlan?.id,
    plans,
    saveStepData,
  ]);

  // ── Source benefit content from the `Benefit` table (source of truth) ──
  // Fetch all Benefit rows for the selected plan and store them keyed by normalized category.
  // The pre-fill effects below and the Step 2 preview read this instead of the stale legacy
  // employeePortalPreview.benefits JSON — which survives Benefit-row deletion and would
  // otherwise resurface the last benefit the user created. A category with no row is simply
  // absent from the map, so the wizard stays blank until a benefit is explicitly created.
  const benefitApiLoadedPlanRef = useRef<string | null>(null);
  const normalizeApiCategory = (raw: string) =>
    (raw || "").toLowerCase().trim().replace(/\s+/g, " ");

  /** Resolve the client/plan company name (Company / Plan Sponsor name) from the
   *  selected plan, falling back to the plans list by planId so it populates even
   *  before the full plan detail has finished loading. */
  const getSelectedCompanyName = (): string => {
    const plan =
      currentStepData?.selectedPlan ||
      plans.find((p) => p.id === currentStepData?.planId);
    return ((plan as any)?.companyName || "").trim();
  };

  /** Default Intro Headline: "Welcome to [Organization Name]" for the advisor's own
   *  primary service categories, otherwise "Welcome to [Company Name]" (the plan/client).
   *  The name is truncated so the headline stays within the 35-char Intro Headline max. */
  const getDefaultIntroHeadline = (category: string): string => {
    const primaryCats: string[] = Array.isArray(
      (profileData as any)?.primaryServiceCategories,
    )
      ? (profileData as any).primaryServiceCategories
      : [];
    const apiCat = category === "Custom" ? "Company / Plan Sponsor" : category;
    const isPrimary = primaryCats.some(
      (pc) =>
        normalizeApiCategory(String(pc)) === normalizeApiCategory(apiCat) ||
        (normalizeApiCategory(String(pc)) === "other" &&
          normalizeApiCategory(apiCat) === "company / plan sponsor"),
    );
    const orgName = (
      (profileData as any)?.organizationName ||
      (profileData as any)?.user?.organizationName ||
      ""
    ).trim();
    const companyName = getSelectedCompanyName();
    const name = isPrimary ? orgName : companyName;
    const prefix = "Welcome to ";
    if (!name) return `${prefix}Your Benefits Hub!`;
    // Leave room for the trailing "!" so the headline stays ≤ 35 chars.
    const maxNameLen = 35 - prefix.length - 1;
    const trimmed =
      name.length > maxNameLen ? name.slice(0, maxNameLen) : name;
    return `${prefix}${trimmed}!`;
  };

  /** Default Intro Message: a personalized welcome that fills in the
   *  Company (Plan Sponsor) Name (the plan/client) and the Organization Name
   *  (the advisor) in the placeholder spots. Kept ≤ 450 chars (Intro Message max). */
  const getDefaultIntroMessage = (): string => {
    const companyName = getSelectedCompanyName();
    const orgName = (
      (profileData as any)?.organizationName ||
      (profileData as any)?.user?.organizationName ||
      ""
    ).trim();
    const company = companyName || "your company";
    const org = orgName || "your organization";
    return (
      `We consider it a privilege to have been selected by ${company} to represent you and your retirement plan. ` +
      `Whether you're just beginning your savings journey or already building toward retirement, ` +
      `${org} shares your company's commitment to educating you about the importance and long-term value of ` +
      `participating in this valuable retirement benefit.`
    ).slice(0, 450);
  };

  useEffect(() => {
    const planId = currentStepData.planId;
    if (!planId?.trim()) return;
    if (benefitApiLoadedPlanRef.current === planId) return;
    benefitApiLoadedPlanRef.current = planId;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${planId}/benefits`);
        const data = await res.json();
        if (cancelled || !data?.success) return;
        const rows: any[] = Array.isArray(data.benefits) ? data.benefits : [];
        const byCategory: Record<string, any | null> = {};
        for (const row of rows) {
          const key = normalizeApiCategory(String(row?.category ?? ""));
          if (key) byCategory[key] = row;
        }
        const latest = useBenefitsWizardStore.getState().stepData.step1;
        if (!latest || latest.planId !== planId) return;
        saveStepData(1, { ...latest, categoryBenefitByApi: byCategory });
      } catch (err) {
        console.error("Failed to load Benefit rows:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStepData.planId, saveStepData]);

  // Load persisted Step 3 support contacts (and FAQs) for the current category into the
  // wizard store when entering the flow, so previously saved selections are retained.
  // Tracks loaded categories (step3.supportContactsLoadedCategories) so this never
  // clobbers in-session edits or removals on re-render.
  useEffect(() => {
    const cat = currentStepData.benefitCategory;
    if (!cat) return;

    const latest = useBenefitsWizardStore.getState().stepData.step3;
    const loadedCats = latest?.supportContactsLoadedCategories ?? [];
    if (loadedCats.includes(cat)) return;
    // Wait for the Benefit-table fetch to settle before deciding what to pre-fill.
    if (currentStepData.categoryBenefitByApi === undefined) return;

    // Source of truth is the Benefit table (categoryBenefitByApi), NOT the stale legacy
    // employeePortalPreview JSON. Missing = no row (deleted) → clear any stale persisted
    // contacts/FAQs so the wizard doesn't show the last benefit's data.
    const apiCat = cat === "Custom" ? "Company / Plan Sponsor" : cat;
    const benefit =
      currentStepData.categoryBenefitByApi[normalizeApiCategory(apiCat)] ?? null;

    if (!benefit) {
      const cleared: BenefitsStep3Data = {
        ...(latest || {
          faqs: [],
          supportContacts: [],
          currentSubStep: "a" as const,
        }),
        faqs: [],
        faqsByCategory: {
          ...(latest?.faqsByCategory ?? {}),
          [cat]: [],
        },
        supportContacts: [],
        supportContactsLoadedCategories: [...loadedCats, cat],
      };
      saveStepData(3, cleared);
      return;
    }

    const savedSupportContacts = Array.isArray(benefit?.supportContacts)
      ? benefit.supportContacts
      : null;
    const savedFaqs =
      Array.isArray(benefit?.faqs) && benefit.faqs.length > 0
        ? benefit.faqs
        : null;

    const next: BenefitsStep3Data = {
      ...(latest || {
        faqs: [],
        supportContacts: [],
        currentSubStep: "a" as const,
      }),
      supportContacts: savedSupportContacts ?? [],
      supportContactsLoadedCategories: [...loadedCats, cat],
    };
    if (savedFaqs) {
      next.faqs = savedFaqs;
      next.faqsByCategory = {
        ...(latest?.faqsByCategory ?? {}),
        [cat]: savedFaqs,
      };
    }
    saveStepData(3, next);
  }, [currentStepData.benefitCategory, currentStepData.categoryBenefitByApi, saveStepData]);

  // Load persisted Benefit Logo (partnerLogo), Benefit Description (shortDescription) and header
  // background for the current category into step1 when entering the flow, so previously saved
  // values are retained (e.g. deep-link re-entry sets planId/category but never loads the logo).
  //
  // Source of truth is the `Benefit` table (categoryBenefitByApi) — NOT the stale legacy
  // employeePortalPreview JSON. Additionally, when the category is one of the advisor's
  // primaryServiceCategories, the Benefit Logo and Background Header Image default from the User
  // profile (User.advisorLogoUrl → companyLogo, User.backgroundImage → brandImages.header)
  // whenever the benefit row doesn't already provide them. Runs once per category
  // (step1.benefitFieldsLoadedCategories) so in-session edits are never clobbered.
  useEffect(() => {
    const cat = currentStepData.benefitCategory;
    if (!cat) return;

    const loadedCats = currentStepData.benefitFieldsLoadedCategories ?? [];
    if (loadedCats.includes(cat)) return;
    // Wait for the Benefit-table fetch AND the user profile to resolve so the pre-fill decision
    // (including the User-profile logo/header fallback) is final.
    if (currentStepData.categoryBenefitByApi === undefined) return;
    if (profileData === undefined) return;

    const apiCat = cat === "Custom" ? "Company / Plan Sponsor" : cat;
    const benefit =
      currentStepData.categoryBenefitByApi[normalizeApiCategory(apiCat)] ?? null;

    // User-profile defaults for the advisor's primary service categories.
    const profile = (profileData as any) || {};
    const primaryCats: string[] = Array.isArray(profile.primaryServiceCategories)
      ? profile.primaryServiceCategories
      : [];
    // "Other" in primaryServiceCategories maps to the "Company / Plan Sponsor" benefit hub.
    const isPrimary = primaryCats.some(
      (pc) =>
        normalizeApiCategory(String(pc)) === normalizeApiCategory(apiCat) ||
        (normalizeApiCategory(String(pc)) === "other" &&
          normalizeApiCategory(apiCat) === "company / plan sponsor"),
    );
    // Read the advisor's branding from wherever it is stored: top-level User fields
    // (advisorLogoUrl / backgroundImage) first, then the wizard branding / profile-derived
    // values (advisorLogo, advisorBackgroundImage, wizardSessions branding/userSetup).
    const wizardBranding = profile.wizardSessions?.[0]?.branding || {};
    const wizardUserSetup = profile.wizardSessions?.[0]?.userSetup || {};
    const userLogo = isPrimary
      ? (profile.advisorLogoUrl ||
          profile.advisorLogo ||
          wizardBranding.logo ||
          null)
      : null;
    const userHeader = isPrimary
      ? (profile.backgroundImage ||
          profile.advisorBackgroundImage ||
          wizardBranding.backgroundImage ||
          wizardUserSetup.backgroundImage ||
          null)
      : null;

    // Benefit-table row wins; the User profile is the fallback for logo/header only.
    const savedLogo = benefit?.partnerLogo || userLogo;
    const savedDescription = benefit?.shortDescription || "";
    const savedHeaderImage =
      (benefit?.backgroundImage || benefit?.image) || userHeader;

    const next: BenefitsStep1Data = {
      ...currentStepData,
      benefitFieldsLoadedCategories: [...loadedCats, cat],
    };

    // When there is no Benefit row (deleted / never created), clear stale persisted content from
    // a previous benefit so it never resurfaces — the User-profile values above then re-seed the
    // logo/header for primary categories.
    if (!benefit) {
      // Default the Intro Headline to "Welcome to [Org/Company]" so Messaging is not empty.
      next.benefitTitle = getDefaultIntroHeadline(cat);
      next.shortDescription = getDefaultIntroMessage();
      // NOTE: contactId (Key Contact selection) is deliberately NOT cleared here — it is
      // managed by the contact-prefill effect / prefillContact, so clearing it on a different
      // render would wipe the pre-selected Primary Contact for every category.
      next.companyLogo = null;
      next.innerHeaderImage = null;
      next.brandImages = {
        header: null,
        thumbnail: null,
        secondaryBanner: null,
        favicon: null,
      };
      next.planVideo = undefined;
      next.planVideoFileName = undefined;
      next.journeyHeader = undefined;
      next.journeySubtitle = undefined;
      next.journeyBodyText = undefined;
      next.insurancePlanId = "";
      next.insuranceLoginUrl = "";
      next.insuranceBackgroundImage = "";
      next.insuranceContainerBlockOpacity = undefined;
    }

    if (savedDescription) {
      next.shortDescription = savedDescription;
    }
    if (savedLogo) {
      next.companyLogo = {
        url: savedLogo,
        fileName: "logo.png",
        fileSize: 0,
        width: 0,
        height: 0,
        hasTransparency: false,
        warnings: [],
      } as CompanyLogoData;
    }
    if (savedHeaderImage) {
      next.brandImages = {
        ...(next.brandImages || {
          header: null,
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        }),
        header: {
          url: savedHeaderImage,
          fileName: "background.png",
          fileSize: 0,
          width: 0,
          height: 0,
          recommendedSize: "1920 px—1080 px",
          status: "ok" as const,
          warnings: [],
        },
      };
    } else {
      // No benefit-specific background AND no User-profile header — clear any stale
      // header that was injected earlier (e.g. the plan-level `planBackground` from
      // handlePlanChange / the full-plan-fetch effect, or a stale localStorage value)
      // so an old uploaded image never resurfaces for a category without its own.
      next.brandImages = {
        ...(next.brandImages || {
          header: null,
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        }),
        header: null,
      };
    }

    saveStepData(1, next);
  }, [currentStepData.benefitCategory, currentStepData.categoryBenefitByApi, profileData, saveStepData]);

  // Conversion helpers
  const convertBrandImageToLogo = (
    brandImage: BrandImageData | null,
  ): CompanyLogoData | null => {
    if (!brandImage) return null;
    return {
      url: brandImage.url,
      originalUrl: brandImage.originalUrl || brandImage.cropData?.originalImage,
      fileName: brandImage.fileName,
      fileSize: brandImage.fileSize,
      width: brandImage.width,
      height: brandImage.height,
      hasTransparency:
        brandImage.url.includes("data:image/png") ||
        brandImage.url.includes("data:image/svg"),
      warnings: brandImage.warnings || [],
      cropData: brandImage.cropData,
    };
  };

  const convertLogoToBrandImage = (
    logoData: CompanyLogoData | null,
  ): BrandImageData | undefined => {
    if (!logoData) return undefined;
    return {
      url: logoData.url,
      originalUrl: logoData.originalUrl || logoData.cropData?.originalImage,
      fileName: logoData.fileName,
      fileSize: logoData.fileSize,
      width: logoData.width,
      height: logoData.height,
      recommendedSize: "900 px—900 px",
      status:
        logoData.warnings && logoData.warnings.length > 0 ? "warning" : "ok",
      warnings: logoData.warnings || [],
      cropData: logoData.cropData,
    };
  };

  const convertToBrandImage = (url?: string): BrandImageData | undefined => {
    if (!url) return undefined;
    return {
      url,
      fileName: "contact-photo.png",
      fileSize: 0,
      width: 0,
      height: 0,
      recommendedSize: "900 px—900 px",
      status: "ok",
      warnings: [],
    };
  };

  const prefillFromContact = (
    contact: KeyContact,
    category: string,
    baseData: BenefitsStep1Data,
  ): BenefitsStep1Data => {
    return {
      ...baseData,
      benefitTitle: baseData.benefitTitle || getDefaultIntroHeadline(category),
      contactId: contact.id,
    };
  };

  useEffect(() => {
    if (currentStepData.planId) {
      // First, check if the store already has a selectedPlan with contacts (might be local unsaved ones)
      const storePlan = currentStepData.selectedPlan;
      const apiPlan = plans.find((p) => p.id === currentStepData.planId);

      let contactsToSet: KeyContact[] = [];

      if (storePlan && storePlan.id === currentStepData.planId) {
        // Prioritize store plan contacts as it might contain local new contacts
        contactsToSet = Array.isArray(storePlan.keyContacts)
          ? storePlan.keyContacts
          : storePlan.keyContacts?.contacts || [];
      } else if (apiPlan && apiPlan.keyContacts) {
        // Fallback to API plan contacts
        contactsToSet = Array.isArray(apiPlan.keyContacts)
          ? apiPlan.keyContacts
          : apiPlan.keyContacts.contacts || [];
      }

      // Ensure the advisor (User) is available as a Key Contact for EVERY primary service
      // category — even when the plan's keyContacts predate a category the user added later
      // (e.g. Group Life added via Settings after the plan was created). Without this, that
      // category has no contact to pre-select in the Primary Contact dropdown.
      if (profileData) {
        contactsToSet = mergeOnboardingAdvisorContactsIntoKeyContacts(
          contactsToSet,
          (profileData as any)?.primaryServiceCategories,
          profileData as any,
        );
      }

      if (contactsToSet.length > 0) {
        setSelectedPlanContacts(contactsToSet);

        // Always re-prefill when category changes to ensure correct primary contact is selected
        if (currentStepData.benefitCategory) {
          const newData = prefillContact(
            currentStepData.benefitCategory,
            contactsToSet,
            currentStepData,
          );
          // Only save if different to avoid cycles
          if (newData.contactId !== currentStepData.contactId) {
            saveStepData(1, newData);
          }
        }
      }
    } else {
      setSelectedPlanContacts([]);
    }
  }, [currentStepData.planId, plans, currentStepData.benefitCategory, profileData]);

  const prefillContact = (
    category: string,
    contacts: KeyContact[],
    baseData: BenefitsStep1Data,
  ): BenefitsStep1Data => {
    const target = (category || "").toLowerCase();

    // Helper to check if contact matches category
    const matchesCategory = (c: KeyContact) => {
      const cat = (c.benefitsCategory || "").toLowerCase();
      const cats = (c.benefitsCategories || []).map((s: string) =>
        s.toLowerCase(),
      );
      const catOther = (c as any).benefitsCategoryOther || "";
      return (
        cat === target ||
        cats.includes(target) ||
        catOther.toLowerCase() === target
      );
    };

    // 1. General primary (isPrimary or isPrimaryOverall)
    let contact = contacts.find(
      (c) => matchesCategory(c) && (c.isPrimary || c.isPrimaryOverall),
    );

    // 2. Any matching category
    if (!contact) {
      contact = contacts.find(matchesCategory);
    }

    if (contact) {
      let newData = { ...baseData, contactId: contact.id };

      // Explicitly set thumbnail if contact has a photo (check multiple possible fields)
      const photoUrl =
        (contact as any).headshot ||
        (contact as any).avatar ||
        (contact as any).photo ||
        (contact as any).teamImage;
      if (photoUrl) {
        newData.brandImages = {
          ...(newData.brandImages || {
            header: null,
            thumbnail: null,
            secondaryBanner: null,
            favicon: null,
          }),
          thumbnail: {
            url: photoUrl,
            fileName: "contact-photo.png",
            fileSize: 0,
            width: 0,
            height: 0,
            recommendedSize: "900 px—900 px",
            status: "ok" as const,
            warnings: [],
          },
        };
      }

      return prefillFromContact(contact, category, newData);
    }

    return baseData;
  };

  // Whether the currently selected benefit category is one of the advisor's primary service
  // categories — gates the "Your Designations" section so User.designations only show for
  // categories the user actually serves (pre-population by User.primaryServiceCategories).
  const isCurrentCategoryPrimary = useMemo(() => {
    const cat = currentStepData.benefitCategory;
    if (!cat) return false;
    const primaryCats: string[] = Array.isArray(
      (profileData as any)?.primaryServiceCategories,
    )
      ? (profileData as any).primaryServiceCategories
      : [];
    if (primaryCats.length === 0) return false;
    const apiCat = cat === "Custom" ? "Company / Plan Sponsor" : cat;
    return primaryCats.some(
      (pc) =>
        normalizeApiCategory(String(pc)) === normalizeApiCategory(apiCat) ||
        (normalizeApiCategory(String(pc)) === "other" &&
          normalizeApiCategory(apiCat) === "company / plan sponsor"),
    );
  }, [currentStepData.benefitCategory, profileData]);

  const getCategoryStatus = (catId: string) => {
    const selectedPlan =
      currentStepData.selectedPlan ||
      plans.find((p) => p.id === currentStepData.planId);
    if (!selectedPlan) return null;

    // Start with the raw plan data
    const mergedBaseData = { ...selectedPlan };

    // Use step 4 documents when we have any (user has been to step 4 or plan was just selected).
    // Do not overwrite with empty array — that would hide plan documents from list/fetch and show "Plan documents missing".
    if (stepData.step4?.documents?.length) {
      mergedBaseData.documents = stepData.step4.documents;
    }

    // Use merged data for the active category to account for live edits (logo, title, etc.)
    const dataForCompleteness =
      catId === currentStepData.benefitCategory && getMergedClientData
        ? getMergedClientData
        : mergedBaseData;

    // Use central completeness logic
    const completeness = getBenefitCompleteness(
      catId as BenefitsCategory,
      dataForCompleteness,
    );

    // Check if the benefit exists in the `Benefit` table (source of truth). Do NOT use the
    // stale legacy employeePortalPreview JSON, which survives Benefit-row deletion.
    const dbCat = catId === "Custom" ? "Company / Plan Sponsor" : catId;
    const existingBenefit =
      currentStepData.categoryBenefitByApi?.[normalizeApiCategory(dbCat)] ?? null;

    // For logo, prioritize local edits if currently editing
    const isCurrentlyBeingEdited = currentStepData.benefitCategory === catId;
    const logo =
      existingBenefit?.partnerLogo ||
      (isCurrentlyBeingEdited ? currentStepData.companyLogo?.url : null);

    const pendingSectionLabels = BENEFIT_SETUP_SECTION_ORDER.filter(
      ({ key }) => !completeness.sections[key],
    ).map(({ label }) => label);

    return {
      exists: !!existingBenefit,
      missing: completeness.missingInfo,
      isComplete: completeness.isComplete,
      sections: completeness.sections,
      pendingSectionLabels,
      logo: logo,
    };
  };

  const handleCreateContact = (category: BenefitsCategory) => {
    setModalCategory(category);
    setContactForm({
      contactType: "individual",
      firstName: "",
      lastName: "",
      title: "",
      displayName: "",
      email: "",
      phone: "",
      phoneExtension: "",
      headshot: "",
      headshotFileName: "",
      teamImage: "",
      teamImageFileName: "",
      companyName: "",
      companyLogo: "",
      companyLogoFileName: "",
      isPrimary: true,
      enableContactButton: false,
      ctaType: "schedule",
      schedulingUrl: "",
      websiteUrl: "",
      displayEmail: true,
      displayPhone: true,
    });
    setContactFormErrors([]);
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = () => {
    const {
      contactType,
      firstName,
      lastName,
      title,
      displayName,
      email,
      phone,
      companyName,
    } = contactForm;

    // ── Validation (mirrors the new-client ContactFormSlide) ──
    const errors: string[] = [];

    if (contactType === "individual") {
      if (!firstName.trim()) errors.push("firstName");
      if (!lastName.trim()) errors.push("lastName");
      if (!title.trim()) errors.push("title");
    } else {
      if (!displayName.trim()) errors.push("displayName");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = (phone || "").replace(/\D/g, "");
    const emailValid = emailRegex.test((email || "").trim());
    const phoneValid = phoneDigits.length >= 10;

    // Validate format only when a value is provided
    if ((phone || "").trim() && !phoneValid) errors.push("phone");
    if ((email || "").trim() && !emailValid) errors.push("email");

    // At least one of Phone or Email is required — the user can choose either
    // contact method (or provide both), instead of one specific field.
    if (!phoneValid && !emailValid) {
      if (!phoneValid) errors.push("phone");
      if (!emailValid) errors.push("email");
    }

    // Company / Organization is required for non-Plan-Sponsor contacts
    if (!isPlanSponsorContact && !companyName.trim()) {
      errors.push("companyName");
    }

    // CTA required URLs
    if (
      contactForm.enableContactButton &&
      contactForm.ctaType === "schedule" &&
      !contactForm.schedulingUrl.trim()
    ) {
      errors.push("schedulingUrl");
    }
    if (
      contactForm.enableContactButton &&
      contactForm.ctaType === "contact" &&
      !contactForm.websiteUrl.trim()
    ) {
      errors.push("websiteUrl");
    }

    if (errors.length > 0) {
      setContactFormErrors(errors);
      const refMap: Record<
        string,
        React.RefObject<HTMLInputElement | null>
      > = {
        firstName: firstNameRef,
        lastName: lastNameRef,
        title: titleRef,
        email: emailRef,
        phone: phoneRef,
        companyName: companyNameRef,
        schedulingUrl: schedulingUrlRef,
        websiteUrl: websiteUrlRef,
      };
      refMap[errors[0]]?.current?.focus();
      toast.error("Please fill out all required fields");
      return;
    }
    setContactFormErrors([]);

    const shouldBePrimary =
      isPlanSponsorContact || contactForm.isPrimary === true;

    // ── Create the contact object ──
    const newContact: KeyContact = {
      id: `new-contact-${Date.now()}`,
      contactType,
      firstName: contactType === "individual" ? firstName : undefined,
      lastName: contactType === "individual" ? lastName : undefined,
      title: contactType === "individual" ? title : undefined,
      displayName: contactType === "team_support" ? displayName : undefined,
      email,
      phone,
      phoneExtension: contactForm.phoneExtension,
      headshot:
        contactType === "individual"
          ? contactForm.headshot || undefined
          : undefined,
      headshotFileName:
        contactType === "individual"
          ? contactForm.headshotFileName || undefined
          : undefined,
      teamImage:
        contactType === "team_support"
          ? contactForm.teamImage || undefined
          : undefined,
      teamImageFileName:
        contactType === "team_support"
          ? contactForm.teamImageFileName || undefined
          : undefined,
      companyName: companyName || "",
      companyLogo:
        !isPlanSponsorContact && contactForm.companyLogo
          ? contactForm.companyLogo
          : undefined,
      benefitsCategory: modalCategory as BenefitsCategory,
      benefitsCategories: [modalCategory as BenefitsCategory],
      showOnPortal: true,
      isPrimary: shouldBePrimary,
      isPrimaryOverall: shouldBePrimary,
      isPrimaryByCategory: {
        [modalCategory as string]: shouldBePrimary,
      } as any,
      name:
        contactType === "individual"
          ? `${firstName} ${lastName}`.trim()
          : displayName,
      displayEmail: contactForm.displayEmail,
      displayPhone: contactForm.displayPhone,
      displayUrl: contactForm.enableContactButton
        ? contactForm.ctaType === "contact"
        : false,
      displayScheduleAppointment: contactForm.enableContactButton
        ? contactForm.ctaType === "schedule"
        : false,
      enableContactButton: contactForm.enableContactButton,
      contactButtonType: contactForm.enableContactButton
        ? ((contactForm.ctaType === "schedule"
            ? "calendar"
            : contactForm.ctaType === "call"
              ? "phone"
              : contactForm.ctaType === "email"
                ? "email"
                : "url") as "calendar" | "phone" | "email" | "url")
        : undefined,
      schedulingUrl:
        contactForm.enableContactButton &&
        contactForm.ctaType === "schedule"
          ? contactForm.schedulingUrl || undefined
          : undefined,
      websiteUrl:
        contactForm.enableContactButton && contactForm.ctaType === "contact"
          ? contactForm.websiteUrl || undefined
          : undefined,
    };

    // Add to local state
    const updatedContacts = [...selectedPlanContacts, newContact];
    setSelectedPlanContacts(updatedContacts);

    // Update selected plan in store to include this contact
    const currentPlan =
      currentStepData.selectedPlan ||
      plans.find((p) => p.id === currentStepData.planId);

    if (currentPlan) {
      const updatedPlan = {
        ...currentPlan,
        keyContacts: Array.isArray(currentPlan.keyContacts)
          ? [...currentPlan.keyContacts, newContact]
          : {
              ...(currentPlan.keyContacts || {}),
              contacts: [
                ...((currentPlan.keyContacts as any)?.contacts || []),
                newContact,
              ],
            },
      };

      const updatedData = {
        ...currentStepData,
        selectedPlan: updatedPlan,
        contactId: newContact.id,
      };

      // If new contact has a headshot, set it as the thumbnail for the step
      if (newContact.headshot) {
        updatedData.brandImages = {
          ...(updatedData.brandImages || {
            header: null,
            thumbnail: null,
            secondaryBanner: null,
            favicon: null,
          }),
          thumbnail: {
            url: newContact.headshot,
            fileName: contactForm.headshotFileName || "contact-photo.png",
            fileSize: 0,
            width: 0,
            height: 0,
            recommendedSize: "900 px—900 px",
            status: "ok",
            warnings: [],
          },
        };
      }

      saveStepData(1, updatedData);
    } else {
      // Fallback if no plan is selected/found
      saveStepData(1, {
        ...currentStepData,
        contactId: newContact.id,
      });
    }

    setIsFormDialogOpen(false);
    toast.success("Contact created");
  };

  const handlePlanChange = async (planId: string) => {
    setPlanLoading(true);
    // Immediately save the planId so the UI updates (selected plan name, benefit cards) without waiting for the API fetch.
    persistPlanSelection("benefits", planId);
    saveStepData(1, {
      ...currentStepData,
      planId,
      selectedPlan: null,
      benefitCategory: "",
      contactId: "",
      benefitTitle: "",
      companyLogo: null,
      brandImages: {
        header: null,
        thumbnail: null,
        secondaryBanner: null,
        favicon: null,
      },
    });
    try {
      const response = await fetch(`/api/clients/${planId}`);
      const result = await response.json();

      if (result.success && result.data) {
        const fullPlan = result.data;

        // Sync documents to Step 4 storage
        let convertedDocs: any[] = [];
        if (fullPlan.documents && Array.isArray(fullPlan.documents)) {
          convertedDocs = await Promise.all(
            fullPlan.documents.map((doc: any, index: number) =>
              convertToDocumentFormat(
                {
                  ...doc,
                  name: doc.title,
                  fileUrl: doc.fileUrl,
                  storageKey: doc.storageKey,
                },
                index,
              ),
            ),
          );
        }
        // Always update step 4 to ensure we clear documents if the new plan has none
        // Deduplicate by (id || name) + category to allow the same document in different categories
        // while preventing duplicates within the same category.
        const dedupedDocs = convertedDocs.filter((doc: any, i: number, arr: any[]) =>
          arr.findIndex((d: any) =>
            (d.id || d.name) === (doc.id || doc.name) &&
            (d.category || '') === (doc.category || '')
          ) === i
        );
        saveStepData(4, { documents: dedupedDocs });

        const planBackground =
          fullPlan.brandImages?.secondaryBanner ||
          (fullPlan.secondaryBannerImg
            ? {
                url: fullPlan.secondaryBannerImg,
                fileName: fullPlan.secondaryBannerImgName || "background.png",
                fileSize: 0,
                width: 0,
                height: 0,
                recommendedSize: "1920 px—1080 px",
                status: "ok",
                warnings: [],
              }
            : null);

        // Load existing benefit visibility from plan data
        const existingBenefits = fullPlan.employeePortalPreview?.benefits ?? [];
        const visibilityFromPlan: Record<string, boolean> = {};
        // Use primaryServiceCategories as initial defaults (only those categories start Published)
        // If there are existing benefits, respect their isEnabled values instead
        const hasExistingBenefits = existingBenefits.length > 0;

        // Helper: find benefit by category label, returns isEnabled or undefined
        const findVisibility = (label: string): boolean | undefined => {
          const target = label.toLowerCase().trim().replace(/\s+/g, " ");
          const found = existingBenefits.find((b: any) => {
            const bCat = (b.category || "").toLowerCase().trim().replace(/\s+/g, " ");
            return bCat === target;
          });
          return found !== undefined ? found.isEnabled !== false : undefined;
        };

        (["Retirement", "Group Health", "Group Life", "Company / Plan Sponsor"] as const).forEach((cat) => {
          const foundVal = findVisibility(cat);
          if (foundVal !== undefined) {
            visibilityFromPlan[cat] = foundVal;
          } else if (hasExistingBenefits) {
            // Existing benefits exist but this category not in them — mark as hidden
            visibilityFromPlan[cat] = false;
          } else {
            // No existing benefits on a newly-created plan — start with
            // everything hidden so the advisor explicitly chooses which
            // benefits to publish.
            visibilityFromPlan[cat] = false;
          }
        });

        // Also handle "Custom" key — check for a benefit with category "Custom" first,
        // then fall back to "Company / Plan Sponsor" mapping
        const customFound = findVisibility("Custom");
        if (customFound !== undefined) {
          visibilityFromPlan["Custom"] = customFound;
        } else {
          visibilityFromPlan["Custom"] = visibilityFromPlan["Company / Plan Sponsor"] ?? false;
        }

        // Client-level categoryPortalVisibility is the authoritative "hidden" signal the
        // portal uses. Respect it so newly created plans (which default to all-hidden) reflect
        // as Hidden here even if their benefit rows don't carry isEnabled=false yet.
        const planCategoryVisibility = (fullPlan as any)?.categoryPortalVisibility;
        if (
          planCategoryVisibility &&
          typeof planCategoryVisibility === "object" &&
          !Array.isArray(planCategoryVisibility)
        ) {
          const portalToStep1Label: Record<string, string> = {
            Retirement: "Retirement",
            "Group Health": "Group Health",
            "Group Life": "Group Life",
            Other: "Custom",
          };
          for (const [portalKey, step1Label] of Object.entries(portalToStep1Label)) {
            const v = (planCategoryVisibility as Record<string, boolean>)[portalKey];
            if (v !== undefined) {
              visibilityFromPlan[step1Label] = v;
            }
          }
          // Keep the "Company / Plan Sponsor" alias in sync with "Custom"
          visibilityFromPlan["Company / Plan Sponsor"] =
            visibilityFromPlan["Custom"] ?? false;
        }

        // Draft plans are still in progress — the wizard must never show their
        // benefit hubs as Published. Drafts saved from the new-client wizard can
        // carry an all-visible categoryPortalVisibility (Step 5 default), so force
        // every category Hidden until the plan is completed (status becomes Active).
        if ((fullPlan as any)?.status === "Draft") {
          visibilityFromPlan["Retirement"] = false;
          visibilityFromPlan["Group Health"] = false;
          visibilityFromPlan["Group Life"] = false;
          visibilityFromPlan["Custom"] = false;
          visibilityFromPlan["Company / Plan Sponsor"] = false;
        }

        // Sync insurance fields from the persisted plan data into step1Data
        // so that previously saved insuranceBackgroundImage, insurancePlanId,
        // and insuranceLoginUrl are available in the wizard store.
        const syncedInsuranceBg =
          fullPlan.employeePortalPreview?.insuranceBackgroundImage ||
          currentStepData.insuranceBackgroundImage ||
          "";
        const syncedInsurancePlanId =
          fullPlan.employeePortalPreview?.insurancePlanId ||
          currentStepData.insurancePlanId ||
          "";
        const syncedInsuranceLoginUrl =
          fullPlan.employeePortalPreview?.insuranceLoginUrl ||
          currentStepData.insuranceLoginUrl ||
          "";

        // Sync insurance overlay settings from persisted plan data
        const fullPlanEpp = fullPlan.employeePortalPreview || {};

        saveStepData(1, {
          ...currentStepData,
          planId,
          selectedPlan: fullPlan,
          benefitVisibility: visibilityFromPlan,
          contactId: "",
          benefitTitle: "",
          companyLogo: null,
          insuranceBackgroundImage: syncedInsuranceBg,
          insurancePlanId: syncedInsurancePlanId,
          insuranceLoginUrl: syncedInsuranceLoginUrl,
          insuranceContainerBlockOpacity:
            fullPlanEpp.insuranceContainerBlockOpacity ??
            currentStepData.insuranceContainerBlockOpacity ??
            0.8,
          brandImages: {
            ...currentStepData.brandImages,
            header: planBackground,
            thumbnail: null,
            secondaryBanner: null,
            favicon: null,
          },
        });
      } else {
        const plan = plans.find((p) => p.id === planId);
        saveStepData(1, {
          ...currentStepData,
          planId,
          selectedPlan: plan,
          contactId: "",
          benefitTitle: "",
          companyLogo: null,
          brandImages: {
            header: null,
            thumbnail: null,
            secondaryBanner: null,
            favicon: null,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching plan details:", error);
      const plan = plans.find((p) => p.id === planId);
      saveStepData(1, {
        ...currentStepData,
        planId,
        selectedPlan: plan,
        contactId: "",
        benefitTitle: "",
        companyLogo: null,
        brandImages: {
          header: null,
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        },
      });
    } finally {
      persistPlanSelection("benefits", planId);
      setLoading(false);
      setPlanLoading(false);
    }
  };

  /** Continue the Draft setup — hands off to the new-client wizard with this draft
   *  pre-loaded so the advisor can finish configuring the plan before creating Benefits. */
  const handleDraftContinue = () => {
    setDraftDialogOpen(false);
    if (resolvedPlanId) {
      storePendingDraftSelection(resolvedPlanId);
      router.push("/new/new-client");
    }
  };

  /** Cancel — revert Step 1 to a clean state with no plan selected. */
  const handleDraftCancel = () => {
    setDraftDialogOpen(false);
    saveStepData(1, {
      ...currentStepData,
      planId: "",
      selectedPlan: null,
      benefitCategory: "",
      contactId: "",
      benefitTitle: "",
      shortDescription: "",
      companyLogo: null,
      benefitVisibility: {},
      brandImages: {
        header: null,
        thumbnail: null,
        secondaryBanner: null,
        favicon: null,
      },
    });
    setSelectedPlanContacts([]);
  };

  const handleCategoryChange = (benefitCategory: string) => {
    // Normalize "Custom" → "Company / Plan Sponsor" so it matches DB and portal
    const normalizedCategory = benefitCategory === "Custom" ? "Company / Plan Sponsor" : benefitCategory;
    // Pre-fill from the `Benefit` table (source of truth), NOT the stale legacy
    // employeePortalPreview JSON (which survives Benefit-row deletion).
    const existingBenefit =
      currentStepData.categoryBenefitByApi?.[normalizeApiCategory(normalizedCategory)] ?? null;

    // User-profile branding fallback for primary service categories (row still wins).
    const profile = (profileData as any) || {};
    const primaryCats: string[] = Array.isArray(profile.primaryServiceCategories)
      ? profile.primaryServiceCategories
      : [];
    const isPrimary = primaryCats.some(
      (pc) =>
        normalizeApiCategory(String(pc)) === normalizeApiCategory(normalizedCategory) ||
        (normalizeApiCategory(String(pc)) === "other" &&
          normalizeApiCategory(normalizedCategory) === "company / plan sponsor"),
    );
    const wizardBranding = profile.wizardSessions?.[0]?.branding || {};
    const wizardUserSetup = profile.wizardSessions?.[0]?.userSetup || {};
    const userLogo = isPrimary
      ? (profile.advisorLogoUrl ||
          profile.advisorLogo ||
          wizardBranding.logo ||
          null)
      : null;
    const userHeader = isPrimary
      ? (profile.backgroundImage ||
          profile.advisorBackgroundImage ||
          wizardBranding.backgroundImage ||
          wizardUserSetup.backgroundImage ||
          null)
      : null;

    // Build a clean per-category state: every benefit-scoped field comes from the selected
    // category's OWN Benefit row (or is reset), so switching categories never carries over
    // another category's title/copy/images/journey/insurance/signature/video/help cards/hero
    // overlay. Logo & header fall back to the User profile for primary service categories.
    let newData: BenefitsStep1Data = {
      ...currentStepData,
      benefitCategory: normalizedCategory,
      contactId: existingBenefit?.contactId || "",
      benefitTitle: existingBenefit?.title || getDefaultIntroHeadline(benefitCategory),
      shortDescription: existingBenefit?.shortDescription || getDefaultIntroMessage(),
      planVideo: existingBenefit?.planVideo || undefined,
      planVideoFileName: existingBenefit?.planVideoFileName || undefined,
      planVideoRemoved: false,
      companyLogo: (existingBenefit?.partnerLogo || userLogo)
        ? ({
            url: existingBenefit?.partnerLogo || userLogo,
            fileName: "logo.png",
            fileSize: 0,
            width: 0,
            height: 0,
            hasTransparency: false,
            warnings: [],
          } as CompanyLogoData)
        : null,
      innerHeaderImage: existingBenefit?.innerHeaderImage
        ? ({
            url: existingBenefit.innerHeaderImage,
            fileName: "inner-header.png",
            fileSize: 0,
            width: 0,
            height: 0,
            hasTransparency: false,
            warnings: [],
          } as CompanyLogoData)
        : null,
      brandImages: {
        header: (existingBenefit?.backgroundImage || existingBenefit?.image || userHeader)
          ? ({
              url: existingBenefit?.backgroundImage || existingBenefit?.image || userHeader,
              fileName: "background.png",
              fileSize: 0,
              width: 0,
              height: 0,
              recommendedSize: "1920 px—1080 px",
              status: "ok" as const,
              warnings: [],
            } as BrandImageData)
          : null,
        thumbnail: null,
        secondaryBanner: null,
        favicon: null,
      },
      helpCards: existingBenefit?.helpCards || undefined,
      insurancePlanId: existingBenefit?.insurancePlanId || "",
      insuranceLoginUrl: existingBenefit?.insuranceLoginUrl || "",
      insuranceBackgroundImage: existingBenefit?.insuranceBackgroundImage || "",
      insuranceContainerBlockOpacity: existingBenefit?.insuranceContainerBlockOpacity ?? 0.8,
      journeyHeader: existingBenefit?.journeyHeader || "",
      journeySubtitle: existingBenefit?.journeySubtitle || "",
      journeyBodyText: existingBenefit?.journeyBodyText || "",
      signatureMode: existingBenefit?.signatureMode || "user",
      customClosing: existingBenefit?.customClosing || "",
      customSignatureName: existingBenefit?.customSignatureName || "",
      customSignatureCompany: existingBenefit?.customSignatureCompany || "",
      customClosingBold: existingBenefit?.customClosingBold ?? true,
      customClosingItalic: existingBenefit?.customClosingItalic ?? false,
      customSignatureNameBold: existingBenefit?.customSignatureNameBold ?? false,
      customSignatureNameItalic: existingBenefit?.customSignatureNameItalic ?? false,
      customSignatureCompanyBold: existingBenefit?.customSignatureCompanyBold ?? false,
      customSignatureCompanyItalic: existingBenefit?.customSignatureCompanyItalic ?? true,
      heroBackgroundOpacity: existingBenefit?.heroBackgroundOpacity ?? 1.0,
      heroContainerBlockOpacity: existingBenefit?.heroContainerBlockOpacity ?? 0.67,
      heroContainerInverted: existingBenefit?.heroContainerInverted ?? false,
      heroBackgroundInverted: existingBenefit?.heroBackgroundInverted ?? false,
      heroUseGradient: existingBenefit?.heroUseGradient ?? false,
    };

    // Always prefill contact when category changes to ensure correct primary contact is selected
    if (selectedPlanContacts.length > 0) {
      newData = prefillContact(benefitCategory, selectedPlanContacts, newData);
    }
    saveStepData(1, newData);

    // Auto-scroll and auto-open first section
    setActiveAccordions(["branding"]);
    setTimeout(() => {
      accordionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const handleContinue = (nextSection: string) => {
    setActiveAccordions([nextSection]);
  };

  const handleContactChange = (contactId: string) => {
    const contact = selectedPlanContacts.find((c) => c.id === contactId);
    if (contact && currentStepData.selectedPlan) {
      // Update the plan in store to mark this contact as primary for this category
      const curContacts = Array.isArray(
        currentStepData.selectedPlan.keyContacts,
      )
        ? currentStepData.selectedPlan.keyContacts
        : currentStepData.selectedPlan.keyContacts?.contacts || [];

      const updatedContacts = curContacts.map((c: any) => {
        const contactCategories = c.benefitsCategories || [];
        const sharesCategory = (contact.benefitsCategories || []).some(
          (cat: string) => contactCategories.includes(cat),
        );

        if (c.id === contactId) {
          return {
            ...c,
            isPrimary: true,
            isPrimaryOverall: true,
          };
        } else if (sharesCategory) {
          // Unmark primary for physical others in the SAME category
          return {
            ...c,
            isPrimary: false,
            isPrimaryOverall: false,
          };
        }
        return c;
      });

      const updatedPlan = {
        ...currentStepData.selectedPlan,
        keyContacts: Array.isArray(currentStepData.selectedPlan.keyContacts)
          ? updatedContacts
          : {
              ...currentStepData.selectedPlan.keyContacts,
              contacts: updatedContacts,
            },
      };

      const newData = {
        ...currentStepData,
        contactId,
        selectedPlan: updatedPlan,
      };

      // Explicitly set thumbnail if contact has a photo (check multiple fields)
      const photoUrl =
        (contact as any).headshot ||
        (contact as any).avatar ||
        (contact as any).photo ||
        (contact as any).teamImage;
      if (photoUrl) {
        newData.brandImages = {
          ...(newData.brandImages || {
            header: null,
            thumbnail: null,
            secondaryBanner: null,
            favicon: null,
          }),
          thumbnail: {
            url: photoUrl,
            fileName: "contact-photo.png",
            fileSize: 0,
            width: 0,
            height: 0,
            recommendedSize: "900 px—900 px",
            status: "ok" as const,
            warnings: [],
          },
        };
      }

      const finalData = prefillFromContact(
        contact,
        currentStepData.benefitCategory,
        newData,
      );
      saveStepData(1, finalData);
      setSelectedPlanContacts(updatedContacts);
    } else if (contact) {
      // Fallback for missing selectedPlan (shouldn't happen)
      const newData = { ...currentStepData, contactId };
      const finalData = prefillFromContact(
        contact,
        currentStepData.benefitCategory,
        newData,
      );
      saveStepData(1, finalData);
    }
  };

  const handleLogoChange = (imageData: BrandImageData) => {
    saveStepData(1, {
      ...currentStepData,
      companyLogo: convertBrandImageToLogo(imageData),
    });
  };

  // Updates the plan's brandImages (header/hero) from the shared BrandImagesSection
  // (matching the new-client wizard Step 1 "Background Image" slot: crop + set image).
  const handleBrandImagesChange = (brandImages: BrandImagesData) => {
    saveStepData(1, {
      ...currentStepData,
      brandImages: {
        ...brandImages,
        header: brandImages.header ?? null,
      },
    });
  };

  const handleThumbnailChange = (brandImage: BrandImageData | null) => {
    const thumbnail = brandImage
      ? {
          ...brandImage,
          status: "ok" as const,
          warnings: [],
        }
      : null;

    const updatedStepData = {
      ...currentStepData,
      brandImages: {
        ...currentStepData.brandImages,
        thumbnail,
      },
    };

    // Also update the headshot ON THE CONTACT ITSELF in selectedPlan
    if (currentStepData.contactId && currentStepData.selectedPlan) {
      const curContacts = Array.isArray(
        currentStepData.selectedPlan.keyContacts,
      )
        ? currentStepData.selectedPlan.keyContacts
        : currentStepData.selectedPlan.keyContacts?.contacts || [];

      const updatedContacts = curContacts.map((c: any) =>
        c.id === currentStepData.contactId
          ? {
              ...c,
              headshot: brandImage?.url,
              // Ensure this contact is primary for this category
              isPrimary: true,
              isPrimaryOverall: true,
            }
          : c,
      );

      updatedStepData.selectedPlan = {
        ...currentStepData.selectedPlan,
        keyContacts: Array.isArray(currentStepData.selectedPlan.keyContacts)
          ? updatedContacts
          : {
              ...currentStepData.selectedPlan.keyContacts,
              contacts: updatedContacts,
            },
      };

      // Sync local state too
      setSelectedPlanContacts(updatedContacts);
    }

    saveStepData(1, updatedStepData);
  };

  if (loading) {
    return (
      <div className="space-y-6 w-full mx-auto pb-20">
        <div className="border border-gray-200 shadow-sm bg-card dark:bg-gray-800 dark:border-gray-700 rounded-xl p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <div className="relative">
              <Skeleton className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto pb-20">
      {/* 1. Plan & Benefit Selection */}
      <Card className="border border-gray-200 shadow-sm bg-card dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg text-gray-900 font-bold dark:text-gray-100">
                  Plan & Benefit Selection
                </CardTitle>
                {selectedPlanName && (
                  <span
                    className="text-base font-semibold text-accent-blue truncate max-w-[280px]"
                    title={selectedPlanName}
                  >
                    {selectedPlanName}
                  </span>
                )}
              </div>
              <CardDescription className="text-sm text-gray-600 text-muted-foreground">
                Choose which plan and benefit category you want to configure.
              </CardDescription>
            </div>
            {resolvedPlanId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const plan = plans.find((p: any) => p.id === resolvedPlanId);
                  const slug = (plan as any)?.slug;
                  const resolvedSlug = slug || resolvedPlanId;
                  const url =
                    process.env.NODE_ENV === "development"
                      ? `${window.location.origin}${getBenefitsHubPath(resolvedSlug)}`
                      : getBenefitsHubAbsoluteUrl(resolvedSlug, userSubdomain);
                  window.open(url, "_blank");
                }}
                className="gap-1.5 shrink-0 bg-accent-blue text-white hover:bg-accent-blue/90"
              >
                <ExternalLink className="h-4 w-4" />
                Open Portal
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Plan Selector */}
          <div className="space-y-2">
            {/* Plan search input */}
            <div ref={planSearchContainerRef} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={planSearchInputRef}
                type="text"
                placeholder="Search for a plan"
                value={planSearchQuery}
                onChange={(e) => {
                  if (!planSearchOpen) setPlanSearchOpen(true);
                  setPlanSearchQuery(e.target.value);
                }}
                onFocus={() => setPlanSearchOpen(true)}
                onKeyDown={handlePlanSearchKeyDown}
                className="h-10 pl-9 pr-3 bg-white dark:bg-gray-700 dark:border-gray-600"
                aria-label="Search plans"
                aria-expanded={planSearchOpen}
                aria-haspopup="listbox"
                autoComplete="off"
              />
            </div>

            {/* Recent Plans quick-select chips */}
            {recentPlans.length > 0 && !loading && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Clock className="size-3 text-gray-400 shrink-0" />
                {recentPlans.map((rp) => (
                  <button
                    key={rp.id}
                    type="button"
                    onClick={() => handlePlanChange(rp.id)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                      rp.isCurrent
                        ? "bg-[#23919C]/10 text-[#23919C] border-[#23919C]/30"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#23919C]/40 hover:text-[#23919C] dark:bg-gray-700 text-muted-foreground dark:border-gray-600 dark:hover:border-[#23919C]/50",
                    )}
                  >
                    {rp.companyName}
                  </button>
                ))}
              </div>
            )}
            {plans.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground pt-1">
                No plans found for your account yet. Create a client plan first
                from the dashboard, then refresh this page.
              </p>
            ) : null}

            {/* Dropdown portal */}
            {planSearchOpen && plans.length > 0 && typeof document !== "undefined"
              ? createPortal(
                  <div
                    ref={planSearchDropdownRef}
                    role="listbox"
                    className="rounded-md border border-input bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-50"
                    style={{
                      position: "fixed",
                      top: (planSearchContainerRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                      left: planSearchContainerRef.current?.getBoundingClientRect().left ?? 0,
                      width: planSearchContainerRef.current?.getBoundingClientRect().width ?? 300,
                      maxHeight: 288,
                    }}
                  >
                    {planSearchQuery.trim() && (
                      <div className="px-3 py-1.5 border-b border-border/60">
                        <p className="text-xs text-muted-foreground">
                          {planSearchDropdownItems.length} plan{planSearchDropdownItems.length !== 1 ? "s" : ""} found
                        </p>
                      </div>
                    )}
                    <div className="overflow-y-auto max-h-[256px] py-1">
                      {planSearchDropdownItems.length > 0 && (
                        <>
                          {/* Recent plans section */}
                          {recentPlans.length > 0 && (
                            <div className="px-2 pb-1">
                              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5">
                                <Clock className="h-3 w-3" />
                                Recent
                              </div>
                              {planSearchDropdownItems
                                .filter((p) => recentPlans.some((rp) => rp.id === p.id))
                                .map((plan, idx) => {
                                  const isHi = planSearchHighlight === idx;
                                  return (
                                    <button
                                      key={`r-${plan.id}`}
                                      type="button"
                                      role="option"
                                      aria-selected={resolvedPlanId === plan.id}
                                      className={cn(
                                        "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
                                        isHi && "bg-accent-blue/10 text-accent-blue font-medium",
                                        !isHi && "hover:bg-muted",
                                      )}
                                      onClick={() => selectPlan(plan.id)}
                                      onMouseEnter={() => setPlanSearchHighlight(idx)}
                                    >
                                      {plan.companyName}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                          {/* All other plans */}
                          {planSearchDropdownItems.length > (recentPlans.length > 0 ? recentPlans.length : 0) && (
                            <div className={cn("px-2", recentPlans.length > 0 && "pt-1 border-t border-border/60")}>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5">
                                {planSearchQuery.trim() ? "Matching plans" : "All plans"}
                              </div>
                              {planSearchDropdownItems
                                .filter((p) => !recentPlans.some((rp) => rp.id === p.id))
                                .map((plan, idx) => {
                                  const globalIdx = (planSearchDropdownItems.filter((p) => recentPlans.some((rp) => rp.id === p.id))).length + idx;
                                  const isHi = planSearchHighlight === globalIdx;
                                  return (
                                    <button
                                      key={plan.id}
                                      type="button"
                                      role="option"
                                      aria-selected={resolvedPlanId === plan.id}
                                      className={cn(
                                        "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
                                        isHi && "bg-accent-blue/10 text-accent-blue font-medium",
                                        !isHi && "hover:bg-muted",
                                      )}
                                      onClick={() => selectPlan(plan.id)}
                                      onMouseEnter={() => setPlanSearchHighlight(globalIdx)}
                                    >
                                      {plan.companyName}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </>
                      )}
                      {planSearchDropdownItems.length === 0 && (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                          {planSearchQuery.trim()
                            ? "No plans match your search."
                            : "No plans available."}
                        </div>
                      )}
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          </div>

          {/* Benefit Category Cards */}
          {resolvedPlanId && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-100">
                Benefit Category <span className="text-red-500">*</span>
              </Label>

              {planLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                      <Skeleton className="size-12 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(() => {
                    const categoryConfigs = [
                      { id: "Retirement", label: "Retirement", icon: Coins },
                      { id: "Group Health", label: "Group Health", icon: Activity },
                      { id: "Group Life", label: "Group Life", icon: ShieldCheck },
                      { id: "Custom", label: "Custom", icon: Plus },
                    ];

                    return categoryConfigs.map((cat) => {
                      const status = getCategoryStatus(cat.id);
                      const isSelected =
                        currentStepData.benefitCategory === cat.id;

                      return (
                        <button
                          key={cat.id}
                          onClick={() => handleCategoryChange(cat.id)}
                          className={cn(
                            "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                            isSelected
                              ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                          )}
                        >
                          {/* Checkmark badge when selected */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 size-5 bg-[#23919C] rounded-full flex items-center justify-center">
                              <CheckCircle2 className="size-3.5 text-white" />
                            </div>
                          )}

                          {/* Icon */}
                          <div
                            className={cn(
                              "size-12 rounded-full flex items-center justify-center transition-colors",
                              isSelected
                                ? "bg-[#23919C]/10 text-[#23919C]"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
                            )}
                          >
                            <cat.icon className="size-6" />
                          </div>

                          {/* Label */}
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {cat.label}
                          </span>

                          {/* Status badge */}
                          {status ? (
                            status.isComplete ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] font-medium">
                                Complete
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-amber-600 border-amber-200 bg-amber-50 text-[10px] font-medium"
                              >
                                {status.missing?.length || 0} missing
                              </Badge>
                            )
                          ) : null}
                        </button>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Custom Category Title Input */}
              {currentStepData.benefitCategory === "Custom" && (
                <div className="space-y-2 pt-2 animate-in slide-in-from-top-2 duration-300">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-100">
                    Custom Category Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={
                      currentStepData.benefitTitle === "Custom"
                        ? ""
                        : currentStepData.benefitTitle
                    }
                    onChange={(e) =>
                      saveStepData(1, {
                        ...currentStepData,
                        benefitTitle: e.target.value,
                      })
                    }
                    placeholder="e.g. Disability Insurance, Wellness Program, HSA..."
                    className="bg-white border-gray-200 focus-visible:ring-[#23919C] h-10 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              )}

              {/* Publish/Hide toggle for each benefit category */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-100 mb-3 block">
                  Portal Visibility
                </Label>
                <p className="text-xs text-muted-foreground mb-4">
                  Published benefits appear on the Benefits Hub. Hidden benefits remain editable as drafts.
                </p>

                {planLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {["Retirement", "Group Health", "Group Life", "Custom"].map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                      >
                        <Skeleton className="h-4 w-24" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-9 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {["Retirement", "Group Health", "Group Life", "Custom"].map((cat) => {
                      const visibility = currentStepData.benefitVisibility ?? {};
                      // Draft plans default every hub to Hidden; an explicitly persisted
                      // `true` (from a publish toggle) is still honored so publishing works.
                      const isPublished =
                        isSelectedPlanDraft && visibility[cat] !== true
                          ? false
                          : visibility[cat] !== false;
                      const isToggling = togglingCategories[cat] === true;
                      return (
                        <div
                          key={cat}
                          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                        >
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-100 shrink-0 whitespace-nowrap">{cat}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {isToggling ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <span className={`text-[11px] font-semibold ${isPublished ? "text-green-600" : "text-gray-400"}`}>
                                {isPublished ? "Published" : "Hidden"}
                              </span>
                            )}
                            <Switch
                              checked={isPublished}
                              disabled={isToggling}
                              onCheckedChange={async (checked) => {
                                // Optimistic local update
                                setTogglingCategories((prev) => ({ ...prev, [cat]: true }));
                                saveStepData(1, {
                                  ...currentStepData,
                                  benefitVisibility: {
                                    ...(currentStepData.benefitVisibility ?? {}),
                                    [cat]: checked,
                                  },
                                });

                                try {
                                  // Persist to backend immediately — both client-level
                                  // categoryPortalVisibility and the per-benefit isEnabled
                                  // flag, so the portal reflects the toggle without delay.
                                  const newVisibility = {
                                    ...(currentStepData.benefitVisibility ?? {}),
                                    [cat]: checked,
                                  };
                                  const categoryPortalVisibility: Record<string, boolean> = {
                                    Retirement: newVisibility["Retirement"] !== false,
                                    "Group Health": newVisibility["Group Health"] !== false,
                                    "Group Life": newVisibility["Group Life"] !== false,
                                    Other: newVisibility["Custom"] !== false,
                                  };

                                  const clientPromise = fetch(`/api/clients/${currentStepData.planId}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ categoryPortalVisibility }),
                                  });

                                  const benefitCategory =
                                    cat === "Custom" ? "Company / Plan Sponsor" : cat;
                                  const benefitPromise = fetch(
                                    `/api/clients/${currentStepData.planId}/benefits/${encodeURIComponent(benefitCategory)}`,
                                    {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ isEnabled: checked }),
                                    },
                                  );

                                  const [clientRes, benefitRes] = await Promise.all([
                                    clientPromise,
                                    benefitPromise,
                                  ]);

                                  if (!clientRes.ok) throw new Error("Failed to save client visibility");
                                  // isEnabled benefit write is non-blocking; log a warning if it fails
                                  if (!benefitRes.ok) {
                                    console.warn(
                                      "Benefit isEnabled save returned",
                                      benefitRes.status,
                                    );
                                  }

                                  const label = cat === "Custom" ? "Custom benefit" : `${cat} benefit`;
                                  if (checked) {
                                    toast.success(`${label} published`, {
                                      description: `The ${label} is now visible on the Benefits Hub.`,
                                    });
                                  } else {
                                    toast.success(`${label} hidden`, {
                                      description: `The ${label} is now hidden on the Benefits Hub.`,
                                    });
                                  }
                                } catch (error) {
                                  console.error("Error saving visibility:", error);
                                  toast.error("Failed to save visibility", {
                                    description: "Please try again.",
                                  });
                                } finally {
                                  setTogglingCategories((prev) => ({ ...prev, [cat]: false }));
                                }
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {resolvedPlanId && currentStepData.benefitCategory && (
        <div
          ref={accordionRef}
          className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500"
        >
          <Accordion
            type="multiple"
            value={activeAccordions}
            onValueChange={setActiveAccordions}
            className="space-y-4"
          >
            {/* 1. Branding Section */}
            <AccordionItem
              value="branding"
              className="border-none shadow-md overflow-hidden bg-card rounded-xl"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50/50 group border-b bg-gray-50/30 dark:hover:bg-gray-700/40 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center justify-between w-full pr-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg transition-colors bg-teal-50 text-accent-blue dark:bg-teal-900/30 dark:text-teal-400">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground group-hover:text-[#23919C]">
                        Branding
                      </h3>
                      <p className="text-xs text-muted-foreground font-normal">
                        Provider logos and portal header assets
                      </p>
                    </div>
                  </div>
                  {currentCompleteness?.sections.branding ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3 font-bold dark:bg-green-900/40 dark:text-green-400">
                      COMPLETED
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-200 bg-amber-50 font-bold dark:text-amber-400 dark:border-amber-700 dark:bg-amber-900/30"
                    >
                      INCOMPLETE
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 space-y-8">
                <div className="flex flex-col gap-8">
                  <div className="space-y-4">
                    <BrandImageUpload
                      slotKey="companyLogo"
                      slot={{
                        title: "Benefit Logo",
                        description:
                          "Upload a logo for this specific benefit provider.",
                        recommendedSize: "900 px—900 px",
                        accept: ".svg,.png,.jpg,.jpeg",
                        required: true,
                        previewAspectRatio: 1,
                        previewLabel: "Logo preview",
                        defaultPhoteButton: false,
                      }}
                      currentImage={convertLogoToBrandImage(
                        currentStepData.companyLogo || null,
                      )}
                      onImageChange={handleLogoChange}
                      onImageRemove={() =>
                        saveStepData(1, {
                          ...currentStepData,
                          companyLogo: null,
                        })
                      }
                      hideButtons={true}
                      useUniversalModal={true}
                      universalModalType="normalizer"
                      maxFileSize={10}
                    />
                  </div>
                  <div className="space-y-4">
                    {/* Shared BrandImagesSection — the same component the
                        new-client wizard Step 1 uses for its "Background Image"
                        slot, so this hero field gets the identical crop + set
                        image behavior (SimpleImageEditorModal crop, default-photo
                        gallery, auto-crop on select). */}
                    <BrandImagesSection
                      brandImages={
                        currentStepData.brandImages || {
                          header: null,
                          thumbnail: null,
                          secondaryBanner: null,
                          favicon: null,
                        }
                      }
                      onBrandImagesChange={handleBrandImagesChange}
                      visibleSlots={["header"]}
                      errorFields={[]}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Button
                    onClick={() => handleContinue("messaging")}
                    className="bg-[#23919C] hover:bg-[#1b727a] text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-[#23919C]/20 transition-all duration-300"
                  >
                    CONTINUE TO MESSAGING
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Messaging Section */}
            <AccordionItem
              value="messaging"
              className="border-none shadow-md overflow-hidden bg-card rounded-xl"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50/50 group border-b bg-gray-50/30 dark:hover:bg-gray-700/40 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center justify-between w-full pr-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg transition-colors bg-teal-50 text-accent-blue dark:bg-teal-900/30 dark:text-teal-400">
                      <Layout className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground group-hover:text-[#23919C]">
                        Messaging
                      </h3>
                      <p className="text-xs text-muted-foreground font-normal">
                        Custom title and benefit description
                      </p>
                    </div>
                  </div>
                  {currentCompleteness?.sections.messaging ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3 font-bold dark:bg-green-900/40 dark:text-green-400">
                      COMPLETED
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-200 bg-amber-50 font-bold dark:text-amber-400 dark:border-amber-700 dark:bg-amber-900/30"
                    >
                      INCOMPLETE
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-gray-700 dark:text-gray-100">
                      Intro Headline <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={currentStepData.benefitTitle}
                      onChange={(e) =>
                        saveStepData(1, {
                          ...currentStepData,
                          benefitTitle: e.target.value,
                        })
                      }
                      placeholder={`e.g., 401(k) Retirement Plan`}
                      className="h-11 border-gray-200 dark:border-gray-600"
                      maxLength={35}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-gray-400 italic">
                        This title will override the default &ldquo;
                        {currentStepData.benefitCategory}&rdquo; label in the
                        portal.
                      </p>
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          (currentStepData.benefitTitle?.length || 0) >= 33
                            ? "text-red-500"
                            : (currentStepData.benefitTitle?.length || 0) < 10
                              ? "text-amber-500"
                              : "text-green-500",
                        )}
                      >
                        {currentStepData.benefitTitle?.length || 0} / 35
                        characters
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-gray-700 dark:text-gray-100">
                      Intro Message <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={currentStepData.shortDescription || ""}
                      onChange={(e) =>
                        saveStepData(1, {
                          ...currentStepData,
                          shortDescription: e.target.value,
                        })
                      }
                      placeholder="Provide a high-level overview of this benefit for employees..."
                      className="min-h-[120px] border-gray-200 dark:border-gray-600 resize-none"
                      maxLength={450}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-gray-400">
                        Briefly explain what this benefit is and why it matters.
                      </p>
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          (currentStepData.shortDescription?.length || 0) >= 440
                            ? "text-red-500"
                            : (currentStepData.shortDescription?.length || 0) < 100
                              ? "text-amber-500"
                              : "text-green-500",
                        )}
                      >
                        {currentStepData.shortDescription?.length || 0} / 450
                        characters
                      </span>
                    </div>
                  </div>
                </div>

                {/* Closing & Signature */}
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-gray-700 dark:text-gray-100">
                      Closing & Signature
                    </Label>
                    <RadioGroup
                      value={currentStepData.signatureMode || "user"}
                      onValueChange={(v) =>
                        saveStepData(1, {
                          ...currentStepData,
                          signatureMode: v as "user" | "custom",
                        })
                      }
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="user" id="sig-user" />
                        <Label htmlFor="sig-user" className="text-sm font-normal cursor-pointer">
                          Use Contact&rsquo;s Name & Title
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom" id="sig-custom" />
                        <Label htmlFor="sig-custom" className="text-sm font-normal cursor-pointer">
                          Custom Signature
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {(currentStepData.signatureMode || "user") === "custom" && (
                    <div className="space-y-3 pl-6 animate-in slide-in-from-top-2 duration-200">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                          Closing Text
                        </Label>
                        <Input
                          value={currentStepData.customClosing || ""}
                          onChange={(e) =>
                            saveStepData(1, {
                              ...currentStepData,
                              customClosing: e.target.value,
                            })
                          }
                          placeholder='e.g. "We hope to inspire you to save!"'
                          className="h-9 border-gray-200 dark:border-gray-600 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                          Signature Name & Title
                        </Label>
                        <Input
                          value={currentStepData.customSignatureName || ""}
                          onChange={(e) =>
                            saveStepData(1, {
                              ...currentStepData,
                              customSignatureName: e.target.value,
                            })
                          }
                          placeholder='e.g. "Ty G. Rogers Managing Partner"'
                          className="h-9 border-gray-200 dark:border-gray-600 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                          Company Name
                        </Label>
                        <Input
                          value={currentStepData.customSignatureCompany || ""}
                          onChange={(e) =>
                            saveStepData(1, {
                              ...currentStepData,
                              customSignatureCompany: e.target.value,
                            })
                          }
                          placeholder='e.g. "Waypoint Financial Advisors"'
                          className="h-9 border-gray-200 dark:border-gray-600 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Button
                    onClick={() => handleContinue("contacts")}
                    className="bg-[#23919C] hover:bg-[#1b727a] text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-[#23919C]/20 transition-all duration-300"
                  >
                    CONTINUE TO KEY CONTACTS
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Key Contact Section */}
            <AccordionItem
              value="contacts"
              className="border-none shadow-md overflow-hidden bg-card rounded-xl"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50/50 group border-b bg-gray-50/30 dark:hover:bg-gray-700/40 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center justify-between w-full pr-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg transition-colors bg-teal-50 text-accent-blue dark:bg-teal-900/30 dark:text-teal-400">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground group-hover:text-[#23919C]">
                        Key Contact
                      </h3>
                      <p className="text-xs text-muted-foreground font-normal">
                        Assign a primary support contact
                      </p>
                    </div>
                  </div>
                  {currentCompleteness?.sections.contacts ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3 font-bold dark:bg-green-900/40 dark:text-green-400">
                      ASSIGNED
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-200 bg-amber-50 font-bold dark:text-amber-400 dark:border-amber-700 dark:bg-amber-900/30"
                    >
                      UNASSIGNED
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 space-y-6">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-sm font-bold text-gray-700 dark:text-gray-100">
                      Primary Contact <span className="text-red-500">*</span>
                    </Label>
                    <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={searchOpen}
                          className="w-full justify-between bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 h-11 px-3"
                        >
                          <span className="truncate">
                            {activeContact
                              ? activeContact.name ||
                                `${activeContact.firstName} ${activeContact.lastName}` ||
                                activeContact.email
                              : "Select a contact..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                      >
                        <div className="flex items-center border-b px-3 h-11">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <input
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                            placeholder="Search contacts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-1">
                          {/* +Add New Contact - always first */}
                          <button
                            onClick={() => {
                              handleCreateContact(
                                currentStepData.benefitCategory as BenefitsCategory,
                              );
                              setSearchOpen(false);
                            }}
                            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2.5 text-sm outline-none hover:bg-accent text-[#23919C] font-bold border-b mb-1"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            ADD NEW CONTACT
                          </button>
                          {filteredContacts.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              No contacts found.
                            </div>
                          ) : (
                            filteredContacts.map((contact) => (
                              <button
                                key={contact.id}
                                onClick={() => {
                                  handleContactChange(contact.id);
                                  setSearchOpen(false);
                                  setSearchTerm("");
                                }}
                                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent text-left"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    currentStepData.contactId === contact.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {contact.name ||
                                      `${contact.firstName} ${contact.lastName}`}
                                  </span>
                                  {contact.email && (
                                    <span className="text-xs text-muted-foreground">
                                      {contact.email}
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {currentStepData.contactId && (
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 animate-in fade-in duration-300">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">
                        Contact Photo
                      </Label>
                      <BrandImageUpload
                        slotKey="headshot"
                        slot={{
                          title: "Contact Photo",
                          description: "Photo for portal display.",
                          recommendedSize: "900 px—900 px",
                          defaultPhoteButton: true,
                          required: false,
                          accept: ".png,.jpg,.jpeg",
                          previewAspectRatio: 1,
                          previewLabel: "Contact Photo preview",
                        }}
                        currentImage={
                          currentStepData.brandImages?.thumbnail ||
                          convertToBrandImage(
                            (activeContact as any)?.headshot ||
                              (activeContact as any)?.avatar ||
                              (activeContact as any)?.photo ||
                              (activeContact as any)?.teamImage,
                          )
                        }
                        onImageChange={handleThumbnailChange}
                        onImageRemove={() =>
                          saveStepData(1, {
                            ...currentStepData,
                            brandImages: {
                              ...currentStepData.brandImages,
                              thumbnail: null,
                            },
                          })
                        }
                        hideButtons={true}
                        useUniversalModal={true}
                        universalModalType="headshot"
                        maxFileSize={5}
                      />
                    </div>
                  )}

                  {/* User's Designations — only for the advisor's primary service categories */}
                  {isCurrentCategoryPrimary &&
                    profileData?.designations &&
                    profileData.designations.length > 0 && (
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                      <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                        Your Designations
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {profileData.designations.map((d: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-[#23919C]/10 px-2.5 py-1 text-xs font-medium text-[#23919C] dark:bg-[#23919C]/20 dark:text-[#23919C]"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Button
                    onClick={() => handleContinue("documents")}
                    className="bg-[#23919C] hover:bg-[#1b727a] text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-[#23919C]/20 transition-all duration-300"
                  >
                    CONTINUE TO DOCUMENTS
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Documents Section */}
            <AccordionItem
              value="documents"
              className="border-none shadow-md overflow-hidden bg-card rounded-xl"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50/50 group border-b bg-gray-50/30 dark:hover:bg-gray-700/40 dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-center justify-between w-full pr-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg transition-colors bg-teal-50 text-accent-blue dark:bg-teal-900/30 dark:text-teal-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground group-hover:text-[#23919C]">
                        {currentStepData.benefitCategory
                          ? `${currentStepData.benefitCategory} Plan Documents`
                          : "Plan Documents"}
                      </h3>
                      <p className="text-xs text-muted-foreground font-normal">
                        Essential SPDs, SBCs, and guidebooks
                      </p>
                    </div>
                  </div>
                  {currentCompleteness?.sections.documents ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3 font-bold dark:bg-green-900/40 dark:text-green-400">
                      READY
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-200 bg-amber-50 font-bold dark:text-amber-400 dark:border-amber-700 dark:bg-amber-900/30"
                    >
                      REQUIRED
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6">
                <BenefitsDocumentsSection
                  clientId={resolvedPlanId || ""}
                  documents={stepData.step4?.documents || []}
                  onChange={(docs) => saveStepData(4, { documents: docs })}
                  benefitCategory={currentStepData.benefitCategory}
                  brandColor={
                    currentStepData.selectedPlan?.brandColor || "#002B5B"
                  }
                  secondaryColor={
                    currentStepData.selectedPlan?.secondaryColor || "#E6C47A"
                  }
                  companyName={selectedPlanName || "Plan"}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Contact</DialogTitle>
            <DialogDescription>
              Add a contact for this benefit. Provide at least one way for
              employees to reach them (phone or email).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-2 items-start">
            {/* Left column: Form Fields */}
            <div className="space-y-4 min-w-0">
            {/* Contact Type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium dark:text-gray-300">
                Contact Type
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateContactForm({ contactType: "individual" })}
                  className={cn(
                    "flex flex-col p-2.5 rounded-lg border-2 text-left transition-all",
                    contactForm.contactType === "individual"
                      ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                  )}
                >
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Individual
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    A specific person
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => updateContactForm({ contactType: "team_support" })}
                  className={cn(
                    "flex flex-col p-2.5 rounded-lg border-2 text-left transition-all",
                    contactForm.contactType === "team_support"
                      ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                  )}
                >
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Team / Support Line
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    A department or group
                  </span>
                </button>
              </div>
            </div>

            {/* Primary Contact Toggle — hidden for Company / Plan Sponsor (always primary) */}
            {!isPlanSponsorContact && (
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <Checkbox
                  id="new-contact-is-primary"
                  checked={contactForm.isPrimary}
                  onCheckedChange={(checked) =>
                    updateContactForm({ isPrimary: checked === true })
                  }
                />
                <Label
                  htmlFor="new-contact-is-primary"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Mark as primary contact for{" "}
                  <span className="font-semibold">{modalCategory}</span>
                </Label>
              </div>
            )}

            {/* Name / Title / Headshot (individual) or Team fields (team_support) */}
            <ContactFormFields
              contactType={contactForm.contactType}
              firstName={contactForm.firstName}
              lastName={contactForm.lastName}
              title={contactForm.title}
              onFirstNameChange={(val) =>
                updateContactForm({ firstName: val }, ["firstName"])
              }
              onLastNameChange={(val) =>
                updateContactForm({ lastName: val }, ["lastName"])
              }
              onTitleChange={(val) =>
                updateContactForm({ title: val }, ["title"])
              }
              displayName={contactForm.displayName}
              departmentLabel=""
              supportHours=""
              onDisplayNameChange={(val) =>
                updateContactForm({ displayName: val }, ["displayName"])
              }
              onDepartmentLabelChange={() => {}}
              onSupportHoursChange={() => {}}
              headshot={contactForm.headshot}
              headshotFileName={contactForm.headshotFileName}
              onHeadshotChange={(val, name) =>
                updateContactForm({ headshot: val, headshotFileName: name })
              }
              onHeadshotRemove={() =>
                updateContactForm({ headshot: "", headshotFileName: "" })
              }
              teamImage={contactForm.teamImage}
              teamImageFileName={contactForm.teamImageFileName}
              onTeamImageChange={(val, name) =>
                updateContactForm({ teamImage: val, teamImageFileName: name })
              }
              onTeamImageRemove={() =>
                updateContactForm({ teamImage: "", teamImageFileName: "" })
              }
              firstNameRef={firstNameRef}
              lastNameRef={lastNameRef}
              titleRef={titleRef}
              errorFields={contactFormErrors}
            />

            {/* Company / Organization — required for non-Plan-Sponsor contacts */}
            {!isPlanSponsorContact && (
              <div className="space-y-1.5">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Company / Organization <span className="text-red-500">*</span>
                </Label>
                <Input
                  ref={companyNameRef}
                  value={contactForm.companyName}
                  onChange={(e) =>
                    updateContactForm({ companyName: e.target.value }, [
                      "companyName",
                    ])
                  }
                  placeholder="e.g. Benefits Provider Inc."
                  className={cn(
                    "h-8 text-sm",
                    contactFormErrors.includes("companyName") &&
                      "border-red-500",
                  )}
                />
                {contactFormErrors.includes("companyName") && (
                  <p className="text-[10px] text-red-500">
                    Company / Organization is required
                  </p>
                )}
              </div>
            )}

            {/* Phone / Email — at least one required */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Provide at least one of the following so employees can reach
                this contact: <b>Phone or Email.</b>
              </p>
              <div className="space-y-1">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Phone
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      ref={phoneRef}
                      type="tel"
                      value={formatPhoneNumber(contactForm.phone)}
                      onChange={(e) => {
                        const digits = normalizePhoneNumber(e.target.value);
                        if (digits.length <= 11) {
                          updateContactForm({ phone: digits }, [
                            "phone",
                            "email",
                          ]);
                        }
                      }}
                      placeholder="(555) 123-4567"
                      className={cn(
                        "h-8 text-sm",
                        contactFormErrors.includes("phone") && "border-red-500",
                      )}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="text"
                      maxLength={6}
                      value={contactForm.phoneExtension}
                      onChange={(e) => {
                        const val = normalizeExtension(e.target.value);
                        updateContactForm({ phoneExtension: val });
                      }}
                      placeholder="Ext."
                      className="h-8 text-sm text-center"
                    />
                  </div>
                </div>
                {contactFormErrors.includes("phone") && (
                  <p className="text-[10px] text-red-500">
                    Enter a valid phone number (or provide an email)
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Email
                </Label>
                <Input
                  ref={emailRef}
                  type="email"
                  value={contactForm.email}
                  onChange={(e) =>
                    updateContactForm({ email: e.target.value }, [
                      "email",
                      "phone",
                    ])
                  }
                  placeholder="e.g. john@company.com"
                  className={cn(
                    "h-8 text-sm",
                    contactFormErrors.includes("email") && "border-red-500",
                  )}
                />
                {contactFormErrors.includes("email") && (
                  <p className="text-[10px] text-red-500">
                    Please enter a valid email address (or provide a phone)
                  </p>
                )}
              </div>
            </div>

            {/* Contact Company Logo — non-Plan-Sponsor only */}
            {!isPlanSponsorContact && (
              <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-700">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Upload Contact Company Logo
                </Label>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Upload a logo to display on this contact&rsquo;s portal card
                  instead of the plan&rsquo;s company logo.
                </p>
                <UniversalImageEditorModal
                  value={contactForm.companyLogo || ""}
                  fileName={contactForm.companyLogoFileName || ""}
                  onChange={(value, fileName) =>
                    updateContactForm({
                      companyLogo: value,
                      companyLogoFileName: fileName || "",
                    })
                  }
                  onRemove={() =>
                    updateContactForm({
                      companyLogo: "",
                      companyLogoFileName: "",
                    })
                  }
                  placeholder="Upload Contact Company Logo"
                  modalTitle="Edit Contact Company Logo"
                  modalDescription="Upload a logo for this contact's portal card."
                  saveButtonText="Save Logo"
                  type="logo"
                />
              </div>
            )}

            {/* Call-to-Action Button */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2.5">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable-cta-button"
                  checked={contactForm.enableContactButton}
                  onCheckedChange={(checked) =>
                    updateContactForm({ enableContactButton: checked === true })
                  }
                />
                <Label
                  htmlFor="enable-cta-button"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Add a call to action button
                </Label>
              </div>

              {contactForm.enableContactButton && (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { value: "schedule", label: "Schedule Appt." },
                        { value: "call", label: "Call" },
                        { value: "email", label: "Email" },
                        { value: "contact", label: "Contact Form" },
                      ] as const
                    ).map((opt) => {
                      const isActive = contactForm.ctaType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateContactForm({ ctaType: opt.value })}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left transition-all",
                            isActive
                              ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
                              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                          )}
                        >
                          <span className="text-[11px] font-medium">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {contactForm.ctaType === "schedule" && (
                    <div className="space-y-1">
                      <Label className="dark:text-gray-300 text-xs font-medium">
                        Scheduling URL <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        ref={schedulingUrlRef}
                        value={contactForm.schedulingUrl}
                        onChange={(e) =>
                          updateContactForm(
                            { schedulingUrl: e.target.value },
                            ["schedulingUrl"],
                          )
                        }
                        placeholder="https://calendly.com/..."
                        className={cn(
                          "h-8 text-sm",
                          contactFormErrors.includes("schedulingUrl") &&
                            "border-red-500",
                        )}
                      />
                      {contactFormErrors.includes("schedulingUrl") && (
                        <p className="text-[10px] text-red-500">
                          Scheduling URL is required when &ldquo;Schedule
                          Appt.&rdquo; is enabled
                        </p>
                      )}
                    </div>
                  )}

                  {contactForm.ctaType === "contact" && (
                    <div className="space-y-1">
                      <Label className="dark:text-gray-300 text-xs font-medium">
                        Contact Form URL <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        ref={websiteUrlRef}
                        value={contactForm.websiteUrl}
                        onChange={(e) =>
                          updateContactForm(
                            { websiteUrl: e.target.value },
                            ["websiteUrl"],
                          )
                        }
                        placeholder="https://forms.company.com/..."
                        className={cn(
                          "h-8 text-sm",
                          contactFormErrors.includes("websiteUrl") &&
                            "border-red-500",
                        )}
                      />
                      {contactFormErrors.includes("websiteUrl") && (
                        <p className="text-[10px] text-red-500">
                          Contact Form URL is required when &ldquo;Contact
                          Form&rdquo; is enabled
                        </p>
                      )}
                    </div>
                  )}

                  {contactForm.ctaType === "call" && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5">
                      {contactForm.phone
                        ? `${formatPhoneNumber(contactForm.phone)}${
                            contactForm.phoneExtension
                              ? ` ext. ${contactForm.phoneExtension}`
                              : ""
                          }`
                        : "Complete the Phone field above first"}
                    </p>
                  )}

                  {contactForm.ctaType === "email" && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5">
                      {contactForm.email ||
                        "Complete the Email field above first"}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Email / Phone Visibility Toggles */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
              <Label className="dark:text-gray-300 text-xs font-medium">
                Show on contact card
              </Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="display-email"
                  checked={contactForm.displayEmail}
                  onCheckedChange={(checked) =>
                    updateContactForm({ displayEmail: checked === true })
                  }
                />
                <Label
                  htmlFor="display-email"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Email
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="display-phone"
                  checked={contactForm.displayPhone}
                  onCheckedChange={(checked) =>
                    updateContactForm({ displayPhone: checked === true })
                  }
                />
                <Label
                  htmlFor="display-phone"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Phone
                </Label>
              </div>
            </div>
            </div>

            {/* Right column: Live Portal Preview of the contact card */}
            <div className="flex flex-col items-center gap-2 lg:sticky lg:top-0 self-start w-full">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-blue text-center">
                Portal Preview
              </span>
              <SmallVerticalCard
                contact={{
                  id: "preview",
                  contactType: contactForm.contactType,
                  name:
                    contactForm.contactType === "individual"
                      ? `${contactForm.firstName} ${contactForm.lastName}`.trim()
                      : contactForm.displayName,
                  firstName: contactForm.firstName,
                  lastName: contactForm.lastName,
                  title:
                    contactForm.contactType === "individual"
                      ? contactForm.title
                      : undefined,
                  displayName:
                    contactForm.contactType === "team_support"
                      ? contactForm.displayName
                      : undefined,
                  email: contactForm.email,
                  phone: contactForm.phone,
                  phoneExtension: contactForm.phoneExtension,
                  headshot:
                    contactForm.contactType === "individual"
                      ? contactForm.headshot || undefined
                      : undefined,
                  teamImage:
                    contactForm.contactType === "team_support"
                      ? contactForm.teamImage || undefined
                      : undefined,
                  companyName:
                    contactForm.companyName ||
                    (isPlanSponsorContact ? selectedPlanName || "" : ""),
                  companyLogo:
                    !isPlanSponsorContact && contactForm.companyLogo
                      ? contactForm.companyLogo
                      : (currentStepData.selectedPlan as any)?.companyLogo
                            ?.url ||
                        (typeof (currentStepData.selectedPlan as any)
                          ?.companyLogo === "string"
                          ? (currentStepData.selectedPlan as any)?.companyLogo
                          : "") ||
                        "",
                  benefitsCategory:
                    modalCategory === "Group Health"
                      ? "Health Insurance"
                      : modalCategory === "Group Life"
                        ? "Life Insurance"
                        : (modalCategory as any),
                  isPrimary:
                    isPlanSponsorContact || contactForm.isPrimary,
                  displayEmail: contactForm.displayEmail,
                  displayPhone: contactForm.displayPhone,
                  enableContactButton: contactForm.enableContactButton,
                  contactButtonType: contactForm.enableContactButton
                    ? (contactForm.ctaType === "schedule"
                        ? "calendar"
                        : contactForm.ctaType === "call"
                          ? "phone"
                          : contactForm.ctaType === "email"
                            ? "email"
                            : "url")
                    : undefined,
                  schedulingUrl:
                    contactForm.enableContactButton &&
                    contactForm.ctaType === "schedule"
                      ? contactForm.schedulingUrl
                      : undefined,
                  websiteUrl:
                    contactForm.enableContactButton &&
                    contactForm.ctaType === "contact"
                      ? contactForm.websiteUrl
                      : undefined,
                }}
                brandColor={
                  currentStepData.selectedPlan?.brandColor || "#002B5B"
                }
                secondaryColor={
                  currentStepData.selectedPlan?.secondaryColor || "#E6C47A"
                }
                appointmentLink={
                  (currentStepData.selectedPlan as any)?.appointmentLink || ""
                }
                // Only Plan Sponsor contacts fall back to the plan's company name;
                // for the other categories the preview shows a [Company / Organization]
                // placeholder until the user types the provider's company.
                companyName={isPlanSponsorContact ? selectedPlanName : ""}
                index={0}
                disableAnimation={true}
                baselineBackgroundColor="#ffffff"
                compact
                previewPlaceholders
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsFormDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleFormSubmit}>Create Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft plan guard — Benefits cannot be created for a plan still in Draft status. */}
      <Dialog
        open={draftDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleDraftCancel();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Draft Plan</DialogTitle>
            <DialogDescription>
              {draftPlanName} plan is still a Draft. Creating a Benefit for this
              plan isn&rsquo;t allowed for Drafts. Continue the setup to finish
              this plan first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDraftCancel}>
              Cancel
            </Button>
            <Button onClick={handleDraftContinue}>Continue Setup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
