import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SmallVerticalCard } from "../small-vertical-card";

/**
 * `SmallVerticalCard` — the compact contact card used by the My Benefits Team
 * page and (through `BenefitContactCard`) by the benefit hub pages.
 *
 * The card has two render paths: the animated one (`motion.div`, used on the
 * portal) and the `disableAnimation` one (used in constrained / preview
 * contexts). They share their data resolution but not all of their markup, so
 * several assertions below are run twice or explicitly pin a divergence.
 *
 * Heavy children (images, avatar, category badge) are stubbed, so the tests are
 * about the card's own decisions: who the contact is, what they speak for, how
 * they can be reached and which CTA is drawn.
 */

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  resolveContactFormUrl: vi.fn(
    async (url: string, _contact?: unknown) => `resolved:${url}`,
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ src, style }: any) => (
    <img
      data-testid="branding-image"
      src={src}
      data-height={style?.height ?? ""}
      data-transform={style?.transform ?? ""}
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

vi.mock("@/components/pages/my-benefits-team/contact-avatar", () => ({
  ContactAvatar: ({ contact }: any) => (
    <div
      data-testid="contact-avatar"
      data-headshot={contact?.headshot ?? ""}
      data-team-image={contact?.teamImage ?? ""}
    />
  ),
}));

vi.mock("@/lib/contact-form-link", () => ({
  resolveContactFormUrl: (url: string, contact: unknown) =>
    mocks.resolveContactFormUrl(url, contact),
}));

type CardProps = React.ComponentProps<typeof SmallVerticalCard>;

const BASE_PROPS = {
  brandColor: "#123456",
  secondaryColor: "#654321",
  appointmentLink: "https://book.test/schedule",
};

function renderCard(
  contact: Record<string, any> = {},
  props: Partial<CardProps> = {},
) {
  return render(
    <SmallVerticalCard contact={contact as any} {...BASE_PROPS} {...props} />,
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

describe("SmallVerticalCard identity", () => {
  it("renders first + last name, title and the plan's company name", () => {
    renderCard(
      {
        firstName: "Ada",
        lastName: "Lovelace",
        title: "Retirement Advisor",
      },
      { companyName: "Acme Retirement" },
    );

    const name = screen.getByRole("heading", { level: 3 });
    expect(name).toHaveTextContent("Ada Lovelace");
    expect(name).toHaveStyle({ color: "#123456" });
    expect(screen.getByText("Retirement Advisor")).toBeInTheDocument();
    expect(screen.getByText("Acme Retirement")).toBeInTheDocument();
  });

  it("falls back to the stored name when the person has no split name", () => {
    renderCard({ name: "Acme Support Team" });

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Acme Support Team",
    );
  });

  it("lets the contact's own company name win over the plan's", () => {
    renderCard(
      { name: "Ada", companyName: "Ada & Co" },
      { companyName: "Acme Retirement" },
    );

    expect(screen.getByText("Ada & Co")).toBeInTheDocument();
    expect(screen.queryByText("Acme Retirement")).not.toBeInTheDocument();
  });

  it("renders designations as acronyms and skips blank entries", () => {
    renderCard({ name: "Ada", designations: ["CFP", "   ", "AIF"] });

    expect(screen.getByText("CFP®")).toBeInTheDocument();
    expect(screen.getByText("AIF®")).toBeInTheDocument();
  });

  it("omits the designation row when every value is blank", () => {
    const { container } = renderCard({
      name: "Ada",
      designations: ["", "   "],
    });

    expect(container.querySelector(".overflow-x-auto")).toBeNull();
  });

  it("renders a Team / Support Line card with the display name, hours and no person avatar", () => {
    renderCard({
      contactType: "team_support",
      displayName: "Acme Service Desk",
      name: "ignored",
      departmentLabel: "Member Services",
      designations: ["CFP"],
      supportHours: "Mon–Fri, 8am–6pm",
      companyLogo: "org/logo.png",
      headshot: "org/head.png",
    });

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Acme Service Desk",
    );
    // The role line and the designation chips are suppressed for a support line.
    expect(screen.queryByText("Member Services")).not.toBeInTheDocument();
    expect(screen.queryByText("CFP®")).not.toBeInTheDocument();
    expect(screen.getByText("Mon–Fri, 8am–6pm")).toBeInTheDocument();
    // Company logo in the logo bar, support-line icon in the avatar slot.
    expect(screen.queryByTestId("contact-avatar")).not.toBeInTheDocument();
    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "src",
      "org/logo.png",
    );
  });

  it("tags the card with every category the contact serves", () => {
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

  it("prefers categoryList over categoryLabel", () => {
    renderCard(
      { name: "Ada" },
      {
        categoryLabel: "Group Life",
        categoryList: ["Retirement", "Other Benefits"],
      },
    );

    expect(badgeCategories()).toEqual(["Retirement", "Other Benefits"]);
  });

  it("renders no category tag when neither prop is supplied", () => {
    renderCard({ name: "Ada" });

    expect(badgeCategories()).toEqual([]);
  });
});

describe("SmallVerticalCard contact details", () => {
  it("lists phone before email by default", () => {
    renderCard({
      name: "Ada",
      email: "ada@acme.test",
      phone: "5551234567",
    });

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

  it("formats the phone with its extension while dialling the digits only", () => {
    renderCard({
      name: "Ada",
      phone: "5551234567",
      phoneExtension: "123",
    });

    const link = screen.getByRole("link", { name: /Ext\. 123/ });
    expect(link).toHaveTextContent("(555) 123-4567 Ext. 123");
    expect(link).toHaveAttribute("href", "tel:+15551234567");
  });

  it("honours displayEmail/displayPhone when animations are disabled", () => {
    renderCard(
      {
        name: "Ada",
        email: "ada@acme.test",
        phone: "5551234567",
        displayEmail: false,
        displayPhone: false,
      },
      { disableAnimation: true },
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("ignores displayEmail/displayPhone in the animated variant (known divergence)", () => {
    renderCard({
      name: "Ada",
      email: "ada@acme.test",
      phone: "5551234567",
      displayEmail: false,
      displayPhone: false,
    });

    // The compact / no-animation branch checks the two flags; the animated
    // branch does not, so a hidden address is published on the live portal.
    expect(linkHrefs()).toEqual(["tel:+15551234567", "mailto:ada@acme.test"]);
  });
});

describe("SmallVerticalCard action buttons", () => {
  it("opens the configured calendar CTA in a new tab", async () => {
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

  it("labels the first-party contact-form CTA 'Contact' and resolves it on click", async () => {
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

  it("labels a legacy website button 'Visit Website' for a person", () => {
    renderCard({
      name: "Ada",
      displayUrl: true,
      websiteUrl: "https://ada.test",
    });

    expect(buttonLabels()).toEqual(["Visit Website"]);
  });

  it("labels a legacy website button 'Visit Support Site' for a support line", () => {
    renderCard({
      contactType: "team_support",
      name: "Desk",
      displayUrl: true,
      websiteUrl: "https://desk.test",
    });

    expect(buttonLabels()).toEqual(["Visit Support Site"]);
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

  it("renders no action button when the CTA is explicitly disabled", () => {
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

  it("orders the legacy buttons from actionButtonOrder", () => {
    renderCard({
      name: "Ada",
      displayScheduleAppointment: true,
      schedulingUrl: "https://cal.test/ada",
      displayUrl: true,
      websiteUrl: "https://ada.test",
      actionButtonOrder: ["website", "schedule"],
    });

    expect(buttonLabels()).toEqual(["Visit Website", "Schedule Appt."]);
  });

  it("draws the contact-form CTA inert in a wizard preview", () => {
    renderCard(
      {
        name: "Ada",
        enableContactButton: true,
        contactButtonType: "url",
        websiteUrl: "/contact",
      },
      { disableContactFormButton: true },
    );

    expect(
      screen.queryByRole("button", { name: "Contact" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });
});

describe("SmallVerticalCard visuals", () => {
  it("scales the company logo in the animated variant", () => {
    renderCard({ name: "Ada", companyLogo: "org/logo.png", logoScale: 1.5 });

    expect(screen.getByTestId("branding-image")).toHaveAttribute(
      "data-transform",
      "scale(1.5)",
    );
  });

  it("sizes the logo box by height when animations are disabled, using the baseline scale", () => {
    renderCard(
      { name: "Ada", logo: "org/logo.png" },
      { disableAnimation: true, baselineLogoScale: 2 },
    );

    // The no-animation variant sizes the logo box (60px × scale) and lets the
    // image fill it, rather than scaling the image with a transform.
    const box = screen.getByTestId("branding-image").parentElement;
    expect(box).toHaveStyle({ height: "120px" });
  });

  it("prefers the contact's card colour over the plan baseline", () => {
    const { container } = renderCard(
      { name: "Ada", cardBackgroundColor: "#000000" },
      { baselineBackgroundColor: "#eeeeee" },
    );

    expect(container.firstChild as HTMLElement).toHaveStyle({
      backgroundColor: "#000000",
    });
  });

  it("falls back to the plan baseline, then white", () => {
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

  it("renders preview placeholders for every missing piece of card data", () => {
    renderCard({}, { previewPlaceholders: true });

    expect(screen.getByText("[First & Last Name]")).toBeInTheDocument();
    expect(screen.getByText("[Job Title]")).toBeInTheDocument();
    expect(screen.getByText("[Company / Organization]")).toBeInTheDocument();
    expect(screen.getByText("[Email]")).toBeInTheDocument();
    expect(screen.getByText("[Phone]")).toBeInTheDocument();
    expect(screen.getByText("[Upload Company Logo]")).toBeInTheDocument();
    expect(screen.getByText("[Headshot]")).toBeInTheDocument();
  });

  it("uses Team placeholders and never asks for a headshot on a support line", () => {
    renderCard({ contactType: "team_support" }, { previewPlaceholders: true });

    expect(screen.getByText("[Team Name]")).toBeInTheDocument();
    // The role line is suppressed for a support line, so the computed
    // "[Department]" placeholder is never rendered.
    expect(screen.queryByText("[Department]")).not.toBeInTheDocument();
    expect(screen.queryByText("[Headshot]")).not.toBeInTheDocument();
  });
});
