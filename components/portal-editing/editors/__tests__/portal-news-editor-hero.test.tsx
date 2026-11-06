import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The News & Events panel owns the page's hero background — the plan's "Page
 * Image Header" slot, the same control Create Client Step 1 renders — and it is
 * a DRAFT like the Home and benefit panels: the page beside it repaints at once,
 * but only the panel's Save writes anything.
 */

const mocks = vi.hoisted(() => ({
  patchClientData: vi.fn(),
  refetchPortal: vi.fn(async () => null),
  beginSave: vi.fn(),
  finishSave: vi.fn(),
  failSave: vi.fn(),
  resetSave: vi.fn(),
  fetch: vi.fn(async (_input: unknown, _init?: RequestInit) => ({
    ok: true,
    json: async () => ({ success: true }),
  })),
}));

// A STABLE cache entry: the editor re-seeds from `data.data`, so a fresh array
// per render would look like a new asset list on every render.
const swr = vi.hoisted(() => ({
  state: {
    data: { data: [] as unknown[] },
    error: undefined,
    // `useSWR`'s own mutate — the editor calls it to revalidate the list.
    mutate: vi.fn(async () => undefined),
  },
  mutate: vi.fn(async () => undefined),
}));

vi.mock("swr", () => ({
  default: () => swr.state,
  useSWRConfig: () => ({ mutate: swr.mutate }),
}));

// Stable references: the editor re-seeds its hero draft from `clientData`, so a
// fresh object per render would look like a new plan on every render.
const portal = vi.hoisted(() => ({
  clientData: {
    id: "plan-1",
    companyName: "Acme Corp",
    companyLogo: "https://cdn.test/logo.png",
    secondaryBannerImg: "org/plan-1/branding/secondaryBanner.png",
    secondaryBannerImgName: "banner.png",
  },
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => portal,
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => {
  const value = {
    target: { page: "news", label: "News & Events" },
    planId: "plan-1",
    canEdit: true,
    isOpen: true,
    closePanel: () => {},
    beginSave: mocks.beginSave,
    finishSave: mocks.finishSave,
    failSave: mocks.failSave,
    resetSave: mocks.resetSave,
    saveState: "idle",
    saveError: null,
    patchClientData: mocks.patchClientData,
    refetchPortal: mocks.refetchPortal,
  };
  return {
    usePortalEditing: () => value,
    useOptionalPortalEditing: () => value,
  };
});

// The real section is the Create Plan control; stubbed here so this test covers
// the portal wiring (live preview + draft save), not the uploader.
vi.mock(
  "@/components/wizard/new-client-steps/sections/brand-images-section",
  () => ({
    BrandImagesSection: ({
      brandImages,
      visibleSlots,
      onBrandImagesChange,
      showNewsEventsPreview,
    }: {
      brandImages: { secondaryBanner?: { url?: string } | null };
      visibleSlots: string[];
      onBrandImagesChange: (next: unknown) => void;
      showNewsEventsPreview?: boolean;
    }) => (
      <button
        type="button"
        data-testid="upload-header"
        data-slots={visibleSlots.join(",")}
        data-current={brandImages?.secondaryBanner?.url ?? ""}
        data-preview={String(showNewsEventsPreview !== false)}
        onClick={() =>
          onBrandImagesChange({
            ...brandImages,
            secondaryBanner: {
              url: "data:image/png;base64,AAAA",
              fileName: "header.png",
              fileSize: 1,
              width: 1440,
              height: 400,
              status: "ok",
              warnings: [],
            },
          })
        }
      >
        upload
      </button>
    ),
  }),
);

import { PortalNewsEditor } from "@/components/portal-editing/editors/portal-news-editor";

function putCalls() {
  return mocks.fetch.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
  );
}

describe("PortalNewsEditor hero background", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("offers the Page Image Header slot for this page's hero", () => {
    render(<PortalNewsEditor />);

    // `SectionHeader` renders "Section 1: Hero Background" as several nodes.
    expect(screen.getByText(/Hero Background/)).toBeInTheDocument();
    // The hero section carries the anchor the page's blue edit button scrolls to.
    expect(
      document.querySelector('[data-edit-anchor="news-events-hero"]'),
    ).toBeInTheDocument();
    const slot = screen.getByTestId("upload-header");
    expect(slot.dataset.slots).toBe("secondaryBanner");
    // The stored legacy column is handed to the section as its current value.
    expect(slot.dataset.current).toBe(
      "org/plan-1/branding/secondaryBanner.png",
    );
    // The live page sits beside the panel, so the header mock-up is suppressed.
    expect(slot.dataset.preview).toBe("false");
  });

  it("gives the panel a Save / Cancel bar that starts clean", () => {
    render(<PortalNewsEditor />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("previews the new header without writing anything", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByTestId("upload-header"));

    // The page beside the panel repaints immediately…
    await waitFor(() =>
      expect(mocks.patchClientData).toHaveBeenCalledWith(
        expect.objectContaining({
          secondaryBannerImg: "data:image/png;base64,AAAA",
          secondaryBannerImgName: "header.png",
        }),
      ),
    );
    // …and the bar lights up, but nothing has been saved.
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(putCalls()).toHaveLength(0);
  });

  it("writes the header through the plan PUT when Save is pressed", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByTestId("upload-header"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(putCalls()).toHaveLength(1));

    const [url, init] = putCalls()[0] as [string, RequestInit];
    expect(url).toBe("/api/clients/plan-1");
    const body = JSON.parse(String(init.body));
    expect(body.brandImages.secondaryBanner.url).toBe(
      "data:image/png;base64,AAAA",
    );

    // The stored key replaces the optimistic data URL.
    expect(mocks.finishSave).toHaveBeenCalled();
    await waitFor(() => expect(mocks.refetchPortal).toHaveBeenCalled());
  });

  it("drops the draft on Cancel", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByTestId("upload-header"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(mocks.refetchPortal).toHaveBeenCalled());
    expect(mocks.resetSave).toHaveBeenCalled();
    expect(putCalls()).toHaveLength(0);
    // Back to a clean slate: Save is disabled again.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled(),
    );
  });
});
