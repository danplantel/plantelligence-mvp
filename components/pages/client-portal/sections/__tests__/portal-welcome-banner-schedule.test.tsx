import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PortalWelcomeBanner } from "../portal-welcome-banner";

/**
 * The banner's "Schedule with <name>" CTA.
 *
 * On the hub pages it scrolls to the key contact's card in "Have Questions?"
 * (passed as `onScheduleClick`); elsewhere — the wizard preview — it keeps
 * opening the contact's scheduling URL.
 */

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
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

vi.mock("@/hooks/useBrandingImageUrl", () => ({
  useBrandingImageUrl: () => ({ url: null }),
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: async () => null,
}));

const keyContacts = [
  { fullName: "Dana Reed", schedulingUrl: "https://cal.test" },
];

function banner(props: Record<string, unknown> = {}) {
  return render(
    <PortalWelcomeBanner
      clientData={{ companyName: "Acme", keyContacts }}
      profile={{ name: "Ada Advisor" }}
      category="Retirement"
      {...props}
    />,
  );
}

describe("PortalWelcomeBanner schedule CTA", () => {
  it("calls the handler instead of opening the scheduling URL", async () => {
    const user = userEvent.setup();
    const onScheduleClick = vi.fn();
    banner({ onScheduleClick });

    await user.click(
      screen.getByRole("button", { name: /schedule with dana/i }),
    );

    expect(onScheduleClick).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("link", { name: /schedule with dana/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the scheduling link when no handler is given", () => {
    banner();

    expect(
      screen.getByRole("link", { name: /schedule with dana/i }),
    ).toHaveAttribute("href", "https://cal.test");
  });
});
