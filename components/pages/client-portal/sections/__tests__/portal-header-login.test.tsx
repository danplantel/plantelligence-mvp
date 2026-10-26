import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PortalHeader } from "../portal-header";
import { HOW_CAN_WE_HELP_SECTION_ID } from "@/lib/portal-section-anchors";

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
