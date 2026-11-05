import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The meeting creator the portal's News & Events panel (and, in time, the
 * Meetings page) hosts.
 *
 * Two things are pinned here: it carries the same property set the dashboard's
 * inline form does — type, when, duration, timezone, format, platform, link,
 * location, copy, capacity, language, category — and a draft can be saved
 * without a schedule, which is the whole point of a draft.
 */

// The real control geocodes as you type; this test is about the form around it.
vi.mock("@/components/ui/address-search", () => ({
  AddressSearch: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (next: string) => void;
  }) => (
    <input
      aria-label="Address"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

import { MeetingCreateDialog } from "../meeting-create-dialog";

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ success: true, data: [] }),
}));

describe("MeetingCreateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderDialog() {
    return render(
      <MeetingCreateDialog
        open
        onOpenChange={() => {}}
        planId="db-plan-1"
        planName="Acme Corp"
      />,
    );
  }

  it("offers every property the Meetings page collects", () => {
    renderDialog();

    expect(screen.getByText("Meeting type")).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Starts")).toBeInTheDocument();
    expect(screen.getByLabelText("Ends")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Timezone")).toBeInTheDocument();
    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Max attendees")).toBeInTheDocument();
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByText("Benefit category")).toBeInTheDocument();
  });

  it("saves a draft with no schedule, filling the rest", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Save as draft" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe("/api/meetings");
    const body = JSON.parse(init.body);
    expect(body.status).toBe("Draft");
    expect(body.clientId).toBe("db-plan-1");
    expect(body.client).toBe("Acme Corp");
    // The schedule is optional for a draft, but the row is still renderable.
    expect(body.date).toBeTruthy();
    expect(body.time).toBe("12:00");
  });

  it("edits an existing meeting, keeping its schedule", async () => {
    const user = userEvent.setup();
    render(
      <MeetingCreateDialog
        open
        onOpenChange={() => {}}
        planId="db-plan-1"
        planName="Acme Corp"
        editing={{
          id: "meeting-1",
          meeting: "Open Enrollment",
          meetingType: "Open Enrollment",
          date: "2026-03-03",
          time: "09:00",
          endTime: "10:00",
          format: "Virtual",
          platform: "Zoom",
          meetingLink: "https://zoom.test/abc",
          status: "Upcoming",
        }}
      />,
    );

    // Update PUTs the row rather than creating another one.
    await user.click(screen.getByRole("button", { name: "Update meeting" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(url).toBe("/api/meetings/meeting-1");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body);
    expect(body.date).toBe("2026-03-03");
    expect(body.time).toBe("09:00");
    expect(body.endTime).toBe("10:00");
    expect(body.status).toBe("Upcoming");

    // An upcoming meeting is not offered the draft escape hatch.
    expect(
      screen.queryByRole("button", { name: "Save as draft" }),
    ).toBeNull();
  });

  it("refuses to schedule without the schedule, and says what is missing", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Schedule meeting" }),
    );

    expect(
      screen.getByText(/This meeting still needs a meeting type, a date/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
