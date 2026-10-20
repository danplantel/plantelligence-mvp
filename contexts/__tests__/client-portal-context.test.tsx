import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClientPortalProvider,
  useClientPortal,
} from "../client-portal-context";

/**
 * `ClientPortalProvider` decides whether a plan is visible at all.
 *
 * Everything a participant can reach hangs off three rules here:
 *
 *  - the plan is fetched with `?forPortal=1`, which is what scopes the API
 *    response to public data (and lets an anonymous employee load it);
 *  - an **Archived** plan answers exactly like a missing one (**Page Not
 *    Found**), while a **Draft** still previews;
 *  - a retired slug redirects to the plan's canonical URL, preserving the
 *    sub-path so `/old-slug/retirement` lands on `/new-slug/retirement`.
 *
 * The advisor profile is fetched alongside the plan but must never fail the
 * page, and two window events refetch the plan when the advisor edits it.
 */

const mocks = vi.hoisted(() => ({
  clientId: "plan-1",
  pathname: "/plan-1",
  replace: vi.fn(),
  push: vi.fn(),
  fetch: vi.fn(),
}));

// The router object must be STABLE across renders: `fetchClient` is a
// `useCallback` over it, so a fresh object per call would re-run the load
// effect forever and the provider would never leave its skeleton.
vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace, push: mocks.push };
  return {
    useParams: () => ({ id: mocks.clientId }),
    usePathname: () => mocks.pathname,
    useRouter: () => router,
  };
});

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    companyName: "Acme",
    brandColor: "#123456",
    secondaryColor: "#654321",
    status: "Active",
    keyContacts: [],
    ...overrides,
  };
}

function clientPayload(
  overrides: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  return jsonResponse(200, {
    success: true,
    data: plan(overrides),
    ...extra,
  });
}

function profilePayload() {
  return jsonResponse(200, {
    name: "Ada Advisor",
    designations: ["CFP"],
    organizationName: "Acme Advisory",
    email: "ada@example.com",
  });
}

function Probe() {
  const { clientData, profile, loading, error, refetch } = useClientPortal();

  return (
    <div>
      <p data-testid="name">{clientData?.companyName ?? "none"}</p>
      <p data-testid="profile">{profile?.name ?? "none"}</p>
      <p data-testid="state">{`${loading}|${error ?? "ok"}`}</p>
      <button onClick={() => void refetch()}>Refetch</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <ClientPortalProvider>
      <Probe />
    </ClientPortalProvider>,
  );
}

function clientCalls() {
  return mocks.fetch.mock.calls.filter(([url]) =>
    String(url).startsWith("/api/clients/"),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.clientId = "plan-1";
  mocks.pathname = "/plan-1";
  mocks.fetch.mockImplementation(async (url: string) => {
    if (String(url).startsWith("/api/profile")) return profilePayload();
    return clientPayload();
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("ClientPortalProvider loading", () => {
  it("fetches the plan for the portal and renders the page", async () => {
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/clients/plan-1?forPortal=1",
      {
        cache: "no-store",
      },
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/profile?forPortal=1&clientSlug=plan-1",
      { credentials: "same-origin" },
    );
    expect(screen.getByTestId("profile")).toHaveTextContent("Ada Advisor");
    expect(screen.getByTestId("state")).toHaveTextContent("false|ok");
  });

  it("shows a skeleton until the plan and the profile have both settled", async () => {
    let releaseProfile: (value: unknown) => void = () => {};
    mocks.fetch.mockImplementation(async (url: string) => {
      if (String(url).startsWith("/api/profile")) {
        return new Promise((resolve) => {
          releaseProfile = resolve;
        });
      }
      return clientPayload();
    });

    const { container } = renderProvider();

    await waitFor(() => expect(clientCalls().length).toBe(1));
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByTestId("name")).not.toBeInTheDocument();

    await act(async () => {
      releaseProfile(profilePayload());
    });
    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
  });

  it("keeps the page working when the profile request fails", async () => {
    mocks.fetch.mockImplementation(async (url: string) => {
      if (String(url).startsWith("/api/profile")) {
        return jsonResponse(500, {});
      }
      return clientPayload();
    });

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
    expect(screen.getByTestId("profile")).toHaveTextContent("none");
  });
});

describe("ClientPortalProvider failures", () => {
  async function expectNotFound() {
    await waitFor(() =>
      expect(screen.getByText("Page Not Found")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("name")).not.toBeInTheDocument();
  }

  it("renders Page Not Found for a 404", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      String(url).startsWith("/api/profile")
        ? profilePayload()
        : jsonResponse(404, {}),
    );

    renderProvider();

    await expectNotFound();
  });

  it("renders Page Not Found for any other failure", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      String(url).startsWith("/api/profile")
        ? profilePayload()
        : jsonResponse(500, {}),
    );

    renderProvider();

    await expectNotFound();
  });

  it("renders Page Not Found when the API answers success:false", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      String(url).startsWith("/api/profile")
        ? profilePayload()
        : jsonResponse(200, { success: false }),
    );

    renderProvider();

    await expectNotFound();
  });

  it("hides an Archived plan behind the same Page Not Found", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      String(url).startsWith("/api/profile")
        ? profilePayload()
        : clientPayload({ status: "Archived" }),
    );

    renderProvider();

    await expectNotFound();
  });

  it("still previews a Draft plan", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      String(url).startsWith("/api/profile")
        ? profilePayload()
        : clientPayload({ status: "Draft" }),
    );

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
  });
});

describe("ClientPortalProvider alias redirect", () => {
  it("redirects a retired slug to the canonical one and keeps the sub-path", async () => {
    mocks.clientId = "old-slug";
    mocks.pathname = "/old-slug/retirement";
    mocks.fetch.mockImplementation(async (url: string) =>
      String(url).startsWith("/api/profile")
        ? profilePayload()
        : clientPayload({}, { isAlias: true, canonicalSlug: "new-slug" }),
    );

    renderProvider();

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/new-slug/retirement"),
    );
  });

  it("does not redirect when the slug is already canonical", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      String(url).startsWith("/api/profile")
        ? profilePayload()
        : clientPayload({}, { isAlias: true, canonicalSlug: "plan-1" }),
    );

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

describe("ClientPortalProvider refetch", () => {
  it("re-fetches with a cache-busting timestamp", async () => {
    const user = userEvent.setup();
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );

    await user.click(screen.getByRole("button", { name: "Refetch" }));

    await waitFor(() => expect(clientCalls().length).toBe(2));
    expect(String(clientCalls()[1][0])).toMatch(
      /^\/api\/clients\/plan-1\?t=\d+&forPortal=1$/,
    );
  });

  it("refetches when this plan's documents are persisted", async () => {
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("plan-documents-persisted", {
          detail: { clientId: "plan-1" },
        }),
      );
    });

    await waitFor(() => expect(clientCalls().length).toBe(2));
  });

  it("ignores events for another plan", async () => {
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("benefits-updated", {
          detail: { clientId: "another-plan" },
        }),
      );
    });

    // Give the listener a tick to (not) fire.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(clientCalls()).toHaveLength(1);
  });

  it("refetches on benefits-updated for this plan", async () => {
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("benefits-updated", { detail: { clientId: "plan-1" } }),
      );
    });

    await waitFor(() => expect(clientCalls().length).toBe(2));
  });
});
