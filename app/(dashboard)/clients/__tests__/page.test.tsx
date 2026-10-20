import React from "react";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientsListDashboardPage } from "@/components/pages/clients-list-dashboard";

/**
 * All Plans (View Clients) page.
 *
 * SWR, routing, the debounce hook and the wizard store are mocked, so these
 * tests assert the page's own behaviour: the query it builds, what the table
 * renders, and what each action does. The API contract itself has its own
 * checklist in `docs/testing/clients.md`.
 */

const mocks = vi.hoisted(() => ({
  swrData: null as any,
  swrLoading: false,
  swrKeys: [] as string[],
  mutate: vi.fn(),
  push: vi.fn(),
  prefetch: vi.fn(),
  open: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  storePendingDraftSelection: vi.fn(),
  resetWizard: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("swr", () => ({
  default: (key: string) => {
    mocks.swrKeys.push(key);
    return {
      data: mocks.swrData,
      isLoading: mocks.swrLoading,
      isValidating: false,
      mutate: mocks.mutate,
    };
  },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    prefetch: mocks.prefetch,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// The real Link needs an App Router context that this unit environment does not
// mount; an anchor preserves the href the page computes.
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

// The debounce itself is usehooks-ts' concern; the page only needs the settled
// value, so return it synchronously and assert the query it produces.
vi.mock("usehooks-ts", () => ({
  useDebounceValue: (value: unknown) => [value, value],
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

vi.mock("@/lib/draft-utils", () => ({
  storePendingDraftSelection: mocks.storePendingDraftSelection,
}));

vi.mock("@/lib/marketing/hub-url", () => ({
  getBenefitsHubOpenPortalUrl: (slug: string) => `https://hub.test/${slug}`,
}));

vi.mock("@/lib/comments/portal-surface", () => ({
  withCommentsRail: (url: string) => `${url}?comments=1`,
}));

vi.mock("@/lib/new-client-wizard-store", () => ({
  useNewClientWizardStore: {
    getState: () => ({ resetWizard: mocks.resetWizard }),
  },
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

const activePlan = {
  id: "plan-active",
  slug: "acme",
  companyName: "Acme Corp",
  companyLogo: "https://cdn.test/logo.png",
  brandColor: "#112233",
  status: "Active",
  type: "client",
  createdAt: "2026-01-05T12:00:00",
  updatedAt: "2026-02-10T12:00:00",
  currentStep: 5,
  keyContactsCount: 3,
};

const draftPlan = {
  id: "plan-draft",
  slug: "draft-co",
  companyName: "Draft Co",
  brandColor: "#445566",
  status: "Draft",
  type: "prospect",
  createdAt: "2026-03-01T12:00:00",
  updatedAt: "2026-03-02T12:00:00",
  currentStep: 3,
  keyContactsCount: 0,
};

const archivedPlan = {
  ...activePlan,
  id: "plan-archived",
  slug: "archived-co",
  companyName: "Archived Co",
  status: "Archived",
  type: "client",
  keyContactsCount: 0,
};

function listResponse(
  plans: unknown[] = [activePlan, draftPlan],
  total = plans.length,
  page = 1,
  limit = 25,
) {
  return {
    success: true,
    data: plans,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

function latestKey(): string {
  return mocks.swrKeys[mocks.swrKeys.length - 1] ?? "";
}

function latestParams(): URLSearchParams {
  return new URL(latestKey(), "http://localhost").searchParams;
}

function rowFor(name: string): HTMLElement {
  const cell = screen.getByText(name);
  const row = cell.closest("tr");
  if (!row) throw new Error(`No table row for ${name}`);
  return row;
}

beforeEach(() => {
  mocks.swrKeys.length = 0;
  mocks.swrData = listResponse();
  mocks.swrLoading = false;
  mocks.mutate.mockReset().mockResolvedValue(undefined);
  mocks.push.mockReset();
  mocks.prefetch.mockReset();
  mocks.open.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.toastInfo.mockReset();
  mocks.storePendingDraftSelection.mockReset();
  mocks.resetWizard.mockReset();
  mocks.fetch
    .mockReset()
    .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal("fetch", mocks.fetch);
  window.open = mocks.open as unknown as typeof window.open;
});

describe("ClientsListDashboardPage", () => {
  describe("query construction", () => {
    it("requests the table projection with the default filters, sort and page", () => {
      render(<ClientsListDashboardPage />);

      const params = latestParams();
      expect(params.get("view")).toBe("table");
      expect(params.get("search")).toBe("");
      expect(params.get("status")).toBe("all");
      expect(params.get("type")).toBe("all");
      expect(params.get("page")).toBe("1");
      expect(params.get("limit")).toBe("25");
      expect(params.get("sortColumn")).toBe("updatedAt");
      expect(params.get("sortDirection")).toBe("desc");
    });

    it("sends the typed search term and returns to page 1", async () => {
      const user = userEvent.setup();
      render(<ClientsListDashboardPage />);

      await user.type(screen.getByPlaceholderText("Search plans..."), "Acme");

      expect(latestParams().get("search")).toBe("Acme");
      expect(latestParams().get("page")).toBe("1");
    });

    it("filters by plan type with the quick buttons and resets the page", async () => {
      const user = userEvent.setup();
      mocks.swrData = listResponse([activePlan], 60, 1, 25);
      render(<ClientsListDashboardPage />);

      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(latestParams().get("page")).toBe("2");

      await user.click(screen.getByRole("button", { name: "Prospect" }));
      expect(latestParams().get("type")).toBe("prospect");
      expect(latestParams().get("page")).toBe("1");
    });

    it("filters by status from the Advanced Filter menu", async () => {
      const user = userEvent.setup();
      render(<ClientsListDashboardPage />);

      await user.click(screen.getByRole("button", { name: /Advanced Filter/ }));
      await user.click(
        await screen.findByRole("menuitemradio", { name: "Draft" }),
      );

      expect(latestParams().get("status")).toBe("draft");
      expect(latestParams().get("page")).toBe("1");
    });

    it("toggles each sortable column between ascending and descending", async () => {
      const user = userEvent.setup();
      render(<ClientsListDashboardPage />);

      await user.click(screen.getByRole("button", { name: "Plan" }));
      expect(latestParams().get("sortColumn")).toBe("companyName");
      expect(latestParams().get("sortDirection")).toBe("asc");

      await user.click(screen.getByRole("button", { name: "Plan" }));
      expect(latestParams().get("sortDirection")).toBe("desc");
    });
  });

  describe("table content", () => {
    it("renders logos, initials, badges, dates and contact counts", () => {
      render(<ClientsListDashboardPage />);

      expect(screen.getByAltText("Acme Corp")).toHaveAttribute(
        "src",
        "https://cdn.test/logo.png",
      );
      // Draft Co has no logo, so the brand-coloured initial tile renders.
      expect(screen.getByText("D")).toBeInTheDocument();

      // The quick type filters also render "Client"/"Prospect", so the badge
      // assertions are scoped to their rows.
      const activeRow = within(rowFor("Acme Corp"));
      expect(activeRow.getByText("Active")).toBeInTheDocument();
      expect(activeRow.getByText("Client")).toBeInTheDocument();

      const draftRow = within(rowFor("Draft Co"));
      expect(draftRow.getByText("Draft")).toBeInTheDocument();
      expect(draftRow.getByText("Prospect")).toBeInTheDocument();

      expect(screen.getByText("01/05/26")).toBeInTheDocument();
      expect(screen.getByText("02/10/26")).toBeInTheDocument();
      expect(screen.getByText("3 contacts")).toBeInTheDocument();
      expect(screen.getByText("0 contacts")).toBeInTheDocument();
    });

    it("falls back to a neutral badge for an archived status", () => {
      mocks.swrData = listResponse([archivedPlan]);
      render(<ClientsListDashboardPage />);

      expect(screen.getByText("Archived")).toBeInTheDocument();
    });

    it("shows the skeleton rows while the first page loads", () => {
      mocks.swrLoading = true;
      const { container } = render(<ClientsListDashboardPage />);

      expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
      expect(screen.queryByText("No plans found.")).not.toBeInTheDocument();
    });

    it("shows the empty state when there are no plans", () => {
      mocks.swrData = listResponse([], 0);
      render(<ClientsListDashboardPage />);

      expect(screen.getByText("No plans found.")).toBeInTheDocument();
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    });
  });

  describe("row actions", () => {
    it("opens the hub, documents, meetings and edit destinations", async () => {
      const user = userEvent.setup();
      render(<ClientsListDashboardPage />);
      const row = within(rowFor("Acme Corp"));

      await user.click(row.getByRole("button", { name: "Hub" }));
      expect(mocks.open).toHaveBeenCalledWith(
        "https://hub.test/acme?comments=1",
        "_blank",
      );

      await user.click(row.getByRole("button", { name: "Documents" }));
      expect(mocks.push).toHaveBeenLastCalledWith(
        "/documents?company=Acme+Corp",
      );

      await user.click(row.getByRole("button", { name: "Meetings" }));
      expect(mocks.push).toHaveBeenLastCalledWith(
        "/communications?client=Acme+Corp&clientId=plan-active",
      );

      await user.click(row.getByRole("button", { name: "Edit" }));
      expect(mocks.prefetch).toHaveBeenCalledWith("/edit-client/plan-active");
      expect(mocks.push).toHaveBeenLastCalledWith("/edit-client/plan-active");
    });

    it("keeps Marketing as an informational placeholder", async () => {
      const user = userEvent.setup();
      render(<ClientsListDashboardPage />);

      await user.click(
        within(rowFor("Acme Corp")).getByRole("button", { name: "Marketing" }),
      );

      expect(mocks.toastInfo).toHaveBeenCalledWith(
        "Marketing feature will be implemented soon",
      );
    });

    it("links the contact count to the plan's contacts tab", async () => {
      const user = userEvent.setup();
      render(<ClientsListDashboardPage />);

      await user.click(screen.getByRole("button", { name: "3 contacts" }));

      expect(mocks.push).toHaveBeenCalledWith(
        "/edit-client/plan-active?tab=contacts",
      );
    });

    it("limits a draft to Delete and a resume path", async () => {
      const user = userEvent.setup();
      render(<ClientsListDashboardPage />);
      const row = within(rowFor("Draft Co"));

      expect(
        row.queryByRole("button", { name: "Hub" }),
      ).not.toBeInTheDocument();
      expect(
        row.queryByRole("button", { name: "Documents" }),
      ).not.toBeInTheDocument();
      expect(
        row.queryByRole("button", { name: "Meetings" }),
      ).not.toBeInTheDocument();
      expect(
        row.queryByRole("button", { name: "Marketing" }),
      ).not.toBeInTheDocument();
      expect(
        row.queryByRole("button", { name: "Edit" }),
      ).not.toBeInTheDocument();
      expect(row.getByRole("button", { name: "Delete" })).toBeInTheDocument();

      await user.click(row.getByRole("button", { name: /Finish Setup/ }));

      expect(mocks.storePendingDraftSelection).toHaveBeenCalledWith(
        "plan-draft",
      );
      expect(mocks.push).toHaveBeenCalledWith("/new-client?step=3");
    });
  });

  describe("pagination", () => {
    it("reports the visible range and pages through the result set", async () => {
      const user = userEvent.setup();
      mocks.swrData = listResponse([activePlan], 60, 1, 25);
      render(<ClientsListDashboardPage />);

      expect(
        screen.getByText("Showing 1 to 25 of 60 plans"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(latestParams().get("page")).toBe("2");
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    });

    it("disables Next on the final page", () => {
      mocks.swrData = listResponse([activePlan], 25, 1, 25);
      render(<ClientsListDashboardPage />);

      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });
  });

  describe("refresh", () => {
    it("revalidates the current query", async () => {
      const user = userEvent.setup();
      render(<ClientsListDashboardPage />);

      await user.click(screen.getByRole("button", { name: "Refresh" }));

      expect(mocks.mutate).toHaveBeenCalledTimes(1);
    });
  });

  describe("delete flow", () => {
    it("asks first, cancels without a request, then deletes and revalidates", async () => {
      const user = userEvent.setup();
      render(<ClientsListDashboardPage />);
      const row = within(rowFor("Acme Corp"));

      await user.click(row.getByRole("button", { name: "Delete" }));
      let dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Acme Corp")).toBeInTheDocument();
      expect(
        within(dialog).getByText(/This action cannot be undone/),
      ).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(mocks.fetch).not.toHaveBeenCalled();

      await user.click(row.getByRole("button", { name: "Delete" }));
      dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(mocks.fetch).toHaveBeenCalledWith("/api/clients/plan-active", {
          method: "DELETE",
        }),
      );
      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "Client deleted successfully",
        ),
      );
      expect(mocks.mutate).toHaveBeenCalled();
      // The Create Plan draft must not be resumable after its plan is deleted.
      expect(mocks.resetWizard).toHaveBeenCalled();
    });

    it("reports a failed deletion and leaves the row in place", async () => {
      const user = userEvent.setup();
      // The page logs the failure before toasting; keep the test output clean.
      vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({}) });
      render(<ClientsListDashboardPage />);

      await user.click(
        within(rowFor("Acme Corp")).getByRole("button", { name: "Delete" }),
      );
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Failed to delete client",
        ),
      );
      expect(mocks.mutate).not.toHaveBeenCalled();
      expect(mocks.resetWizard).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
  });
});
