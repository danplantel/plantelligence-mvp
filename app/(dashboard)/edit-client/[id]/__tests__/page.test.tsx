import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditClientPage from "../page";

/**
 * Edit Plan (`app/(dashboard)/edit-client/[id]/page.tsx`).
 *
 * The page is a 5,700-line composition, so `useEditClient` and every heavy
 * child (header, preview, tab sections, dialogs) are mocked. These tests pin the
 * page's own orchestration: the loading / error / preview branches, the header
 * and title, the tab bar (including `?tab=` deep links), the comment surface,
 * and the Cancel / Save bar.
 */

const mocks = vi.hoisted(() => {
  const editClient: any = {};
  const resetEditClient = (overrides: Record<string, unknown> = {}) => {
    for (const key of Object.keys(editClient)) delete editClient[key];
    Object.assign(editClient, {
      client: {
        id: "plan-1",
        slug: "acme",
        companyName: "Acme",
        status: "Active",
        type: "client",
      },
      clientId: "plan-1",
      loading: false,
      saving: false,
      error: null,
      showPreview: false,
      companyData: {
        companyName: "Acme",
        companyWebsite: "acme.test",
        companyLogo: null,
        logoFileName: "",
        planType: "client",
        portalUrl: "acme",
        primaryColor: "#112233",
        secondaryColor: "#445566",
        typographyTheme: "default",
        missionHeadline: "Our mission",
        missionBody: "Mission body",
        heroTitle: "Welcome to the Acme Benefits Hub!",
        heroDescription: "Hero copy",
        appointmentLink: "",
        brandImages: {
          header: null,
          thumbnail: null,
          secondaryBanner: null,
          favicon: null,
        },
      },
      clientStatus: "Active",
      keyContacts: [
        {
          id: "c1",
          name: "Ada Lovelace",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@acme.test",
          benefitsCategories: ["Retirement"],
          isPrimaryOverall: true,
        },
      ],
      keyContactsDisplayStyle: 1,
      keyContactsMobileDisplayStyle: 1,
      welcomeData: { headline: "Welcome!", bodyText: "Body copy" },
      documentsData: {
        spdFile: null,
        retirementPlanDocuments: [],
        otherDocuments: [],
        recordkeeper: "",
      },
      disclaimers: "",
      categoryPortalVisibility: {},
      setShowPreview: vi.fn(),
      setClientStatus: vi.fn(),
      setKeyContacts: vi.fn(),
      setKeyContactsDisplayStyle: vi.fn(),
      setKeyContactsMobileDisplayStyle: vi.fn(),
      setDisclaimers: vi.fn(),
      handleInputChange: vi.fn(),
      handleWelcomeChange: vi.fn(),
      handleDocumentsChange: vi.fn(),
      handleHeadshotUpload: vi.fn(),
      handleHeadshotRemove: vi.fn(),
      handleFileUpload: vi.fn(),
      handleFileRemove: vi.fn(),
      handleSave: vi.fn(async () => true),
      isFormValid: vi.fn(() => true),
      getValidationErrors: vi.fn(() => []),
      setCategoryPortalVisibility: vi.fn(),
      ...overrides,
    });
    return editClient;
  };
  return {
    editClient,
    resetEditClient,
    push: vi.fn(),
    setTitle: vi.fn(),
    canManageTeam: true,
    useCommentSurface: vi.fn(),
    fetch: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    swrAssignmentData: undefined as any,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({ setTitle: mocks.setTitle }),
}));

vi.mock("@/hooks/useViewerAccess", () => ({
  useViewerAccess: () => ({ canManageTeam: mocks.canManageTeam }),
}));

vi.mock("@/hooks/useEditClient", () => ({
  useEditClient: () => mocks.editClient,
}));

vi.mock("@/hooks/useContactEmailConflict", () => ({
  useContactEmailConflict: () => ({ conflict: null }),
}));

vi.mock("@/lib/fetch-profile", () => ({
  fetchProfileOnce: vi.fn(async () => null),
}));

vi.mock("@/lib/upload-to-r2", () => ({ deleteFromR2: vi.fn(async () => {}) }));
vi.mock("@/lib/branding-r2", () => ({
  uploadBrandingToR2: vi.fn(async () => ({ url: "https://cdn.test/logo.png" })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("swr", () => ({
  default: (key: string | null) => {
    if (typeof key === "string" && key.includes("plan-assignments")) {
      return { data: mocks.swrAssignmentData, mutate: vi.fn() };
    }
    return { data: undefined, mutate: vi.fn() };
  },
}));

vi.mock("@/components/comments/comment-mode-provider", () => ({
  useCommentSurface: (surface: unknown) => mocks.useCommentSurface(surface),
}));

vi.mock("@/components/comments/comment-anchor", () => ({
  CommentAnchor: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/pages/edit-client", () => ({
  EditClientLoading: ({ onBackClick }: any) => (
    <div data-testid="edit-loading">
      <button type="button" onClick={onBackClick}>
        Loading back
      </button>
    </div>
  ),
  EditClientError: ({ error, onBackClick }: any) => (
    <div data-testid="edit-error">
      <span>{error}</span>
      <button type="button" onClick={onBackClick}>
        Error back
      </button>
    </div>
  ),
  EditClientPreview: ({ onBackClick, onSave }: any) => (
    <div data-testid="edit-preview">
      <button type="button" onClick={onBackClick}>
        Preview back
      </button>
      <button type="button" onClick={() => void onSave()}>
        Preview save
      </button>
    </div>
  ),
  EditClientHeader: ({
    clientStatus,
    onStatusChange,
    onBackClick,
    hasClient,
    planName,
    isFormValid,
  }: any) => (
    <div
      data-testid="edit-header"
      data-status={clientStatus}
      data-plan={planName}
      data-has-client={String(hasClient)}
      data-valid={String(isFormValid)}
    >
      <button type="button" onClick={onBackClick}>
        Header back
      </button>
      <button type="button" onClick={() => onStatusChange("Draft")}>
        Set draft
      </button>
    </div>
  ),
}));

vi.mock("@/components/pages/edit-client/save-button", () => ({
  SaveButton: ({
    onSave,
    onInvalidClick,
    saving,
    clientStatus,
    isFormValid,
  }: any) => (
    <button
      type="button"
      data-testid="save-button"
      data-saving={String(saving)}
      data-status={clientStatus}
      data-valid={String(isFormValid)}
      onClick={() => (isFormValid ? onSave() : onInvalidClick())}
    >
      Save
    </button>
  ),
}));

// Radix accordions render their trigger as a <button>; the page nests action
// buttons inside some triggers, which is invalid DOM and noisy in tests. The
// accordion itself is not under test here.
vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionTrigger: ({ children }: any) => <div>{children}</div>,
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => {
  const TabContext = React.createContext<{
    value: string;
    setValue: (value: string) => void;
  }>({ value: "", setValue: () => {} });

  return {
    Tabs: ({ value, onValueChange, children }: any) => (
      <TabContext.Provider value={{ value, setValue: onValueChange }}>
        {children}
      </TabContext.Provider>
    ),
    TabsList: ({ children }: any) => <div>{children}</div>,
    TabsTrigger: ({ value, children }: any) => {
      const context = React.useContext(TabContext);
      return (
        <button type="button" onClick={() => context.setValue(value)}>
          {children}
        </button>
      );
    },
    TabsContent: ({ value, children }: any) => {
      const context = React.useContext(TabContext);
      return context.value === value ? (
        <div data-testid={`tab-content-${value}`}>{children}</div>
      ) : null;
    },
  };
});

// ── Heavy children: none of these are under test here ──
vi.mock("@/components/teammates/collaborator-category-accordions", () => ({
  CollaboratorCategoryAccordions: () => null,
}));
vi.mock("@/components/teammates/invite-collaborator-dialog", () => ({
  InviteCollaboratorDialog: () => null,
}));
vi.mock("@/components/teammates/collaborator-detail-dialog", () => ({
  CollaboratorDetailDialog: () => null,
}));
vi.mock("@/components/wizard/benefits-steps/give-team-seat-dialog", () => ({
  GiveTeamSeatDialog: () => null,
}));
vi.mock("@/components/ui/universal-image-editor-modal", () => ({
  UniversalImageEditorModal: () => null,
}));
vi.mock("@/components/ui/contact-form-fields", () => ({
  ContactFormFields: () => null,
}));
vi.mock("@/components/pages/contact-form-page", () => ({
  ContactFormPage: () => null,
}));
vi.mock("@/components/ui/contact-email-conflict-notice", () => ({
  ContactEmailConflictNotice: () => null,
}));
vi.mock("@/components/contacts/contact-card", () => ({
  ContactCard: ({ contact }: any) => (
    <div data-testid="contact-card">{contact.name}</div>
  ),
  formatContactPhone: (value: string) => value,
}));
vi.mock("@/components/ui/contact-form-topic-builder", () => ({
  ContactFormTopicBuilder: () => null,
}));
vi.mock("@/components/ui/support-icon-picker", () => ({
  SupportIconPicker: () => null,
}));
vi.mock("@/components/pages/my-benefits-team/small-vertical-card", () => ({
  SmallVerticalCard: () => null,
}));
vi.mock("@/components/ui/chip-typeahead", () => ({
  ChipTypeahead: () => null,
}));
vi.mock(
  "@/components/wizard/new-client-steps/sections/brand-images-section",
  () => ({ BrandImagesSection: () => null }),
);
vi.mock(
  "@/components/wizard/new-client-steps/sections/brand-colors-section",
  () => ({ BrandColorsSection: () => null }),
);
vi.mock(
  "@/components/wizard/new-client-steps/sections/edit-plan-preview-section",
  () => ({ EditPlanPreviewSection: () => null }),
);
vi.mock(
  "@/components/pages/documents/components/compliance-documents-upload",
  () => ({ ComplianceDocumentsUpload: () => null }),
);
vi.mock("@/components/pages/documents/tabs/document-preview-tab", () => ({
  DocumentPreviewTab: () => null,
}));
vi.mock("@/components/pages/documents/tabs/document-list-tab", () => ({
  DocumentListTab: () => null,
}));
vi.mock(
  "@/components/pages/documents/components/document-preview-modal",
  () => ({ DocumentPreviewModal: () => null }),
);
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}));
vi.mock("@/components/ui/alert", () => ({
  AlertTitle: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/dismissible-alert", () => ({
  DismissibleAlert: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/branding-image", () => ({
  BrandingImage: () => null,
}));
vi.mock("@/components/ui/headshot", () => ({
  Headshot: () => null,
}));
vi.mock("@/components/pages/edit-client/plan-meetings-section", () => ({
  PlanMeetingsSection: () => null,
}));
vi.mock(
  "@/components/pages/edit-client/contact-card-layout-preview-modal",
  () => ({ ContactCardLayoutPreviewModal: () => null }),
);
vi.mock("@/components/pages/settings/disclaimer-update-confirm-dialog", () => ({
  DisclaimerUpdateConfirmDialog: () => null,
}));
vi.mock("@/components/pages/client-portal/sections/portal-disclaimers", () => ({
  PortalDisclaimers: () => null,
}));
vi.mock("@/components/ui/card-selection-modal", () => ({
  CardSelectionModal: () => null,
}));

function renderPage() {
  return render(<EditClientPage />);
}

beforeEach(() => {
  mocks.resetEditClient();
  mocks.push.mockReset();
  mocks.setTitle.mockReset();
  mocks.useCommentSurface.mockReset();
  mocks.canManageTeam = true;
  mocks.swrAssignmentData = { assignments: [], ownerEmails: [] };
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.fetch.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as any);
  vi.stubGlobal("fetch", mocks.fetch);

  window.history.replaceState({}, "", "/edit-client/plan-1");

  // The tab bar is portaled into the header's target node.
  document.body.innerHTML = '<div id="header-tabs-portal"></div>';
});

describe("EditClientPage states", () => {
  it("renders the loading state and back navigation", async () => {
    const user = userEvent.setup();
    mocks.editClient.loading = true;

    renderPage();

    expect(screen.getByTestId("edit-loading")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Loading back" }));
    expect(mocks.push).toHaveBeenCalledWith("/clients");
  });

  it("renders the error state with the message and back navigation", async () => {
    const user = userEvent.setup();
    mocks.editClient.error = "Forbidden";

    renderPage();

    expect(screen.getByTestId("edit-error")).toHaveTextContent("Forbidden");
    await user.click(screen.getByRole("button", { name: "Error back" }));
    expect(mocks.push).toHaveBeenCalledWith("/clients");
  });

  it("falls back to Client not found when there is no client and no error", () => {
    mocks.editClient.client = null;

    renderPage();

    expect(screen.getByTestId("edit-error")).toHaveTextContent(
      "Client not found",
    );
  });

  it("renders the preview branch and returns to the editor", async () => {
    const user = userEvent.setup();
    mocks.editClient.showPreview = true;

    renderPage();

    expect(screen.getByTestId("edit-preview")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-header")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preview back" }));
    expect(mocks.editClient.setShowPreview).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Preview save" }));
    expect(mocks.editClient.handleSave).toHaveBeenCalled();
  });
});

describe("EditClientPage header, title and tabs", () => {
  it("passes the plan identity and status to the header", () => {
    renderPage();

    const header = screen.getByTestId("edit-header");
    expect(header).toHaveAttribute("data-status", "Active");
    expect(header).toHaveAttribute("data-plan", "Acme");
    expect(header).toHaveAttribute("data-has-client", "true");
    expect(header).toHaveAttribute("data-valid", "true");
  });

  it("delegates a status change and the back action", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Set draft" }));
    expect(mocks.editClient.setClientStatus).toHaveBeenCalledWith("Draft");

    await user.click(screen.getByRole("button", { name: "Header back" }));
    expect(mocks.push).toHaveBeenCalledWith("/clients");
  });

  it("sets the page title from the plan name and clears it on Preview", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(mocks.setTitle).toHaveBeenLastCalledWith("Edit Plan - Acme");

    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(mocks.setTitle).toHaveBeenLastCalledWith("");
  });

  it("portals the five tab triggers into the header", async () => {
    const user = userEvent.setup();
    renderPage();

    for (const label of [
      "Branding",
      "Preview",
      "Key Contacts",
      "Documents",
      "Disclosures",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "Key Contacts" }));

    expect(screen.getByTestId("tab-content-contacts")).toBeInTheDocument();
    expect(screen.getByTestId("contact-card")).toHaveTextContent(
      "Ada Lovelace",
    );
  });

  it("opens a tab from a ?tab= deep link and ignores unknown values", () => {
    window.history.replaceState({}, "", "/edit-client/plan-1?tab=documents");
    const { unmount } = renderPage();

    expect(screen.getByTestId("tab-content-documents")).toBeInTheDocument();
    unmount();

    window.history.replaceState({}, "", "/edit-client/plan-1?tab=nonsense");
    renderPage();

    expect(screen.getByTestId("tab-content-company")).toBeInTheDocument();
  });

  it("publishes the plan comment surface", () => {
    renderPage();

    expect(mocks.useCommentSurface).toHaveBeenCalledWith({
      clientId: "plan-1",
      targetType: "plan",
      persisted: true,
    });
  });
});

describe("EditClientPage save bar", () => {
  it("renders Cancel and delegates it to All Plans", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.push).toHaveBeenCalledWith("/clients");
  });

  it("shows the Save button's status and validity", () => {
    mocks.editClient.clientStatus = "Draft";
    mocks.editClient.isFormValid = vi.fn(() => false);

    renderPage();

    const save = screen.getByTestId("save-button");
    expect(save).toHaveAttribute("data-status", "Draft");
    expect(save).toHaveAttribute("data-valid", "false");
    expect(save).toHaveAttribute("data-saving", "false");
  });

  it("saves, then refreshes the portal slug list", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("save-button"));

    await waitFor(() =>
      expect(mocks.editClient.handleSave).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => {
      const slugCalls = mocks.fetch.mock.calls.filter(
        ([url]) => url === "/api/clients/plan-1/slugs",
      );
      // One on mount, one after a successful save.
      expect(slugCalls.length).toBe(2);
    });
  });

  it("does not refresh the slug list when the save fails", async () => {
    const user = userEvent.setup();
    mocks.editClient.handleSave = vi.fn(async () => false);
    renderPage();

    await user.click(screen.getByTestId("save-button"));

    await waitFor(() =>
      expect(mocks.editClient.handleSave).toHaveBeenCalledTimes(1),
    );
    const slugCalls = mocks.fetch.mock.calls.filter(
      ([url]) => url === "/api/clients/plan-1/slugs",
    );
    expect(slugCalls.length).toBe(1);
  });
});
