import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Employee Resources panel carries the same Hero Background section as the
 * News & Events one, bound to the plan's "Employee Resources Header" slot.
 *
 * That slot has no Client column — the save route stores it inside
 * `employeePortalPreview.employeeResourcesHeroImage` and writes the value
 * verbatim — so the panel must upload the crop to R2 itself before the PUT, and
 * live-preview through that same blob while the advisor works.
 */

const mocks = vi.hoisted(() => ({
  patchClientData: vi.fn(),
  refetchPortal: vi.fn(async () => null),
  beginSave: vi.fn(),
  finishSave: vi.fn(),
  failSave: vi.fn(),
  resetSave: vi.fn(),
  uploadBrandingToR2: vi.fn(
    async () => "org/plan-1/branding/employeeResourcesHero.png",
  ),
  fetch: vi.fn(async (_input: unknown, _init?: RequestInit) => ({
    ok: true,
    json: async () => ({ success: true }),
  })),
}));

// Stable references: the editor re-seeds its hero draft from `clientData`.
const portal = vi.hoisted(() => ({
  clientData: {
    id: "plan-1",
    companyName: "Acme Corp",
    companyLogo: "https://cdn.test/logo.png",
    // The page falls back to this when the hub has no header of its own.
    secondaryBannerImg: "org/plan-1/branding/secondaryBanner.png",
    secondaryBannerImgName: "banner.png",
    employeePortalPreview: {},
    documents: [],
  },
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => portal,
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => {
  const value = {
    target: { page: "documents", label: "Employee Resources" },
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

vi.mock("@/lib/branding-r2", () => ({
  uploadBrandingToR2: mocks.uploadBrandingToR2,
}));

// The placement board is the shared builder; stubbed so this suite covers the
// panel's own wiring and the two modes it mounts.
vi.mock("@/components/wizard/benefits-steps/quick-answers-builder", () => ({
  QuickAnswersBuilder: ({
    planId,
    location,
    mode,
  }: {
    planId: string;
    location: string;
    mode?: string;
  }) => (
    <div
      data-testid="quick-answers-builder"
      data-plan={planId}
      data-location={location}
      data-mode={mode ?? "full"}
    />
  ),
}));

// The real section is the Create Plan control; stubbed here so this test covers
// the portal wiring (live preview, R2 upload, plan PUT), not the uploader.
vi.mock(
  "@/components/wizard/new-client-steps/sections/brand-images-section",
  () => ({
    BrandImagesSection: ({
      brandImages,
      visibleSlots,
      onBrandImagesChange,
      showNewsEventsPreview,
    }: {
      brandImages: { employeeResourcesHero?: { url?: string } | null };
      visibleSlots: string[];
      onBrandImagesChange: (next: unknown) => void;
      showNewsEventsPreview?: boolean;
    }) => (
      <button
        type="button"
        data-testid="upload-header"
        data-slots={visibleSlots.join(",")}
        data-current={brandImages?.employeeResourcesHero?.url ?? ""}
        data-preview={String(showNewsEventsPreview !== false)}
        onClick={() =>
          onBrandImagesChange({
            ...brandImages,
            employeeResourcesHero: {
              url: "data:image/png;base64,BBBB",
              fileName: "hr-header.png",
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

import { PortalEmployeeResourcesEditor } from "@/components/portal-editing/editors/portal-employee-resources-editor";

function putCalls() {
  return mocks.fetch.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
  );
}

describe("PortalEmployeeResourcesEditor hero background", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("offers the header slot plus the page's two question sections", () => {
    render(<PortalEmployeeResourcesEditor />);

    // Every portal panel header wears the red Live tag.
    expect(screen.getByText("Live")).toBeInTheDocument();

    // Section 4 is the shared footer disclosure, on the page's own anchor.
    expect(
      screen.getByRole("button", { name: /Open footer editor/i }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-edit-anchor="disclosure"]'),
    ).toBeInTheDocument();

    const slot = screen.getByTestId("upload-header");
    expect(slot.dataset.slots).toBe("employeeResourcesHero");
    // No header of its own yet, so the slot is empty (the page falls back).
    expect(slot.dataset.current).toBe("");
    // The live page is beside the panel, so no header mock-up.
    expect(slot.dataset.preview).toBe("false");

    // Section 2 is "How Can We Help You Today?" (the Featured cards) and
    // Section 3 is "Quick Answers" — the same board, split in half.
    const builders = screen.getAllByTestId("quick-answers-builder");
    expect(builders.map((node) => node.dataset.mode)).toEqual([
      "featured",
      "answers",
    ]);
    expect(builders.map((node) => node.dataset.location)).toEqual([
      "employee_resources",
      "employee_resources",
    ]);
    expect(builders.map((node) => node.dataset.plan)).toEqual([
      "plan-1",
      "plan-1",
    ]);
  });

  it("previews the band through employeePortalPreview without writing", async () => {
    const user = userEvent.setup();
    render(<PortalEmployeeResourcesEditor />);

    await user.click(screen.getByTestId("upload-header"));

    await waitFor(() =>
      expect(mocks.patchClientData).toHaveBeenCalledWith(
        expect.objectContaining({
          employeePortalPreview: expect.objectContaining({
            employeeResourcesHeroImage: "data:image/png;base64,BBBB",
          }),
        }),
      ),
    );
    expect(putCalls()).toHaveLength(0);
    expect(mocks.uploadBrandingToR2).not.toHaveBeenCalled();
  });

  it("uploads the crop to R2 and saves the key on Save", async () => {
    const user = userEvent.setup();
    render(<PortalEmployeeResourcesEditor />);

    await user.click(screen.getByTestId("upload-header"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.uploadBrandingToR2).toHaveBeenCalledWith(
        expect.objectContaining({
          dataUrlOrFile: "data:image/png;base64,BBBB",
          clientId: "plan-1",
          slot: "employeeResourcesHero",
        }),
      ),
    );

    await waitFor(() => expect(putCalls()).toHaveLength(1));
    const [url, init] = putCalls()[0] as [string, RequestInit];
    expect(url).toBe("/api/clients/plan-1");
    const body = JSON.parse(String(init.body));
    // The stored key — never the data URL — is what the plan carries.
    expect(body.brandImages.employeeResourcesHero.url).toBe(
      "org/plan-1/branding/employeeResourcesHero.png",
    );

    expect(mocks.finishSave).toHaveBeenCalled();
    await waitFor(() => expect(mocks.refetchPortal).toHaveBeenCalled());
  });

  it("drops the draft on Cancel", async () => {
    const user = userEvent.setup();
    render(<PortalEmployeeResourcesEditor />);

    await user.click(screen.getByTestId("upload-header"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(mocks.refetchPortal).toHaveBeenCalled());
    expect(mocks.resetSave).toHaveBeenCalled();
    expect(putCalls()).toHaveLength(0);
    expect(mocks.uploadBrandingToR2).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled(),
    );
  });
});
