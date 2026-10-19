import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
  fetch: vi.fn(),
  fetchCustomMeetings: vi.fn(),
  addCustomMeeting: vi.fn(),
  resetToDefaultMeetings: vi.fn(),
  customMeetings: [
    {
      value: "Open Enrollment",
      label: "Open Enrollment",
      description: "Learn about upcoming plan options.",
    },
    {
      value: "Custom",
      label: "Custom",
      description: "Enter your meeting description here.",
    },
  ] as any[],
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
    warning: mocks.toastWarning,
  },
}));

vi.mock("@/lib/meetings", () => ({
  MEETING_TYPES: [],
  useMeetingStore: (selector: any) =>
    selector({
      customMeetings: mocks.customMeetings,
      fetchCustomMeetings: mocks.fetchCustomMeetings,
      addCustomMeeting: mocks.addCustomMeeting,
      resetToDefaultMeetings: mocks.resetToDefaultMeetings,
    }),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: (props: any) =>
    props.open ? (
      <div data-testid="confirm-dialog">
        <h2>{props.title}</h2>
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

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, disabled }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      disabled={disabled}
      onChange={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children, disabled }: any) => (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: () => null,
}));

vi.mock("@/components/ui/popover", async () => {
  const ReactModule = await import("react");
  const PopoverContext = ReactModule.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
  }>({ open: false, setOpen: () => {} });

  return {
    Popover: ({ open = false, onOpenChange, children }: any) => (
      <PopoverContext.Provider
        value={{ open: !!open, setOpen: onOpenChange ?? (() => {}) }}
      >
        {children}
      </PopoverContext.Provider>
    ),
    PopoverTrigger: ({ children }: any) => {
      const { open, setOpen } = ReactModule.useContext(PopoverContext);
      return <span onClick={() => setOpen(!open)}>{children}</span>;
    },
    PopoverContent: ({ children }: any) => {
      const { open } = ReactModule.useContext(PopoverContext);
      return open ? <div>{children}</div> : null;
    },
  };
});

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: any) => (
    <button type="button" onClick={() => onSelect?.(new Date(2027, 4, 10))}>
      pick-calendar-date
    </button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/address-search", () => ({
  AddressSearch: ({ value, onChange, onLocationSelect, disabled }: any) => (
    <div>
      <input
        aria-label="address"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        onClick={() =>
          onLocationSelect?.({
            address: "123 Main St",
            city: "Austin",
            state: "TX",
            zip: "78701",
          })
        }
      >
        select-address
      </button>
    </div>
  ),
}));

import { PlanMeetingScheduleForm } from "../plan-meeting-schedule-form";

const EXISTING = {
  id: "m-1",
  meeting: "Existing Meeting",
  meetingType: "Open Enrollment",
  date: "2027-05-10",
  time: "09:00",
  timezone: "America/New_York",
  duration: "1 hour",
  format: "Virtual",
  platform: "Zoom",
  meetingLink: "https://zoom.us/j/1",
  description: "Existing description",
  maxAttendees: 10,
  displayOnPortal: true,
};

function jsonResponse(payload: any, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => payload };
}

function renderForm(props: Partial<React.ComponentProps<typeof PlanMeetingScheduleForm>> = {}) {
  return render(
    <PlanMeetingScheduleForm
      clientId="plan-1"
      companyName="Acme Corp"
      {...props}
    />,
  );
}

function selectNear(label: RegExp): HTMLSelectElement {
  const labelElement = screen.getByText(label, { selector: "label" });
  return within(labelElement.parentElement as HTMLElement).getByRole(
    "combobox",
  ) as HTMLSelectElement;
}

async function pickDate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Pick a date/ }));
  await user.click(screen.getByRole("button", { name: "pick-calendar-date" }));
}

async function pickTime(
  user: ReturnType<typeof userEvent.setup>,
  hour: string,
  minute: string,
  ampm: "AM" | "PM",
) {
  await user.click(screen.getByRole("button", { name: "Select time" }));
  await user.click(screen.getByRole("button", { name: hour }));
  await user.click(screen.getByRole("button", { name: minute }));
  await user.click(screen.getByRole("button", { name: ampm }));
  // Close the time popover before opening the duration picker.
  await user.click(
    screen.getByRole("button", { name: `${hour}:${minute} ${ampm}` }),
  );
}

async function pickDuration(
  user: ReturnType<typeof userEvent.setup>,
  hour: string,
  minute: string,
) {
  await user.click(screen.getByRole("button", { name: "Select duration" }));
  await user.click(screen.getByRole("button", { name: hour }));
  await user.click(screen.getByRole("button", { name: minute }));
  await user.click(
    screen.getByRole("button", { name: "1 hour 30 minutes" }),
  );
}

async function fillVirtualMeeting(
  user: ReturnType<typeof userEvent.setup>,
  hour = "1",
  minute = "30",
) {
  await pickDate(user);
  await pickTime(user, hour, minute, "PM");
  await pickDuration(user, "1", "30");
  await user.click(screen.getByRole("button", { name: "Virtual" }));
  fireEvent.change(selectNear(/Select Platform/), {
    target: { value: "Zoom" },
  });
  await user.type(screen.getByLabelText(/RSVP URL/), "https://rsvp.example");
}

function postCalls() {
  return mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockImplementation(async (url: string, init?: any) => {
    if (url === "/api/clients/plan-1/meetings" && (!init || !init.method)) {
      return jsonResponse({ success: true, data: [EXISTING] });
    }
    return jsonResponse({ success: true, data: {} });
  });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("scrollTo", vi.fn());
});

describe("PlanMeetingScheduleForm", () => {
  it("loads the plan's meetings and renders the list", async () => {
    renderForm();

    expect(await screen.findByText("Existing Meeting")).toBeInTheDocument();
    expect(screen.getByText("Open Enrollment · 2027-05-10 · 09:00")).toBeInTheDocument();
    expect(
      within(screen.getByText("Existing Meeting").closest("li")!).getByText(
        "Virtual",
      ),
    ).toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/clients/plan-1/meetings",
      { cache: "no-store" },
    );
  });

  it("shows the empty list state", async () => {
    mocks.fetch.mockImplementation(async () =>
      jsonResponse({ success: true, data: [] }),
    );
    renderForm();

    expect(await screen.findByText("No meetings yet.")).toBeInTheDocument();
  });

  it("reports a list load failure", async () => {
    mocks.fetch.mockRejectedValue(new Error("offline"));
    renderForm();

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Could not load meetings"),
    );
  });

  it("disables the form when the plan is missing", () => {
    renderForm({ clientId: "", companyName: "" });

    expect(screen.getByRole("button", { name: "Add Meeting" })).toBeDisabled();
    expect(screen.getByLabelText(/Meeting Description/)).toBeDisabled();
  });

  it("requires the required fields", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText("Existing Meeting");

    await user.click(screen.getByRole("button", { name: "Add Meeting" }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please fill in all required fields",
    );
    expect(postCalls()).toHaveLength(0);
  });

  it("creates a virtual meeting and reloads the list", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText("Existing Meeting");

    await fillVirtualMeeting(user);
    expect(screen.getByText("1 hour 30 minutes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add Meeting" }));

    await waitFor(() => expect(postCalls()).toHaveLength(1));
    const [url, init] = postCalls()[0];
    expect(url).toBe("/api/clients/plan-1/meetings");
    expect(JSON.parse(init.body)).toMatchObject({
      meetingType: "Open Enrollment",
      client: "Acme Corp",
      date: "2027-05-10",
      time: "13:30",
      timezone: "America/New_York",
      duration: "1 hour 30 minutes",
      format: "Virtual",
      platform: "Zoom",
      meetingLink: "https://rsvp.example",
      displayOnPortal: true,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Meeting created");
    const gets = mocks.fetch.mock.calls.filter(
      ([url]) => url === "/api/clients/plan-1/meetings",
    );
    expect(gets.length).toBeGreaterThanOrEqual(2);
  });

  it("asks for confirmation before saving a conflicting time", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/clients/plan-1/meetings" && (!init || !init.method)) {
        return jsonResponse({
          success: true,
          data: [{ ...EXISTING, time: "13:00", duration: "1 hour" }],
        });
      }
      return jsonResponse({ success: true, data: {} });
    });
    renderForm();
    await screen.findByText("Existing Meeting");

    // Pick the time before the date: the picker disables an occupied slot once
    // a date is set, so the submit-level confirmation is reached by choosing
    // the time first and then switching to the conflicting day.
    await pickTime(user, "1", "00", "PM");
    await pickDuration(user, "1", "30");
    await pickDate(user);
    await user.click(screen.getByRole("button", { name: "Virtual" }));
    fireEvent.change(selectNear(/Select Platform/), {
      target: { value: "Zoom" },
    });
    await user.type(screen.getByLabelText(/RSVP URL/), "https://rsvp.example");

    // The conflict effect already flags the conflict, so the first click asks
    // for confirmation instead of saving.
    await user.click(
      screen.getByRole("button", { name: "Confirm to add meeting" }),
    );

    expect(mocks.toastWarning).toHaveBeenCalledWith(
      "Time conflict confirmed! Click the submit button once more to proceed.",
      { duration: 5000 },
    );
    expect(postCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Add Meeting" }));
    await waitFor(() => expect(postCalls()).toHaveLength(1));
  });

  it("edits a meeting and can cancel the edit", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText("Existing Meeting");

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(mocks.toastSuccess).toHaveBeenCalledWith("Loaded meeting for editing.");
    expect(screen.getByRole("button", { name: "Update Meeting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9:00 AM" })).toBeInTheDocument();
    expect(screen.getByLabelText(/RSVP URL/)).toHaveValue("https://zoom.us/j/1");

    await user.click(screen.getByRole("button", { name: "Cancel Edit" }));
    expect(mocks.toastInfo).toHaveBeenCalledWith("Edit cancelled.");
    expect(
      screen.queryByRole("button", { name: "Update Meeting" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Update Meeting" }));

    await waitFor(() =>
      expect(
        mocks.fetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/clients/plan-1/meetings/m-1" &&
            init?.method === "PATCH",
        ),
      ).toBe(true),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Meeting updated");
  });

  it("archives a meeting after confirmation", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText("Existing Meeting");

    await user.click(screen.getByRole("button", { name: "Archive" }));
    const dialog = screen.getByTestId("confirm-dialog");
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/clients/plan-1/meetings/m-1",
        { method: "DELETE" },
      ),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Archived");
  });

  it("toggles whether a meeting appears on the portal", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText("Existing Meeting");

    const hubSwitch = within(
      screen.getByText("Hub").parentElement as HTMLElement,
    ).getByRole("checkbox");
    await user.click(hubSwitch);

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/clients/plan-1/meetings/m-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ displayOnPortal: false }),
        }),
      ),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Hidden from hub");
  });

  it("offers to save a custom meeting type before submitting", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText("Existing Meeting");

    await user.click(screen.getByText("Custom"));
    expect(screen.getByLabelText(/Custom Meeting Type/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Custom Meeting Type/), "Fireside");
    await fillVirtualMeeting(user);
    await user.click(screen.getByRole("button", { name: "Add Meeting" }));

    expect(
      screen.getByText("Save this meeting type for future use?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(mocks.addCustomMeeting).toHaveBeenCalledWith({
      value: "Fireside",
      label: "Fireside",
      // Selecting the Custom type intentionally clears the preset description.
      description: "",
    });
  });

  it("reports the AI placeholder", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText("Existing Meeting");

    await user.click(screen.getByRole("button", { name: /Generate with AI/ }));

    expect(mocks.toastInfo).toHaveBeenCalledWith("AI generation coming soon");
  });
});
