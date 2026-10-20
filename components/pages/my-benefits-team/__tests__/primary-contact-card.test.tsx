import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrimaryContactCard } from "../primary-contact-card";

/**
 * `PrimaryContactCard` — the wide "your main contact" card.
 *
 * It deliberately differs from `SmallVerticalCard` in three participant-facing
 * ways that are pinned here:
 *
 *  - its fallback CTA reads "Schedule Appointment" (not "Schedule Appt."), and
 *    its legacy website button is always labelled "Contact";
 *  - the company logo is optional and its height comes from
 *    `contact.logoScale`, while the `logoScale` *prop* is declared but unused;
 *  - the card background is the plan's secondary colour unless a baseline
 *    (or the contact's own colour) overrides it.
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
  BrandingImage: ({ src, style }: any) => (
    <img
      data-testid="branding-image"
      src={src}
      data-height={style?.height ?? ""}
      data-max-height={style?.maxHeight ?? ""}
    />
  ),
}));

vi.mock("@/components/ui/contact-category-badge", () => ({
  ContactCategoryBadge: ({ categories }: any) => (
    <div
      data-testid="category-badge"
      data-categories={JSON.stringify(categories)}
    />
  ),
}));

vi.mock("@/components/pages/my-benefits-team/primary-visual", () => ({
  PrimaryVisual: ({ contact }: any) => (
    <div data-testid="primary-visual" data-name={contact?.name ?? ""} />
  ),
}));

vi.mock("@/lib/contact-form-link", () => ({
  resolveContactFormUrl: (url: string, contact: unknown) =>
    mocks.resolveContactFormUrl(url, contact),
}));

type CardProps = React.ComponentProps<typeof PrimaryContactCard>;

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
    <PrimaryContactCard contact={contact as any} {...BASE_PROPS} {...props} />,
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

function badgeCategories() {
  const badge = screen.getByTestId("category-badge");
  return JSON.parse(badge.getAttribute("data-categories") || "[]");
}

beforeEach(() => {
  vi.stubGlobal("open", mocks.open);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PrimaryContactCard identity", () => {
  it("renders the contact's name, title and company", () => {
    renderCard({
      name: "Ada Lovelace",
      title: "Retirement Advisor",
      companyName: "Acme Retirement",
    });

    const name = screen.getByRole("heading", { level: 2 });
    expect(name).toHaveTextContent("Ada Lovelace");
    expect(name).toHaveStyle({ color: "#123456" });
    expect(screen.getByText("Retirement Advisor")).toBeInTheDocument();
    expect(screen.getByText("Acme Retirement")).toBeInTheDocument();
    expect(screen.getByTestId("primary-visual")).toHaveAttribute(
      "data-name",
      "Ada Lovelace",
    );
  });

  it("uses the plan's company name when the contact has none", () => {
    renderCard({ name: "Ada" }, { companyName: "Acme Retirement" });

    expect(screen.getByText("Acme Retirement")).toBeInTheDocument();
  });

  it("renders a Team / Support Line card with its display name and hours, without a role line", () => {
    renderCard({
      contactType: "team_support",
      name: "Desk",
      displayName: "Acme Service Desk",
      departmentLabel: "Member Services",
      designations: ["CFP"],
      supportHours: "9am–5pm",
      companyLogo: "org/logo.png",
    });

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Acme Service Desk",
    );
    expect(screen.queryByText("Member Services")).not.toBeInTheDocument();
    expect(screen.queryByText("CFP®")).not.toBeInTheDocument();
    expect(screen.getByText("Support Hours: 9am–5pm")).toBeInTheDocument();
    // The company logo moves into the large visual slot; the icon replaces the
    // logo bar, so the card itself draws no BrandingImage.
    expect(screen.queryByTestId("branding-image")).not.toBeInTheDocument();
  });

  it("shows support hours only for a support-line contact", () => {
    renderCard({ name: "Ada", supportHours: "9am–5pm" });

    expect(screen.queryByText(/Support Hours/)).not.toBeInTheDocument();
  });

  it("renders designation acronyms under the name", () => {
    renderCard({ name: "Ada", designations: ["CFP", "AIF"] });

    expect(screen.getByText("CFP®")).toBeInTheDocument();
    expect(screen.getByText("AIF®")).toBeInTheDocument();
  });

  it("tags the card with the categories the contact serves", () => {
    renderCard(
      { name: "Ada" },
      { categoryList: ["Retirement", "Group Health"] },
    );

    expect(badgeCategories()).toEqual(["Retirement", "Group Health"]);
  });

  it("falls back to the joined categoryLabel string", () => {
    renderCard({ name: "Ada" }, { categoryLabel: "Group Life" });

    expect(badgeCategories()).toEqual(["Group Life"]);
  });
});

describe("PrimaryContactCard contact details", () => {
  it("links the email and phone with the display extension", () => {
    renderCard({
      name: "Ada",
      email: "ada@acme.test",
      phone: "5551234567",
      phoneExtension: "12",
    });

    expect(linkHrefs()).toEqual(["mailto:ada@acme.test", "tel:+15551234567"]);
    expect(screen.getByRole("link", { name: /Ext\. 12/ })).toHaveTextContent(
      "(555) 123-4567 Ext. 12",
    );
  });

  it("hides email and phone when the advisor turned them off", () => {
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

describe("PrimaryContactCard action buttons", () => {
  it("opens a configured calendar CTA, falling back to the plan link", async () => {
    const user = userEvent.setup();
    renderCard({
      name: "Ada",
      enableContactButton: true,
      contactButtonType: "calendar",
    });

    await user.click(screen.getByRole("button", { name: "Schedule Appt." }));

    expect(mocks.open).toHaveBeenCalledWith(
      "https://book.test/schedule",
      "_blank",
    );
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

  it("opens the mail client for an email CTA", async () => {
    const user = userEvent.setup();
    renderCard({
      name: "Ada",
      email: "ada@acme.test",
      enableContactButton: true,
      contactButtonType: "email",
    });

    await user.click(screen.getByRole("button", { name: "Send Email" }));

    expect(mocks.open).toHaveBeenCalledWith("mailto:ada@acme.test", "_blank");
  });

  it("labels the contact-form CTA 'Contact' and resolves it on click", async () => {
    const user = userEvent.setup();
    renderCard({
      name: "Ada",
      enableContactButton: true,
      contactButtonType: "url",
      websiteUrl: "https://plantel.pro/contact",
      headshot: "org/ada.png",
    });

    await user.click(screen.getByRole("button", { name: "Contact" }));

    expect(mocks.resolveContactFormUrl).toHaveBeenCalledWith(
      expect.stringContaining("avatar=org"),
      expect.objectContaining({ name: "Ada" }),
    );
    expect(mocks.open).toHaveBeenCalledWith(
      expect.stringMatching(
        /^resolved:https:\/\/plantel\.pro\/contact\?avatar=org/,
      ),
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

  it("falls back to a Schedule Appt. button using the plan's appointment link", async () => {
    const user = userEvent.setup();
    renderCard({ name: "Ada" });

    await user.click(screen.getByRole("button", { name: "Schedule Appt." }));

    expect(mocks.open).toHaveBeenCalledWith(
      "https://book.test/schedule",
      "_blank",
    );
  });

  it("renders no buttons when the CTA is explicitly disabled", () => {
    renderCard({ name: "Ada", enableContactButton: false });

    expect(buttonLabels()).toEqual([]);
  });

  it("drops a phone CTA that has no number instead of drawing a dead button", () => {
    renderCard({
      name: "Ada",
      enableContactButton: true,
      contactButtonType: "phone",
    });

    expect(buttonLabels()).toEqual([]);
  });
});

describe("PrimaryContactCard visuals", () => {
  it("sizes the logo from the contact's logoScale and ignores the unused prop", () => {
    renderCard(
      { name: "Ada", logo: "org/logo.png", logoScale: 1.5 },
      { logoScale: 4 },
    );

    const logo = screen.getByTestId("branding-image");
    // 48px base × contact.logoScale — the `logoScale` prop is declared on the
    // interface but never destructured, so passing 4 does not change anything.
    expect(logo).toHaveAttribute("data-height", "72px");
    expect(logo).toHaveAttribute("data-max-height", "60px");
  });

  it("draws no logo when the contact has none", () => {
    renderCard({ name: "Ada" });

    expect(screen.queryByTestId("branding-image")).not.toBeInTheDocument();
  });

  it("uses the plan baseline for the card background, falling back to the secondary colour", () => {
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
      backgroundColor: "#654321",
    });
  });

  it("prefers the contact's own card background", () => {
    const { container } = renderCard({
      name: "Ada",
      cardBackgroundColor: "#000000",
    });

    expect(container.firstChild as HTMLElement).toHaveStyle({
      backgroundColor: "#000000",
    });
  });
});
