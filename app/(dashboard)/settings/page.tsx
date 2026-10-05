"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";
import { useOnboardingWizardStore } from "@/lib/onboarding-wizard-store";
import { fetchProfileOnce, invalidateProfileCache } from "@/lib/fetch-profile";
import { step2ServicesToCategories } from "@/lib/service-categories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfileSettingsSection } from "@/components/pages/settings/profile-settings-section";
import { BrandingSettingsSection } from "@/components/pages/settings/branding-settings-section";
import { OrganizationSettingsSection } from "@/components/pages/settings/organization-settings-section";
import { TeamAndDisclaimersSection } from "@/components/pages/settings/team-and-disclaimers-section";
import { TeamMembersSection } from "@/components/pages/settings/team-members-section";
import type { DisclaimersSettingsSectionHandle } from "@/components/pages/settings/disclaimers-settings-section";
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
  AlertTriangle,
  Circle,
  Trash2,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  UserPlus,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

/**
 * The organization's own values, when the signed-in account is NOT its owner.
 *
 * Settings → Branding and Settings → Organization both fill from the reader's own `User` row,
 * which is right for an owner and empty for an invited teammate: the acceptance flow creates that
 * row from a name and an email, so it carries no logo, colours, website, mission statement,
 * organization type or team size — and both tabs opened blank for a teammate of an organization
 * that plainly has all of them.
 *
 * `GET /api/profile` therefore reports the organization's brand (resolved from the owner's row —
 * the same source the owner's own tab reads) together with `viewerIsOwner`. This returns it for a
 * non-owner only: for an owner the two are the same values, and leaving the owner's row in front
 * keeps their own unsaved local edits authoritative. Returning null (an owner, or a payload that
 * predates the field) leaves every existing fallback exactly as it was, so this can only fill
 * values that were previously blank.
 */
function organizationProfileSource(profile: any) {
  const organization = profile?.organization;
  if (!organization || organization.viewerIsOwner !== false) return null;
  return organization.source ?? null;
}

/**
 * The reader's own seat, when an invitation gave them one.
 *
 * Settings → Profile fills from the reader's `User` row plus their wizard session, and an invited
 * teammate has neither in any useful form: that row was created from a name, an email and a
 * password, and there is no session. Their job title, phone, extension, designations and photo
 * were captured from the Key Contact they were invited as and live on the `TeammateProfile` —
 * which is also where People & Access and the header read them from. Reported by
 * `GET /api/profile` as `seat`, null for anyone without one.
 *
 * Always a fallback, never a source of truth: the wizard store is the reader's own unsaved edit
 * and their own row is what the tab saves to, so this only fills what is otherwise blank.
 */
function seatProfileSource(profile: any) {
  return profile?.seat ?? null;
}

/** The first list that actually has entries — `[]` is truthy, so `||` cannot be used here. */
function firstNonEmptyList<T>(...lists: (T[] | null | undefined)[]): T[] {
  for (const list of lists) {
    if (Array.isArray(list) && list.length > 0) return list;
  }
  return [];
}

/**
 * Phrase the reader must type to unlock Delete Profile. Deleting removes the whole
 * account and cannot be undone, so a single click is too cheap a confirmation. Mirrors
 * the Delete Benefit and Delete Plan dialogs, which gate the same way.
 */
const DELETE_PROFILE_PHRASE = "delete profile";

export default function SettingsPage() {
  const { setTitle, setSubtitle } = usePageTitleContext();
  const { stepData } = useOnboardingWizardStore();
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(
    () => !useOnboardingWizardStore.getState().stepData?.userSetup,
  );
  const [activeTab, setActiveTab] = useState("profile");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  // Portal target for the tab bar — the Header renders <div id="header-tabs-portal" />
  // and the TabsList is portalled into it, so the tabs live in the fixed header and
  // stay visible while the page scrolls. Same arrangement as Edit Plan / Edit Client /
  // Edit Benefit. A React portal keeps the React tree, so the portalled list is still
  // inside this page's <Tabs>: it drives `activeTab` and therefore still goes through
  // `handleTabChange` and the unsaved-changes guard below.
  const [headerPortalTarget, setHeaderPortalTarget] =
    useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderPortalTarget(document.getElementById("header-tabs-portal"));
  }, []);

  // Deep link support: `/settings?tab=members` opens that tab. The dashboard's team panel
  // ("View all") links here so it lands straight on People & Access. Read from the URL in an
  // effect rather than `useSearchParams` so this client page needs no Suspense boundary; an
  // unknown value is ignored rather than switching to a tab that does not exist.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (!requested) return;
    const knownTabs = ["profile", "branding", "organization", "members", "billing"];
    if (knownTabs.includes(requested)) setActiveTab(requested);
  }, []);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionSuccess, setDeletionSuccess] = useState(false);
  // Type-to-confirm gate for the delete dialog. Trimmed + case-insensitive so a pasted
  // trailing space is forgiven, but the phrase still has to be typed rather than merely
  // acknowledged — the same rule Delete Benefit and Delete Plan apply.
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const isDeleteProfileConfirmed =
    deleteConfirmText.trim().toLowerCase() === DELETE_PROFILE_PHRASE;

  // Disclaimers section (folded into the Organization tab) — dirty state +
  // imperative handle for save/reset.
  const [teamDirty, setTeamDirty] = useState(false);
  const disclaimersRef = useRef<DisclaimersSettingsSectionHandle>(null);

  // Store initial values for comparison
  const [initialUserSetup, setInitialUserSetup] = useState<any>(null);
  const [initialBranding, setInitialBranding] = useState<any>(null);
  const [initialOrganization, setInitialOrganization] = useState<any>(null);

  // Form for User Setup
  const userSetupForm = useForm({
    defaultValues: {
      name: "",
      email: "",
      organizationEmail: "",
      phone: "",
      phoneExtension: "",
      title: "",
      designations: [] as string[],
      headshot: "",
      headshotFileName: "",
      headshotData: null as any,
      backgroundImage: "",
      backgroundFileName: "",
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
      // Moved here from the Profile form: the field describes the organization, and this is the
      // form whose save writes organization-level values.
      primaryServiceCategories: [] as string[],
    },
  });

  useEffect(() => {
    setTitle("Settings");
  }, [setTitle]);

  // Track which tabs have been loaded
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

  /**
   * Whether People & Access has been opened in this page's lifetime.
   *
   * `TeamMembersSection` owns its own request (the roster plus a 500-plan summary), so it is not
   * covered by `loadedTabs` above — and Radix unmounts an inactive `TabsContent`, which meant every
   * return to the tab remounted the section and re-ran both fetches. Once opened, the tab keeps the
   * section mounted (`forceMount`) so its own `load()` runs exactly once.
   */
  const [membersTabOpened, setMembersTabOpened] = useState(false);

  // Force re-render key for forms
  const [formKey, setFormKey] = useState(0);

  // User profile data (for branding fallback and primaryServiceCategories)
  const [userProfile, setUserProfile] = useState<any>(null);

  // SWR: cache /api/profile (single-flight fetcher so concurrent callers
  // share one request instead of racing each other)
  const { data: cachedProfile, mutate: mutateProfile } = useSWR(
    "/api/profile",
    () => fetchProfileOnce(),
    { keepPreviousData: true, dedupingInterval: 60_000, revalidateOnFocus: false },
  );

  // Mirror the resolved profile into state on every change.
  //
  // This previously latched onto the FIRST value (`profileSyncedRef`), which
  // pinned a pre-save snapshot for the rest of the page's life: every
  // `userProfile?.…` fallback below (branding's organizationName / website, the
  // organization tab, the header subtitle) kept reading the old object, so a
  // renamed organization — or a value that had just been cleared, e.g. a removed
  // logo — could be resurrected from it.
  //
  // The mirror is safe: `cachedProfile` only changes identity when a fetch
  // actually resolves, and the populate effect below still prefers the wizard
  // store (`stepData`) over the profile for every field the forms edit.
  useEffect(() => {
    if (cachedProfile) setUserProfile(cachedProfile);
  }, [cachedProfile]);

  /**
   * Re-read the profile after a save.
   *
   * SWR is configured with a 60s dedupe and no focus revalidation, so on its own
   * it never refetches — without this the page held the pre-save profile for its
   * entire lifetime and the header kept the old organization name after a rename.
   *
   * `invalidateProfileCache()` clears the module-level single-flight cache first,
   * so the revalidation SWR then triggers goes to the network instead of being
   * served the stale module-cached value.
   *
   * Never throws: a failed refresh must not fail a save that already succeeded.
   */
  const refreshProfile = useCallback(async () => {
    invalidateProfileCache();
    try {
      await mutateProfile();
    } catch {
      // Ignore — the save itself already succeeded.
    }
  }, [mutateProfile]);

  // ── Header subtitle: "Settings / {Organization Name}" ───────────────────
  // The header renders `title / subtitle` with the subtitle in accent-blue, so
  // setting the organization name as the subtitle is all that is needed.
  //
  // The precedence mirrors the Branding tab's own resolution of the organization
  // name (wizard branding → User.organizationName → User.organizationType) so the
  // two can never disagree about what the organization is called.
  //
  // `cachedProfile` first, then the mirrored `userProfile`: cachedProfile updates
  // the instant a fetch resolves, whereas the mirror lands one effect later, so
  // this ordering avoids a frame of missing subtitle on first load. Both are kept
  // fresh by `refreshProfile()` after every save, so a rename shows immediately.
  const organizationName = useMemo(() => {
    const source: any = cachedProfile ?? userProfile;
    return (
      source?.wizardSessions?.[0]?.branding?.organizationName?.trim() ||
      source?.organizationName?.trim() ||
      // The ORGANIZATION's own name, for a reader who is not its owner.
      //
      // The two sources above are the reader's own row and their onboarding session, and an
      // invited teammate has neither: the acceptance flow wrote a name and an email, and there is
      // no session. The subtitle was therefore simply missing for them — while the Branding tab
      // beside it showed the firm's name, from this same payload.
      //
      // It sits AFTER them on purpose. For an owner the value is their own (the organization's
      // identity is derived from their row), so their precedence is unchanged; `organizationType`
      // stays last as the legacy fallback it always was.
      source?.organization?.source?.organizationName?.trim() ||
      source?.organizationType?.trim() ||
      ""
    );
  }, [cachedProfile, userProfile]);

  // Declared AFTER the setTitle effect above: `setTitle` clears the subtitle, so
  // the subtitle must be applied last for the header to read "Settings / Org".
  // Re-runs when the name arrives (the profile loads asynchronously) and on any
  // later rename.
  useEffect(() => {
    setSubtitle(organizationName);
    return () => setSubtitle("");
  }, [organizationName, setSubtitle]);

  /**
   * Whether the reader owns the organization — what decides whether the Billing tab exists at all.
   *
   * Ownership IS the billing rule: `billing` is `edit` for the Owner and `no_access` for every
   * other role in the teammate permission grid (`types/teammate.ts`) — Admin included — and
   * collaborators can never hold it. `GET /api/profile` reports it as `organization.viewerIsOwner`.
   *
   * The tab bar reads it as `=== true`, so `undefined` (the payload has not resolved yet, or there
   * is no organization on the account) leaves the tab absent rather than offered: the cost is a
   * moment's absence for the Owner, and the alternative — showing it until the answer arrives —
   * would flash a page a member cannot open and then take it back.
   */
  const viewerIsOrganizationOwner = cachedProfile?.organization?.viewerIsOwner as
    | boolean
    | undefined;

  /**
   * Whether the reader is a teammate whose summarised role is Viewer — i.e. read-only across the
   * whole grid (`READ_ONLY_GRID` in `types/teammate.ts`: every content row is `view`, and
   * `org_settings` / `billing` are `no_access`).
   *
   * `/api/profile` reports the reader's own seat as `seat.role` — the same summarised role the
   * dashboard header and People & Access show — so this cannot disagree with what those surfaces
   * call the person. Settings → Branding and Settings → Organization are organization-level writes
   * (they persist the firm identity to the `User`/`Organization` rows), which is exactly the
   * `org_settings` row a Viewer does not hold.
   *
   * `!viewerIsOrganizationOwner` is belt-and-braces: an owner holds no seat, so this is already
   * false for them, but the guard states the intent.
   */
  const readOnlyViewer =
    !viewerIsOrganizationOwner && cachedProfile?.seat?.role === "viewer";

  // Safety net for the async role: if the seat resolves as a Viewer while an organization-level
  // tab is already open (the profile lands a tick after the first paint), fall back to Profile
  // rather than leaving that content on screen with its tab removed from the bar.
  useEffect(() => {
    if (
      readOnlyViewer &&
      (activeTab === "branding" || activeTab === "organization")
    ) {
      setActiveTab("profile");
    }
  }, [readOnlyViewer, activeTab]);

  // Load data for specific tab
  const loadTabData = async (tab: string) => {
    if (loadedTabs.has(tab) && tab !== "profile") return;

    const hasExistingData = Boolean(useOnboardingWizardStore.getState().stepData?.userSetup);
    try {
      if (!hasExistingData) setIsLoading(true);
      switch (tab) {
        case "profile": {
          // The profile tab reads everything from /api/profile — the route
          // already embeds the wizard session's userSetup
          // (wizardSessions[0].userSetup via getEffectiveWizardUserSetup),
          // so a separate /api/onboarding-wizard/user-setup call is not
          // needed here. The shared wizard store is only a fallback.
          let profileFallback: any = cachedProfile ?? userProfile;
          if (!profileFallback) {
            profileFallback = await fetchProfileOnce();
            if (profileFallback) setUserProfile(profileFallback);
          }

          const userSetup =
            profileFallback?.wizardSessions?.[0]?.userSetup ??
            useOnboardingWizardStore.getState().stepData?.userSetup ??
            {};

          // Primary Service Categories are no longer read here: the control moved to the
          // Organization tab, which populates them from the same sources.

          // The reader's own seat: where an invited teammate's title, phone, designations and
          // photo actually are. See seatProfileSource.
          const seat = seatProfileSource(profileFallback);

          const profileData = {
            name: userSetup.name || profileFallback?.name || "",
            email: userSetup.email || profileFallback?.email || "",
            organizationEmail:
              userSetup.organizationEmail ||
              profileFallback?.organizationEmail ||
              profileFallback?.organization?.organizationEmail ||
              "",
            phone: userSetup.phone || seat?.phone || profileFallback?.phone || "",
            phoneExtension:
              userSetup.phoneExtension ||
              seat?.phoneExtension ||
              profileFallback?.phoneExtension ||
              "",
            title: userSetup.title || seat?.jobTitle || profileFallback?.title || "",
            designations: firstNonEmptyList<string>(
              userSetup.designations,
              seat?.designations,
              profileFallback?.designations,
            ),
            headshot:
              userSetup.headshot || seat?.headshot || profileFallback?.headshot || "",
            headshotFileName: userSetup.headshotFileName || "",
            headshotData: userSetup.headshotData || profileFallback?.headshotData || null,
            backgroundImage: userSetup.backgroundImage || "",
            backgroundFileName: userSetup.backgroundFileName || "",
            saveAsContact: userSetup.saveAsContact ?? true,
          };
          userSetupForm.reset(profileData, { keepDirtyValues: false });
          setInitialUserSetup(JSON.parse(JSON.stringify(profileData)));
          break;
        }
        case "branding": {
          // The branding tab reads everything from /api/profile — the route
          // already embeds wizardSessions[0].branding, so loading the full
          // 10-step wizard payload (new-session + every step endpoint) is not
          // needed here. The shared wizard store is only a fallback.
          let profileFallback: any = cachedProfile ?? userProfile;
          if (!profileFallback) {
            profileFallback = await fetchProfileOnce();
            if (profileFallback) setUserProfile(profileFallback);
          }

          const branding =
            profileFallback?.wizardSessions?.[0]?.branding ??
            useOnboardingWizardStore.getState().stepData?.branding ??
            {};

          // The organization's own values — the ones a teammate's row does not carry. See
          // organizationProfileSource.
          const organizationSource = organizationProfileSource(profileFallback);

          const brandingData = {
            organizationName:
              branding.organizationName ||
              organizationSource?.organizationName ||
              profileFallback?.organizationName ||
              profileFallback?.organizationType ||
              "",
            website:
              branding.website ||
              organizationSource?.website ||
              profileFallback?.website ||
              "",
            logo:
              branding.logo ||
              organizationSource?.logo ||
              profileFallback?.advisorLogo ||
              "",
            logoFileName: branding.logoFileName || "",
            brandColor:
              branding.brandColor || profileFallback?.brandColor || "#1F3A60",
            primaryColor:
              branding.primaryColor ||
              organizationSource?.primaryColor ||
              profileFallback?.primaryColor ||
              "",
            secondaryColor:
              branding.secondaryColor ||
              organizationSource?.secondaryColor ||
              profileFallback?.secondaryColor ||
              "",
            missionStatement:
              branding.missionStatement ||
              organizationSource?.missionStatement ||
              "",
            backgroundImage:
              branding.backgroundImage ||
              organizationSource?.backgroundImage ||
              profileFallback?.advisorBackgroundImage ||
              profileFallback?.backgroundImage ||
              "",
            backgroundFileName: branding.backgroundFileName || "",
            aiAvatar: branding.aiAvatar || organizationSource?.aiAvatar || "",
            avatarFileName: branding.avatarFileName || "",
            isColorPickerOpen: false,
            isGenerating: false,
          };
          brandingForm.reset(brandingData, { keepDirtyValues: false });
          setInitialBranding(JSON.parse(JSON.stringify(brandingData)));
          setFormKey((prev) => prev + 1);

          if (profileFallback) setUserProfile(profileFallback);
          break;
        }
        case "organization": {
          let profileFallback: any = cachedProfile ?? userProfile;
          if (!profileFallback) {
            profileFallback = await fetchProfileOnce();
            if (profileFallback) setUserProfile(profileFallback);
          }

          // The `User` row is the canonical firm profile — the onboarding wizard copies its
          // session into those columns (`wizard-completion.ts`), and the Organization mirrors
          // them. It is read FIRST for that reason.
          //
          // The wizard session is still read, but only as a fallback, because Settings used to
          // save these three fields there: for an advisor who edited them from this tab, the
          // session holds the newer value. Reading it second means the next save migrates that
          // value into the canonical row instead of reverting it to whatever onboarding saw.
          const legacyClientProfile =
            profileFallback?.wizardSessions?.[0]?.clientProfile;
          const legacyTeamSize = profileFallback?.wizardSessions?.[0]?.teamSize;

          // Same source as the Branding tab above: for a teammate the organization's values are
          // what this tab has to fill from. See organizationProfileSource.
          const organizationSource = organizationProfileSource(profileFallback);

          // Primary Service Categories, moved here from the Profile tab for every profile: they
          // describe the ORGANIZATION — they seed a new plan's benefit visibility (Create Benefit
          // Step 1) and decide which benefits are expected — so they follow the same precedence as
          // this tab's other three fields. The onboarding Step 2 answer is the last resort, for an
          // account that has never had them saved on either row.
          let primaryServiceCategories = firstNonEmptyList<string>(
            profileFallback?.primaryServiceCategories,
            organizationSource?.primaryServiceCategories,
            legacyClientProfile?.primaryServiceCategories,
          );
          if (primaryServiceCategories.length === 0) {
            const servicesArray =
              useOnboardingWizardStore.getState().stepData?.services?.services ?? [];
            if (servicesArray.length > 0) {
              primaryServiceCategories = step2ServicesToCategories(servicesArray);
            }
          }

          const orgData = {
            organizationType:
              profileFallback?.organizationType ||
              organizationSource?.organizationType ||
              legacyClientProfile?.organizationType ||
              "",
            customOrganization:
              profileFallback?.customOrganization ||
              organizationSource?.customOrganization ||
              legacyClientProfile?.customOrganization ||
              "",
            teamSize:
              profileFallback?.teamSize ||
              organizationSource?.teamSize ||
              legacyTeamSize?.teamSize ||
              "",
            primaryServiceCategories,
          };
          organizationForm.reset(orgData, { keepDirtyValues: false });
          setInitialOrganization(JSON.parse(JSON.stringify(orgData)));
          break;
        }
      }

      setLoadedTabs((prev) => new Set(prev).add(tab));
    } catch (error) {
      console.error(`Error loading ${tab} data:`, error);
      toast.error("Failed to load settings data");
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when the active tab changes (also handles the initial tab on
  // mount, since activeTab defaults to "profile"). No separate mount-only
  // effect, which previously caused the initial tab to be loaded twice.
  useEffect(() => {
    if (activeTab === "members") setMembersTabOpened(true);

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

    const userSetup =
      stepData.userSetup ||
      userProfile?.wizardSessions?.[0]?.userSetup ||
      ({} as any);
    const profile = userProfile || ({} as any);

    // Primary Service Categories are no longer part of this form — they moved to the Organization
    // tab, which resolves them in its own branch below.

    // The reader's own seat and the organization's shared email — where an invited teammate's
    // title, phone, designations and photo come from (see seatProfileSource). Both sit behind the
    // store and the reader's own row, so they only fill what is otherwise blank.
    const seat = seatProfileSource(profile);

    const userData = {
      name: userSetup.name || profile.name || "",
      email: userSetup.email || profile.email || "",
      organizationEmail:
        userSetup.organizationEmail ||
        profile.organizationEmail ||
        profile.organization?.organizationEmail ||
        "",
      phone: userSetup.phone || seat?.phone || profile.phone || "",
      phoneExtension:
        userSetup.phoneExtension ||
        seat?.phoneExtension ||
        profile.phoneExtension ||
        "",
      title: userSetup.title || seat?.jobTitle || profile.title || "",
      designations: firstNonEmptyList<string>(
        userSetup.designations,
        seat?.designations,
        profile.designations,
      ),
      headshot: userSetup.headshot || seat?.headshot || profile.headshot || "",
      headshotFileName: userSetup.headshotFileName || "",
      headshotData: userSetup.headshotData || profile.headshotData || null,
      backgroundImage: userSetup.backgroundImage || "",
      backgroundFileName: userSetup.backgroundFileName || "",
      saveAsContact: userSetup.saveAsContact ?? true,
    };
    userSetupForm.reset(userData, { keepDirtyValues: false });
    setInitialUserSetup(JSON.parse(JSON.stringify(userData)));

    const branding = stepData.branding || ({} as any);
    // Read the FALLBACKS from the freshest profile available. `cachedProfile` is
    // the SWR value `refreshProfile()` revalidates after every save, and the
    // `userProfile` mirror above now tracks it instead of freezing at the first
    // sync, so a value that had just been cleared (e.g. a removed logo) can no
    // longer be resurrected from a stale snapshot. The store above remains the
    // primary value.
    const persistedProfile: any = cachedProfile ?? userProfile;
    const completedBranding = persistedProfile?.wizardSessions?.[0]?.branding;
    // One lookup behind BOTH tabs this effect populates: a teammate's row carries none of the
    // organization's values, so they are what this fills Branding and Organization from. A local
    // edit still wins — the wizard store is read first for every field below.
    const organizationSource = organizationProfileSource(persistedProfile);

    const brandingData = {
      organizationName:
        branding.organizationName ||
        completedBranding?.organizationName ||
        organizationSource?.organizationName ||
        userProfile?.organizationName ||
        userProfile?.organizationType ||
        "",
      website:
        branding.website ||
        completedBranding?.website ||
        organizationSource?.website ||
        userProfile?.website ||
        "",
      logo:
        branding.logo ||
        completedBranding?.logo ||
        organizationSource?.logo ||
        persistedProfile?.advisorLogo ||
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
        organizationSource?.primaryColor ||
        userProfile?.primaryColor ||
        "",
      secondaryColor:
        branding.secondaryColor ||
        completedBranding?.secondaryColor ||
        organizationSource?.secondaryColor ||
        userProfile?.secondaryColor ||
        "",
      missionStatement:
        branding.missionStatement ||
        completedBranding?.missionStatement ||
        organizationSource?.missionStatement ||
        "",
      backgroundImage:
        branding.backgroundImage ||
        completedBranding?.backgroundImage ||
        organizationSource?.backgroundImage ||
        userProfile?.advisorBackgroundImage ||
        userProfile?.backgroundImage ||
        "",
      backgroundFileName:
        branding.backgroundFileName ||
        completedBranding?.backgroundFileName ||
        "",
      aiAvatar:
        branding.aiAvatar ||
        completedBranding?.aiAvatar ||
        organizationSource?.aiAvatar ||
        "",
      avatarFileName:
        branding.avatarFileName || completedBranding?.avatarFileName || "",
      isColorPickerOpen: false,
      isGenerating: false,
    };
    brandingForm.reset(brandingData, { keepDirtyValues: false });
    setInitialBranding(JSON.parse(JSON.stringify(brandingData)));

    setFormKey((prev) => prev + 1);

    const completedClientProfile =
      userProfile?.wizardSessions?.[0]?.clientProfile;
    const completedTeamSize = userProfile?.wizardSessions?.[0]?.teamSize;

    // The persisted profile comes FIRST here, unlike the other fields on this page. These
    // three are organization-level: the User row is their source of truth, and the wizard
    // store / session is only leftover onboarding data. Letting stepData win would overwrite
    // a deliberate edit with the value captured during onboarding.
    const orgData = {
      // `organizationSource` is declared with the branding fields above: the organization's own
      // answer for a reader who is not its owner, which is the case this tab used to open blank
      // for. It sits after the reader's own row and before the wizard store — the row wins when
      // it holds a value, and the store is only this reader's own onboarding draft.
      organizationType:
        persistedProfile?.organizationType ||
        organizationSource?.organizationType ||
        stepData.clientProfile?.organizationType ||
        completedClientProfile?.organizationType ||
        "",
      customOrganization:
        persistedProfile?.customOrganization ||
        organizationSource?.customOrganization ||
        stepData.clientProfile?.customOrganization ||
        completedClientProfile?.customOrganization ||
        "",
      teamSize:
        persistedProfile?.teamSize ||
        organizationSource?.teamSize ||
        stepData.teamSize?.teamSize ||
        completedTeamSize?.teamSize ||
        "",
      // Categories follow the same precedence as the three fields above: the reader's row, then
      // the organization, then this reader's own onboarding draft.
      primaryServiceCategories: firstNonEmptyList<string>(
        persistedProfile?.primaryServiceCategories,
        organizationSource?.primaryServiceCategories,
        completedClientProfile?.primaryServiceCategories,
        stepData.services?.services?.length
          ? step2ServicesToCategories(stepData.services.services)
          : [],
      ),
    };
    organizationForm.reset(orgData, { keepDirtyValues: false });
    setInitialOrganization(JSON.parse(JSON.stringify(orgData)));

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

  // The late-sync effect that used to live here is gone with the field: it existed only to write
  // `User.primaryServiceCategories` into the Profile form once `/api/profile` resolved after the
  // initial reset. That value now reaches the Organization tab through its own load, so there is
  // no second writer to race.

  const handleSaveUserSetup = async () => {
    setIsSaving(true);
    try {
      const data = userSetupForm.getValues();

      // Organization Email is required (it is what advisor contact cards show).
      // Validate before any server write so a partial save never happens.
      const orgEmail = (data.organizationEmail || "").trim();
      if (!orgEmail) {
        userSetupForm.setError("organizationEmail", {
          type: "manual",
          message: "Organization email is required",
        });
        toast.error("Organization email is required");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgEmail)) {
        userSetupForm.setError("organizationEmail", {
          type: "manual",
          message: "Please enter a valid organization email",
        });
        toast.error("Please enter a valid organization email");
        return;
      }
      userSetupForm.clearErrors("organizationEmail");

      const { saveStepDataToServer } = useOnboardingWizardStore.getState();
      const ok = await saveStepDataToServer("userSetup", data);
      if (!ok) throw new Error("Failed to save user setup");

      // Persist Primary Service Categories (and, as a safety net, Organization
      // Email) directly to the User record. PrimaryServiceCategories has no
      // column on WizardUserSetup, so a plain userSetup save silently drops it;
      // `/api/profile` is the authoritative source that reads
      // `User.primaryServiceCategories`. Organization Email is what pre-populated
      // advisor contact cards (Create Plan Step 3) display; blank/null means the
      // card falls back to the login email.
      const userId = userProfile?.id || cachedProfile?.id;
      if (userId) {
        try {
          const profileRes = await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: userId,
              ...(data.organizationEmail !== undefined && {
                organizationEmail: data.organizationEmail || null,
              }),
              // Designations are a `User` column, so they are written on this request rather than
              // only into the wizard session — otherwise the Profile tab showed the new value (it
              // reads the session first) while the portal and the benefit pages kept the old one.
              designations: Array.isArray(data.designations) ? data.designations : [],
              // `primaryServiceCategories` is NOT sent from here any more — it belongs to the
              // Organization tab's save. Sending the Profile form's (absent) value would have
              // cleared the organization's categories on every profile save.
            }),
          });
          if (!profileRes.ok) {
            console.warn(
              "Failed to persist profile fields (organizationEmail / primaryServiceCategories) to User record",
              profileRes.status,
            );
          }
        } catch (profileError) {
          console.error(
            "Error persisting profile fields to User record:",
            profileError,
          );
        }
      }

      // Keep the shared wizard store in step with what was just persisted.
      // `saveStepDataToServer` only POSTs — nothing writes back locally — so without
      // this the store kept the pre-save values and the tab re-population effect
      // (which reads it) showed the old data on the next visit.
      try {
        const { saveStepDataLocally } = useOnboardingWizardStore.getState();
        const localUserSetup =
          useOnboardingWizardStore.getState().stepData?.userSetup || {};
        await saveStepDataLocally("userSetup", { ...localUserSetup, ...data });
      } catch (localError) {
        console.warn("Failed to sync user setup to the wizard store", localError);
      }

      await refreshProfile();
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
      };

      // Persist branding fields (logo, colors, background) to the User record
      // FIRST — User.backgroundImage is what the benefits wizard step-1
      // pre-populates the Background Header Image from. This must not be blocked
      // by the wizard-session save below, which can reject and previously
      // aborted the whole save — leaving the background un-saved and
      // un-pre-populated.
      //
      // When the user deletes the background, data.backgroundImage is "" — it MUST
      // be sent as an empty string so Prisma clears User.backgroundImage. Sending
      // `undefined` would cause JSON.stringify to drop the key, leaving the stale
      // R2 key in the DB (which then re-pre-populates the benefits header).
      try {
        const updateResponse = await fetch("/api/profile/update-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            advisorLogo: data.logo || "",
            advisorLogoUrl: data.logo || "",
            organizationName: data.organizationName || undefined,
            website: data.website || undefined,
            primaryColor: data.primaryColor || undefined,
            secondaryColor: data.secondaryColor || undefined,
            backgroundImage: data.backgroundImage || "",
          }),
        });

        if (!updateResponse.ok) {
          console.warn(
            "Failed to update user profile with branding fields",
            updateResponse.status,
          );
        }
      } catch (profileError) {
        console.error("Error updating user profile:", profileError);
      }

      // Best-effort wizard-session save (logo, colors, etc.). A validation
      // failure here must not prevent the User-record save above.
      try {
        const ok = await saveStepDataToServer("branding", brandingPayload);
        if (!ok) {
          console.warn("Failed to save branding to wizard session");
        }
      } catch (brandingError) {
        console.error("Error saving branding to wizard session:", brandingError);
      }

      // When the branding background is removed, also clear the wizard userSetup
      // background (advisorBackgroundImage) — otherwise the /api/profile fallback
      // chain (`profile.backgroundImage || advisorBackgroundImage || …`) in the
      // benefits wizard would still pre-populate a stale R2 background on refresh.
      // Merge with the store's current userSetup so no other fields are lost.
      if (!data.backgroundImage) {
        try {
          const { saveStepDataToServer: saveUserSetup } =
            useOnboardingWizardStore.getState();
          const currentUserSetup = {
            ...(useOnboardingWizardStore.getState().stepData?.userSetup || {}),
            ...userSetupForm.getValues(),
            backgroundImage: "",
            backgroundFileName: "",
          };
          await saveUserSetup("userSetup", currentUserSetup);
        } catch (setupError) {
          console.error("Error clearing userSetup background:", setupError);
        }
      }

      // Same rationale as the userSetup sync above: without this the store keeps the
      // pre-save logo and the tab re-population effect resurrects it.
      try {
        const { saveStepDataLocally } = useOnboardingWizardStore.getState();
        const localBranding =
          useOnboardingWizardStore.getState().stepData?.branding || {};
        await saveStepDataLocally("branding", {
          ...localBranding,
          ...brandingPayload,
        });
      } catch (localError) {
        console.warn("Failed to sync branding to the wizard store", localError);
      }

      await refreshProfile();
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

      // Written to the canonical `User` row via /api/profile, NOT to
      // `wizardSessions[0]`. The previous implementation used
      // `saveStepDataToServer("clientProfile" / "teamSize")`, which stored an
      // organization-level setting inside ONE advisor's onboarding draft: invisible to the
      // rest of the organization (and to a second admin), and it left `User.organizationType`
      // / `User.customOrganization` / `User.teamSize` stale — the very columns the onboarding
      // wizard copies these into (`wizard-completion.ts`).
      //
      // The route then mirrors them onto the Organization via `syncOrganizationIdentity`, so
      // the tenancy root holds the firm profile too.
      const userId = userProfile?.id || cachedProfile?.id;
      if (!userId) {
        toast.error("Could not identify your account. Reload and try again.");
        return;
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          organizationType: formData.organizationType,
          customOrganization: formData.customOrganization ?? "",
          teamSize: formData.teamSize,
          // Written to `User.primaryServiceCategories` by the same route, which then mirrors the
          // organization-level fields onto the Organization row.
          primaryServiceCategories: formData.primaryServiceCategories ?? [],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.error(body?.error || "Failed to save organization settings");
        return;
      }

      await refreshProfile();
      organizationForm.reset(formData, { keepDirtyValues: false });
      setInitialOrganization(JSON.parse(JSON.stringify(formData)));
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

  // ── Computed dirty state per tab (reactive via watch()) ─────────────────
  const tabDirty = {
    profile: initialUserSetup
      ? JSON.stringify(watchedUserSetup) !== JSON.stringify(initialUserSetup)
      : false,
    branding: initialBranding
      ? JSON.stringify(watchedBranding) !== JSON.stringify(initialBranding)
      : false,
    // Organization now also carries the Disclaimers section, so the tab is
    // dirty when either the organization form or the disclaimers form is.
    organization:
      (initialOrganization
        ? JSON.stringify(watchedOrg) !== JSON.stringify(initialOrganization)
        : false) || teamDirty,
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
        case "organization": {
          // One Save covers both stacked sections, but each is written only when
          // it actually changed — so saving a disclaimer does not also report an
          // "organization updated" toast, and vice versa.
          const orgDirty = initialOrganization
            ? JSON.stringify(organizationForm.getValues()) !==
              JSON.stringify(initialOrganization)
            : false;
          if (disclaimersRef.current?.isDirty()) {
            await disclaimersRef.current.save();
          }
          if (orgDirty) await handleSaveOrganization();
          break;
        }
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
        disclaimersRef.current?.reset();
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
        case "organization": {
          const orgDirty = initialOrganization
            ? JSON.stringify(organizationForm.getValues()) !==
              JSON.stringify(initialOrganization)
            : false;
          if (disclaimersRef.current?.isDirty()) {
            const ok = await disclaimersRef.current.save(true);
            if (ok === false) return; // validation failed — stay on this tab
          }
          if (orgDirty) await handleSaveOrganization();
          break;
        }
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
            organizationEmail:
              userSetup.organizationEmail ||
              initialUserSetup?.organizationEmail ||
              "",
            phone: userSetup.phone || "",
            phoneExtension: userSetup.phoneExtension || "",
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
            isColorPickerOpen: false,
            isGenerating: false,
          });
          break;
        }
        case "organization":
          // Reset to the loaded SERVER values, not to the wizard store. The store is the
          // onboarding draft; resetting from it would resurrect exactly the values this tab
          // now writes past (`wizardSessions[0].clientProfile` / `.teamSize`).
          organizationForm.reset(
            initialOrganization ?? {
              organizationType: "",
              customOrganization: "",
              teamSize: "",
            },
          );
          disclaimersRef.current?.reset();
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

  /**
   * The tab bar's entries, in display order.
   *
   * The bar itself is portalled into the header's `#header-tabs-portal` (see `settingsTabList`
   * below), so the HEADER renders it but this list defines it — which is why the Owner-only
   * decision below lives here rather than in `components/layout/header.tsx`.
   *
   * Billing is `edit` for the Owner and `no_access` for every other role in the teammate permission
   * grid, so the entry is REMOVED for anyone else rather than shown-and-denied: a member is never
   * offered a page they cannot open, and the tab's own content needs no denial branch behind it.
   *
   * Gated on `=== true`, not `!== false`: the flag comes from `/api/profile`, so before it resolves
   * the entry is simply absent. For the Owner that is a brief absence that fills in; `!== false`
   * would instead show a member the tab for that same moment and then take it away.
   *
   * `viewerHidden` marks the organization-level tabs (Branding, Organization) that a Viewer's
   * read-only grid must not open — `org_settings` is `no_access` for a Viewer. They are REMOVED
   * from the bar rather than shown-and-denied, matching how Billing is handled for a non-owner:
   * a member is never offered a page they cannot open.
   */
  const settingsTabs: {
    value: string;
    label: string;
    Icon: LucideIcon;
    dirty: boolean;
    ownerOnly?: boolean;
    viewerHidden?: boolean;
  }[] = [
    {
      value: "profile",
      label: "Profile",
      Icon: User,
      dirty: tabDirty.profile,
    },
    {
      value: "branding",
      label: "Branding",
      Icon: Building2,
      dirty: tabDirty.branding,
      viewerHidden: true,
    },
    {
      value: "organization",
      label: "Organization",
      Icon: Briefcase,
      dirty: tabDirty.organization,
      viewerHidden: true,
    },
    {
      value: "members",
      label: "People & Access",
      Icon: UserPlus,
      dirty: false,
    },
    {
      value: "billing",
      label: "Billing",
      Icon: CreditCard,
      dirty: false,
      ownerOnly: true,
    },
  ];

  // ── The tab bar ─────────────────────────────────────────────────────────
  // Rendered into the fixed header through a portal (see `headerPortalTarget`), so the
  // tabs stay visible while the page scrolls — the same bar Edit Client and Edit Benefit
  // render. The default `TabsList` card is stripped (no border, no background, one line,
  // horizontally scrollable) and the active tab is underlined in accent-blue.
  const settingsTabList = (
    <TabsList
      className={cn(
        "w-full gap-1 rounded-none border-0 bg-transparent dark:bg-transparent p-0 flex-nowrap h-auto min-h-fit overflow-x-auto",
        "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
        // Centring that survives an overflow — the same rule Edit Benefit uses: auto
        // margins centre the strip while it fits and collapse to 0 when it does not, so
        // an overlong strip stays flush with the start and scrolls normally instead of
        // having its first tabs clipped out of reach.
        "[&>*:first-child]:ml-auto [&>*:last-child]:mr-auto",
      )}
    >
      {settingsTabs
        .filter((tab) => !tab.ownerOnly || viewerIsOrganizationOwner === true)
        // A Viewer is read-only, so the organization-level tabs are removed rather than denied.
        .filter((tab) => !(tab.viewerHidden && readOnlyViewer))
        .map(({ value, label, Icon, dirty }) => (
        <TabsTrigger
          key={value}
          value={value}
          className="relative flex items-center gap-2 rounded-none px-4 py-3 text-sm font-medium whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-accent-blue data-[state=active]:font-bold data-[state=active]:text-accent-blue"
        >
          <Icon className="h-4 w-4" />
          {label}
          {dirty && (
            // Inset rather than hanging outside the trigger: the strip is a horizontal
            // scroll container, so a dot at `-top-1 -right-1` would fall outside its
            // clip box.
            <Circle className="absolute right-1 top-1 h-2 w-2 fill-amber-500 text-amber-500" />
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );

  // ── Save handler for sections (kept for compatibility but unused by UI) ─
  const noopSave = async () => {};

  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-screen max-w-4xl mx-auto py-6 pb-28">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          {/* The tab bar renders inside the fixed header via portal; it falls back to
              an inline bar if the header's portal target is not mounted yet (e.g. the
              very first client render), so the tabs are never missing. */}
          {headerPortalTarget
            ? createPortal(settingsTabList, headerPortalTarget)
            : settingsTabList}

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <ProfileSettingsSection
              isLoading={isLoading}
              isSaving={isSaving}
              userSetupForm={userSetupForm}
              onSave={noopSave}
              authProvider={userProfile?.provider}
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
                        // Always reopen locked, even if the phrase was typed on a previous visit.
                        setDeleteConfirmText("");
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

          {/* Organization Tab — also carries the Disclaimers section. The old
              Disclaimers tab was folded in here so every organization-level
              setting shares one tab and one Save. */}
          <TabsContent value="organization" className="space-y-6">
            <OrganizationSettingsSection
              isLoading={isLoading}
              isSaving={isSaving}
              organizationForm={organizationForm}
              onSave={noopSave}
            />

            <TeamAndDisclaimersSection
              isLoading={isLoading}
              disclaimersRef={disclaimersRef}
              onDisclaimersDirtyChange={setTeamDirty}
            />
          </TabsContent>

          {/* People & Access Tab — the tab's value stays "members" so existing links
              and the size-5 grid above keep working; only the label changed.

              Once opened, `forceMount` keeps the section mounted so its own roster fetch runs once
              rather than on every return to the tab (Radix unmounts an inactive TabsContent by
              default). `data-[state=inactive]:hidden` replaces the unmount — without it a
              force-mounted panel stays visible underneath the active one. */}
          <TabsContent
            value="members"
            forceMount={membersTabOpened ? true : undefined}
            className="space-y-6 data-[state=inactive]:hidden"
          >
            <TeamMembersSection viewerReadOnly={readOnlyViewer} />
          </TabsContent>

          {/* Billing Tab — a "coming soon" placeholder, reachable by the Owner only.
              Its tab entry is filtered out of `settingsTabs` for every other role, so there is no
              denial branch here: the permission boundary IS the missing tab, and a member is never
              offered this page in the first place.

              Nothing is wired up behind it yet — no payment provider, no invoices and no
              subscription model, and `/api/organization` exposes `seatsIncluded` / `planTier` as
              "read-only until a billing surface exists" — so the tab says so rather than rendering
              an empty panel that reads as broken. */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader className="border-b">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-accent-blue" />
                      Billing
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="border-accent-blue text-accent-blue"
                    >
                      Coming Soon
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">
                    Manage your organization&rsquo;s subscription, seats and payment details.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-blue-light">
                  <CreditCard className="h-6 w-6 text-accent-blue" />
                </div>
                <p className="max-w-md text-sm text-muted-foreground">
                  Billing isn&rsquo;t available yet. Seats, invoices and payment details will live
                  here — there is nothing to set up in the meantime, and it will be switched on for
                  your organization when it&rsquo;s ready.
                </p>
              </CardContent>
            </Card>
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
            // Clear the typed phrase on every close, so a reopen starts locked again
            // instead of leaving the button already unlocked.
            setDeleteConfirmText("");
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

              {/* Type-to-confirm gate: the confirm button stays locked until the phrase
                  below is typed. Radix's AlertDialog ignores Escape and outside clicks, so
                  the answer is explicit — and typing the phrase is what stops a stray click
                  from deleting the whole account. */}
              <div className="mt-4 space-y-1.5">
                <Label
                  htmlFor="delete-profile-confirm"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Type{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {DELETE_PROFILE_PHRASE}
                  </span>{" "}
                  to confirm
                </Label>
                <Input
                  id="delete-profile-confirm"
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter must not submit the dialog while the gate is still locked.
                    if (event.key === "Enter" && !isDeleteProfileConfirmed) {
                      event.preventDefault();
                    }
                  }}
                  placeholder={DELETE_PROFILE_PHRASE}
                  autoComplete="off"
                  disabled={isDeleting}
                />
              </div>

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
                  // Locked until the phrase is typed — see the gate above the footer.
                  disabled={isDeleting || !isDeleteProfileConfirmed}
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
