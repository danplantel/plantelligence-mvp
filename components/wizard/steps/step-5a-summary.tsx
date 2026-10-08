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
import {
  designationAcronyms,
  designationLabel,
} from "@/config/onboarding/designations";
import { organizationLabel } from "@/config/onboarding/organization-types";
import { teamSizeLabel } from "@/config/onboarding/team-sizes";

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

/**
 * Step 5a — Review Your Information.
 *
 * The review screen for Onboarding Step 5. Each card's "Edit" opens its step in
 * edit-from-review mode (`startEditingFromReview`), where the step's primary
 * action is "Save & Return to Review" and Previous returns here without saving —
 * the user never walks through the in-between steps. Disclosures live in the
 * sibling sub-step 5b (see `step-5-onboarding.tsx`).
 */
export function Step5aSummary() {
  const {
    stepData,
    saveStepDataLocally,
    loadStepData,
    saveStepData,
    saveSummaryData,
    startEditingFromReview,
  } = useOnboardingWizardStore();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  // Local state for branding colors to ensure they display correctly
  // even if the reactive stepData from the zustand hook is stale.
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState<string>(
    stepData.branding?.primaryColor || "",
  );
  const [brandingSecondaryColor, setBrandingSecondaryColor] = useState<string>(
    stepData.branding?.secondaryColor || "",
  );

  // Load data when component mounts
  useEffect(() => {
    const loadData = async () => {
      await loadStepData("clientProfile");
      await loadStepData("teamSize");
      await loadStepData("services");
      await loadStepData("branding");
      await loadStepData("userSetup");

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
      console.error("❌ Step5a - Failed to save summary data:", error);
    }
  };

  const getOrganizationTypeDisplay = () => {
    const orgType = stepData.clientProfile?.organizationType;
    const customOrg = stepData.clientProfile?.customOrganization;

    if (customOrg) return customOrg;
    if (!orgType) return "Not specified";

    // Labels live in config; legacy ids (e.g. "ria") resolve through the merge.
    return organizationLabel(orgType) || "Not specified";
  };

  const getTeamSizeDisplay = () => {
    // Labels live in config; legacy band ids resolve through normalizeTeamSize.
    return teamSizeLabel(stepData.teamSize?.teamSize) || "Not specified";
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
    return designations.map((d) => `[${designationLabel(d)}]`).join(" ");
  };

  /**
   * Name with its designations inline, comma-separated (e.g. "Kevin Morales,
   * CFP®, AIF®"). When there are none the name is returned alone — the
   * designations are never shown as "None" (rule 7).
   */
  const getNameWithDesignations = () => {
    const name = stepData.userSetup?.name || "Not specified";
    const acronyms = designationAcronyms(stepData.userSetup?.designations);
    return acronyms.length > 0 ? `${name}, ${acronyms.join(", ")}` : name;
  };

  return (
    <div className="space-y-6">
      {/* Helper text */}
      <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-base font-semibold text-foreground">
          Please verify your details.
        </p>
        <p className="text-sm text-muted-foreground">
          Your organization name, logo, and colors will appear on your Benefits
          Hubs and marketing materials.
        </p>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-6">

        {/* Card 1: Organization */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* <User className="w-5 h-5 text-blue-600" /> */}
                <CardTitle className="text-lg font-semibold">
                  Organization
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => startEditingFromReview(1)}
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
                onClick={() => startEditingFromReview(2)}
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
                onClick={() => startEditingFromReview(3)}
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

        {/* Card 4: Your Profile */}
        <Card className="dark:bg-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* <Contact className="w-5 h-5 text-orange-600" /> */}
                <CardTitle className="text-lg font-semibold">
                  Your Profile
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => startEditingFromReview(4)}
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
                  {getNameWithDesignations()}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Email</p>
                <p className="text-sm text-muted-foreground">
                  {stepData.userSetup?.email || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Organization Email
                </p>
                <p className="text-sm text-muted-foreground">
                  {stepData.userSetup?.organizationEmail || "Not specified"}
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
