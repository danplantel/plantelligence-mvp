import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A benefit hub's "Hidden / Published" switch (Section 1 of its panel).
 *
 * It reads the plan's `categoryPortalVisibility` — the flag the Benefits table
 * toggles and the portal's hub list filters on — and writes the same two calls that
 * table makes, so the panel and the dashboard can never disagree.
 */

const mocks = vi.hoisted(() => ({
  editing: {
    planId: "plan-1",
    refetchPortal: vi.fn(async () => null),
  },
  portal: {
    clientData: {
      categoryPortalVisibility: {
        Retirement: true,
        "Group Health": false,
        "Group Life": false,
        Other: false,
      },
    } as Record<string, any>,
  },
  access: {
    can: vi.fn((_fn?: string, _level?: string) => true),
    isCollaborator: false,
    isLoading: false,
  },
  fetch: vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    json: async () => ({ success: true }),
  })),
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  usePortalEditing: () => mocks.editing,
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => mocks.portal,
}));

vi.mock("@/hooks/useViewerAccess", () => ({
  useViewerAccess: () => mocks.access,
}));

import { PortalBenefitVisibilityToggle } from "@/components/portal-editing/portal-benefit-visibility-toggle";

function callsTo(url: string, method: string): [string, RequestInit][] {
  const found: [string, RequestInit][] = [];
  for (const [calledUrl, init] of mocks.fetch.mock.calls) {
    if (calledUrl !== url) continue;
    if ((init?.method ?? "GET") !== method) continue;
    found.push([calledUrl, init as RequestInit]);
  }
  return found;
}

describe("PortalBenefitVisibilityToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.can.mockReturnValue(true);
    mocks.access.isCollaborator = false;
    mocks.access.isLoading = false;
    mocks.portal.clientData = {
      categoryPortalVisibility: {
        Retirement: true,
        "Group Health": false,
        "Group Life": false,
        Other: false,
      },
    };
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("reads the category's stored state and publishes the hub", async () => {
    const user = userEvent.setup();
    render(<PortalBenefitVisibilityToggle category="Group Health" />);

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();

    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(callsTo("/api/clients/plan-1", "PUT")).toHaveLength(1));

    const [[, planInit]] = callsTo("/api/clients/plan-1", "PUT");
    const planBody = JSON.parse(String(planInit.body));
    // The whole canonical map is written, with THIS hub flipped on.
    expect(planBody.categoryPortalVisibility).toMatchObject({
      Retirement: true,
      "Group Health": true,
      "Group Life": false,
      Other: false,
    });

    // The Benefit row's own flag stays in step with the category map.
    const [[, benefitInit]] = callsTo(
      "/api/clients/plan-1/benefits/Group%20Health",
      "PUT",
    );
    expect(JSON.parse(String(benefitInit.body))).toEqual({ isEnabled: true });

    expect(mocks.editing.refetchPortal).toHaveBeenCalled();
  });

  it("maps the custom hub onto the Other visibility key", async () => {
    const user = userEvent.setup();
    render(<PortalBenefitVisibilityToggle category="Company / Plan Sponsor" />);

    expect(screen.getByText("Hidden")).toBeInTheDocument();

    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(callsTo("/api/clients/plan-1", "PUT")).toHaveLength(1));
    const [[, planInit]] = callsTo("/api/clients/plan-1", "PUT");
    expect(
      JSON.parse(String(planInit.body)).categoryPortalVisibility.Other,
    ).toBe(true);
  });

  it("offers nothing to a viewer who may not publish", () => {
    mocks.access.isCollaborator = true;

    const { container } = render(
      <PortalBenefitVisibilityToggle category="Retirement" />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
