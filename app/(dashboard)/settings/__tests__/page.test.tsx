import React from "react";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "../page";

/**
 * Settings page orchestration.
 *
 * The child sections are stubbed with the real react-hook-form instance the
 * page passes down, so edits go through the production dirty-tracking and save
 * paths. Everything network-facing (SWR, profile fetch, route handlers) and the
 * sections themselves are mocked.
 */

const mocks = vi.hoisted(() => {
  const makeStore = () => ({
    stepData: {} as any,
    saveStepDataToServer: vi.fn(async () => true),
    saveStepDataLocally: vi.fn(async () => undefined),
  });

  return {
    store: makeStore(),
    cachedProfile: null as any,
    isCollaborator: false,
    mutateProfile: vi.fn(async () => undefined),
    fetchProfileOnce: vi.fn(),
    invalidateProfileCache: vi.fn(),
    setTitle: vi.fn(),
    setSubtitle: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
    fetch: vi.fn(),
    redirectToSignIn: vi.fn(),
    disclaimers: {
      isDirty: false,
      saveResult: true,
      save: vi.fn(),
      reset: vi.fn(),
    },
    deleteImpact: null as any,
    impactOk: true,
    deleteOk: true,
    transferred: false,
    profileWriteOk: true,
  };
});

// ── Page boundaries ────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("swr", () => ({
  default: () => ({ data: mocks.cachedProfile, mutate: mocks.mutateProfile }),
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    title: "",
    setTitle: mocks.setTitle,
    subtitle: "",
    setSubtitle: mocks.setSubtitle,
  }),
}));

vi.mock("@/hooks/useViewerAccess", () => ({
  useViewerAccess: () => ({ isCollaborator: mocks.isCollaborator }),
}));

vi.mock("@/lib/onboarding-wizard-store", () => {
  const useOnboardingWizardStore = () => ({ stepData: mocks.store.stepData });
  useOnboardingWizardStore.getState = () => ({
    stepData: mocks.store.stepData,
    saveStepDataToServer: mocks.store.saveStepDataToServer,
    saveStepDataLocally: mocks.store.saveStepDataLocally,
  });
  return { useOnboardingWizardStore };
});

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: mocks.fetchProfileOnce,
  invalidateProfileCache: mocks.invalidateProfileCache,
}));

vi.mock("@/lib/redirect-to-signin", () => ({
  redirectToSignIn: mocks.redirectToSignIn,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

// ── Sections ───────────────────────────────────────────────────────────────
vi.mock("@/components/pages/settings/profile-settings-section", () => ({
  ProfileSettingsSection: ({
    userSetupForm,
    isLoading,
    isSaving,
    authProvider,
    hideDesignations,
  }: any) => {
    const values = userSetupForm.watch();
    return (
      <div
        data-testid="profile-section"
        data-loading={String(isLoading)}
        data-saving={String(isSaving)}
        data-auth-provider={authProvider ?? ""}
        data-hide-designations={String(Boolean(hideDesignations))}
        data-save-as-contact={String(values.saveAsContact)}
      >
        <span data-testid="profile-name">{values.name}</span>
        <span data-testid="profile-email">{values.email}</span>
        <span data-testid="profile-org-email">{values.organizationEmail}</span>
        <span data-testid="profile-phone">{values.phone}</span>
        <span data-testid="profile-title">{values.title}</span>
        <span data-testid="profile-designations">
          {(values.designations ?? []).join(",")}
        </span>
        <span data-testid="profile-headshot">{values.headshot}</span>
        <button
          type="button"
          onClick={() =>
            userSetupForm.setValue("name", "Edited Name", { shouldDirty: true })
          }
        >
          edit-profile-name
        </button>
        <button
          type="button"
          onClick={() =>
            userSetupForm.setValue("organizationEmail", "", {
              shouldDirty: true,
            })
          }
        >
          clear-org-email
        </button>
        <button
          type="button"
          onClick={() =>
            userSetupForm.setValue("organizationEmail", "bad", {
              shouldDirty: true,
            })
          }
        >
          bad-org-email
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/pages/settings/branding-settings-section", () => ({
  BrandingSettingsSection: ({
    brandingForm,
    isLoading,
    isSaving,
    formKey,
  }: any) => {
    const values = brandingForm.watch();
    return (
      <div
        data-testid="branding-section"
        data-loading={String(isLoading)}
        data-saving={String(isSaving)}
        data-form-key={String(formKey)}
      >
        <span data-testid="branding-org-name">{values.organizationName}</span>
        <span data-testid="branding-website">{values.website}</span>
        <span data-testid="branding-logo">{values.logo}</span>
        <span data-testid="branding-primary">{values.primaryColor}</span>
        <span data-testid="branding-secondary">{values.secondaryColor}</span>
        <span data-testid="branding-mission">{values.missionStatement}</span>
        <span data-testid="branding-background">{values.backgroundImage}</span>
        <span data-testid="branding-avatar">{values.aiAvatar}</span>
        <button
          type="button"
          onClick={() =>
            brandingForm.setValue("organizationName", "Edited Brand", {
              shouldDirty: true,
            })
          }
        >
          edit-branding-name
        </button>
        <button
          type="button"
          onClick={() =>
            brandingForm.setValue("backgroundImage", "", {
              shouldDirty: true,
            })
          }
        >
          clear-background
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/pages/settings/organization-settings-section", () => ({
  OrganizationSettingsSection: ({
    organizationForm,
    isLoading,
    isSaving,
  }: any) => {
    const values = organizationForm.watch();
    return (
      <div
        data-testid="organization-section"
        data-loading={String(isLoading)}
        data-saving={String(isSaving)}
      >
        <span data-testid="org-type">{values.organizationType}</span>
        <span data-testid="org-custom">{values.customOrganization}</span>
        <span data-testid="org-team-size">{values.teamSize}</span>
        <span data-testid="org-categories">
          {(values.primaryServiceCategories ?? []).join(",")}
        </span>
        <button
          type="button"
          onClick={() =>
            organizationForm.setValue("teamSize", "team-10", {
              shouldDirty: true,
            })
          }
        >
          edit-team-size
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/pages/settings/team-and-disclaimers-section", () => ({
  // The page passes `disclaimersRef` as a PROP (the real section forwards it to
  // its disclosures editor), not as a component ref.
  TeamAndDisclaimersSection: ({
    disclaimersRef,
    onDisclaimersDirtyChange,
  }: any) => {
    React.useImperativeHandle(disclaimersRef, () => ({
      isDirty: () => mocks.disclaimers.isDirty,
      save: async (validate?: boolean) => {
        await mocks.disclaimers.save(validate);
        if (mocks.disclaimers.saveResult) mocks.disclaimers.isDirty = false;
        return mocks.disclaimers.saveResult;
      },
      reset: () => {
        mocks.disclaimers.reset();
        mocks.disclaimers.isDirty = false;
      },
    }));

    return (
      <div data-testid="team-disclaimers">
        <button
          type="button"
          onClick={() => {
            mocks.disclaimers.isDirty = true;
            onDisclaimersDirtyChange?.(true);
          }}
        >
          make-disclaimers-dirty
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/pages/settings/team-members-section", () => ({
  TeamMembersSection: () => (
    <div data-testid="team-members-section">Team roster</div>
  ),
}));

vi.mock("@/components/settings/ownership-successor-dialog", () => ({
  OwnershipSuccessorDialog: ({
    open,
    organizationName,
    successors,
    onConfirm,
  }: any) =>
    open ? (
      <div data-testid="successor-dialog">
        <span data-testid="successor-org">{organizationName}</span>
        {successors.map((person: any) => (
          <span key={person.profileId} data-testid="successor-name">
            {person.name}
          </span>
        ))}
        <button
          type="button"
          onClick={() => onConfirm(successors[0]?.profileId)}
        >
          confirm-successor
        </button>
      </div>
    ) : null,
}));

// ── Helpers ────────────────────────────────────────────────────────────────
type JsonResponse = { ok: boolean; json: () => Promise<unknown> };

function json(body: unknown = {}, ok = true): JsonResponse {
  return { ok, json: async () => body };
}

function defaultImpact(overrides: Record<string, unknown> = {}) {
  return {
    ownsOrganization: false,
    organizationId: null,
    organizationName: null,
    plans: 0,
    teamMembers: 0,
    collaborators: 0,
    successors: [],
    ...overrides,
  };
}

function fetchCalls(path: string) {
  return mocks.fetch.mock.calls.filter(([url]) => String(url) === path);
}

function deletionCalls() {
  return mocks.fetch.mock.calls.filter(([url]) => {
    const value = String(url);
    return (
      value === "/api/profile/delete" ||
      value.startsWith("/api/profile/delete?")
    );
  });
}

function fetchCall(path: string, method: string) {
  return fetchCalls(path).find(
    ([, init]) => (init as RequestInit | undefined)?.method === method,
  );
}

function bodyOf(call: unknown[] | undefined) {
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body));
}

/**
 * The delete flow schedules a 3-second redirect to /signin. Let `waitFor`'s
 * short timers through, but swallow that one so jsdom does not attempt the
 * navigation while assertions are still running.
 */
function suppressRedirectTimer() {
  const realSetTimeout = globalThis.setTimeout;
  return vi
    .spyOn(globalThis, "setTimeout")
    .mockImplementation(((
      callback: (...args: any[]) => void,
      delay?: number,
      ...args: any[]
    ) =>
      (delay ?? 0) >= 3000
        ? 0
        : realSetTimeout(callback, delay, ...args)) as any);
}

/**
 * Like `suppressRedirectTimer`, but keeps the 3-second callbacks so a test can
 * run the redirect itself after asserting the success screen.
 */
function captureRedirectTimer() {
  const realSetTimeout = globalThis.setTimeout;
  const callbacks: Array<() => void> = [];
  const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: (...args: any[]) => void,
    delay?: number,
    ...args: any[]
  ) => {
    if ((delay ?? 0) >= 3000) {
      callbacks.push(() => callback(...args));
      return 0;
    }
    return realSetTimeout(callback, delay, ...args);
  }) as any);
  return {
    callbacks,
    restore: () => spy.mockRestore(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderLoaded() {
  const view = render(<SettingsPage />);
  // The Organization panel is force-mounted on every tab, so it is the one
  // section that can report the page's loading state regardless of the tab.
  await waitFor(() =>
    expect(screen.getByTestId("organization-section")).toHaveAttribute(
      "data-loading",
      "false",
    ),
  );
  return view;
}

async function openTab(name: string | RegExp) {
  await userEvent.click(screen.getByRole("tab", { name }));
}

function tab(name: string | RegExp) {
  return screen.getByRole("tab", { name });
}

function saveBar() {
  return screen.queryByText("You have unsaved changes");
}

async function openDeleteDialog() {
  await userEvent.click(
    screen.getByRole("button", { name: /Delete My Profile/i }),
  );
  return screen.getByPlaceholderText("delete profile");
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.store.stepData = {
    userSetup: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      organizationEmail: "firm@acme.com",
      phone: "555-0100",
      title: "Advisor",
      designations: ["CFP"],
      saveAsContact: true,
    },
  };

  mocks.cachedProfile = {
    id: "user-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    provider: "credentials",
    organizationName: "Acme Advisors",
    organizationType: "ria",
    primaryServiceCategories: ["Retirement"],
    organization: {
      viewerIsOwner: true,
      organizationEmail: "hello@acme.com",
    },
    wizardSessions: [],
    seat: null,
  };

  mocks.isCollaborator = false;
  mocks.disclaimers.isDirty = false;
  mocks.disclaimers.saveResult = true;

  // Implementations can be overridden per test; restore the happy path here.
  mocks.store.saveStepDataToServer.mockReset();
  mocks.store.saveStepDataToServer.mockResolvedValue(true);
  mocks.store.saveStepDataLocally.mockReset();
  mocks.store.saveStepDataLocally.mockResolvedValue(undefined);
  mocks.mutateProfile.mockReset();
  mocks.mutateProfile.mockResolvedValue(undefined);
  mocks.fetchProfileOnce.mockReset();
  mocks.disclaimers.save.mockReset();
  mocks.disclaimers.reset.mockReset();

  mocks.deleteImpact = defaultImpact();
  mocks.impactOk = true;
  mocks.deleteOk = true;
  mocks.transferred = false;
  mocks.profileWriteOk = true;

  mocks.fetchProfileOnce.mockResolvedValue(mocks.cachedProfile);
  mocks.fetch.mockImplementation(async (url: unknown) => {
    const value = String(url);
    if (value === "/api/profile/delete-impact") {
      return mocks.impactOk
        ? json(mocks.deleteImpact)
        : json({ error: "nope" }, false);
    }
    if (value.startsWith("/api/profile/delete")) {
      return mocks.deleteOk
        ? json({ organization: { transferred: mocks.transferred } })
        : json({ error: "nope" }, false);
    }
    if (value === "/api/profile" || value === "/api/profile/update-profile") {
      return mocks.profileWriteOk ? json({}) : json({ error: "Nope" }, false);
    }
    return json({});
  });

  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById("header-tabs-portal")?.remove();
  window.history.pushState({}, "", "/settings");
});

// ══════════════════════════════════════════════════════════════════════════
describe("Settings page shell", () => {
  it("sets the page title and the organization subtitle", async () => {
    render(<SettingsPage />);

    expect(mocks.setTitle).toHaveBeenCalledWith("Settings");
    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenLastCalledWith("Acme Advisors"),
    );
  });

  it("prefers the wizard branding organization name for the subtitle", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      wizardSessions: [{ branding: { organizationName: "Branding Co" } }],
    };

    await renderLoaded();

    expect(mocks.setSubtitle).toHaveBeenLastCalledWith("Branding Co");
  });

  it("uses the organization source name for a teammate", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      organizationName: "",
      organizationType: "",
      organization: {
        viewerIsOwner: false,
        source: { organizationName: "Teammate Org" },
      },
    };

    await renderLoaded();

    expect(mocks.setSubtitle).toHaveBeenLastCalledWith("Teammate Org");
  });

  it("falls back to the organization type and clears the subtitle on unmount", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      organizationName: "",
      organizationType: "ria",
    };

    const { unmount } = await renderLoaded();

    expect(mocks.setSubtitle).toHaveBeenLastCalledWith("ria");

    unmount();

    expect(mocks.setSubtitle).toHaveBeenLastCalledWith("");
  });

  it("renders all five tabs for an organization owner", async () => {
    await renderLoaded();

    expect(tab("Profile")).toHaveAttribute("aria-selected", "true");
    expect(tab("Branding")).toBeInTheDocument();
    expect(tab("Organization")).toBeInTheDocument();
    expect(tab("People & Access")).toBeInTheDocument();
    expect(tab("Billing")).toBeInTheDocument();
  });

  it("hides Billing for a non-owner", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      organization: { viewerIsOwner: false },
    };

    await renderLoaded();

    expect(
      screen.queryByRole("tab", { name: /Billing/ }),
    ).not.toBeInTheDocument();
  });

  it("hides Billing until ownership resolves", async () => {
    mocks.cachedProfile = { ...mocks.cachedProfile, organization: {} };

    await renderLoaded();

    expect(
      screen.queryByRole("tab", { name: /Billing/ }),
    ).not.toBeInTheDocument();
  });

  it("hides organization-level tabs for a read-only viewer and returns to Profile", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      organization: {},
      seat: { role: "viewer" },
    };
    window.history.pushState({}, "", "/settings?tab=branding");

    await renderLoaded();

    expect(
      screen.queryByRole("tab", { name: "Branding" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Organization" }),
    ).not.toBeInTheDocument();
    expect(tab("Profile")).toHaveAttribute("aria-selected", "true");
  });

  it("gives a Collaborator a single Profile surface with no tab bar", async () => {
    mocks.isCollaborator = true;

    await renderLoaded();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-section")).toHaveAttribute(
      "data-hide-designations",
      "true",
    );
  });

  it("ignores a deep link to another tab for a Collaborator", async () => {
    mocks.isCollaborator = true;
    window.history.pushState({}, "", "/settings?tab=members");

    await renderLoaded();

    expect(
      screen.queryByTestId("team-members-section"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-section")).toBeInTheDocument();
  });

  it("opens People & Access from a ?tab=members deep link", async () => {
    window.history.pushState({}, "", "/settings?tab=members");

    await renderLoaded();

    expect(tab("People & Access")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("team-members-section")).toBeInTheDocument();
  });

  it("ignores an unknown tab deep link", async () => {
    window.history.pushState({}, "", "/settings?tab=nope");

    await renderLoaded();

    expect(tab("Profile")).toHaveAttribute("aria-selected", "true");
  });

  it("shows the loading state until the profile resolves", async () => {
    mocks.cachedProfile = null;
    mocks.store.stepData = {};
    let resolveProfile: (value: unknown) => void = () => {};
    mocks.fetchProfileOnce.mockImplementation(
      () => new Promise((resolve) => (resolveProfile = resolve)),
    );

    render(<SettingsPage />);

    expect(screen.getByTestId("profile-section")).toHaveAttribute(
      "data-loading",
      "true",
    );

    resolveProfile({
      id: "user-1",
      name: "Loaded Later",
      email: "later@example.com",
      organization: {},
      wizardSessions: [],
    });

    await waitFor(() =>
      expect(screen.getByTestId("profile-section")).toHaveAttribute(
        "data-loading",
        "false",
      ),
    );
    expect(screen.getByTestId("profile-name")).toHaveTextContent(
      "Loaded Later",
    );
  });

  it("toasts when the profile cannot be loaded", async () => {
    mocks.cachedProfile = null;
    mocks.store.stepData = {};
    mocks.fetchProfileOnce.mockRejectedValue(new Error("offline"));

    render(<SettingsPage />);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to load settings data",
      ),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Profile section", () => {
  it("populates from the wizard session and forwards the auth provider", async () => {
    mocks.store.stepData = {};
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      provider: "google",
      wizardSessions: [
        {
          userSetup: {
            name: "Wizard Name",
            email: "wizard@example.com",
            organizationEmail: "wizard-firm@example.com",
            phone: "111",
            saveAsContact: true,
          },
        },
      ],
    };

    await renderLoaded();

    await waitFor(() =>
      expect(screen.getByTestId("profile-name")).toHaveTextContent(
        "Wizard Name",
      ),
    );
    expect(screen.getByTestId("profile-email")).toHaveTextContent(
      "wizard@example.com",
    );
    expect(screen.getByTestId("profile-org-email")).toHaveTextContent(
      "wizard-firm@example.com",
    );
    expect(screen.getByTestId("profile-section")).toHaveAttribute(
      "data-auth-provider",
      "google",
    );
  });

  it("falls back to the invited seat for phone, title, designations, and photo", async () => {
    mocks.store.stepData = {};
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      wizardSessions: [],
      seat: {
        phone: "222-3333",
        jobTitle: "Planner",
        designations: ["CFA", "CFP"],
        headshot: "seat-photo",
      },
    };

    await renderLoaded();

    await waitFor(() =>
      expect(screen.getByTestId("profile-phone")).toHaveTextContent("222-3333"),
    );
    expect(screen.getByTestId("profile-title")).toHaveTextContent("Planner");
    expect(screen.getByTestId("profile-designations")).toHaveTextContent(
      "CFA,CFP",
    );
    expect(screen.getByTestId("profile-headshot")).toHaveTextContent(
      "seat-photo",
    );
  });

  it("falls back to the organization's shared email", async () => {
    mocks.store.stepData = {};
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      organizationEmail: "",
      wizardSessions: [],
      organization: {
        viewerIsOwner: true,
        organizationEmail: "shared@acme.com",
      },
    };

    await renderLoaded();

    await waitFor(() =>
      expect(screen.getByTestId("profile-org-email")).toHaveTextContent(
        "shared@acme.com",
      ),
    );
  });

  it("shows the save bar when the profile becomes dirty", async () => {
    await renderLoaded();

    expect(saveBar()).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );

    expect(screen.getByTestId("profile-name")).toHaveTextContent("Edited Name");
    expect(saveBar()).toBeInTheDocument();
  });

  it("saves the profile to the wizard session and the User row", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "User profile updated successfully!",
      ),
    );

    expect(mocks.store.saveStepDataToServer).toHaveBeenCalledWith(
      "userSetup",
      expect.objectContaining({ name: "Edited Name" }),
    );
    expect(bodyOf(fetchCall("/api/profile", "POST"))).toEqual({
      id: "user-1",
      organizationEmail: "firm@acme.com",
      designations: ["CFP"],
    });
    expect(mocks.store.saveStepDataLocally).toHaveBeenCalledWith(
      "userSetup",
      expect.objectContaining({ name: "Edited Name" }),
    );
    expect(mocks.invalidateProfileCache).toHaveBeenCalled();
    expect(mocks.mutateProfile).toHaveBeenCalled();
    await waitFor(() => expect(saveBar()).not.toBeInTheDocument());
  });

  it("requires an organization email before saving", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "clear-org-email" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Organization email is required",
    );
    expect(mocks.store.saveStepDataToServer).not.toHaveBeenCalled();
    expect(fetchCall("/api/profile", "POST")).toBeUndefined();
  });

  it("rejects a malformed organization email", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "bad-org-email" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please enter a valid organization email",
    );
    expect(mocks.store.saveStepDataToServer).not.toHaveBeenCalled();
  });

  it("reports a failed wizard-session save", async () => {
    mocks.store.saveStepDataToServer.mockResolvedValue(false);
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to save user profile",
      ),
    );
  });

  it("still succeeds when the User-row write fails", async () => {
    mocks.profileWriteOk = false;
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "User profile updated successfully!",
      ),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("resets the profile back to the loaded baseline", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByTestId("profile-name")).toHaveTextContent(
      "Ada Lovelace",
    );
    expect(mocks.toastInfo).toHaveBeenCalledWith("Changes reverted");
    expect(saveBar()).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Branding section", () => {
  it("populates from the completed branding session", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      wizardSessions: [
        {
          branding: {
            organizationName: "Brand Co",
            website: "brand.example",
            logo: "logo-key",
            brandColor: "#123456",
            primaryColor: "#111111",
            secondaryColor: "#222222",
            missionStatement: "Our mission",
            backgroundImage: "bg-key",
            aiAvatar: "avatar-key",
          },
        },
      ],
    };

    await renderLoaded();
    await openTab("Branding");

    await waitFor(() =>
      expect(screen.getByTestId("branding-org-name")).toHaveTextContent(
        "Brand Co",
      ),
    );
    expect(screen.getByTestId("branding-website")).toHaveTextContent(
      "brand.example",
    );
    expect(screen.getByTestId("branding-logo")).toHaveTextContent("logo-key");
    expect(screen.getByTestId("branding-primary")).toHaveTextContent("#111111");
    expect(screen.getByTestId("branding-secondary")).toHaveTextContent(
      "#222222",
    );
    expect(screen.getByTestId("branding-mission")).toHaveTextContent(
      "Our mission",
    );
    expect(screen.getByTestId("branding-background")).toHaveTextContent(
      "bg-key",
    );
    expect(screen.getByTestId("branding-avatar")).toHaveTextContent(
      "avatar-key",
    );
  });

  it("falls back to the organization source for a teammate", async () => {
    mocks.store.stepData = {};
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      wizardSessions: [],
      organization: {
        viewerIsOwner: false,
        source: {
          organizationName: "Shared Firm",
          website: "shared.example",
          logo: "shared-logo",
          primaryColor: "#333333",
          secondaryColor: "#444444",
          missionStatement: "Shared mission",
          backgroundImage: "shared-bg",
          aiAvatar: "shared-avatar",
        },
      },
    };

    await renderLoaded();
    await openTab("Branding");

    await waitFor(() =>
      expect(screen.getByTestId("branding-org-name")).toHaveTextContent(
        "Shared Firm",
      ),
    );
    expect(screen.getByTestId("branding-website")).toHaveTextContent(
      "shared.example",
    );
    expect(screen.getByTestId("branding-logo")).toHaveTextContent(
      "shared-logo",
    );
    expect(screen.getByTestId("branding-primary")).toHaveTextContent("#333333");
    expect(screen.getByTestId("branding-secondary")).toHaveTextContent(
      "#444444",
    );
    expect(screen.getByTestId("branding-mission")).toHaveTextContent(
      "Shared mission",
    );
    expect(screen.getByTestId("branding-background")).toHaveTextContent(
      "shared-bg",
    );
    expect(screen.getByTestId("branding-avatar")).toHaveTextContent(
      "shared-avatar",
    );
  });

  it("saves branding to the User row, the wizard session, and the store", async () => {
    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-branding-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Branding settings updated successfully!",
      ),
    );

    expect(bodyOf(fetchCall("/api/profile/update-profile", "POST"))).toEqual({
      advisorLogo: "",
      advisorLogoUrl: "",
      organizationName: "Edited Brand",
      backgroundImage: "",
    });
    expect(mocks.store.saveStepDataToServer).toHaveBeenCalledWith(
      "branding",
      expect.objectContaining({ organizationName: "Edited Brand" }),
    );
    expect(mocks.store.saveStepDataLocally).toHaveBeenCalledWith(
      "branding",
      expect.objectContaining({ organizationName: "Edited Brand" }),
    );
    expect(mocks.invalidateProfileCache).toHaveBeenCalled();
  });

  it("clears the wizard userSetup background when the branding background is removed", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      wizardSessions: [
        {
          branding: { organizationName: "Brand Co", backgroundImage: "bg-key" },
        },
      ],
    };

    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "clear-background" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.store.saveStepDataToServer).toHaveBeenCalledWith(
        "userSetup",
        expect.objectContaining({
          backgroundImage: "",
          backgroundFileName: "",
        }),
      ),
    );
  });

  it("does not rewrite the userSetup background when one is still set", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      wizardSessions: [
        {
          branding: { organizationName: "Brand Co", backgroundImage: "bg-key" },
        },
      ],
    };

    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-branding-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Branding settings updated successfully!",
      ),
    );
    expect(mocks.store.saveStepDataToServer).not.toHaveBeenCalledWith(
      "userSetup",
      expect.anything(),
    );
  });

  it("still saves when the User-row write fails", async () => {
    mocks.profileWriteOk = false;
    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-branding-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Branding settings updated successfully!",
      ),
    );
    expect(mocks.store.saveStepDataToServer).toHaveBeenCalledWith(
      "branding",
      expect.anything(),
    );
  });

  it("still succeeds when the wizard-session branding save fails", async () => {
    mocks.store.saveStepDataToServer.mockResolvedValue(false);
    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-branding-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Branding settings updated successfully!",
      ),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("resets branding edits back to the baseline", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      wizardSessions: [
        { branding: { organizationName: "Brand Co", backgroundImage: "bg" } },
      ],
    };

    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-branding-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByTestId("branding-org-name")).toHaveTextContent(
      "Brand Co",
    );
    expect(mocks.toastInfo).toHaveBeenCalledWith("Changes reverted");
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Organization section", () => {
  it("populates from the canonical User row", async () => {
    await renderLoaded();
    await openTab("Organization");

    expect(screen.getByTestId("org-type")).toHaveTextContent("ria");
    expect(screen.getByTestId("org-team-size")).toHaveTextContent("");
    expect(screen.getByTestId("org-categories")).toHaveTextContent(
      "Retirement",
    );
  });

  it("falls back to the organization source for a teammate", async () => {
    mocks.store.stepData = {};
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      organizationType: "",
      customOrganization: "",
      teamSize: "",
      primaryServiceCategories: [],
      wizardSessions: [],
      organization: {
        viewerIsOwner: false,
        source: {
          organizationType: "other",
          customOrganization: "Family office",
          teamSize: "team-5",
          primaryServiceCategories: ["Group Health"],
        },
      },
    };

    await renderLoaded();
    await openTab("Organization");

    await waitFor(() =>
      expect(screen.getByTestId("org-type")).toHaveTextContent("other"),
    );
    expect(screen.getByTestId("org-custom")).toHaveTextContent("Family office");
    expect(screen.getByTestId("org-team-size")).toHaveTextContent("team-5");
    expect(screen.getByTestId("org-categories")).toHaveTextContent(
      "Group Health",
    );
  });

  it("falls back to the stored onboarding session values", async () => {
    mocks.store.stepData = {};
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      organizationType: "",
      teamSize: "",
      primaryServiceCategories: [],
      organization: {},
      wizardSessions: [
        {
          clientProfile: {
            organizationType: "ria",
            customOrganization: "",
          },
          teamSize: { teamSize: "team-2" },
        },
      ],
    };

    await renderLoaded();
    await openTab("Organization");

    await waitFor(() =>
      expect(screen.getByTestId("org-type")).toHaveTextContent("ria"),
    );
    expect(screen.getByTestId("org-team-size")).toHaveTextContent("team-2");
  });

  it("derives primary service categories from the Step 2 answer", async () => {
    mocks.store.stepData = {
      userSetup: mocks.store.stepData.userSetup,
      services: { services: ["retirement", "group_health"] },
    };
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      primaryServiceCategories: [],
      organization: {},
      wizardSessions: [],
    };

    await renderLoaded();
    await openTab("Organization");

    expect(screen.getByTestId("org-categories")).toHaveTextContent(
      "Retirement,Group Health",
    );
  });

  it("saves the organization to /api/profile and refreshes", async () => {
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Organization settings updated successfully!",
      ),
    );

    expect(bodyOf(fetchCall("/api/profile", "POST"))).toEqual({
      id: "user-1",
      organizationType: "ria",
      customOrganization: "",
      teamSize: "team-10",
      primaryServiceCategories: ["Retirement"],
    });
    expect(mocks.invalidateProfileCache).toHaveBeenCalled();
  });

  it("refuses to save without an account id", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      id: undefined,
    };

    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Could not identify your account. Reload and try again.",
    );
    expect(fetchCall("/api/profile", "POST")).toBeUndefined();
  });

  it("shows the API error when the organization save is rejected", async () => {
    mocks.fetch.mockImplementation(async (url: unknown) => {
      if (String(url) === "/api/profile") return json({ error: "Nope" }, false);
      return json({});
    });

    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Nope"));
  });

  it("shows a generic error when the organization request throws", async () => {
    mocks.fetch.mockImplementation(async (url: unknown) => {
      if (String(url) === "/api/profile") throw new Error("offline");
      return json({});
    });

    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to save organization settings",
      ),
    );
  });

  it("marks the Organization tab dirty when the disclosures section is dirty", async () => {
    await renderLoaded();
    await openTab("Organization");

    expect(saveBar()).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "make-disclaimers-dirty" }),
    );

    expect(saveBar()).toBeInTheDocument();
  });

  it("saves disclosures and organization changes with one Save", async () => {
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "make-disclaimers-dirty" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.disclaimers.save).toHaveBeenCalled());
    expect(mocks.disclaimers.save.mock.calls[0]).toEqual([undefined]);
    expect(bodyOf(fetchCall("/api/profile", "POST"))).toEqual(
      expect.objectContaining({ teamSize: "team-10" }),
    );
  });

  it("saves only disclosures when the organization form is clean", async () => {
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "make-disclaimers-dirty" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.disclaimers.save).toHaveBeenCalled());
    expect(mocks.disclaimers.save.mock.calls[0]).toEqual([undefined]);
    expect(fetchCall("/api/profile", "POST")).toBeUndefined();
  });

  it("resets both the organization form and the disclosures section", async () => {
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "make-disclaimers-dirty" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByTestId("org-team-size")).toHaveTextContent("");
    expect(mocks.disclaimers.reset).toHaveBeenCalled();
    expect(mocks.toastInfo).toHaveBeenCalledWith("Changes reverted");
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Unsaved-changes guard", () => {
  it("switches tabs immediately when nothing is dirty", async () => {
    await renderLoaded();

    await openTab("Branding");

    expect(tab("Branding")).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
  });

  it("prompts before leaving a dirty Profile tab", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await openTab("Branding");

    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    // The modal marks the rest of the page aria-hidden, so assert the retained
    // content rather than querying a role behind the dialog.
    expect(screen.getByTestId("profile-name")).toHaveTextContent("Edited Name");
  });

  it("Cancel keeps the user on the current tab", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await openTab("Branding");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(tab("Profile")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("profile-name")).toHaveTextContent("Edited Name");
  });

  it("Discard reverts the edits and switches tabs", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await openTab("Branding");
    await userEvent.click(
      screen.getByRole("button", { name: "Discard & Leave" }),
    );

    expect(tab("Branding")).toHaveAttribute("aria-selected", "true");
    expect(saveBar()).not.toBeInTheDocument();

    await openTab("Profile");
    expect(screen.getByTestId("profile-name")).toHaveTextContent(
      "Ada Lovelace",
    );
  });

  it("Save & Continue saves the Profile tab before switching", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await openTab("Branding");
    await userEvent.click(
      screen.getByRole("button", { name: "Save & Continue" }),
    );

    await waitFor(() =>
      expect(tab("Branding")).toHaveAttribute("aria-selected", "true"),
    );
    expect(mocks.store.saveStepDataToServer).toHaveBeenCalledWith(
      "userSetup",
      expect.objectContaining({ name: "Edited Name" }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "User profile updated successfully!",
    );
  });

  it("Save & Continue saves Branding before switching", async () => {
    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-branding-name" }),
    );
    await openTab("Profile");
    await userEvent.click(
      screen.getByRole("button", { name: "Save & Continue" }),
    );

    await waitFor(() =>
      expect(tab("Profile")).toHaveAttribute("aria-selected", "true"),
    );
    expect(fetchCall("/api/profile/update-profile", "POST")).toBeDefined();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Branding settings updated successfully!",
    );
  });

  it("Save & Continue validates and saves disclosures, then organization", async () => {
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "make-disclaimers-dirty" }),
    );
    await openTab("Branding");
    await userEvent.click(
      screen.getByRole("button", { name: "Save & Continue" }),
    );

    await waitFor(() =>
      expect(mocks.disclaimers.save).toHaveBeenCalledWith(true),
    );
    expect(bodyOf(fetchCall("/api/profile", "POST"))).toEqual(
      expect.objectContaining({ teamSize: "team-10" }),
    );
    await waitFor(() =>
      expect(tab("Branding")).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("keeps the user on Organization when disclosure validation fails", async () => {
    mocks.disclaimers.saveResult = false;
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "make-disclaimers-dirty" }),
    );
    await openTab("Branding");
    await userEvent.click(
      screen.getByRole("button", { name: "Save & Continue" }),
    );

    await waitFor(() =>
      expect(mocks.disclaimers.save).toHaveBeenCalledWith(true),
    );
    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    expect(screen.getByTestId("org-team-size")).toHaveTextContent("");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(tab("Organization")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the user on Profile when Save & Continue cannot validate it", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "clear-org-email" }),
    );
    await openTab("Branding");
    await userEvent.click(
      screen.getByRole("button", { name: "Save & Continue" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Organization email is required",
      ),
    );
    // Nothing was written, so the dialog stays open and the tab does not move:
    // continuing would have discarded the edit it just failed to save. The modal
    // marks the page aria-hidden, so assert the retained content (the doc's
    // standing rule for this dialog) and query the tab only after Cancel.
    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    // The cleared email is still in the form, so the edit survived the failure.
    expect(screen.getByTestId("profile-org-email").textContent).toBe("");
    expect(saveBar()).toBeInTheDocument();
    expect(mocks.store.saveStepDataToServer).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(tab("Profile")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the user on Organization when Save & Continue is rejected", async () => {
    mocks.profileWriteOk = false;
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await openTab("Branding");
    await userEvent.click(
      screen.getByRole("button", { name: "Save & Continue" }),
    );

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Nope"));
    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    expect(screen.getByTestId("org-team-size")).toHaveTextContent("team-10");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(tab("Organization")).toHaveAttribute("aria-selected", "true");
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("People & Access section", () => {
  it("does not mount the roster until the tab is first opened", async () => {
    await renderLoaded();

    expect(
      screen.queryByTestId("team-members-section"),
    ).not.toBeInTheDocument();
  });

  it("mounts the roster when the tab is opened", async () => {
    await renderLoaded();

    await openTab("People & Access");

    expect(tab("People & Access")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("team-members-section")).toBeInTheDocument();
  });

  it("keeps the roster mounted after leaving the tab", async () => {
    await renderLoaded();

    await openTab("People & Access");
    await openTab("Profile");

    expect(screen.getByTestId("team-members-section")).toBeInTheDocument();
  });

  it("offers no save bar on People & Access", async () => {
    await renderLoaded();

    await openTab("People & Access");

    expect(saveBar()).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Billing section", () => {
  it("shows the coming-soon placeholder for the owner", async () => {
    await renderLoaded();

    await openTab("Billing");

    expect(tab("Billing")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(
      screen.getByText(/Billing isn.t available yet/i),
    ).toBeInTheDocument();
  });

  it("offers no save bar on Billing", async () => {
    await renderLoaded();

    await openTab("Billing");

    expect(saveBar()).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Delete Profile", () => {
  it("keeps the confirm button locked until the phrase is typed", async () => {
    await renderLoaded();

    const input = await openDeleteDialog();
    const confirm = screen.getByRole("button", {
      name: "Yes, Delete My Profile",
    });

    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "delete" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "  Delete Profile  " } });
    expect(confirm).toBeEnabled();
  });

  it("refuses to delete when the impact check fails", async () => {
    mocks.impactOk = false;
    await renderLoaded();

    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Could not check your organization. Nothing was deleted — please try again.",
      ),
    );
    expect(fetchCall("/api/profile/delete", "DELETE")).toBeUndefined();
    expect(screen.getByText("Delete Your Profile?")).toBeInTheDocument();
  });

  it("deletes a non-owner immediately", async () => {
    const timeout = suppressRedirectTimer();
    await renderLoaded();

    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Successfully Deleted Profile"),
      ).toBeInTheDocument(),
    );
    const call = fetchCalls("/api/profile/delete")[0];
    expect((call?.[1] as RequestInit)?.method).toBe("DELETE");
    timeout.mockRestore();
  });

  it("offers the successor picker to an owner and transfers the organization", async () => {
    const timeout = suppressRedirectTimer();
    mocks.deleteImpact = defaultImpact({
      ownsOrganization: true,
      organizationId: "org-1",
      organizationName: "Acme Advisors",
      plans: 3,
      teamMembers: 2,
      collaborators: 1,
      successors: [
        {
          profileId: "profile-1",
          userId: "user-2",
          name: "Bob Builder",
          email: "bob@example.com",
          headshot: null,
          role: "admin",
        },
      ],
    });
    mocks.transferred = true;

    await renderLoaded();

    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("successor-dialog")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("successor-org")).toHaveTextContent(
      "Acme Advisors",
    );
    expect(screen.getByTestId("successor-name")).toHaveTextContent(
      "Bob Builder",
    );

    fireEvent.click(screen.getByRole("button", { name: "confirm-successor" }));

    await waitFor(() =>
      expect(
        screen.getByText("Profile Deleted — Organization Handed Over"),
      ).toBeInTheDocument(),
    );
    const call = mocks.fetch.mock.calls.find(([url]) =>
      String(url).startsWith("/api/profile/delete?"),
    );
    expect(String(call?.[0])).toContain("transferTo=profile-1");
    expect(
      screen.getByText(/Bob Builder is now the owner of Acme Advisors/),
    ).toBeInTheDocument();
    timeout.mockRestore();
  });

  it("warns an owner without successors and sends the acknowledgement", async () => {
    const timeout = suppressRedirectTimer();
    mocks.deleteImpact = defaultImpact({
      ownsOrganization: true,
      organizationId: "org-1",
      organizationName: "Acme Advisors",
      plans: 2,
      teamMembers: 3,
      collaborators: 1,
      successors: [],
    });

    await renderLoaded();

    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(screen.getByText(/Nobody can take over/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/2 plans and every document/)).toBeInTheDocument();
    expect(
      screen.getByText(/3 team members and 1 collaborator/),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete everything and my profile",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Successfully Deleted Profile"),
      ).toBeInTheDocument(),
    );
    const call = mocks.fetch.mock.calls.find(([url]) =>
      String(url).startsWith("/api/profile/delete?"),
    );
    expect(String(call?.[0])).toContain("confirmOrganization=true");
    timeout.mockRestore();
  });

  it("uses the empty-organization wording when there is nothing to lose", async () => {
    const timeout = suppressRedirectTimer();
    mocks.deleteImpact = defaultImpact({
      ownsOrganization: true,
      organizationId: "org-1",
      organizationName: "Empty Org",
      plans: 0,
      teamMembers: 0,
      collaborators: 0,
      successors: [],
    });

    await renderLoaded();

    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/there is nothing in it yet/),
      ).toBeInTheDocument(),
    );
    timeout.mockRestore();
  });

  it("reports a failed deletion and unlocks the dialog", async () => {
    mocks.deleteOk = false;
    await renderLoaded();

    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to delete profile. nope",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    ).toBeEnabled();
  });

  it("clears the typed phrase when the dialog is cancelled", async () => {
    await renderLoaded();

    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await userEvent.click(
      screen.getByRole("button", { name: /Delete My Profile/i }),
    );

    const reopened = screen.getByPlaceholderText("delete profile");
    expect(reopened).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    ).toBeDisabled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Settings page edge cases", () => {
  it("portals the tab bar into the header and still switches tabs", async () => {
    const portal = document.createElement("div");
    portal.id = "header-tabs-portal";
    document.body.appendChild(portal);

    await renderLoaded();

    expect(portal.querySelector('[role="tablist"]')).not.toBeNull();

    await openTab("Branding");

    expect(tab("Branding")).toHaveAttribute("aria-selected", "true");
  });

  it("loads a non-profile tab once and reuses it when revisited", async () => {
    await renderLoaded();
    await openTab("Branding");

    const firstKey = screen
      .getByTestId("branding-section")
      .getAttribute("data-form-key");

    await openTab("Profile");
    await openTab("Branding");

    expect(screen.getByTestId("branding-section")).toHaveAttribute(
      "data-form-key",
      firstKey,
    );
  });

  it("toasts when a non-profile tab cannot load", async () => {
    window.history.pushState({}, "", "/settings?tab=branding");
    mocks.cachedProfile = null;
    mocks.fetchProfileOnce.mockRejectedValue(new Error("offline"));

    render(<SettingsPage />);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to load settings data",
      ),
    );
    expect(tab("Branding")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("branding-section")).toHaveAttribute(
      "data-loading",
      "false",
    );
  });

  it("saves the profile without a User-row id", async () => {
    mocks.cachedProfile = { ...mocks.cachedProfile, id: undefined };
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "User profile updated successfully!",
      ),
    );
    expect(fetchCall("/api/profile", "POST")).toBeUndefined();
    expect(mocks.store.saveStepDataToServer).toHaveBeenCalled();
  });

  it("still saves the profile when the local store write fails", async () => {
    mocks.store.saveStepDataLocally.mockRejectedValue(new Error("quota"));
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "User profile updated successfully!",
      ),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("still saves branding when the local store write fails", async () => {
    mocks.store.saveStepDataLocally.mockRejectedValue(new Error("quota"));
    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-branding-name" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Branding settings updated successfully!",
      ),
    );
  });

  it("keeps the organization dirty after a rejected save", async () => {
    mocks.profileWriteOk = false;
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Nope"));
    expect(saveBar()).toBeInTheDocument();
    expect(screen.getByTestId("org-team-size")).toHaveTextContent("team-10");
  });

  it("still saves the organization when disclosures return false", async () => {
    mocks.disclaimers.saveResult = false;
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "make-disclaimers-dirty" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(mocks.disclaimers.save).toHaveBeenCalled());
    expect(bodyOf(fetchCall("/api/profile", "POST"))).toEqual(
      expect.objectContaining({ teamSize: "team-10" }),
    );
  });

  it("sends a non-owner away from a billing deep link", async () => {
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      organization: { viewerIsOwner: false },
    };
    window.history.pushState({}, "", "/settings?tab=billing");

    await renderLoaded();

    await waitFor(() =>
      expect(tab("Profile")).toHaveAttribute("aria-selected", "true"),
    );
    expect(screen.queryByText("Coming Soon")).not.toBeInTheDocument();
  });

  it("keeps the owner on a billing deep link", async () => {
    window.history.pushState({}, "", "/settings?tab=billing");

    await renderLoaded();

    await waitFor(() =>
      expect(tab("Billing")).toHaveAttribute("aria-selected", "true"),
    );
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("does not leave a profile-less visitor on billing", async () => {
    mocks.cachedProfile = null;
    window.history.pushState({}, "", "/settings?tab=billing");

    await renderLoaded();

    expect(tab("Profile")).toHaveAttribute("aria-selected", "true");
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Settings page in-flight states", () => {
  it("shows Checking while the delete impact loads", async () => {
    const timer = suppressRedirectTimer();
    const impact = deferred<JsonResponse>();
    mocks.fetch.mockImplementation((url: unknown) => {
      if (String(url) === "/api/profile/delete-impact") return impact.promise;
      return Promise.resolve(json({}));
    });

    await renderLoaded();
    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    expect(screen.getByRole("button", { name: "Checking..." })).toBeDisabled();

    await act(async () => {
      impact.resolve(json(defaultImpact()));
    });

    await waitFor(() =>
      expect(
        screen.getByText("Successfully Deleted Profile"),
      ).toBeInTheDocument(),
    );
    timer.mockRestore();
  });

  it("disables the delete dialog while the deletion runs", async () => {
    const timer = suppressRedirectTimer();
    const deletion = deferred<JsonResponse>();
    mocks.fetch.mockImplementation((url: unknown) => {
      const value = String(url);
      if (value === "/api/profile/delete-impact") {
        return Promise.resolve(json(defaultImpact()));
      }
      if (value.startsWith("/api/profile/delete")) return deletion.promise;
      return Promise.resolve(json({}));
    });

    await renderLoaded();
    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Deleting..." }),
      ).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByPlaceholderText("delete profile")).toBeDisabled();

    await act(async () => {
      deletion.resolve(json({ organization: { transferred: false } }));
    });

    await waitFor(() =>
      expect(
        screen.getByText("Successfully Deleted Profile"),
      ).toBeInTheDocument(),
    );
    timer.mockRestore();
  });

  it("reports a thrown impact request", async () => {
    mocks.fetch.mockImplementation((url: unknown) => {
      if (String(url) === "/api/profile/delete-impact") {
        return Promise.reject(new Error("offline"));
      }
      return Promise.resolve(json({}));
    });

    await renderLoaded();
    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Could not check your organization. Nothing was deleted — please try again.",
      ),
    );
    expect(fetchCalls("/api/profile/delete-impact")).toHaveLength(1);
    expect(deletionCalls()).toHaveLength(0);
  });

  it("reports a thrown delete request and unlocks the dialog", async () => {
    mocks.fetch.mockImplementation((url: unknown) => {
      const value = String(url);
      if (value === "/api/profile/delete-impact") {
        return Promise.resolve(json(defaultImpact()));
      }
      if (value.startsWith("/api/profile/delete")) {
        return Promise.reject(new Error("network down"));
      }
      return Promise.resolve(json({}));
    });

    await renderLoaded();
    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to delete profile. network down",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    ).toBeEnabled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Delete Profile edge cases", () => {
  it("uses singular counts in the owner warning", async () => {
    mocks.deleteImpact = defaultImpact({
      ownsOrganization: true,
      organizationId: "org-1",
      organizationName: "Tiny Org",
      plans: 1,
      teamMembers: 1,
      collaborators: 1,
      successors: [],
    });

    await renderLoaded();
    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(screen.getByText(/Nobody can take over/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/1 plan and every document/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 team member and 1 collaborator/),
    ).toBeInTheDocument();
  });

  it("blocks Enter while the confirmation phrase is incomplete", async () => {
    await renderLoaded();
    const input = await openDeleteDialog();

    fireEvent.change(input, { target: { value: "delete" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(fetchCalls("/api/profile/delete-impact")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    ).toBeDisabled();
  });

  it("redirects to sign-in three seconds after a successful delete", async () => {
    const timer = captureRedirectTimer();

    await renderLoaded();
    const input = await openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete profile" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, Delete My Profile" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Successfully Deleted Profile"),
      ).toBeInTheDocument(),
    );
    expect(timer.callbacks).toHaveLength(1);
    expect(mocks.redirectToSignIn).not.toHaveBeenCalled();

    act(() => timer.callbacks[0]());

    expect(mocks.redirectToSignIn).toHaveBeenCalledTimes(1);
    timer.restore();
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("Unsaved-changes edge cases", () => {
  it("Discard restores Branding to the loaded baseline", async () => {
    mocks.store.stepData.branding = { organizationName: "Brand Co" };
    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-branding-name" }),
    );
    await openTab("Profile");
    await userEvent.click(
      screen.getByRole("button", { name: "Discard & Leave" }),
    );

    // Discard leaves the dirty Branding tab for the tab the user asked for.
    expect(tab("Profile")).toHaveAttribute("aria-selected", "true");

    await openTab("Branding");
    expect(screen.getByTestId("branding-org-name")).toHaveTextContent(
      "Brand Co",
    );
  });

  it("Discard keeps the organization's branding for a teammate", async () => {
    mocks.store.stepData = {};
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      wizardSessions: [],
      organization: {
        viewerIsOwner: false,
        source: {
          organizationName: "Org Brand",
          website: "https://org.example",
        },
      },
    };
    await renderLoaded();
    await openTab("Branding");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-branding-name" }),
    );
    await openTab("Profile");
    await userEvent.click(
      screen.getByRole("button", { name: "Discard & Leave" }),
    );
    await openTab("Branding");

    // The tab filled from the organization source, not the store, so a discard
    // has to restore that source rather than blank the fields.
    expect(screen.getByTestId("branding-org-name")).toHaveTextContent(
      "Org Brand",
    );
  });

  it("Discard keeps an invited teammate's seat values on Profile", async () => {
    mocks.store.stepData = {};
    mocks.cachedProfile = {
      ...mocks.cachedProfile,
      wizardSessions: [],
      seat: {
        phone: "222-3333",
        jobTitle: "Planner",
        designations: ["CFA"],
        headshot: "seat-photo",
      },
    };
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "edit-profile-name" }),
    );
    await openTab("Branding");
    await userEvent.click(
      screen.getByRole("button", { name: "Discard & Leave" }),
    );
    await openTab("Profile");

    expect(screen.getByTestId("profile-name")).toHaveTextContent(
      "Ada Lovelace",
    );
    expect(screen.getByTestId("profile-phone")).toHaveTextContent("222-3333");
    expect(screen.getByTestId("profile-title")).toHaveTextContent("Planner");
    expect(screen.getByTestId("profile-designations")).toHaveTextContent("CFA");
    expect(screen.getByTestId("profile-headshot")).toHaveTextContent(
      "seat-photo",
    );
  });

  it("Discard restores Organization and resets disclosures", async () => {
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "edit-team-size" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "make-disclaimers-dirty" }),
    );
    await openTab("Branding");
    await userEvent.click(
      screen.getByRole("button", { name: "Discard & Leave" }),
    );

    expect(mocks.disclaimers.reset).toHaveBeenCalled();
    await openTab("Organization");
    expect(screen.getByTestId("org-team-size")).toHaveTextContent("");
  });

  it("reports a thrown save when leaving with Save & Continue", async () => {
    mocks.disclaimers.save.mockRejectedValue(new Error("boom"));
    await renderLoaded();
    await openTab("Organization");

    await userEvent.click(
      screen.getByRole("button", { name: "make-disclaimers-dirty" }),
    );
    await openTab("Branding");
    await userEvent.click(
      screen.getByRole("button", { name: "Save & Continue" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to save changes"),
    );
    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    expect(screen.getByTestId("org-team-size")).toBeInTheDocument();
  });
});
