import { beforeEach, describe, expect, it, vi } from "vitest";

import { step2ServicesToCategories } from "@/lib/service-categories";
import { OrganizationType, ServiceType, TeamSize } from "@/types/wizard";

import { useOnboardingWizardStore } from "../onboarding-wizard-store";

const getSession = vi.hoisted(() => vi.fn(async () => null));
const hardNavigate = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  message: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ getSession }));
vi.mock("@/lib/hard-navigate", () => ({ hardNavigate }));
vi.mock("sonner", () => ({ toast }));

const fetchMock = vi.fn();

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

function store() {
  return useOnboardingWizardStore.getState();
}

function resetStore() {
  store().resetWizard();
  useOnboardingWizardStore.setState({
    autosaveToServer: false,
    showStep5ConfirmModal: false,
    teamInvites: [],
    errorFields: [],
    errorFieldsSource: null,
    stepLoadingPromises: {},
    isLoading: false,
    loadingPromise: null,
  });
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("onboarding wizard store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    getSession.mockClear();
    toast.error.mockClear();
    toast.success.mockClear();
    toast.message.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("step navigation", () => {
    it("advances one step, clears errors, and persists the step", async () => {
      store().setErrorFields(["name"], "next");

      await store().nextStep();

      expect(store().currentStep).toBe(2);
      expect(store().errorFields).toEqual([]);
      expect(store().errorFieldsSource).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding-wizard/session",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ currentStep: 2 }),
        }),
      );
    });

    it("does not advance past the last step", async () => {
      useOnboardingWizardStore.setState({ currentStep: 5 });

      await store().nextStep();

      expect(store().currentStep).toBe(5);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("entering Step 5 always resets the sub-step to review", async () => {
      useOnboardingWizardStore.setState({
        currentStep: 4,
        step5SubStep: "team",
      });

      await store().nextStep();

      expect(store().currentStep).toBe(5);
      expect(store().step5SubStep).toBe("review");
    });

    it("walks Step 5 backwards through its sub-steps before leaving", () => {
      useOnboardingWizardStore.setState({
        currentStep: 5,
        step5SubStep: "team",
      });

      store().previousStep();
      expect(store().step5SubStep).toBe("disclosures");

      store().previousStep();
      expect(store().step5SubStep).toBe("review");

      store().previousStep();
      expect(store().currentStep).toBe(4);
      expect(store().step5SubStep).toBe("review");
    });

    it("does not go below step 1", () => {
      store().previousStep();

      expect(store().currentStep).toBe(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("ignores out-of-range goToStep values", () => {
      store().goToStep(0);
      expect(store().currentStep).toBe(1);

      store().goToStep(6);
      expect(store().currentStep).toBe(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("jumps to a valid step and resets Step 5 to review", () => {
      store().goToStep(5);

      expect(store().currentStep).toBe(5);
      expect(store().step5SubStep).toBe("review");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding-wizard/session",
        expect.objectContaining({
          body: JSON.stringify({ currentStep: 5 }),
        }),
      );
    });

    it("marks a step complete", () => {
      store().completeStep(3);

      expect(store().steps.find((step) => step.id === 3)?.completed).toBe(
        true,
      );
      expect(store().steps.find((step) => step.id === 2)?.completed).toBe(
        false,
      );
    });
  });

  describe("review edit mode", () => {
    it("opens steps 1-4 in edit-from-review mode", () => {
      store().setErrorFields(["name"], "next");
      store().startEditingFromReview(3);

      expect(store().currentStep).toBe(3);
      expect(store().editFromReview).toBe(true);
      expect(store().errorFields).toEqual([]);
    });

    it("ignores steps outside 1-4", () => {
      store().startEditingFromReview(5);

      expect(store().currentStep).toBe(1);
      expect(store().editFromReview).toBe(false);
    });

    it("returns to Review and clears edit mode", () => {
      store().startEditingFromReview(2);

      store().returnToReview();

      expect(store().currentStep).toBe(5);
      expect(store().step5SubStep).toBe("review");
      expect(store().editFromReview).toBe(false);
    });
  });

  describe("error fields", () => {
    it("stores errors and their source", () => {
      store().setErrorFields(["name", "phone"], "blur");

      expect(store().errorFields).toEqual(["name", "phone"]);
      expect(store().errorFieldsSource).toBe("blur");
    });

    it("clears one field without touching the rest", () => {
      store().setErrorFields(["name", "phone"], "next");

      store().clearFieldError("name");

      expect(store().errorFields).toEqual(["phone"]);
      expect(store().errorFieldsSource).toBe("next");
    });

    it("clears all errors and the source", () => {
      store().setErrorFields(["name"], "next");

      store().clearErrorFields();

      expect(store().errorFields).toEqual([]);
      expect(store().errorFieldsSource).toBeNull();
    });

    it("a sub-step change clears stale errors", () => {
      store().setErrorFields(["disclosures"], "next");

      store().setStep5SubStep("disclosures");

      expect(store().step5SubStep).toBe("disclosures");
      expect(store().errorFields).toEqual([]);
    });
  });

  describe("saveStepData", () => {
    it("merges data locally without calling the server when saveToServer is false", async () => {
      await store().saveStepData(
        "branding",
        { organizationName: "Acme" },
        false,
      );

      expect(store().stepData.branding).toMatchObject({
        organizationName: "Acme",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("merges locally and posts to the matching endpoint when saveToServer is true", async () => {
      await store().saveStepData(
        "clientProfile",
        {
          organizationType: OrganizationType.FINANCIAL_ADVISOR_RIA,
          customOrganization: "",
        },
        true,
      );

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding-wizard/client-profile",
        expect.objectContaining({ method: "POST" }),
      );
      expect(store().stepData.clientProfile).toMatchObject({
        organizationType: OrganizationType.FINANCIAL_ADVISOR_RIA,
      });
    });

    it("maps insuranceLicensing to the kebab-case endpoint", async () => {
      await store().saveStepData(
        "insuranceLicensing",
        { offersInsurance: false },
        true,
      );

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding-wizard/insurance-licensing",
        expect.anything(),
      );
    });

    it("normalizes the website protocol before saving", async () => {
      await store().saveStepData(
        "branding",
        { website: "https://acme.example/path", organizationName: "Acme" },
        false,
      );

      expect(store().stepData.branding?.website).toBe("acme.example/path");
    });

    it("syncs services into userSetup.primaryServiceCategories", async () => {
      useOnboardingWizardStore.setState({
        stepData: {
          userSetup: { name: "Ada", primaryServiceCategories: [] },
        } as any,
      });

      await store().saveStepData(
        "services",
        {
          services: [ServiceType.RETIREMENT, ServiceType.GROUP_HEALTH],
          customService: "",
        },
        false,
      );

      expect(store().stepData.services).toMatchObject({
        services: [ServiceType.RETIREMENT, ServiceType.GROUP_HEALTH],
      });
      expect(
        (store().stepData.userSetup as any)?.primaryServiceCategories,
      ).toEqual(
        step2ServicesToCategories([
          ServiceType.RETIREMENT,
          ServiceType.GROUP_HEALTH,
        ]),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("saveStepDataToServer", () => {
    it("returns true for an OK response", async () => {
      await expect(
        store().saveStepDataToServer("teamSize", {
          teamSize: TeamSize.SOLO,
        }),
      ).resolves.toBe(true);
    });

    it("returns false for a non-OK response", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false));

      await expect(
        store().saveStepDataToServer("teamSize", {
          teamSize: TeamSize.SOLO,
        }),
      ).resolves.toBe(false);
    });

    it("returns false when the request throws", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));

      await expect(
        store().saveStepDataToServer("teamSize", {
          teamSize: TeamSize.SOLO,
        }),
      ).resolves.toBe(false);
    });
  });

  describe("loadStepData", () => {
    it("returns cached data without fetching", async () => {
      useOnboardingWizardStore.setState({
        stepData: { teamSize: { teamSize: TeamSize.TWO_FIVE } },
      });

      await expect(store().loadStepData("teamSize")).resolves.toMatchObject({
        teamSize: TeamSize.TWO_FIVE,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fetches, stores, and returns data", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ teamSize: { teamSize: TeamSize.SIX_TWENTY } }),
      );

      await expect(store().loadStepData("teamSize")).resolves.toMatchObject({
        teamSize: TeamSize.SIX_TWENTY,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding-wizard/team-size",
      );
      expect(store().stepData.teamSize).toMatchObject({
        teamSize: TeamSize.SIX_TWENTY,
      });
    });

    it("force reloads even when cached data exists", async () => {
      useOnboardingWizardStore.setState({
        stepData: { teamSize: { teamSize: TeamSize.TWO_FIVE } },
      });
      fetchMock.mockResolvedValue(
        jsonResponse({ teamSize: { teamSize: TeamSize.TWENTY_ONE_PLUS } }),
      );

      await store().loadStepData("teamSize", true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(store().stepData.teamSize).toMatchObject({
        teamSize: TeamSize.TWENTY_ONE_PLUS,
      });
    });

    it("shares one in-flight request between callers", async () => {
      let resolveFetch: (value: Response) => void = () => {};
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      );

      const first = store().loadStepData("services", true);
      const second = store().loadStepData("services", true);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      resolveFetch(
        jsonResponse({ services: { services: [ServiceType.RETIREMENT] } }),
      );

      await expect(first).resolves.toMatchObject({
        services: [ServiceType.RETIREMENT],
      });
      await expect(second).resolves.toMatchObject({
        services: [ServiceType.RETIREMENT],
      });
    });

    it("returns null on a non-OK response", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false));

      await expect(store().loadStepData("services")).resolves.toBeNull();
    });

    it("returns null when the request throws", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));

      await expect(store().loadStepData("services")).resolves.toBeNull();
    });
  });

  describe("loadAllWizardData", () => {
    it("returns cached data when the store already has step data", async () => {
      useOnboardingWizardStore.setState({
        stepData: { teamSize: { teamSize: TeamSize.SOLO } },
      });

      await expect(store().loadAllWizardData()).resolves.toMatchObject({
        teamSize: { teamSize: TeamSize.SOLO },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("loads every section, restores the server step, and marks completed steps", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url === "/api/onboarding-wizard/new-session") {
          return jsonResponse({ session: { id: "session-1" } });
        }
        if (url === "/api/onboarding-wizard/session") {
          return jsonResponse({ session: { currentStep: 3 } });
        }
        if (url === "/api/onboarding-wizard/client-profile") {
          return jsonResponse({
            clientProfile: { organizationType: "ria" },
          });
        }
        if (url === "/api/onboarding-wizard/team-size") {
          return jsonResponse({ teamSize: { teamSize: "just_me" } });
        }
        if (url === "/api/onboarding-wizard/services") {
          // An empty selection still counts as loaded Step 2 data but does not
          // synthesize userSetup categories, keeping Step 3/4 incomplete.
          return jsonResponse({ services: { services: [] } });
        }
        return jsonResponse({});
      });

      await store().loadAllWizardData();

      expect(store().currentStep).toBe(3);
      expect(store().step5SubStep).toBe("review");
      expect(store().editFromReview).toBe(false);
      expect(store().stepData.clientProfile).toMatchObject({
        organizationType: OrganizationType.FINANCIAL_ADVISOR_RIA,
      });
      expect(store().stepData.teamSize).toMatchObject({
        teamSize: TeamSize.SOLO,
      });
      expect(
        store().steps.find((step) => step.id === 1)?.completed,
      ).toBe(true);
      expect(
        store().steps.find((step) => step.id === 2)?.completed,
      ).toBe(true);
      expect(
        store().steps.find((step) => step.id === 3)?.completed,
      ).toBe(false);
      expect(store().isLoading).toBe(false);
    });

    it("creates a session when none exists, then loads data", async () => {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === "/api/onboarding-wizard/new-session" && init?.method === "POST") {
          return jsonResponse({ sessionId: "created-1" });
        }
        if (url === "/api/onboarding-wizard/new-session") {
          return jsonResponse({ session: null });
        }
        if (url === "/api/onboarding-wizard/session") {
          return jsonResponse({ session: { currentStep: 1 } });
        }
        return jsonResponse({});
      });

      await store().loadAllWizardData();

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding-wizard/new-session",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns an empty object and clears loading when loading throws", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));

      await expect(store().loadAllWizardData()).resolves.toEqual({});

      expect(store().isLoading).toBe(false);
      expect(store().loadingPromise).toBeNull();
    });

    it("shares one load between concurrent callers", async () => {
      let resolveFirst: (value: Response) => void = () => {};
      let callCount = 0;
      fetchMock.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          return new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve(jsonResponse({}));
      });

      const first = store().loadAllWizardData();
      const second = store().loadAllWizardData();

      expect(fetchMock).toHaveBeenCalledTimes(1);

      resolveFirst(jsonResponse({ session: { id: "s" } }));

      await expect(first).resolves.toBeDefined();
      await expect(second).resolves.toBeDefined();
    });
  });

  describe("completion and reset", () => {
    it("marks the wizard complete and posts to the complete endpoint", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false));

      store().completeWizard();

      expect(store().isCompleted).toBe(true);
      expect(store().currentStep).toBe(5);
      expect(store().steps.every((step) => step.completed)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding-wizard/complete",
        expect.objectContaining({ method: "POST" }),
      );

      await flush();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Error completing onboarding"),
      );
    });

    it("refreshes the session, then sends the browser to the dashboard", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ success: true }));

      store().completeWizard();
      await flush();

      expect(getSession).toHaveBeenCalled();
      expect(hardNavigate).toHaveBeenCalledWith("/dashboard");
    });

    it("resetWizard clears navigation, data, errors, invites, and loading", () => {
      useOnboardingWizardStore.setState({
        currentStep: 4,
        stepData: {
          branding: { organizationName: "Acme", brandColor: "#111111" },
        },
        errorFields: ["logo"],
        errorFieldsSource: "next",
        step5SubStep: "team",
        editFromReview: true,
        teamInvites: [
          {
            id: "1",
            fullName: "Bob",
            email: "bob@example.com",
            role: "viewer",
            status: "pending",
          },
        ],
        isCompleted: true,
        isLoading: true,
        loadingPromise: Promise.resolve({}),
      });

      store().resetWizard();

      expect(store().currentStep).toBe(1);
      expect(store().stepData).toEqual({});
      expect(store().errorFields).toEqual([]);
      expect(store().errorFieldsSource).toBeNull();
      expect(store().step5SubStep).toBe("review");
      expect(store().editFromReview).toBe(false);
      expect(store().teamInvites).toEqual([]);
      expect(store().isCompleted).toBe(false);
      expect(store().isLoading).toBe(false);
      expect(store().loadingPromise).toBeNull();
    });
  });

  describe("validation actions", () => {
    it("validates the current step and tags errors as next", async () => {
      await store().validateCurrentStepFields();

      expect(store().errorFields).toEqual(
        expect.arrayContaining(["organizationType", "teamSize"]),
      );
      expect(store().errorFieldsSource).toBe("next");
    });

    it("validates an explicit step instead of the current one", async () => {
      useOnboardingWizardStore.setState({ currentStep: 3 });

      await store().validateCurrentStepFields(1);

      expect(store().errorFields).toEqual(
        expect.arrayContaining(["organizationType", "teamSize"]),
      );
    });

    it("clears errors when validation passes", async () => {
      store().setErrorFields(["name"], "next");
      useOnboardingWizardStore.setState({
        currentStep: 1,
        stepData: {
          clientProfile: {
            organizationType: OrganizationType.FINANCIAL_ADVISOR_RIA,
          },
          teamSize: { teamSize: TeamSize.SOLO },
        },
      });

      await store().validateCurrentStepFields();

      expect(store().errorFields).toEqual([]);
      expect(store().errorFieldsSource).toBeNull();
    });

    it("surfaces only the blurred field and marks the source as blur", async () => {
      await store().validateFieldOnBlur(4, "name", {
        userSetup: {
          organizationEmail: "org@example.com",
          email: "ada@example.com",
          phone: "2135888888",
          title: "Advisor",
        },
      });

      expect(store().errorFields).toEqual(["name"]);
      expect(store().errorFieldsSource).toBe("blur");
    });

    it("does not paint unrelated fields when the blurred field is valid", async () => {
      await store().validateFieldOnBlur(4, "name", {
        userSetup: {
          name: "Ada",
          email: "ada@example.com",
          organizationEmail: "org@example.com",
          phone: "2135888888",
          title: "Advisor",
        },
      });

      expect(store().errorFields).toEqual([]);
      expect(store().errorFieldsSource).toBe("blur");
    });
  });

  describe("saveSummaryData", () => {
    it("posts each supplied section and merges it into the store", async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({ saved: true }),
      );

      const result = await store().saveSummaryData({
        clientProfile: { organizationType: OrganizationType.OTHER },
        teamSize: { teamSize: TeamSize.TWO_FIVE },
        services: { services: [ServiceType.RETIREMENT] },
        branding: { organizationName: "Acme" },
        userSetup: { name: "Ada" },
      });

      const urls = fetchMock.mock.calls.map(([url]) => url);
      expect(urls).toEqual([
        "/api/onboarding-wizard/client-profile",
        "/api/onboarding-wizard/team-size",
        "/api/onboarding-wizard/services",
        "/api/onboarding-wizard/branding",
        "/api/onboarding-wizard/user-setup",
      ]);
      expect(result).toMatchObject({
        clientProfile: { saved: true },
        teamSize: { saved: true },
        services: { saved: true },
        branding: { saved: true },
        userSetup: { saved: true },
      });
      expect(store().stepData).toMatchObject({
        branding: { organizationName: "Acme" },
        userSetup: { name: "Ada" },
      });
    });

    it("skips failed requests but still updates local data", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false));

      const result = await store().saveSummaryData({
        branding: { organizationName: "Acme" },
      });

      expect(result).toEqual({});
      expect(store().stepData.branding).toMatchObject({
        organizationName: "Acme",
      });
    });

    it("rethrows network errors", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));

      await expect(
        store().saveSummaryData({ branding: { organizationName: "Acme" } }),
      ).rejects.toThrow("offline");
    });
  });

  describe("persistence", () => {
    it("writes step data to localStorage and strips base64 images", () => {
      useOnboardingWizardStore.setState({
        stepData: {
          branding: {
            organizationName: "Acme",
            brandColor: "#111111",
            logo: "data:image/png;base64,AAAA",
          },
        },
      });

      const raw = localStorage.getItem("onboarding-wizard-store");
      expect(raw).not.toBeNull();

      const persisted = JSON.parse(raw as string);
      expect(persisted.state.stepData.branding.logo).toBe("");
      expect(persisted.state.stepData.branding.organizationName).toBe("Acme");
      expect(persisted.state.errorFields).toEqual([]);
      expect(persisted.state.stepLoadingPromises).toBeUndefined();
    });
  });
});
