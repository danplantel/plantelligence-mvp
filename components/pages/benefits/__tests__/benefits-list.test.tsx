import React from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsListPage } from "@/components/pages/benefits/benefits-list";

/**
 * Client half of Browse Benefits.
 *
 * SWR, next/navigation and the two shared child components are mocked so these
 * tests assert this page's own rules: which read it makes, which state the card
 * renders, and what each row action does.
 */

type SwrCall = { key: string | null; options: any };

const mocks = vi.hoisted(() => ({
  swrCalls: [] as SwrCall[],
  benefitsData: null as any,
  benefitsError: null as any,
  benefitsLoading: false,
  benefitsMutate: vi.fn(),
  planListData: null as any,
  planListError: null as any,
  planListLoading: false,
  planListMutate: vi.fn(),
  assignmentsData: null as any,
  push: vi.fn(),
  setTitle: vi.fn(),
  isCollaborator: false,
  can: vi.fn(() => true),
  getLastPlanId: vi.fn(() => null as string | null),
  getRecentPlanIds: vi.fn(() => [] as string[]),
  persistPlanSelection: vi.fn(),
  readPersistedBenefitsDraft: vi.fn(() => null as any),
  planSearchProps: null as any,
  orgCategories: null as string[] | null,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  open: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("swr", () => ({
  default: (key: string | null, _fetcher: unknown, options: any) => {
    mocks.swrCalls.push({ key, options });

    if (!key) {
      return {
        data: undefined,
        error: null,
        isLoading: false,
        mutate: vi.fn(),
      };
    }
    if (key === "/api/benefits") {
      return {
        data: mocks.benefitsData,
        error: mocks.benefitsError,
        isLoading: mocks.benefitsLoading,
        mutate: mocks.benefitsMutate,
      };
    }
    if (key.startsWith("/api/clients?")) {
      return {
        data: mocks.planListData,
        error: mocks.planListError,
        isLoading: mocks.planListLoading,
        mutate: mocks.planListMutate,
      };
    }
    if (key.startsWith("/api/teammates/plan-assignments")) {
      return {
        data: mocks.assignmentsData,
        error: null,
        isLoading: false,
        mutate: vi.fn(),
      };
    }
    return {
      data: undefined,
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    };
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, prefetch: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({ setTitle: mocks.setTitle }),
}));

vi.mock("@/hooks/useViewerAccess", () => ({
  useViewerAccess: () => ({
    isCollaborator: mocks.isCollaborator,
    can: mocks.can,
  }),
}));

vi.mock("@/lib/plan-selector-storage", () => ({
  getLastPlanId: mocks.getLastPlanId,
  getRecentPlanIds: mocks.getRecentPlanIds,
  persistPlanSelection: mocks.persistPlanSelection,
}));

vi.mock("@/lib/benefits-wizard-store", () => ({
  BENEFITS_WIZARD_STORAGE_KEY: "benefits-wizard",
  readPersistedBenefitsDraft: mocks.readPersistedBenefitsDraft,
}));

vi.mock("@/lib/benefit-draft", () => ({
  normalizeBenefitCategoryKey: (value: string | null | undefined) =>
    (value || "").toLowerCase().trim().replace(/\s+/g, " "),
  toApiBenefitCategory: (value: string) =>
    value === "Custom" ? "Company / Plan Sponsor" : value,
}));

vi.mock("@/lib/marketing/hub-url", () => ({
  getBenefitsHubOpenPortalUrl: (slug: string) => `https://hub.test/${slug}`,
  getBenefitPortalSegment: (category: string, customName?: string | null) => {
    if (category === "Retirement") return "retirement";
    if (category === "Group Health") return "health-insurance";
    if (category === "Group Life") return "life-insurance";
    if (category === "Company / Plan Sponsor") {
      return customName
        ? customName.toLowerCase().replace(/\s+/g, "-")
        : "wellness-programs";
    }
    return "";
  },
}));

vi.mock("@/lib/comments/portal-surface", () => ({
  withCommentsRail: (url: string) => `${url}?comments=on`,
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ alt }: any) => <span data-testid="headshot">{alt}</span>,
}));

vi.mock("@/components/plan-selector/plan-search-bar", () => ({
  PlanSearchBar: (props: any) => {
    mocks.planSearchProps = props;
    return (
      <div
        data-testid="plan-search"
        data-active-only={String(props.activeOnly)}
        data-value={props.value}
      >
        {props.plans.map((plan: any) => (
          <button
            key={plan.id}
            data-testid={`plan-choice-${plan.id}`}
            onClick={() => props.onChange(plan.id)}
          >
            {plan.companyName}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock("@/components/pages/benefits/org-service-categories", () => ({
  OrgServiceCategories: ({ categories }: { categories: string[] }) => {
    mocks.orgCategories = categories;
    return <div data-testid="org-strip">{categories.join(", ")}</div>;
  },
}));

const plans = [
  {
    id: "plan-1",
    companyName: "Acme Corp",
    slug: "acme",
    status: "Active",
  },
  {
    id: "plan-2",
    companyName: "Beta LLC",
    slug: "beta",
    status: "Active",
  },
  {
    id: "plan-draft",
    companyName: "Draft Co",
    slug: "draft-co",
    status: "Draft",
  },
];

function row(overrides: Record<string, unknown> = {}) {
  return {
    planId: "plan-1",
    planName: "Acme Corp",
    planSlug: "acme",
    planStatus: "Active",
    category: "Retirement",
    label: "Retirement Plan Benefits",
    visibilityKey: "Retirement",
    title: "Retirement Plan Benefits",
    partnerLogo: null,
    keyContact: null,
    isEnabled: true,
    exists: true,
    planVisibility: {
      Retirement: true,
      "Group Health": true,
      "Group Life": true,
      Other: true,
    },
    isComplete: true,
    missingInfo: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <BenefitsListPage orgCategories={["Retirement", "Group Health"]} />,
  );
}

function callsFor(prefix: string) {
  return mocks.swrCalls.filter((call) => call.key?.startsWith(prefix));
}

function lastCallFor(prefix: string) {
  return callsFor(prefix)[callsFor(prefix).length - 1];
}

function fetchCall(index: number) {
  return mocks.fetch.mock.calls[index];
}

beforeEach(() => {
  // The 404-benefit-flag branch warns by design; the assertion is on the toast.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.swrCalls.length = 0;
  mocks.benefitsData = { benefits: [row()] };
  mocks.benefitsError = null;
  mocks.benefitsLoading = false;
  mocks.benefitsMutate.mockReset().mockResolvedValue(undefined);
  mocks.planListData = { data: plans };
  mocks.planListError = null;
  mocks.planListLoading = false;
  mocks.planListMutate.mockReset().mockResolvedValue(undefined);
  mocks.assignmentsData = { assignments: [] };
  mocks.push.mockReset();
  mocks.setTitle.mockReset();
  mocks.isCollaborator = false;
  mocks.can.mockReset().mockReturnValue(true);
  mocks.getLastPlanId.mockReset().mockReturnValue(null);
  mocks.getRecentPlanIds.mockReset().mockReturnValue([]);
  mocks.persistPlanSelection.mockReset();
  mocks.readPersistedBenefitsDraft.mockReset().mockReturnValue(null);
  mocks.planSearchProps = null;
  mocks.orgCategories = null;
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.open.mockReset();
  window.open = mocks.open as unknown as typeof window.open;
  mocks.fetch.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("BenefitsListPage", () => {
  describe("reads", () => {
    it("requests every plan's benefits with a plan-independent key and fresh-mount options", async () => {
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      const call = lastCallFor("/api/benefits");
      expect(call?.key).toBe("/api/benefits");
      expect(call?.options).toMatchObject({
        dedupingInterval: 0,
        revalidateOnMount: true,
        revalidateOnFocus: false,
      });
    });

    it("requests the slim summary projection for the picker", async () => {
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      expect(lastCallFor("/api/clients")?.key).toBe(
        "/api/clients?status=all&limit=500&sortColumn=companyName&sortDirection=asc&summary=1",
      );
      expect(lastCallFor("/api/clients")?.options).toMatchObject({
        keepPreviousData: true,
        dedupingInterval: 60_000,
        revalidateOnFocus: false,
      });
    });

    it("keys the assignment read on the selected plan", async () => {
      renderPage();

      // The hook is mounted with a null key until selection resolves.
      expect(mocks.swrCalls.some((call) => call.key === null)).toBe(true);
      await screen.findByText("Retirement Plan Benefits");
      expect(lastCallFor("/api/teammates/plan-assignments")?.key).toBe(
        "/api/teammates/plan-assignments?planId=plan-1",
      );
    });

    it("sets the page title", async () => {
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      expect(mocks.setTitle).toHaveBeenCalledWith("Benefits");
    });
  });

  describe("plan selection", () => {
    it("restores the module's sticky plan", async () => {
      mocks.getLastPlanId.mockReturnValue("plan-2");
      mocks.benefitsData = {
        benefits: [row({ planId: "plan-2", planName: "Beta LLC" })],
      };
      renderPage();

      await waitFor(() => expect(mocks.planSearchProps?.value).toBe("plan-2"));
      expect(mocks.readPersistedBenefitsDraft).toHaveBeenCalled();
    });

    it("falls back to the shared MRU when the sticky plan is gone", async () => {
      mocks.getLastPlanId.mockReturnValue("missing-plan");
      mocks.getRecentPlanIds.mockReturnValue(["plan-2"]);
      mocks.benefitsData = {
        benefits: [row({ planId: "plan-2", planName: "Beta LLC" })],
      };
      renderPage();

      await waitFor(() => expect(mocks.planSearchProps?.value).toBe("plan-2"));
    });

    it("falls back to the first selectable plan", async () => {
      renderPage();

      await waitFor(() => expect(mocks.planSearchProps?.value).toBe("plan-1"));
    });

    it("persists a new selection and re-scopes the assignments read", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(mocks.planSearchProps?.value).toBe("plan-1"));

      await user.click(screen.getByTestId("plan-choice-plan-2"));

      expect(mocks.persistPlanSelection).toHaveBeenCalledWith(
        "benefits",
        "plan-2",
      );
      await waitFor(() =>
        expect(lastCallFor("/api/teammates/plan-assignments")?.key).toBe(
          "/api/teammates/plan-assignments?planId=plan-2",
        ),
      );
    });

    it("offers only Active plans to an advisor", async () => {
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      expect(mocks.planSearchProps.plans.map((plan: any) => plan.id)).toEqual([
        "plan-1",
        "plan-2",
      ]);
      expect(mocks.planSearchProps.activeOnly).toBe(true);
    });

    it("offers every assigned plan, Draft included, to a collaborator", async () => {
      mocks.isCollaborator = true;
      mocks.planListData = { data: plans };
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      expect(mocks.planSearchProps.plans.map((plan: any) => plan.id)).toEqual([
        "plan-1",
        "plan-2",
        "plan-draft",
      ]);
      expect(mocks.planSearchProps.activeOnly).toBe(false);
    });
  });

  describe("content states", () => {
    it("renders the plan-card skeleton while the plan list loads", () => {
      mocks.planListData = null;
      mocks.planListLoading = true;
      renderPage();

      expect(
        screen.getByText(/Loading this plan’s benefits/),
      ).toBeInTheDocument();
    });

    it("shows the plan-list failure with a retry", async () => {
      const user = userEvent.setup();
      mocks.planListData = null;
      mocks.planListError = new Error("offline");
      renderPage();

      expect(
        await screen.findByText("Couldn't load your plans"),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Try again/ }));
      expect(mocks.planListMutate).toHaveBeenCalled();
    });

    it("shows the advisor no-plans state with both create actions", async () => {
      const user = userEvent.setup();
      mocks.planListData = { data: [] };
      renderPage();

      expect(
        await screen.findByText(
          "No plans yet. Create a plan first, then add its benefits.",
        ),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Create Plan" }));
      expect(mocks.push).toHaveBeenCalledWith("/new-client");

      await user.click(screen.getByRole("button", { name: /Create Benefit/ }));
      expect(mocks.push).toHaveBeenCalledWith("/new-benefits");
    });

    it("shows the collaborator no-plans state without create actions", async () => {
      mocks.isCollaborator = true;
      mocks.planListData = { data: [] };
      renderPage();

      expect(
        await screen.findByText(/You haven’t been added to a plan yet/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Create Plan" }),
      ).not.toBeInTheDocument();
    });

    it("shows No active plans when every plan is Draft", async () => {
      const user = userEvent.setup();
      mocks.planListData = { data: [plans[2]] };
      renderPage();

      expect(await screen.findByText(/No active plans\./)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "View Plans" }));
      expect(mocks.push).toHaveBeenCalledWith("/clients");
    });

    it("shows the benefits failure with a retry", async () => {
      const user = userEvent.setup();
      mocks.benefitsData = null;
      mocks.benefitsError = new Error("benefits offline");
      renderPage();

      expect(
        await screen.findByText("Couldn't load this plan's benefits"),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Try again/ }));
      expect(mocks.benefitsMutate).toHaveBeenCalled();
    });

    it("keeps a cached plan list usable when a later revalidation fails", async () => {
      mocks.planListError = new Error("revalidation failed");
      renderPage();

      expect(
        await screen.findByText("Retirement Plan Benefits"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Couldn't load your plans"),
      ).not.toBeInTheDocument();
    });

    it("keeps cached benefits visible when a later read fails", async () => {
      mocks.benefitsError = new Error("revalidation failed");
      renderPage();

      expect(
        await screen.findByText("Retirement Plan Benefits"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Couldn't load this plan's benefits"),
      ).not.toBeInTheDocument();
    });
  });

  describe("rows", () => {
    it("titles the card with the selected plan and the owner subtitle", async () => {
      renderPage();

      expect(
        await screen.findByRole("heading", { name: "Acme Corp" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Publish, hide, and edit this plan’s benefit pages."),
      ).toBeInTheDocument();
    });

    it("uses the collaborator subtitle", async () => {
      mocks.isCollaborator = true;
      renderPage();

      expect(
        await screen.findByText(
          "The benefit sections you have access to on this plan.",
        ),
      ).toBeInTheDocument();
    });

    it("renders only rows for the selected plan", async () => {
      mocks.benefitsData = {
        benefits: [
          row(),
          row({ planId: "plan-2", planName: "Beta LLC", label: "Beta only" }),
        ],
      };
      renderPage();

      expect(
        await screen.findByText("Retirement Plan Benefits"),
      ).toBeInTheDocument();
      expect(screen.queryByText("Beta only")).not.toBeInTheDocument();
    });

    it("shows the no-rows message for a plan with no benefits", async () => {
      mocks.benefitsData = { benefits: [] };
      renderPage();

      expect(
        await screen.findByText("No benefits found for this plan."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Plan Benefits" }),
      ).toBeInTheDocument();
    });

    it("renders a custom title as a secondary note on a standard category", async () => {
      mocks.benefitsData = {
        benefits: [row({ title: "Your Retirement Journey" })],
      };
      renderPage();

      expect(
        await screen.findByText("Retirement Plan Benefits"),
      ).toBeInTheDocument();
      expect(screen.getByText("Your Retirement Journey")).toBeInTheDocument();
    });

    it("suppresses the wizard's default welcome title", async () => {
      mocks.benefitsData = {
        benefits: [row({ title: "Welcome to Acme!" })],
      };
      renderPage();

      await screen.findByText("Retirement Plan Benefits");
      expect(screen.queryByText("Welcome to Acme!")).not.toBeInTheDocument();
    });

    it("uses the saved name as the Custom hub headline", async () => {
      mocks.benefitsData = {
        benefits: [
          row({
            category: "Company / Plan Sponsor",
            label: "Wellness Programs",
            visibilityKey: "Other",
            title: "Mindfulness and Me",
          }),
        ],
      };
      renderPage();

      expect(await screen.findByText("Mindfulness and Me")).toBeInTheDocument();
      expect(screen.queryByText("Wellness Programs")).not.toBeInTheDocument();
    });

    it("falls back to Custom for an unnamed hub", async () => {
      mocks.benefitsData = {
        benefits: [
          row({
            category: "Company / Plan Sponsor",
            label: "Wellness Programs",
            visibilityKey: "Other",
            title: "Welcome to Acme!",
          }),
        ],
      };
      renderPage();

      expect(await screen.findByText("Custom")).toBeInTheDocument();
    });

    it("renders completeness and one chip per missing item", async () => {
      mocks.benefitsData = {
        benefits: [
          row({
            isComplete: false,
            missingInfo: ["Description missing", "Plan documents missing"],
          }),
        ],
      };
      renderPage();

      expect(await screen.findByText("Incomplete")).toBeInTheDocument();
      expect(screen.getByText("Description missing")).toBeInTheDocument();
      expect(screen.getByText("Plan documents missing")).toBeInTheDocument();
    });

    it("renders Complete for a finished row", async () => {
      renderPage();

      expect(await screen.findByText("Complete")).toBeInTheDocument();
    });
  });

  describe("row actions", () => {
    it("opens the Edit Benefit page from View", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      await user.click(screen.getByRole("button", { name: /View/ }));

      expect(mocks.push).toHaveBeenCalledWith(
        "/edit-benefit/plan-1/retirement",
      );
    });

    it("offers Add for a missing benefit and deep-links the wizard", async () => {
      const user = userEvent.setup();
      mocks.benefitsData = { benefits: [row({ exists: false })] };
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      expect(screen.getByText("Not created")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Add/ }));

      expect(mocks.push).toHaveBeenCalledWith(
        "/new-benefits?planId=plan-1&category=Retirement",
      );
    });

    it("labels a persisted draft and offers Continue", async () => {
      mocks.benefitsData = { benefits: [row({ exists: false })] };
      mocks.readPersistedBenefitsDraft.mockReturnValue({
        planId: "plan-1",
        benefitCategory: "Retirement",
      });
      renderPage();

      expect(await screen.findByText("Draft")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Continue/ }),
      ).toBeInTheDocument();
    });

    it("does not label a row Draft when the benefit already exists", async () => {
      mocks.readPersistedBenefitsDraft.mockReturnValue({
        planId: "plan-1",
        benefitCategory: "Retirement",
      });
      renderPage();

      await screen.findByText("Published");
      expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    });

    it("hides Add for a collaborator on a missing row", async () => {
      mocks.isCollaborator = true;
      mocks.benefitsData = { benefits: [row({ exists: false })] };
      renderPage();
      await screen.findByText("Not created");

      expect(
        screen.queryByRole("button", { name: /Add/ }),
      ).not.toBeInTheDocument();
    });

    it("hides Add when the viewer cannot edit benefits", async () => {
      mocks.can.mockReturnValue(false);
      mocks.benefitsData = { benefits: [row({ exists: false })] };
      renderPage();
      await screen.findByText("Not created");

      expect(
        screen.queryByRole("button", { name: /Add/ }),
      ).not.toBeInTheDocument();
    });

    it("shows Published/Hidden and a Switch for an owner", async () => {
      renderPage();

      expect(await screen.findByText("Published")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("shows Published/Hidden as text with no Switch for a collaborator", async () => {
      mocks.isCollaborator = true;
      renderPage();

      expect(await screen.findByText("Published")).toBeInTheDocument();
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("opens the section's portal page for a collaborator", async () => {
      const user = userEvent.setup();
      mocks.isCollaborator = true;
      renderPage();
      await screen.findByText("Published");

      await user.click(
        screen.getByRole("button", { name: /Open the portal page/ }),
      );

      expect(mocks.open).toHaveBeenCalledWith(
        "https://hub.test/acme/retirement?comments=on",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  describe("assignees", () => {
    it("lists collaborators plus the Key Contact and excludes contact-mirror rows", async () => {
      mocks.benefitsData = {
        benefits: [
          row({ keyContact: { id: "kc", name: "Kai", headshot: null } }),
        ],
      };
      mocks.assignmentsData = {
        assignments: [
          {
            assignmentId: "a1",
            name: "Ada",
            categoryScope: "selected",
            categories: ["Retirement"],
          },
          {
            assignmentId: "a2",
            name: "Bob",
            categoryScope: "selected",
            categories: [" retirement "],
          },
          {
            assignmentId: "a3",
            name: "Mirror",
            categoryScope: "selected",
            categories: ["Retirement"],
            state: "contact",
          },
        ],
      };
      renderPage();

      expect(
        await screen.findByText("Assigned to Ada, Bob, Kai"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Mirror/)).not.toBeInTheDocument();
    });

    it("adds an all-categories assignment to every card", async () => {
      mocks.assignmentsData = {
        assignments: [
          {
            assignmentId: "all-1",
            name: "Cara",
            categoryScope: "all",
            categories: [],
          },
        ],
      };
      renderPage();

      expect(await screen.findByText("Assigned to Cara")).toBeInTheDocument();
    });

    it("caps visible headshots at three and reports the overflow", async () => {
      mocks.assignmentsData = {
        assignments: ["Ada", "Bob", "Cara", "Dan"].map((name, index) => ({
          assignmentId: `a${index}`,
          name,
          categoryScope: "all",
          categories: [],
        })),
      };
      renderPage();

      expect(
        await screen.findByText("Assigned to Ada, Bob, Cara, Dan"),
      ).toBeInTheDocument();
      expect(screen.getByText("+1")).toBeInTheDocument();
      expect(screen.getAllByTestId("headshot")).toHaveLength(3);
    });

    it("reports the missing-field count once the row exists and is incomplete", async () => {
      mocks.benefitsData = {
        benefits: [
          row({
            isComplete: false,
            missingInfo: ["Description missing"],
          }),
        ],
      };
      mocks.assignmentsData = {
        assignments: [
          {
            assignmentId: "a1",
            name: "Ada",
            categoryScope: "all",
            categories: [],
          },
        ],
      };
      renderPage();

      expect(
        await screen.findByText(/Assigned to Ada · 1 field missing/),
      ).toBeInTheDocument();
    });
  });

  describe("publish toggle", () => {
    it("sends the full visibility map and the benefit flag, then reports success", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Published");

      await user.click(screen.getByRole("switch"));

      await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));

      const [visibilityUrl, visibilityInit] = fetchCall(0);
      expect(visibilityUrl).toBe("/api/clients/plan-1");
      expect(visibilityInit.method).toBe("PUT");
      expect(JSON.parse(visibilityInit.body)).toEqual({
        categoryPortalVisibility: {
          Retirement: false,
          "Group Health": true,
          "Group Life": true,
          Other: true,
        },
      });

      const [benefitUrl, benefitInit] = fetchCall(1);
      expect(benefitUrl).toBe("/api/clients/plan-1/benefits/Retirement");
      expect(JSON.parse(benefitInit.body)).toEqual({ isEnabled: false });

      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Retirement Plan Benefits hidden",
        expect.objectContaining({
          description: "This benefit is now hidden on the Benefits Hub.",
        }),
      );
      expect(mocks.benefitsMutate).toHaveBeenCalled();
    });

    it("reports a failed visibility write and revalidates", async () => {
      const user = userEvent.setup();
      mocks.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      renderPage();
      await screen.findByText("Published");

      await user.click(screen.getByRole("switch"));

      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Failed to save visibility",
          expect.objectContaining({ description: "Failed to save visibility" }),
        ),
      );
      expect(mocks.benefitsMutate).toHaveBeenCalled();
    });

    it("still reports success when only the benefit flag write fails", async () => {
      const user = userEvent.setup();
      mocks.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
        });
      renderPage();
      await screen.findByText("Published");

      await user.click(screen.getByRole("switch"));

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "Retirement Plan Benefits hidden",
          expect.anything(),
        ),
      );
      expect(mocks.toastError).not.toHaveBeenCalled();
    });

    it("preserves other visibility keys already set to false", async () => {
      const user = userEvent.setup();
      mocks.benefitsData = {
        benefits: [
          row({
            planVisibility: {
              Retirement: true,
              "Group Health": false,
              "Group Life": false,
              Other: true,
            },
          }),
        ],
      };
      renderPage();
      await screen.findByText("Published");

      await user.click(screen.getByRole("switch"));

      await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
      expect(JSON.parse(fetchCall(0)[1].body)).toEqual({
        categoryPortalVisibility: {
          Retirement: false,
          "Group Health": false,
          "Group Life": false,
          Other: true,
        },
      });
    });

    it("treats a row with no visibility map as empty when toggling", async () => {
      const user = userEvent.setup();
      mocks.benefitsData = { benefits: [row({ planVisibility: undefined })] };
      renderPage();
      await screen.findByText("Published");

      await user.click(screen.getByRole("switch"));

      await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
      expect(JSON.parse(fetchCall(0)[1].body)).toEqual({
        categoryPortalVisibility: { Retirement: false },
      });
    });

    it("writes once per row when two row toggles overlap", async () => {
      const user = userEvent.setup();
      mocks.benefitsData = {
        benefits: [
          row(),
          row({
            category: "Group Health",
            label: "Health Insurance",
            visibilityKey: "Group Health",
            title: "Health Insurance",
          }),
        ],
      };
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(2);

      await user.click(switches[0]);
      await user.click(switches[1]);

      await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(4));
      const urls = mocks.fetch.mock.calls.map(([url]) => String(url));
      expect(urls.filter((url) => url === "/api/clients/plan-1")).toHaveLength(
        2,
      );
      expect(urls).toContain("/api/clients/plan-1/benefits/Retirement");
      expect(urls).toContain("/api/clients/plan-1/benefits/Group%20Health");

      const visibilityBodies = mocks.fetch.mock.calls
        .filter(([url]) => String(url) === "/api/clients/plan-1")
        .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
      expect(visibilityBodies).toEqual([
        expect.objectContaining({
          categoryPortalVisibility: expect.objectContaining({
            Retirement: false,
          }),
        }),
        expect.objectContaining({
          categoryPortalVisibility: expect.objectContaining({
            "Group Health": false,
          }),
        }),
      ]);
    });
  });

  describe("cross-tab updates", () => {
    it("revalidates on benefits-updated", async () => {
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      act(() => {
        window.dispatchEvent(new Event("benefits-updated"));
      });

      expect(mocks.benefitsMutate).toHaveBeenCalled();
    });

    it("removes the listener on unmount", async () => {
      const view = renderPage();
      await screen.findByText("Retirement Plan Benefits");
      mocks.benefitsMutate.mockClear();

      view.unmount();
      act(() => {
        window.dispatchEvent(new Event("benefits-updated"));
      });

      expect(mocks.benefitsMutate).not.toHaveBeenCalled();
    });
  });

  describe("organization strip", () => {
    it("renders the server-supplied categories for an advisor", async () => {
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      expect(screen.getByTestId("org-strip")).toHaveTextContent(
        "Retirement, Group Health",
      );
      expect(mocks.orgCategories).toEqual(["Retirement", "Group Health"]);
    });

    it("omits the strip for a collaborator", async () => {
      mocks.isCollaborator = true;
      renderPage();
      await screen.findByText("Retirement Plan Benefits");

      expect(screen.queryByTestId("org-strip")).not.toBeInTheDocument();
    });
  });

  describe("malformed payloads", () => {
    it("treats a missing plan array as no plans", async () => {
      mocks.planListData = { data: null };
      renderPage();

      expect(
        await screen.findByText(
          "No plans yet. Create a plan first, then add its benefits.",
        ),
      ).toBeInTheDocument();
    });

    it("treats a non-array benefits payload as no rows", async () => {
      mocks.benefitsData = { benefits: null };
      renderPage();

      expect(
        await screen.findByText("No benefits found for this plan."),
      ).toBeInTheDocument();
    });
  });
});
