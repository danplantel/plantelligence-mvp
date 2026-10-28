import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PortalHeader } from "../portal-header";
import {
  HAVE_QUESTIONS_SECTION_ID,
  HOW_CAN_WE_HELP_SECTION_ID,
} from "@/lib/portal-section-anchors";

/**
 * The header's Login button.
 *
 * On a Benefit Hub it scrolls to that hub's "How Can We Help You Today?" section
 * (where the Account Access card lives); everywhere else it is not rendered.
 */

const mocks = vi.hoisted(() => ({ pathname: "/plan-1/retirement" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The header measures its own height with a ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function mountSection() {
  const section = document.createElement("section");
  section.id = HOW_CAN_WE_HELP_SECTION_ID;
  section.scrollIntoView = vi.fn();
  document.body.appendChild(section);
  return section;
}

describe("PortalHeader login", () => {
  beforeEach(() => {
    mocks.pathname = "/plan-1/retirement";
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it.each([
    ["Retirement", "/plan-1/retirement"],
    ["Health", "/plan-1/health-insurance"],
    ["Life", "/plan-1/life-insurance"],
    ["Custom", "/plan-1/wellness-programs"],
  ])("offers Login on the %s hub", (_label, pathname) => {
    mocks.pathname = pathname;
    render(<PortalHeader clientId="plan-1" />);

    expect(screen.getByRole("button", { name: /Login/ })).toBeInTheDocument();
  });

  it("scrolls to the How Can We Help section", async () => {
    const user = userEvent.setup();
    const section = mountSection();
    render(<PortalHeader clientId="plan-1" />);

    await user.click(screen.getByRole("button", { name: /Login/ }));

    expect(section.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("is absent outside the benefit hubs", () => {
    mocks.pathname = "/plan-1/news-events";
    render(<PortalHeader clientId="plan-1" />);

    expect(
      screen.queryByRole("button", { name: /Login/ }),
    ).not.toBeInTheDocument();
  });

  it("wears the plan's primary colour", () => {
    render(<PortalHeader clientId="plan-1" brandColor="#abcdef" />);

    expect(screen.getByRole("button", { name: /Login/ })).toHaveStyle({
      backgroundColor: "#abcdef",
    });
  });
});

/**
 * The same slot, now a plan-level choice (Section 1 of the editing panel): Login,
 * a booking button, or nothing. `login` is the fallback, which is what the suite
 * above already covers — these pin the other two.
 */
describe("PortalHeader call to action", () => {
  beforeEach(() => {
    mocks.pathname = "/plan-1/retirement";
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("falls back to Login when the plan stores nothing", () => {
    render(<PortalHeader clientId="plan-1" headerCta={null} />);

    expect(screen.getByRole("button", { name: /Login/ })).toBeInTheDocument();
  });

  it("falls back to Login for a mode it does not know", () => {
    render(<PortalHeader clientId="plan-1" headerCta={{ mode: "telepathy" }} />);

    expect(screen.getByRole("button", { name: /Login/ })).toBeInTheDocument();
  });

  it("renders no button at all for None — even on a hub page", () => {
    render(<PortalHeader clientId="plan-1" headerCta={{ mode: "none" }} />);

    expect(
      screen.queryByRole("button", { name: /Login|Schedule a Call/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Login|Schedule a Call/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the booking button outside the benefit hubs too", () => {
    mocks.pathname = "/plan-1/news-events";
    render(
      <PortalHeader
        clientId="plan-1"
        headerCta={{ mode: "schedule", url: "https://calendly.com/team" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Schedule a Call/ }),
    ).toBeInTheDocument();
    // Login would be absent here — Schedule is not hub-scoped.
    expect(
      screen.queryByRole("button", { name: /Login/ }),
    ).not.toBeInTheDocument();
  });

  it("opens an external booking link in a new tab", () => {
    render(
      <PortalHeader
        clientId="plan-1"
        // No scheme: the header completes it to https.
        headerCta={{ mode: "schedule", url: "calendly.com/team" }}
      />,
    );

    const link = screen.getByRole("link", { name: /Schedule a Call/ });
    expect(link).toHaveAttribute("href", "https://calendly.com/team");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps a portal destination in the same tab", () => {
    render(
      <PortalHeader
        clientId="plan-1"
        headerCta={{ mode: "schedule", url: "/plan-1/my-benefits-team" }}
      />,
    );

    const link = screen.getByRole("link", { name: /Schedule a Call/ });
    expect(link).toHaveAttribute("href", "/plan-1/my-benefits-team");
    expect(link).not.toHaveAttribute("target");
  });

  it("uses the advisor's own label", () => {
    render(
      <PortalHeader
        clientId="plan-1"
        headerCta={{
          mode: "schedule",
          url: "https://calendly.com/team",
          label: "Book a review",
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Book a review/ }),
    ).toBeInTheDocument();
  });

  it("scrolls to the contact card when Schedule has no link", async () => {
    const user = userEvent.setup();
    const support = document.createElement("section");
    support.id = HAVE_QUESTIONS_SECTION_ID;
    support.scrollIntoView = vi.fn();
    document.body.appendChild(support);

    render(<PortalHeader clientId="plan-1" headerCta={{ mode: "schedule" }} />);

    await user.click(screen.getByRole("button", { name: /Schedule a Call/ }));

    expect(support.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  /**
   * The editors render the header with `enableNavigation={false}`, which has no
   * routes — so `isBenefitsActive` can never be true there. The previews are all
   * previewing a benefit hub, so they must still show the button the advisor just
   * picked; that is the whole point of the control living in Section 1.
   */
  it("shows the Login button in the editors' preview chrome", () => {
    render(
      <PortalHeader
        clientId="plan-1"
        enableNavigation={false}
        headerCta={{ mode: "login" }}
      />,
    );

    expect(screen.getByRole("button", { name: /Login/ })).toBeInTheDocument();
  });

  it("draws a booking link as an inert button in preview chrome", () => {
    render(
      <PortalHeader
        clientId="plan-1"
        enableNavigation={false}
        headerCta={{ mode: "schedule", url: "https://calendly.com/team" }}
      />,
    );

    // The advisor is mid-edit: the label is faithful, but no tab may open.
    expect(
      screen.getByRole("button", { name: /Schedule a Call/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Schedule a Call/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps None empty in preview chrome too", () => {
    render(
      <PortalHeader
        clientId="plan-1"
        enableNavigation={false}
        headerCta={{ mode: "none" }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Login|Schedule a Call/ }),
    ).not.toBeInTheDocument();
  });
});
