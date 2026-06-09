"use client";

import { useEffect, useState, useRef } from "react";
import useSWR from "swr";
import { useForm, FormProvider } from "react-hook-form";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { step2ServicesToCategories } from "@/lib/service-categories";
import { ServiceType } from "@/types/wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileSettingsSection } from "@/components/pages/settings/profile-settings-section";
import { BrandingSettingsSection } from "@/components/pages/settings/branding-settings-section";
import { OrganizationSettingsSection } from "@/components/pages/settings/organization-settings-section";
import { TeamAndDisclaimersSection } from "@/components/pages/settings/team-and-disclaimers-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Save,
  User,
  Building2,
  Briefcase,
  Users,
  Users as UsersIcon,
  Palette,
  FileText,
  AlertTriangle,
} from "lucide-react";
import axios from "axios";

export default function SettingsPage() {
  const { setTitle } = usePageTitleContext();
  const { stepData, loadAllWizardData, saveStepData, saveStepDataToServer } =
    useOnboardingWizardStore();
  const [isSaving, setIsSaving] = useState(false);
  // If the Zustand store already has data from a previous visit, skip the skeleton
  const [isLoading, setIsLoading] = useState(
    () => !useOnboardingWizardStore.getState().stepData?.userSetup,
  );
  const [activeTab, setActiveTab] = useState("profile");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);

  // Store initial values for comparison
  const [initialUserSetup, setInitialUserSetup] = useState<any>(null);
  const [initialBranding, setInitialBranding] = useState<any>(null);
  const [initialOrganization, setInitialOrganization] = useState<any>(null);
  const [initialServices, setInitialServices] = useState<any>(null);

  // Form for User Setup
  const userSetupForm = useForm({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      title: "",
      designations: [] as string[],
      headshot: "",
      headshotFileName: "",
      headshotData: null as any,
      backgroundImage: "",
      backgroundFileName: "",
      primaryServiceCategories: [] as string[],
      saveAsContact: true,
    },
  });

  // Form for Branding
  const brandingForm = useForm({
    defaultValues: {
      organizationName: "",
      website: "",
      logo: "",
      logoFileName: "",
      brandColor: "#1F3A60",
      primaryColor: "",
      secondaryColor: "",
      missionStatement: "",
      backgroundImage: "",
      backgroundFileName: "",
      aiAvatar: "",
      avatarFileName: "",
      subdomain: "",
      isColorPickerOpen: false,
      isGenerating: false,
    },
  });

  // Forms for Organization Tab - Combined form for organization and team size
  const organizationForm = useForm({
    defaultValues: {
      organizationType: "",
      customOrganization: "",
      teamSize: "",
    },
  });

  const servicesForm = useForm<{
    services: ServiceType[];
    customService: string;
  }>({
    defaultValues: {
      services: [] as ServiceType[],
      customService: "",
    },
  });

  useEffect(() => {
    setTitle("Settings");
  }, [setTitle]);

  // Track which tabs have been loaded
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

  // Force re-render key for forms
  const [formKey, setFormKey] = useState(0);

  // User profile data (for branding fallback)
  const [userProfile, setUserProfile] = useState<any>(null);

  // SWR: cache /api/profile so branding/organization tabs show instantly on revisit
  const { data: cachedProfile } = useSWR(
    "/api/profile",
    (url: string) => fetch(url).then((r) => r.json()),
    { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false },
  );

  // Sync cachedProfile into userProfile state when it arrives
  const profileSyncedRef = useRef(false);
  useEffect(() => {
    if (cachedProfile && !profileSyncedRef.current) {
      setUserProfile(cachedProfile);
      profileSyncedRef.current = true;
    }
  }, [cachedProfile]);

  // Load data for specific tab (profile tab always refetches so Step 2 categories autofill without pressing Save)
  const loadTabData = async (tab: string) => {
    if (loadedTabs.has(tab) && tab !== "profile") return; // Already loaded (except profile: always refetch)

    // Only show skeleton if there's no existing data — otherwise update silently in background
    const hasExistingData = Boolean(useOnboardingWizardStore.getState().stepData?.userSetup);
    try {
      if (!hasExistingData) setIsLoading(true);
      // Load only necessary data for this tab
      switch (tab) {
        case "profile": {
          // Always refetch so categories saved in Step 2 show in Primary Service Categories
          const loadedData = await loadAllWizardData(true);
          const userSetup = loadedData?.userSetup ?? useOnboardingWizardStore.getState().stepData?.userSetup ?? {};
          let primaryServiceCategories: string[] = Array.isArray(userSetup.primaryServiceCategories)
            ? [...userSetup.primaryServiceCategories]
            : [];
          const servicesArray = loadedData?.services?.services ?? useOnboardingWizardStore.getState().stepData?.services?.services ?? [];
          if (primaryServiceCategories.length === 0 && Array.isArray(servicesArray) && servicesArray.length > 0) {
            primaryServiceCategories = step2ServicesToCategories(servicesArray);
          }
          const profileData = {
            name: userSetup.name || "",
            email: userSetup.email || "",
            phone: userSetup.phone || "",
            title: userSetup.title || "",
            designations: userSetup.designations || [],
            headshot: userSetup.headshot || "",
            headshotFileName: userSetup.headshotFileName || "",
            headshotData: userSetup.headshotData || null,
            backgroundImage: userSetup.backgroundImage || "",
            backgroundFileName: userSetup.backgroundFileName || "",
            primaryServiceCategories,
            saveAsContact: userSetup.saveAsContact ?? true,
          };
          userSetupForm.reset(profileData, { keepDirtyValues: false });
          setInitialUserSetup(JSON.parse(JSON.stringify(profileData)));
          break;
        }
        case "branding":
          // Load wizard data; use SWR-cached profile if available to avoid extra fetch
          await loadAllWizardData();
          if (cachedProfile) {
            setUserProfile(cachedProfile);
          } else {
            try {
              const profileResponse = await fetch("/api/profile");
              if (profileResponse.ok) {
                const profile = await profileResponse.json();
                setUserProfile(profile);
              }
            } catch (err) {
              console.error("Failed to load user profile:", err);
            }
          }
          break;
        case "organization":
          // Load wizard data; use SWR-cached profile if available
          await loadAllWizardData();
          if (cachedProfile) {
            setUserProfile(cachedProfile);
          } else {
            try {
              const profileResponse = await fetch("/api/profile");
              if (profileResponse.ok) {
                const profile = await profileResponse.json();
                setUserProfile(profile);
              }
            } catch (err) {
              console.error("Failed to load user profile:", err);
            }
          }
          break;
        case "team":
          // Team data is loaded separately, no need for wizard data
          break;
      }

      setLoadedTabs((prev) => new Set(prev).add(tab));
    } catch (error) {
      console.error(`Error loading ${tab} data:`, error);
      toast.error("Failed to load settings data");
    } finally {
      setIsLoading(false);
    }
  };

  // Load data for initial tab on mount
  useEffect(() => {
    loadTabData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only load once on mount

  // Load data when tab changes (Profile tab always refetches so Step 2 categories autofill)
  useEffect(() => {
    if (activeTab === "profile") {
      loadTabData(activeTab);
    } else if (!loadedTabs.has(activeTab)) {
      loadTabData(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Populate forms when stepData changes
  useEffect(() => {
    // Skip if still loading to avoid multiple updates
    if (isLoading) return;

    // Populate User Setup form - always initialize even if empty (categories from Step 2)
    const userSetup = stepData.userSetup || ({} as any);
    let primaryServiceCategories: string[] = Array.isArray(userSetup.primaryServiceCategories)
      ? [...userSetup.primaryServiceCategories]
      : [];
    if (primaryServiceCategories.length === 0 && stepData.services?.services?.length) {
      primaryServiceCategories = step2ServicesToCategories(stepData.services.services);
    }
    const userData = {
      name: userSetup.name || "",
      email: userSetup.email || "",
      phone: userSetup.phone || "",
      title: userSetup.title || "",
      designations: userSetup.designations || [],
      headshot: userSetup.headshot || "",
      headshotFileName: userSetup.headshotFileName || "",
      headshotData: userSetup.headshotData || null,
      backgroundImage: userSetup.backgroundImage || "",
      backgroundFileName: userSetup.backgroundFileName || "",
      primaryServiceCategories,
      saveAsContact: userSetup.saveAsContact ?? true,
    };
    userSetupForm.reset(userData, { keepDirtyValues: false });
    setInitialUserSetup(JSON.parse(JSON.stringify(userData)));

    // Populate Branding form - use wizard data with User profile fallback
    const branding = stepData.branding || ({} as any);

    // Get branding from completed wizard session if exists
    const completedBranding = userProfile?.wizardSessions?.[0]?.branding;

    const brandingData = {
      organizationName:
        branding.organizationName || completedBranding?.organizationName || "",
      website:
        branding.website ||
        completedBranding?.website ||
        userProfile?.website ||
        "",
      logo:
        branding.logo ||
        completedBranding?.logo ||
        userProfile?.advisorLogo ||
        "",
      logoFileName:
        branding.logoFileName || completedBranding?.logoFileName || "",
      brandColor:
        branding.brandColor ||
        completedBranding?.brandColor ||
        userProfile?.brandColor ||
        "#1F3A60",
      primaryColor:
        branding.primaryColor ||
        completedBranding?.primaryColor ||
        userProfile?.primaryColor ||
        "",
      secondaryColor:
        branding.secondaryColor ||
        completedBranding?.secondaryColor ||
        userProfile?.secondaryColor ||
        "",
      missionStatement:
        branding.missionStatement || completedBranding?.missionStatement || "",
      backgroundImage:
        branding.backgroundImage || completedBranding?.backgroundImage || "",
      backgroundFileName:
        branding.backgroundFileName ||
        completedBranding?.backgroundFileName ||
        "",
      aiAvatar: branding.aiAvatar || completedBranding?.aiAvatar || "",
      avatarFileName:
        branding.avatarFileName || completedBranding?.avatarFileName || "",
      subdomain:
        branding.subdomain ||
        completedBranding?.subdomain ||
        userProfile?.subdomain ||
        "",
      isColorPickerOpen: false,
      isGenerating: false,
    };
    brandingForm.reset(brandingData, { keepDirtyValues: false });
    setInitialBranding(JSON.parse(JSON.stringify(brandingData)));

    // Force re-render after all forms are reset
    setFormKey((prev) => prev + 1);

    // Populate Organization forms - use wizard data with User profile fallback
    // After wizard completion: organizationType → User.company, teamSize → User.teamSize
    const completedClientProfile =
      userProfile?.wizardSessions?.[0]?.clientProfile;
    const completedTeamSize = userProfile?.wizardSessions?.[0]?.teamSize;

    const orgData = {
      organizationType:
        stepData.clientProfile?.organizationType ||
        completedClientProfile?.organizationType ||
        userProfile?.company ||
        "",
      customOrganization:
        stepData.clientProfile?.customOrganization ||
        completedClientProfile?.customOrganization ||
        userProfile?.customOrganization ||
        "",
      teamSize:
        stepData.teamSize?.teamSize ||
        completedTeamSize?.teamSize ||
        userProfile?.teamSize ||
        "",
    };
    organizationForm.reset(orgData, { keepDirtyValues: false });
    setInitialOrganization(JSON.parse(JSON.stringify(orgData)));

    // Populate Services form - use wizard data with User profile fallback
    // After wizard completion: services → User.services (comma-separated string)
    const completedServices = userProfile?.wizardSessions?.[0]?.services;
    const wizardServices = stepData.services || {
      services: [],
      customService: "",
    };
    const userServices = userProfile?.services
      ? userProfile.services.split(",").filter((s: string) => s.trim())
      : [];

    const servicesData = {
      services:
        wizardServices.services?.length > 0
          ? wizardServices.services
          : completedServices?.services?.length > 0
          ? completedServices.services
          : userServices,
      customService:
        wizardServices.customService || completedServices?.customService || "",
    };

    servicesForm.reset(servicesData, { keepDirtyValues: false });
    setInitialServices(JSON.parse(JSON.stringify(servicesData)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepData, isLoading, userProfile]); // Include userProfile for branding fallback

  const handleSaveUserSetup = async () => {
    setIsSaving(true);
    try {
      const data = userSetupForm.getValues();
      const ok = await saveStepDataToServer("userSetup", data);
      if (!ok) throw new Error("Failed to save user setup");
      // Reload data to ensure store is in sync (force refresh)
      await loadAllWizardData(true);
      // Reset form dirty state and update initial values after successful save
      userSetupForm.reset(data, { keepDirtyValues: false });
      setInitialUserSetup(JSON.parse(JSON.stringify(data)));
      toast.success("User profile updated successfully!");
    } catch (error) {
      console.error("Error saving user setup:", error);
      toast.error("Failed to save user profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    setIsSaving(true);
    try {
      const data = brandingForm.getValues();

      // Only send fields accepted by the branding API (exclude UI-only flags)
      const brandingPayload = {
        organizationName: data.organizationName || "",
        website: data.website || "",
        logo: data.logo || "",
        logoFileName: data.logoFileName || "",
        primaryColor: data.primaryColor || undefined,
        secondaryColor: data.secondaryColor || undefined,
        missionStatement: data.missionStatement || "",
        backgroundImage: data.backgroundImage || "",
        backgroundFileName: data.backgroundFileName || "",
        aiAvatar: data.aiAvatar || "",
        avatarFileName: data.avatarFileName || "",
        subdomain: data.subdomain || "",
      };

      // Save to wizard branding table
      const ok = await saveStepDataToServer("branding", brandingPayload);
      if (!ok) throw new Error("Failed to save branding");

      // Also update User table with branding fields that exist on the User model
      try {
        const updateResponse = await fetch("/api/profile/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            advisorLogo: data.logo,
            // advisorLogoUrl is a legacy field used as fallback across the codebase
            // (dashboard, new-client-wizard, marketing flyers). Both store the same R2 key
            // and are resolved to display URLs at render time via useBrandingImageUrl() / BrandingImage.
            advisorLogoUrl: data.logo,
            organizationName: data.organizationName || undefined,
            website: data.website || undefined,
            primaryColor: data.primaryColor || undefined,
            secondaryColor: data.secondaryColor || undefined,
            subdomain: data.subdomain || undefined,
          }),
        });

        if (!updateResponse.ok) {
          console.warn("Failed to update user profile with branding fields");
        }
      } catch (profileError) {
        console.error("Error updating user profile:", profileError);
        // Don't fail the whole save if profile update fails
      }

      // Reload data to ensure store is in sync (force refresh)
      await loadAllWizardData(true);

      // Reset form dirty state and update initial values after successful save
      brandingForm.reset(brandingPayload, { keepDirtyValues: false });
      setInitialBranding(JSON.parse(JSON.stringify(brandingPayload)));
      toast.success("Branding settings updated successfully!");
    } catch (error) {
      console.error("Error saving branding:", error);
      toast.error("Failed to save branding settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOrganization = async () => {
    setIsSaving(true);
    try {
      const formData = organizationForm.getValues();
      const servicesData = servicesForm.getValues();

      // Save all organization-related data to wizard tables
      await Promise.all([
        saveStepDataToServer("clientProfile", {
          organizationType: formData.organizationType,
          customOrganization: formData.customOrganization,
        }),
        saveStepDataToServer("services", {
          services: servicesData.services,
          customService: servicesData.customService,
        }),
        saveStepDataToServer("teamSize", { teamSize: formData.teamSize }),
      ]);

      // Reload data to ensure store is in sync (force refresh)
      await loadAllWizardData(true);
      // Reset form dirty state and update initial values after successful save
      organizationForm.reset(formData, { keepDirtyValues: false });
      servicesForm.reset(servicesData, { keepDirtyValues: false });
      setInitialOrganization(JSON.parse(JSON.stringify(formData)));
      setInitialServices(JSON.parse(JSON.stringify(servicesData)));
      toast.success("Organization settings updated successfully!");
    } catch (error) {
      console.error("Error saving organization:", error);
      toast.error("Failed to save organization settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Check if current tab has unsaved changes by comparing values
  const hasUnsavedChanges = () => {
    switch (activeTab) {
      case "profile":
        if (!initialUserSetup) return false;
        const currentUserSetup = userSetupForm.getValues();
        return (
          JSON.stringify(currentUserSetup) !== JSON.stringify(initialUserSetup)
        );
      case "branding":
        if (!initialBranding) return false;
        const currentBranding = brandingForm.getValues();
        return (
          JSON.stringify(currentBranding) !== JSON.stringify(initialBranding)
        );
      case "organization":
        if (!initialOrganization || !initialServices) return false;
        const currentOrganization = organizationForm.getValues();
        const currentServices = servicesForm.getValues();
        return (
          JSON.stringify(currentOrganization) !==
            JSON.stringify(initialOrganization) ||
          JSON.stringify(currentServices) !== JSON.stringify(initialServices)
        );
      default:
        return false;
    }
  };

  // Handle tab change with unsaved changes check
  const handleTabChange = (newTab: string) => {
    const hasChanges = hasUnsavedChanges();
    if (hasChanges) {
      setPendingTab(newTab);
      setShowUnsavedChangesDialog(true);
    } else {
      setActiveTab(newTab);
    }
  };

  // Save current tab and switch to pending tab
  const handleSaveAndContinue = async () => {
    if (!pendingTab) return;

    setIsSaving(true);
    try {
      // Save based on current tab
      switch (activeTab) {
        case "profile":
          await handleSaveUserSetup();
          break;
        case "branding":
          await handleSaveBranding();
          break;
        case "organization":
          await handleSaveOrganization();
          break;
      }
      // Switch to pending tab after save
      setActiveTab(pendingTab);
      setPendingTab(null);
      setShowUnsavedChangesDialog(false);
    } catch (error) {
      console.error("Error saving before tab change:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm discard changes and switch tab
  const handleDiscardChanges = () => {
    if (pendingTab) {
      // Reset forms to server data based on current tab
      switch (activeTab) {
        case "profile":
          const userSetup = stepData.userSetup || ({} as any);
          const userData = {
            name: userSetup.name || "",
            email: userSetup.email || "",
            phone: userSetup.phone || "",
            title: userSetup.title || "",
            designations: userSetup.designations || [],
            headshot: userSetup.headshot || "",
            headshotFileName: userSetup.headshotFileName || "",
            headshotData: userSetup.headshotData || null,
            backgroundImage: userSetup.backgroundImage || "",
            backgroundFileName: userSetup.backgroundFileName || "",
          };
          userSetupForm.reset(userData, { keepDirtyValues: false });
          break;
        case "branding":
          const branding = stepData.branding || ({} as any);
          const brandingData = {
            organizationName: branding.organizationName || "",
            website: branding.website || "",
            logo: branding.logo || "",
            logoFileName: branding.logoFileName || "",
            brandColor: branding.brandColor || "#1F3A60",
            primaryColor: branding.primaryColor || "",
            secondaryColor: branding.secondaryColor || "",
            missionStatement: branding.missionStatement || "",
            backgroundImage: branding.backgroundImage || "",
            backgroundFileName: branding.backgroundFileName || "",
            aiAvatar: branding.aiAvatar || "",
            avatarFileName: branding.avatarFileName || "",
            subdomain: branding.subdomain || "",
            isColorPickerOpen: false,
            isGenerating: false,
          };
          brandingForm.reset(brandingData, { keepDirtyValues: false });
          break;
        case "organization":
          const orgData = {
            organizationType: stepData.clientProfile?.organizationType || "",
            customOrganization:
              stepData.clientProfile?.customOrganization || "",
            teamSize: stepData.teamSize?.teamSize || "",
          };
          organizationForm.reset(orgData, { keepDirtyValues: false });

          const servicesData = stepData.services || {
            services: [],
            customService: "",
          };
          servicesForm.reset(servicesData, { keepDirtyValues: false });
          break;
      }
      setActiveTab(pendingTab);
      setPendingTab(null);
      setShowUnsavedChangesDialog(false);
    }
  };

  // Cancel tab change
  const handleCancelTabChange = () => {
    setPendingTab(null);
    setShowUnsavedChangesDialog(false);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-screen max-w-4xl mx-auto py-6">
        <div className="mb-6">
          {/* <h1 className="text-3xl font-bold text-gray-900">Settings</h1> */}
          <p className="text-gray-600 mt-2 dark:text-gray-400">
            Manage your profile, branding, and organization settings
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger
              value="organization"
              className="flex items-center gap-2"
            >
              <Briefcase className="h-4 w-4" />
              Organization
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Team & Disclaimers
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <ProfileSettingsSection
              isLoading={isLoading}
              isSaving={isSaving}
              userSetupForm={userSetupForm}
              onSave={handleSaveUserSetup}
            />
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <BrandingSettingsSection
              isLoading={isLoading}
              isSaving={isSaving}
              brandingForm={brandingForm}
              formKey={formKey}
              onSave={handleSaveBranding}
            />
          </TabsContent>

          {/* Organization Tab */}
          <TabsContent value="organization" className="space-y-6">
            <OrganizationSettingsSection
              isLoading={isLoading}
              isSaving={isSaving}
              organizationForm={organizationForm}
              servicesForm={servicesForm}
              onSave={handleSaveOrganization}
            />
          </TabsContent>

          {/* Team & Disclaimers Tab */}
          <TabsContent value="team" className="space-y-6">
            <TeamAndDisclaimersSection isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Unsaved Changes Dialog */}
      <AlertDialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
      >
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                Unsaved Changes
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-gray-600">
              You have unsaved changes that will be lost. What would you like to
              do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row items-center gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel
              onClick={handleCancelTabChange}
              className="flex-1 m-0 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleSaveAndContinue}
              disabled={isSaving}
              className="flex-1 bg-accent-blue text-white hover:bg-accent-blue/90"
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </Button>
            <Button
              onClick={handleDiscardChanges}
              variant="destructive"
              disabled={isSaving}
              className="flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              Discard & Leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
