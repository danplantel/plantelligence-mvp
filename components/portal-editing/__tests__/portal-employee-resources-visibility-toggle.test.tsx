import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The "Hidden / Published" switch in the Employee Resources panel header.
 *
 * It has to report the plan's stored flag, write through the hub's own endpoint
 * (the one that also seeds the starter questions), and never appear for a viewer
 * the server would refuse — publishing is `create_benefits: edit`, and a
 * Collaborator never publishes.
 */

const mocks = vi.hoisted(() => ({
  editing: {
    planId: "plan-1",
    employeeResourcesReadKey: undefined as string | undefined,
  },
  access: {
    can: vi.fn((_fn?: string, _level?: string) => true),
    isCollaborator: false,
    isLoading: false,
  },
  fetch: vi.fn(),
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => ({
  usePortalEditing: () => mocks.editing,
}));

vi.mock("@/hooks/useViewerAccess", () => ({
  useViewerAccess: () => mocks.access,
}));

import { PortalEmployeeResourcesVisibilityToggle } from "@/components/portal-editing/portal-employee-resources-visibility-toggle";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

const WRITE_URL = "/api/clients/plan-1/employee-resources";

describe("PortalEmployeeResourcesVisibilityToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing.planId = "plan-1";
    mocks.editing.employeeResourcesReadKey = undefined;
    mocks.access.can.mockReturnValue(true);
    mocks.access.isCollaborator = false;
    mocks.access.isLoading = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the hub's stored state and publishes from the panel header", async () => {
    let enabled = false;
    mocks.fetch.mockImplementation(
      async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          enabled = JSON.parse(String(init.body)).enabled === true;
          return jsonResponse({ success: true, enabled });
        }
        return jsonResponse({ success: true, enabled, topics: null });
      },
    );
    vi.stubGlobal("fetch", mocks.fetch);

    const user = userEvent.setup();
    render(<PortalEmployeeResourcesVisibilityToggle />);

    // The stored flag is false, so the header says Hidden and the switch is off.
    expect(await screen.findByText("Hidden")).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();

    await user.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(
        mocks.fetch.mock.calls.some(
          ([url, init]) =>
            url === WRITE_URL &&
            (init as RequestInit | undefined)?.method === "PUT",
        ),
      ).toBe(true),
    );

    const put = mocks.fetch.mock.calls.find(
      ([url, init]) =>
        url === WRITE_URL && (init as RequestInit | undefined)?.method === "PUT",
    )!;
    expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({
      enabled: true,
    });

    // The re-read after the save is what flips the label.
    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("offers nothing to a viewer who may not publish", () => {
    mocks.access.isCollaborator = true;

    const { container } = render(<PortalEmployeeResourcesVisibilityToggle />);

    expect(container).toBeEmptyDOMElement();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("offers nothing without create_benefits edit rights", () => {
    mocks.access.can.mockReturnValue(false);

    const { container } = render(<PortalEmployeeResourcesVisibilityToggle />);

    expect(container).toBeEmptyDOMElement();
  });
});
