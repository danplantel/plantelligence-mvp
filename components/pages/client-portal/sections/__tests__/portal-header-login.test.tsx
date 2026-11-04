import React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
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
 * The portal's own navigation must keep the Comments/Editing-Panel flag. A Next
 * `Link` does not inherit the current query, so without this a click from
 * `?comments=on` silently returned the reader to the plain portal.
 */
describe("PortalHeader preserves the comments flag", () => {
  beforeEach(() => {
    mocks.pathname = "/plan-1/retirement";
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.history.replaceState({}, "", "/plan-1/retirement?comments=on");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  it("keeps the flag on the company-logo link", () => {
    render(
      <PortalHeader
        clientId="plan-1"
        companyData={{ companyLogo: "/logo.png" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Company Logo" }),
    ).toHaveAttribute("href", "/plan-1?comments=on");
  });

  it("keeps the flag on the header nav links", () => {
    render(<PortalHeader clientId="plan-1" />);

    expect(
      screen.getByRole("link", { name: "News & Events" }),
    ).toHaveAttribute("href", "/plan-1/news-events?comments=on");
    expect(
      screen.getByRole("link", { name: "My Benefits Team" }),
    ).toHaveAttribute("href", "/plan-1/my-benefits-team?comments=on");
  });

  it("does not append anything without the flag", () => {
    window.history.replaceState({}, "", "/plan-1/retirement");
    render(
      <PortalHeader
        clientId="plan-1"
        companyData={{ companyLogo: "/logo.png" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Company Logo" }),
    ).toHaveAttribute("href", "/plan-1");
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

/**
 * The current page is marked with an underline in the plan's primary colour and
 * a light wash of it — not a solid brand pill, which sat beside the header's one
 * call to action and read as a second, competing button. The link's corner
 * treatment follows the plan's Typography Theme.
 */
describe("PortalHeader nav active state", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  function navButton(name: string) {
    const link = screen.getByRole("link", { name });
    return link.querySelector("button") as HTMLElement;
  }

  it("underlines the current page in the plan's colour, over a light tint", () => {
    mocks.pathname = "/plan-1/news-events";
    render(<PortalHeader clientId="plan-1" brandColor="#abcdef" />);

    const current = navButton("News & Events");
    expect(current.className).toContain("border-b-2");
    expect(current).toHaveStyle({ borderBottomColor: "#abcdef" });

    // Tinted with the brand, but only a wash of it.
    expect(current.style.backgroundColor).not.toBe("");
    expect(current.style.backgroundColor).not.toBe("#abcdef");
    expect(current.style.backgroundColor).not.toBe("rgb(171, 205, 239)");

    // The radius is the theme's, not a fixed utility.
    expect(current.getAttribute("style") ?? "").toContain("border-radius");
  });

  it("leaves the other links unmarked", () => {
    mocks.pathname = "/plan-1/news-events";
    render(<PortalHeader clientId="plan-1" brandColor="#abcdef" />);

    const other = navButton("My Benefits Team");
    expect(other.className).toContain("border-transparent");
    expect(other.style.borderBottomColor).toBe("");
    expect(other.style.backgroundColor).toBe("");
  });

  it.each([
    ["Retirement", "/plan-1/retirement"],
    ["Health Insurance", "/plan-1/health-insurance"],
    ["Life Insurance", "/plan-1/life-insurance"],
    ["Custom benefit", "/plan-1/wellness-programs"],
  ])("marks the benefit group on the %s hub", (_hub, pathname) => {
    mocks.pathname = pathname;
    render(<PortalHeader clientId="plan-1" brandColor="#abcdef" />);

    const trigger = screen.getByRole("button", { name: "Your Benefits" });
    expect(trigger).toHaveStyle({ borderBottomColor: "#abcdef" });
    expect(trigger.style.backgroundColor).not.toBe("");
  });
});

/**
 * The drawer is the same navigation in a narrower viewport, so it wears the
 * same treatment: an underline in the plan's colour over a wash of it, with the
 * plan's corner radius.
 *
 * It is also drawn through a portal rather than inside the header, because the
 * header sits in the layout's `fixed z-50` wrapper. That wrapper is a stacking
 * context, so a `z-[200]` drawer nested in it was still painted BELOW the
 * chatbot's `z-[60]` pill — the menu opened underneath "Ask a question".
 */
describe("PortalHeader mobile drawer", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    // Unmount BEFORE clearing the DOM. These tests portal the drawer outside
    // React's own container, so wiping the body out from under the tree makes
    // the unmount throw "node to be removed is not a child of this node".
    cleanup();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  async function openDrawer(options?: { container?: HTMLElement }) {
    const user = userEvent.setup();
    render(
      <PortalHeader
        clientId="plan-1"
        brandColor="#abcdef"
        employeeResourcesEnabled
      />,
      options,
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    return within(screen.getByTestId("portal-mobile-drawer"));
  }

  it("underlines the current page in the plan's colour, over a light tint", async () => {
    mocks.pathname = "/plan-1/news-events";
    const drawer = await openDrawer();

    const current = drawer.getByRole("link", { name: "News & Events" });
    expect(current.className).toContain("border-b-2");
    expect(current).toHaveStyle({ borderBottomColor: "#abcdef" });
    expect(current.style.backgroundColor).not.toBe("");
    expect(current.style.backgroundColor).not.toBe("#abcdef");
    // The radius is the theme's, not a fixed utility.
    expect(current.getAttribute("style") ?? "").toContain("border-radius");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("leaves the other rows unmarked", async () => {
    mocks.pathname = "/plan-1/news-events";
    const drawer = await openDrawer();

    const other = drawer.getByRole("link", { name: "My Benefits Team" });
    expect(other.className).toContain("border-transparent");
    expect(other.style.borderBottomColor).toBe("");
    expect(other.style.backgroundColor).toBe("");
    expect(other.getAttribute("aria-current")).toBeNull();
  });

  it.each([
    ["Retirement", "/plan-1/retirement"],
    ["Health Insurance", "/plan-1/health-insurance"],
    ["Life Insurance", "/plan-1/life-insurance"],
    ["Custom benefit", "/plan-1/wellness-programs"],
  ])("marks the Your Benefits row on the %s hub", async (_hub, pathname) => {
    mocks.pathname = pathname;
    const drawer = await openDrawer();

    const group = drawer.getByText("Your Benefits");
    expect(group).toHaveStyle({ borderBottomColor: "#abcdef" });
    expect(group.style.backgroundColor).not.toBe("");
  });

  it("leaves the Your Benefits row unmarked away from the hubs", async () => {
    mocks.pathname = "/plan-1/news-events";
    const drawer = await openDrawer();

    const group = drawer.getByText("Your Benefits");
    expect(group.className).toContain("border-transparent");
    expect(group.style.backgroundColor).toBe("");
  });

  it("marks only the hub you are on — never Home as well", async () => {
    mocks.pathname = "/plan-1/employee-resources";
    const drawer = await openDrawer();

    const current = drawer.getByRole("link", { name: "Employee Resources" });
    expect(current).toHaveStyle({ borderBottomColor: "#abcdef" });
    expect(current.getAttribute("aria-current")).toBe("page");

    // Home used to light up too: `/employee-resources` was missing from the
    // list of routes that own a link of their own, so the page looked like a
    // child of the landing page.
    const home = drawer.getByRole("link", { name: "Home" });
    expect(home.className).toContain("border-transparent");
    expect(home.style.backgroundColor).toBe("");
    expect(home.getAttribute("aria-current")).toBeNull();
  });

  it("fills the phone's screen", async () => {
    mocks.pathname = "/plan-1";
    await openDrawer();

    const overlay = screen.getByTestId("portal-mobile-drawer");
    const panel = overlay.lastElementChild as HTMLElement;
    expect(panel.className).toContain("w-full");
    expect(panel.className).not.toContain("w-[280px]");
  });

  it("is drawn outside the header's stacking context, so it covers the chatbot", async () => {
    // The layout's structure: a `.portal-root` wrapping the `fixed z-50` header
    // slot. A drawer left inside the slot is capped at 50…
    const root = document.createElement("div");
    root.className = "portal-root";
    const headerSlot = document.createElement("div");
    headerSlot.className = "fixed left-0 z-50";
    root.appendChild(headerSlot);
    document.body.appendChild(root);

    mocks.pathname = "/plan-1";
    await openDrawer({ container: headerSlot });

    // …but the drawer is a child of the portal root, beside the header slot,
    // where its own z-index is compared against the chatbot's directly.
    const drawer = screen.getByTestId("portal-mobile-drawer");
    expect(headerSlot.contains(drawer)).toBe(false);
    expect(root.contains(drawer)).toBe(true);
    expect(drawer.className).toContain("z-[200]");
  });
});

/**
 * The plan's typography theme owns the header's chrome — its corner treatment
 * and its `ui` font.
 *
 * The live portal publishes those variables on `.portal-root`, but the editors
 * mount the header BESIDE their themed preview root, so the plan's shape used to
 * reach every button on the page except the header's own. The header now carries
 * the theme itself, which is what makes changing the theme in Create/Edit
 * Benefits (and in the Portal Edit Panel) show up on the nav and the CTA.
 */
describe("PortalHeader typography theme", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("publishes the plan's theme on the header itself", () => {
    mocks.pathname = "/plan-1/retirement";
    render(<PortalHeader clientId="plan-1" typographyTheme="classic" />);

    const style =
      (document.querySelector("header") as HTMLElement).getAttribute("style") ??
      "";
    // Classic is the sharp theme: every rounded utility squares off.
    expect(style).toContain("--portal-radius");
    expect(style).toContain("0px");
    expect(style).toContain("var(--font-ui)");
  });

  it("gives the call to action the theme's corner treatment", () => {
    mocks.pathname = "/plan-1/retirement";
    render(<PortalHeader clientId="plan-1" typographyTheme="classic" />);

    const cta = screen.getByRole("button", { name: "Login" });
    const style = cta.getAttribute("style") ?? "";
    // A calc off the variable, not a pinned `rounded-full`.
    expect(style).toContain("border-radius");
    expect(style).toContain("--portal-radius");
    expect(cta.className).not.toContain("rounded-full");
  });

  it("leaves the theme alone when the caller does not pass one", () => {
    mocks.pathname = "/plan-1/retirement";
    render(<PortalHeader clientId="plan-1" />);

    const header = document.querySelector("header") as HTMLElement;
    expect(header.getAttribute("style") ?? "").not.toContain("--portal-radius");
  });
});
