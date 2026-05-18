"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { UniversalImageEditorModal } from "@/components/ui/universal-image-editor-modal";
import type { CropMetadata } from "@/components/ui/simple-image-editor-modal";
import { BrandChangeConfirmationModal } from "./brand-change-confirmation-modal";
import { CompanyBrandingOverrideModal } from "./company-branding-override-modal";
import { Button } from "@/components/ui/button";
import { BrandingImage } from "@/components/ui/branding-image";

interface PlanSummary {
  id: string;
  companyName?: string;
  companyLogo?: string;
  status?: string;
}

interface CompanyNameSelectorProps {
  value: string;
  onChange: (value: string) => void;
  logo: string;
  onLogoChange: (logo: string) => void;
  defaultCompanyName: string;
  defaultCompanyLogo: string;
  isInternalHR?: boolean;
  companyNameRef?: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
  isPlanSponsor?: boolean;
  benefitsCategories?: string[];
  advisorOrgName?: string;
  advisorOrgLogo?: string;
  advisorOffersThisBenefit?: boolean;
  otherBenefitsText?: string;
  onOtherBenefitsTextChange?: (value: string) => void;
  onUpdatePlanName?: (newName: string) => void;
  onUpdatePlanLogo?: (newLogo: string) => void;
  onUpdateFirmBranding?: (data: { company?: string; logo?: string }) => void;
  errorFields?: string[];
}

export function CompanyNameSelector({
  value,
  onChange,
  logo,
  onLogoChange,
  defaultCompanyName,
  defaultCompanyLogo,
  isInternalHR = false,
  companyNameRef,
  disabled = false,
  isPlanSponsor = false,
  benefitsCategories = [],
  advisorOrgName,
  advisorOrgLogo,
  advisorOffersThisBenefit = false,
  otherBenefitsText,
  onOtherBenefitsTextChange,
  onUpdatePlanName,
  onUpdatePlanLogo,
  onUpdateFirmBranding,
  errorFields = [],
}: CompanyNameSelectorProps) {
  const isHRPeople =
    isPlanSponsor || benefitsCategories.includes("Company / Plan Sponsor");
  const isOtherBenefits = benefitsCategories.includes("Other Benefits");
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [matchedCompany, setMatchedCompany] = useState<PlanSummary | null>(
    null,
  );


  // Modal state for UniversalImageEditorModal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingImageData, setPendingImageData] = useState<{
    url: string;
    originalUrl?: string;
    fileName?: string;
    cropData?: CropMetadata;
  } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Brand change confirmation modal state
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isBrandingOverrideModalOpen, setIsBrandingOverrideModalOpen] = useState(false);
  const [brandingOverrideType, setBrandingOverrideType] = useState<"name" | "logo">("name");
  const [pendingNameChange, setPendingNameChange] = useState<string | null>(null);
  const [pendingLogoChange, setPendingLogoChange] = useState<string | null>(null);
  const [changeType, setChangeType] = useState<"name" | "logo" | "both">("name");
  const hasConfirmedBrandChange = useRef(false);
  const hasConfirmedNameOverride = useRef(false);
  const pendingLogoValueRef = useRef<string | null>(null);
  const initialNameRef = useRef<string>(value);
  const initialLogoRef = useRef<string>(logo);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setIsLoadingPlans(true);
        const response = await fetch("/api/clients");
        const result = await response.json();

        if (result?.success && Array.isArray(result.data)) {
          const activePlans = result.data.filter(
            (plan: any) => (plan.status || "").toLowerCase() !== "draft",
          );

          const mappedPlans: PlanSummary[] = activePlans.map((plan: any) => ({
            id: String(plan.id || plan._id),
            companyName: plan.companyName || plan.clientName,
            companyLogo:
              plan.companyLogo ||
              plan.logo ||
              plan.clientLogo ||
              plan.thumbnailImg ||
              "",
            status: plan.status,
          }));

          setPlans(mappedPlans);
        }
      } catch (error) {
        console.error("Failed to fetch plans for key contacts:", error);
      } finally {
        setIsLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);




  useEffect(() => {
    // Check for matching company for all categories (not just HR/People)
    const searchValue =
      isOtherBenefits && onOtherBenefitsTextChange
        ? otherBenefitsText || ""
        : value;

    if (
      searchValue &&
      searchValue !== defaultCompanyName &&
      searchValue !== advisorOrgName &&
      plans.length > 0
    ) {
      const matched = plans.find(
        (plan) =>
          plan.companyName?.toLowerCase().trim() ===
          searchValue.toLowerCase().trim(),
      );
      setMatchedCompany(matched || null);
    } else {
      setMatchedCompany(null);
    }
  }, [
    value,
    otherBenefitsText,
    isOtherBenefits,
    onOtherBenefitsTextChange,
    defaultCompanyName,
    advisorOrgName,
    plans,
  ]);

  // For Other Benefits, use otherBenefitsText as the value instead of company name
  const displayValue =
    isOtherBenefits && onOtherBenefitsTextChange
      ? otherBenefitsText || ""
      : value;

  // Fetch available plans (clients) to allow selecting company & logo
  const [localValue, setLocalValue] = useState(displayValue);
  const isDirty = localValue !== displayValue;

  // Update local value when display value changes from parent
  useEffect(() => {
    setLocalValue(displayValue);
  }, [displayValue]);

  // Update initial refs when value/logo change from parent (e.g., when switching contacts)
  useEffect(() => {
    initialNameRef.current = value;
    initialLogoRef.current = logo;
  }, [value, logo]);

  // Handler for brand change confirmation
  const handleBrandChangeConfirm = useCallback((applyToAllPlans: boolean) => {
    hasConfirmedBrandChange.current = true;

    if (applyToAllPlans && onUpdateFirmBranding) {
      onUpdateFirmBranding({
        company: pendingNameChange !== null ? pendingNameChange : undefined,
        logo: (pendingLogoChange !== null || pendingLogoValueRef.current !== null) 
          ? (pendingLogoChange || pendingLogoValueRef.current || undefined) 
          : undefined
      });
    }

    if (pendingNameChange !== null) {
      onChange(pendingNameChange);
      // Also update plan name if it's a plan-level change (always true if name changed here)
      if (onUpdatePlanName) onUpdatePlanName(pendingNameChange);
      setPendingNameChange(null);
    }

    if (pendingLogoChange !== null || pendingLogoValueRef.current !== null) {
      const logoToUse = pendingLogoChange || pendingLogoValueRef.current;
      if (logoToUse) {
        onLogoChange(logoToUse);
        // Also update plan logo if it's a plan-level change
        if (onUpdatePlanLogo) onUpdatePlanLogo(logoToUse);
      }
      setPendingLogoChange(null);
      pendingLogoValueRef.current = null;
    }

    setIsBrandModalOpen(false);
    // Finally close the image editor modal
    setIsModalOpen(false);
    setPendingImageData(null);
    setIsEditMode(false);


  }, [pendingNameChange, pendingLogoChange, onChange, onLogoChange]);

  // Handler for closing brand change modal
  const handleBrandModalClose = useCallback(() => {
    setIsBrandModalOpen(false);
    setPendingNameChange(null);
    setPendingLogoChange(null);
    pendingLogoValueRef.current = null;
    
    // Also close the image editor if it was waiting
    setIsModalOpen(false);
    setPendingImageData(null);
    setIsEditMode(false);
  }, []);

  // Interceptor for name changes
  const handleNameChangeWithConfirmation = useCallback((newValue: string) => {
    // Skip confirmation if:
    // 1. Value hasn't actually changed from initial
    // 2. It's an auto-fill scenario (empty to filled)
    if (
      newValue === initialNameRef.current ||
      !initialNameRef.current ||
      initialNameRef.current === ""
    ) {
      onChange(newValue);
      return;
    }

    setPendingNameChange(newValue);

    if (isHRPeople) {
      // Show specialized name override modal for Company / Plan Sponsor
      setBrandingOverrideType("name");
      setIsBrandingOverrideModalOpen(true);
    } else {
      // Show standard brand change modal for others
      setChangeType("name");
      setIsBrandModalOpen(true);
    }
  }, [onChange, isHRPeople]);

  // Interceptor for logo changes
  const handleLogoChangeWithConfirmation = useCallback((newLogo: string) => {
    // Skip confirmation if:
    // 1. Logo hasn't actually changed from initial
    // 2. It's an auto-fill scenario (empty to filled)
    if (
      newLogo === initialLogoRef.current ||
      (!isHRPeople && (!initialLogoRef.current || initialLogoRef.current === ""))
    ) {
      onLogoChange(newLogo);
      return;
    }

    // Show confirmation modal
    pendingLogoValueRef.current = newLogo;
    setPendingLogoChange(newLogo);

    if (isHRPeople) {
      setBrandingOverrideType("logo");
      setIsBrandingOverrideModalOpen(true);
    } else {
      setChangeType("logo");
      setIsBrandModalOpen(true);
    }
  }, [onLogoChange, isHRPeople]);


  const handleModalSave = useCallback(
    (
      value: string,
      fileName: string,
      headshotData?: any,
      cropData?: CropMetadata,
    ) => {
      if (pendingImageData) {
        // Capture new logo value in ref
        pendingLogoValueRef.current = value;
        
        // This triggers the confirmation logic
        // We now handle closing the editor modal in the confirmation callbacks
        handleLogoChangeWithConfirmation(value);
        
        // If confirmation modal won't show, close editor now
        if (
          hasConfirmedBrandChange.current ||
          value === initialLogoRef.current ||
          !initialLogoRef.current ||
          initialLogoRef.current === ""
        ) {
          setIsModalOpen(false);
          setPendingImageData(null);
          setIsEditMode(false);
        }
      } else {
        setIsModalOpen(false);
        setPendingImageData(null);
        setIsEditMode(false);
      }
    },
    [pendingImageData, handleLogoChangeWithConfirmation],
  );

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setPendingImageData(null);
    setIsEditMode(false);
  }, []);

  // Handle edit click - open modal with current logo
  const handleEditClickWithModal = useCallback(() => {
    if (logo) {
      setPendingImageData({
        url: logo,
        originalUrl: logo,
        fileName: "company-logo",
        cropData: undefined, // Will be set if there's existing crop data
      });
      setIsEditMode(true);
      setIsModalOpen(true);
    }
  }, [logo]);

  // Handle file selection - open modal when file is selected
  const handleFileSelect = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      setPendingImageData({
        url: base64String,
        originalUrl: base64String,
        fileName: file.name,
      });
      setIsEditMode(false);
      setIsModalOpen(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleApplyValue = () => {
    const newValue = localValue;
    if (isOtherBenefits && onOtherBenefitsTextChange) {
      const value = newValue.slice(0, 50); // Max 50 characters
      onOtherBenefitsTextChange(value);
    } else if (isHRPeople) {
      // Only require confirmation for Company / Plan Sponsor (HR People)
      handleNameChangeWithConfirmation(newValue);
    } else {
      // For other contacts (Retirement, etc.), just update the value
      onChange(newValue);
    }
  };


  const handleCompanyLogoRemove = () => {
    if (window.confirm("Are you sure you want to remove the logo for this contact?")) {
      onLogoChange("");
    }
  };


  // Determine what logo to display
  // Logic: 
  // 1. If logo is an empty string, it's explicitly removed ("")
  // 2. If logo is undefined/null, we fall back to default
  const effectiveLogo = logo !== undefined && logo !== null ? logo : defaultCompanyLogo;

  return (
    <div className="space-y-2">
      <Label>Company/Provider Name & Logo</Label>
      <div className="flex items-center gap-3">
        {/* Company Logo Image with Upload */}
        <div className="flex-shrink-0">
          <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
            {effectiveLogo ? (
              // If logo exists, show it with edit/remove options
              <div className="relative">
                <div
                  className="w-12 h-12 rounded border border-gray-200 cursor-pointer overflow-hidden flex items-center justify-center"
                  onClick={() => {
                    if (!disabled) {
                      handleEditClickWithModal();
                    }
                  }}
                >
                  <BrandingImage
                    src={effectiveLogo}
                    alt="Company logo"
                    fillContainer
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) {
                      handleCompanyLogoRemove();
                    }
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ) : (
              // If no logo, show upload button
              <UniversalImageEditorModal
                type="normalizer"
                value=""
                onChange={(value, fileName, headshotData?, cropData?) => {
                  // When user saves from modal
                  if (value) {
                    handleLogoChangeWithConfirmation(value);
                  }
                }}
                onRemove={() => { }}
                placeholder="Upload Logo"
                autoSizeOnOpen={true}
              />
            )}

            {/* Modal for editing existing logo */}
            {pendingImageData && (
              <UniversalImageEditorModal
                key={pendingImageData.url}
                type="normalizer"
                value={pendingImageData.url || ""}
                originalValue={pendingImageData.originalUrl}
                fileName={pendingImageData.fileName || ""}
                existingCropData={pendingImageData.cropData}
                onChange={handleModalSave}
                onRemove={handleModalClose}
                isOpen={isModalOpen}
                onClose={handleModalClose}
                hidePerfectMessage={isEditMode}
              />
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex-1 relative",
            (isCompanyDropdownOpen || matchedCompany) && "z-50",
          )}
        >

          <Input
            ref={companyNameRef}
            type="text"
            value={localValue}
            onChange={(e) => {
              const newValue = e.target.value;
              // Update search term for dropdown filtering
              setCompanySearchTerm(newValue);
              // Update local state ONLY
              setLocalValue(newValue);
              
              // Show dropdown for company search for all categories except HR/People
              if (!isHRPeople && newValue.length > 0) {
                setIsCompanyDropdownOpen(true);
              } else if (!isHRPeople && newValue.length === 0) {
                setIsCompanyDropdownOpen(false);
              }
            }}
            onFocus={() => {
              // Show dropdown for company search for all categories except HR/People
              if (!isHRPeople) {
                setIsCompanyDropdownOpen(true);
              }
            }}
            onBlur={() => {
              // Hide dropdown for all categories except HR/People
              if (!isHRPeople) {
                setTimeout(() => setIsCompanyDropdownOpen(false), 200);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isDirty) {
                e.preventDefault();
                handleApplyValue();
              }
            }}
            placeholder={
              isOtherBenefits
                ? "Enter benefit type"
                : isHRPeople
                  ? "Company name (override)"
                  : "Search or enter company name"
            }
            maxLength={isOtherBenefits ? 50 : undefined}
            className={cn(
              "w-full pr-16",
              disabled && "opacity-50 cursor-not-allowed",
              isOtherBenefits &&
              errorFields.includes("otherBenefitsText") &&
              !otherBenefitsText?.trim() &&
              "border-red-500",
              isDirty && "border-amber-400"
            )}
            disabled={disabled}
          />

          {isDirty && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 animate-pulse uppercase">
                Not Saved
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleApplyValue}
                className="h-7 px-2 text-xs bg-accent-blue text-white hover:bg-accent-blue/90"
              >
                Apply
              </Button>
            </div>
          )}
          {/* Character counter for Other Benefits */}
          {isOtherBenefits && (
            <div
              className={cn(
                "absolute -top-8 right-0 flex items-center gap-2 transition-all duration-500 ease-out",
                (otherBenefitsText?.length || 0) >= 35
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none",
              )}
            >
              <span
                className={cn(
                  "text-xs transition-colors duration-300",
                  (otherBenefitsText?.length || 0) >= 50
                    ? "text-red-500"
                    : "text-muted-foreground",
                )}
              >
                {otherBenefitsText?.length || 0}/50 characters
              </span>
            </div>
          )}
          {/* Error message for Other Benefits */}
          {isOtherBenefits &&
            errorFields.includes("otherBenefitsText") &&
            !otherBenefitsText?.trim() && (
              <p className="text-xs text-red-500 mt-1">
                Please specify the benefit type
              </p>
            )}

          {matchedCompany &&
            displayValue !== defaultCompanyName &&
            displayValue !== advisorOrgName && (
              <div className="absolute z-[60] w-full mt-1 bg-accent-blue/5 border border-accent-blue/20 rounded-md shadow-lg p-3 bg-white">

                <div className="text-sm text-accent-blue font-medium mb-2">
                  <strong>Found matching company:</strong>{" "}
                  {matchedCompany.companyName}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (isOtherBenefits && onOtherBenefitsTextChange) {
                        // For Other Benefits, insert company name into otherBenefitsText field
                        onOtherBenefitsTextChange(
                          matchedCompany.companyName || "",
                        );
                        onChange(matchedCompany.companyName || "");
                        onLogoChange(matchedCompany.companyLogo || "");
                      } else {
                        onChange(matchedCompany.companyName || "");
                        onLogoChange(matchedCompany.companyLogo || "");
                      }
                      setMatchedCompany(null);
                    }}
                    className="px-3 py-1.5 text-sm bg-accent-blue text-white rounded-md hover:opacity-90 transition-opacity"
                  >
                    Use saved company
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMatchedCompany(null);
                    }}
                    className="px-3 py-1.5 text-sm bg-white text-accent-blue border border-accent-blue/20 rounded-md hover:bg-accent-blue/5"
                  >
                    {isHRPeople ? "Keep override" : "Create new"}
                  </button>
                </div>
              </div>
            )}

          {isCompanyDropdownOpen &&
            !isInternalHR &&
            !disabled &&
            !isHRPeople &&
            companySearchTerm && (
              <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-[300px] overflow-y-auto">

                <div className="p-2">
                  {/* Show advisor org as default if they offer this benefit */}
                  {advisorOffersThisBenefit &&
                    advisorOrgName &&
                    (!companySearchTerm ||
                      advisorOrgName
                        .toLowerCase()
                        .includes(companySearchTerm.toLowerCase())) && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (isOtherBenefits && onOtherBenefitsTextChange) {
                            // For Other Benefits, insert advisor org name into otherBenefitsText field
                            onOtherBenefitsTextChange(advisorOrgName);
                            onChange(advisorOrgName);
                            onLogoChange(advisorOrgLogo || "");
                          } else {
                            onChange(advisorOrgName);
                            onLogoChange(advisorOrgLogo || "");
                          }
                          setCompanySearchTerm("");
                          setIsCompanyDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left",
                          displayValue === advisorOrgName && "bg-accent",
                        )}
                      >
                        {advisorOrgLogo ? (
                          <div className="w-8 h-8 rounded border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            <BrandingImage
                              src={advisorOrgLogo}
                              alt={advisorOrgName ?? "Logo"}
                              fillContainer
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center bg-gray-50 flex-shrink-0">
                            <Building2 className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {advisorOrgName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Default
                          </div>
                        </div>
                        {displayValue === advisorOrgName && (
                          <Check className="w-4 h-4 text-accent-blue flex-shrink-0" />
                        )}
                      </button>
                    )}

                  {isLoadingPlans ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Loading companies...
                    </div>
                  ) : (
                    plans
                      .filter(
                        (plan) =>
                          !companySearchTerm ||
                          plan.companyName
                            ?.toLowerCase()
                            .includes(companySearchTerm.toLowerCase()),
                      )
                      .map((plan) => (
                        <button
                          key={plan.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (isOtherBenefits && onOtherBenefitsTextChange) {
                              // For Other Benefits, insert company name into otherBenefitsText field
                              onOtherBenefitsTextChange(plan.companyName || "");
                              onChange(plan.companyName || "");
                              onLogoChange(plan.companyLogo || "");
                            } else {
                              onChange(plan.companyName || "");
                              onLogoChange(plan.companyLogo || "");
                            }
                            setCompanySearchTerm("");
                            setIsCompanyDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left",
                            displayValue === plan.companyName && "bg-accent",
                          )}
                        >
                          {plan.companyLogo ? (
                            <div className="w-8 h-8 rounded border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                              <BrandingImage
                                src={plan.companyLogo}
                                alt={plan.companyName ?? "Logo"}
                                fillContainer
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center bg-gray-50 flex-shrink-0">
                              <span className="text-xs font-semibold text-gray-600">
                                {plan.companyName?.charAt(0).toUpperCase() ||
                                  "?"}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {plan.companyName || "Unnamed"}
                            </div>
                          </div>
                          {displayValue === plan.companyName && (
                            <Check className="w-4 h-4 text-accent-blue flex-shrink-0" />
                          )}
                        </button>
                      ))
                  )}

                  {/* No results */}
                  {companySearchTerm &&
                    !advisorOrgName
                      ?.toLowerCase()
                      .includes(companySearchTerm.toLowerCase()) &&
                    !defaultCompanyName
                      .toLowerCase()
                      .includes(companySearchTerm.toLowerCase()) &&
                    plans.filter(
                      (plan) =>
                        plan.companyName
                          ?.toLowerCase()
                          .includes(companySearchTerm.toLowerCase()),
                    ).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No companies found. You can type a custom name.
                      </div>
                    )}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Brand Change Confirmation Modal */}
      <BrandChangeConfirmationModal
        isOpen={isBrandModalOpen}
        onClose={handleBrandModalClose}
        onConfirm={handleBrandChangeConfirm}
        changeType={changeType}
      />

      {/* Company Branding Override Confirmation Modal (Name or Logo) */}
      <CompanyBrandingOverrideModal
        isOpen={isBrandingOverrideModalOpen}
        onClose={() => {
          setIsBrandingOverrideModalOpen(false);
          setPendingNameChange(null);
          setPendingLogoChange(null);
          pendingLogoValueRef.current = null;
          
          // Also close the image editor
          setIsModalOpen(false);
          setPendingImageData(null);
          setIsEditMode(false);
        }}
        onConfirm={(syncGlobally) => {
          if (brandingOverrideType === "name") {
            if (pendingNameChange !== null) {
              if (syncGlobally && onUpdatePlanName) {
                onUpdatePlanName(pendingNameChange);
              }
              onChange(pendingNameChange);
              setPendingNameChange(null);
            }
          } else {
            if (pendingLogoChange !== null || pendingLogoValueRef.current !== null) {
              const logoToUse = pendingLogoChange || pendingLogoValueRef.current;
              if (logoToUse) {
                // Note: We don't have a specific hasConfirmedLogoOverride ref but we can add if needed
                if (syncGlobally && onUpdatePlanLogo) {
                  onUpdatePlanLogo(logoToUse);
                }
                onLogoChange(logoToUse);
              }
              setPendingLogoChange(null);
              pendingLogoValueRef.current = null;
            }
          }
          setIsBrandingOverrideModalOpen(false);
          // Also close the image editor now that we are done
          setIsModalOpen(false);
          setPendingImageData(null);
          setIsEditMode(false);
        }}
        pendingValue={brandingOverrideType === "name" ? (pendingNameChange || "") : (pendingLogoChange || pendingLogoValueRef.current || "")}
        type={brandingOverrideType}
      />
    </div>
  );
}
