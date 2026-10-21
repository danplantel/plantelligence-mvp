import React from "react";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InviteCollaboratorDialog } from "@/components/pages/benefits/invite-collaborator-dialog";

/**
 * Invite Collaborator dialog.
 *
 * The invite is always scoped to the plan/category the advisor clicked, so the
 * dialog itself only owns the address, the "Who is this?" answer, the optional
 * note/due date, and the existing-collaborator picker. These tests pin that
 * contract plus the two debounced lookups (domain suggestion and search) and
 * every toast branch.
 *
 * `Select` is replaced with a native `<select>` so the answer can be changed
 * deterministically in jsdom; `Headshot` is stubbed to a plain image.
 */

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    warning: mocks.toastWarning,
  },
}));

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ src, alt }: { src?: string | null; alt?: string }) =>
    src ? <img src={src} alt={alt ?? ""} /> : <span>{alt ?? ""}</span>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
    children?: React.ReactNode;
  }) => (
    <select
      aria-label="Who is this?"
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

interface DialogOverrides {
  open?: boolean;
  planId?: string;
  planName?: string;
  category?: string;
  source?: "create_benefits" | "edit_benefit";
  onOpenChange?: (open: boolean) => void;
  onInvited?: () => void;
}

function renderDialog(overrides: DialogOverrides = {}) {
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  const onInvited = overrides.onInvited ?? vi.fn();

  const ui = (props: DialogOverrides = {}) => (
    <InviteCollaboratorDialog
      open={props.open ?? true}
      onOpenChange={props.onOpenChange ?? onOpenChange}
      planId={props.planId ?? "plan-1"}
      planName={props.planName ?? "Acme Corp"}
      category={props.category ?? "Retirement"}
      source={props.source}
      onInvited={props.onInvited ?? onInvited}
    />
  );

  const result = render(ui(overrides));
  return {
    ...result,
    onOpenChange,
    onInvited,
    rerenderDialog: (props: DialogOverrides) => result.rerender(ui(props)),
  };
}

const jsonResponse = (ok: boolean, body: unknown) =>
  ({
    ok,
    json: async () => body,
  }) as Response;

/** Route the mocked fetch by URL so suggestion and search can answer together. */
function installFetch(handlers: {
  suggestion?: () => Response | Promise<Response>;
  search?: () => Response | Promise<Response>;
  submit?: () => Response | Promise<Response>;
}) {
  // `init` is not used for routing, but declaring it keeps `mock.calls`
  // typed as [input, init?] for `lastSubmitBody`.
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/teammates/invite-collaborator?clientId=")) {
        return handlers.suggestion
          ? handlers.suggestion()
          : jsonResponse(true, { suggestion: null });
      }
      if (url.includes("/api/teammates/collaborators/search")) {
        return handlers.search
          ? handlers.search()
          : jsonResponse(true, { results: [] });
      }
      return handlers.submit
        ? handlers.submit()
        : jsonResponse(true, {
            invite: {
              missingFields: [],
              reusedProfile: false,
              role: "contributor",
              emailSent: true,
              emailError: null,
            },
          });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Advance the dialog's debounce and flush the fetch promise it resolves to. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function lastSubmitBody(fetchMock: ReturnType<typeof installFetch>) {
  const call = [...fetchMock.mock.calls]
    .reverse()
    .find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
  expect(call).toBeTruthy();
  return JSON.parse(String((call![1] as RequestInit).body));
}

describe("InviteCollaboratorDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("scope and initial state", () => {
    it("renders the locked plan and normalized category chips", () => {
      installFetch({});
      renderDialog({
        planName: "Acme Corp",
        category: "Group Health/Dental/Vision",
      });

      expect(screen.getByText("Invite Collaborator")).toBeInTheDocument();
      const scope = screen.getByText("Scoped to").parentElement as HTMLElement;
      expect(within(scope).getByText("Acme Corp")).toBeInTheDocument();
      expect(
        within(scope).getByText("Group Health / Dental / Vision"),
      ).toBeInTheDocument();
    });

    it("explains the limited access and keeps Customize access disabled", () => {
      installFetch({});
      renderDialog();

      expect(screen.getByText(/no seat is used/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Customize access" }),
      ).toBeDisabled();
    });

    it("disables Send invite until the email is long enough", () => {
      installFetch({});
      renderDialog();

      const send = screen.getByRole("button", { name: /send invite/i });
      expect(send).toBeDisabled();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "a@b" },
      });
      expect(send).toBeDisabled();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "a@b.co" },
      });
      expect(send).toBeEnabled();
    });

    it("clears the form when reopened for a different plan or category", () => {
      installFetch({});
      const view = renderDialog({ planId: "plan-1", category: "Retirement" });

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "jane@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Name/), {
        target: { value: "Jane" },
      });
      fireEvent.change(screen.getByLabelText(/Note/), {
        target: { value: "Hello" },
      });

      view.rerenderDialog({
        open: false,
        planId: "plan-1",
        category: "Retirement",
      });
      view.rerenderDialog({
        open: true,
        planId: "plan-2",
        planName: "Beta Inc",
        category: "Group Life",
      });

      expect(screen.getByLabelText("Email")).toHaveValue("");
      expect(screen.getByLabelText(/Name/)).toHaveValue("");
      expect(screen.getByLabelText(/Note/)).toHaveValue("");
      expect(screen.getByText("Beta Inc")).toBeInTheDocument();
      expect(screen.getByText("Group Life")).toBeInTheDocument();
    });
  });

  describe("submitting", () => {
    it("posts the trimmed invite scoped to the card", async () => {
      const fetchMock = installFetch({});
      const view = renderDialog({ planId: "plan-9", category: "Retirement" });

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "  jane@example.com  " },
      });
      fireEvent.change(screen.getByLabelText(/Name/), {
        target: { value: "  Jane  " },
      });
      fireEvent.change(screen.getByLabelText(/Note/), {
        target: { value: "  hello  " },
      });
      fireEvent.change(screen.getByLabelText(/Due date/), {
        target: { value: "2026-11-01" },
      });

      // Let the domain lookup settle before submitting.
      await advance(450);
      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(lastSubmitBody(fetchMock)).toEqual({
        clientId: "plan-9",
        category: "Retirement",
        email: "jane@example.com",
        whoIsThis: "outside_advisor",
        name: "Jane",
        note: "hello",
        dueDate: "2026-11-01",
        profileId: null,
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "jane@example.com invited to Retirement on Acme Corp.",
      );
      expect(view.onInvited).toHaveBeenCalledTimes(1);
      expect(view.onOpenChange).toHaveBeenCalledWith(false);
    });

    it("includes the audit source when the caller supplies one", async () => {
      const fetchMock = installFetch({});
      renderDialog({ source: "edit_benefit" });

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "jane@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(lastSubmitBody(fetchMock).source).toBe("edit_benefit");
    });

    it("mentions a reused profile in the success toast", async () => {
      installFetch({
        submit: () =>
          jsonResponse(true, {
            invite: {
              missingFields: [],
              reusedProfile: true,
              role: "contributor",
              emailSent: true,
              emailError: null,
            },
          }),
      });
      renderDialog();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "jane@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "jane@example.com invited to Retirement on Acme Corp (existing profile reused).",
      );
    });

    it("warns without failing when the assignment saved but email did not send", async () => {
      installFetch({
        submit: () =>
          jsonResponse(true, {
            invite: {
              missingFields: [],
              reusedProfile: false,
              role: "contributor",
              emailSent: false,
              emailError: "SMTP refused",
            },
          }),
      });
      const view = renderDialog();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "jane@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(mocks.toastWarning).toHaveBeenCalledWith(
        "The invite was saved, but the email could not be sent: SMTP refused",
      );
      expect(view.onInvited).toHaveBeenCalledTimes(1);
      expect(view.onOpenChange).toHaveBeenCalledWith(false);
    });

    it("surfaces the server's error and keeps the dialog open", async () => {
      installFetch({
        submit: () => jsonResponse(false, { error: "Already invited" }),
      });
      const view = renderDialog();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "jane@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(mocks.toastError).toHaveBeenCalledWith("Already invited");
      expect(view.onInvited).not.toHaveBeenCalled();
      expect(view.onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it("falls back to a generic error message when the response has none", async () => {
      installFetch({ submit: () => jsonResponse(false, {}) });
      renderDialog();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "jane@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(mocks.toastError).toHaveBeenCalledWith(
        "Could not send the invite",
      );
    });

    it("reports a network failure", async () => {
      installFetch({
        submit: () => {
          throw new Error("offline");
        },
      });
      renderDialog();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "jane@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(mocks.toastError).toHaveBeenCalledWith(
        "Could not send the invite",
      );
    });
  });

  describe("domain suggestion", () => {
    it("pre-selects Plan Sponsor HR and shows the reason", async () => {
      const fetchMock = installFetch({
        suggestion: () =>
          jsonResponse(true, {
            suggestion: {
              context: "plan_sponsor_hr",
              reason: "Same domain as the plan sponsor",
            },
          }),
      });
      renderDialog();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "hr@acme.com" },
      });
      await advance(450);

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/teammates/invite-collaborator?clientId=plan-1&email=hr%40acme.com",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(
        screen.getByText("Same domain as the plan sponsor"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Who is this?")).toHaveValue(
        "plan_sponsor_hr",
      );
      expect(
        screen.getByRole("button", { name: /send invite/i }),
      ).toBeEnabled();
    });

    it("never overwrites an answer the advisor already chose", async () => {
      const fetchMock = installFetch({
        suggestion: () =>
          jsonResponse(true, {
            suggestion: { context: "plan_sponsor_hr", reason: "Same domain" },
          }),
      });
      renderDialog();

      fireEvent.change(screen.getByLabelText("Who is this?"), {
        target: { value: "reviewer_only" },
      });
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "hr@acme.com" },
      });
      await advance(450);

      expect(screen.getByLabelText("Who is this?")).toHaveValue(
        "reviewer_only",
      );

      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(lastSubmitBody(fetchMock).whoIsThis).toBe("reviewer_only");
    });

    it("ignores an unknown suggestion context", async () => {
      installFetch({
        suggestion: () =>
          jsonResponse(true, {
            suggestion: { context: "stranger", reason: "Odd" },
          }),
      });
      renderDialog();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "hr@acme.com" },
      });
      await advance(450);

      expect(screen.queryByText("Odd")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Who is this?")).toHaveValue(
        "outside_advisor",
      );
    });

    it("does not look anything up until the address contains an @", async () => {
      const fetchMock = installFetch({});
      renderDialog();

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "hr.acme.com" },
      });
      await advance(450);

      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes(
            "/api/teammates/invite-collaborator?clientId=",
          ),
        ),
      ).toBe(false);
    });
  });

  describe("existing collaborator search", () => {
    const resultRow = {
      profileId: "profile-7",
      name: "Jordan Lee",
      email: "jordan@beta.com",
      headshot: null,
      companyName: "Beta Inc",
      state: "active",
    };

    it("waits for two characters before searching", async () => {
      const fetchMock = installFetch({});
      renderDialog();

      fireEvent.change(screen.getByLabelText("Add Existing Collaborator"), {
        target: { value: "j" },
      });
      await advance(350);

      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/teammates/collaborators/search"),
        ),
      ).toBe(false);
      expect(screen.queryByText("Jordan Lee")).not.toBeInTheDocument();
    });

    it("searches after the debounce and lists matches", async () => {
      installFetch({
        search: () => jsonResponse(true, { results: [resultRow] }),
      });
      renderDialog();

      fireEvent.change(screen.getByLabelText("Add Existing Collaborator"), {
        target: { value: "jo" },
      });
      await advance(350);

      expect(screen.getByText("Jordan Lee")).toBeInTheDocument();
      expect(
        screen.getByText("jordan@beta.com · Beta Inc"),
      ).toBeInTheDocument();
    });

    it("picks a match, fills the fields, and submits its profile id", async () => {
      const fetchMock = installFetch({
        search: () => jsonResponse(true, { results: [resultRow] }),
      });
      const view = renderDialog();

      fireEvent.change(screen.getByLabelText("Add Existing Collaborator"), {
        target: { value: "jo" },
      });
      await advance(350);
      fireEvent.click(screen.getByText("Jordan Lee"));

      expect(screen.getByLabelText("Email")).toHaveValue("jordan@beta.com");
      expect(screen.getByLabelText(/Name/)).toHaveValue("Jordan Lee");
      expect(screen.getByLabelText(/Name/)).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Clear selection" }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(lastSubmitBody(fetchMock).profileId).toBe("profile-7");
      expect(view.onInvited).toHaveBeenCalledTimes(1);
    });

    it("clears a picked collaborator back to a blank manual form", async () => {
      installFetch({
        search: () => jsonResponse(true, { results: [resultRow] }),
      });
      renderDialog();

      fireEvent.change(screen.getByLabelText("Add Existing Collaborator"), {
        target: { value: "jo" },
      });
      await advance(350);
      fireEvent.click(screen.getByText("Jordan Lee"));
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

      expect(screen.getByLabelText("Email")).toHaveValue("");
      expect(screen.getByLabelText(/Name/)).toHaveValue("");
      expect(screen.getByLabelText(/Name/)).toBeEnabled();
      expect(screen.getByLabelText("Add Existing Collaborator")).toHaveValue(
        "",
      );
    });
  });
});
