import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamInvite } from "@/types/wizard";

import { Step5cTeam } from "../step-5c-team";

const wizard = vi.hoisted(() => {
  const state = {
    teamInvites: [] as TeamInvite[],
    stepData: {
      userSetup: { name: "Ada Lovelace", headshot: null },
    } as Record<string, any>,
    session: { user: { email: "owner@example.com" } } as
      | { user?: { email?: string } }
      | null,
    setTeamInvites: vi.fn(),
  };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  state.setTeamInvites.mockImplementation((invites: TeamInvite[]) => {
    state.teamInvites = invites;
    notify();
  });

  return { state, listeners, notify };
});

vi.mock("@/lib/onboarding-wizard-store", () => {
  const useOnboardingWizardStore = (
    selector: (state: typeof wizard.state) => unknown = (state) => state,
  ) =>
    React.useSyncExternalStore(
      (onChange) => {
        wizard.listeners.add(onChange);
        return () => {
          wizard.listeners.delete(onChange);
        };
      },
      () => selector(wizard.state),
      () => selector(wizard.state),
    );

  useOnboardingWizardStore.getState = () => wizard.state;

  return { useOnboardingWizardStore };
});

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: wizard.state.session }),
}));

vi.mock("@/components/teammates/access-fields", () => ({
  INVITABLE_TEAM_ROLES: ["admin", "editor", "viewer"],
}));

vi.mock("@/components/ui/headshot", () => ({
  Headshot: ({ alt }: { alt?: string }) => <span data-testid="headshot">{alt}</span>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="Role"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
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

function invite(overrides: Partial<TeamInvite> = {}): TeamInvite {
  return {
    id: `invite-${Math.random().toString(36).slice(2, 8)}`,
    fullName: "",
    email: "",
    role: "viewer",
    status: "pending",
    ...overrides,
  };
}

function seats(body: {
  seatsUsed: number;
  seatsIncluded: number | null;
  hasSeatLimit?: boolean;
}) {
  return {
    ok: true,
    json: async () => ({ seats: body }),
  };
}

describe("Step5cTeam", () => {
  beforeEach(() => {
    wizard.state.teamInvites = [];
    wizard.state.stepData = {
      userSetup: { name: "Ada Lovelace", headshot: null },
    };
    wizard.state.session = { user: { email: "owner@example.com" } };
    wizard.state.setTeamInvites.mockClear();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        seats({ seatsUsed: 1, seatsIncluded: 5, hasSeatLimit: true }),
      ),
    );
  });

  it("shows the seat meter and how many teammates can be invited", async () => {
    render(<Step5cTeam />);

    expect(await screen.findByText("1 of 5 seats used")).toBeInTheDocument();
    expect(
      screen.getByText(/You can invite up to 4 teammates now/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Member" }),
    ).toBeEnabled();
  });

  it("adds invite rows on demand", async () => {
    render(<Step5cTeam />);

    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));

    expect(wizard.state.setTeamInvites).toHaveBeenCalledTimes(2);
    expect(wizard.state.teamInvites).toHaveLength(2);
    expect(screen.getAllByLabelText("Full name")).toHaveLength(2);
    expect(screen.getAllByLabelText("Email")).toHaveLength(2);
  });

  it("caps invite rows at the number of open seats", async () => {
    render(<Step5cTeam />);

    const addButton = screen.getByRole("button", { name: "Add Member" });
    for (let index = 0; index < 4; index += 1) {
      await userEvent.click(addButton);
    }

    expect(wizard.state.teamInvites).toHaveLength(4);
    expect(addButton).toBeDisabled();
    expect(
      screen.getByText(/All 4 of your open seats are taken/),
    ).toBeInTheDocument();
  });

  it("blocks adding rows when no seats are open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        seats({ seatsUsed: 5, seatsIncluded: 5, hasSeatLimit: true }),
      ),
    );

    render(<Step5cTeam />);

    expect(
      await screen.findByText(/No seats are open right now/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Member" })).toBeDisabled();
  });

  it("falls back to the default allowance when the seat request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("seats unavailable");
      }),
    );

    render(<Step5cTeam />);

    expect(
      screen.getByText(/You can invite up to 4 teammates now/),
    ).toBeInTheDocument();
  });

  it("reports validity as rows become complete", async () => {
    const onValidationChange = vi.fn();
    render(<Step5cTeam onValidationChange={onValidationChange} />);

    await waitFor(() =>
      expect(onValidationChange).toHaveBeenLastCalledWith(true),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));

    await userEvent.type(screen.getByLabelText("Full name"), "Bob Stone");

    await waitFor(() =>
      expect(onValidationChange).toHaveBeenLastCalledWith(false),
    );

    await userEvent.type(
      screen.getByLabelText("Email"),
      "bob@example.com",
    );

    await waitFor(() =>
      expect(onValidationChange).toHaveBeenLastCalledWith(true),
    );
  });

  it("shows the missing-email error only after the email field is touched", async () => {
    render(<Step5cTeam />);

    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));
    await userEvent.type(screen.getByLabelText("Full name"), "Bob Stone");

    expect(
      screen.queryByText("Add the teammate’s email."),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Email"));
    await userEvent.tab();

    expect(
      await screen.findByText("Add the teammate’s email."),
    ).toBeInTheDocument();
  });

  it("shows the missing-name error for a row with only an email", async () => {
    render(<Step5cTeam />);

    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));
    await userEvent.type(
      screen.getByLabelText("Email"),
      "bob@example.com",
    );

    await userEvent.click(screen.getByLabelText("Full name"));
    await userEvent.tab();

    expect(
      await screen.findByText("Add the teammate’s name."),
    ).toBeInTheDocument();
  });

  it("rejects malformed email addresses", async () => {
    render(<Step5cTeam />);

    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));
    await userEvent.type(screen.getByLabelText("Full name"), "Bob Stone");
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.tab();

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
  });

  it("rejects the owner's own email", async () => {
    render(<Step5cTeam />);

    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));
    await userEvent.type(screen.getByLabelText("Full name"), "Bob Stone");
    await userEvent.type(
      screen.getByLabelText("Email"),
      "owner@example.com",
    );
    await userEvent.tab();

    expect(
      await screen.findByText(
        "That’s your own email — you’re already on the team.",
      ),
    ).toBeInTheDocument();
  });

  it("rejects duplicate emails across rows", async () => {
    wizard.state.teamInvites = [
      invite({ id: "row-1", fullName: "Bob Stone", email: "bob@example.com" }),
      invite({ id: "row-2", fullName: "Bob Two", email: "bob@example.com" }),
    ];

    // Errors are otherwise only revealed after a field is touched; the wizard's
    // `teamInvites` error flag forces them on every row at once.
    render(<Step5cTeam errorFields={["teamInvites"]} />);

    expect(
      await screen.findAllByText("This email is already in the list."),
    ).toHaveLength(2);
  });

  it("forces errors on every row when the wizard reports teamInvites", () => {
    wizard.state.teamInvites = [
      invite({ id: "row-1", fullName: "Bob Stone", email: "" }),
    ];

    render(<Step5cTeam errorFields={["teamInvites"]} />);

    expect(
      screen.getByText("Add the teammate’s email."),
    ).toBeInTheDocument();
  });

  it("removes a row", async () => {
    render(<Step5cTeam />);

    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));
    expect(screen.getAllByLabelText("Full name")).toHaveLength(2);

    await userEvent.click(
      screen.getAllByRole("button", { name: "Remove" })[0],
    );

    expect(wizard.state.teamInvites).toHaveLength(1);
    expect(screen.getAllByLabelText("Full name")).toHaveLength(1);
  });

  it("updates the role for a staged invite", async () => {
    render(<Step5cTeam />);

    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));

    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "editor" },
    });

    expect(wizard.state.teamInvites[0].role).toBe("editor");
  });
});
