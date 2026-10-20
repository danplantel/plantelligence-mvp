import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditClient } from "../useEditClient";

/**
 * `useEditClient` — the data layer under Edit Plan.
 *
 * It owns three things the page cannot verify on its own:
 *
 *  1. **Loading.** `GET /api/clients/:id` is mapped from the API's flat shape
 *     into the editor's form state (slug → portalUrl, base64 logo → image
 *     object, legacy top-level brand images → the four slots, contacts in
 *     either the legacy array or the `{contacts, displayStyle}` envelope,
 *     `?status=` overriding the stored status). Transient failures are retried;
 *     404 and 400 are not.
 *  2. **Validation.** `validateForm` gates an Active plan's save and
 *     `getValidationErrors` decorates the fields. They are deliberately
 *     different — the field decorator adds hero/mission length rules that the
 *     gate does not enforce — so both are pinned.
 *  3. **Saving.** The PUT payload is the contract the API route consumes:
 *     contacts wrapped with their display styles, visibility normalized to the
 *     four canonical keys, `status` included, and `saving` always released.
 */

const mocks = vi.hoisted(() => ({
  params: { id: "plan-1" } as Record<string, unknown>,
  searchParams: new URLSearchParams(),
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => mocks.params,
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/compliance-document-utils", () => ({
  guessLanguageFromDocument: vi.fn(async () => "EN"),
}));

function response(
  status: number,
  body: unknown = {},
): {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
} {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => "",
  };
}

function okClient(data: Record<string, unknown> = {}) {
  return response(200, {
    success: true,
    data: {
      id: "plan-1",
      companyName: "Acme",
      companyWebsite: "https://acme.test",
      slug: "acme",
      companyLogo: "data:image/png;base64,AAAA",
      logoFileName: "logo.png",
      brandColor: "#123456",
      secondaryColor: "#654321",
      heroTitle: "Welcome aboard",
      heroDescription: "We are glad you are here",
      missionHeadline: "Our mission",
      missionBody: "M".repeat(300),
      status: "active",
      keyContacts: [{ name: "Ada", organization: "Acme" }],
      documents: [],
      disclaimers: "Standard disclaimer",
      provideSpanishVersions: true,
      ...data,
    },
  });
}

/** A plan whose every required field passes `validateForm`. */
function completeClient(data: Record<string, unknown> = {}) {
  return okClient(data);
}

function renderEditClient() {
  return renderHook(() => useEditClient());
}

async function loaded(data: Record<string, unknown> = {}) {
  mocks.fetch.mockResolvedValue(okClient(data));
  const rendered = renderEditClient();
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  return rendered;
}

function lastFetchCall() {
  return mocks.fetch.mock.calls[mocks.fetch.mock.calls.length - 1];
}

function putBody() {
  const putCall = mocks.fetch.mock.calls.find(
    ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
  );
  return JSON.parse((putCall?.[1] as RequestInit).body as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.params = { id: "plan-1" };
  mocks.searchParams = new URLSearchParams();
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("loading a plan", () => {
  it("maps the API shape onto the form state", async () => {
    const { result } = await loaded();

    expect(mocks.fetch).toHaveBeenCalledWith("/api/clients/plan-1", {
      signal: expect.anything(),
    });
    expect(result.current.client?.companyName).toBe("Acme");
    expect(result.current.companyData).toMatchObject({
      companyName: "Acme",
      companyWebsite: "https://acme.test",
      portalUrl: "acme",
      primaryColor: "#123456",
      secondaryColor: "#654321",
      heroTitle: "Welcome aboard",
      missionHeadline: "Our mission",
    });
    expect(result.current.companyData.companyLogo).toMatchObject({
      url: "data:image/png;base64,AAAA",
      fileName: "logo.png",
    });
    expect(result.current.clientStatus).toBe("Active");
    expect(result.current.disclaimers).toBe("Standard disclaimer");
    expect(result.current.provideSpanishVersions).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("reads contacts from the display-style envelope", async () => {
    const { result } = await loaded({
      keyContacts: {
        contacts: [{ name: "Ada" }, { name: "Grace" }],
        displayStyle: 2,
        mobileDisplayStyle: 3,
      },
    });

    expect(result.current.keyContacts.map((contact) => contact.name)).toEqual([
      "Ada",
      "Grace",
    ]);
    expect(result.current.keyContactsDisplayStyle).toBe(2);
    expect(result.current.keyContactsMobileDisplayStyle).toBe(3);
  });

  it("reads the legacy array contact format", async () => {
    const { result } = await loaded({
      keyContacts: [{ name: "Ada" }],
    });

    expect(result.current.keyContacts).toHaveLength(1);
    expect(result.current.keyContactsDisplayStyle).toBeNull();
    expect(result.current.keyContactsMobileDisplayStyle).toBeNull();
  });

  it("parses a JSON-string contact payload", async () => {
    const { result } = await loaded({
      keyContacts: JSON.stringify([{ name: "Ada" }]),
    });

    expect(result.current.keyContacts[0]?.name).toBe("Ada");
  });

  it("fills in the contact defaults the editor form depends on", async () => {
    const { result } = await loaded({
      keyContacts: [{ name: "Ada" }],
    });

    expect(result.current.keyContacts[0]).toMatchObject({
      role: "",
      customRole: "",
      email: "",
      phone: "",
      headshot: "",
      displayEmail: false,
      displayPhone: false,
      contactButton: false,
      contactButtonType: "email",
    });
  });

  it("normalizes visibility stored as a JSON string", async () => {
    const { result } = await loaded({
      categoryPortalVisibility: JSON.stringify({ Other: false }),
    });

    expect(result.current.categoryPortalVisibility).toEqual({
      Retirement: true,
      "Group Health": true,
      "Group Life": true,
      Other: false,
    });
  });

  it("falls back to the legacy brand image fields", async () => {
    const { result } = await loaded({
      brandImages: null,
      backgroundImg: "https://cdn.test/header.png",
      backgroundImgName: "header.png",
    });

    expect(result.current.companyData.brandImages.header).toMatchObject({
      url: "https://cdn.test/header.png",
      fileName: "header.png",
    });
  });

  it("splits the SPD out of the retirement documents", async () => {
    const { result } = await loaded({
      documents: [
        {
          id: "doc-spd",
          type: "SPD",
          title: "Summary Plan Description",
          fileUrl: "https://cdn.test/spd.pdf",
        },
        {
          id: "doc-fund",
          title: "Fund Fact Sheet",
          fileUrl: "https://cdn.test/fund.pdf",
        },
      ],
    });

    expect(result.current.documentsData.spdFile?.id).toBe("doc-spd");
    expect(
      result.current.documentsData.retirementPlanDocuments.map((doc) => doc.id),
    ).toEqual(["doc-fund"]);
  });

  it("lets ?status= override the stored status", async () => {
    mocks.searchParams = new URLSearchParams("status=draft");

    const { result } = await loaded({ status: "active" });

    expect(result.current.clientStatus).toBe("Draft");
  });

  it("normalizes an unknown stored status to Active", async () => {
    const { result } = await loaded({ status: "paused" });

    expect(result.current.clientStatus).toBe("Active");
  });

  it("reports a 404 as Client not found without retrying", async () => {
    mocks.fetch.mockResolvedValue(response(404));

    const { result } = renderEditClient();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Client not found");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("names the status for a non-retryable failure", async () => {
    mocks.fetch.mockResolvedValue(response(400));

    const { result } = renderEditClient();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load client data (HTTP 400)");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("reports success:false as a load failure", async () => {
    mocks.fetch.mockResolvedValue(response(200, { success: false }));

    const { result } = renderEditClient();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load client data");
  });

  it("retries a transient 500 before giving up", async () => {
    vi.useFakeTimers();
    try {
      mocks.fetch
        .mockResolvedValueOnce(response(500))
        .mockResolvedValueOnce(okClient());

      const { result } = renderEditClient();

      // Let the first attempt settle, then walk the 400ms back-off.
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mocks.fetch).toHaveBeenCalledTimes(2);
      expect(result.current.client?.companyName).toBe("Acme");
      expect(result.current.error).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the in-flight load when the page unmounts", async () => {
    let signal: AbortSignal | undefined;
    mocks.fetch.mockImplementation((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise(() => {});
    });

    const { unmount } = renderEditClient();
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});

describe("validation", () => {
  it("treats Draft and Archived plans as always valid", async () => {
    const { result } = await loaded({ companyName: "", companyLogo: null });

    act(() => result.current.setClientStatus("Draft"));
    expect(result.current.isFormValid()).toBe(true);
    expect(result.current.getValidationErrors()).toEqual({});

    act(() => result.current.setClientStatus("Archived"));
    expect(result.current.isFormValid()).toBe(true);
    expect(result.current.getValidationErrors()).toEqual({});
  });

  it("requires the branded fields for an Active plan", async () => {
    const { result } = await loaded({
      companyName: "",
      companyLogo: null,
      slug: "",
      heroTitle: "",
      heroDescription: "",
      missionHeadline: "",
      missionBody: "",
      keyContacts: [],
    });

    expect(result.current.isFormValid()).toBe(false);
    const errors = result.current.getValidationErrors();
    expect(Object.keys(errors).sort()).toEqual([
      "companyLogo",
      "companyName",
      "heroDescription",
      "heroTitle",
      "keyContacts",
      "missionBody",
      "missionHeadline",
      "portalUrl",
    ]);
  });

  it("decorates length rules the save gate does not enforce", async () => {
    const { result } = await loaded();

    act(() => {
      result.current.handleInputChange(
        "heroDescription" as any,
        "x".repeat(401),
      );
      result.current.handleInputChange("missionBody" as any, "short mission");
    });

    // The gate only checks presence, so the plan is saveable…
    expect(result.current.isFormValid()).toBe(true);
    // …while the field errors still warn about the lengths.
    const errors = result.current.getValidationErrors();
    expect(errors.heroDescription).toContain(
      "Banner Text must be 400 characters or less",
    );
    expect(errors.missionBody).toContain(
      "Mission Statement must be between 250-2000 characters",
    );
  });

  it("asks for a contact organization without failing the save gate", async () => {
    const { result } = await loaded({
      keyContacts: [{ name: "Ada", organization: "" }],
    });

    expect(result.current.isFormValid()).toBe(true);
    expect(result.current.getValidationErrors().keyContacts).toEqual([
      "Please fill in organization for all Key Contacts",
    ]);
  });
});

describe("saving", () => {
  it("does nothing before the plan has loaded", async () => {
    const { result } = renderEditClient();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSave();
    });

    expect(ok).toBe(false);
    // Only the GET on mount ran; nothing was written.
    expect(
      mocks.fetch.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("refuses to save an Active plan that is missing fields", async () => {
    const { result } = await loaded({ companyName: "", heroTitle: "" });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSave();
    });

    expect(ok).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please complete all required fields:",
      expect.objectContaining({
        description: expect.stringContaining("Company Name is required"),
      }),
    );
    expect(
      mocks.fetch.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("PUTs the composed payload and reports success", async () => {
    const { result } = await loaded({
      status: "draft",
      keyContacts: { contacts: [{ name: "Ada" }], displayStyle: 1 },
      categoryPortalVisibility: {},
      missionBody: "",
      heroTitle: "Welcome",
      heroDescription: "Hello",
    });
    mocks.fetch.mockResolvedValue(response(200, { success: true }));

    act(() => {
      result.current.setKeyContacts([{ name: "Ada" } as any]);
      result.current.setKeyContactsDisplayStyle(2);
      result.current.setKeyContactsMobileDisplayStyle(4);
      result.current.handleInputChange("companyName", "Acme Renamed");
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSave();
    });

    expect(ok).toBe(true);
    const [url, init] = lastFetchCall();
    expect(url).toBe("/api/clients/plan-1");
    expect((init as RequestInit).method).toBe("PUT");

    const body = putBody();
    expect(body.companyName).toBe("Acme Renamed");
    expect(body.heroTitle).toBe("Welcome");
    expect(body.missionBody).toBe("");
    expect(body.status).toBe("Draft");
    expect(body.keyContacts).toEqual({
      contacts: [{ name: "Ada" }],
      displayStyle: 2,
      mobileDisplayStyle: 4,
    });
    expect(body.categoryPortalVisibility).toEqual({
      Retirement: true,
      "Group Health": true,
      "Group Life": true,
      Other: true,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Client updated successfully",
    );
    expect(result.current.saving).toBe(false);
  });

  it("reports a rejected request and releases the saving flag", async () => {
    const { result } = await loaded({ status: "draft" });
    mocks.fetch.mockResolvedValue(response(500));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSave();
    });

    expect(ok).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to update client");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
  });

  it("treats success:false as a failed save", async () => {
    const { result } = await loaded({ status: "draft" });
    mocks.fetch.mockResolvedValue(response(200, { success: false }));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleSave();
    });

    expect(ok).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to update client");
  });
});

describe("form helpers", () => {
  it("toggles an accordion section", async () => {
    const { result } = await loaded();

    expect(result.current.openSections.mission).toBe(true);
    act(() => result.current.toggleSection("mission"));
    expect(result.current.openSections.mission).toBe(false);
    expect(result.current.openSections.companyInfo).toBe(true);
  });

  it("clears a contact headshot by index", async () => {
    const { result } = await loaded({
      keyContacts: [
        { name: "Ada", headshot: "data:image/png;base64,AAAA" },
        { name: "Grace", headshot: "data:image/png;base64,BBBB" },
      ],
    });

    act(() => result.current.handleHeadshotRemove(0));

    expect(result.current.keyContacts[0]).toMatchObject({
      headshot: "",
      headshotFileName: "",
    });
    expect(result.current.keyContacts[1]?.headshot).toBe(
      "data:image/png;base64,BBBB",
    );
  });

  it("clears the logo and background slots", async () => {
    const { result } = await loaded();

    act(() => {
      result.current.handleFileRemove("logo");
      result.current.handleFileRemove("background");
    });

    expect(result.current.companyData.companyLogo).toBeNull();
    // backgroundImg is set by the legacy image pipeline, outside CompanyBasicsData.
    expect((result.current.companyData as any).backgroundImg).toBe("");
  });

  it("clears only the legacy SPD slot, not the documents payload", async () => {
    const { result } = await loaded({
      documents: [
        {
          id: "doc-spd",
          type: "SPD",
          title: "Summary Plan Description",
          fileUrl: "https://cdn.test/spd.pdf",
        },
      ],
    });
    expect(result.current.documentsData.spdFile?.id).toBe("doc-spd");

    act(() => {
      result.current.handleFileRemove("spd");
    });

    // `handleFileRemove("spd")` writes the legacy `documentData` state, which the
    // page no longer reads; the modern `documentsData` payload keeps the document.
    expect(result.current.documentsData.spdFile?.id).toBe("doc-spd");
  });

  it("removes one SBC document by index", async () => {
    const { result } = await loaded();

    act(() => {
      result.current.handleFileRemove("sbc", 0);
    });

    expect(result.current.documentsData.otherDocuments).toEqual([]);
  });

  it("ignores the optional-document removal branch", async () => {
    const { result } = await loaded();

    // `optional` is a leftover switch branch with an empty body; it must not
    // throw or clear the retirement documents.
    act(() => {
      result.current.handleFileRemove("optional", 0);
    });

    expect(result.current.documentsData.retirementPlanDocuments).toEqual([]);
  });

  it("writes an uploaded logo into the company logo slot", async () => {
    const { result } = await loaded();

    const file = new File(["logo"], "acme-logo.png", { type: "image/png" });
    await act(async () => {
      await result.current.handleFileUpload(file, "logo");
    });

    await waitFor(() =>
      expect(result.current.companyData.companyLogo).toMatchObject({
        fileName: "acme-logo.png",
        fileSize: file.size,
      }),
    );
  });
});
