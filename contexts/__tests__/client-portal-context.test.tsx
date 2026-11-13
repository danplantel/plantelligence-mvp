import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mutate } from "swr";

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
  // The provider now warms hub reads into the SWR cache; a leftover entry from one
  // test would make the next test's warm-up a no-op (SWR skips a key it already has).
  void mutate(() => true, undefined, { revalidate: false });
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

/**
 * The one-skeleton contract.
 *
 * A hub page's benefit read used to start only AFTER this provider's skeleton lifted,
 * so participants saw a full-viewport skeleton, then a nearly-complete page, then a
 * second round of per-section skeletons. The provider now warms that read inside its
 * own skeleton — `lib/benefit-hub-data.ts` owns the key both halves use — so the page
 * mounts with the data already in the cache.
 */
describe("ClientPortalProvider hub preload", () => {
  const benefitUrls = () =>
    mocks.fetch.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes("/benefits/"));
  const documentUrls = () =>
    mocks.fetch.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.startsWith("/api/documents/client/"));

  it("keeps the ONE skeleton up until the hub's benefit read has settled", async () => {
    mocks.pathname = "/plan-1/retirement";
    let releaseBenefit: (value: unknown) => void = () => {};
    mocks.fetch.mockImplementation(async (url: string) => {
      const target = String(url);
      if (target.startsWith("/api/profile")) return profilePayload();
      if (target.startsWith("/api/documents/client/")) {
        return jsonResponse(200, { success: true, data: [] });
      }
      if (target.includes("/benefits/")) {
        return new Promise((resolve) => {
          releaseBenefit = resolve;
        });
      }
      return clientPayload();
    });

    const { container } = renderProvider();

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith("/api/clients/plan-1?forPortal=1", {
        cache: "no-store",
      }),
    );
    // The plan answered, but the hub read has not: no page, still the skeleton.
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByTestId("name")).not.toBeInTheDocument();

    await act(async () => {
      releaseBenefit(
        jsonResponse(200, { benefit: { title: "Retirement" }, topics: null }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
  });

  it("warms the exact key each hub page mounts with, documents read included", async () => {
    mocks.pathname = "/plan-1/health-insurance";

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
    expect(benefitUrls()).toContain(
      "/api/clients/plan-1/benefits/Group%20Health?forPortal=1&withTopics=1",
    );
    // Started (not awaited) with the plan read, so the hub's documents grid joins an
    // in-flight request instead of issuing a fresh one on mount.
    expect(documentUrls()).toContain("/api/documents/client/plan-1?forPortal=1");
  });

  it("treats a non-hub route as the Custom hub's card and warms its read", async () => {
    mocks.pathname = "/plan-1/wellness-programs";

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
    expect(benefitUrls()).toContain(
      "/api/clients/plan-1/benefits/Company%20%2F%20Plan%20Sponsor?forPortal=1&withTopics=1",
    );
  });

  it("warms nothing on the landing page or the portal's own tabs", async () => {
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
    expect(benefitUrls()).toHaveLength(0);
    expect(documentUrls()).toHaveLength(0);
  });

  it("does not re-gate or re-fetch the plan when the participant changes tabs", async () => {
    // A client of its own: SWR's preload memo is keyed by URL and remembers the
    // promise it already warmed, so a shared id would make this test a no-op.
    mocks.clientId = "nav-1";
    mocks.pathname = "/nav-1";

    const planReads = () =>
      mocks.fetch.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.startsWith("/api/clients/nav-1?"));

    const view = renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Acme"),
    );
    expect(planReads()).toHaveLength(1);

    // The participant follows a link from the landing page to a hub.
    mocks.pathname = "/nav-1/retirement";
    view.rerender(
      <ClientPortalProvider>
        <Probe />
      </ClientPortalProvider>,
    );

    // The destination hub is warmed …
    await waitFor(() =>
      expect(benefitUrls()).toContain(
        "/api/clients/nav-1/benefits/Retirement?forPortal=1&withTopics=1",
      ),
    );
    // … without blanking the portal or reading the plan a second time.
    expect(document.querySelector(".animate-pulse")).toBeNull();
    expect(screen.getByTestId("name")).toHaveTextContent("Acme");
    expect(planReads()).toHaveLength(1);
  });
});
