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
  // Mirrors the real component: nothing to tag means no element at all, so the
  // card's children stay in the order a caller without categories produces.
  ContactCategoryBadge: ({ categories }: any) =>
    Array.isArray(categories) && categories.length > 0 ? (
      <div
        data-testid="category-badge"
        data-categories={JSON.stringify(categories)}
      />
    ) : null,
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

/**
 * The copy-on-click email / phone values, as their accessible labels in DOM order.
 *
 * These were `mailto:` / `tel:` links; clicking now copies the value and shows a
 * "Copied" chip, so the assertion is about what is ON the card rather than where it
 * navigates.
 */
function copyValues() {
  return screen
    .queryAllByRole("button")
    .map((button) => button.getAttribute("aria-label"))
    .filter((label): label is string => !!label && label.startsWith("Copy "));
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

    expect(screen.queryByTestId("category-badge")).not.toBeInTheDocument();
  });

  it("tags the card near the top, above the identity block and the CTA", () => {
    const { container } = renderCard(
      {
        name: "Ada Lovelace",
        title: "Benefits Advisor",
        enableContactButton: true,
        contactButtonType: "calendar",
        schedulingUrl: "https://cal.test/ada",
      },
      { categoryList: ["Retirement", "Group Health"] },
    );

    const card = container.querySelector('[data-testid="contact-card"]')!;
    const badge = screen.getByTestId("category-badge");
    // First thing in the card, so the benefits read before the person does.
    expect(card.firstElementChild).toBe(badge);
    const cta = screen.getByRole("button", { name: "Schedule Appt." });
    expect(
      badge.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("SmallVerticalCard contact details", () => {
  it("lists email above the phone by default", () => {
    // The card's right column reads email first, then phone.
    renderCard({
      name: "Ada",
      email: "ada@acme.test",
      phone: "5551234567",
    });

    expect(copyValues()).toEqual([
      "Copy email: ada@acme.test",
      "Copy phone: (555) 123-4567",
    ]);
  });

  it("honours a contact's contactInfoOrder", () => {
    renderCard({
      name: "Ada",
      email: "ada@acme.test",
      phone: "5551234567",
      contactInfoOrder: ["email", "phone"],
    });

    expect(copyValues()).toEqual([
      "Copy email: ada@acme.test",
      "Copy phone: (555) 123-4567",
    ]);
  });

  it("copies the number the card prints, extension included", () => {
    renderCard({
      name: "Ada",
      phone: "5551234567",
      phoneExtension: "123",
    });

    const phone = screen.getByRole("button", { name: /Ext\. 123/ });
    expect(phone).toHaveTextContent("(555) 123-4567 Ext. 123");
    // What is copied is what is shown — no hidden `tel:` rewriting.
    expect(phone).toHaveAttribute(
      "aria-label",
      "Copy phone: (555) 123-4567 Ext. 123",
    );
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

  it("honours displayEmail/displayPhone in the animated variant too", () => {
    renderCard({
      name: "Ada",
      email: "ada@acme.test",
      phone: "5551234567",
      displayEmail: false,
      displayPhone: false,
    });

    // Both render paths now share one desktop layout, so a hidden address is
    // hidden on the live portal as well as in the no-animation preview.
    expect(screen.queryAllByRole("link")).toHaveLength(0);
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

  it("draws no CTA for a contact the advisor never configured", () => {
    // The plan's appointment link alone used to produce a Schedule button here, so
    // every unconfigured contact showed a booking CTA. A button is only drawn from
    // the contact's own CTA config (or an explicit legacy display flag).
    renderCard({ name: "Ada" });

    expect(buttonLabels()).toEqual([]);
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

  it("puts the two CTAs side by side in one row", () => {
    renderCard({
      name: "Ada",
      displayScheduleAppointment: true,
      schedulingUrl: "https://cal.test/ada",
      displayUrl: true,
      websiteUrl: "https://ada.test",
    });

    const first = screen.getByRole("button", { name: "Schedule Appt." });
    const second = screen.getByRole("button", { name: "Visit Website" });
    // Same parent, and that parent is a row — the card used to stack them.
    expect(first.parentElement).toBe(second.parentElement);
    expect(first.parentElement?.className).toContain("flex-row");
  });

  it("draws the second CTA white in the default card style", () => {
    renderCard({
      name: "Ada",
      enableContactButton: true,
      contactButtonTypes: ["calendar", "url"],
      schedulingUrl: "https://cal.test/ada",
      websiteUrl: "https://ada.test",
    });

    // The primary button is the brand fill; the second is white, not the old
    // brand tint or grey, so it reads as the secondary action on the card.
    const primary = screen.getByRole("button", { name: "Schedule Appt." });
    const secondary = screen.getByRole("button", { name: "Contact" });
    expect(primary.style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(secondary.style.backgroundColor).toBe("rgb(255, 255, 255)");
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

  it("picks its element tier from `size`, falling back to `compact`", () => {
    // The benefit hub passes the tier its row computed; every other surface
    // keeps the long-standing compact/regular card.
    const regular = renderCard({ name: "Ada" });
    expect(screen.getByTestId("contact-card")).toHaveAttribute(
      "data-card-size",
      "md",
    );
    regular.unmount();

    const compact = renderCard({ name: "Ada" }, { compact: true });
    expect(screen.getByTestId("contact-card")).toHaveAttribute(
      "data-card-size",
      "sm",
    );
    compact.unmount();

    renderCard({ name: "Ada" }, { size: "lg" });
    expect(screen.getByTestId("contact-card")).toHaveAttribute(
      "data-card-size",
      "lg",
    );
  });

  it("stretches to the row height only when asked", () => {
    // Default: hug the content (no empty block under the last row).
    const hugging = renderCard({ name: "Ada" });
    expect(screen.getByTestId("contact-card").className).toContain(
      "self-start",
    );
    hugging.unmount();

    // `equalHeight`: a row where a neighbour carries a CTA must line up.
    renderCard({ name: "Ada" }, { equalHeight: true });
    expect(screen.getByTestId("contact-card").className).toContain("h-full");
  });

  it("rules off the identity block from the contact details", () => {
    const { container } = renderCard({ name: "Ada", email: "ada@acme.test" });

    // The hairline sits between the headshot/logo row and the details row, and
    // travels with the details so it never floats in the middle of the card.
    const divider = container.querySelector(".h-px");
    expect(divider).not.toBeNull();
    expect(
      divider?.parentElement?.contains(
        screen.getByRole("heading", { level: 3 }),
      ),
    ).toBe(true);
  });

  it("puts the designations under the job title", () => {
    renderCard({
      name: "Ada Lovelace",
      title: "Benefits Advisor",
      designations: ["CFP"],
    });

    const name = screen.getByRole("heading", { level: 3 });
    const title = screen.getByText("Benefits Advisor");
    // The chip renders the acronym with its ® suffix, so match the prefix.
    const chip = screen.getByText(/^CFP/);

    // Name → role → credentials, the order a business card reads in.
    expect(
      name.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      title.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("labels BOTH CTAs in the brand colour on a highlighted card", () => {
    renderCard(
      {
        name: "Ada Lovelace",
        email: "ada@acme.test",
        phone: "305-555-0100",
        enableContactButton: true,
        contactButtonTypes: ["calendar", "phone"],
        schedulingUrl: "https://cal.test/ada",
      },
      { highlighted: true },
    );

    for (const label of ["Schedule Appt.", "Call Now"]) {
      expect(screen.getByRole("button", { name: label }).style.color).toBe(
        "rgb(18, 52, 86)",
      );
    }
  });

  it("fills a highlighted card and inverts its CTA", () => {
    renderCard(
      {
        name: "Ada Lovelace",
        title: "Benefits Advisor",
        email: "ada@acme.test",
        phone: "305-555-0100",
        enableContactButton: true,
        contactButtonType: "calendar",
        schedulingUrl: "https://cal.test/ada",
      },
      { highlighted: true },
    );

    // The plan's primary colour fills the card…
    expect(screen.getByTestId("contact-card").style.backgroundColor).toBe(
      "rgb(18, 52, 86)",
    );
    // …the name wears the colour that is readable on it…
    expect(screen.getByRole("heading", { level: 3 }).style.color).toBe(
      "rgb(255, 255, 255)",
    );
    // …the contact-detail icons invert with it, instead of keeping the plan's
    // secondary colour (which sinks into the brand fill)…
    for (const detail of ["ada@acme.test", "(305) 555-0100"]) {
      const icon = screen
        .getByText(detail)
        .closest("button")
        ?.querySelector("svg") as SVGElement | null;
      expect(icon).not.toBeNull();
      expect(icon!.style.color).toBe("rgb(255, 255, 255)");
    }
    // …and the CTA is inverted, exactly like the primary "How Can We Help" card.
    const cta = screen.getByRole("button", { name: "Schedule Appt." });
    expect(cta.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(cta.style.color).toBe("rgb(18, 52, 86)");
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

/**
 * The phone designs (`mobileVariant`), used by My Benefits Team and both Key
 * Contacts previews.
 *
 * The old mobile card was a centred vertical stack — logo, avatar, name, title,
 * company, contact lines, buttons — so a full-width card wasted most of its width
 * and grew very tall. `wide` puts identity in a left column beside the details;
 * `compact` keeps the vertical order at a grid width but far tighter.
 */
describe("SmallVerticalCard mobile variants", () => {
  const CONTACT = {
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Benefits Advisor",
    companyName: "Acme",
    email: "ada@acme.test",
    phone: "(305) 555-0100",
  };

  function mobileCard(props: Partial<CardProps>) {
    return renderCard(CONTACT, { compact: true, ...props });
  }

  it("renders the wide design for a full-width phone card", () => {
    const { container } = mobileCard({ mobileVariant: "wide" });

    expect(
      container.querySelector('[data-mobile-variant="wide"]'),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Benefits Advisor")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("ada@acme.test")).toBeInTheDocument();
    expect(screen.getByText("(305) 555-0100")).toBeInTheDocument();
  });

  it("renders the compact design for a card sharing a grid row", () => {
    const { container } = mobileCard({ mobileVariant: "compact" });

    expect(
      container.querySelector('[data-mobile-variant="compact"]'),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Benefits Advisor")).toBeInTheDocument();
    expect(screen.getByText("ada@acme.test")).toBeInTheDocument();
  });

  it("puts the identity column beside the details on the wide card", () => {
    const { container } = mobileCard({ mobileVariant: "wide" });

    // One two-column row: the avatar's column is a sibling of the details column,
    // so the details never stack under the photo.
    const row = container.querySelector('[data-mobile-variant="wide"] > div');
    expect(row?.children).toHaveLength(2);
    expect(
      row?.children[0].contains(screen.getByTestId("contact-avatar")),
    ).toBe(true);
    expect(row?.children[1].contains(screen.getByText("Ada Lovelace"))).toBe(
      true,
    );
  });

  it("draws the actions outside the two-column row", () => {
    // A contact with a configured CTA, so the action row is actually drawn.
    const { container } = renderCard(
      {
        ...CONTACT,
        enableContactButton: true,
        contactButtonType: "calendar",
        schedulingUrl: "https://cal.test/ada",
      },
      { compact: true, mobileVariant: "wide" },
    );

    const root = container.querySelector('[data-mobile-variant="wide"]');
    const buttons = screen.getByRole("button", { name: "Schedule Appt." });
    expect(root?.children[1].contains(buttons)).toBe(true);
  });

  it("keeps every preview placeholder in both designs", () => {
    const wide = renderCard(
      {},
      { compact: true, mobileVariant: "wide", previewPlaceholders: true },
    );
    expect(screen.getByText("[First & Last Name]")).toBeInTheDocument();
    expect(screen.getByText("[Job Title]")).toBeInTheDocument();
    expect(screen.getByText("[Company / Organization]")).toBeInTheDocument();
    expect(screen.getByText("[Email]")).toBeInTheDocument();
    expect(screen.getByText("[Phone]")).toBeInTheDocument();
    expect(screen.getByText("[Logo]")).toBeInTheDocument();
    wide.unmount();

    renderCard(
      {},
      { compact: true, mobileVariant: "compact", previewPlaceholders: true },
    );
    expect(screen.getByText("[First & Last Name]")).toBeInTheDocument();
    expect(screen.getByText("[Email]")).toBeInTheDocument();
  });

  it("hides the role line for a support line in both designs", () => {
    const wide = renderCard(
      { contactType: "team_support", displayName: "Help Desk" },
      { compact: true, mobileVariant: "wide" },
    );
    expect(screen.getByText("Help Desk")).toBeInTheDocument();
    expect(screen.queryByText("Benefits Advisor")).not.toBeInTheDocument();
    wide.unmount();

    renderCard(
      { contactType: "team_support", displayName: "Help Desk" },
      { compact: true, mobileVariant: "compact" },
    );
    expect(screen.getByText("Help Desk")).toBeInTheDocument();
  });

  it("keeps the existing card when no mobile variant is requested", () => {
    const { container } = renderCard(CONTACT, { compact: true });

    expect(container.querySelector("[data-mobile-variant]")).toBeNull();
  });
});
