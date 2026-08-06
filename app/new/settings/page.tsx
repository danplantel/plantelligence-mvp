"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { step2ServicesToCategories } from "@/lib/service-categories";
import { ServiceType } from "@/types/wizard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileSettingsSection } from "@/components/pages/settings/profile-settings-section";
import { BrandingSettingsSection } from "@/components/pages/settings/branding-settings-section";
import { OrganizationSettingsSection } from "@/components/pages/settings/organization-settings-section";
import { TeamAndDisclaimersSection } from "@/components/pages/settings/team-and-disclaimers-section";
import {
  AlertDialog,
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
  RotateCcw,
  User,
  Building2,
  Briefcase,
  Users as UsersIcon,
  AlertTriangle,
  Circle,
  Trash2,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export default function SettingsPage() {
  const { setTitle } = usePageTitleContext();
  const { stepData, loadAllWizardData } =
    useOnboardingWizardStore();
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(
    () => !useOnboardingWizardStore.getState().stepData?.userSetup,
  );
  const [activeTab, setActiveTab] = useState("profile");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionSuccess, setDeletionSuccess] = useState(false);

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

  // Forms for Organization Tab
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

  // User profile data (for branding fallback and primaryServiceCategories)
  const [userProfile, setUserProfile] = useState<any>(null);

  // SWR: cache /api/profile
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

  // Load data for specific tab
  const loadTabData = async (tab: string) => {
    if (loadedTabs.has(tab) && tab !== "profile") return;

    const hasExistingData = Boolean(useOnboardingWizardStore.getState().stepData?.userSetup);
    try {
      if (!hasExistingData) setIsLoading(true);
      switch (tab) {
        case "profile": {
          const loadedData = await loadAllWizardData(true);
          const userSetup = loadedData?.userSetup ?? useOnboardingWizardStore.getState().stepData?.userSetup ?? {};

          // Fetch profile from /api/profile if SWR hasn't loaded it yet
          let profileFallback: any = cachedProfile ?? userProfile;
          if (!profileFallback) {
            try {
              const profileRes = await fetch("/api/profile");
              if (profileRes.ok) {
                profileFallback = await profileRes.json();
                setUserProfile(profileFallback);
              }
            } catch { /* ignore */ }
          }

          let primaryServiceCategories: string[] = Array.isArray(userSetup.primaryServiceCategories)
            ? [...userSetup.primaryServiceCategories]
            : [];
          if (primaryServiceCategories.length === 0 && profileFallback?.primaryServiceCategories?.length > 0) {
            primaryServiceCategories = [...profileFallback.primaryServiceCategories];
          }
          const servicesArray = loadedData?.services?.services ?? useOnboardingWizardStore.getState().stepData?.services?.services ?? [];
          if (primaryServiceCategories.length === 0 && Array.isArray(servicesArray) && servicesArray.length > 0) {
            primaryServiceCategories = step2ServicesToCategories(servicesArray);
          }

          const profileData = {
            name: userSetup.name || profileFallback?.name || "",
            email: userSetup.email || profileFallback?.email || "",
            phone: userSetup.phone || profileFallback?.phone || "",
            title: userSetup.title || profileFallback?.title || "",
            designations: userSetup.designations || profileFallback?.designations || [],
            headshot: userSetup.headshot || profileFallback?.headshot || "",
            headshotFileName: userSetup.headshotFileName || "",
            headshotData: userSetup.headshotData || profileFallback?.headshotData || null,
            backgroundImage: userSetup.backgroundImage || "",
            backgroundFileName: userSetup.backgroundFileName || "",
            primaryServiceCategories,
            saveAsContact: userSetup.saveAsContact ?? true,
          };
          userSetupForm.reset(profileData, { keepDirtyValues: false });
          setInitialUserSetup(JSON.parse(JSON.stringify(profileData)));
          break;
        }
        case "branding": {
          const loadedData = await loadAllWizardData(true);
          const branding = loadedData?.branding ?? useOnboardingWizardStore.getState().stepData?.branding ?? {};

          // Fetch profile from /api/profile if SWR hasn't loaded it yet
          let profileFallback: any = cachedProfile ?? userProfile;
          if (!profileFallback) {
            try {
              const profileRes = await fetch("/api/profile");
              if (profileRes.ok) {
                profileFallback = await profileRes.json();
                setUserProfile(profileFallback);
              }
            } catch { /* ignore */ }
          }
          const completedBranding = profileFallback?.wizardSessions?.[0]?.branding;

          const brandingData = {
            organizationName:
              branding.organizationName ||
              completedBranding?.organizationName ||
              profileFallback?.organizationName ||
              profileFallback?.company ||
              "",
            website:
              branding.website || completedBranding?.website || profileFallback?.website || "",
            logo:
              branding.logo || completedBranding?.logo || profileFallback?.advisorLogo || "",
            logoFileName:
              branding.logoFileName || completedBranding?.logoFileName || "",
            brandColor:
              branding.brandColor || completedBranding?.brandColor || profileFallback?.brandColor || "#1F3A60",
            primaryColor:
              branding.primaryColor || completedBranding?.primaryColor || profileFallback?.primaryColor || "",
            secondaryColor:
              branding.secondaryColor || completedBranding?.secondaryColor || profileFallback?.secondaryColor || "",
            missionStatement:
              branding.missionStatement || completedBranding?.missionStatement || "",
            backgroundImage:
              branding.backgroundImage ||
              completedBranding?.backgroundImage ||
              profileFallback?.advisorBackgroundImage ||
              profileFallback?.backgroundImage ||
              "",
            backgroundFileName:
              branding.backgroundFileName || completedBranding?.backgroundFileName || "",
            aiAvatar: branding.aiAvatar || completedBranding?.aiAvatar || "",
            avatarFileName:
              branding.avatarFileName || completedBranding?.avatarFileName || "",
            subdomain:
              branding.subdomain || completedBranding?.subdomain || profileFallback?.subdomain || "",
            isColorPickerOpen: false,
            isGenerating: false,
          };
          brandingForm.reset(brandingData, { keepDirtyValues: false });
          setInitialBranding(JSON.parse(JSON.stringify(brandingData)));
          setFormKey((prev) => prev + 1);

          if (profileFallback) setUserProfile(profileFallback);
          break;
        }
        case "organization":
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
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === "profile") {
      loadTabData(activeTab);
    } else if (!loadedTabs.has(activeTab)) {
      loadTabData(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Populate forms when stepData or userProfile changes
  useEffect(() => {
    if (isLoading) return;

    const userSetup = stepData.userSetup || ({} as any);
    const profile = userProfile || ({} as any);

    let primaryServiceCategories: string[] = Array.isArray(userSetup.primaryServiceCategories)
      ? [...userSetup.primaryServiceCategories]
      : [];
    // Fallback to User-level primaryServiceCategories from /api/profile
    if (primaryServiceCategories.length === 0 && profile.primaryServiceCategories?.length > 0) {
      primaryServiceCategories = [...profile.primaryServiceCategories];
    }
    if (primaryServiceCategories.length === 0 && stepData.services?.services?.length) {
      primaryServiceCategories = step2ServicesToCategories(stepData.services.services);
    }
    const userData = {
      name: userSetup.name || profile.name || "",
      email: userSetup.email || profile.email || "",
      phone: userSetup.phone || profile.phone || "",
      title: userSetup.title || profile.title || "",
      designations: userSetup.designations || profile.designations || [],
      headshot: userSetup.headshot || profile.headshot || "",
      headshotFileName: userSetup.headshotFileName || "",
      headshotData: userSetup.headshotData || profile.headshotData || null,
      backgroundImage: userSetup.backgroundImage || "",
      backgroundFileName: userSetup.backgroundFileName || "",
      primaryServiceCategories,
      saveAsContact: userSetup.saveAsContact ?? true,
    };
    userSetupForm.reset(userData, { keepDirtyValues: false });
    setInitialUserSetup(JSON.parse(JSON.stringify(userData)));

    const branding = stepData.branding || ({} as any);
    const completedBranding = userProfile?.wizardSessions?.[0]?.branding;

    const brandingData = {
      organizationName:
        branding.organizationName ||
        completedBranding?.organizationName ||
        userProfile?.organizationName ||
        userProfile?.company ||
        "",
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
        branding.backgroundImage ||
        completedBranding?.backgroundImage ||
        userProfile?.advisorBackgroundImage ||
        userProfile?.backgroundImage ||
        "",
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

    setFormKey((prev) => prev + 1);

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
  }, [stepData, isLoading, userProfile]);

  // ── After BrandingSetupCard initializes, re-sync the baseline snapshot ──
  // BrandingSetupCard has a useEffect that auto-generates missionStatement
  // from organizationName on mount. That fires after our initial snapshot,
  // causing a false-positive "unsaved changes" detection. We schedule a
  // microtask to capture the final post-initialization form state.
  useEffect(() => {
    if (activeTab !== "branding" || !initialBranding) return;
    const id = setTimeout(() => {
      setInitialBranding(
        JSON.parse(JSON.stringify(brandingForm.getValues())),
      );
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  // ── Sync primaryServiceCategories from userProfile when it becomes available ──
  // This ensures categories from the User DB record are applied even if
  // cachedProfile resolved after the initial form reset.
  const profileCategoriesSyncedRef = useRef(false);
  useEffect(() => {
    if (!userProfile) return;
    if (profileCategoriesSyncedRef.current) return;

    const currentCategories = userSetupForm.getValues("primaryServiceCategories") || [];
    if (currentCategories.length === 0 && userProfile.primaryServiceCategories?.length > 0) {
      const categories = [...userProfile.primaryServiceCategories];
      userSetupForm.setValue("primaryServiceCategories", categories, {
        shouldDirty: false,
        shouldTouch: false,
      });
      // Also sync to initialUserSetup so the dirty-comparison snapshot reflects the categories
      setInitialUserSetup((prev: any) => {
        if (!prev) return prev;
        return { ...prev, primaryServiceCategories: categories };
      });
    }
    profileCategoriesSyncedRef.current = true;
  }, [userProfile, userSetupForm]);

  const handleSaveUserSetup = async () => {
    setIsSaving(true);
    try {
      const data = userSetupForm.getValues();
      const { saveStepDataToServer } = useOnboardingWizardStore.getState();
      const ok = await saveStepDataToServer("userSetup", data);
      if (!ok) throw new Error("Failed to save user setup");
      await loadAllWizardData(true);
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
      const { saveStepDataToServer } = useOnboardingWizardStore.getState();

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

      const ok = await saveStepDataToServer("branding", brandingPayload);
      if (!ok) throw new Error("Failed to save branding");

      try {
        const updateResponse = await fetch("/api/profile/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            advisorLogo: data.logo,
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
      }

      await loadAllWizardData(true);
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
      const { saveStepDataToServer } = useOnboardingWizardStore.getState();

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

      await loadAllWizardData(true);
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

  // ── Subscribe to form values for reactive dirty detection ───────────────
  const watchedUserSetup = userSetupForm.watch();
  const watchedBranding = brandingForm.watch();
  const watchedOrg = organizationForm.watch();
  const watchedServices = servicesForm.watch();

  // ── Computed dirty state per tab (reactive via watch()) ─────────────────
  const tabDirty = {
    profile: initialUserSetup
      ? JSON.stringify(watchedUserSetup) !== JSON.stringify(initialUserSetup)
      : false,
    branding: initialBranding
      ? JSON.stringify(watchedBranding) !== JSON.stringify(initialBranding)
      : false,
    organization:
      initialOrganization && initialServices
        ? JSON.stringify(watchedOrg) !== JSON.stringify(initialOrganization) ||
          JSON.stringify(watchedServices) !== JSON.stringify(initialServices)
        : false,
  };

  // ── Tab change with unsaved check ───────────────────────────────────────
  const handleTabChange = (newTab: string) => {
    const currentDirty =
      activeTab === "profile"
        ? tabDirty.profile
        : activeTab === "branding"
        ? tabDirty.branding
        : activeTab === "organization"
        ? tabDirty.organization
        : false;

    if (currentDirty) {
      setPendingTab(newTab);
      setShowUnsavedChangesDialog(true);
    } else {
      setActiveTab(newTab);
    }
  };

  // ── Save current tab's data ─────────────────────────────────────────────
  const handleSaveCurrentTab = async () => {
    setIsSaving(true);
    try {
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
    } finally {
      setIsSaving(false);
    }
  };

  // ── Reset current tab's form ────────────────────────────────────────────
  const handleResetCurrentTab = () => {
    switch (activeTab) {
      case "profile":
        if (initialUserSetup) {
          userSetupForm.reset(initialUserSetup);
        }
        break;
      case "branding":
        if (initialBranding) {
          brandingForm.reset(initialBranding);
        }
        break;
      case "organization":
        if (initialOrganization) {
          organizationForm.reset(initialOrganization);
        }
        if (initialServices) {
          servicesForm.reset(initialServices);
        }
        break;
    }
    toast.info("Changes reverted");
  };

  // ── Save and continue (from dialog) ─────────────────────────────────────
  const handleSaveAndContinue = async () => {
    if (!pendingTab) return;

    setIsSaving(true);
    try {
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

  // ── Discard and switch tab ──────────────────────────────────────────────
  const handleDiscardChanges = () => {
    if (pendingTab) {
      switch (activeTab) {
        case "profile":
          const userSetup = stepData.userSetup || ({} as any);
          userSetupForm.reset({
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
          });
          break;
        case "branding": {
          const branding = stepData.branding || ({} as any);
          brandingForm.reset({
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
          });
          break;
        }
        case "organization":
          organizationForm.reset({
            organizationType: stepData.clientProfile?.organizationType || "",
            customOrganization: stepData.clientProfile?.customOrganization || "",
            teamSize: stepData.teamSize?.teamSize || "",
          });
          servicesForm.reset(
            stepData.services || { services: [], customService: "" },
          );
          break;
      }
      setActiveTab(pendingTab);
      setPendingTab(null);
      setShowUnsavedChangesDialog(false);
    }
  };

  const handleCancelTabChange = () => {
    setPendingTab(null);
    setShowUnsavedChangesDialog(false);
  };

  const currentHasUnsaved =
    activeTab === "profile"
      ? tabDirty.profile
      : activeTab === "branding"
      ? tabDirty.branding
      : activeTab === "organization"
      ? tabDirty.organization
      : false;

  // ── Save handler for sections (kept for compatibility but unused by UI) ─
  const noopSave = async () => {};

  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-screen max-w-4xl mx-auto py-6 pb-28">
        <div className="mb-6">
          <p className="mt-2 text-muted-foreground">
            Manage your profile, branding, and organization settings
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4 relative">
            <TabsTrigger value="profile" className="flex items-center gap-2 relative">
              <User className="h-4 w-4" />
              Profile
              {tabDirty.profile && (
                <Circle className="h-2 w-2 fill-amber-500 text-amber-500 absolute -top-0.5 -right-0.5" />
              )}
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center gap-2 relative">
              <Building2 className="h-4 w-4" />
              Branding
              {tabDirty.branding && (
                <Circle className="h-2 w-2 fill-amber-500 text-amber-500 absolute -top-0.5 -right-0.5" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="organization"
              className="flex items-center gap-2 relative"
            >
              <Briefcase className="h-4 w-4" />
              Organization
              {tabDirty.organization && (
                <Circle className="h-2 w-2 fill-amber-500 text-amber-500 absolute -top-0.5 -right-0.5" />
              )}
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
              onSave={noopSave}
            />

            {/* ── Delete Profile Section ── */}
            <Card className="border-2 border-red-500/50 dark:border-red-500/40 bg-red-50/30 dark:bg-red-950/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-900/40 shrink-0">
                    <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                        Delete Profile
                      </h3>
                      <p className="text-sm text-red-600/80 dark:text-red-400/70 mt-1">
                        Permanently delete your profile and all associated data.
                        This includes your wizard sessions, branding, plans,
                        clients, and documents. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDeletionSuccess(false);
                        setShowDeleteConfirmDialog(true);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete My Profile
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <BrandingSettingsSection
              isLoading={isLoading}
              isSaving={isSaving}
              brandingForm={brandingForm}
              formKey={formKey}
              onSave={noopSave}
            />
          </TabsContent>

          {/* Organization Tab */}
          <TabsContent value="organization" className="space-y-6">
            <OrganizationSettingsSection
              isLoading={isLoading}
              isSaving={isSaving}
              organizationForm={organizationForm}
              servicesForm={servicesForm}
              onSave={noopSave}
            />
          </TabsContent>

          {/* Team & Disclaimers Tab */}
          <TabsContent value="team" className="space-y-6">
            <TeamAndDisclaimersSection isLoading={isLoading} />
          </TabsContent>
        </Tabs>

        {/* ── Sticky Bottom Save Bar ──────────────────────────────────────── */}
        {currentHasUnsaved && (
          <div
            className="fixed bottom-0 bg-background border-t z-50 dark:border-gray-700 shadow-lg"
            style={{
              left: "var(--sidebar-width, 16rem)",
              width: "calc(100% - var(--sidebar-width, 16rem))",
              transition: "left 200ms ease-in-out, width 200ms ease-in-out",
            }}
          >
            <div className="max-w-4xl mx-auto px-6">
              <Card className="shadow-none border-0 bg-transparent">
                <CardContent className="flex justify-between items-center p-4">
                  <p className="text-sm text-muted-foreground">
                    You have unsaved changes
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleResetCurrentTab}
                      disabled={isSaving}
                      className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                    <Button
                      onClick={handleSaveCurrentTab}
                      disabled={isSaving}
                      className="bg-accent-blue hover:bg-accent-blue/90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteConfirmDialog}
        onOpenChange={(open) => {
          setShowDeleteConfirmDialog(open);
          if (!open) {
            setDeletionSuccess(false);
            setIsDeleting(false);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-[480px]">
          {deletionSuccess ? (
            /* ── Success state (visible for 3 seconds) ── */
            <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Successfully Deleted Profile
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600 dark:text-gray-400">
                Your profile and all associated data have been permanently deleted.
              </AlertDialogDescription>
            </div>
          ) : (
            <>
              <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <AlertDialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Delete Your Profile?
                  </AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-left text-gray-600 text-muted-foreground space-y-3">
                  <p>
                    Are you sure you want to delete your profile? This will
                    permanently remove:
                  </p>
                  <ul className="list-disc pl-5 text-left text-sm space-y-1">
                    <li className="text-left">Your account and login credentials</li>
                    <li className="text-left">All wizard sessions and onboarding data</li>
                    <li className="text-left">All plans, clients, and documents</li>
                    <li className="text-left">All branding and settings</li>
                  </ul>
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    This action cannot be undone.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex flex-row items-center gap-2 sm:gap-2 mt-4">
                <AlertDialogCancel
                  disabled={isDeleting}
                  className="flex-1 m-0 border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </AlertDialogCancel>
                <Button
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      const res = await fetch("/api/profile/delete", {
                        method: "DELETE",
                      });
                      if (res.ok) {
                        setDeletionSuccess(true);
                        // Show success state for 3 seconds, then redirect to sign-in
                        setTimeout(() => {
                          window.location.href = "/signin";
                        }, 3000);
                      } else {
                        const body = await res.json().catch(() => ({}));
                        const msg = body?.error || "Please try again.";
                        toast.error("Failed to delete profile. " + msg);
                        setIsDeleting(false);
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Please try again.";
                      toast.error("Failed to delete profile. " + msg);
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting}
                  variant="destructive"
                  className="flex-1 bg-red-600 text-white hover:bg-red-700"
                >
                  {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isDeleting ? "Deleting..." : "Yes, Delete My Profile"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

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
              <AlertDialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Unsaved Changes
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              You have unsaved changes that will be lost. What would you like to
              do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row items-center gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel
              onClick={handleCancelTabChange}
              className="flex-1 m-0 border-gray-300 text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 hover:bg-gray-50"
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
