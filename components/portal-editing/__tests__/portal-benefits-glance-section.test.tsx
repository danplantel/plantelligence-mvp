import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The landing panel's "Your Benefits at a Glance" section.
 *
 * Each card is a Benefit row, so this section edits `landingCardImage` /
 * `landingCardBody` per category — and a category the plan has never built gets a
 * link to Create Benefit instead, because only Step 1 can create a benefit (it
 * seeds that benefit's pages, questions and contacts).
 */

const mocks = vi.hoisted(() => ({
  beginSave: vi.fn(),
  finishSave: vi.fn(),
  failSave: vi.fn(),
  refetchPortal: vi.fn(async () => null),
  patchClientData: vi.fn(),
  mutate: vi.fn(async () => undefined),
  rows: [] as any[],
  /** The plan as the panel sees it — the cards beside the panel render from this. */
  clientData: {} as Record<string, any>,
  fetch: vi.fn(
    async (_url: string, _init?: RequestInit) =>
      ({ ok: true, json: async () => ({ success: true }) }) as Response,
  ),
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  usePortalEditing: () => ({
    beginSave: mocks.beginSave,
    finishSave: mocks.finishSave,
    failSave: mocks.failSave,
    refetchPortal: mocks.refetchPortal,
    patchClientData: mocks.patchClientData,
    saveState: "idle",
  }),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({ clientData: mocks.clientData }),
}));

vi.mock("swr", () => ({
  default: () => ({
    data: mocks.rows,
    isLoading: false,
    mutate: mocks.mutate,
  }),
}));

vi.mock("@/lib/landing-card-defaults", () => ({
  getDefaultLandingCardBody: (category: string) => `${category} suggested copy`,
}));

vi.mock("@/lib/portal-category-hero-background", () => ({
  getCategoryDefaultInnerImageUrl: () => "/default-card.webp",
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { PortalBenefitsGlanceSection } from "../portal-benefits-glance-section";

function row(overrides: Record<string, unknown> = {}) {
  return {
    apiCategory: "Retirement",
    createCategory: "Retirement",
    label: "Retirement",
    benefit: null,
    ...overrides,
  };
}

function renderSection(props: Record<string, unknown> = {}) {
  return render(
    <PortalBenefitsGlanceSection planId="plan-1" {...props} />,
  );
}

describe("PortalBenefitsGlanceSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    // The portal's preview mirror: what the cards beside the panel draw from.
    mocks.clientData = {
      employeePortalPreview: {
        benefits: [
          {
            id: "b1",
            category: "Retirement",
            landingCardImage: "/cards/retirement.png",
            landingCardBody: "Saved copy",
          },
        ],
      },
    };
    mocks.rows = [
      row({
        benefit: {
          id: "b1",
          landingCardImage: "/cards/retirement.png",
          landingCardBody: "Saved copy",
        },
      }),
      row({
        apiCategory: "Group Health",
        createCategory: "Group Health",
        label: "Group Health",
      }),
      row({
        apiCategory: "Group Life",
        createCategory: "Group Life",
        label: "Group Life",
      }),
      row({
        apiCategory: "Company / Plan Sponsor",
        createCategory: "Custom",
        label: "Custom",
      }),
    ];
  });

  it("lists one accordion per card, marking the ones not created yet", () => {
    renderSection();

    expect(screen.getByText("Retirement")).toBeInTheDocument();
    expect(screen.getByText("Group Health")).toBeInTheDocument();
    expect(screen.getByText("Group Life")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
    // One "Active" badge (Retirement, on a filled accent chip) and three "Not created".
    const active = screen.getByText("Active");
    expect(active).toBeInTheDocument();
    expect(active.className).toContain("bg-accent-blue-light");
    expect(active.className).toContain("text-accent-blue");

    const missing = screen.getAllByText("Not created");
    expect(missing).toHaveLength(3);
    expect(missing[0].className).toContain("text-muted-foreground");
  });

  it("links a missing category to Create Benefit for this plan and benefit", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: /Group Health/ }));

    const link = screen.getByRole("link", {
      name: /Create the Group Health benefit/,
    });
    expect(link).toHaveAttribute(
      "href",
      "/new-benefits?planId=plan-1&category=Group%20Health",
    );
    // A new tab: the portal being edited must stay put.
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("links the Custom card to the Custom deep link", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: /Custom/ }));

    expect(
      screen.getByRole("link", { name: /Create the Custom benefit/ }),
    ).toHaveAttribute("href", "/new-benefits?planId=plan-1&category=Custom");
  });

  it("wears the advisor's own name for the Custom card", () => {
    mocks.rows[3].label = "Mindfulness";
    renderSection({ customBenefitName: "Mindfulness" });

    expect(screen.getByText("Mindfulness")).toBeInTheDocument();
  });

  it("saves one card's text with updateOnly, then replays the page", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: /Retirement/ }));
    const textarea = screen.getByLabelText("Retirement card text");
    await user.clear(textarea);
    await user.type(textarea, "Fresh copy");
    await user.click(screen.getByRole("button", { name: "Save card" }));

    // The uploader/library controls may fetch too, so pick the PUT out rather than
    // assuming it is the only call.
    const puts = () =>
      mocks.fetch.mock.calls.filter(([, init]) => init?.method === "PUT");
    await waitFor(() => expect(puts()).toHaveLength(1));
    const [url, init] = puts()[0];
    // `updateOnly=1`: the card editor can never create a Benefit row.
    expect(url).toBe(
      "/api/clients/plan-1/benefits/Retirement?updateOnly=1",
    );
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({
      landingCardBody: "Fresh copy",
    });
    expect(mocks.finishSave).toHaveBeenCalled();
    expect(mocks.refetchPortal).toHaveBeenCalled();
  });

  it("fills the category's suggested copy on request", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: /Retirement/ }));
    await user.click(
      screen.getByRole("button", { name: /Use the suggested text/ }),
    );

    expect(screen.getByLabelText("Retirement card text")).toHaveValue(
      "Retirement suggested copy",
    );
  });

  it("previews a keystroke on the live page, before any save", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: /Retirement/ }));
    const textarea = screen.getByLabelText("Retirement card text");
    await user.clear(textarea);
    await user.type(textarea, "Hi");

    // The card beside the panel renders `employeePortalPreview.benefits`, so the
    // draft is mirrored there — the panel's live-preview contract.
    expect(mocks.patchClientData).toHaveBeenCalled();
    const lastCall =
      mocks.patchClientData.mock.calls[
        mocks.patchClientData.mock.calls.length - 1
      ][0] as { employeePortalPreview: { benefits: any[] } };
    expect(lastCall.employeePortalPreview.benefits[0]).toMatchObject({
      category: "Retirement",
      landingCardBody: "Hi",
      // The untouched field survives.
      landingCardImage: "/cards/retirement.png",
    });
    // Nothing has been written yet: the save is still the advisor's press.
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("never conjures a card for a category the mirror has not got", async () => {
    mocks.clientData = { employeePortalPreview: { benefits: [] } };
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: /Retirement/ }));
    await user.type(
      screen.getByLabelText("Retirement card text"),
      "New copy",
    );

    expect(mocks.patchClientData).not.toHaveBeenCalled();
  });

  it("keeps Save disabled until something changes", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: /Retirement/ }));

    expect(screen.getByRole("button", { name: "Save card" })).toBeDisabled();
  });
});
