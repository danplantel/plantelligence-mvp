import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setTitle: vi.fn(),
  setSubtitle: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetch: vi.fn(),
  mutateAssets: vi.fn(),
  getLastPlanId: vi.fn(),
  resolveStickyPlanId: vi.fn(),
  categoryDisclaimer: vi.fn(),
  renderFlyerPreviewToSvg: vi.fn(),
  svgElementToDataUrl: vi.fn(),
  generateFlyerPdfBlob: vi.fn(),
  resolveQrImageDataUrl: vi.fn(),
  clientsLoading: false,
  assetsLoading: false,
  assetsError: undefined as unknown,
  clientsData: { data: [] } as any,
  assetsData: { data: [] } as any,
  profileData: { advisorLogoUrl: "advisor-logo" } as any,
  planData: { data: { companyLogo: "plan-logo" } } as any,
}));

vi.mock("swr", () => ({
  default: (key: string | null) => {
    if (!key) {
      return { data: undefined, isLoading: false, mutate: mocks.mutateAssets };
    }
    if (key === "/api/profile") {
      return { data: mocks.profileData, isLoading: false };
    }
    if (key.startsWith("/api/clients/")) {
      return { data: mocks.planData, isLoading: false };
    }
    if (key.startsWith("/api/marketing/assets")) {
      return {
        data: mocks.assetsData,
        isLoading: mocks.assetsLoading,
        mutate: mocks.mutateAssets,
        error: mocks.assetsError,
      };
    }
    if (key.startsWith("/api/clients?")) {
      return { data: mocks.clientsData, isLoading: mocks.clientsLoading };
    }
    return { data: undefined, isLoading: false };
  },
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    setTitle: mocks.setTitle,
    setSubtitle: mocks.setSubtitle,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/plan-selector-storage", () => ({
  getLastPlanId: mocks.getLastPlanId,
  resolveStickyPlanId: mocks.resolveStickyPlanId,
}));

vi.mock("@/lib/disclaimer-constants", () => ({
  getFlyerCategoryDisclaimer: mocks.categoryDisclaimer,
}));

vi.mock("@/lib/marketing/flyer-pdf", () => ({
  renderFlyerPreviewToSvg: mocks.renderFlyerPreviewToSvg,
  svgElementToDataUrl: mocks.svgElementToDataUrl,
  generateFlyerPdfBlob: mocks.generateFlyerPdfBlob,
  resolveQrImageDataUrl: mocks.resolveQrImageDataUrl,
}));

vi.mock("@/components/plan-selector/plan-search-bar", () => ({
  PlanSearchBar: ({ plans, value, onChange, title, module, disabled }: any) => (
    <div
      data-testid="plan-search-bar"
      data-module={module}
      data-value={value}
      data-disabled={String(!!disabled)}
    >
      <span>{title}</span>
      {plans.map((plan: any) => (
        <button
          key={plan.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(plan.id)}
        >
          select-{plan.companyName}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/ui/plan-change-loading-dialog", () => ({
  PlanChangeLoadingDialog: ({ open }: any) =>
    open ? <div data-testid="plan-loading" /> : null,
}));

vi.mock("@/components/pages/marketing/marketing-asset-modal", () => ({
  default: (props: any) => (
    <div
      data-testid="marketing-modal"
      data-open={String(!!props.open)}
      data-type={props.assetType}
      data-plan-id={props.planId}
      data-plan-name={props.planName}
      data-step={props.initialFlyerStep ?? ""}
      data-element={props.initialPortalElement ?? ""}
      data-preview={String(!!props.previewOnly)}
      data-edit-id={props.editingAsset?.id ?? ""}
    >
      <button type="button" onClick={() => props.onOpenChange(false)}>
        close-modal
      </button>
      <button type="button" onClick={() => props.onSave?.()}>
        save-modal
      </button>
      <button type="button" onClick={() => props.onEditFromPreview?.()}>
        edit-from-preview
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionTrigger: ({ children }: any) => <div>{children}</div>,
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

import MarketingPage from "../page";

const CLIENTS = [
  { id: "plan-1", companyName: "Acme Corp", status: "Active" },
  { id: "plan-2", companyName: "Beta LLC", status: "Active" },
  { id: "archived-1", companyName: "Old Co", status: "Archived" },
];

const ASSETS = [
  {
    id: "flyer-1",
    type: "flyer",
    createdAt: "2026-01-01T00:00:00Z",
    status: "Draft",
    headline: "Retirement Flyer",
    body: "Body",
    bgColor: "#23919c",
    startDate: "2026-03-01",
    data: {
      flyerTemplate: "MeetingTemplate1",
      flyerCategory: "Retirement",
      meetingType: "Webinar",
      flyerQrUrl: "https://qr.example",
      flyerQrDataUrl: "data:qr",
      flyerSubtitle: "Subtitle",
      flyerImage: "data:image",
      meetingTime: "10:00 AM",
      meetingLocation: "Zoom",
      disclaimerText: "Securities and advisory services offered through X",
    },
  },
  {
    id: "flyer-2",
    type: "flyer",
    createdAt: "2026-01-02T00:00:00Z",
    status: "Published",
    headline: "Topical Flyer",
    body: "Body",
    data: {
      flyerTemplate: "TopicalTemplate1",
      flyerCategory: "Group Health",
    },
  },
  {
    id: "notice-1",
    type: "portal-notice",
    createdAt: "2026-01-03T00:00:00Z",
    status: "Published",
    headline: "Open Enrollment",
  },
  {
    id: "popup-1",
    type: "pop-up",
    createdAt: "2026-01-04T00:00:00Z",
    status: "Draft",
    headline: "Popup",
  },
  {
    id: "news-1",
    type: "news-post",
    createdAt: "2026-01-05T00:00:00Z",
    status: "Hidden",
    headline: "News",
  },
];

function jsonResponse(payload: any, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => payload };
}

function renderPage() {
  return render(<MarketingPage />);
}

function rowFor(text: string): HTMLElement {
  const title = screen.getByText(text);
  return title.closest("div.flex-1")?.parentElement as HTMLElement;
}

function rowForMeta(text: string | RegExp): HTMLElement {
  const meta = screen.getByText(text);
  return meta.closest("div.flex-1")?.parentElement as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientsLoading = false;
  mocks.assetsLoading = false;
  mocks.assetsError = undefined;
  mocks.clientsData = { data: CLIENTS };
  mocks.assetsData = { data: ASSETS };
  mocks.profileData = { advisorLogoUrl: "advisor-logo" };
  mocks.planData = { data: { companyLogo: "plan-logo" } };
  mocks.getLastPlanId.mockReturnValue("plan-1");
  mocks.resolveStickyPlanId.mockReturnValue("plan-1");
  mocks.categoryDisclaimer.mockReturnValue("category disclaimer");
  mocks.renderFlyerPreviewToSvg.mockResolvedValue({});
  mocks.svgElementToDataUrl.mockResolvedValue("data:image/svg+xml;base64,abc");
  mocks.generateFlyerPdfBlob.mockResolvedValue(new Blob(["pdf"]));
  mocks.resolveQrImageDataUrl.mockResolvedValue("data:qr-resolved");

  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(jsonResponse({ success: true }));

  Object.defineProperty(window.URL, "createObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(() => "blob:pdf"),
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("Marketing page shell", () => {
  it("shows the client skeleton while plans load", () => {
    mocks.clientsLoading = true;

    const { container } = renderPage();

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("plan-search-bar")).not.toBeInTheDocument();
  });

  it("renders the picker with the marketing module and non-archived clients", async () => {
    renderPage();

    const picker = await screen.findByTestId("plan-search-bar");
    expect(picker).toHaveAttribute("data-module", "marketing");
    expect(within(picker).getByText("Marketing")).toBeInTheDocument();
    expect(within(picker).getByText("select-Acme Corp")).toBeInTheDocument();
    expect(within(picker).getByText("select-Beta LLC")).toBeInTheDocument();
    expect(within(picker).queryByText("select-Old Co")).not.toBeInTheDocument();
  });

  it("sets the page title", () => {
    renderPage();

    expect(mocks.setTitle).toHaveBeenCalledWith("Marketing");
  });

  it("restores the sticky marketing plan and publishes its subtitle", async () => {
    renderPage();

    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp"),
    );
    expect(mocks.resolveStickyPlanId).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "plan-1" })]),
      "marketing",
      null,
    );
  });

  it("does not select a plan without a stored marketing selection", async () => {
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);

    renderPage();

    await screen.findByTestId("plan-search-bar");
    expect(screen.queryByText("Create Marketing Asset")).not.toBeInTheDocument();
    expect(screen.queryByTestId("marketing-modal")).not.toBeInTheDocument();
  });

  it("shows the plan loading dialog while a new plan loads", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Create Marketing Asset");

    await user.click(screen.getByRole("button", { name: "select-Beta LLC" }));

    expect(screen.getByTestId("plan-loading")).toBeInTheDocument();
    await waitFor(
      () => expect(screen.queryByTestId("plan-loading")).not.toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it("does not reload the same plan", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Create Marketing Asset");

    await user.click(screen.getByRole("button", { name: "select-Acme Corp" }));

    expect(screen.queryByTestId("plan-loading")).not.toBeInTheDocument();
  });
});

describe("Marketing creation cards", () => {
  it("renders both creation options", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Flyer" })).toBeInTheDocument();
    expect(screen.getByText("Create a print or digital flyer.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Portal Notice" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Add a Top Banner, Pop-Up, or News Update to Benefits Hub."),
    ).toBeInTheDocument();
  });

  it("opens the flyer modal from Create Flyer", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Create Flyer/ }));

    const modal = screen.getByTestId("marketing-modal");
    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-type", "flyer");
    expect(modal).toHaveAttribute("data-plan-id", "plan-1");
    expect(modal).toHaveAttribute("data-plan-name", "Acme Corp");
    expect(modal).toHaveAttribute("data-preview", "false");
  });

  it("opens the portal notice modal from Create Notice", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Create Notice/ }));

    expect(screen.getByTestId("marketing-modal")).toHaveAttribute(
      "data-type",
      "portal-notice",
    );
  });
});

describe("Marketing asset lists", () => {
  it("splits notices and flyers and shows their counts", () => {
    renderPage();

    const noticesTitle = screen.getByText("Portal Notices").parentElement!;
    const flyersTitle = screen.getByText("Flyers").parentElement!;
    expect(noticesTitle).toHaveTextContent("Portal Notices(3)");
    expect(flyersTitle).toHaveTextContent("Flyers(2)");
  });

  it("shows skeleton rows while assets load", () => {
    mocks.assetsLoading = true;

    const { container } = renderPage();

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(3);
  });

  it("shows the empty copy when there are no assets", () => {
    mocks.assetsData = { data: [] };

    renderPage();

    expect(screen.getByText("No portal notices yet")).toBeInTheDocument();
    expect(screen.getByText("No flyers yet")).toBeInTheDocument();
  });

  it("filters notices by status", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Published/ }));

    expect(screen.getByText("Open Enrollment")).toBeInTheDocument();
    expect(screen.queryByText("Popup")).not.toBeInTheDocument();
    expect(screen.queryByText("News")).not.toBeInTheDocument();
  });

  it("shows the filtered empty state", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Archived/ }));

    expect(screen.getByText('No assets with "Archived" status')).toBeInTheDocument();
  });

  it("filters notices by type", async () => {
    renderPage();

    const typeFilter = screen.getAllByRole("combobox")[0];
    fireEvent.change(typeFilter, { target: { value: "pop-up" } });

    await waitFor(() => expect(screen.queryByText("Open Enrollment")).not.toBeInTheDocument());
    expect(screen.getByText("Popup")).toBeInTheDocument();
    expect(screen.queryByText("News")).not.toBeInTheDocument();
  });

  it("renders type labels and flyer metadata", () => {
    renderPage();

    expect(screen.getAllByText("F")).toHaveLength(2);
    expect(screen.getByText("TB")).toBeInTheDocument();
    expect(screen.getByText("PU")).toBeInTheDocument();
    expect(screen.getByText("NE")).toBeInTheDocument();
    expect(
      screen.getByText(/Meeting · Retirement · Webinar ·/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Topical · Group Health · Retirement Savings From Former Employer",
      ),
    ).toBeInTheDocument();
  });

  it("selects all filtered assets and clears the selection", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole("checkbox")[0]);

    expect(screen.getByText("3 assets selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByText("3 assets selected")).not.toBeInTheDocument();
  });

  it("bulk-deletes selected assets and refreshes", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole("checkbox")[0]);

    await user.click(screen.getByRole("button", { name: /Delete selected/ }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("3 assets deleted", {
        description: "Successfully removed from this plan.",
      }),
    );
    const deletes = mocks.fetch.mock.calls.filter(
      ([, init]) => init?.method === "DELETE",
    );
    expect(deletes).toHaveLength(3);
    expect(mocks.mutateAssets).toHaveBeenCalled();
  });

  it("keeps the selection when every bulk delete fails", async () => {
    const user = userEvent.setup();
    renderPage();
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "no" }, false, 500));
    await user.click(screen.getAllByRole("checkbox")[0]);

    await user.click(screen.getByRole("button", { name: /Delete selected/ }));

    await waitFor(() =>
      expect(
        mocks.fetch.mock.calls.filter(([, init]) => init?.method === "DELETE"),
      ).toHaveLength(3),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.mutateAssets).not.toHaveBeenCalled();
    expect(screen.getByText("3 assets selected")).toBeInTheDocument();
  });

  it("previews an asset when its row is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Open Enrollment"));

    const modal = screen.getByTestId("marketing-modal");
    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-preview", "true");
    expect(modal).toHaveAttribute("data-type", "portal-notice");
    expect(modal).toHaveAttribute("data-edit-id", "notice-1");
  });

  it("edits a flyer from the template step", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      within(rowForMeta(/Meeting · Retirement/)).getByText("Edit"),
    );

    const modal = screen.getByTestId("marketing-modal");
    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-type", "flyer");
    expect(modal).toHaveAttribute("data-step", "3");
    expect(modal).toHaveAttribute("data-preview", "false");
    expect(modal).toHaveAttribute("data-edit-id", "flyer-1");
  });

  it("edits a portal notice on the top-banner element", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(within(rowFor("Open Enrollment")).getByText("Edit"));

    const modal = screen.getByTestId("marketing-modal");
    expect(modal).toHaveAttribute("data-type", "portal-notice");
    expect(modal).toHaveAttribute("data-element", "top-banner");
  });

  it("deletes a single asset after Yes", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(within(rowFor("Open Enrollment")).getByText("Delete"));
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    await user.click(within(rowFor("Open Enrollment")).getByText("Yes"));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Asset deleted", {
        description: '"Open Enrollment" has been removed.',
      }),
    );
    expect(mocks.fetch).toHaveBeenCalledWith("/api/marketing/assets/notice-1", {
      method: "DELETE",
    });
    expect(mocks.mutateAssets).toHaveBeenCalled();
  });

  it("cancels a single delete with No", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(within(rowFor("Open Enrollment")).getByText("Delete"));
    await user.click(within(rowFor("Open Enrollment")).getByText("No"));

    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("updates a notice status", async () => {
    renderPage();
    const row = rowFor("Open Enrollment");

    fireEvent.change(within(row).getByRole("combobox"), {
      target: { value: "Archived" },
    });

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/marketing/assets/notice-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "Archived" }),
        }),
      ),
    );
    expect(mocks.mutateAssets).toHaveBeenCalled();
  });

  it("downloads a flyer through the PDF pipeline", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      within(rowForMeta(/Meeting · Retirement/)).getByRole("button", {
        name: /Download/,
      }),
    );

    await waitFor(() =>
      expect(mocks.generateFlyerPdfBlob).toHaveBeenCalledWith(
        "data:image/svg+xml;base64,abc",
      ),
    );
    expect(mocks.resolveQrImageDataUrl).toHaveBeenCalledWith(
      "data:qr",
      "https://qr.example",
    );
    expect(mocks.categoryDisclaimer).toHaveBeenCalledWith("Retirement");
    expect(mocks.renderFlyerPreviewToSvg).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: "Retirement Flyer",
        planName: "Acme Corp",
        planLogo: "plan-logo",
        organizationLogo: "advisor-logo",
        flyerTemplate: "MeetingTemplate1",
        disclaimerText: "category disclaimer",
      }),
    );
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf");
  });

  it("swallows a failed flyer download", async () => {
    const user = userEvent.setup();
    renderPage();
    mocks.renderFlyerPreviewToSvg.mockRejectedValue(new Error("render failed"));

    await user.click(
      within(rowForMeta(/Meeting · Retirement/)).getByRole("button", {
        name: /Download/,
      }),
    );

    await waitFor(() =>
      expect(mocks.renderFlyerPreviewToSvg).toHaveBeenCalled(),
    );
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(screen.getAllByText("Download")).toHaveLength(2);
  });
});

describe("Marketing modal wiring", () => {
  it("refreshes assets after a modal save", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "save-modal" }));

    expect(mocks.mutateAssets).toHaveBeenCalledTimes(1);
  });

  it("clears edit state when the modal closes", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      within(rowForMeta(/Meeting · Retirement/)).getByText("Edit"),
    );

    await user.click(screen.getByRole("button", { name: "close-modal" }));

    const modal = screen.getByTestId("marketing-modal");
    expect(modal).toHaveAttribute("data-open", "false");
    expect(modal).toHaveAttribute("data-edit-id", "");
    expect(modal).toHaveAttribute("data-step", "");
  });

  it("switches a preview into edit mode", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Open Enrollment"));

    await user.click(screen.getByRole("button", { name: "edit-from-preview" }));

    const modal = screen.getByTestId("marketing-modal");
    expect(modal).toHaveAttribute("data-preview", "false");
    expect(modal).toHaveAttribute("data-edit-id", "notice-1");
  });

  it("closes the plan loading dialog when the asset request errors", async () => {
    const user = userEvent.setup();
    mocks.assetsError = new Error("boom");
    renderPage();
    await screen.findByText("Create Marketing Asset");

    await user.click(screen.getByRole("button", { name: "select-Beta LLC" }));

    expect(screen.getByTestId("plan-loading")).toBeInTheDocument();
    await waitFor(
      () => expect(screen.queryByTestId("plan-loading")).not.toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it("previews a flyer asset without entering edit mode", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      within(rowForMeta(/Meeting · Retirement/)).getByText("Flyer"),
    );

    const modal = screen.getByTestId("marketing-modal");
    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-preview", "true");
    expect(modal).toHaveAttribute("data-type", "flyer");
    expect(modal).toHaveAttribute("data-edit-id", "flyer-1");
  });

  it("disables the picker and hides the workspace when no clients exist", () => {
    mocks.clientsData = { data: [] };
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);

    renderPage();

    expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
      "data-disabled",
      "true",
    );
    expect(screen.queryByText("Create Marketing Asset")).not.toBeInTheDocument();
    expect(screen.queryByTestId("marketing-modal")).not.toBeInTheDocument();
  });

  it("caps the plan loading dialog at eight seconds", () => {
    vi.useFakeTimers();
    try {
      mocks.getLastPlanId.mockReturnValue(null);
      mocks.resolveStickyPlanId.mockReturnValue(null);
      mocks.assetsLoading = true;
      mocks.assetsData = undefined;

      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "select-Beta LLC" }));
      expect(screen.getByTestId("plan-loading")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(350);
      });
      // The asset request never resolves, so the minimum-delay check cannot close it.
      expect(screen.getByTestId("plan-loading")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(7650);
      });
      expect(screen.queryByTestId("plan-loading")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Marketing asset edge cases", () => {
  it("reports only the successful portion of a partial bulk delete", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (init?.method !== "DELETE") return jsonResponse({ success: true });
      return url.endsWith("/notice-1")
        ? jsonResponse({ success: true })
        : jsonResponse({ error: "no" }, false, 500);
    });
    renderPage();

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /Delete selected/ }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("1 asset deleted", {
        description: "Successfully removed from this plan.",
      }),
    );
    expect(mocks.mutateAssets).toHaveBeenCalled();
    expect(screen.queryByText("3 assets selected")).not.toBeInTheDocument();
  });

  it("does not report or refresh a rejected single delete", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "no" }, false, 500));
    renderPage();

    await user.click(within(rowFor("Open Enrollment")).getByText("Delete"));
    await user.click(within(rowFor("Open Enrollment")).getByText("Yes"));

    await waitFor(() =>
      expect(
        mocks.fetch.mock.calls.some(([, init]) => init?.method === "DELETE"),
      ).toBe(true),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.mutateAssets).not.toHaveBeenCalled();
    expect(screen.getByText("Open Enrollment")).toBeInTheDocument();
  });

  it("refreshes assets even when the status update is rejected", async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "no" }, false, 500));
    renderPage();
    const row = rowFor("Open Enrollment");

    fireEvent.change(within(row).getByRole("combobox"), {
      target: { value: "Archived" },
    });

    await waitFor(() => expect(mocks.mutateAssets).toHaveBeenCalled());
  });
});
