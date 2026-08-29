"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Users,
  Shield,
  Heart,
  Gift,
  Monitor,
  Smartphone,
  Pencil,
  Mail,
  Phone,
  Star,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import {
  EditClientHeader,
  EditClientPreview,
  EditClientLoading,
  EditClientError,
} from "@/components/pages/edit-client";
import { SaveButton } from "@/components/pages/edit-client/save-button";
import { useEditClient } from "@/hooks/useEditClient";
// Import components from new-client-steps
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import { ContactFormFields } from "@/components/wizard/new-client-steps/step-3-key-contacts/components/contact-form-fields";
import { SmallVerticalCard } from "@/components/pages/my-benefits-team/small-vertical-card";
import { BrandImagesSection } from "@/components/wizard/new-client-steps/sections/brand-images-section";
import { ComplianceDocumentsUpload } from "@/components/pages/documents/components/compliance-documents-upload";
import { DocumentPreviewTab } from "@/components/pages/documents/tabs/document-preview-tab";
import { DocumentListTab } from "@/components/pages/documents/tabs/document-list-tab";
import { DocumentPreviewModal } from "@/components/pages/documents/components/document-preview-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
} from "@/components/wizard/steps/sections/user-setup-section/user-setup-section.funcs";
import { deleteFromR2 } from "@/lib/upload-to-r2";
import type {
  Document as DocumentsModuleDocument,
  SortColumn,
  SortDirection,
} from "@/components/pages/documents/types";
import { AddMoreContactsModal } from "@/components/wizard/new-client-steps/step-3-key-contacts/components/add-more-contacts-modal";
import { BrandingImage } from "@/components/ui/branding-image";
import { Headshot } from "@/components/ui/headshot";
import type { RetirementDocumentItem } from "@/components/pages/client-portal/sections/retirement-documents-accordion";
import { PlanMeetingsSection } from "@/components/pages/edit-client/plan-meetings-section";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ContactCardLayoutPreviewModal } from "@/components/pages/edit-client/contact-card-layout-preview-modal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Globe,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PRIMARY_SERVICE_CATEGORY_OPTIONS } from "@/lib/service-categories";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  WELCOME_BODY_PRESETS,
  MISSION_STATEMENT_PRESETS,
} from "@/components/wizard/new-client-steps/constants/welcome-statements";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  CompanyBasicsData,
  CompanyLogoData,
  BrandImagesData,
  KeyContact,
  ComplianceDocumentsData,
  BenefitsCategory,
  Document,
} from "@/types/new-client-wizard";
import { EditPlanPreviewSection } from "@/components/wizard/new-client-steps/sections/edit-plan-preview-section";
import { BrandColorsSection } from "@/components/wizard/new-client-steps/sections/brand-colors-section";
import { CardSelectionModal } from "@/components/wizard/new-client-steps/card-selection-modal";
import { PortalDisclaimers } from "@/components/pages/client-portal/sections/portal-disclaimers";
import { uploadBrandingToR2 } from "@/lib/branding-r2";
import {
  getR2ObjectProxyUrl,
  toR2BrandingKey,
} from "@/lib/branding-image-url";
import {
  resolveDefaultDisclosuresText,
  ensurePlanTelligenceTrademark,
} from "@/lib/disclaimer-constants";
import { DisclaimerUpdateConfirmDialog } from "@/components/pages/settings/disclaimer-update-confirm-dialog";

// ============================================================================
// Helper Components
// ============================================================================

/** Format a 10-digit phone as (XXX)-XXX-XXXX (e.g. 3333333333 → (333)-333-3333). */
const formatContactPhone = (phone?: string): string => {
  const digits = (phone || "").replace(/\D/g, "");
  const national = digits.length > 10 ? digits.slice(1) : digits;
  if (national.length !== 10) return phone || "";
  return `(${national.slice(0, 3)})-${national.slice(3, 6)}-${national.slice(6, 10)}`;
};

// Accordion metadata for each benefit category (icons used in the trigger header).
const CATEGORY_ACCORDIONS: {
  id: BenefitsCategory;
  label: string;
  value: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "Retirement" as BenefitsCategory,
    label: "Retirement",
    value: "retirement",
    icon: <Building2 className="w-5 h-5 text-accent-blue" />,
  },
  {
    id: "Group Health" as BenefitsCategory,
    label: "Group Health",
    value: "group-health",
    icon: <Shield className="w-5 h-5 text-accent-blue" />,
  },
  {
    id: "Group Life" as BenefitsCategory,
    label: "Group Life",
    value: "group-life",
    icon: <Heart className="w-5 h-5 text-accent-blue" />,
  },
  {
    id: "Other Benefits" as BenefitsCategory,
    label: "Other Benefits",
    value: "other-benefits",
    icon: <Gift className="w-5 h-5 text-accent-blue" />,
  },
];

// ── Compact contact row (replaces KeyContactsSection dropdown) ──
function ContactRow({
  contact,
  isPrimary,
  onTogglePrimary,
  onEdit,
  onDelete,
}: {
  contact: KeyContact;
  isPrimary?: boolean;
  onTogglePrimary?: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const displayName =
    contact.firstName || contact.lastName
      ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
      : contact.name || "Unnamed Contact";
  const role = contact.title || contact.customRole || contact.role || "";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      {/* Headshot aligned to the left */}
      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
        <Headshot
          src={contact.headshot || undefined}
          alt={displayName}
          monogramName={displayName}
          className="w-full h-full object-cover"
        />
      </div>

      {/* All contact info on one row */}
      <div className="flex-1 min-w-0 flex items-center gap-3 overflow-hidden">
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5 min-w-0">
          {isPrimary && (
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
          )}
          <span className="truncate">{displayName}</span>
          {isPrimary && (
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 font-semibold shrink-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40"
            >
              Primary
            </Badge>
          )}
        </span>
        {role && (
          <span className="text-xs text-muted-foreground truncate hidden md:inline">
            {role}
          </span>
        )}
        {contact.email && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[180px]">{contact.email}</span>
          </span>
        )}
        {contact.phone && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            <Phone className="w-3 h-3 shrink-0" />
            <span className="truncate">{formatContactPhone(contact.phone)}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onTogglePrimary && (
          <Button
            size="sm"
            variant="ghost"
            className={`h-8 w-8 p-0 shrink-0 ${
              isPrimary
                ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                : "text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
            }`}
            onClick={onTogglePrimary}
            title={isPrimary ? "Remove as primary" : "Mark as primary"}
          >
            <Star className={cn("w-3.5 h-3.5", isPrimary && "fill-amber-500")} />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 shrink-0"
          onClick={onEdit}
          title="Edit contact"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
            onClick={onDelete}
            title="Delete contact"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Edit Contact Dialog — mini contact form (mirrors the Create Key Contact
//    modal) with a live Portal Preview ──
function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onSave,
  companyName = "",
  companyLogo = "",
  brandColor = "#1F3A60",
  secondaryColor = "#6B7280",
  appointmentLink = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: KeyContact | null;
  onSave: (updated: KeyContact) => void;
  companyName?: string;
  companyLogo?: string;
  brandColor?: string;
  secondaryColor?: string;
  appointmentLink?: string;
}) {
  const contactCategories = useMemo(
    () =>
      contact?.benefitsCategories ||
      (contact?.benefitsCategory ? [contact.benefitsCategory] : []),
    [contact],
  );
  const isPlanSponsorContact = contactCategories.includes(
    "Company / Plan Sponsor",
  );

  const [form, setForm] = useState<{
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
    isPrimary: false,
    enableContactButton: false,
    ctaType: "schedule",
    schedulingUrl: "",
    websiteUrl: "",
    displayEmail: true,
    displayPhone: false,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const schedulingUrlRef = useRef<HTMLInputElement>(null);
  const websiteUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!contact) return;
    setForm({
      contactType: contact.contactType || "individual",
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      title: contact.title || contact.customRole || "",
      displayName: contact.displayName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      phoneExtension: contact.phoneExtension || "",
      headshot: contact.headshot || "",
      headshotFileName: contact.headshotFileName || "",
      teamImage: contact.teamImage || "",
      teamImageFileName: contact.teamImageFileName || "",
      companyName: contact.companyName || "",
      companyLogo: contact.companyLogo || "",
      companyLogoFileName: (contact as any).companyLogoFileName || "",
      isPrimary: contact.isPrimaryOverall ?? contact.isPrimary ?? false,
      enableContactButton: contact.enableContactButton ?? false,
      ctaType:
        contact.contactButtonType === "phone"
          ? "call"
          : contact.contactButtonType === "email"
            ? "email"
            : contact.contactButtonType === "url"
              ? "contact"
              : "schedule",
      schedulingUrl: contact.schedulingUrl || "",
      websiteUrl: contact.websiteUrl || "",
      displayEmail: contact.displayEmail ?? true,
      displayPhone: contact.displayPhone ?? Boolean(contact.phone),
    });
    setErrors([]);
  }, [contact]);

  const updateForm = (
    patch: Partial<typeof form>,
    clearErrors: string[] = [],
  ) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (clearErrors.length > 0) {
      setErrors((prev) => prev.filter((e) => !clearErrors.includes(e)));
    }
  };

  const handleSave = () => {
    if (!contact) return;
    const errors: string[] = [];

    if (form.contactType === "individual") {
      if (!form.firstName.trim()) errors.push("firstName");
      if (!form.lastName.trim()) errors.push("lastName");
      if (!form.title.trim()) errors.push("title");
    } else {
      if (!form.displayName.trim()) errors.push("displayName");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = (form.phone || "").replace(/\D/g, "");
    const emailValid = emailRegex.test((form.email || "").trim());
    const phoneValid = phoneDigits.length >= 10;
    if ((form.phone || "").trim() && !phoneValid) errors.push("phone");
    if ((form.email || "").trim() && !emailValid) errors.push("email");
    if (!phoneValid && !emailValid) {
      if (!phoneValid) errors.push("phone");
      if (!emailValid) errors.push("email");
    }

    if (!isPlanSponsorContact && !form.companyName.trim()) {
      errors.push("companyName");
    }
    if (
      form.enableContactButton &&
      form.ctaType === "schedule" &&
      !form.schedulingUrl.trim()
    ) {
      errors.push("schedulingUrl");
    }
    if (
      form.enableContactButton &&
      form.ctaType === "contact" &&
      !form.websiteUrl.trim()
    ) {
      errors.push("websiteUrl");
    }

    if (errors.length > 0) {
      setErrors(errors);
      const refMap: Record<string, React.RefObject<HTMLInputElement | null>> = {
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

    const shouldBePrimary = isPlanSponsorContact || form.isPrimary;

    const updated: KeyContact = {
      ...contact,
      contactType: form.contactType,
      firstName:
        form.contactType === "individual" ? form.firstName : undefined,
      lastName:
        form.contactType === "individual" ? form.lastName : undefined,
      title: form.contactType === "individual" ? form.title : undefined,
      customRole: form.contactType === "individual" ? form.title : undefined,
      displayName:
        form.contactType === "team_support" ? form.displayName : undefined,
      name:
        form.contactType === "individual"
          ? `${form.firstName} ${form.lastName}`.trim()
          : form.displayName,
      email: form.email,
      phone: form.phone,
      phoneExtension: form.phoneExtension,
      headshot:
        form.contactType === "individual"
          ? form.headshot || undefined
          : undefined,
      headshotFileName:
        form.contactType === "individual"
          ? form.headshotFileName || undefined
          : undefined,
      teamImage:
        form.contactType === "team_support"
          ? form.teamImage || undefined
          : undefined,
      teamImageFileName:
        form.contactType === "team_support"
          ? form.teamImageFileName || undefined
          : undefined,
      companyName: form.companyName || "",
      companyLogo:
        !isPlanSponsorContact && form.companyLogo
          ? form.companyLogo
          : undefined,
      isPrimary: shouldBePrimary,
      isPrimaryOverall: shouldBePrimary,
      displayEmail: form.displayEmail,
      displayPhone: form.displayPhone,
      displayUrl: form.enableContactButton
        ? form.ctaType === "contact"
        : false,
      displayScheduleAppointment: form.enableContactButton
        ? form.ctaType === "schedule"
        : false,
      enableContactButton: form.enableContactButton,
      contactButtonType: form.enableContactButton
        ? ((form.ctaType === "schedule"
            ? "calendar"
            : form.ctaType === "call"
              ? "phone"
              : form.ctaType === "email"
                ? "email"
                : "url") as "calendar" | "phone" | "email" | "url")
        : undefined,
      schedulingUrl:
        form.enableContactButton && form.ctaType === "schedule"
          ? form.schedulingUrl || undefined
          : undefined,
      websiteUrl:
        form.enableContactButton && form.ctaType === "contact"
          ? form.websiteUrl || undefined
          : undefined,
    };

    onSave(updated);
    onOpenChange(false);
  };

  const previewContact = {
    id: contact?.id || "preview",
    contactType: form.contactType,
    name:
      form.contactType === "individual"
        ? `${form.firstName} ${form.lastName}`.trim()
        : form.displayName,
    firstName: form.firstName,
    lastName: form.lastName,
    title: form.contactType === "individual" ? form.title : undefined,
    displayName:
      form.contactType === "team_support" ? form.displayName : undefined,
    email: form.email,
    phone: form.phone,
    phoneExtension: form.phoneExtension,
    headshot:
      form.contactType === "individual"
        ? form.headshot || undefined
        : undefined,
    teamImage:
      form.contactType === "team_support"
        ? form.teamImage || undefined
        : undefined,
    companyName: isPlanSponsorContact ? companyName : form.companyName,
    companyLogo: isPlanSponsorContact
      ? companyLogo || undefined
      : form.companyLogo || undefined,
    benefitsCategory:
      contactCategories[0] === "Group Health"
        ? "Health Insurance"
        : contactCategories[0] === "Group Life"
          ? "Life Insurance"
          : (contactCategories[0] || "Retirement") as any,
    isPrimary: isPlanSponsorContact || form.isPrimary,
    displayEmail: form.displayEmail,
    displayPhone: form.displayPhone,
    enableContactButton: form.enableContactButton,
    contactButtonType: form.enableContactButton
      ? (form.ctaType === "schedule"
          ? "calendar"
          : form.ctaType === "call"
            ? "phone"
            : form.ctaType === "email"
              ? "email"
              : "url")
      : undefined,
    schedulingUrl:
      form.enableContactButton && form.ctaType === "schedule"
        ? form.schedulingUrl
        : undefined,
    websiteUrl:
      form.enableContactButton && form.ctaType === "contact"
        ? form.websiteUrl
        : undefined,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-2 items-start">
          {/* Left column: form fields */}
          <div className="space-y-4 min-w-0">
            {/* Contact Type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium dark:text-gray-300">
                Contact Type
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateForm({ contactType: "individual" })}
                  className={cn(
                    "flex flex-col p-2.5 rounded-lg border-2 text-left transition-all",
                    form.contactType === "individual"
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
                  onClick={() => updateForm({ contactType: "team_support" })}
                  className={cn(
                    "flex flex-col p-2.5 rounded-lg border-2 text-left transition-all",
                    form.contactType === "team_support"
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

            {/* Primary Contact Toggle — hidden for Company / Plan Sponsor */}
            {!isPlanSponsorContact && (
              <div className="flex items-center space-x-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <Checkbox
                  id="edit-contact-is-primary"
                  checked={form.isPrimary}
                  onCheckedChange={(checked) =>
                    updateForm({ isPrimary: checked === true })
                  }
                />
                <Label
                  htmlFor="edit-contact-is-primary"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Mark as primary contact
                </Label>
              </div>
            )}

            {/* Name / Title / Headshot (individual) or Team fields (team_support) */}
            <ContactFormFields
              contactType={form.contactType}
              firstName={form.firstName}
              lastName={form.lastName}
              title={form.title}
              onFirstNameChange={(val) =>
                updateForm({ firstName: val }, ["firstName"])
              }
              onLastNameChange={(val) =>
                updateForm({ lastName: val }, ["lastName"])
              }
              onTitleChange={(val) =>
                updateForm({ title: val }, ["title"])
              }
              displayName={form.displayName}
              departmentLabel=""
              supportHours=""
              onDisplayNameChange={(val) =>
                updateForm({ displayName: val }, ["displayName"])
              }
              onDepartmentLabelChange={() => {}}
              onSupportHoursChange={() => {}}
              headshot={form.headshot}
              headshotFileName={form.headshotFileName}
              onHeadshotChange={(val, name) =>
                updateForm({ headshot: val, headshotFileName: name })
              }
              onHeadshotRemove={() =>
                updateForm({ headshot: "", headshotFileName: "" })
              }
              teamImage={form.teamImage}
              teamImageFileName={form.teamImageFileName}
              onTeamImageChange={(val, name) =>
                updateForm({ teamImage: val, teamImageFileName: name })
              }
              onTeamImageRemove={() =>
                updateForm({ teamImage: "", teamImageFileName: "" })
              }
              firstNameRef={firstNameRef}
              lastNameRef={lastNameRef}
              titleRef={titleRef}
              errorFields={errors}
            />

            {/* Company / Organization — required for non-Plan-Sponsor contacts */}
            {!isPlanSponsorContact && (
              <div className="space-y-1.5">
                <Label className="dark:text-gray-300 text-xs font-medium">
                  Company / Organization <span className="text-red-500">*</span>
                </Label>
                <Input
                  ref={companyNameRef}
                  value={form.companyName}
                  onChange={(e) =>
                    updateForm({ companyName: e.target.value }, ["companyName"])
                  }
                  placeholder="e.g. Benefits Provider Inc."
                  className={cn(
                    "h-8 text-sm",
                    errors.includes("companyName") && "border-red-500",
                  )}
                />
                {errors.includes("companyName") && (
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
                      value={formatPhoneNumber(form.phone)}
                      onChange={(e) => {
                        const digits = normalizePhoneNumber(e.target.value);
                        if (digits.length <= 11) {
                          updateForm({ phone: digits }, ["phone", "email"]);
                        }
                      }}
                      placeholder="(555) 123-4567"
                      className={cn(
                        "h-8 text-sm",
                        errors.includes("phone") && "border-red-500",
                      )}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="text"
                      maxLength={6}
                      value={form.phoneExtension}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length <= 6) {
                          updateForm({ phoneExtension: val });
                        }
                      }}
                      placeholder="Ext."
                      className="h-8 text-sm text-center"
                    />
                  </div>
                </div>
                {errors.includes("phone") && (
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
                  value={form.email}
                  onChange={(e) =>
                    updateForm({ email: e.target.value }, ["email", "phone"])
                  }
                  placeholder="e.g. john@company.com"
                  className={cn(
                    "h-8 text-sm",
                    errors.includes("email") && "border-red-500",
                  )}
                />
                {errors.includes("email") && (
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
                  value={form.companyLogo || ""}
                  fileName={form.companyLogoFileName || ""}
                  onChange={(value, fileName) =>
                    updateForm({
                      companyLogo: value,
                      companyLogoFileName: fileName || "",
                    })
                  }
                  onRemove={() =>
                    updateForm({
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
                  id="edit-contact-cta"
                  checked={form.enableContactButton}
                  onCheckedChange={(checked) =>
                    updateForm({ enableContactButton: checked === true })
                  }
                />
                <Label
                  htmlFor="edit-contact-cta"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Add a call to action button
                </Label>
              </div>

              {form.enableContactButton && (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { value: "schedule", label: "Schedule Appt." },
                        { value: "call", label: "Call" },
                        { value: "email", label: "Email" },
                        { value: "contact", label: "Contact Form" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateForm({ ctaType: opt.value })}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left transition-all",
                          form.ctaType === opt.value
                            ? "border-[#23919C] bg-[#23919C]/5 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500",
                        )}
                      >
                        <span className="text-[11px] font-medium">
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {form.ctaType === "schedule" && (
                    <div className="space-y-1">
                      <Label className="dark:text-gray-300 text-xs font-medium">
                        Scheduling URL <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        ref={schedulingUrlRef}
                        value={form.schedulingUrl}
                        onChange={(e) =>
                          updateForm({ schedulingUrl: e.target.value }, [
                            "schedulingUrl",
                          ])
                        }
                        placeholder="https://calendly.com/..."
                        className={cn(
                          "h-8 text-sm",
                          errors.includes("schedulingUrl") &&
                            "border-red-500",
                        )}
                      />
                      {errors.includes("schedulingUrl") && (
                        <p className="text-[10px] text-red-500">
                          Scheduling URL is required when &ldquo;Schedule
                          Appt.&rdquo; is enabled
                        </p>
                      )}
                    </div>
                  )}

                  {form.ctaType === "contact" && (
                    <div className="space-y-1">
                      <Label className="dark:text-gray-300 text-xs font-medium">
                        Contact Form URL <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        ref={websiteUrlRef}
                        value={form.websiteUrl}
                        onChange={(e) =>
                          updateForm({ websiteUrl: e.target.value }, [
                            "websiteUrl",
                          ])
                        }
                        placeholder="https://forms.company.com/..."
                        className={cn(
                          "h-8 text-sm",
                          errors.includes("websiteUrl") && "border-red-500",
                        )}
                      />
                      {errors.includes("websiteUrl") && (
                        <p className="text-[10px] text-red-500">
                          Contact Form URL is required when &ldquo;Contact
                          Form&rdquo; is enabled
                        </p>
                      )}
                    </div>
                  )}

                  {form.ctaType === "call" && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5">
                      {form.phone
                        ? `${formatPhoneNumber(form.phone)}${
                            form.phoneExtension
                              ? ` ext. ${form.phoneExtension}`
                              : ""
                          }`
                        : "Complete the Phone field above first"}
                    </p>
                  )}

                  {form.ctaType === "email" && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5">
                      {form.email || "Complete the Email field above first"}
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
                  id="edit-contact-display-email"
                  checked={form.displayEmail}
                  onCheckedChange={(checked) =>
                    updateForm({ displayEmail: checked === true })
                  }
                />
                <Label
                  htmlFor="edit-contact-display-email"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Email
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-contact-display-phone"
                  checked={form.displayPhone}
                  onCheckedChange={(checked) =>
                    updateForm({ displayPhone: checked === true })
                  }
                />
                <Label
                  htmlFor="edit-contact-display-phone"
                  className="text-xs font-medium cursor-pointer dark:text-gray-300"
                >
                  Phone
                </Label>
              </div>
            </div>
          </div>

          {/* Right column: Live Portal Preview */}
          <div className="flex flex-col items-center gap-2 lg:sticky lg:top-0 self-start w-full">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-blue text-center">
              Portal Preview
            </span>
            <SmallVerticalCard
              contact={previewContact}
              brandColor={brandColor}
              secondaryColor={secondaryColor}
              appointmentLink={appointmentLink}
              companyName={isPlanSponsorContact ? companyName : form.companyName}
              index={0}
              disableAnimation={true}
              baselineBackgroundColor="#ffffff"
              compact
              previewPlaceholders
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Key Contacts Section (no accordion wrapper - controlled by parent tab)
function EditKeyContactsSection({
  contacts,
  companyData,
  documentsData,
  onContactsChange,
  onHeadshotUpload,
  onHeadshotRemove,
  validationErrors = {},
  onAddContactForCategory,
}: {
  contacts: KeyContact[];
  companyData: CompanyBasicsData;
  documentsData: ComplianceDocumentsData;
  onContactsChange: (contacts: KeyContact[]) => void;
  onHeadshotUpload?: (index: number, file: File) => void;
  onHeadshotRemove?: (index: number) => void;
  validationErrors?: Record<string, string[]>;
  onAddContactForCategory: (category: BenefitsCategory) => void;
}) {
  const [editingContact, setEditingContact] = useState<KeyContact | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Contact pending deletion (awaiting confirmation dialog)
  const [deleteContact, setDeleteContact] = useState<KeyContact | null>(null);

  // Company / Plan Sponsor contacts — listed in their own accordion. The primary
  // contact populates this section whenever it's a Company / Plan Sponsor contact.
  const companyPlanSponsorContacts = contacts.filter((c) =>
    c.benefitsCategories?.includes("Company / Plan Sponsor") ||
    c.benefitsCategory === "Company / Plan Sponsor"
  );

  // Determine which contacts are external
  const isExternalContact = (c: KeyContact) =>
    c.contactType === "team_support" ||
    (c.role === "Other" && c.roleOther === "External HR / Administrator") ||
    (c.role as string) === "External HR / Administrator";

  const externalContacts = contacts.filter(isExternalContact);

  // Accordions that have at least one contact are open by default — applied once
  // when the contacts data finishes loading, then left to the user to manage.
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const accordionsInitializedRef = useRef(false);
  useEffect(() => {
    if (accordionsInitializedRef.current) return;
    if (contacts.length === 0) return;
    accordionsInitializedRef.current = true;
    const hasCategory = (id: BenefitsCategory) =>
      contacts.some(
        (c) => c.benefitsCategories?.includes(id) || c.benefitsCategory === id
      );
    const defaults: string[] = [];
    if (hasCategory("Company / Plan Sponsor")) defaults.push("company-plan-sponsor");
    CATEGORY_ACCORDIONS.forEach((cat) => {
      if (hasCategory(cat.id)) defaults.push(cat.value);
    });
    const hasExternal = contacts.some(
      (c) =>
        c.contactType === "team_support" ||
        (c.role === "Other" && c.roleOther === "External HR / Administrator") ||
        (c.role as string) === "External HR / Administrator"
    );
    if (hasExternal) defaults.push("external-hr");
    setOpenAccordions(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts]);

  // The overall primary contact (isPrimaryOverall or legacy isPrimary), falling
  // back to the first contact so the section always has something to show.
  const primaryContact =
    contacts.find((c) => c.isPrimaryOverall || c.isPrimary) ||
    contacts[0] ||
    null;

  // Classify the primary contact so the UI can emphasize whether it represents
  // the Company / Plan Sponsor or an External Admin.
  const isPrimaryExternalAdmin =
    !!primaryContact && isExternalContact(primaryContact);
  const primaryContactLabel = (() => {
    if (!primaryContact) return null;
    if (isExternalContact(primaryContact)) return "External Admin";
    const cats = primaryContact.benefitsCategories || [];
    if (
      cats.includes("Company / Plan Sponsor") ||
      primaryContact.benefitsCategory === "Company / Plan Sponsor"
    ) {
      return "Company / Plan Sponsor";
    }
    if (cats.length > 0) return cats[0];
    return "Key Contact";
  })();

  const handleOpenEdit = (contact: KeyContact) => {
    setEditingContact(contact);
    setIsEditModalOpen(true);
  };

  const handleSaveContact = (updated: KeyContact) => {
    onContactsChange(
      contacts.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const handleDeleteContact = (contact: KeyContact) => {
    setDeleteContact(contact);
  };

  const confirmDeleteContact = () => {
    if (!deleteContact) return;
    const displayName =
      deleteContact.firstName || deleteContact.lastName
        ? `${deleteContact.firstName || ""} ${deleteContact.lastName || ""}`.trim()
        : deleteContact.name || "Unnamed Contact";
    onContactsChange(contacts.filter((c) => c.id !== deleteContact.id));
    toast.success(`"${displayName}" deleted`);
    setDeleteContact(null);
  };

  // Toggle a contact as the primary for its category(ies) — one primary per
  // category. Clicking the star on an already-primary contact unselects it,
  // and promoting a contact demotes any other contacts sharing a category.
  const handleTogglePrimary = (contact: KeyContact) => {
    const wasAlreadyPrimary = !!(contact.isPrimaryOverall || contact.isPrimary);
    const promotedCats: BenefitsCategory[] =
      contact.benefitsCategories ||
      (contact.benefitsCategory ? [contact.benefitsCategory] : []);
    const isExternal = isExternalContact(contact);

    const updatedContacts = contacts.map((c) => {
      if (c.id === contact.id) {
        return {
          ...c,
          isPrimaryOverall: !wasAlreadyPrimary,
          isPrimary: !wasAlreadyPrimary,
          isPrimaryForCategory: !wasAlreadyPrimary,
          isPrimaryByCategory: promotedCats.length
            ? promotedCats.reduce((acc, cat) => {
                acc[cat] = !wasAlreadyPrimary;
                return acc;
              }, {} as Record<BenefitsCategory, boolean>)
            : c.isPrimaryByCategory,
        };
      }
      const cCats: BenefitsCategory[] =
        c.benefitsCategories ||
        (c.benefitsCategory ? [c.benefitsCategory] : []);
      const sharesCategory =
        (!isExternal && promotedCats.some((cat) => cCats.includes(cat))) ||
        (isExternal && isExternalContact(c));
      if (sharesCategory && !wasAlreadyPrimary) {
        const sharedCats = cCats.filter((cat) => promotedCats.includes(cat));
        return {
          ...c,
          isPrimaryOverall: false,
          isPrimary: false,
          isPrimaryForCategory: false,
          isPrimaryByCategory: c.isPrimaryByCategory
            ? {
                ...c.isPrimaryByCategory,
                ...sharedCats.reduce((acc, cat) => {
                  acc[cat] = false;
                  return acc;
                }, {} as Record<BenefitsCategory, boolean>),
              }
            : c.isPrimaryByCategory,
        };
      }
      return c;
    });

    onContactsChange(updatedContacts);
    const displayName =
      contact.firstName || contact.lastName
        ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
        : contact.name || "Unnamed Contact";
    toast.success(
      wasAlreadyPrimary
        ? `"${displayName}" removed as primary`
        : `"${displayName}" set as primary`
    );
  };

  return (
    <div className="space-y-6">
      {/* Primary Contact — always visible (no accordion) */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Star className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Primary Contact
          </h3>
          {primaryContactLabel && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-2 py-0.5 font-medium ${
                isPrimaryExternalAdmin
                  ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40"
                  : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40"
              }`}
            >
              {primaryContactLabel}
            </Badge>
          )}
        </div>
        {primaryContact ? (
          <ContactRow
            contact={primaryContact}
            isPrimary
            onEdit={() => handleOpenEdit(primaryContact)}
            onDelete={() => handleDeleteContact(primaryContact)}
          />
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            No primary contact set yet. Add a contact and mark it as primary.
          </p>
        )}
      </div>

      {/* Per-category accordions */}
      <Accordion
        type="multiple"
        className="space-y-3"
        value={openAccordions}
        onValueChange={setOpenAccordions}
      >
        {/* Company / Plan Sponsor accordion — lists its contacts (the primary
            contact populates this section when it's a Company / Plan Sponsor). */}
        <AccordionItem
          value="company-plan-sponsor"
          className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline bg-gray-50/80 dark:bg-gray-800/80 data-[state=open]:bg-gray-50/80 dark:data-[state=open]:bg-gray-800/80">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {companyData.companyLogo?.url ? (
                <BrandingImage
                  src={companyData.companyLogo?.url}
                  alt="Company logo"
                  className="w-7 h-7 object-contain rounded-sm shrink-0"
                />
              ) : (
                <Building2 className="w-5 h-5 text-accent-blue shrink-0" />
              )}
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {companyPlanSponsorContacts.length}
              </Badge>
              <span className="text-base font-semibold truncate">Company / Plan Sponsor</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mr-2"
              onClick={(e) => {
                e.stopPropagation();
                onAddContactForCategory("Company / Plan Sponsor");
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </AccordionTrigger>
          <AccordionContent className="px-4 pt-2 pb-3">
            {companyPlanSponsorContacts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No Company / Plan Sponsor contacts assigned. Click &ldquo;Add&rdquo; to create one.
              </p>
            ) : (
              companyPlanSponsorContacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  isPrimary={!!(contact.isPrimaryOverall || contact.isPrimary)}
                  onTogglePrimary={() => handleTogglePrimary(contact)}
                  onEdit={() => handleOpenEdit(contact)}
                  onDelete={() => handleDeleteContact(contact)}
                />
              ))
            )}
          </AccordionContent>
        </AccordionItem>
        {CATEGORY_ACCORDIONS.map((category) => {
          const categoryContacts = contacts.filter((c) =>
            c.benefitsCategories?.includes(category.id) ||
            c.benefitsCategory === category.id
          );
          return (
            <AccordionItem
              key={category.value}
              value={category.value}
              className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline bg-gray-50/80 dark:bg-gray-800/80 data-[state=open]:bg-gray-50/80 dark:data-[state=open]:bg-gray-800/80">
                <div className="flex items-center gap-2 flex-1">
                  {category.icon}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {categoryContacts.length}
                  </Badge>
                  <span className="text-base font-semibold">{category.label}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mr-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddContactForCategory(category.id);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-2 pb-3">
                {categoryContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No contacts assigned to {category.label}. Click &ldquo;Add&rdquo; to create one.
                  </p>
                ) : (
                  categoryContacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      isPrimary={!!(contact.isPrimaryOverall || contact.isPrimary)}
                      onTogglePrimary={() => handleTogglePrimary(contact)}
                      onEdit={() => handleOpenEdit(contact)}
                      onDelete={() => handleDeleteContact(contact)}
                    />
                  ))
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* External HR / Administrator accordion */}
        <AccordionItem
          value="external-hr"
          className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline bg-gray-50/80 dark:bg-gray-800/80 data-[state=open]:bg-gray-50/80 dark:data-[state=open]:bg-gray-800/80">
            <div className="flex items-center gap-2 flex-1">
              <Users className="w-5 h-5 text-amber-500" />
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {externalContacts.length}
              </Badge>
              <span className="text-base font-semibold">External HR / Administrator</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mr-2"
              onClick={(e) => {
                e.stopPropagation();
                const newContact: KeyContact = {
                  id: `contact-${Date.now()}`,
                  contactType: "team_support",
                  benefitsCategories: [],
                  benefitsCategory: undefined,
                  role: "Other",
                  roleOther: "External HR / Administrator",
                  isPrimaryForCategory: false,
                  companyName: "",
                  companyLogo: undefined,
                  firstName: "",
                  lastName: "",
                  title: "",
                  email: "",
                  phone: "",
                  website: "",
                  showOnPortal: true,
                  enableContactButton: true,
                  isPrimary: false,
                  displayScope: "thisPortal",
                  name: "",
                  orgType: "Advisor Firm",
                  description: "External HR or administrator contact for benefits support.",
                };
                onContactsChange([...contacts, newContact]);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </AccordionTrigger>
          <AccordionContent className="px-4 pt-2 pb-3">
            {externalContacts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No external HR contacts. Click &ldquo;Add&rdquo; to create one.
              </p>
            ) : (
              externalContacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  isPrimary={!!(contact.isPrimaryOverall || contact.isPrimary)}
                  onTogglePrimary={() => handleTogglePrimary(contact)}
                  onEdit={() => handleOpenEdit(contact)}
                  onDelete={() => handleDeleteContact(contact)}
                />
              ))
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Edit Contact Dialog */}
      <EditContactDialog
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        contact={editingContact}
        onSave={handleSaveContact}
        companyName={companyData.companyName || ""}
        companyLogo={companyData.companyLogo?.url || ""}
        brandColor={companyData.primaryColor || "#1F3A60"}
        secondaryColor={companyData.secondaryColor || "#6B7280"}
        appointmentLink={companyData.appointmentLink || ""}
      />

      {/* Delete Contact confirmation dialog */}
      <ConfirmDialog
        open={!!deleteContact}
        onOpenChange={(open) => {
          if (!open) setDeleteContact(null);
        }}
        onConfirm={confirmDeleteContact}
        title="Delete contact?"
        description={
          deleteContact
            ? `Are you sure you want to delete "${
                deleteContact.firstName || deleteContact.lastName
                  ? `${deleteContact.firstName || ""} ${deleteContact.lastName || ""}`.trim()
                  : deleteContact.name || "Unnamed Contact"
              }"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}

// Edit Compliance Documents Section (no accordion wrapper - controlled by parent tab)
// Mirrors the wizard Step 4 compliance documents UI (Upload / List / Preview tabs),
// wired to the edit-client's documentsData + onDocumentsChange.
function EditComplianceDocumentsSection({
  documentsData,
  companyData,
  onDocumentsChange,
  validationErrors = {},
  clientId,
  onPendingReviewCountChange,
}: {
  documentsData: ComplianceDocumentsData;
  companyData: CompanyBasicsData;
  onDocumentsChange: (field: keyof ComplianceDocumentsData, value: any) => void;
  validationErrors?: Record<string, string[]>;
  clientId?: string;
  /** Reports how many newly-uploaded documents are still awaiting the
   *  confirmation checkbox in the review step (0 = none pending). */
  onPendingReviewCountChange?: (count: number) => void;
}) {
  const retirementPlanDocuments = documentsData.retirementPlanDocuments || [];
  const primaryColor = companyData.primaryColor || "#002B5B";
  const secondaryColor = companyData.secondaryColor || "#E6C47A";
  const companyName = companyData.companyName || "Plan";

  // Latest documents ref — always apply edits to the freshest state (avoids stale
  // closures when saving from the Preview tab after a tab switch).
  const retirementPlanDocumentsRef = useRef(retirementPlanDocuments);
  retirementPlanDocumentsRef.current = retirementPlanDocuments;

  /** Remove duplicate documents by id (keep first occurrence). */
  const dedupeDocumentsById = (docs: Document[]): Document[] =>
    docs.filter(
      (doc, index, self) => index === self.findIndex((d) => d.id === doc.id),
    );

  // Track whether documents are currently being uploaded (disable tab switching)
  const [isUploading, setIsUploading] = useState(false);

  // Pending document deletion (awaiting confirmation dialog)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Store selected language to persist during re-renders (controlled state)
  const [selectedLanguage, setSelectedLanguage] = useState<"EN" | "ES">("EN");

  // Tabs state — "upload" is the first (default) tab
  const [activeTab, setActiveTab] = useState("upload");
  const [sortColumn, setSortColumn] = useState<SortColumn>("uploadedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{
    id: string;
    title: string;
    blobUrl?: string;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  // Language state for Document Preview
  const [previewLanguage, setPreviewLanguage] = useState<"EN" | "ES">("EN");
  const [activeCategory, setActiveCategory] =
    useState<BenefitsCategory>("Retirement");

  // Preview tab: only benefit categories (no "All Docs" - hub preview shows by category)
  const benefitCategories: BenefitsCategory[] = [
    "Retirement",
    "Group Life",
    "Group Health",
    "Other Benefits",
  ];

  // Get available languages from documents
  const availableLanguages = useMemo<("EN" | "ES")[]>(() => {
    const languages = new Set<"EN" | "ES">();
    retirementPlanDocuments.forEach((doc) => {
      const lang = (doc.language as "EN" | "ES") || "EN";
      languages.add(lang);
    });
    return Array.from(languages).sort((a, b) => {
      // EN first, then ES (preview toggle order)
      if (a === "EN" && b === "ES") return -1;
      if (a === "ES" && b === "EN") return 1;
      return 0;
    });
  }, [retirementPlanDocuments]);

  // Sync previewLanguage with available languages
  // If current language is not available, switch to first available language
  useEffect(() => {
    if (availableLanguages.length > 0) {
      // If current previewLanguage is not in availableLanguages, switch to first available
      if (!availableLanguages.includes(previewLanguage)) {
        setPreviewLanguage(availableLanguages[0]);
      }
    }
  }, [availableLanguages, previewLanguage]);

  // Convert documents to RetirementDocumentItem format for DocumentPreviewTab
  const retirementDocs = useMemo<RetirementDocumentItem[]>(() => {
    const mappedDocs = retirementPlanDocuments.map((doc) => {
      const isDatabaseId =
        typeof doc.id === "string" &&
        /^[0-9a-fA-F]{24}$/.test(doc.id) &&
        !doc.id.startsWith("doc-") &&
        !doc.id.startsWith("plan-doc-") &&
        !doc.id.startsWith("optional-doc-") &&
        !doc.id.startsWith("temp-");

      let href: string;
      if (isDatabaseId) {
        href = `/api/documents/${doc.id}/view`;
      } else if ((doc as any).storageKey) {
        href = `/api/r2/signed-url?key=${encodeURIComponent((doc as any).storageKey)}&redirect=1`;
      } else {
        href = doc.file || "";
      }

      return {
        id: doc.id,
        title: doc.name,
        description: doc.shortDescription || doc.name,
        href: href,
        language: (doc.language as "EN" | "ES") || "EN",
        category: doc.category,
        categorySuggested: doc.categorySuggested,
        categoryConfidence: doc.categoryConfidence,
        meta: {
          id: doc.id,
          type: "Document",
          uploadedAt: (doc as any).uploadedAt || new Date().toISOString(),
        },
        onDelete: () => {
          handleDeleteClick(doc.id, doc.name);
        },
        onDownload: () => {
          handleDownload(doc.id, doc.originalFileName || doc.name);
        },
      };
    });

    // Filter by current language (single language per preview; order EN before ES when both exist in data)
    const filteredByLang = mappedDocs
      .filter((doc) => doc.language === previewLanguage)
      .sort((a, b) => {
        if (a.language === "EN" && b.language === "ES") return -1;
        if (a.language === "ES" && b.language === "EN") return 1;
        return 0;
      });

    // Filter by active category (Preview mimics hub - no "All Docs")
    return filteredByLang.filter((doc) => {
      // Find the original doc to check its category
      const originalDoc = retirementPlanDocuments.find((d) => d.id === doc.id);
      return originalDoc?.category === activeCategory;
    });
  }, [retirementPlanDocuments, previewLanguage, activeCategory]);

  // Preview: show all benefit categories (even if empty) so the filter bar is always visible
  const previewCategories = useMemo<BenefitsCategory[]>(() => {
    return benefitCategories;
  }, []);

  // When switching to Preview tab: default to Retirement or first category with docs
  // Also reset if current category no longer has docs
  useEffect(() => {
    if (activeTab === "preview" && previewCategories.length > 0) {
      const defaultCat = previewCategories.includes("Retirement")
        ? "Retirement"
        : previewCategories[0];
      setActiveCategory((prev) =>
        previewCategories.includes(prev) ? prev : defaultCat,
      );
    }
  }, [activeTab, previewCategories]);

  // Convert documents to DocumentsModuleDocument format for DocumentListTab
  const documentsForList = useMemo<DocumentsModuleDocument[]>(() => {
    return retirementPlanDocuments.map((doc) => ({
      id: doc.id,
      title: doc.name,
      fileName: doc.originalFileName || doc.name,
      type: "Document",
      uploadedAt: (doc as any).uploadedAt || new Date().toISOString(),
      client: {
        id: "current-plan",
        companyName: companyName,
      },
      category: doc.category,
      categorySuggested: doc.categorySuggested,
      categoryConfidence: doc.categoryConfidence,
      expirationDate: doc.expirationDate,
    }));
  }, [retirementPlanDocuments, companyName]);

  // Sort documents for list view
  const sortedDocuments = useMemo(() => {
    return [...documentsForList].sort((a, b) => {
      let aValue: any = a[sortColumn];
      let bValue: any = b[sortColumn];

      if (sortColumn === "uploadedAt" || sortColumn === "expirationDate") {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else if (sortColumn === "client") {
        aValue = a.client.companyName?.toLowerCase() || "";
        bValue = b.client.companyName?.toLowerCase() || "";
      } else {
        aValue = aValue?.toString().toLowerCase() || "";
        bValue = bValue?.toString().toLowerCase() || "";
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [documentsForList, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Open the "Are you sure?" confirmation dialog before deleting.
  const handleDeleteClick = (documentId: string, documentTitle: string) => {
    setDeleteConfirm({ id: documentId, title: documentTitle });
  };

  // Perform the actual deletion after the user confirms.
  const confirmDelete = async () => {
    const pending = deleteConfirm;
    if (!pending) return;
    const currentDocs = retirementPlanDocumentsRef.current;
    const doc = currentDocs.find((d) => d.id === pending.id);
    if (doc?.storageKey) {
      await deleteFromR2(doc.storageKey);
    }
    onDocumentsChange(
      "retirementPlanDocuments",
      currentDocs.filter((d) => d.id !== pending.id),
    );
    toast.success(`"${pending.title}" deleted`);
  };

  const handleSaveEdit = async (
    docId: string,
    title: string,
    description: string,
    file?: File,
    category?: BenefitsCategory,
  ) => {
    const currentDocs = retirementPlanDocumentsRef.current;
    const targetDoc = currentDocs.find((d) => d.id === docId);

    // Detect a benefit category change so we can hop the Preview tab to the new
    // category's inner tab and confirm the move with a success toast.
    const categoryChanged =
      category !== undefined && category !== targetDoc?.category;
    const validTabCategory =
      categoryChanged &&
      benefitCategories.includes(category as BenefitsCategory);

    // Replacement file: prefer R2 (mirrors compliance-documents-upload), falling
    // back to base64 so the preview still works when R2 isn't configured.
    let fileData: string | undefined;
    let originalFileName: string | undefined;
    let storageKey: string | undefined;

    if (file) {
      if (clientId) {
        try {
          const { uploadFileToR2 } = await import("@/lib/upload-to-r2");
          const key = await uploadFileToR2({
            file,
            purpose: "document",
            clientId,
            fileName: file.name,
            category: category ?? targetDoc?.category ?? undefined,
          });
          if (key) {
            storageKey = key;
            fileData = "r2:stored";
            originalFileName = file.name;
          }
        } catch (err) {
          console.error("R2 upload failed, falling back to base64:", err);
        }
      }
      if (!storageKey) {
        try {
          const reader = new FileReader();
          fileData = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => {
              const result = e.target?.result as string;
              resolve(result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          originalFileName = file.name;
        } catch (error) {
          console.error("Error reading file:", error);
          toast.error("Failed to read file");
          return;
        }
      }
    }

    // Use ref so we always apply to the latest state (avoids stale closure when
    // saving from the Preview tab after a tab switch)
    const updatedDocuments = currentDocs.map((doc) =>
      doc.id === docId
        ? {
            ...doc,
            name: title,
            shortDescription: description,
            ...(fileData !== undefined && { file: fileData }),
            ...(originalFileName !== undefined && { originalFileName }),
            ...(storageKey !== undefined && { storageKey }),
            ...(category !== undefined && { category: category as BenefitsCategory }),
          }
        : doc,
    );

    // Persist to the server so the edit survives a page refresh. Only persisted
    // (Mongo) documents can be PATCHed individually; temp documents (doc-*,
    // plan-doc-*, etc.) are saved when the client is saved via Save Changes.
    const isPersistedMongoId =
      typeof docId === "string" &&
      /^[0-9a-fA-F]{24}$/.test(docId) &&
      !docId.startsWith("doc-") &&
      !docId.startsWith("plan-doc-") &&
      !docId.startsWith("optional-doc-") &&
      !docId.startsWith("temp-");

    if (isPersistedMongoId) {
      try {
        const body: Record<string, unknown> = {
          title,
          shortDescription: description,
        };
        if (category !== undefined) {
          body.category = category;
        }
        if (storageKey) {
          body.storageKey = storageKey;
          body.fileName = originalFileName;
        }
        const res = await fetch(`/api/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("Failed to persist document edit:", err);
          toast.error("Failed to save document to the server");
          return;
        }
      } catch (err) {
        console.error("Failed to persist document edit:", err);
        toast.error("Failed to save document to the server");
        return;
      }
    }

    // Apply the edit locally + Preview-tab navigation + success toast only AFTER
    // the server save has completed. This keeps the card (and its Save spinner)
    // visible in its current category until the save finishes — otherwise the doc
    // moves categories in local state while the tab is still on the old category,
    // producing a brief empty Preview list and hiding the spinner.
    onDocumentsChange("retirementPlanDocuments", updatedDocuments);
    if (validTabCategory && category) {
      setActiveCategory(category as BenefitsCategory);
    }
    toast.success(
      validTabCategory
        ? `Document updated & moved to ${category}`
        : "Document updated successfully",
    );
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    const doc = retirementPlanDocumentsRef.current.find(
      (d) => d.id === documentId,
    );
    if (!doc || !doc.file) {
      toast.error("Document not found or file is missing");
      return;
    }

    try {
      if (doc.file.startsWith("data:")) {
        const response = await fetch(doc.file);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download =
          fileName || doc.originalFileName || doc.name || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (doc.file.startsWith("/api/")) {
        const response = await fetch(doc.file);
        if (!response.ok) {
          toast.error("Failed to download document");
          return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download =
          fileName || doc.originalFileName || doc.name || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const link = document.createElement("a");
        link.href = doc.file;
        link.download =
          fileName || doc.originalFileName || doc.name || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("An error occurred while downloading the document");
    }
  };

  const handlePreview = async (
    documentIdOrDoc: string | RetirementDocumentItem,
    title?: string,
  ) => {
    let documentId: string;
    let documentTitle: string;

    if (typeof documentIdOrDoc === "string") {
      documentId = documentIdOrDoc;
      documentTitle = title || "Document";
    } else {
      documentId = documentIdOrDoc.meta?.id || documentIdOrDoc.id;
      documentTitle = documentIdOrDoc.title;
    }

    setIsLoadingPreview(true);
    setPreviewOpen(true);

    try {
      const doc = retirementPlanDocumentsRef.current.find(
        (d) => d.id === documentId,
      );
      if (!doc || !doc.file) {
        toast.error("Document not found");
        setPreviewOpen(false);
        return;
      }

      let blob: Blob;
      if (doc.file.startsWith("data:")) {
        const response = await fetch(doc.file);
        blob = await response.blob();
      } else if (doc.file.startsWith("/api/")) {
        const response = await fetch(doc.file);
        if (!response.ok) {
          toast.error("Failed to load document preview");
          setPreviewOpen(false);
          return;
        }
        blob = await response.blob();
      } else {
        const response = await fetch(doc.file);
        blob = await response.blob();
      }

      const blobUrl = URL.createObjectURL(blob);
      setPreviewDocument({ id: documentId, title: documentTitle, blobUrl });
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("Failed to load document preview");
      setPreviewOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const getDocumentType = (doc: DocumentsModuleDocument) => {
    return doc.type || "Document";
  };

  const refreshDocuments = () => {
    // Force re-render by updating state
    onDocumentsChange("retirementPlanDocuments", [
      ...retirementPlanDocumentsRef.current,
    ]);
  };

  const handleEditFromList = (documentId: string, title: string) => {
    // Switch to preview tab and trigger edit for the document
    setActiveTab("preview");
    // The edit will be triggered automatically when the document is rendered in preview mode
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editDocument", {
          detail: { documentId },
        }),
      );
    }, 100);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="list" disabled={isUploading}>List</TabsTrigger>
          <TabsTrigger value="preview" disabled={isUploading}>Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <ComplianceDocumentsUpload
            clientId={clientId}
            hideCategoryReview
            initialDocuments={retirementPlanDocuments}
            onDocumentsChange={(docs) => {
              const deduped = dedupeDocumentsById(docs);
              if (deduped.length > retirementPlanDocuments.length) {
                setActiveTab("list");
              }
              onDocumentsChange("retirementPlanDocuments", deduped);
            }}
            onUploadingChange={setIsUploading}
            brandColor={primaryColor}
            accentColor={secondaryColor}
            showPreview={false}
            showInfoCard={true}
            language={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            compact={true}
            onPendingReviewCountChange={onPendingReviewCountChange}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <AlertTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              Plan Documents Overview
            </AlertTitle>
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
              Review all uploaded plan documents, forms, and notices below. Use the column headers to sort, and expand rows to preview or edit. Documents with missing categories will need to be assigned before proceeding.
            </AlertDescription>
          </Alert>
          <DocumentListTab
            selectedPlan="current-plan"
            isLoading={false}
            documents={sortedDocuments}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onPreview={(id, title) => handleEditFromList(id, title)}
            getDocumentType={getDocumentType}
            onDelete={(id, name) => handleDeleteClick(id, name)}
            onDownload={(id, name) => handleDownload(id, name)}
            compact
            hideUploadedTime
            showActionTooltips
            showDirectEditDelete
            onEdit={(id, title, updates) => {
              if (updates?.category !== undefined) {
                const docIndex = retirementPlanDocumentsRef.current.findIndex(
                  (d) => d.id === id,
                );
                if (docIndex !== -1) {
                  const newDocs = [...retirementPlanDocumentsRef.current];
                  newDocs[docIndex] = {
                    ...newDocs[docIndex],
                    category: updates.category as BenefitsCategory,
                  };
                  onDocumentsChange("retirementPlanDocuments", newDocs);
                  const isPersistedMongoId =
                    typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
                  if (isPersistedMongoId && clientId) {
                    void fetch(`/api/documents/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ category: updates.category }),
                    }).then(async (res) => {
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        console.error("Failed to persist document category:", err);
                        toast.error("Could not save category to server");
                      }
                    });
                  }
                  toast.success("Category updated");
                }
              } else {
                handleEditFromList(id, title);
              }
            }}
            availableCategories={[
              "Retirement",
              "Group Health",
              "Group Life",
              "Other Benefits",
            ]}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-6 pb-24">
          {/* Language Switcher */}
          {availableLanguages.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {availableLanguages.map((lang) => {
                const isActive = previewLanguage === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setPreviewLanguage(lang);
                    }}
                    className={`rounded-full px-5 py-2 text-[16px] leading-tight font-red-hat font-semibold border transition-colors ${
                      isActive
                        ? "bg-[#002B5B] text-white border-[#002B5B]"
                        : "bg-white text-[#002B5B] border-[#D1D5DB] hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: primaryColor,
                            borderColor: primaryColor,
                          }
                        : {}
                    }
                  >
                    {lang === "EN" ? "ENGLISH" : "ESPAÑOL"}
                  </button>
                );
              })}
            </div>
          )}

          {/* Category Filter Tabs - only benefit categories (no All Docs as category; Preview mimics hub) */}
          <div className="mb-8 flex flex-wrap gap-2 border-b pb-4">
            {previewCategories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 text-[14px] font-semibold transition-all relative ${
                    isActive
                      ? "text-accent-blue dark:text-accent-blue"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {cat === "Other Benefits" ? "Other" : cat}
                  {isActive && (
                    <div className="absolute bottom-[-17px] left-0 right-0 h-[3px] rounded-t-full bg-accent-blue" />
                  )}
                </button>
              );
            })}
          </div>

          {retirementDocs.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-600 text-lg dark:text-gray-400">
                No documents found.
              </p>
            </div>
          ) : (
            <DocumentPreviewTab
              selectedPlan="current-plan"
              isLoading={false}
              documents={retirementDocs}
              onDelete={handleDeleteClick}
              onDownload={handleDownload}
              onDocumentsChange={refreshDocuments}
              showWizardNextHint={true}
              onSaveEdit={handleSaveEdit}
              brandColor={primaryColor}
              accentColor={secondaryColor}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewDocument(null);
        }}
        document={previewDocument}
        isLoading={isLoadingPreview}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        onConfirm={confirmDelete}
        title="Delete document?"
        description={
          deleteConfirm
            ? `Are you sure you want to delete "${deleteConfirm.title}"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

const EDIT_TABS = [
  { id: "company", label: "Branding" },
  { id: "preview", label: "Preview" },
  { id: "contacts", label: "Key Contacts" },
  { id: "documents", label: "Documents" },
  { id: "disclaimers", label: "Disclaimers" },
] as const;

type EditTabId = (typeof EDIT_TABS)[number]["id"];

export default function EditClientPage() {
  const router = useRouter();
  const { setTitle } = usePageTitleContext();

  const {
    client,
    clientId,
    loading,
    saving,
    error,
    showPreview,
    companyData,
    clientStatus,
    keyContacts,
    keyContactsDisplayStyle,
    keyContactsMobileDisplayStyle,
    welcomeData,
    documentsData,
    disclaimers,
    setShowPreview,
    setClientStatus,
    setKeyContacts,
    setKeyContactsDisplayStyle,
    setKeyContactsMobileDisplayStyle,
    setDisclaimers,
    handleInputChange,
    handleWelcomeChange,
    handleDocumentsChange,
    handleHeadshotUpload,
    handleHeadshotRemove,
    handleFileUpload,
    handleFileRemove,
    handleSave,
    isFormValid,
    getValidationErrors,
    categoryPortalVisibility,
    setCategoryPortalVisibility,
  } = useEditClient();

  const [activeTab, setActiveTab] = useState<EditTabId>("company");
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isPreviewLayoutModalOpen, setIsPreviewLayoutModalOpen] =
    useState(false);
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  // Number of newly-uploaded documents still awaiting the "I confirm these
  // documents are accurate..." checkbox. Blocks Save Changes until confirmed.
  const [pendingDocumentUploads, setPendingDocumentUploads] = useState(0);

  const handleAddContactForCategory = useCallback(
    (category: BenefitsCategory) => {
      const planOrganizationType =
        (companyData.organizationType as
          | "Advisor Firm"
          | "Client"
          | "Recordkeeper"
          | "Partner/Custom") || "Advisor Firm";

      const getDefaultDescription = (orgType?: string): string => {
        switch (orgType) {
          case "Advisor Firm":
            return `Your dedicated financial professional for retirement plan education, enrollment assistance, and investment guidance.`;
          case "Client":
            return "Your primary contact for enrollment questions, plan changes, and general benefits support.";
          case "Recordkeeper":
            return `For account access, contributions, or transaction assistance, please contact ${documentsData.recordkeeper || "[Recordkeeper Name]"} directly.`;
          case "Partner/Custom":
            return `For questions about additional benefits such as insurance, wellness, or supplemental programs, please contact ${companyData.companyName || "[Company Name]"}.`;
          default:
            return `Your dedicated financial professional for retirement plan education, enrollment assistance, and investment guidance.`;
        }
      };

      const newContact: KeyContact = {
        id: `contact-${Date.now()}`,
        contactType: "individual",
        benefitsCategories: [category],
        benefitsCategory: category,
        role: "Advisor / Specialist",
        isPrimaryForCategory: false,
        companyName: companyData.companyName || "",
        companyLogo: companyData.companyLogo?.url || undefined,
        firstName: "",
        lastName: "",
        title: "",
        email: "",
        phone: "",
        website: "",
        showOnPortal: true,
        enableContactButton: true,
        isPrimary: false,
        displayScope: "thisPortal",
        name: "",
        orgType: planOrganizationType,
        organization: companyData.companyName || "",
        description: getDefaultDescription(planOrganizationType),
      };
      setKeyContacts([...keyContacts, newContact]);
    },
    [companyData, documentsData, keyContacts, setKeyContacts],
  );

  // Portal target for the tabs bar – the Header renders <div id="header-tabs-portal" />
  // and we portal the TabsList into it so it appears inside the fixed header while
  // staying within the <Tabs> React context.
  const [headerPortalTarget, setHeaderPortalTarget] =
    useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderPortalTarget(document.getElementById("header-tabs-portal"));
  }, []);

  // ── Footer background color state ──
  const storedFooterBg =
    ((companyData as any)?.footerBackground as
      | { mode?: string; customColor?: string }
      | undefined) ?? {};
  const [footerBgMode, setFooterBgMode] = useState<
    "primary" | "secondary" | "custom"
  >(storedFooterBg.mode === "secondary" || storedFooterBg.mode === "custom"
    ? storedFooterBg.mode
    : "primary");
  const [footerBgCustomColor, setFooterBgCustomColor] = useState(
    storedFooterBg.customColor || "",
  );
  const [isFooterPreviewOpen, setIsFooterPreviewOpen] = useState(false);
  const resolvedFooterBgColor =
    footerBgMode === "secondary"
      ? companyData.secondaryColor
      : footerBgMode === "custom" && footerBgCustomColor.trim()
        ? footerBgCustomColor.trim()
        : companyData.primaryColor;

  const persistFooterBg = useCallback(
    (mode: string, customColor: string) => {
      const payload = { mode, customColor };
      (handleInputChange as any)("footerBackground", payload);
    },
    [handleInputChange],
  );

  // Mission Statement fields
  const missionHeadline = (companyData as any).missionHeadline || "";
  const missionBody = (companyData as any).missionBody || "";

  const defaultWelcomeMessage =
    WELCOME_BODY_PRESETS[0]?.bodyText ||
    "This website was created as your central source for exploring and taking advantage of your company benefits. Our goal is to make it easy for you to stay informed, engaged, and confident in the resources available to you.\n\nWhether you're just getting started or continuing your journey, this site is here to help you make the most of everything our company has to offer.";

  const [useDefaultWelcomeMessage, setUseDefaultWelcomeMessage] = useState(
    !(companyData as any).heroDescription ||
    (companyData as any).heroDescription === defaultWelcomeMessage,
  );

  const defaultBodyText =
    WELCOME_BODY_PRESETS[0]?.bodyText ||
    "When people are supported, great things happen. This hub was created to help you understand and take advantage of the opportunities available to you as a team member. From everyday resources to long-term planning tools, everything you need is right here.";

  const [useDefaultBody, setUseDefaultBody] = useState(
    !missionBody || missionBody === defaultBodyText,
  );
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Current user's identity — used to show the user's Organization Name on
  // their own contact card in the Contact Card Layout Preview, and to populate
  // the [Organization Name] placeholder in the disclaimer text.
  const [userEmail, setUserEmail] = useState<string>("");
  const [userOrgName, setUserOrgName] = useState<string>("");
  const [userSubdomain, setUserSubdomain] = useState<string>("");

  // Portal URL availability check
  type PortalUrlAvailability = "idle" | "checking" | "available" | "taken";
  const [portalUrlAvailability, setPortalUrlAvailability] =
    useState<PortalUrlAvailability>("idle");
  const [checkedPortalUrl, setCheckedPortalUrl] = useState<string>("");
  const portalUrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPortalUrlCheckedRef = useRef<string>("");
  // Only run the availability check after the user has actually edited the
  // Portal URL. On initial load the value is this client's own slug (which is
  // always excluded from the check), so querying it would be a pointless
  // network request.
  const portalUrlManuallyEditedRef = useRef(false);

  // Debounced Portal URL availability check
  useEffect(() => {
    if (portalUrlTimerRef.current) {
      clearTimeout(portalUrlTimerRef.current);
    }

    // Skip the check until the user edits the field — the initial value is
    // this client's own slug, so checking it is redundant.
    if (!portalUrlManuallyEditedRef.current) {
      setPortalUrlAvailability("idle");
      setCheckedPortalUrl("");
      lastPortalUrlCheckedRef.current = "";
      return;
    }

    const slug = (companyData.portalUrl || "").trim();
    if (!slug || slug.length < 2) {
      setPortalUrlAvailability("idle");
      setCheckedPortalUrl("");
      lastPortalUrlCheckedRef.current = "";
      return;
    }

    if (slug === lastPortalUrlCheckedRef.current) {
      return;
    }

    portalUrlTimerRef.current = setTimeout(async () => {
      lastPortalUrlCheckedRef.current = slug;
      setPortalUrlAvailability("checking");
      setCheckedPortalUrl(slug);
      try {
        const params = new URLSearchParams({ slug });
        if (clientId) params.set("clientId", clientId);
        const res = await fetch(`/api/check-portal-url?${params.toString()}`);
        if (!res.ok) {
          setPortalUrlAvailability("available");
          return;
        }
        const data = await res.json();
        setPortalUrlAvailability(data.available ? "available" : "taken");
      } catch {
        setPortalUrlAvailability("available");
      }
    }, 600);

    return () => {
      if (portalUrlTimerRef.current) {
        clearTimeout(portalUrlTimerRef.current);
      }
    };
  }, [companyData.portalUrl, clientId]);

  // Tracks whether the user has edited the disclaimer so the editor Textarea
  // uses the editable state (including an intentionally cleared value) instead
  // of re-deriving from the stored client disclaimers on every keystroke.
  const disclaimerEditedRef = useRef(false);

  // Disclaimer update confirmation dialog state (mirrors the Settings page flow).
  const [showDisclaimerConfirmDialog, setShowDisclaimerConfirmDialog] =
    useState(false);
  const [isSavingDisclaimer, setIsSavingDisclaimer] = useState(false);

  const headlineRef = useRef<HTMLInputElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);

  const headlineCharCount = missionHeadline?.length || 0;
  const bodyCharCount = missionBody?.length || 0;
  const isHeadlineValid = headlineCharCount <= 60;
  const isBodyValid = bodyCharCount >= 250 && bodyCharCount <= 2000;

  const errorFields = useMemo(() => {
    const errors = getValidationErrors();
    const fields: string[] = [];
    if (errors.heroTitle) fields.push("heroTitle");
    if (errors.heroDescription) fields.push("heroDescription");
    if (errors.missionHeadline) fields.push("missionHeadline");
    if (errors.missionBody) fields.push("missionBody");
    return fields;
  }, [getValidationErrors]);

  const updateField = (field: "headline" | "bodyText", value: string) => {
    handleWelcomeChange(field, value);
  };

  const handleUseDefaultBody = (checked: boolean) => {
    setUseDefaultBody(checked);
    if (checked) {
      handleInputChange("missionBody", defaultBodyText);
    }
  };

  const handleHeadshotChange = (newHeadshot: string) => {
    setUserAvatar(newHeadshot);
  };

  const handleBackgroundChange = (newBackground: string) => {
    if (!newBackground) {
      handleInputChange("brandImages", {
        ...companyData.brandImages,
        header: null,
      });
      return;
    }
    handleInputChange("brandImages", {
      ...companyData.brandImages,
      header: companyData.brandImages?.header
        ? {
          ...companyData.brandImages.header,
          url: newBackground,
        }
        : { url: newBackground, fileName: "header", fileSize: 0, warnings: [] },
    });
  };

  const handleLogoChange = (logoData: CompanyLogoData | null) => {
    if (logoData === null) {
      handleInputChange("companyLogo", null);
      return;
    }
    handleInputChange("companyLogo", logoData);
  };

  const handleBrandImagesChange = (brandImages: BrandImagesData) => {
    if (!clientId) {
      handleInputChange("brandImages", brandImages);
      return;
    }
    const slots: { key: keyof BrandImagesData; r2Slot: "background" | "thumbnail" | "secondaryBanner" | "favicon" }[] = [
      { key: "header", r2Slot: "background" },
      { key: "thumbnail", r2Slot: "thumbnail" },
      { key: "secondaryBanner", r2Slot: "secondaryBanner" },
      { key: "favicon", r2Slot: "favicon" },
    ];
    const hasDataUrl = slots.some(({ key }) => brandImages[key]?.url?.startsWith?.("data:"));
    if (!hasDataUrl) {
      handleInputChange("brandImages", brandImages);
      return;
    }
    const updated = { ...brandImages };
    Promise.all(
      slots.map(async ({ key, r2Slot }) => {
        const img = updated[key];
        if (img?.url?.startsWith?.("data:")) {
          const keyResult = await uploadBrandingToR2({
            dataUrlOrFile: img.url,
            fileName: img.fileName || key,
            clientId,
            slot: r2Slot,
          });
          if (keyResult) {
            (updated as Record<string, unknown>)[key] = { ...img, url: keyResult };
          }
        }
      }),
    ).then(() => {
      handleInputChange("brandImages", updated);
    });
  };

  useEffect(() => {
    const currentHeroTitle = ((companyData as any).heroTitle || "") as string;
    const expectedHeroTitle =
      companyData.companyName?.trim().length > 0
        ? `Welcome to the ${companyData.companyName} Benefits Hub!`
        : "Welcome to the Company Name Benefits Hub!";

    if (!currentHeroTitle || currentHeroTitle.trim() === "") {
      handleInputChange("heroTitle", expectedHeroTitle);
    }

    const currentHeroDescription = ((companyData as any).heroDescription ||
      "") as string;
    if (!currentHeroDescription || currentHeroDescription.trim() === "") {
      handleInputChange("heroDescription", defaultWelcomeMessage);
      setUseDefaultWelcomeMessage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyData.companyName]);

  const handleHeadlineChange = (value: string) => {
    handleInputChange("missionHeadline", value);
  };

  const handleBodyChange = (value: string) => {
    handleInputChange("missionBody", value);
    if (useDefaultBody && value !== defaultBodyText) {
      setUseDefaultBody(false);
    }
  };

  // AI Generation handlers for Mission Statement
  const handleGenerateMissionHeadline = () => {
    const availableIndexes = MISSION_STATEMENT_PRESETS.map((_, i) => i);
    const randomIndex = Math.floor(Math.random() * availableIndexes.length);
    const preset = MISSION_STATEMENT_PRESETS[randomIndex];
    if (preset) {
      handleInputChange("missionHeadline", preset.headline);
    }
  };

  const handleGenerateMissionBody = () => {
    const availableIndexes = MISSION_STATEMENT_PRESETS.map((_, i) => i);
    const randomIndex = Math.floor(Math.random() * availableIndexes.length);
    const preset = MISSION_STATEMENT_PRESETS[randomIndex];
    if (preset) {
      handleInputChange("missionBody", preset.bodyText);
      if (useDefaultBody) {
        setUseDefaultBody(false);
      }
    }
  };

  useEffect(() => {
    const companyName = companyData.companyName?.trim();
    setTitle(companyName ? `Edit Plan - ${companyName}` : "Edit Plan");
  }, [setTitle, companyData.companyName]);

  // Fetch the current user's email + organization name. Used to show the
  // user's Organization Name on their own contact card in the Contact Card
  // Layout Preview (same behavior as step-3d), and to populate the
  // [Organization Name] placeholder in the disclaimer text.
  useEffect(() => {
    let cancelled = false;
    const loadUserOrgName = async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const profile = await res.json();
        const orgName =
          profile?.organizationName ||
          profile?.wizardSessions?.[0]?.branding?.organizationName ||
          profile?.company ||
          "";
        const email =
          profile?.email || profile?.advisorEmail || "";
        const subdomain = profile?.subdomain || "";
        if (!cancelled) {
          setUserOrgName(orgName);
          setUserEmail(email);
          setUserSubdomain(subdomain);
        }
      } catch {
        // Silent — best-effort fetch for the organization name.
      }
    };
    loadUserOrgName();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveClick = () => {
    // Block saving while newly-uploaded documents haven't been confirmed via
    // the "I confirm these documents are accurate..." checkbox in the
    // Documents tab.
    if (pendingDocumentUploads > 0) {
      toast.error("Confirm your document uploads before saving.", {
        description:
          "Please check the \u201cI confirm these documents are accurate, authorized for use, and ready to publish to this Benefits Hub.\u201d checkbox in the Documents tab, then add the documents before saving.",
      });
      return;
    }
    // If the disclaimer was edited, require confirmation before saving so the
    // user can confirm the Client/Plan disclaimer will be updated.
    if (disclaimerEditedRef.current) {
      setShowDisclaimerConfirmDialog(true);
      return;
    }
    handleSave();
  };

  const handleConfirmDisclaimerSave = async () => {
    // Same guard as handleSaveClick — the disclaimer confirmation dialog can
    // otherwise bypass the document-confirmation requirement.
    if (pendingDocumentUploads > 0) {
      toast.error("Confirm your document uploads before saving.", {
        description:
          "Please check the \u201cI confirm these documents are accurate, authorized for use, and ready to publish to this Benefits Hub.\u201d checkbox in the Documents tab, then add the documents before saving.",
      });
      return;
    }
    setIsSavingDisclaimer(true);
    try {
      const ok = await handleSave();
      // Only close the dialog once the save succeeds (the success toast is
      // shown by handleSave). On failure it stays open so the user can retry.
      if (ok) {
        setShowDisclaimerConfirmDialog(false);
      }
    } finally {
      setIsSavingDisclaimer(false);
    }
  };

  // ── Disclaimer text resolution ──
  // Resolve [Organization Name] with the current user's organization name and
  // [Company Name] with the client's company name so placeholders never render
  // literally in the editor or the footer preview.
  const disclaimerOrgName =
    userOrgName || companyData.companyName || "[Organization Name]";
  const disclaimerCompName = companyData.companyName || "[Company Name]";

  // Once the user has edited the disclaimer, use the editable `disclaimers`
  // state as the source of truth so the Textarea reflects keystrokes (and can
  // be cleared). Otherwise fall back to the stored client disclaimers.
  const getRawDisclaimerText = (): string => {
    const raw = disclaimerEditedRef.current
      ? disclaimers
      : (client as any)?.disclaimers ?? disclaimers;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw))
      return raw
        .map((item: any) => item?.text || item || "")
        .filter(Boolean)
        .join("\n\n");
    if (raw && typeof raw === "object") {
      if (Array.isArray((raw as any).disclaimers))
        return (raw as any)
          .disclaimers.map((d: any) => d?.text || "")
          .filter(Boolean)
          .join("\n\n");
      if (raw.text) return raw.text;
    }
    return "";
  };

  // Editor text: falls back to the default disclosures (org name resolved) when
  // no disclaimer text exists yet.
  const getResolvedDisclaimerText = (): string => {
    const rawText = getRawDisclaimerText();
    const base = rawText
      ? rawText
      : resolveDefaultDisclosuresText(disclaimerOrgName);
    return base
      .replace(/\[Organization Name\]/g, disclaimerOrgName)
      .replace(/\[Company Name\]/g, disclaimerCompName);
  };

  // Footer preview text: resolves the placeholders but keeps the previous empty
  // fallback (so PortalDisclaimers renders its built-in text when empty).
  const getResolvedDisclaimerPreviewText = (): string =>
    getRawDisclaimerText()
      .replace(/\[Organization Name\]/g, disclaimerOrgName)
      .replace(/\[Company Name\]/g, disclaimerCompName);

  if (loading) {
    return (
      <EditClientLoading onBackClick={() => router.push("/new/clients")} />
    );
  }

  if (error || !client) {
    return (
      <EditClientError
        error={error || "Client not found"}
        onBackClick={() => router.push("/new/clients")}
      />
    );
  }

  if (showPreview && client) {
    return (
      <EditClientPreview
        client={client}
        companyData={companyData}
        welcomeData={welcomeData}
        keyContacts={keyContacts}
        onBackClick={() => setShowPreview(false)}
        onSave={handleSave}
        saving={saving}
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 space-y-6 py-4 pb-24">
        {/* EditClientHeader - hidden on Preview tab */}
        {activeTab !== "preview" && (
          <EditClientHeader
            clientStatus={clientStatus}
            onStatusChange={setClientStatus}
            onBackClick={() => router.push("/new/clients")}
            hasClient={!!client}
            isFormValid={isFormValid()}
            clientId={clientId}
            slug={(client as any)?.slug}
          />
        )}

        <div className="mx-auto max-w-5xl px-4">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as EditTabId)}
          >
            {/* Tab bar renders inside the fixed header via portal so it stays
                visible when scrolling. The portal target <div id="header-tabs-portal" />
                is rendered by the Header component. */}
            {headerPortalTarget &&
              createPortal(
                <TabsList className="w-full justify-center gap-1 bg-transparent p-0 border-b rounded-none flex-nowrap h-auto min-h-fit overflow-x-auto">
                  {EDIT_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-accent-blue data-[state=active]:text-accent-blue rounded-none px-4 py-3 text-sm font-medium whitespace-nowrap"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>,
                headerPortalTarget,
              )}

            {/* ── Tab 1: Company Basics & Branding ── */}
            <TabsContent value="company" className="space-y-6 mt-0">
              {/* Plan Type */}
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-accent-blue" />
                    Plan Type <span className="text-red-500">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={companyData.planType || "client"}
                    onValueChange={(value) =>
                      handleInputChange("planType", value)
                    }
                    className="grid gap-3"
                  >
                    <div
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${companyData.planType === "client" ||
                        !companyData.planType
                        ? "border-primary bg-[#23919C]/10"
                        : "hover:bg-muted/50"
                        }`}
                      onClick={() => handleInputChange("planType", "client")}
                    >
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="client" id="plan-client" />
                        <div>
                          <Label
                            htmlFor="plan-client"
                            className="cursor-pointer font-medium"
                          >
                            <p className="text-sm font-medium">Client</p>
                          </Label>
                          <div className="text-xs text-muted-foreground">
                            Active plan for real clients
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${companyData.planType === "prospect"
                        ? "border-primary bg-[#23919C]/10"
                        : "hover:bg-muted/50"
                        }`}
                      onClick={() =>
                        handleInputChange("planType", "prospect")
                      }
                    >
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="prospect" id="plan-prospect" />
                        <div>
                          <Label
                            htmlFor="plan-prospect"
                            className="cursor-pointer font-medium"
                          >
                            <p className="text-sm font-medium">Prospect</p>
                          </Label>
                          <div className="text-xs text-muted-foreground">
                            Draft plan for demos & presentations
                          </div>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Company Information */}
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-accent-blue" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">
                        Company Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        icon={<Building2 className="h-4 w-4" />}
                        id="companyName"
                        value={companyData.companyName}
                        onChange={(e) => {
                          const value = e.target.value.slice(0, 65);
                          handleInputChange("companyName", value);
                        }}
                        placeholder="Enter company name"
                        maxLength={65}
                        required
                        destructive={
                          getValidationErrors().companyName?.length > 0
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyWebsite">Company Website</Label>
                      <Input
                        icon={<Globe className="h-4 w-4" />}
                        id="companyWebsite"
                        value={companyData.companyWebsite || ""}
                        onChange={(e) =>
                          handleInputChange("companyWebsite", e.target.value)
                        }
                        placeholder="example.com"
                        type="url"
                        destructive={
                          getValidationErrors().companyWebsite?.length > 0
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Portal URL */}
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                    <Globe className="w-5 h-5 text-accent-blue" />
                    Portal URL <span className="text-red-500">*</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    Customize the URL where employees will access your
                    benefits portal.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400 bg-muted/50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
                    <span className="shrink-0">https://</span>
                    <span className="font-medium text-foreground dark:text-gray-200">
                      {userSubdomain || "your-org"}
                    </span>
                    <span className="shrink-0">.plantel.pro/new/view/</span>
                    <span className="font-medium text-foreground dark:text-gray-200">
                      {companyData.portalUrl ||
                        companyData.companyName
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-")
                          .replace(/-+/g, "-")
                          .replace(/^-+|-+$/g, "") ||
                        "your-plan"}
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      id="portalUrl"
                      name="portalUrl"
                      data-field="portalUrl"
                      value={companyData.portalUrl || (client as any)?.slug || ""}
                      onChange={(e) => {
                        portalUrlManuallyEditedRef.current = true;
                        const value = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-")
                          .replace(/-+/g, "-")
                          .slice(0, 30);
                        handleInputChange("portalUrl", value);
                      }}
                      placeholder={companyData.companyName
                        ? companyData.companyName
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "-")
                            .replace(/-+/g, "-")
                            .replace(/^-+|-+$/g, "")
                            .slice(0, 30)
                        : "your-plan"}
                      maxLength={30}
                      required
                      destructive={
                        getValidationErrors().portalUrl?.length > 0
                      }
                    />
                    <div
                      className={`absolute -top-8 right-0 flex items-center gap-2 transition-all duration-500 ease-out ${(companyData.portalUrl || "").length >= 15
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-2 pointer-events-none"
                        }`}
                    >
                      <span
                        className={`text-xs transition-colors duration-300 ${(companyData.portalUrl || "").length >= 30
                          ? "text-red-500 dark:text-red-400"
                          : "text-muted-foreground dark:text-gray-400"
                          }`}
                      >
                        {(companyData.portalUrl || "").length}/30 characters
                      </span>
                      {(companyData.portalUrl || "").length >= 30 && (
                        <Badge
                          variant="destructive"
                          className="text-xs animate-in fade-in slide-in-from-right-2 duration-500"
                        >
                          Limit reached
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Portal URL availability indicator */}
                  {portalUrlAvailability !== "idle" &&
                    (companyData.portalUrl || "").trim().length >= 2 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {portalUrlAvailability === "checking" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Checking availability...
                            </span>
                          </>
                        ) : portalUrlAvailability === "available" ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400">
                              &ldquo;{checkedPortalUrl}&rdquo; is available
                            </span>
                          </>
                        ) : portalUrlAvailability === "taken" ? (
                          <>
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                            <span className="text-xs text-red-600 dark:text-red-400">
                              &ldquo;{checkedPortalUrl}&rdquo; is already taken
                            </span>
                          </>
                        ) : null}
                      </div>
                    )}
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    Only lowercase letters, numbers, and hyphens allowed. Max
                    30 characters.
                  </p>
                </CardContent>
              </Card>

              {/* Company Logo */}
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-accent-blue" />
                    Company Logo <span className="text-red-500">*</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Upload your company logo. Recommended size: 300×250px.
                    Accepted formats: PNG, JPG, WebP, SVG. Max file size: 15 MB.
                  </p>
                </CardHeader>
                <CardContent>
                  <UniversalImageEditorModal
                    type="logo"
                    icon={<ImageIcon className="w-4 h-4" />}
                    value={companyData.companyLogo?.url || ""}
                    fileName={companyData.companyLogo?.fileName || ""}
                    isOpen={isLogoModalOpen}
                    onClose={() => setIsLogoModalOpen(false)}
                    onChange={async (value, fileName) => {
                      let url = value;
                      if (clientId && value.startsWith("data:")) {
                        try {
                          const key = await uploadBrandingToR2({
                            dataUrlOrFile: value,
                            fileName: fileName || "logo.png",
                            clientId,
                            slot: "logo",
                          });
                          if (key) url = key;
                        } catch (_) {
                          // keep data URL
                        }
                      }
                      const logoData: CompanyLogoData = {
                        url,
                        fileName,
                        fileSize: 0,
                        width: 0,
                        height: 0,
                        hasTransparency:
                          value.includes("data:image/png") ||
                          value.includes("data:image/svg"),
                        warnings: [],
                      };
                      handleLogoChange(logoData);
                      setIsLogoModalOpen(false);
                    }}
                    onRemove={async () => {
                      const currentLogoUrl = companyData.companyLogo?.url;
                      if (
                        typeof currentLogoUrl === "string" &&
                        currentLogoUrl.startsWith("org/")
                      ) {
                        const { deleteFromR2 } = await import(
                          "@/lib/upload-to-r2"
                        );
                        await deleteFromR2(currentLogoUrl);
                      }
                      handleLogoChange(null);
                      setIsLogoModalOpen(false);
                    }}
                    placeholder="Upload Logo"
                    destructive={
                      getValidationErrors().companyLogo?.length > 0
                    }
                  />
                </CardContent>
              </Card>

              {/* Brand Colors */}
              <BrandColorsSection
                primaryColor={companyData.primaryColor}
                secondaryColor={companyData.secondaryColor}
                onPrimaryChange={(color) =>
                  handleInputChange("primaryColor", color)
                }
                onSecondaryChange={(color) =>
                  handleInputChange("secondaryColor", color)
                }
                isPrimaryPickerOpen={
                  companyData.isPrimaryColorPickerOpen || false
                }
                isSecondaryPickerOpen={
                  companyData.isSecondaryColorPickerOpen || false
                }
                onPrimaryPickerOpenChange={(open) =>
                  handleInputChange(
                    "isPrimaryColorPickerOpen",
                    open || false,
                  )
                }
                onSecondaryPickerOpenChange={(open) =>
                  handleInputChange(
                    "isSecondaryColorPickerOpen",
                    open || false,
                  )
                }
                logoDataUrl={
                  (() => {
                    const url = companyData.companyLogo?.url;
                    if (!url) return undefined;
                    // Inline base64 logo → canvas extraction can read it directly.
                    if (url.startsWith("data:")) return url;
                    // R2 branding key (org/...) → resolve to the same-origin proxy
                    // so the canvas pixel analysis works without CORS issues.
                    const r2Key = toR2BrandingKey(url);
                    if (r2Key) return getR2ObjectProxyUrl(r2Key) || undefined;
                    // Root-relative or absolute URL → use as-is.
                    if (url.startsWith("/") || /^https?:\/\//i.test(url)) {
                      return url;
                    }
                    return undefined;
                  })()
                }
                websiteUrl={companyData.companyWebsite}
                organizationName={companyData.companyName}
              />

              {/* Brand Images */}
              <BrandImagesSection
                brandImages={companyData.brandImages}
                onBrandImagesChange={handleBrandImagesChange}
                errorFields={[]}
              />
            </TabsContent>

            {/* ── Tab 2: Preview ── */}
            <TabsContent value="preview" className="mt-0">
              <EditPlanPreviewSection
                companyData={companyData}
                onCompanyDataChange={handleInputChange}
                onWelcomeChange={handleWelcomeChange}
                welcomeData={welcomeData}
                onHeadshotChange={handleHeadshotChange}
                onBackgroundChange={handleBackgroundChange}
                onLogoChange={handleLogoChange}
                defaultWelcomeMessage={defaultWelcomeMessage}
                useDefaultWelcomeMessage={useDefaultWelcomeMessage}
                setUseDefaultWelcomeMessage={setUseDefaultWelcomeMessage}
                clientId={clientId}
                missionHeadline={missionHeadline}
                missionBody={missionBody}
                defaultBodyText={defaultBodyText}
                useDefaultBody={useDefaultBody}
                headlineRef={headlineRef}
                bodyTextRef={bodyTextRef}
                handleHeadlineChange={handleHeadlineChange}
                handleBodyChange={handleBodyChange}
                handleUseDefaultBody={handleUseDefaultBody}
                handleGenerateMissionHeadline={handleGenerateMissionHeadline}
                handleGenerateMissionBody={handleGenerateMissionBody}
                headlineCharCount={headlineCharCount}
                bodyCharCount={bodyCharCount}
                isHeadlineValid={isHeadlineValid}
                isBodyValid={isBodyValid}
                errorFields={errorFields}
              />
            </TabsContent>

            {/* ── Tab 3: Key Contacts ── */}
            <TabsContent value="contacts" className="mt-0">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">Key Contacts</CardTitle>
                      <Button
                        onClick={() => setIsAddContactModalOpen(true)}
                        variant="outline"
                        size="sm"
                        className="text-sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Contact ({keyContacts.length})
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Layout Indicator */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-200 dark:border-gray-700">
                        <span className="flex items-center gap-1.5">
                          <Monitor className="w-3.5 h-3.5" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {keyContactsDisplayStyle === 0
                              ? "Default"
                              : keyContactsDisplayStyle === 2
                                ? "Layout 2"
                                : keyContactsDisplayStyle === 3
                                  ? "Layout 3"
                                  : keyContactsDisplayStyle === 4
                                    ? "Layout 4"
                                    : "None"}
                          </span>
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {keyContactsMobileDisplayStyle === 0
                              ? "Stacked"
                              : keyContactsMobileDisplayStyle === 1
                                ? "2-Col"
                                : keyContactsMobileDisplayStyle === 2
                                  ? "Hero"
                                  : "None"}
                          </span>
                        </span>
                      </div>
                      <Button
                        onClick={() => setIsPreviewLayoutModalOpen(true)}
                        variant="outline"
                        size="sm"
                        className="text-sm"
                      >
                        <Monitor className="w-4 h-4 mr-2" />
                        Preview / Modify Card Layout
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <EditKeyContactsSection
                    contacts={keyContacts}
                    companyData={companyData}
                    documentsData={documentsData}
                    onContactsChange={setKeyContacts}
                    onHeadshotUpload={handleHeadshotUpload}
                    onHeadshotRemove={handleHeadshotRemove}
                    validationErrors={getValidationErrors()}
                    onAddContactForCategory={handleAddContactForCategory}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab 4: Documents ── */}
            <TabsContent value="documents" className="space-y-6 mt-0">
              <EditComplianceDocumentsSection
                documentsData={documentsData}
                companyData={companyData}
                onDocumentsChange={handleDocumentsChange}
                validationErrors={getValidationErrors()}
                clientId={clientId}
                onPendingReviewCountChange={setPendingDocumentUploads}
              />
            </TabsContent>

            {/* ── Tab 5: Disclaimers ── */}
            <TabsContent value="disclaimers" className="mt-0">
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl dark:text-gray-100">
                        Disclaimers
                      </CardTitle>
                      <p className="text-sm text-muted-foreground dark:text-gray-400 font-normal mt-1">
                        Manage disclaimer text displayed in the employee portal
                        footer.
                      </p>
                    </div>

                    {/* Footer Background Color + Preview — inline in header */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pt-1">
                      {(["primary", "secondary", "custom"] as const).map(
                        (mode) => {
                          const label =
                            mode === "primary"
                              ? "Primary"
                              : mode === "secondary"
                                ? "Secondary"
                                : "Custom";
                          const colorVal =
                            mode === "primary"
                              ? companyData.primaryColor
                              : mode === "secondary"
                                ? companyData.secondaryColor
                                : footerBgCustomColor || "#888888";
                          const isActive = footerBgMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                setFooterBgMode(mode);
                                persistFooterBg(mode, footerBgCustomColor);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all whitespace-nowrap ${
                                isActive
                                  ? "border-accent-blue ring-1 ring-accent-blue bg-accent-blue/5 dark:bg-accent-blue/10"
                                  : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                                style={{ background: colorVal }}
                              />
                              {label}
                            </button>
                          );
                        },
                      )}
                      {footerBgMode === "custom" && (
                        <>
                          <input
                            type="color"
                            value={
                              footerBgCustomColor || companyData.primaryColor
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setFooterBgCustomColor(v);
                              persistFooterBg("custom", v);
                            }}
                            className="w-6 h-6 rounded cursor-pointer border border-gray-300 p-0.5"
                          />
                          <input
                            type="text"
                            value={footerBgCustomColor}
                            onChange={(e) => {
                              const v = e.target.value;
                              setFooterBgCustomColor(v);
                              persistFooterBg("custom", v);
                            }}
                            placeholder="#HEX"
                            className="w-20 text-[11px] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-1 bg-transparent dark:text-gray-200"
                          />
                        </>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFooterPreviewOpen(true)}
                        className="inline-flex items-center gap-1.5 ml-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Disclaimer Text */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="disclaimers-text"
                      className="dark:text-gray-300"
                    >
                      Disclaimer Text
                    </Label>
                    <Textarea
                      id="disclaimers-text"
                      value={getResolvedDisclaimerText()}
                      onChange={(e) => {
                        disclaimerEditedRef.current = true;
                        setDisclaimers(
                          ensurePlanTelligenceTrademark(e.target.value),
                        );
                      }}
                      placeholder="Enter legal disclaimers to display in the portal footer..."
                      rows={25}
                      className="min-h-[200px] dark:bg-gray-900 dark:text-gray-200"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── Footer Preview Modal ── */}
              {isFooterPreviewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl">
                      <div className="space-y-2">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Footer Preview
                          </h3>
                          <p className="text-sm text-muted-foreground dark:text-gray-400">
                            How the disclaimer will appear on the{" "}
                            <strong className="text-gray-600 dark:text-gray-300">
                              Home Page
                            </strong>
                          </p>
                        </div>
                        {/* Footer Color selector in header */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mr-1">
                            Footer Color:
                          </span>
                          {(["primary", "secondary", "custom"] as const).map(
                            (mode) => {
                              const label =
                                mode === "primary"
                                  ? "Primary"
                                  : mode === "secondary"
                                    ? "Secondary"
                                    : "Custom";
                              const colorVal =
                                mode === "primary"
                                  ? companyData.primaryColor
                                  : mode === "secondary"
                                    ? companyData.secondaryColor
                                    : footerBgCustomColor || "#888888";
                              const isActive = footerBgMode === mode;
                              return (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => {
                                    setFooterBgMode(mode);
                                    persistFooterBg(mode, footerBgCustomColor);
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all ${
                                    isActive
                                      ? "border-accent-blue ring-1 ring-accent-blue bg-accent-blue/5"
                                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                                  }`}
                                >
                                  <span
                                    className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                                    style={{ background: colorVal }}
                                  />
                                  {label}
                                </button>
                              );
                            },
                          )}
                          {footerBgMode === "custom" && (
                            <>
                              <input
                                type="color"
                                value={
                                  footerBgCustomColor || companyData.primaryColor
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setFooterBgCustomColor(v);
                                  persistFooterBg("custom", v);
                                }}
                                className="w-6 h-6 rounded cursor-pointer border border-gray-300 p-0.5"
                              />
                              <input
                                type="text"
                                value={footerBgCustomColor}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setFooterBgCustomColor(v);
                                  persistFooterBg("custom", v);
                                }}
                                placeholder="#HEX"
                                className="w-20 text-[11px] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-1 bg-transparent dark:text-gray-200"
                              />
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsFooterPreviewOpen(false)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    {/* Preview content */}
                    <div className="p-0">
                      <div className="bg-black min-h-[200px]">
                        {/* Home page content mock */}
                        <div className="px-8 py-12 text-center">
                          <h2 className="text-2xl font-bold text-white mb-2">
                            Welcome to the Benefits Hub!
                          </h2>
                          <p className="text-gray-400 text-sm max-w-xl mx-auto">
                            This is where the home page content would appear.
                            Scroll down to see the Footer with your disclaimer.
                          </p>
                        </div>

                        {/* PortalDisclaimers with disclaimer text */}
                        <PortalDisclaimers
                          companyData={{
                            disclaimers: getResolvedDisclaimerPreviewText(),
                            brandColor: resolvedFooterBgColor,
                            companyName: companyData.companyName,
                          }}
                          brandColor={resolvedFooterBgColor}
                        />
                      </div>
                    </div>

                    {/* Close button */}
                    <div className="flex justify-center px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <Button
                        onClick={() => setIsFooterPreviewOpen(false)}
                        variant="outline"
                      >
                        Close Preview
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Add Contact Modal */}
        <AddMoreContactsModal
          open={isAddContactModalOpen}
          onOpenChange={setIsAddContactModalOpen}
          onSkip={() => setIsAddContactModalOpen(false)}
          onAddContactForCategory={handleAddContactForCategory}
          contacts={keyContacts}
        />

        {/* Card Selection Modal */}
        <CardSelectionModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onConfirm={(selectedIndex) => {
            setKeyContactsDisplayStyle(selectedIndex);
          }}
          initialSelectedIndex={keyContactsDisplayStyle ?? null}
        />

        {/* Contact Card Layout Preview Modal */}
        <ContactCardLayoutPreviewModal
          isOpen={isPreviewLayoutModalOpen}
          onClose={() => setIsPreviewLayoutModalOpen(false)}
          currentDisplayStyle={keyContactsDisplayStyle}
          mobileDisplayStyle={keyContactsMobileDisplayStyle}
          onConfirm={(displayStyle, mobileDisplayStyle) => {
            setKeyContactsDisplayStyle(displayStyle);
            setKeyContactsMobileDisplayStyle(mobileDisplayStyle);
          }}
          contacts={keyContacts}
          brandColor={companyData.primaryColor}
          secondaryColor={companyData.secondaryColor}
          companyName={companyData.companyName}
          currentUserEmail={userEmail || null}
          currentUserOrgName={userOrgName || null}
        />

        {/* Disclaimer Update Confirmation Dialog */}
        <DisclaimerUpdateConfirmDialog
          open={showDisclaimerConfirmDialog}
          onOpenChange={setShowDisclaimerConfirmDialog}
          onConfirm={handleConfirmDisclaimerSave}
          submitting={isSavingDisclaimer}
        />
      </div>

      {/* Fixed Save Button Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg">
        <div className="mx-auto max-w-5xl px-4 py-4 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/new/clients")}
            disabled={saving}
          >
            Cancel
          </Button>
          <SaveButton
            onSave={handleSaveClick}
            saving={saving}
            clientStatus={clientStatus}
            isFormValid={isFormValid()}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
