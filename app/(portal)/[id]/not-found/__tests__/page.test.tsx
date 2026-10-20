import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NotFoundPage from "../page";

/**
 * The portal's own 404 page.
 *
 * It is reached from `notFound()` inside a portal route (a Custom benefit whose
 * slug no longer matches, for example), so it renders **inside the portal
 * chrome** and has to look like the plan rather than like a bare error:
 * the plan's brand colour on the CTA, the plan's company name in its label, and
 * a way back to the hub.
 */

const mocks = vi.hoisted(() => ({
  clientData: null as Record<string, unknown> | null,
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => ({ clientData: mocks.clientData, loading: false }),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src="/plan-subpage/waypoint_sailing_sm-1024x713.jpg" />
  ),
}));

vi.mock("@/components/animations/page-fade", () => ({
  PageFade: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock(
  "@/components/pages/client-portal/sections/plan-materials-footer",
  () => ({
    PlanMaterialsFooter: () => <div data-testid="plan-materials-footer" />,
  }),
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientData = { companyName: "Acme", brandColor: "#123456" };
});

describe("portal not-found page", () => {
  it("explains that the page does not exist", () => {
    render(<NotFoundPage />);

    expect(
      screen.getByRole("heading", { name: "The page can't be found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("It looks like nothing was found at this location."),
    ).toBeInTheDocument();
  });

  it("names the plan in the way back", () => {
    render(<NotFoundPage />);

    expect(
      screen.getByRole("button", { name: "Go to Acme Home Page" }),
    ).toBeInTheDocument();
  });

  it("paints the CTA with the plan's brand colour", () => {
    render(<NotFoundPage />);

    expect(screen.getByRole("button", { name: /Home Page/ })).toHaveStyle({
      backgroundColor: "#123456",
    });
  });

  it("falls back to the default plan identity when the context is empty", () => {
    mocks.clientData = null;
    render(<NotFoundPage />);

    expect(
      screen.getByRole("button", {
        name: "Go to Waypoint Financial Advisors Home Page",
      }),
    ).toBeInTheDocument();
  });

  it("returns to the plan hub", async () => {
    const user = userEvent.setup();
    render(<NotFoundPage />);

    await user.click(screen.getByRole("button", { name: /Home Page/ }));

    expect(mocks.push).toHaveBeenCalledWith("/plan-1");
  });

  it("keeps the plan materials footer", () => {
    render(<NotFoundPage />);

    expect(screen.getByTestId("plan-materials-footer")).toBeInTheDocument();
  });
});
