import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The portal's live preview is one contract: an editor patches the draft through
 * `patchClientData`, and every consumer of the context — the page, the header,
 * the theme wrapper — repaints immediately, before anything is saved.
 *
 * Both portal editors depend on this, so it is pinned here against the real
 * provider rather than mocked: a regression would silently turn the Editing
 * Panel back into save-only.
 */

const navigation = vi.hoisted(() => ({
  params: { id: "plan-1" },
  router: { replace: vi.fn() },
}));

// Stable references: the provider's initial-load effect depends on `useRouter()`'s
// identity, so a fresh object per call would re-run (and cancel) the fetch forever,
// leaving the skeleton on screen.
vi.mock("next/navigation", () => ({
  useParams: () => navigation.params,
  usePathname: () => "/plan-1",
  useRouter: () => navigation.router,
}));

import {
  ClientPortalProvider,
  useClientPortal,
} from "@/contexts/client-portal-context";

function Probe() {
  const { clientData, patchClientData } = useClientPortal();
  return (
    <div>
      <span data-testid="hero">{clientData?.heroTitle ?? "none"}</span>
      <span data-testid="company">{clientData?.companyName ?? "none"}</span>
      <button
        type="button"
        onClick={() => patchClientData({ heroTitle: "Draft hero" })}
      >
        patch
      </button>
    </div>
  );
}

const savedPlan = {
  id: "plan-1",
  companyName: "Acme Corp",
  heroTitle: "Saved hero",
  brandColor: "#1F3A60",
  secondaryColor: "#6B7280",
  keyContacts: [],
  provideSpanishVersions: false,
  status: "Active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const fetchMock = vi.fn(async (input: unknown) => {
  const url = String(input);
  return {
    ok: true,
    status: 200,
    json: async () =>
      url.includes("/api/profile")
        ? { name: "An Advisor" }
        : { success: true, data: savedPlan },
  } as unknown as Response;
});

describe("portal live preview", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("repaints consumers when an editor patches the draft", async () => {
    const user = userEvent.setup();
    render(
      <ClientPortalProvider>
        <Probe />
      </ClientPortalProvider>,
    );

    expect(await screen.findByText("Saved hero")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "patch" }));

    // The draft shows up without a refetch — nothing was saved.
    expect(await screen.findByText("Draft hero")).toBeInTheDocument();
    expect(screen.getByTestId("company")).toHaveTextContent("Acme Corp");
  });
});
