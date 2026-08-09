"use client";

import { useState, useEffect } from "react";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Edit,
  User,
  Palette,
  Contact,
  CheckCircle,
  Briefcase,
} from "lucide-react";
import { Headshot } from "@/components/ui/headshot";
import { BrandingImage } from "@/components/ui/branding-image";
import { SummaryEditModal } from "./sections/summary-edit-modals/summary-edit-modal";
import { Step5Disclaimers } from "./step-5-disclaimers";

// Format phone number for display (no country code)
const formatPhoneNumber = (phone: string): string => {
  if (!phone) return "Not specified";

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Format based on length
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  } else if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  } else if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Return as is for other lengths
  return phone;
};

interface Step5SummaryProps {
  errorFields?: string[];
  onValidationChange?: (isValid: boolean) => void;
}

export function Step5Summary({
   errorFields = [],
   onValidationChange,
 }: Step5SummaryProps) {
   const {
     stepData,
     saveStepDataLocally,
     loadStepData,
     saveStepData,
     saveSummaryData,
     showNextSteps,
     setShowNextSteps,
     showStep5ConfirmModal,
     setShowStep5ConfirmModal,
     goToStep,
   } = useOnboardingWizardStore();

 // Organization name for the disclaimer default — Onboarding is org-only (no [Company Name]).
 const organizationName = stepData.branding?.organizationName || "";
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  // Initialize as true since disclaimers are optional
  const [isDisclaimersValid, setIsDisclaimersValid] = useState(true);
  const [showValidationError, setShowValidationError] = useState(false);
  // Local state for branding colors to ensure they display correctly
  // even if the reactive stepData from the zustand hook is stale.
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState<string>(
    stepData.branding?.primaryColor || ""
  );
  const [brandingSecondaryColor, setBrandingSecondaryColor] = useState<string>(
    stepData.branding?.secondaryColor || ""
  );

  // Load data when component mounts
  useEffect(() => {
    const loadData = async () => {
      await loadStepData("clientProfile");
      await loadStepData("teamSize");
      await loadStepData("services");
      await loadStepData("branding");
      const userSetupData = await loadStepData("userSetup");

      // Read the latest branding data directly from the store (bypasses any
      // caching/reactivity issues with loadStepData) and store in local state.
      const store = useOnboardingWizardStore.getState();
      const branding = store.stepData.branding;
      if (branding) {
        if (branding.primaryColor) {
          setBrandingPrimaryColor(branding.primaryColor);
        }
        if (branding.secondaryColor) {
          setBrandingSecondaryColor(branding.secondaryColor);
        }
      }

      // Debug: log what Step 5 sees for branding colors
      console.log("[Step5] branding data from store:", {
        primaryColor: branding?.primaryColor,
        secondaryColor: branding?.secondaryColor,
        fullBranding: branding,
      });
    };

    loadData();
  }, [loadStepData]);

  // Sync local branding color state whenever stepData.branding changes
  // (e.g., when user edits branding from Step 5 via goToStep(3) and returns).
  useEffect(() => {
    if (stepData.branding?.primaryColor) {
      setBrandingPrimaryColor(stepData.branding.primaryColor);
    }
    if (stepData.branding?.secondaryColor) {
      setBrandingSecondaryColor(stepData.branding.secondaryColor);
    }
  }, [stepData.branding?.primaryColor, stepData.branding?.secondaryColor]);

  const handleSaveEdit = async (updatedData: any) => {
    try {
      // Prepare summary data for saving
      const summaryData: any = {};

      // Add client profile data if present
      if (
        updatedData.organizationType ||
        updatedData.customOrganization ||
        updatedData.website
      ) {
        summaryData.clientProfile = {
          organizationType: updatedData.organizationType,
          customOrganization: updatedData.customOrganization,
          website: updatedData.website,
        };
      }

      // Add team size data if present
      if (updatedData.teamSize) {
        summaryData.teamSize = {
          teamSize: updatedData.teamSize,
        };
      }

      // Add services data if present
      if (updatedData.services || updatedData.customService) {
        summaryData.services = {
          services: updatedData.services,
          customService: updatedData.customService,
        };
      }

      // Add branding data if present
      if (
        updatedData.brandColor ||
        updatedData.missionStatement ||
        updatedData.logo ||
        updatedData.backgroundImage
      ) {
        summaryData.branding = {
          brandColor: updatedData.brandColor,
          missionStatement: updatedData.missionStatement,
          logo: updatedData.logo,
          backgroundImage:
            typeof updatedData.backgroundImage === "string"
              ? updatedData.backgroundImage
              : "",
          backgroundFileName: updatedData.backgroundFileName || "",
        };
      }

      // Add user setup data if present
      if (
        updatedData.name ||
        updatedData.email ||
        updatedData.phone ||
        updatedData.title ||
        updatedData.designations ||
        updatedData.headshot
      ) {
        summaryData.userSetup = {
          name: updatedData.name,
          email: updatedData.email,
          phone: updatedData.phone,
          phoneExtension: updatedData.phoneExtension || "",
          title: updatedData.title,
          designations: updatedData.designations,
          saveAsContact: updatedData.saveAsContact,
          headshot:
            typeof updatedData.headshot === "string"
              ? updatedData.headshot
              : "",
          headshotFileName: updatedData.headshotFileName || "",
          backgroundImage: updatedData.userBackgroundImage || "",
          backgroundFileName: updatedData.userBackgroundFileName || "",
        };
      }

      // Save all data at once
      await saveSummaryData(summaryData);
    } catch (error) {
      console.error("❌ Step5 - Failed to save summary data:", error);
    }
  };

  const getOrganizationTypeDisplay = () => {
    const orgType = stepData.clientProfile?.organizationType;
    const customOrg = stepData.clientProfile?.customOrganization;

    if (customOrg) return customOrg;
    if (!orgType) return "Not specified";

    // Map organization types to display names
    const orgTypeMap: { [key: string]: string } = {
      independent: "Independent Advisor",
      ria: "RIA (Registered Investment Advisor)",
      broker_dealer: "Broker-Dealer",
      insurance_agency: "Insurance Agency",
      bank: "Bank",
      credit_union: "Credit Union",
      accounting_firm: "Accounting Firm",
      law_firm: "Law Firm",
      family_office: "Family Office",
      plan_sponsor: "Plan Sponsor",
      tpa: "TPA (Third Party Administrator)",
      recordkeeper: "Recordkeeper",
      investment_advisor: "Investment Advisor",
      financial_planner: "Financial Planner",
      wealth_manager: "Wealth Manager",
      other: "Other",
    };

    return orgTypeMap[orgType] || orgType;
  };

  const getTeamSizeDisplay = () => {
    const teamSize = stepData.teamSize?.teamSize;
    if (teamSize === "just_me") return "Just me";
    if (teamSize === "2_5") return "2-5 people";
    if (teamSize === "6_20") return "6-20 people";
    if (teamSize === "enterprise") return "Enterprise";
    return "Not specified";
  };

  const getServicesDisplay = () => {
    const services = stepData.services?.services || [];
    const customService = stepData.services?.customService;
    if (services.length === 0 && !customService) return "Not specified";

    const serviceNames: string[] = services.map((service) => {
      if (service === "retirement") return "Retirement";
      if (service === "group_life_disability") return "Group Life & Disability";
      if (service === "group_health") return "Group Health";
      if (service === "supplemental_health") return "Supplemental Health";
      if (service === "other") return "Other";
      return service;
    });

    if (customService) serviceNames.push(customService);
    return serviceNames.join(", ");
  };

  const getBrandColorDisplay = () => {
    const brandColor = stepData.branding?.brandColor;
    if (!brandColor) return "Not specified";
    return `${brandColor}`;
  };

  const getPrimaryColorDisplay = () => {
    // Use local state first (most reliable), fall back to reactive stepData
    const primaryColor = brandingPrimaryColor || stepData.branding?.primaryColor;
    if (!primaryColor) return "Not specified";
    return `${primaryColor}`;
  };

  const getSecondaryColorDisplay = () => {
    // Use local state first (most reliable), fall back to reactive stepData
    const secondaryColor = brandingSecondaryColor || stepData.branding?.secondaryColor;
    if (!secondaryColor) return "Not specified";
    return `${secondaryColor}`;
  };

  const getDesignationsDisplay = () => {
    const designations = stepData.userSetup?.designations || [];
    if (designations.length === 0) return "None";
    return designations.map((d) => `[${d}]`).join(" ");
  };

  // Handle disclaimers validation
  const handleDisclaimersValidation = (isValid: boolean) => {
    setIsDisclaimersValid(isValid);
    if (isValid) {
      setShowValidationError(false);
    }
    // Notify parent component about validation status
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  };

  // Update validation when showing next steps (step 5 is always valid until next steps)
  // But respect disclaimers validation if it exists
  useEffect(() => {
    if (onValidationChange && !showNextSteps) {
      // Setup Complete screen is always valid (no required fields)
      // But only if disclaimers are valid (handled by handleDisclaimersValidation)
      if (isDisclaimersValid !== false) {
        onValidationChange(true);
      }
    }
  }, [showNextSteps, onValidationChange, isDisclaimersValid]);

  const handleConfirmNext = () => {
    setShowStep5ConfirmModal(false);
    setShowNextSteps(true);
  };

  const handleCancelNext = () => {
    setShowStep5ConfirmModal(false);
  };

  // If showing next steps, render that view
  if (showNextSteps) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="mt-6">
          <p className="text-gray-600 dark:text-gray-400">
            Add a disclaimer to your profile that populates in the footer of each Portal Hub
          </p>
        </div>

        {/* Next Steps Section - Vertical Layout */}
        <div className="space-y-4">
          {/* Add Disclaimers */}
          <div>
            <Card className="p-4 dark:bg-gray-800 shadow-none">
              <CardContent className="pt-3 pb-3">
                <Step5Disclaimers
                  onValidationChange={handleDisclaimersValidation}
                  errorFields={errorFields}
                  organizationName={organizationName}
                  forceUniversalScope={true}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Validation Error - shown when trying to proceed without selecting disclaimer option */}
        {showValidationError && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Please complete required fields
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  You must select when to add disclaimers (Add Now or Add Later)
                  before proceeding to the dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal - for Next Steps screen */}
        <SummaryEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingSection(null);
          }}
          onSave={handleSaveEdit}
          initialData={stepData}
        />
      </div>
    );
  }

  // Otherwise, show the Setup Complete screen
  return (
    <div className="space-y-6">
      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-6">

        {/* Card 1: User Profile */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* <User className="w-5 h-5 text-blue-600" /> */}
                <CardTitle className="text-lg font-semibold">
                  User Profile
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToStep(1)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                Organization Type
              </p>
              <p className="text-sm text-muted-foreground">
                {getOrganizationTypeDisplay()}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Team Size</p>
              <p className="text-sm text-muted-foreground">{getTeamSizeDisplay()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Services Provided */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* <Briefcase className="w-5 h-5 text-green-600" /> */}
                <CardTitle className="text-lg font-semibold">
                  Services Provided
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToStep(2)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Services</p>
              <p className="text-sm text-muted-foreground">{getServicesDisplay()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Branding */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* <Palette className="w-5 h-5 text-purple-600" /> */}
                <CardTitle className="text-lg font-semibold">Branding</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToStep(3)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex justify-between">
            <div className="space-y-2">
              <div className="mt-4">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Organization Name
                </p>
                <p className="text-sm text-muted-foreground">
                  {stepData.clientProfile?.customOrganization ||
                    stepData.branding?.organizationName ||
                    "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Organization Website
                </p>
                <p className="text-sm text-muted-foreground">
                  {stepData.branding?.website || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Logo</p>
                <div className="mt-2">
                  {stepData.branding?.logo ? (
                    <BrandingImage
                      src={stepData.branding.logo}
                      alt="Organization Logo"
                      className="w-16 h-16 object-contain rounded border border-gray-300 dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                      <span className="text-xs text-gray-400 dark:text-gray-500">No logo</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Primary Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                    style={{
                      backgroundColor:
                        brandingPrimaryColor || stepData.branding?.primaryColor || "#1F3A60",
                    }}
                  ></div>
                  <span className="text-sm text-muted-foreground">
                    {getPrimaryColorDisplay()}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Secondary Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                    style={{
                      backgroundColor:
                        brandingSecondaryColor || stepData.branding?.secondaryColor || "#4A90E2",
                    }}
                  ></div>
                  <span className="text-sm text-muted-foreground">
                    {getSecondaryColorDisplay()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
          <div className="border-t dark:border-gray-700 pt-4 px-6 pb-6">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Background Image</p>
            {stepData.branding?.backgroundImage ? (
              <BrandingImage
                src={stepData.branding.backgroundImage}
                alt="Branding Background"
                className="w-full h-64 rounded border border-gray-300 dark:border-gray-600"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <div className="w-full h-64 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                <span className="text-sm text-gray-400 dark:text-gray-500">No background image</span>
              </div>
            )}
          </div>
        </Card>

        {/* Card 4: User Setup */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* <Contact className="w-5 h-5 text-orange-600" /> */}
                <CardTitle className="text-lg font-semibold">
                  User Setup
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToStep(4)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex justify-between">
            <div className="space-y-2">
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Headshot</p>
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full border border-gray-300 dark:border-gray-600 overflow-hidden">
                    <Headshot
                      src={stepData.userSetup?.headshot || undefined}
                      monogramName={stepData.userSetup?.name}
                      alt="Headshot"
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Name</p>
                <p className="text-sm text-muted-foreground">
                  {stepData.userSetup?.name || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Email</p>
                <p className="text-sm text-muted-foreground">
                  {stepData.userSetup?.email || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Phone</p>
                <p className="text-sm text-muted-foreground">
                  {formatPhoneNumber(stepData.userSetup?.phone || "")}
                  {stepData.userSetup?.phoneExtension && (
                    <span> Ext. {stepData.userSetup.phoneExtension}</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Title</p>
                <p className="text-sm text-muted-foreground">
                  {stepData.userSetup?.title || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Designations</p>
                <p className="text-sm text-muted-foreground">
                  {stepData.userSetup?.designations && stepData.userSetup.designations.length > 0
                    ? stepData.userSetup.designations.join(", ")
                    : "None"}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Save as Contact</p>
                <p className="text-sm text-muted-foreground">
                  {stepData.userSetup?.saveAsContact !== false ? "Yes" : "No"}
                </p>
              </div>
            </div>
            <div>
              {/* Background Image */}
              {stepData.userSetup?.backgroundImage && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Background
                  </p>
                  <div className="flex items-center gap-4">
                    <img
                      src={stepData.userSetup.backgroundImage}
                      alt="Background"
                      className="w-full h-24 object-cover rounded border border-gray-300 dark:border-gray-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <SummaryEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSection(null);
        }}
        onSave={handleSaveEdit}
        initialData={stepData}
      />
    </div>
  );
}
