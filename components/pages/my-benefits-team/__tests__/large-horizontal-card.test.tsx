import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LargeHorizontalCard } from "../large-horizontal-card";

/**
 * `LargeHorizontalCard` — the wide, avatar-left contact card used by the
 * My Benefits Team layouts that put one contact per row.
 *
 * It shares the CTA vocabulary of the other two cards, with two differences
 * pinned here: its logo slot height is `120px × logoScale` (rather than a
 * fixed 60/48px base), and it honours `displayEmail`/`displayPhone` on every
 * path.
 */

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  resolveContactFormUrl: vi.fn(
    async (url: string, _contact?: unknown) => `resolved:${url}`,
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    section: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: any) => <section {...props}>{children}</section>,
  },
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ src }: any) => (
    <img data-testid="branding-image" src={src} />
  ),
}));

vi.mock("@/components/pages/my-benefits-team/contact-avatar", () => ({
  ContactAvatar: ({ contact }: any) => (
    <div data-testid="contact-avatar" data-name={contact?.name ?? ""} />
  ),
}));

vi.mock("@/lib/contact-form-link", () => ({
  resolveContactFormUrl: (url: string, contact: unknown) =>
    mocks.resolveContactFormUrl(url, contact),
}));

type CardProps = React.ComponentProps<typeof LargeHorizontalCard>;

const BASE_PROPS = {
  brandColor: "#123456",
  secondaryColor: "#654321",
  appointmentLink: "https://book.test/schedule",
  companyName: "",
};

function renderCard(
  contact: Record<string, any> = {},
  props: Partial<CardProps> = {},
) {
  return render(
    <LargeHorizontalCard contact={contact as any} {...BASE_PROPS} {...props} />,
  );
}

function linkHrefs() {
  return screen.getAllByRole("link").map((link) => link.getAttribute("href"));
}

function buttonLabels() {
  return screen
    .queryAllByRole("button")
    .map((button) => button.textContent?.trim());
}

beforeEach(() => {
  vi.stubGlobal("open", mocks.open);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LargeHorizontalCard identity", () => {
  it("renders the contact's name, title, company and avatar", () => {
    renderCard({
      name: "Ada Lovelace",
      title: "Retirement Advisor",
      companyName: "Acme Retirement",
    });

    const name = screen.getByRole("heading", { level: 3 });
    expect(name).toHaveTextContent("Ada Lovelace");
    expect(name).toHaveStyle({ color: "#123456" });
    expect(screen.getByText("Retirement Advisor")).toBeInTheDocument();
    expect(screen.getByText("Acme Retirement")).toBeInTheDocument();
    expect(screen.getByTestId("contact-avatar")).toHaveAttribute(
      "data-name",
      "Ada Lovelace",
    );
  });

  it("uses the plan's company name when the contact has none", () => {
    renderCard({ name: "Ada" }, { companyName: "Acme Retirement" });

    expect(screen.getByText("Acme Retirement")).toBeInTheDocument();
  });

  it("renders designation acronyms and drops blanks", () => {
    renderCard({ name: "Ada", designations: ["CFP", "  ", "AIF"] });

    expect(screen.getByText("CFP®")).toBeInTheDocument();
    expect(screen.getByText("AIF®")).toBeInTheDocument();
  });

  it("renders a Team / Support Line card with its display name and hours", () => {
    renderCard({
      contactType: "team_support",
      name: "Desk",
      displayName: "Acme Service Desk",
      departmentLabel: "Member Services",
      designations: ["CFP"],
      supportHours: "9am–5pm",
      companyLogo: "org/logo.png",
    });

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Acme Service Desk",
    );
    expect(screen.queryByText("Member Services")).not.toBeInTheDocument();
    expect(screen.queryByText("CFP®")).not.toBeInTheDocument();
    expect(screen.getByText("9am–5pm")).toBeInTheDocument();
    // The logo moves into the avatar slot; the icon replaces the logo slot, so
    // the card itself draws no BrandingImage.
    expect(screen.queryByTestId("branding-image")).not.toBeInTheDocument();
  });
});

describe("LargeHorizontalCard contact details", () => {
  it("lists phone before email by default", () => {
    renderCard({ name: "Ada", email: "ada@acme.test", phone: "5551234567" });

    expect(linkHrefs()).toEqual(["tel:+15551234567", "mailto:ada@acme.test"]);
  });

  it("honours a contact's contactInfoOrder", () => {
    renderCard({
      name: "Ada",
      email: "ada@acme.test",
      phone: "5551234567",
      contactInfoOrder: ["email", "phone"],
    });

    expect(linkHrefs()).toEqual(["mailto:ada@acme.test", "tel:+15551234567"]);
  });

  it("formats the phone with its extension", () => {
    renderCard({ name: "Ada", phone: "5551234567", phoneExtension: "12" });

    expect(screen.getByRole("link", { name: /Ext\. 12/ })).toHaveTextContent(
      "(555) 123-4567 Ext. 12",
    );
  });

  it("honours displayEmail/displayPhone", () => {
    renderCard({
      name: "Ada",
      email: "ada@acme.test",
      phone: "5551234567",
      displayEmail: false,
      displayPhone: false,
    });

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("LargeHorizontalCard action buttons", () => {
  it("opens the configured calendar CTA", async () => {
    const user = userEvent.setup();
    renderCard({
      name: "Ada",
      enableContactButton: true,
      contactButtonType: "calendar",
      schedulingUrl: "https://cal.test/ada",
    });

    await user.click(screen.getByRole("button", { name: "Schedule Appt." }));

    expect(mocks.open).toHaveBeenCalledWith("https://cal.test/ada", "_blank");
  });

  it("dials the contact for a phone CTA", async () => {
    const user = userEvent.setup();
    renderCard({
      name: "Ada",
      phone: "5551234567",
      enableContactButton: true,
      contactButtonType: "phone",
    });

    await user.click(screen.getByRole("button", { name: "Call Now" }));

    expect(mocks.open).toHaveBeenCalledWith("tel:+15551234567", "_blank");
  });

  it("labels the contact-form CTA 'Contact' and resolves it on click", async () => {
    const user = userEvent.setup();
    renderCard({
      name: "Ada",
      enableContactButton: true,
      contactButtonType: "url",
      websiteUrl: "https://plantel.pro/contact",
    });

    await user.click(screen.getByRole("button", { name: "Contact" }));

    expect(mocks.resolveContactFormUrl).toHaveBeenCalledWith(
      "https://plantel.pro/contact",
      expect.objectContaining({ name: "Ada" }),
    );
    expect(mocks.open).toHaveBeenCalledWith(
      "resolved:https://plantel.pro/contact",
      "_blank",
    );
  });

  it("labels the legacy website button 'Contact'", () => {
    renderCard({
      name: "Ada",
      displayUrl: true,
      websiteUrl: "https://ada.test",
    });

    expect(buttonLabels()).toEqual(["Contact"]);
  });

  it("orders buttons from actionButtonOrder", () => {
    renderCard({
      name: "Ada",
      displayScheduleAppointment: true,
      displayUrl: true,
      websiteUrl: "https://ada.test",
      actionButtonOrder: ["website", "schedule"],
    });

    expect(buttonLabels()).toEqual(["Contact", "Schedule Appt."]);
  });

  it("draws no CTA for a contact the advisor never configured", () => {
    // The plan's appointment link alone used to produce a Schedule button here.
    renderCard({ name: "Ada" });

    expect(buttonLabels()).toEqual([]);
  });

  it("renders no buttons when the CTA is explicitly disabled", () => {
    renderCard({ name: "Ada", enableContactButton: false });

    expect(buttonLabels()).toEqual([]);
  });

  it("drops a phone CTA that has no number", () => {
    renderCard({
      name: "Ada",
      enableContactButton: true,
      contactButtonType: "phone",
    });

    expect(buttonLabels()).toEqual([]);
  });
});

describe("LargeHorizontalCard visuals", () => {
  it("sizes the logo slot at 120px × the contact's logoScale", () => {
    renderCard({ name: "Ada", logo: "org/logo.png", logoScale: 0.5 });

    expect(
      screen.getByTestId("branding-image").parentElement as HTMLElement,
    ).toHaveStyle({ height: "60px" });
  });

  it("uses the baseline logo scale when the contact has none", () => {
    renderCard({ name: "Ada", logo: "org/logo.png" }, { baselineLogoScale: 2 });

    expect(
      screen.getByTestId("branding-image").parentElement as HTMLElement,
    ).toHaveStyle({ height: "240px" });
  });

  it("prefers the contact's card colour, then the plan baseline, then white", () => {
    const own = renderCard(
      { name: "Ada", cardBackgroundColor: "#000000" },
      { baselineBackgroundColor: "#eeeeee" },
    );
    expect(own.container.firstChild as HTMLElement).toHaveStyle({
      backgroundColor: "#000000",
    });
    own.unmount();

    const baseline = renderCard(
      { name: "Ada" },
      { baselineBackgroundColor: "#eeeeee" },
    );
    expect(baseline.container.firstChild as HTMLElement).toHaveStyle({
      backgroundColor: "#eeeeee",
    });
    baseline.unmount();

    const plain = renderCard({ name: "Ada" });
    expect(plain.container.firstChild as HTMLElement).toHaveStyle({
      backgroundColor: "#ffffff",
    });
  });
});
