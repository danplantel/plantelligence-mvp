import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ViewClientPage from "../page";

/**
 * The portal landing page (`app/(portal)/[id]/page.tsx`) is a projection: the
 * provider supplies the plan, and this page decides what `ClientPortal`
 * receives.
 *
 * The rules it owns:
 *
 *  - which contacts survive (`showOnPortal`, then the hub-visibility rules);
 *  - where visibility comes from (top level, then the `employeePortalPreview`
 *    fallback) and that it is normalized to the four canonical keys;
 *  - the footer-colour preference, which has to travel with the payload because
 *    the landing page hides `ClientPortal`'s own footer;
 *  - the advisor's disclaimer winning over the plan's text;
 *  - the two "nothing to show" branches.
 *
 * `ClientPortal` is replaced by a JSON dump so the assertions are about props,
 * not about markup owned by the sections.
 */

const mocks = vi.hoisted(() => ({
  portal: { clientData: null as Record<string, any> | null, loading: false },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "plan-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => mocks.portal,
}));

vi.mock("@/components/pages/client-portal/client-portal", () => ({
  ClientPortal: (props: Record<string, unknown>) => (
    <pre data-testid="client-portal">{JSON.stringify(props)}</pre>
  ),
}));

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    companyName: "Acme",
    companyWebsite: "https://acme.test",
    companyLogo: "https://cdn.test/logo.png",
    logoFileName: "logo.png",
    brandColor: "#123456",
    secondaryColor: "#654321",
    heroTitle: "Welcome",
    heroDescription: "Glad you are here",
    missionHeadline: "Our mission",
    missionBody: "Do good",
    keyContacts: [{ name: "Ada", showOnPortal: true }],
    documents: [{ id: "doc-1" }],
    disclaimers: "Plan disclaimer",
    categoryPortalVisibility: { Other: false },
    ...overrides,
  };
}

function renderPage() {
  return render(<ViewClientPage />);
}

function portalProps() {
  const node = screen.getByTestId("client-portal");
  return JSON.parse(node.textContent || "{}");
}

function contactNames(): string[] {
  return portalProps().data.keyContacts.map(
    (contact: { name: string }) => contact.name,
  );
}

beforeEach(() => {
  mocks.portal = { clientData: null, loading: false };
});

describe("landing page states", () => {
  it("renders a skeleton while the plan is loading", () => {
    mocks.portal = { clientData: null, loading: true };

    const { container } = renderPage();

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByTestId("client-portal")).not.toBeInTheDocument();
  });

  it("renders nothing when the load has settled without a plan", () => {
    mocks.portal = { clientData: null, loading: false };

    const { container } = renderPage();

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("client-portal")).not.toBeInTheDocument();
  });
});

describe("landing page contact projection", () => {
  it("drops contacts that are hidden from the portal", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: {},
        keyContacts: [
          { name: "Ada", showOnPortal: true },
          { name: "Grace", showOnPortal: false },
          { name: "Hidden by default is allowed" },
        ],
      }),
      loading: false,
    };
    renderPage();

    expect(contactNames()).toEqual(["Ada", "Hidden by default is allowed"]);
  });

  it("unwraps the { contacts } envelope", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: {},
        keyContacts: {
          contacts: [{ name: "Ada", showOnPortal: true }],
          displayStyle: 2,
        },
      }),
      loading: false,
    };
    renderPage();

    expect(contactNames()).toEqual(["Ada"]);
    // The envelope's display styles are not forwarded (documented gap).
    expect(portalProps().data.displayStyle).toBeUndefined();
    expect(portalProps().data.mobileDisplayStyle).toBeUndefined();
  });

  it("drops a JSON-string contact payload, which the page cannot read", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: {},
        keyContacts: JSON.stringify([{ name: "Ada" }]),
      }),
      loading: false,
    };
    renderPage();

    expect(contactNames()).toEqual([]);
  });

  it("hides a contact whose hub is switched off", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: { Other: false },
        keyContacts: [
          { name: "Retirement", benefitsCategories: ["Retirement"] },
          { name: "Other", benefitsCategories: ["Other Benefits"] },
          { name: "Sponsor", benefitsCategories: ["Company / Plan Sponsor"] },
        ],
      }),
      loading: false,
    };
    renderPage();

    expect(contactNames()).toEqual(["Retirement", "Sponsor"]);
  });

  it("keeps every contact when all hubs are hidden", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: {
          Retirement: false,
          "Group Health": false,
          "Group Life": false,
          Other: false,
        },
        keyContacts: [
          { name: "Retirement", benefitsCategories: ["Retirement"] },
          { name: "Other", benefitsCategories: ["Other"] },
        ],
      }),
      loading: false,
    };
    renderPage();

    expect(contactNames()).toEqual(["Retirement", "Other"]);
  });

  it("falls back to the preview snapshot for visibility", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: undefined,
        employeePortalPreview: {
          categoryPortalVisibility: { Other: false },
        },
        keyContacts: [
          { name: "Other", benefitsCategories: ["Other Benefits"] },
        ],
      }),
      loading: false,
    };
    renderPage();

    expect(contactNames()).toEqual([]);
    expect(portalProps().data.categoryPortalVisibility).toEqual({
      Retirement: true,
      "Group Health": true,
      "Group Life": true,
      Other: false,
    });
  });

  it("normalizes a JSON-string visibility payload", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: JSON.stringify({ Other: false }),
        keyContacts: [
          { name: "Other", benefitsCategories: ["Other Benefits"] },
        ],
      }),
      loading: false,
    };
    renderPage();

    expect(contactNames()).toEqual([]);
  });
});

describe("landing page footer preference", () => {
  it("forwards a secondary footer background", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: {},
        disclaimers: JSON.stringify({
          footerBackground: { mode: "secondary" },
        }),
      }),
      loading: false,
    };
    renderPage();

    expect(portalProps().data.companyData.footerBackground).toEqual({
      mode: "secondary",
    });
  });

  it("forwards a custom footer colour", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: {},
        disclaimers: {
          footerBackground: { mode: "custom", customColor: "#abc" },
        },
      }),
      loading: false,
    };
    renderPage();

    expect(portalProps().data.companyData.footerBackground).toEqual({
      mode: "custom",
      customColor: "#abc",
    });
  });

  it("treats plain-text disclaimers as no preference", () => {
    expect(() => {
      mocks.portal = {
        clientData: plan({
          categoryPortalVisibility: {},
          disclaimers: "Text only",
        }),
        loading: false,
      };
      renderPage();
    }).not.toThrow();

    expect(portalProps().data.companyData.footerBackground).toBeUndefined();
  });

  it("survives malformed disclaimer JSON", () => {
    mocks.portal = {
      clientData: plan({
        categoryPortalVisibility: {},
        disclaimers: "{broken",
      }),
      loading: false,
    };

    expect(() => renderPage()).not.toThrow();
    expect(portalProps().data.companyData.footerBackground).toBeUndefined();
  });
});

describe("landing page projection", () => {
  it("passes the route param, hides the inner chrome, and forwards the plan", () => {
    mocks.portal = {
      clientData: plan({
        secondaryBannerImg: "https://cdn.test/banner.png",
        employeePortalPreview: { benefits: [{ title: "Retirement" }] },
      }),
      loading: false,
    };
    renderPage();

    const props = portalProps();
    expect(props.clientId).toBe("plan-1");
    expect(props.hideHeader).toBe(true);
    expect(props.hideFooter).toBe(true);
    expect(props.data.secondaryBannerImg).toBe("https://cdn.test/banner.png");
    expect(props.data.documents).toEqual([{ id: "doc-1" }]);
    expect(props.data.employeePortalPreview).toEqual({
      benefits: [{ title: "Retirement" }],
    });
    expect(props.data.companyData).toMatchObject({
      companyName: "Acme",
      companyWebsite: "https://acme.test",
      companyLogo: "https://cdn.test/logo.png",
      logoFileName: "logo.png",
      brandColor: "#123456",
      secondaryColor: "#654321",
      heroTitle: "Welcome",
      heroDescription: "Glad you are here",
      missionHeadline: "Our mission",
      missionBody: "Do good",
    });
  });

  it("prefers the advisor's disclaimer over the plan's text", () => {
    mocks.portal = {
      clientData: plan({
        advisorDisclaimer: "Advisor disclaimer",
        disclaimers: "Plan disclaimer",
      }),
      loading: false,
    };
    renderPage();

    expect(portalProps().data.companyData.disclaimers).toBe(
      "Advisor disclaimer",
    );
  });

  it("falls back to the plan's disclaimer when the advisor has none", () => {
    mocks.portal = {
      clientData: plan({ disclaimers: "Plan disclaimer" }),
      loading: false,
    };
    renderPage();

    expect(portalProps().data.companyData.disclaimers).toBe("Plan disclaimer");
  });

  it("defaults the optional fields so the renderer never receives undefined", () => {
    mocks.portal = {
      clientData: {
        id: "plan-1",
        companyName: "Acme",
        brandColor: "#123456",
        secondaryColor: "#654321",
        keyContacts: [],
      },
      loading: false,
    };
    renderPage();

    const company = portalProps().data.companyData;
    expect(company.companyWebsite).toBe("");
    expect(company.companyLogo).toBe("");
    expect(company.logoFileName).toBe("");
    expect(company.heroTitle).toBeUndefined();
    expect(company.heroDescription).toBeUndefined();
    expect(company.missionHeadline).toBe("");
    expect(company.missionBody).toBe("");
    expect(company.disclaimers).toBe("");
  });
});
