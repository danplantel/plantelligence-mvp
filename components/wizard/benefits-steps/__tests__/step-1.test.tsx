import React from "react";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsStep1 } from "@/components/wizard/benefits-steps/step-1";

/**
 * Create/Edit Benefit → Step 1 (Plan & Benefit Selection, Branding, Messaging,
 * Contacts).
 *
 * The store is a reactive stand-in, the plan requests are mocked, and every
 * heavy child (accordion, popover, radios, category cards, image controls and
 * the contact dialogs) is stubbed. The suite therefore pins Step 1's own
 * orchestration: the plan-list gate and its archived filter, readiness for the
 * Edit page, the category picker/custom name, the messaging + signature writes,
 * primary-contact selection and the section/mode gating.
 */

const mocks = vi.hoisted(() => {
  let listeners = new Set<() => void>();
  let cached: any = null;
  const state: any = { stepData: { step1: {} } };

  const getSnapshot = () => cached;
  const emit = () => {
    cached = { ...state };
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const reset = (step1: Record<string, unknown>) => {
    state.stepData = { step1 };
    state.saveStepData = vi.fn((step: number, data: any) => {
      state.stepData = { ...state.stepData, [`step${step}`]: data };
      emit();
    });
    state.goToStep = vi.fn();
    cached = { ...state };
    emit();
  };

  return {
    state,
    reset,
    subscribe,
    getSnapshot,
    fetchClientOnce: vi.fn(async (): Promise<any> => null),
    fetchBenefitRowsOnce: vi.fn(async (): Promise<any[]> => []),
    invalidateClientCache: vi.fn(),
    invalidateBenefitRowsCache: vi.fn(),
    fetchProfileOnce: vi.fn(async () => ({ primaryServiceCategories: [] })),
    routerPush: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastMessage: vi.fn(),
    consoleError: vi.fn(),
    onReady: vi.fn(),
  };
});

vi.mock("@/lib/benefits-wizard-store", async () => {
  const React = await import("react");
  const useStore = (selector?: (value: any) => unknown) => {
    const snapshot = React.useSyncExternalStore(
      mocks.subscribe,
      mocks.getSnapshot,
      mocks.getSnapshot,
    );
    return selector ? selector(snapshot) : snapshot;
  };
  return {
    useBenefitsWizardStore: Object.assign(useStore, {
      getState: () => mocks.state,
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("swr", () => {
  const data = { primaryServiceCategories: [] };
  return { default: () => ({ data }) };
});

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: mocks.fetchProfileOnce,
}));

vi.mock("@/lib/fetch-client", () => ({
  fetchClientOnce: mocks.fetchClientOnce,
  fetchBenefitRowsOnce: mocks.fetchBenefitRowsOnce,
  invalidateClientCache: mocks.invalidateClientCache,
  invalidateBenefitRowsCache: mocks.invalidateBenefitRowsCache,
}));

vi.mock("@/lib/marketing/hub-url", () => ({
  getBenefitsHubOpenPortalUrl: () => "http://portal.local/benefits",
}));

vi.mock("@/lib/comments/portal-surface", () => ({
  withCommentsRail: (href: string) => href,
}));

vi.mock("@/lib/plan-selector-storage", () => ({
  persistPlanSelection: vi.fn(),
}));

vi.mock("@/lib/draft-utils", () => ({
  storePendingDraftSelection: vi.fn(),
}));

vi.mock("@/lib/benefit-custom-name", () => ({
  BENEFIT_TITLE_MAX_LENGTH: 35,
}));

vi.mock("@/lib/landing-card-defaults", () => ({
  getDefaultLandingCardBody: () => "",
}));

vi.mock("@/lib/benefit-completeness", () => ({
  getBenefitCompleteness: () => ({
    sections: {
      branding: false,
      messaging: false,
      contacts: false,
      documents: false,
    },
  }),
  normalizeBenefitsCategoryForCompleteness: (category: string) => category,
}));

vi.mock("@/lib/benefit-category-slug", () => ({
  categoryToSlug: (category: string) => category.toLowerCase(),
}));

vi.mock("@/lib/compliance-document-utils", () => ({
  convertToDocumentFormat: async (row: any) => row,
}));

vi.mock("@/lib/seed-onboarding-advisor-contacts", () => ({
  mergeOnboardingAdvisorContactsIntoKeyContacts: (contacts: any[]) => contacts,
}));

vi.mock("@/lib/benefit-contacts", () => ({
  contactCompanyLogoForCategory: () => null,
}));

vi.mock("@/lib/benefit-category-gallery", () => ({
  BENEFIT_CATEGORY_GALLERY: {},
  toCategoryGalleryKey: () => null,
}));

vi.mock(
  "@/components/wizard/new-client-steps/sections/utils/image-utils",
  () => ({
    exportFullResolutionImage: async () => null,
  }),
);

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    message: mocks.toastMessage,
  },
}));

vi.mock("@/components/ui/brand-image-upload", () => ({
  BrandImageUpload: ({ slot }: { slot?: { title?: string } }) => (
    <div data-testid="brand-image-upload">{slot?.title}</div>
  ),
}));

vi.mock("@/components/ui/modalGallery", () => ({
  ModalGallery: () => null,
}));

vi.mock("@/components/ui/simple-image-editor-modal", () => ({
  SimpleImageEditorModal: () => null,
}));

vi.mock(
  "@/components/wizard/new-client-steps/sections/brand-images-section",
  () => ({
    BrandImagesSection: () => <div data-testid="brand-images-section" />,
  }),
);

vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: ({ alt }: { alt?: string }) => <span>{alt ?? ""}</span>,
}));

vi.mock("@/components/ui/add-contact-modal", () => ({
  AddContactModal: () => null,
}));

vi.mock("@/components/ui/plan-change-loading-dialog", () => ({
  PlanChangeLoadingDialog: () => null,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({
    value,
    children,
  }: {
    value?: string[];
    children?: React.ReactNode;
  }) => (
    <div data-testid="accordion" data-active={(value ?? []).join(",")}>
      {children}
    </div>
  ),
  AccordionItem: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionContent: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

vi.mock("@/components/ui/radio-group", async () => {
  const { createContext, useContext } = await import("react");
  const RadioContext = createContext<{
    value: string;
    onValueChange: (value: string) => void;
  }>({ value: "", onValueChange: () => {} });

  return {
    RadioGroup: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children?: React.ReactNode;
    }) => (
      <RadioContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </RadioContext.Provider>
    ),
    RadioGroupItem: ({ value, id }: { value: string; id?: string }) => {
      const ctx = useContext(RadioContext);
      return (
        <input
          type="radio"
          id={id}
          value={value}
          checked={ctx.value === value}
          onChange={() => ctx.onValueChange(value)}
        />
      );
    },
  };
});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: React.ReactNode;
  }) => (
    <select
      aria-label="Plan"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children?: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

vi.mock("../benefit-category-card", () => ({
  BenefitCategoryCard: (props: any) => (
    <div data-testid={`category-${props.label}`}>
      <span>{props.label}</span>
      <button type="button" onClick={props.primary.onClick}>
        {props.primary.label}
      </button>
      {props.secondary ? (
        <button type="button" onClick={props.secondary.onClick}>
          {props.secondary.label}
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("../benefits-documents-section", () => ({
  BenefitsDocumentsSection: () => <div data-testid="documents-section" />,
}));

vi.mock("../benefit-contact-dialog", () => ({
  BenefitContactDialog: (props: any) =>
    props.open ? <div data-testid="contact-dialog">{props.mode}</div> : null,
}));

const CONTACT_JANE = {
  id: "c1",
  name: "Jane Advisor",
  title: "Advisor",
  email: "jane@acme.com",
  benefitsCategories: ["retirement"],
  isPrimary: false,
  isPrimaryOverall: false,
};
const CONTACT_BOB = {
  id: "c2",
  name: "Bob Broker",
  title: "Broker",
  email: "bob@acme.com",
  benefitsCategories: ["retirement"],
  isPrimary: false,
  isPrimaryOverall: false,
};

const baseStep1 = (overrides: Record<string, any> = {}) => ({
  planId: "plan-1",
  benefitCategory: "Retirement",
  contactId: "",
  benefitTitle: "",
  shortDescription: "",
  brandImages: {
    header: null,
    thumbnail: null,
    secondaryBanner: null,
    favicon: null,
  },
  selectedPlan: {
    id: "plan-1",
    companyName: "Acme Corp",
    status: "Active",
    brandColor: "#111111",
    keyContacts: [CONTACT_JANE, CONTACT_BOB],
  },
  ...overrides,
});

const jsonResponse = (ok: boolean, body: unknown, status = ok ? 200 : 500) =>
  ({ ok, status, json: async () => body }) as Response;

function installFetch(
  plans: any[] = [{ id: "plan-1", companyName: "Acme Corp", status: "Active" }],
  options: { plansFailure?: string } = {},
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (
      url.startsWith("/api/clients?") ||
      url.includes("/api/clients?status=")
    ) {
      if (options.plansFailure) {
        return jsonResponse(false, { error: options.plansFailure });
      }
      return jsonResponse(true, { success: true, data: plans });
    }
    if (url.includes("/api/clients/") && url.includes("/benefits/")) {
      return jsonResponse(true, { success: true });
    }
    return jsonResponse(true, {});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderReady(
  props: {
    mode?: "wizard" | "edit";
    sections?: string[];
    hideCategoryPicker?: boolean;
  } = {},
) {
  const view = render(
    <BenefitsStep1
      mode={props.mode}
      sections={props.sections}
      hideCategoryPicker={props.hideCategoryPicker}
      onReady={mocks.onReady}
    />,
  );
  // The plan list gates the picker; wait for it to settle.
  await waitFor(() => expect(mocks.onReady).toHaveBeenCalled());
  return view;
}

const lastStep1Save = () => {
  const calls = mocks.state.saveStepData.mock.calls.filter(
    (call: any[]) => call[0] === 1,
  );
  return calls.at(-1)?.[1];
};

describe("BenefitsStep1", () => {
  beforeEach(() => {
    mocks.reset(baseStep1());
    mocks.fetchClientOnce.mockResolvedValue(null);
    mocks.fetchBenefitRowsOnce.mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(mocks.consoleError);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("plan gate", () => {
    it("announces readiness once the plan list settles", async () => {
      installFetch();
      await renderReady();

      expect(mocks.onReady).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Benefit Category")).toBeInTheDocument();
    });

    it("shows the pinned plan summary instead of the plan picker", async () => {
      installFetch();
      await renderReady();

      expect(
        screen.getByText("Creating a new benefit for Acme Corp - Retirement"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Plan")).not.toBeInTheDocument();
    });

    it("reports a plan-list failure", async () => {
      installFetch([], { plansFailure: "Unauthorized" });
      await renderReady();

      expect(mocks.toastError).toHaveBeenCalledWith(
        "Please sign in to load your plans.",
      );
    });

    it("clears a saved plan that is no longer in the list", async () => {
      mocks.reset(baseStep1({ planId: "plan-gone" }));
      installFetch([
        { id: "plan-1", companyName: "Acme Corp", status: "Active" },
      ]);
      await renderReady();

      await waitFor(() =>
        expect(mocks.toastMessage).toHaveBeenCalledWith(
          "Pick a plan",
          expect.objectContaining({
            description: expect.stringMatching(/archived/),
          }),
        ),
      );
      expect(lastStep1Save()).toEqual(
        expect.objectContaining({
          planId: "",
          selectedPlan: null,
          benefitTitle: "",
        }),
      );
    });
  });

  describe("category picker", () => {
    it("starts the wizard for a category from its card", async () => {
      installFetch();
      await renderReady();

      const card = screen.getByTestId("category-Retirement");
      fireEvent.click(
        within(card).getByRole("button", { name: "Create benefit" }),
      );

      expect(lastStep1Save()).toEqual(
        expect.objectContaining({ benefitCategory: "Retirement" }),
      );
      expect(screen.getByTestId("accordion")).toHaveAttribute(
        "data-active",
        "branding",
      );
    });

    it("hides the category cards when the deep link already pinned one", async () => {
      installFetch();
      await renderReady({ hideCategoryPicker: true });

      expect(screen.queryByText("Benefit Category")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("category-Retirement"),
      ).not.toBeInTheDocument();
    });

    it("offers the Custom Category Name field for the Custom hub", async () => {
      mocks.reset(baseStep1({ benefitCategory: "Company / Plan Sponsor" }));
      installFetch();
      await renderReady();

      const input = screen.getByPlaceholderText(
        "e.g. Disability Insurance, Wellness Program, HSA...",
      );
      fireEvent.change(input, { target: { value: "Wellness Program" } });

      expect(lastStep1Save()).toEqual(
        expect.objectContaining({ benefitTitle: "Wellness Program" }),
      );
    });

    it("hides the picker and step CONTINUE buttons in edit mode", async () => {
      mocks.reset(baseStep1());
      installFetch();
      await renderReady({ mode: "edit" });

      expect(screen.queryByText("Benefit Category")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "CONTINUE TO KEY CONTACTS" }),
      ).not.toBeInTheDocument();
      // The sections themselves still render for the Edit page.
      expect(screen.getByText("Messaging")).toBeInTheDocument();
    });
  });

  describe("messaging", () => {
    it("writes the intro headline", async () => {
      installFetch();
      await renderReady({ sections: ["messaging"] });

      const input = screen.getByPlaceholderText("e.g., 401(k) Retirement Plan");
      fireEvent.change(input, {
        target: { value: "Retirement Plan Benefits" },
      });

      expect(lastStep1Save()).toEqual(
        expect.objectContaining({ benefitTitle: "Retirement Plan Benefits" }),
      );
      expect(
        screen.getByText(
          `${"Retirement Plan Benefits".length} / 35 characters`,
        ),
      ).toBeInTheDocument();
    });

    it("writes the intro message", async () => {
      installFetch();
      await renderReady({ sections: ["messaging"] });

      const message = screen.getByPlaceholderText(
        "Provide a high-level overview of this benefit for employees...",
      );
      fireEvent.change(message, {
        target: { value: "A great retirement benefit." },
      });

      expect(lastStep1Save()).toEqual(
        expect.objectContaining({
          shortDescription: "A great retirement benefit.",
        }),
      );
    });

    it("reveals and writes the custom signature fields", async () => {
      installFetch();
      await renderReady({ sections: ["messaging"] });

      fireEvent.click(screen.getByLabelText("Custom Signature"));

      expect(lastStep1Save()).toEqual(
        expect.objectContaining({ signatureMode: "custom" }),
      );

      fireEvent.change(
        screen.getByPlaceholderText('e.g. "We hope to inspire you to save!"'),
        { target: { value: "Save early!" } },
      );
      expect(lastStep1Save()).toEqual(
        expect.objectContaining({ customClosing: "Save early!" }),
      );

      fireEvent.change(
        screen.getByPlaceholderText('e.g. "Ty G. Rogers Managing Partner"'),
        { target: { value: "Ty Rogers" } },
      );
      expect(lastStep1Save()).toEqual(
        expect.objectContaining({ customSignatureName: "Ty Rogers" }),
      );
    });

    it("advances to the contacts section from the messaging footer", async () => {
      installFetch();
      await renderReady({ sections: ["messaging"] });

      fireEvent.click(
        screen.getByRole("button", { name: "CONTINUE TO KEY CONTACTS" }),
      );

      expect(screen.getByTestId("accordion")).toHaveAttribute(
        "data-active",
        "contacts",
      );
    });
  });

  describe("primary contact", () => {
    it("selects a contact, prefills the benefit and marks them primary", async () => {
      installFetch();
      await renderReady({ sections: ["contacts"] });

      fireEvent.click(
        within(screen.getByTestId("popover-content")).getByText("Jane Advisor"),
      );

      const saved = lastStep1Save();
      expect(saved).toEqual(expect.objectContaining({ contactId: "c1" }));
      expect(saved.selectedPlan.keyContacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "c1",
            isPrimary: true,
            isPrimaryOverall: true,
          }),
        ]),
      );
      expect(screen.getByRole("combobox")).toHaveTextContent("Jane Advisor");
    });

    it("filters the contact list by the search term", async () => {
      installFetch();
      await renderReady({ sections: ["contacts"] });

      const search = screen.getByPlaceholderText("Search contacts...");
      fireEvent.change(search, { target: { value: "Bob" } });

      const list = within(screen.getByTestId("popover-content"));
      expect(list.getByText("Bob Broker")).toBeInTheDocument();
      expect(list.queryByText("Jane Advisor")).not.toBeInTheDocument();
    });

    it("shows the empty search state", async () => {
      mocks.reset(
        baseStep1({
          selectedPlan: {
            id: "plan-1",
            companyName: "Acme Corp",
            keyContacts: [],
          },
        }),
      );
      installFetch();
      await renderReady({ sections: ["contacts"] });

      expect(screen.getByText("No contacts found.")).toBeInTheDocument();
    });

    it("opens the shared contact editor in create mode", async () => {
      installFetch();
      await renderReady({ sections: ["contacts"] });

      fireEvent.click(screen.getByRole("button", { name: /ADD NEW CONTACT/ }));
      expect(screen.getByTestId("contact-dialog")).toHaveTextContent("create");
    });
  });

  describe("section gating", () => {
    it("renders only the requested sections", async () => {
      installFetch();
      await renderReady({ sections: ["messaging"] });

      expect(screen.getByText("Messaging")).toBeInTheDocument();
      expect(screen.queryByText("Key Contact")).not.toBeInTheDocument();
      expect(screen.queryByTestId("documents-section")).not.toBeInTheDocument();
    });

    it("renders contacts without messaging when asked", async () => {
      installFetch();
      await renderReady({ sections: ["contacts"] });

      expect(screen.getByText("Key Contact")).toBeInTheDocument();
      expect(screen.queryByText("Messaging")).not.toBeInTheDocument();
    });
  });
});
