import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enqueueDraftSave,
  getCompanyBasicsSubStep,
  isWizardTransitionActive,
  setWizardTransitionActive,
  useNewClientWizardStore,
} from "../new-client-wizard-store";
import { DuplicatePlanNameError } from "../duplicate-plan-name-error";

/**
 * Create Plan store internals.
 *
 * The page suite mocks this store, so these are the tests for the logic the
 * mocks stand in for: the draft-save serializer (overlapping saves are what
 * produced Prisma P2034 write-conflict 500s), the transition flag the autosave
 * checks, `saveAsDraft`'s duplicate/retry branches, and the sub-step resolver.
 */

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("swr", () => ({
  default: () => ({ data: undefined }),
  mutate: mocks.mutate,
}));

function fakeResponse(status: number, body: unknown) {
  const json = async () => body;
  return {
    ok: status >= 200 && status < 300,
    status,
    json,
    clone: () => ({ json }),
  } as any;
}

function resetStore() {
  useNewClientWizardStore.setState({
    currentStep: 1,
    stepData: {},
    draftClientId: undefined,
    draftSaveCount: 0,
    duplicatePlanNameConflict: null,
  });
}

function lastSaveBody() {
  const call = mocks.fetch.mock.calls.find(
    ([url]) => url === "/api/new-client-wizard/save-draft",
  );
  if (!call) throw new Error("save-draft was never called");
  return JSON.parse(call[1].body);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mocks.fetch.mockReset();
  mocks.mutate.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  resetStore();
  setWizardTransitionActive(false);
});

describe("getCompanyBasicsSubStep", () => {
  it.each([
    [{ companyBasicsSubStep: { current: "welcomeMission" } }, "welcomeMission"],
    [{ companyBasicsSubStep: { current: "branding" } }, "branding"],
    [{ companyBasicsSubStep: "welcomeMission" }, "welcomeMission"],
    [{ companyBasicsSubStep: "branding" }, "branding"],
    [{ companyBasicsSubStep: { current: "nonsense" } }, "branding"],
    [{}, "branding"],
    [undefined, "branding"],
  ])("resolves %o to %s", (stepData, expected) => {
    expect(getCompanyBasicsSubStep(stepData as any)).toBe(expected);
  });
});

describe("wizard transition flag", () => {
  it("reports whether a Next/Complete transition is running", () => {
    expect(isWizardTransitionActive()).toBe(false);

    setWizardTransitionActive(true);
    expect(isWizardTransitionActive()).toBe(true);

    setWizardTransitionActive(false);
    expect(isWizardTransitionActive()).toBe(false);
  });
});

describe("enqueueDraftSave", () => {
  it("runs queued saves one at a time, in order", async () => {
    const events: string[] = [];
    let releaseFirst: () => void = () => {};

    const first = enqueueDraftSave(async () => {
      events.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first:end");
      return "one";
    });
    const second = enqueueDraftSave(async () => {
      events.push("second:start");
      return "two";
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    releaseFirst();
    await expect(first).resolves.toBe("one");
    await expect(second).resolves.toBe("two");

    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("keeps the queue moving after a failed save", async () => {
    const failed = enqueueDraftSave(async () => {
      throw new Error("boom");
    });
    const next = enqueueDraftSave(async () => "ok");

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
  });
});

describe("saveAsDraft", () => {
  it("posts the cleaned step data, remembers the client id and bumps the save count", async () => {
    useNewClientWizardStore.setState({
      currentStep: 1,
      stepData: {
        companyBasics: {
          companyName: "Acme",
          companyLogo: { url: "data:image/png;base64,AAAA" },
        },
        keyContacts: {
          contacts: [
            {
              id: "c1",
              name: "Ada",
              headshot: "data:image/png;base64,BBBB",
            },
          ],
        },
      } as any,
    });
    mocks.fetch.mockResolvedValue(
      fakeResponse(200, { success: true, clientId: "plan-1", sessionId: "s1" }),
    );

    const result = await useNewClientWizardStore.getState().saveAsDraft();

    expect(result).toMatchObject({ success: true, clientId: "plan-1" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe("/api/new-client-wizard/save-draft");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const body = lastSaveBody();
    expect(body.currentStep).toBe(1);
    // No draft yet: the key is omitted entirely rather than sent as null.
    expect(body.clientId).toBeUndefined();
    // The active step's branding survives; base64 from other steps is omitted.
    expect(body.stepData.companyBasics.companyLogo.url).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(body.stepData.keyContacts.contacts[0]).not.toHaveProperty(
      "headshot",
    );

    const state = useNewClientWizardStore.getState();
    expect(state.draftClientId).toBe("plan-1");
    expect(state.draftSaveCount).toBe(1);
    expect(state.duplicatePlanNameConflict).toBeNull();
    expect(mocks.mutate).toHaveBeenCalledWith(expect.any(Function), undefined, {
      revalidate: true,
    });
  });

  it("keeps an existing draft id even when the server returns another", async () => {
    useNewClientWizardStore.setState({ draftClientId: "draft-keep" });
    mocks.fetch.mockResolvedValue(
      fakeResponse(200, { success: true, clientId: "plan-other" }),
    );

    await useNewClientWizardStore.getState().saveAsDraft();

    expect(lastSaveBody().clientId).toBe("draft-keep");
    expect(useNewClientWizardStore.getState().draftClientId).toBe("draft-keep");
  });

  it("opens the duplicate dialog state and throws on a duplicate name", async () => {
    mocks.fetch.mockResolvedValue(
      fakeResponse(200, {
        success: false,
        code: "DUPLICATE_PLAN_NAME",
        existingClientId: "plan-live",
        companyName: "Acme",
      }),
    );

    await expect(
      useNewClientWizardStore.getState().saveAsDraft(),
    ).rejects.toBeInstanceOf(DuplicatePlanNameError);

    expect(
      useNewClientWizardStore.getState().duplicatePlanNameConflict,
    ).toEqual({ existingClientId: "plan-live", companyName: "Acme" });
    expect(useNewClientWizardStore.getState().draftSaveCount).toBe(0);
  });

  it("swallows a duplicate name when the dialog is disabled", async () => {
    mocks.fetch.mockResolvedValue(
      fakeResponse(200, {
        success: false,
        code: "DUPLICATE_PLAN_NAME",
        existingClientId: "plan-live",
        companyName: "Acme",
      }),
    );

    await expect(
      useNewClientWizardStore
        .getState()
        .saveAsDraft({ showDuplicatePlanDialog: false }),
    ).resolves.toBeNull();

    expect(
      useNewClientWizardStore.getState().duplicatePlanNameConflict,
    ).toBeNull();
  });

  it("opens a wizard session and retries once when the session is missing", async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        fakeResponse(404, { error: "No active wizard session found" }),
      )
      .mockResolvedValueOnce(fakeResponse(200, { success: true }))
      .mockResolvedValueOnce(fakeResponse(200, { success: true }));

    await useNewClientWizardStore.getState().saveAsDraft();

    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(mocks.fetch.mock.calls[1][0]).toBe("/api/new-client-wizard/session");
    expect(mocks.fetch.mock.calls[1][1]).toMatchObject({ method: "POST" });
    expect(mocks.fetch.mock.calls[2][0]).toBe(
      "/api/new-client-wizard/save-draft",
    );
    expect(lastSaveBody()).toBeTruthy();
  });

  it("does not treat an unrelated 404 as a missing session", async () => {
    mocks.fetch.mockResolvedValue(
      fakeResponse(404, { error: "Client not found" }),
    );

    await expect(
      useNewClientWizardStore.getState().saveAsDraft(),
    ).rejects.toThrow("Client not found");

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws the API error for a failed request", async () => {
    mocks.fetch.mockResolvedValue(fakeResponse(500, { error: "Boom" }));

    await expect(
      useNewClientWizardStore.getState().saveAsDraft(),
    ).rejects.toThrow("Boom");
  });

  it("throws when the API answers success:false without a duplicate code", async () => {
    mocks.fetch.mockResolvedValue(
      fakeResponse(200, { success: false, error: "Nothing saved" }),
    );

    await expect(
      useNewClientWizardStore.getState().saveAsDraft(),
    ).rejects.toThrow("Nothing saved");
  });

  it("falls back to a generic message when the API gives no error text", async () => {
    mocks.fetch.mockResolvedValue(fakeResponse(500, {}));

    await expect(
      useNewClientWizardStore.getState().saveAsDraft(),
    ).rejects.toThrow("Failed to save draft");
  });

  it("serializes concurrent saves instead of firing them in parallel", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    mocks.fetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(fakeResponse(200, { success: true }));

    const first = useNewClientWizardStore.getState().saveAsDraft();
    const second = useNewClientWizardStore.getState().saveAsDraft();

    await Promise.resolve();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    resolveFirst(fakeResponse(200, { success: true }));
    await expect(first).resolves.toBeTruthy();
    await expect(second).resolves.toBeTruthy();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
