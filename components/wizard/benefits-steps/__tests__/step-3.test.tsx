import React from "react";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsStep3 } from "@/components/wizard/benefits-steps/step-3";

/**
 * Create/Edit Benefit → Step 3 (Contacts & FAQs).
 *
 * The store is a small reactive stand-in so a save re-renders like the real
 * Zustand store. Every presentation-heavy child (accordion, dnd, framer-motion,
 * collaborator cards, the two contact dialogs, the invite/seat dialogs and the
 * portal previews) is stubbed, so these tests assert Step 3's orchestration:
 * the contact roster and its fallback read, selection + cap enforcement,
 * plan-level contact writes, collaborator filtering and actions, and the FAQ
 * add/edit/enable/remove/save paths.
 */

const mocks = vi.hoisted(() => {
  let listeners = new Set<() => void>();
  let cached: any = null;
  const state: any = { stepData: { step1: {}, step3: {} } };

  const getSnapshot = () => cached;
  const emit = () => {
    cached = { ...state };
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const reset = (step1: any, step3: any) => {
    state.stepData = { step1, step3 };
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
    invalidateClientCache: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    consoleError: vi.fn(),
    viewer: { canManageTeam: true },
    dismiss: vi.fn(),
    isDismissed: false,
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

vi.mock("@/lib/benefits-faq-defaults", () => ({
  DEFAULT_FAQS: {
    Retirement: [
      {
        id: "faq-default",
        question: "Default question",
        answer: "Default answer",
        linkLabel: "Learn More",
        linkHref: "#",
        enabled: true,
      },
    ],
  },
}));

vi.mock("@/lib/fetch-client", () => ({
  fetchClientOnce: mocks.fetchClientOnce,
  invalidateClientCache: mocks.invalidateClientCache,
}));

vi.mock("@/lib/benefit-draft", () => ({
  toApiBenefitCategory: (category: string) =>
    category === "Custom" ? "Company / Plan Sponsor" : category,
}));

vi.mock("@/lib/phone-utils", () => ({
  formatPhoneWithExtension: () => "(555) 123-4567",
}));

vi.mock("@/hooks/useViewerAccess", () => ({
  useViewerAccess: () => ({ canManageTeam: mocks.viewer.canManageTeam }),
}));

vi.mock("@/hooks/use-dismissible-alert", () => ({
  useDismissibleAlert: () => ({
    isDismissed: mocks.isDismissed,
    dismiss: mocks.dismiss,
  }),
}));

vi.mock("uuid", () => ({ v4: () => "faq-new" }));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    warning: mocks.toastWarning,
  },
}));

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ alt }: { alt?: string }) => <span>{alt ?? ""}</span>,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
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

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const MotionDiv = React.forwardRef(
    ({ children }: { children?: React.ReactNode }, ref: any) => (
      <div ref={ref}>{children}</div>
    ),
  );
  MotionDiv.displayName = "MotionDiv";
  return {
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  closestCenter: {},
  PointerSensor: function PointerSensor() {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  arrayMove: <T,>(items: T[], from: number, to: number): T[] => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  },
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: (props: any) =>
    props.open ? (
      <div role="dialog" aria-label={props.title}>
        <p>{props.description}</p>
        <button type="button" onClick={() => props.onConfirm()}>
          {props.confirmText}
        </button>
        <button type="button" onClick={() => props.onOpenChange(false)}>
          {props.cancelText}
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/pages/benefits/invite-collaborator-dialog", () => ({
  InviteCollaboratorDialog: (props: any) =>
    props.open ? (
      <div data-testid="invite-dialog">
        <span data-testid="invite-scope">
          {props.planName}|{props.category}|{props.source}
        </span>
        <button
          type="button"
          onClick={() => {
            props.onInvited?.();
            props.onOpenChange(false);
          }}
        >
          stub-invited
        </button>
      </div>
    ) : null,
}));

vi.mock("../benefit-contact-dialog", () => ({
  BenefitContactDialog: (props: any) =>
    props.open ? (
      <div data-testid={`contact-dialog-${props.mode}`}>
        <button
          type="button"
          onClick={() =>
            props.onSubmit({
              id: props.mode === "edit" ? props.contact.id : "created-1",
              name: "New Person",
              title: "Advisor",
            })
          }
        >
          submit-contact
        </button>
      </div>
    ) : null,
}));

vi.mock("../give-team-seat-dialog", () => ({
  GiveTeamSeatDialog: (props: any) =>
    props.contact ? (
      <div data-testid="seat-dialog">
        <button type="button" onClick={() => props.onGranted()}>
          grant-seat
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/teammates/collaborator-card", () => ({
  CollaboratorCard: (props: any) => (
    <div data-testid="collaborator-card">
      <span>{props.person.name}</span>
      <button type="button" onClick={() => props.onOpen()}>
        open-{props.person.name}
      </button>
      {props.onDelete ? (
        <button type="button" onClick={() => props.onDelete()}>
          delete-{props.person.name}
        </button>
      ) : (
        <span>no-delete</span>
      )}
      {props.onResendInvite ? (
        <button type="button" onClick={() => props.onResendInvite()}>
          resend-{props.person.name}
        </button>
      ) : (
        <span>no-resend</span>
      )}
      {props.onConfirmDeletion ? (
        <button type="button" onClick={() => props.onConfirmDeletion()}>
          self-delete-{props.person.name}
        </button>
      ) : (
        <span>no-self-delete</span>
      )}
    </div>
  ),
}));

vi.mock("@/components/teammates/collaborator-detail-dialog", () => ({
  CollaboratorDetailDialog: (props: any) =>
    props.person ? (
      <div data-testid="collaborator-detail">{props.person.name}</div>
    ) : null,
}));

vi.mock("@/components/faq-section", () => ({
  FAQSection: (props: any) => (
    <div data-testid="faq-preview">
      {props.faqs.map((faq: any) => faq.question).join("|")}
    </div>
  ),
}));

vi.mock("@/components/pages/client-portal/sections/have-questions", () => ({
  HaveQuestions: (props: any) => (
    <div data-testid="contacts-preview">
      {props.contacts.map((contact: any) => contact.title).join("|")}
    </div>
  ),
}));

const CONTACT_JANE = {
  id: "c1",
  name: "Jane Advisor",
  title: "Advisor",
  email: "jane@acme.com",
  phone: "5551234567",
};
const CONTACT_BOB = {
  id: "c2",
  name: "Bob Broker",
  title: "Broker",
  email: "bob@acme.com",
};
const CONTACT_EVE = {
  id: "c5",
  name: "Eve Fifth",
  title: "Specialist",
  email: "eve@acme.com",
};

const baseStep1 = (overrides: Record<string, any> = {}) => ({
  planId: "plan-1",
  benefitCategory: "Retirement",
  benefitTitle: "",
  selectedPlan: {
    companyName: "Acme Corp",
    brandColor: "#111111",
    keyContacts: [CONTACT_JANE, CONTACT_BOB],
  },
  ...overrides,
});

const baseStep3 = (overrides: Record<string, any> = {}) => ({
  faqs: [],
  supportContacts: [],
  currentSubStep: "a",
  faqsByCategory: {},
  ...overrides,
});

const jsonResponse = (ok: boolean, body: unknown, status = ok ? 200 : 500) =>
  ({ ok, status, json: async () => body }) as Response;

interface Handlers {
  assignments?: () => Response | Promise<Response>;
  clientPut?: (init?: RequestInit) => Response | Promise<Response>;
  benefitPut?: (init?: RequestInit) => Response | Promise<Response>;
  assignmentDelete?: () => Response | Promise<Response>;
  teamPatch?: (init?: RequestInit) => Response | Promise<Response>;
}

function installFetch(handlers: Handlers = {}) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.includes("/api/teammates/plan-assignments")) {
        return handlers.assignments
          ? handlers.assignments()
          : jsonResponse(true, { assignments: [], ownerEmails: [] });
      }
      if (url.includes("/api/clients/") && url.includes("/benefits/")) {
        return handlers.benefitPut
          ? handlers.benefitPut(init)
          : jsonResponse(true, { success: true });
      }
      if (method === "PUT" && url.startsWith("/api/clients/")) {
        return handlers.clientPut
          ? handlers.clientPut(init)
          : jsonResponse(true, { success: true });
      }
      if (method === "DELETE" && url.includes("/api/teammates/assignments/")) {
        return handlers.assignmentDelete
          ? handlers.assignmentDelete()
          : jsonResponse(true, {});
      }
      if (method === "PATCH" && url.includes("/api/teammates/team/")) {
        return handlers.teamPatch
          ? handlers.teamPatch(init)
          : jsonResponse(true, { emailSent: true });
      }
      return jsonResponse(true, {});
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderStep(props: { section?: "contacts" | "faqs" } = {}) {
  return render(<BenefitsStep3 {...props} />);
}

const bodyOf = (fetchMock: ReturnType<typeof installFetch>, method: string) => {
  const call = [...fetchMock.mock.calls]
    .reverse()
    .find(([, init]) => (init as RequestInit | undefined)?.method === method);
  expect(call).toBeTruthy();
  return JSON.parse(String((call![1] as RequestInit).body));
};

const lastStep3Save = () => {
  const calls = mocks.state.saveStepData.mock.calls.filter(
    (call: any[]) => call[0] === 3,
  );
  return calls.at(-1)?.[1];
};

describe("BenefitsStep3", () => {
  beforeEach(() => {
    mocks.viewer.canManageTeam = true;
    mocks.isDismissed = false;
    mocks.fetchClientOnce.mockResolvedValue(null);
    mocks.reset(baseStep1(), baseStep3());
    vi.spyOn(console, "error").mockImplementation(mocks.consoleError);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("support contacts", () => {
    it("renders the header, cap notice and both roster cards", () => {
      installFetch();
      renderStep();

      expect(screen.getByText("Contacts & FAQs")).toBeInTheDocument();
      expect(screen.getByText("up to 4 support contacts")).toBeInTheDocument();
      expect(screen.getByTitle("Jane Advisor")).toBeInTheDocument();
      expect(screen.getByTitle("Bob Broker")).toBeInTheDocument();
    });

    it("selects and deselects a contact for this benefit", () => {
      installFetch();
      renderStep();

      fireEvent.click(screen.getByTitle("Jane Advisor"));

      expect(lastStep3Save()).toEqual(
        expect.objectContaining({
          supportContacts: [
            expect.objectContaining({
              contactId: "c1",
              title: "Advisor",
              enabled: true,
            }),
          ],
          supportContactsPlanId: "plan-1",
          supportContactsCategory: "Retirement",
        }),
      );

      fireEvent.click(screen.getByTitle("Jane Advisor"));
      expect(lastStep3Save()).toEqual(
        expect.objectContaining({ supportContacts: [] }),
      );
    });

    it("refuses a contact beyond the per-benefit cap", () => {
      mocks.reset(
        baseStep1({
          selectedPlan: {
            companyName: "Acme Corp",
            keyContacts: [CONTACT_JANE, CONTACT_BOB, CONTACT_EVE],
          },
        }),
        baseStep3({
          supportContacts: Array.from({ length: 4 }).map((_, i) => ({
            contactId: `sel-${i}`,
            title: "Selected",
            description: "",
            enabled: true,
          })),
        }),
      );
      installFetch();
      renderStep();

      fireEvent.click(screen.getByTitle("Eve Fifth"));

      expect(mocks.toastError).toHaveBeenCalledWith(
        "Up to 4 support contacts per benefit",
        expect.objectContaining({
          description: expect.stringMatching(/Deselect one/),
        }),
      );
    });

    it("falls back to the shared client read when the picker copy has none", async () => {
      mocks.reset(
        baseStep1({ selectedPlan: { companyName: "Acme Corp" } }),
        baseStep3(),
      );
      mocks.fetchClientOnce.mockResolvedValue({
        companyName: "Acme Corp",
        keyContacts: [CONTACT_JANE],
      });
      installFetch();
      renderStep();

      await waitFor(() =>
        expect(screen.getByTitle("Jane Advisor")).toBeInTheDocument(),
      );
      expect(mocks.state.saveStepData).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          planId: "plan-1",
          selectedPlan: expect.objectContaining({
            keyContacts: [CONTACT_JANE],
          }),
        }),
      );
    });

    it("shows the empty state and reports a failed roster read", async () => {
      mocks.reset(
        baseStep1({ selectedPlan: { companyName: "Acme Corp" } }),
        baseStep3(),
      );
      mocks.fetchClientOnce.mockRejectedValue(new Error("offline"));
      installFetch();
      renderStep();

      await waitFor(() =>
        expect(
          screen.getByText("No support contacts available."),
        ).toBeInTheDocument(),
      );
      expect(mocks.consoleError).toHaveBeenCalledWith(
        "Error fetching contacts in Step 3:",
        expect.any(Error),
      );
    });

    it("keeps the empty state's Go to Step 1 action", () => {
      mocks.reset(
        baseStep1({
          selectedPlan: { companyName: "Acme Corp", keyContacts: [] },
        }),
        baseStep3(),
      );
      installFetch();
      renderStep();

      fireEvent.click(
        screen.getByRole("button", { name: "Go to Step 1 Selection" }),
      );
      expect(mocks.state.goToStep).toHaveBeenCalledWith(1);
    });

    it("disables Add Contact without a plan and opens the create dialog with one", () => {
      mocks.reset(
        { benefitCategory: "Retirement", selectedPlan: {} },
        baseStep3(),
      );
      installFetch();
      const view = renderStep();

      expect(
        screen.getByRole("button", { name: "Add a contact" }),
      ).toBeDisabled();
      view.unmount();

      mocks.reset(baseStep1(), baseStep3());
      installFetch();
      renderStep();
      fireEvent.click(screen.getByRole("button", { name: "Add a contact" }));
      expect(screen.getByTestId("contact-dialog-create")).toBeInTheDocument();
    });

    it("edits a contact and writes the plan's contact list", async () => {
      const fetchMock = installFetch();
      renderStep();

      fireEvent.click(
        screen.getAllByRole("button", { name: "Edit this contact" })[0],
      );
      fireEvent.click(screen.getByRole("button", { name: "submit-contact" }));

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Contact updated"),
      );
      const body = bodyOf(fetchMock, "PUT");
      expect(body.keyContacts).toEqual([
        expect.objectContaining({ id: "c1", name: "New Person" }),
        CONTACT_BOB,
      ]);
      expect(mocks.invalidateClientCache).toHaveBeenCalledWith("plan-1");
    });

    it("adds a contact to the plan and selects it for this benefit", async () => {
      const fetchMock = installFetch();
      renderStep();

      fireEvent.click(screen.getByRole("button", { name: "Add a contact" }));
      fireEvent.click(screen.getByRole("button", { name: "submit-contact" }));

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "Contact added and selected for this benefit",
        ),
      );
      expect(bodyOf(fetchMock, "PUT").keyContacts).toEqual([
        CONTACT_JANE,
        CONTACT_BOB,
        expect.objectContaining({ id: "created-1" }),
      ]);
      expect(lastStep3Save().supportContacts).toEqual([
        expect.objectContaining({ contactId: "created-1" }),
      ]);
    });

    it("deletes a contact from the plan after confirmation", async () => {
      const fetchMock = installFetch();
      renderStep();

      fireEvent.click(
        // The shared Key Contacts card labels this action "Delete this contact".
        screen.getAllByRole("button", {
          name: "Delete this contact",
        })[0],
      );
      const dialog = screen.getByRole("dialog", {
        name: "Delete this contact from the plan?",
      });
      expect(dialog).toHaveTextContent(
        "will be removed from the plan's contact list",
      );

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Yes, delete" }),
      );

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "Contact removed from this plan",
        ),
      );
      expect(bodyOf(fetchMock, "PUT").keyContacts).toEqual([CONTACT_BOB]);
      expect(mocks.invalidateClientCache).toHaveBeenCalledWith("plan-1");
    });

    it("reports a failed contact delete and keeps the roster", async () => {
      installFetch({
        clientPut: () => jsonResponse(false, { error: "Nope" }),
      });
      renderStep();

      fireEvent.click(
        screen.getAllByRole("button", {
          name: "Delete this contact",
        })[0],
      );
      fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Could not delete the contact",
          {
            description: "Nope",
          },
        ),
      );
      expect(screen.getByTitle("Jane Advisor")).toBeInTheDocument();
    });
  });

  describe("collaborators", () => {
    const EXTERNAL = {
      assignmentId: "a-1",
      profileId: "p-1",
      name: "External Expert",
      email: "expert@partner.com",
      headshot: null,
      personType: "collaborator",
      companyName: "Partner Co",
      role: "contributor",
      categoryScope: "selected",
      categories: ["Retirement"],
      state: "active",
      deactivatedAt: null,
      inviteDueDate: null,
    };
    const SEAT_HOLDER = {
      ...EXTERNAL,
      assignmentId: "a-2",
      profileId: "p-2",
      name: "Team Member",
      email: "team@acme.com",
      personType: "team_member",
    };
    const MIRRORED_CONTACT = {
      ...EXTERNAL,
      assignmentId: "a-3",
      profileId: "p-3",
      name: "Mirrored Contact",
      email: "contact@acme.com",
      state: "contact",
    };

    it("lists only free external collaborators", async () => {
      installFetch({
        assignments: () =>
          jsonResponse(true, {
            assignments: [EXTERNAL, SEAT_HOLDER, MIRRORED_CONTACT],
            ownerEmails: [],
          }),
      });
      renderStep();

      await waitFor(() =>
        expect(screen.getByText("External Expert")).toBeInTheDocument(),
      );
      expect(screen.queryByText("Team Member")).not.toBeInTheDocument();
      expect(screen.queryByText("Mirrored Contact")).not.toBeInTheDocument();
    });

    it("shows the empty hint after a successful empty read", async () => {
      installFetch();
      renderStep();

      await waitFor(() =>
        expect(screen.getByText(/No collaborators yet/)).toBeInTheDocument(),
      );
    });

    it("treats a failed assignment read as an empty list", async () => {
      installFetch({ assignments: () => jsonResponse(false, {}) });
      renderStep();

      await waitFor(() =>
        expect(screen.getByText(/No collaborators yet/)).toBeInTheDocument(),
      );
    });

    it("opens the invite dialog scoped to the plan and category", async () => {
      const fetchMock = installFetch();
      renderStep();

      fireEvent.click(
        screen.getByRole("button", { name: "Add a collaborator" }),
      );

      expect(screen.getByTestId("invite-scope")).toHaveTextContent(
        "Acme Corp|Retirement|create_benefits",
      );
      const before = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/teammates/plan-assignments"),
      ).length;

      fireEvent.click(screen.getByRole("button", { name: "stub-invited" }));

      await waitFor(() => {
        const after = fetchMock.mock.calls.filter(([url]) =>
          String(url).includes("/api/teammates/plan-assignments"),
        ).length;
        expect(after).toBe(before + 1);
      });
      expect(screen.queryByTestId("invite-dialog")).not.toBeInTheDocument();
    });

    it("marks the invite as an Edit Benefit action when rendered for contacts only", () => {
      installFetch();
      renderStep({ section: "contacts" });

      fireEvent.click(
        screen.getByRole("button", { name: "Add a collaborator" }),
      );
      expect(screen.getByTestId("invite-scope")).toHaveTextContent(
        "Acme Corp|Retirement|edit_benefit",
      );
    });

    it("removes a collaborator after confirmation and refreshes the list", async () => {
      const fetchMock = installFetch({
        assignments: () =>
          jsonResponse(true, { assignments: [EXTERNAL], ownerEmails: [] }),
      });
      renderStep();

      fireEvent.click(
        await screen.findByRole("button", { name: "delete-External Expert" }),
      );
      const dialog = screen.getByRole("dialog", {
        name: "Remove this collaborator?",
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Yes, remove" }),
      );

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "External Expert was removed from this plan.",
        ),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teammates/assignments/a-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("resends an invitation and reports the remaining window", async () => {
      const fetchMock = installFetch({
        assignments: () =>
          jsonResponse(true, {
            assignments: [{ ...EXTERNAL, state: "invited" }],
            ownerEmails: [],
          }),
        teamPatch: () =>
          jsonResponse(true, {
            emailSent: true,
            member: { expiresInDays: 5, refreshedWindow: false },
          }),
      });
      renderStep();

      fireEvent.click(
        await screen.findByRole("button", { name: "resend-External Expert" }),
      );

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "Invitation re-sent to expert@partner.com. Their invitation has 5 days left.",
        ),
      );
      expect(bodyOf(fetchMock, "PATCH")).toEqual({ action: "resend_invite" });
    });

    it("warns when the resend saves but the email fails", async () => {
      installFetch({
        assignments: () =>
          jsonResponse(true, {
            assignments: [{ ...EXTERNAL, state: "invited" }],
            ownerEmails: [],
          }),
        teamPatch: () =>
          jsonResponse(true, { emailSent: false, emailError: "SMTP down" }),
      });
      renderStep();

      fireEvent.click(
        await screen.findByRole("button", { name: "resend-External Expert" }),
      );

      await waitFor(() =>
        expect(mocks.toastWarning).toHaveBeenCalledWith(
          "Could not send the invitation: SMTP down",
        ),
      );
    });

    it("accepts a collaborator's own account deletion", async () => {
      const fetchMock = installFetch({
        assignments: () =>
          jsonResponse(true, {
            assignments: [
              { ...EXTERNAL, selfDeletedAt: "2026-01-01T00:00:00.000Z" },
            ],
            ownerEmails: [],
          }),
      });
      renderStep();

      fireEvent.click(
        await screen.findByRole("button", {
          name: "self-delete-External Expert",
        }),
      );
      const dialog = screen.getByRole("dialog", {
        name: "Confirm External Expert's deletion?",
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Yes, confirm" }),
      );

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "External Expert was removed from your organization.",
        ),
      );
      expect(bodyOf(fetchMock, "PATCH")).toEqual({
        action: "confirm_self_deletion",
      });
    });

    it("hides every collaborator write for non-managers", async () => {
      mocks.viewer.canManageTeam = false;
      installFetch({
        assignments: () =>
          jsonResponse(true, {
            assignments: [
              { ...EXTERNAL, state: "invited", selfDeletedAt: "x" },
            ],
            ownerEmails: [],
          }),
      });
      renderStep();

      await screen.findByText("External Expert");
      expect(screen.getAllByText("no-delete").length).toBeGreaterThan(0);
      expect(screen.getAllByText("no-resend").length).toBeGreaterThan(0);
      expect(screen.getAllByText("no-self-delete").length).toBeGreaterThan(0);
    });
  });

  describe("FAQs", () => {
    it("renders the category's default questions", () => {
      installFetch();
      renderStep({ section: "faqs" });

      expect(screen.getByText("Popular Questions (FAQ)")).toBeInTheDocument();
      expect(screen.getByText("Default question")).toBeInTheDocument();
      expect(screen.queryByText("Contacts & FAQs")).not.toBeInTheDocument();
    });

    it("adds a question at the top and stores it per category", () => {
      installFetch();
      renderStep({ section: "faqs" });

      fireEvent.click(screen.getByRole("button", { name: /Add Question/ }));

      const saved = lastStep3Save();
      expect(saved.faqs[0]).toEqual(
        expect.objectContaining({ id: "faq-new", question: "New Question?" }),
      );
      expect(saved.faqsByCategory.Retirement[0].id).toBe("faq-new");
      expect(screen.getByPlaceholderText("Enter question...")).toHaveValue(
        "New Question?",
      );
    });

    it("edits a question's text", () => {
      installFetch();
      renderStep({ section: "faqs" });

      fireEvent.pointerUp(screen.getByText("Default question"));
      fireEvent.change(screen.getByPlaceholderText("Enter question..."), {
        target: { value: "Updated question?" },
      });

      expect(lastStep3Save().faqs[0]).toEqual(
        expect.objectContaining({
          id: "faq-default",
          question: "Updated question?",
        }),
      );
    });

    it("toggles a question's enabled flag", () => {
      installFetch();
      renderStep({ section: "faqs" });

      fireEvent.click(screen.getByRole("switch"));

      expect(lastStep3Save().faqs[0]).toEqual(
        expect.objectContaining({ id: "faq-default", enabled: false }),
      );
    });

    it("removes a question", () => {
      mocks.reset(
        baseStep1(),
        baseStep3({
          faqsByCategory: {
            Retirement: [
              {
                id: "f1",
                question: "First question",
                answer: "Answer",
                linkLabel: "",
                linkHref: "#",
                enabled: true,
              },
              {
                id: "f2",
                question: "Second question",
                answer: "Answer",
                linkLabel: "",
                linkHref: "#",
                enabled: true,
              },
            ],
          },
        }),
      );
      installFetch();
      renderStep({ section: "faqs" });

      const item = screen
        .getByText("First question")
        .closest(".rounded-lg") as HTMLElement;
      fireEvent.click(within(item).getByRole("button"));

      expect(lastStep3Save().faqs).toEqual([
        expect.objectContaining({ id: "f2", question: "Second question" }),
      ]);
      expect(screen.queryByText("First question")).not.toBeInTheDocument();
      expect(screen.getByText("Second question")).toBeInTheDocument();
    });

    it("saves the FAQs and support contacts through the benefit API", async () => {
      const fetchMock = installFetch();
      renderStep({ section: "faqs" });

      fireEvent.click(screen.getByRole("button", { name: /Save/ }));

      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "FAQs saved successfully!",
        ),
      );
      const call = fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/api/clients/plan-1/benefits/Retirement"),
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual(
        expect.objectContaining({
          faqs: [expect.objectContaining({ id: "faq-default" })],
          supportContacts: [],
        }),
      );
    });

    it("maps Custom to the API's Company / Plan Sponsor category", async () => {
      mocks.reset(baseStep1({ benefitCategory: "Custom" }), baseStep3());
      const fetchMock = installFetch();
      renderStep({ section: "faqs" });

      fireEvent.click(screen.getByRole("button", { name: /Save/ }));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/plan-1/benefits/Company%20%2F%20Plan%20Sponsor",
          expect.objectContaining({ method: "PUT" }),
        ),
      );
    });

    it("reports a failed FAQ save with the server's message", async () => {
      installFetch({
        benefitPut: () => jsonResponse(true, { success: false, error: "boom" }),
      });
      renderStep({ section: "faqs" });

      fireEvent.click(screen.getByRole("button", { name: /Save/ }));

      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith("Failed to save FAQs", {
          description: "boom",
        }),
      );
    });

    it("refuses to save without the Step 1 context", async () => {
      mocks.reset({}, baseStep3());
      installFetch();
      renderStep({ section: "faqs" });

      fireEvent.click(screen.getByRole("button", { name: /Save/ }));

      expect(mocks.toastError).toHaveBeenCalledWith(
        "Missing plan or category data. Please complete Step 1 first.",
      );
    });
  });

  describe("previews", () => {
    it("previews the enabled support contacts", () => {
      mocks.reset(
        baseStep1(),
        baseStep3({
          supportContacts: [
            {
              contactId: "c1",
              title: "Advisor",
              description: "",
              enabled: true,
            },
            {
              contactId: "c2",
              title: "Broker",
              description: "",
              enabled: false,
            },
          ],
        }),
      );
      installFetch();
      renderStep({ section: "contacts" });

      fireEvent.click(
        screen.getByRole("button", { name: "Preview support contacts" }),
      );

      expect(screen.getByTestId("contacts-preview")).toHaveTextContent(
        "Advisor",
      );
      expect(screen.getByTestId("contacts-preview")).not.toHaveTextContent(
        "Broker",
      );
    });

    it("previews only enabled FAQs with content", () => {
      mocks.reset(
        baseStep1(),
        baseStep3({
          faqsByCategory: {
            Retirement: [
              {
                id: "f1",
                question: "Enabled question",
                answer: "Answer",
                enabled: true,
              },
              {
                id: "f2",
                question: "Disabled question",
                answer: "Answer",
                enabled: false,
              },
            ],
          },
        }),
      );
      installFetch();
      renderStep({ section: "faqs" });

      fireEvent.click(screen.getByRole("button", { name: /Preview/ }));

      expect(screen.getByTestId("faq-preview")).toHaveTextContent(
        "Enabled question",
      );
      expect(screen.getByTestId("faq-preview")).not.toHaveTextContent(
        "Disabled question",
      );
    });
  });
});
