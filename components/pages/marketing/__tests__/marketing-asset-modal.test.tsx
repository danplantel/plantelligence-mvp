import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  fetch: vi.fn(),
  push: vi.fn(),
  downloadFlyerPdf: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("swr", () => ({
  default: (key: string | null) => {
    if (!key) return { data: undefined };
    if (key.startsWith("/api/meetings")) return { data: { data: [] } };
    if (key.startsWith("/api/clients/")) {
      return { data: { data: { brandColor: "#111111", secondaryColor: "#222222" } } };
    }
    if (key === "/api/profile") {
      return { data: { advisorLogoUrl: null, advisorLogo: null } };
    }
    return { data: undefined };
  },
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: () => ({ url: null }),
}));

vi.mock("@/lib/marketing/flyer-pdf", () => ({
  downloadFlyerPdf: mocks.downloadFlyerPdf,
}));

vi.mock("../flyer-image-position-editor", () => ({
  FlyerImagePositionEditor: () => <div data-testid="image-position-editor" />,
}));

vi.mock("../flyer-templates", () => ({
  FlyerPreview: () => <div data-testid="flyer-preview" />,
  TemplateThumbnail: () => <div data-testid="template-thumbnail" />,
  TopicalTemplate1: () => <div />,
  TopicalTemplate2: () => <div />,
  TopicalTemplate3: () => <div />,
  MeetingTemplate1: () => <div />,
  FLYER_TEMPLATE_BENEFITS_CATEGORY: {
    MeetingTemplate1: "Retirement",
    TopicalTemplate1: "Retirement",
    TopicalTemplate2: "Group Health",
    TopicalTemplate3: "Group Life",
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogClose: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      aria-label="select"
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: () => null,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={() => onCheckedChange?.(!checked)}
    />
  ),
}));

import MarketingAssetModal from "../marketing-asset-modal";

const editingNotice = {
  id: "notice-1",
  type: "portal-notice",
  status: "Draft",
  headline: "Open Enrollment",
  body: "Body",
  startDate: "2026-01-01",
  endDate: "2026-02-01",
  createdAt: "2026-01-01T00:00:00Z",
  data: {
    noticeType: "text",
    ctaText: "",
    ctaUrl: "",
    buttonColor: "#ffffff",
  },
};

function renderModal(overrides: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  const onSave = vi.fn();
  const onEditFromPreview = vi.fn();
  render(
    <MarketingAssetModal
      open
      onOpenChange={onOpenChange}
      assetType="flyer"
      planName="Acme"
      planId="plan-1"
      onSave={onSave}
      onEditFromPreview={onEditFromPreview}
      {...overrides}
    />,
  );
  return { onOpenChange, onSave, onEditFromPreview };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("MarketingAssetModal", () => {
  it("renders nothing when closed", () => {
    renderModal({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts a flyer at the meeting/topical choice", () => {
    renderModal();

    expect(screen.getByText("Meeting Based")).toBeInTheDocument();
    expect(screen.getByText("Topical Flyer")).toBeInTheDocument();
  });

  it("advances a meeting flyer to the benefit category step", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("Meeting Based"));

    expect(screen.getByText("Select a benefit category")).toBeInTheDocument();
  });

  it("jumps directly to the template step with initialFlyerStep", () => {
    renderModal({ initialFlyerStep: 3 });

    expect(screen.getByText("Customize Template")).toBeInTheDocument();
  });

  it("renders preview-only flyers without form actions", () => {
    renderModal({
      previewOnly: true,
      editingAsset: {
        id: "flyer-1",
        type: "flyer",
        status: "Published",
        createdAt: "2026-01-01T00:00:00Z",
        headline: "Headline",
        body: "Body",
        data: {
          flyerTemplate: "MeetingTemplate1",
          flyerCategory: "Retirement",
          flyerSubtitle: "Subtitle",
          flyerQrUrl: "https://hub.example",
          disclaimerText: "Disclosure",
        },
      },
    });

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save Flyer/ })).not.toBeInTheDocument();
  });

  it("asks a portal notice to pick an element", () => {
    renderModal({ assetType: "portal-notice" });

    expect(screen.getByText("Portal Notice Element")).toBeInTheDocument();
    expect(screen.getByText("Top Banner")).toBeInTheDocument();
    expect(screen.getByText("Pop-Up")).toBeInTheDocument();
    expect(screen.getByText("News & Event Post")).toBeInTheDocument();
  });

  it("skips the picker with initialPortalElement", () => {
    renderModal({
      assetType: "portal-notice",
      initialPortalElement: "top-banner",
    });

    // The picker slide stays mounted; selecting an element slides it off-screen.
    const slider = screen
      .getByText("Portal Notice Element")
      .closest('[style*="translateX"]');
    expect(slider).toHaveStyle({ transform: "translateX(-100%)" });
    expect(screen.getByRole("button", { name: /Save Portal Notice/ })).toBeInTheDocument();
  });

  it("closes from Cancel", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("reports the first missing flyer field before saving", async () => {
    const user = userEvent.setup();
    renderModal({ initialFlyerStep: 3 });

    await user.click(screen.getByRole("button", { name: /Save Flyer/ }));

    // Step 3 prefills the template defaults, so the QR link is the first gap.
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Validation error",
        description: "QR code link is required.",
      }),
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("validates a top-banner headline", async () => {
    const user = userEvent.setup();
    renderModal({
      assetType: "portal-notice",
      initialPortalElement: "top-banner",
    });

    await user.click(screen.getByRole("button", { name: /Save Portal Notice/ }));

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Headline is required for Top Banner.",
      }),
    );
  });

  it("updates an existing top banner", async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({
      assetType: "portal-notice",
      initialPortalElement: "top-banner",
      editingAsset: editingNotice,
    });

    await user.click(screen.getByRole("button", { name: /Update Portal Notice/ }));

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/marketing/assets/notice-1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const call = mocks.fetch.mock.calls.find(
      ([url, init]) =>
        url === "/api/marketing/assets/notice-1" && init?.method === "PATCH",
    );
    const payload = JSON.parse((call![1] as any).body);
    expect(payload).toEqual(
      expect.objectContaining({
        headline: "Open Enrollment",
        startDate: "2026-01-01",
        endDate: "2026-02-01",
      }),
    );
    expect(onSave).toHaveBeenCalled();
  });

  it("calls onEditFromPreview in preview mode", async () => {
    const user = userEvent.setup();
    const { onEditFromPreview } = renderModal({
      previewOnly: true,
      editingAsset: {
        id: "notice-1",
        type: "portal-notice",
        status: "Published",
        createdAt: "2026-01-01T00:00:00Z",
        headline: "Open",
        data: { noticeType: "text" },
      },
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEditFromPreview).toHaveBeenCalledTimes(1);
  });
});
