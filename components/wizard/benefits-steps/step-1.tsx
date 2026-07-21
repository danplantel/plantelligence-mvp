"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  BenefitsStep1Data,
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
import { ContactFormFields } from "@/components/wizard/new-client-steps/step-3-key-contacts/components/contact-form-fields";
import {
  BenefitsCategory,
  KeyContact,
  CompanyLogoData,
  BrandImageData,
  BrandImagesData,
} from "@/types/new-client-wizard";
import { BrandImageUpload } from "@/components/ui/brand-image-upload";
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
import { resolvePersistedDocumentCategory } from "@/lib/document-category";
import { persistNewDocumentsToApi } from "@/lib/benefits-document-persist";
import { fetchPlanDocumentsForClient } from "@/lib/fetch-plan-documents-client";
import { ComplianceDocumentsUpload } from "@/components/pages/documents/components/compliance-documents-upload";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DocumentListTab } from "@/components/pages/documents/tabs/document-list-tab";
import { RetirementDocumentsAccordion, RetirementDocumentItem } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { detectDocumentType } from "@/lib/compliance-document-utils";
import { normalizePortalDocumentLanguage } from "@/lib/portal-document-language";
import type { Document as DocModuleDocument, SortColumn, SortDirection } from "@/components/pages/documents/types";
/** Wizard order — matches accordion below (Branding → Messaging → Contacts → Documents). */
const BENEFIT_SETUP_SECTION_ORDER = [
  { key: "branding" as const, label: "Branding" },
  { key: "messaging" as const, label: "Messaging" },
  { key: "contacts" as const, label: "Contacts" },
  { key: "documents" as const, label: "Documents" },
];

export function BenefitsStep1() {
  const { stepData, saveStepData } = useBenefitsWizardStore();
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
  const [activeDocTab, setActiveDocTab] = useState("list");
  const [docSortColumn, setDocSortColumn] = useState<SortColumn>("uploadedAt");
  const [docSortDirection, setDocSortDirection] = useState<SortDirection>("desc");
  const [docPreviewLang, setDocPreviewLang] = useState<"EN" | "ES">("EN");

  // Plan search bar state
  const [planSearchOpen, setPlanSearchOpen] = useState(false);
  const [planSearchQuery, setPlanSearchQuery] = useState("");
  const [planSearchHighlight, setPlanSearchHighlight] = useState(0);
  const planSearchInputRef = useRef<HTMLInputElement>(null);
  const planSearchContainerRef = useRef<HTMLDivElement>(null);
  const planSearchDropdownRef = useRef<HTMLDivElement>(null);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phoneExtension: "",
    title: "",
    headshot: "",
    headshotFileName: "",
  });

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

    // Sync current wizard state to employeePortalPreview.benefits
    if (currentStepData.benefitCategory) {
      const benefits = merged.employeePortalPreview?.benefits || [];
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

  // Auto-expand incomplete sections
  useEffect(() => {
    if (!currentCompleteness?.sections) return;

    const incomplete = Object.entries(currentCompleteness.sections)
      .filter(([_, isDone]) => !isDone)
      .map(([name]) => name);

    if (incomplete.length > 0) {
      setActiveAccordions(incomplete);
    } else {
      // All complete, collapse all
      setActiveAccordions([]);
    }
  }, [currentStepData.benefitCategory, currentCompleteness?.isComplete]);

  // Debounced auto-save to database (also saves isEnabled from benefitVisibility toggles)
  useEffect(() => {
    if (
      !getMergedClientData ||
      !currentStepData.planId
    )
      return;

    const timer = setTimeout(async () => {
      try {
        // Derive categoryPortalVisibility from benefitVisibility toggles
        // so the portal header filter (which checks both sources) works correctly.
        const visibility = currentStepData.benefitVisibility ?? {};
        const categoryPortalVisibility: Record<string, boolean> = {
          Retirement: visibility["Retirement"] !== false,
          "Group Health": visibility["Group Health"] !== false,
          "Group Life": visibility["Group Life"] !== false,
          Other: visibility["Custom"] !== false,
        };

        // Merge insurance fields into employeePortalPreview for persistence
        const employeePortalPreviewWithInsurance = {
          ...getMergedClientData.employeePortalPreview,
          insurancePlanId: currentStepData.insurancePlanId || "",
          insuranceLoginUrl: currentStepData.insuranceLoginUrl || "",
          insuranceBackgroundImage: currentStepData.insuranceBackgroundImage || "",
          insuranceContainerBlockOpacity: currentStepData.insuranceContainerBlockOpacity ?? 0.8,
        };

        await fetch(`/api/clients/${currentStepData.planId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeePortalPreview: employeePortalPreviewWithInsurance,
            categoryPortalVisibility,
          }),
        });
      } catch (error) {
        console.error("Auto-save error:", error);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [getMergedClientData, currentStepData.planId]);

  // Fetch user's primary service categories for initial visibility defaults
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "same-origin" });
        const data = await res.json();
        const cats: string[] = (data as any)?.primaryServiceCategories ?? [];
        if (cats.length > 0) setPrimaryServiceCategories(cats);
      } catch { /* non-critical */ }
    })();
  }, []);

  useEffect(() => {
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
  useEffect(() => {
    const planId = currentStepData.planId;
    if (!planId?.trim() || plans.length === 0) return;
    if (currentStepData.selectedPlan?.id === planId) return;

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
          saveStepData(4, { documents: convertedDocs });

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
              header:
                planBackground ?? latest.brandImages?.header ?? null,
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
      benefitTitle:
        baseData.benefitTitle || (category === "Custom" ? "" : category),
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
  }, [currentStepData.planId, plans, currentStepData.benefitCategory]);

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

    // Check if benefit exists in employeePortalPreview (original or merged)
    const benefits = dataForCompleteness.employeePortalPreview?.benefits || [];
    const catKey = normalizeBenefitsCategoryForCompleteness(catId);
    const existingBenefit = benefits.find((b: any) => {
      const bKey = normalizeBenefitsCategoryForCompleteness(
        String(b?.category ?? ""),
      );
      return bKey === catKey;
    });

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
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      phoneExtension: "",
      title: "",
      headshot: "",
      headshotFileName: "",
    });
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = () => {
    if (!contactForm.firstName || !contactForm.lastName || !contactForm.title) {
      toast.error("Please fill in all required fields (Name and Title)");
      return;
    }

    // Create a new contact object
    const newContact: KeyContact = {
      id: `new-contact-${Date.now()}`,
      contactType: "individual",
      firstName: contactForm.firstName,
      lastName: contactForm.lastName,
      email: contactForm.email,
      phone: contactForm.phone,
      phoneExtension: contactForm.phoneExtension,
      title: contactForm.title,
      headshot: contactForm.headshot,
      benefitsCategory: modalCategory as BenefitsCategory,
      benefitsCategories: [modalCategory as BenefitsCategory],
      showOnPortal: true,
      isPrimary: true, // Mark as primary for this wizard flow
      isPrimaryByCategory: {
        [modalCategory as string]: true,
      } as any,
      name: `${contactForm.firstName} ${contactForm.lastName}`,
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
    toast.success("New contact placeholder created. Please fill in details.");
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
        // Deduplicate by ID to prevent duplicates from race conditions
        const dedupedDocs = convertedDocs.filter((doc: any, i: number, arr: any[]) =>
          arr.findIndex((d: any) => (d.id || d.name) === (doc.id || doc.name)) === i
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
            // No existing benefits — use primaryServiceCategories as the default
            const catLabel = cat === "Company / Plan Sponsor" ? "Retirement" : cat;
            visibilityFromPlan[cat] = primaryServiceCategories.includes(catLabel);
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

  const handleCategoryChange = (benefitCategory: string) => {
    const selectedPlan =
      currentStepData.selectedPlan ||
      plans.find((p) => p.id === currentStepData.planId);
    const benefits = selectedPlan?.employeePortalPreview?.benefits || [];
    const catKey = normalizeBenefitsCategoryForCompleteness(benefitCategory);
    const existingBenefit = benefits.find((b: any) => {
      const bKey = normalizeBenefitsCategoryForCompleteness(
        String(b?.category ?? ""),
      );
      return bKey === catKey;
    });

    let newData: BenefitsStep1Data = {
      ...currentStepData,
      benefitCategory,
      contactId: existingBenefit?.contactId || "",
      benefitTitle: existingBenefit?.title || benefitCategory,
      shortDescription: existingBenefit?.shortDescription || "",
      // Reset or load images for the new category
      companyLogo: existingBenefit?.partnerLogo
        ? ({
            url: existingBenefit.partnerLogo,
            fileName: "logo.png",
            fileSize: 0,
            width: 0,
            height: 0,
            hasTransparency: false,
            warnings: [],
          } as CompanyLogoData)
        : null,
      brandImages: {
        header: existingBenefit?.image
          ? ({
              url: existingBenefit.image,
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

  const handleBackgroundImageChange = (imageData: BrandImageData) => {
    saveStepData(1, {
      ...currentStepData,
      brandImages: { ...currentStepData.brandImages, header: imageData },
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
              <CardTitle className="text-lg text-gray-900 font-bold dark:text-gray-100">
                Plan & Benefit Selection
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 text-muted-foreground">
                Choose which plan and benefit category you want to configure.
              </CardDescription>
            </div>
            {resolvedPlanId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/new/view/${resolvedPlanId}`, "_blank")}
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
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-100">
              Select Plan <span className="text-red-500">*</span>
            </Label>

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

            {/* Plan search input */}
            <div ref={planSearchContainerRef} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={planSearchInputRef}
                type="text"
                placeholder={selectedPlanName || "Search plans\u2026"}
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

              {/* Selected plan indicator */}
              {currentStepData.benefitCategory && resolvedPlanId && (
                <div className="flex items-center gap-2 pt-1 text-sm text-gray-500 dark:text-gray-400">
                  <Building2 className="size-3.5" />
                  <span>
                    Configuring{" "}
                    <span className="font-medium text-gray-700 dark:text-gray-100">
                      {currentStepData.benefitCategory === "Custom"
                        ? currentStepData.benefitTitle || "Custom"
                        : currentStepData.benefitCategory}
                    </span>{" "}
                    for{" "}
                    <span className="font-medium text-gray-700 dark:text-gray-100">
                      {plans.find((p) => p.id === resolvedPlanId)?.companyName ||
                        "selected plan"}
                    </span>
                  </span>
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
                      const isPublished = visibility[cat] !== false;
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
                                  // Persist to backend immediately
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

                                  const response = await fetch(`/api/clients/${currentStepData.planId}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ categoryPortalVisibility }),
                                  });

                                  if (!response.ok) throw new Error("Failed to save");

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
                    <div
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        currentCompleteness?.sections.branding
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                          : "bg-teal-50 text-[#23919C] dark:bg-teal-900/30 dark:text-teal-400",
                      )}
                    >
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
                    <BrandImageUpload
                      slotKey="header"
                      slot={{
                        title: "Background Header Image (Hero)",
                        description:
                          "This image displays in the header background of your Employee Benefits Hub. Upload a wide hero image for best results. If not uploading a picture, the Square Thumbnail will be used.",
                        recommendedSize: "1920 px—1080 px",
                        defaultPhoteButton: true,
                        required: true,
                        accept: ".png,.jpg,.jpeg",
                        previewAspectRatio: 2.75,
                        previewLabel: "Hero preview (2.75:1)",
                      }}
                      currentImage={
                        currentStepData.brandImages?.header || undefined
                      }
                      onImageChange={handleBackgroundImageChange}
                      onImageRemove={() =>
                        saveStepData(1, {
                          ...currentStepData,
                          brandImages: {
                            ...currentStepData.brandImages,
                            header: null,
                          },
                        })
                      }
                      hideButtons={true}
                      useUniversalModal={true}
                      universalModalType="normalizer"
                      maxFileSize={10}
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
                    <div
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        currentCompleteness?.sections.messaging
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                          : "bg-teal-50 text-[#23919C] dark:bg-teal-900/30 dark:text-teal-400",
                      )}
                    >
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
                      Display Title
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
                      maxLength={24}
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
                          (currentStepData.benefitTitle?.length || 0) >= 22
                            ? "text-red-500"
                            : (currentStepData.benefitTitle?.length || 0) < 10
                              ? "text-amber-500"
                              : "text-green-500",
                        )}
                      >
                        {currentStepData.benefitTitle?.length || 0} / 24
                        characters
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-gray-700 dark:text-gray-100">
                      Benefit Description
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
                      maxLength={120}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-gray-400">
                        Briefly explain what this benefit is and why it matters.
                      </p>
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          (currentStepData.shortDescription?.length || 0) >= 110
                            ? "text-red-500"
                            : (currentStepData.shortDescription?.length || 0) < 50
                              ? "text-amber-500"
                              : "text-green-500",
                        )}
                      >
                        {currentStepData.shortDescription?.length || 0} / 120
                        characters
                      </span>
                    </div>
                  </div>
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
                    <div
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        currentCompleteness?.sections.contacts
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                          : "bg-teal-50 text-[#23919C] dark:bg-teal-900/30 dark:text-teal-400",
                      )}
                    >
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
                    <div
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        currentCompleteness?.sections.documents
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                          : "bg-teal-50 text-[#23919C] dark:bg-teal-900/30 dark:text-teal-400",
                      )}
                    >
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
                <Tabs value={activeDocTab} onValueChange={setActiveDocTab}>
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="list">List</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="upload">Upload</TabsTrigger>
                  </TabsList>

                  {/* ── List Tab ── */}
                  <TabsContent value="list">
                    {(() => {
                      const category = currentStepData.benefitCategory;
                      const planDocs = (stepData.step4?.documents || []) as any[];
                      const filteredDocs = category
                        ? planDocs.filter((doc) =>
                            resolvePersistedDocumentCategory(
                              "Document",
                              doc.category,
                              (doc as { storageKey?: string }).storageKey,
                            ) === resolvePersistedDocumentCategory("Document", category)
                          )
                        : planDocs;

                      const listFormatted: DocModuleDocument[] = filteredDocs.map((doc) => ({
                        id: doc.id,
                        title: doc.name,
                        fileName: doc.originalFileName || doc.name,
                        type: "Document" as const,
                        uploadedAt: new Date().toISOString(),
                        client: {
                          id: resolvedPlanId || "current",
                          companyName: selectedPlanName || "Plan",
                        },
                        category: doc.category,
                        categorySuggested: doc.categorySuggested,
                        categoryConfidence: doc.categoryConfidence,
                        expirationDate: doc.expirationDate,
                      }));

                      const sorted = [...listFormatted].sort((a, b) => {
                        const col = docSortColumn;
                        let aVal: any = col === "uploadedAt" ? new Date(a[col]).getTime() : String(a[col]).toLowerCase();
                        let bVal: any = col === "uploadedAt" ? new Date(b[col]).getTime() : String(b[col]).toLowerCase();
                        return docSortDirection === "asc"
                          ? aVal > bVal ? 1 : -1
                          : aVal < bVal ? 1 : -1;
                      });

                      const handleSort = (col: SortColumn) => {
                        if (docSortColumn === col) {
                          setDocSortDirection((prev) => prev === "asc" ? "desc" : "asc");
                        } else {
                          setDocSortColumn(col);
                          setDocSortDirection("asc");
                        }
                      };

                      return (
                        <DocumentListTab
                          selectedPlan={resolvedPlanId || ""}
                          isLoading={false}
                          documents={sorted}
                          sortColumn={docSortColumn}
                          sortDirection={docSortDirection}
                          onSort={handleSort}
                          onPreview={() => setActiveDocTab("preview")}
                          getDocumentType={(doc) => detectDocumentType(doc.fileName)}
                          onDelete={(id, name) => {
                            const docs = (stepData.step4?.documents || []).filter((d: any) => d.id !== id);
                            saveStepData(4, { documents: docs });
                          }}
                          onDownload={(id) => {
                            const doc = filteredDocs.find((d: any) => d.id === id);
                            if (doc?.file) {
                              const link = document.createElement("a");
                              link.href = doc.file;
                              link.download = doc.originalFileName || doc.name;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }}
                          onEdit={(id, title, updates) => {
                            if (updates?.category) {
                              const docs = (stepData.step4?.documents || []).map((d: any) =>
                                d.id === id ? { ...d, category: updates.category } : d
                              );
                              saveStepData(4, { documents: docs });
                              toast.success("Category updated");
                            }
                          }}
                          availableCategories={["Retirement", "Group Health", "Group Life", "Other Benefits"]}
                          onGoToUpload={() => setActiveDocTab("upload")}
                        />
                      );
                    })()}
                  </TabsContent>

                  {/* ── Preview Tab ── */}
                  <TabsContent value="preview">
                    {(() => {
                      const docs4 = (stepData.step4?.documents || []) as any[];
                      const category = currentStepData.benefitCategory;
                      const filtered = category
                        ? docs4.filter((doc) =>
                            resolvePersistedDocumentCategory(
                              "Document",
                              doc.category,
                              (doc as { storageKey?: string }).storageKey,
                            ) === resolvePersistedDocumentCategory("Document", category)
                          )
                        : docs4;

                      const previewItems: RetirementDocumentItem[] = filtered
                        .filter((doc) =>
                          normalizePortalDocumentLanguage(doc.language, "EN") === docPreviewLang
                        )
                        .map((doc) => ({
                          id: doc.id,
                          title: doc.name,
                          description: doc.shortDescription || doc.name,
                          href: doc.file,
                          language: normalizePortalDocumentLanguage(doc.language, "EN"),
                        }));

                      const langs = Array.from(
                        new Set<string>(
                          docs4.map((d: any) => normalizePortalDocumentLanguage(d.language, "EN")),
                        ),
                      ).sort() as ("EN" | "ES")[];

                      return (
                        <div className="space-y-4">
                          {langs.length > 1 && (
                            <div className="flex gap-2">
                              {langs.map((lang) => (
                                <button
                                  key={lang}
                                  onClick={() => setDocPreviewLang(lang)}
                                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                    docPreviewLang === lang
                                      ? "bg-primary text-white border-primary"
                                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                  }`}
                                >
                                  {lang === "EN" ? "English" : "Español"}
                                </button>
                              ))}
                            </div>
                          )}
                          <RetirementDocumentsAccordion
                            brandColor={currentStepData.selectedPlan?.brandColor || "#002B5B"}
                            accentColor={currentStepData.selectedPlan?.secondaryColor || "#E6C47A"}
                            retirementDocs={previewItems}
                            title={`${category || "Plan"} Documents & Forms`}
                            description={`Access all your important ${(category || "plan").toLowerCase()} plan documents and forms.`}
                          />
                        </div>
                      );
                    })()}
                  </TabsContent>

                  {/* ── Upload Tab ── */}
                  <TabsContent value="upload">
                    <ComplianceDocumentsUpload
                      clientId={resolvedPlanId}
                      initialDocuments={stepData.step4?.documents || []}
                      onDocumentsChange={(docs) => {
                        // Deduplicate by ID before saving to prevent duplicates
                        const seen = new Set<string>();
                        const deduped = docs.filter((d: any) => {
                          const key = d.id || d.name || d.file;
                          if (seen.has(key)) return false;
                          seen.add(key);
                          return true;
                        });
                        saveStepData(4, { documents: deduped });
                        if (!resolvedPlanId) return;
                        void (async () => {
                          const id = resolvedPlanId;
                          const merged = await persistNewDocumentsToApi(id, deduped);
                          const next = merged !== deduped ? merged : deduped;
                          saveStepData(4, { documents: next });
                          try {
                            const rows = await fetchPlanDocumentsForClient(id);
                            if (rows.length > 0) {
                              const converted = await Promise.all(
                                (rows as any[]).map((doc: any, index: number) =>
                                  convertToDocumentFormat(
                                    { ...doc, name: doc.title, fileUrl: doc.fileUrl, storageKey: doc.storageKey },
                                    index,
                                  ),
                                ),
                              );
                              // Deduplicate refetched docs too
                              const seenRefetch = new Set<string>();
                              const dedupedConverted = converted.filter((d: any) => {
                                const key = d.id || d.name || d.file;
                                if (seenRefetch.has(key)) return false;
                                seenRefetch.add(key);
                                return true;
                              });
                              saveStepData(4, { documents: dedupedConverted });
                            }
                          } catch (e) {
                            console.error("Refetch plan documents after upload failed", e);
                          }
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("plan-documents-persisted", {
                                detail: { clientId: id },
                              }),
                            );
                          }
                        })();
                      }}
                      fixedCategory={currentStepData.benefitCategory as BenefitsCategory}
                      filterDocuments={(doc) => {
                        const b = currentStepData.benefitCategory;
                        if (!b) return true;
                        return (
                          resolvePersistedDocumentCategory("Document", doc.category, (doc as { storageKey?: string }).storageKey) ===
                          resolvePersistedDocumentCategory("Document", b)
                        );
                      }}
                      showInfoCard={false}
                      showPreview={false}
                    />
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Contact</DialogTitle>
            <DialogDescription>
              Enter the details for the primary contact of this benefit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <ContactFormFields
              contactType="individual"
              firstName={contactForm.firstName}
              lastName={contactForm.lastName}
              title={contactForm.title}
              onFirstNameChange={(val) =>
                setContactForm((prev) => ({ ...prev, firstName: val }))
              }
              onLastNameChange={(val) =>
                setContactForm((prev) => ({ ...prev, lastName: val }))
              }
              onTitleChange={(val) =>
                setContactForm((prev) => ({ ...prev, title: val }))
              }
              displayName=""
              departmentLabel=""
              supportHours=""
              onDisplayNameChange={() => {}}
              onDepartmentLabelChange={() => {}}
              onSupportHoursChange={() => {}}
              headshot={contactForm.headshot}
              headshotFileName={contactForm.headshotFileName}
              onHeadshotChange={(val, name) =>
                setContactForm((prev) => ({
                  ...prev,
                  headshot: val,
                  headshotFileName: name,
                }))
              }
              onHeadshotRemove={() =>
                setContactForm((prev) => ({
                  ...prev,
                  headshot: "",
                  headshotFileName: "",
                }))
              }
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="dark:text-gray-100">Email</Label>
                <Input
                  value={contactForm.email}
                  onChange={(e) =>
                    setContactForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="dark:text-gray-100">Phone</Label>
                <div className="flex gap-4">
                  <div className="flex-grow">
                    <Input
                      value={formatPhoneNumber(contactForm.phone)}
                      onChange={(e) => {
                        const normalized = normalizePhoneNumber(e.target.value);
                        if (normalized.length <= 11) {
                          setContactForm((prev) => ({
                            ...prev,
                            phone: normalized,
                          }));
                        }
                      }}
                      placeholder="(555) 000-0000"
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      value={contactForm.phoneExtension}
                      onChange={(e) => {
                        const normalized = normalizeExtension(e.target.value);
                        setContactForm((prev) => ({
                          ...prev,
                          phoneExtension: normalized,
                        }));
                      }}
                      placeholder="Ext."
                      maxLength={6}
                    />
                  </div>
                </div>
              </div>
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
    </div>
  );
}
