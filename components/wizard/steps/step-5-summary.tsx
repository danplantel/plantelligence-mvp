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
  Users,
  CheckCircle,
  Briefcase,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Headshot } from "@/components/ui/headshot";
import { BrandingImage } from "@/components/ui/branding-image";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SummaryEditModal } from "./sections/summary-edit-modals/summary-edit-modal";
import { AddTeamMembersSection } from "./sections/add-team-members-section/add-team-members-section";
import { Step5Disclaimers } from "./step-5-disclaimers";

// Format phone number for display
const formatPhoneNumber = (phone: string): string => {
  if (!phone) return "Not specified";

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Format based on length
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(
      7,
    )}`;
  } else if (digits.length >= 7 && digits.length <= 11) {
    // For other lengths, just add some formatting
    if (digits.length === 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else if (digits.length === 8) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    } else if (digits.length === 9) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else {
      return phone; // Return as is for other lengths
    }
  }

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
  } = useOnboardingWizardStore();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  // Initialize as true since disclaimers are optional
  const [isDisclaimersValid, setIsDisclaimersValid] = useState(true);
  const [showValidationError, setShowValidationError] = useState(false);
  const [isTeamSizeModalOpen, setIsTeamSizeModalOpen] = useState(false);
  const [tempOrgType, setTempOrgType] = useState("");
  const [tempCustomOrg, setTempCustomOrg] = useState("");
  const [tempTeamSize, setTempTeamSize] = useState("");

  // Load data when component mounts
  useEffect(() => {
    const loadData = async () => {
      await loadStepData("clientProfile");
      await loadStepData("teamSize");
      await loadStepData("services");
      await loadStepData("branding");
      const userSetupData = await loadStepData("userSetup");
    };

    loadData();
  }, [loadStepData]);

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
          title: updatedData.title,
          designations: updatedData.designations,
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

  const getDesignationsDisplay = () => {
    const designations = stepData.userSetup?.designations || [];
    if (designations.length === 0) return "None";
    return designations.map((d) => `[${d}]`).join(" ");
  };

  const [isTeamSizeJustMe, setIsTeamSizeJustMe] = useState(
    stepData.teamSize?.teamSize === "just_me",
  );

  // Update isTeamSizeJustMe when teamSize changes
  useEffect(() => {
    setIsTeamSizeJustMe(stepData.teamSize?.teamSize === "just_me");
  }, [stepData.teamSize?.teamSize]);

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

  const handleOpenTeamSizeModal = () => {
    // Initialize temp values with current data
    setTempOrgType(stepData.clientProfile?.organizationType || "");
    setTempCustomOrg(stepData.clientProfile?.customOrganization || "");
    setTempTeamSize(stepData.teamSize?.teamSize || "");
    setIsTeamSizeModalOpen(true);
  };

  const handleSaveTeamSize = async () => {
    try {
      // Save to store
      await saveStepDataLocally("clientProfile", {
        organizationType: tempOrgType,
        customOrganization: tempCustomOrg,
      });

      await saveStepDataLocally("teamSize", {
        teamSize: tempTeamSize,
      });

      // Also save to server
      await saveStepData(
        "clientProfile",
        {
          organizationType: tempOrgType,
          customOrganization: tempCustomOrg,
        },
        true,
      );

      await saveStepData(
        "teamSize",
        {
          teamSize: tempTeamSize,
        },
        true,
      );

      setIsTeamSizeModalOpen(false);
    } catch (error) {
      console.error("Failed to save team size:", error);
    }
  };

  // If showing next steps, render that view
  if (showNextSteps) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Success banner replacing the previous modal */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Setup Complete!
              </h3>
              <p className="text-sm text-green-700 mt-1">
                You can start building client portals now, or use the optional
                steps below to add team members and compliance language.
              </p>
            </div>
          </div>
        </div>
        {/* Page Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Next Steps</h1>
          <p className="text-gray-600">
            Complete these optional steps to customize your experience
          </p>
        </div>

        {/* Next Steps Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Add Team Members */}
          <div>
            {!isTeamSizeJustMe ? (
              <AddTeamMembersSection isVisible={true} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    Add Team Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="font-medium mb-2">
                      Change team size to 2+ users to add team members
                    </p>
                    <Button variant="outline" onClick={handleOpenTeamSizeModal}>
                      Change Team Size
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Add Disclaimers */}
          <div>
            <Card>
              <CardContent className="pt-6">
                <Step5Disclaimers
                  onValidationChange={handleDisclaimersValidation}
                  errorFields={errorFields}
                  forceUniversalScope={true}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Validation Error - shown when trying to proceed without selecting disclaimer option */}
        {showValidationError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
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
                <h3 className="text-sm font-medium text-red-800">
                  Please complete required fields
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  You must select when to add disclaimers (Add Now or Add Later)
                  before proceeding to the dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Team Size Change Modal */}
        <Dialog
          open={isTeamSizeModalOpen}
          onOpenChange={setIsTeamSizeModalOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Change Team Size</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Organization Type */}
              <div className="space-y-2">
                <Label htmlFor="orgType">
                  Organization Type <span className="text-red-500">*</span>
                </Label>
                <Select value={tempOrgType} onValueChange={setTempOrgType}>
                  <SelectTrigger id="orgType">
                    <SelectValue placeholder="Select organization type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="independent">
                      Independent Advisor
                    </SelectItem>
                    <SelectItem value="ria">
                      RIA (Registered Investment Advisor)
                    </SelectItem>
                    <SelectItem value="broker_dealer">Broker-Dealer</SelectItem>
                    <SelectItem value="insurance_agency">
                      Insurance Agency
                    </SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="credit_union">Credit Union</SelectItem>
                    <SelectItem value="accounting_firm">
                      Accounting Firm
                    </SelectItem>
                    <SelectItem value="law_firm">Law Firm</SelectItem>
                    <SelectItem value="family_office">Family Office</SelectItem>
                    <SelectItem value="plan_sponsor">Plan Sponsor</SelectItem>
                    <SelectItem value="tpa">
                      TPA (Third Party Administrator)
                    </SelectItem>
                    <SelectItem value="recordkeeper">Recordkeeper</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Team Size */}
              <div className="space-y-2">
                <Label>
                  Team Size <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={tempTeamSize}
                  onValueChange={setTempTeamSize}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="just_me" id="just_me" />
                    <Label htmlFor="just_me" className="cursor-pointer">
                      Just me
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2_5" id="2_5" />
                    <Label htmlFor="2_5" className="cursor-pointer">
                      2-5 people
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="6_20" id="6_20" />
                    <Label htmlFor="6_20" className="cursor-pointer">
                      6-20 people
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="enterprise" id="enterprise" />
                    <Label htmlFor="enterprise" className="cursor-pointer">
                      Enterprise
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsTeamSizeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTeamSize}
                className="bg-accent-blue text-white hover:bg-accent-blue/90"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero Confirmation */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start space-x-4">
          <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Almost Done!
            </h3>
            <p className="text-green-600 font-medium">
              Review your information below to make sure everything&apos;s
              correct, then click Continue to finalize your setup.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: User Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg font-semibold">
                User Profile
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Organization Type
              </p>
              <p className="text-sm text-gray-600">
                {getOrganizationTypeDisplay()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Team Size</p>
              <p className="text-sm text-gray-600">{getTeamSizeDisplay()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Services Provided */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-green-600" />
              <CardTitle className="text-lg font-semibold">
                Services Provided
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Services</p>
              <p className="text-sm text-gray-600">{getServicesDisplay()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Branding */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg font-semibold">Branding</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex justify-between">
            <div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Organization Name
                </p>
                <p className="text-sm text-gray-600">
                  {stepData.clientProfile?.customOrganization ||
                    stepData.branding?.organizationName ||
                    "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Organization Website
                </p>
                <p className="text-sm text-gray-600">
                  {stepData.branding?.website || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{
                      backgroundColor:
                        stepData.branding?.brandColor || "#1F3A60",
                    }}
                  ></div>
                  <span className="text-sm text-gray-600">
                    {getBrandColorDisplay()}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Logo</p>
              <div className="mt-2">
                {stepData.branding?.logo ? (
                  <BrandingImage
                    src={stepData.branding.logo}
                    alt="Organization Logo"
                    className="w-16 h-16 object-contain rounded border border-gray-300"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                    <span className="text-xs text-gray-400">No logo</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: User Setup */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Contact className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-lg font-semibold">
                User Setup
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex justify-between">
            <div>
              <div>
                <p className="text-sm font-medium text-gray-700">Name</p>
                <p className="text-sm text-gray-600">
                  {stepData.userSetup?.name || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-sm text-gray-600">
                  {stepData.userSetup?.email || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Phone</p>
                <p className="text-sm text-gray-600">
                  {formatPhoneNumber(stepData.userSetup?.phone || "")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Title</p>
                <p className="text-sm text-gray-600">
                  {stepData.userSetup?.title || "Not specified"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Headshot</p>
              <div className="flex flex-col items-center gap-4">
                {/* Headshot Image */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full border border-gray-300 overflow-hidden">
                    <Headshot
                      src={stepData.userSetup?.headshot || undefined}
                      monogramName={stepData.userSetup?.name}
                      alt="Headshot"
                    />
                  </div>
                </div>

                {/* Background Image */}
                {stepData.userSetup?.backgroundImage && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Background
                    </p>
                    <div className="flex items-center gap-4">
                      <img
                        src={stepData.userSetup.backgroundImage}
                        alt="Background"
                        className="w-full h-24 object-cover rounded border border-gray-300"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Button */}
      <div className="flex justify-center mt-6">
        <Button
          variant="outline"
          onClick={() => {
            setEditingSection("userProfile");
            setIsEditModalOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Edit Information
        </Button>
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
