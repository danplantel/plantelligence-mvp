import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  setTitle: vi.fn(),
  setSubtitle: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
  fetch: vi.fn(),
  refreshMeetings: vi.fn(),
  fetchCustomMeetings: vi.fn(),
  deleteCustomMeeting: vi.fn(),
  getLastPlanId: vi.fn(),
  getRecentPlanIds: vi.fn(),
  persistPlanSelection: vi.fn(),
  resolveStickyPlanId: vi.fn(),
  guard: null as any,
  clientsData: undefined as any,
  clientsLoading: false,
  meetingsData: undefined as any,
  meetingsLoading: false,
  searchParams: new URLSearchParams(),
  swrKeys: [] as string[],
  calendarProps: null as any,
  drawerProps: null as any,
  webinarsProps: null as any,
  customMeetings: [
    {
      value: "Open Enrollment",
      label: "Open Enrollment",
      description: "Learn about upcoming plan options.",
    },
    {
      value: "Understanding Your Benefits",
      label: "Understanding Your Benefits",
      description: "Get a clear overview of your benefits.",
    },
    {
      value: "Custom",
      label: "Custom",
      description: "Enter your meeting description here.",
    },
  ] as any[],
  savedMeetings: [] as any[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push, back: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("swr", () => ({
  default: (key: string | null) => {
    if (key) mocks.swrKeys.push(key);
    if (key === "/api/clients") {
      return {
        data: mocks.clientsData,
        isLoading: mocks.clientsLoading,
        mutate: vi.fn(),
      };
    }
    if (key && key.startsWith("/api/meetings")) {
      return {
        data: mocks.meetingsData,
        isLoading: mocks.meetingsLoading,
        mutate: mocks.refreshMeetings,
      };
    }
    return { data: undefined, isLoading: false, mutate: vi.fn() };
  },
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    setTitle: mocks.setTitle,
    setSubtitle: mocks.setSubtitle,
  }),
}));

vi.mock("@/hooks/use-navigate-away-guard", () => ({
  useNavigateAwayGuard: (options: any) => {
    mocks.guard = options;
    return {
      dialogOpen: false,
      isSaving: false,
      isDiscarding: false,
      dialogOnOpenChange: vi.fn(),
      suppressStayOnNextClose: vi.fn(),
    };
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
    warning: mocks.toastWarning,
  },
}));

vi.mock("@/components/plan-selector/plan-search-bar", () => ({
  PlanSearchBar: ({ plans, value, onChange, title, disabled }: any) => (
    <div
      data-testid="plan-search-bar"
      data-value={value}
      data-disabled={String(!!disabled)}
    >
      <span>{title}</span>
      {plans.map((plan: any) => (
        <button
          key={plan.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(plan.id)}
        >
          select-{plan.companyName}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/plan-selector/sticky-plan-combobox", () => ({
  StickyPlanCombobox: () => null,
}));

vi.mock("@/components/ui/plan-change-loading-dialog", () => ({
  PlanChangeLoadingDialog: ({ open }: any) =>
    open ? <div data-testid="plan-loading" /> : null,
}));

vi.mock("@/components/ui/navigate-away-warning-dialog", () => ({
  NavigateAwayWarningDialog: ({ open }: any) =>
    open ? <div data-testid="leave-warning" /> : null,
}));

vi.mock("@/components/ui/scaled-preview-frame", () => ({
  ScaledPreviewFrame: ({ children }: any) => (
    <div data-testid="preview-frame">{children}</div>
  ),
}));

vi.mock("@/components/pages/client-portal/sections/webinars-section", () => ({
  WebinarsSection: (props: any) => {
    mocks.webinarsProps = props;
    return (
      <div
        data-testid="webinars"
        data-client-id={props.clientId ?? ""}
        data-brand-color={props.brandColor}
        data-secondary-color={props.secondaryColor}
      />
    );
  },
}));

vi.mock("@/components/meetings/meetings-calendar-view", () => ({
  MeetingsCalendarView: (props: any) => {
    mocks.calendarProps = props;
    return (
      <div data-testid="calendar-view" data-count={props.meetings.length}>
        <button type="button" onClick={() => props.onSelectDay?.("2027-05-10")}>
          calendar-select-day
        </button>
        <button type="button" onClick={() => props.onQuickAdd?.("2027-05-10")}>
          calendar-quick-add
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/meetings/meeting-day-drawer", () => ({
  MeetingDayDrawer: (props: any) => {
    mocks.drawerProps = props;
    if (!props.open) return null;
    const first = props.meetings[0];
    return (
      <div data-testid="day-drawer" data-date={props.dateKey ?? ""}>
        <span>drawer meetings: {props.meetings.length}</span>
        <button type="button" onClick={() => props.onAdd?.()}>
          drawer-add
        </button>
        {first && (
          <>
            <button type="button" onClick={() => props.onEdit?.(first)}>
              drawer-edit
            </button>
            <button type="button" onClick={() => props.onDuplicate?.(first)}>
              drawer-duplicate
            </button>
            <button type="button" onClick={() => props.onDelete?.(first)}>
              drawer-delete
            </button>
          </>
        )}
      </div>
    );
  },
}));

vi.mock("@/components/ui/address-search", () => ({
  AddressSearch: ({ value, onChange, onLocationSelect }: any) => (
    <div>
      <input
        aria-label="address"
        value={value}
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

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: any) => (
    <button type="button" onClick={() => onSelect?.(new Date(2027, 4, 10))}>
      pick-calendar-date
    </button>
  ),
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

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
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

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      value={value ?? ""}
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

vi.mock("@/lib/meetings", () => ({
  MEETING_TYPES: [
    {
      value: "Open Enrollment",
      label: "Open Enrollment",
      description: "Learn about upcoming plan options.",
    },
    {
      value: "Understanding Your Benefits",
      label: "Understanding Your Benefits",
      description: "Get a clear overview of your benefits.",
    },
    {
      value: "Custom",
      label: "Custom",
      description: "Enter your meeting description here.",
    },
  ],
  useMeetingStore: (selector: any) =>
    selector({
      customMeetings: mocks.customMeetings,
      fetchCustomMeetings: mocks.fetchCustomMeetings,
      deleteCustomMeeting: mocks.deleteCustomMeeting,
    }),
  useSaveMeetingDebugStore: (selector: any) =>
    selector({
      savedMeetings: mocks.savedMeetings,
      saveCustomMeeting: vi.fn(),
      rebaseCustomMeeting: vi.fn(),
      deleteMeeting: vi.fn(),
    }),
}));

vi.mock("@/lib/plan-selector-storage", () => ({
  getLastPlanId: mocks.getLastPlanId,
  getRecentPlanIds: mocks.getRecentPlanIds,
  persistPlanSelection: mocks.persistPlanSelection,
  resolveStickyPlanId: mocks.resolveStickyPlanId,
}));

import MeetingsPage from "../page";

// The post-save duplicate journeys exercise the full create dialog, the
// post-save dialog, and a second send; they need more than the 5s default when
// the whole suite is running in parallel.
vi.setConfig({ testTimeout: 15_000 });

const CLIENTS = [
  {
    id: "plan-1",
    companyName: "Acme Corp",
    status: "Active",
    brandColor: "#123456",
    secondaryColor: "#654321",
  },
  { id: "plan-2", companyName: "Beta LLC", status: "Active" },
  { id: "archived-1", companyName: "Old Co", status: "Archived" },
];

const MEETINGS = [
  {
    id: "m-1",
    meeting: "Open Enrollment Session",
    meetingType: "Open Enrollment",
    client: "Acme Corp",
    clientId: "plan-1",
    date: "2027-05-10",
    time: "09:30",
    timezone: "America/New_York",
    duration: "1 hour",
    format: "Virtual",
    platform: "Zoom",
    attendees: 12,
    status: "Upcoming",
    meetingLink: "zoom.us/j/1",
    description: "Session description",
    language: "Spanish",
    benefitsCategory: "Retirement",
  },
  {
    id: "m-2",
    meeting: "Benefits Overview",
    meetingType: "Understanding Your Benefits",
    client: "Acme Corp",
    clientId: "plan-1",
    date: "2027-06-15",
    time: "14:00",
    timezone: "America/Chicago",
    duration: "2 hours",
    format: "In-Person",
    attendees: 3,
    maxAttendees: 20,
    status: "Scheduled",
    address: "1 Main St",
    city: "Austin",
    state: "TX",
    language: "English",
  },
  {
    id: "m-3",
    meeting: "Draft Session",
    meetingType: "Custom Type",
    client: "Beta LLC",
    clientId: "plan-2",
    date: "2027-07-01",
    time: "11:00",
    duration: "30 minutes",
    format: "Virtual",
    platform: "Teams",
    attendees: 0,
    status: "Draft",
    meetingLink: "https://teams.example/x",
    benefitsCategory: "Group Health",
  },
];

const DEFAULT_DESCRIPTION =
  "Learn about upcoming plan options, updates, and key dates so you can make informed choices for the year ahead.";

function jsonResponse(payload: any, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => payload };
}

function renderPage() {
  return render(<MeetingsPage />);
}

function cardFor(title: string): HTMLElement {
  let element = screen.getByText(title) as HTMLElement | null;
  while (element && !element.textContent?.includes("Duration")) {
    element = element.parentElement;
  }
  if (!element) throw new Error(`Could not find card for ${title}`);
  return element;
}

function selectNear(label: RegExp): HTMLSelectElement {
  const labelElement = screen.getByText(label, { selector: "label" });
  return within(labelElement.parentElement as HTMLElement).getByRole(
    "combobox",
  ) as HTMLSelectElement;
}

function postCalls() {
  return mocks.fetch.mock.calls.filter(
    ([url, init]) => url === "/api/meetings" && init?.method === "POST",
  );
}

async function openSchedule(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("button", { name: /Add Meeting/ })[0]);
}

async function pickDate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Pick a date/ }));
  await user.click(screen.getByRole("button", { name: "pick-calendar-date" }));
  await user.click(screen.getByRole("button", { name: "OK" }));
}

async function fillRequiredVirtualMeeting(
  user: ReturnType<typeof userEvent.setup>,
) {
  await openSchedule(user);
  await pickDate(user);
  await user.type(screen.getByPlaceholderText("e.g. 1:30pm"), "1:30pm");
  await user.type(screen.getByPlaceholderText("e.g. 2:00pm"), "3:00pm");
  fireEvent.change(selectNear(/^Format/), { target: { value: "Virtual" } });
  fireEvent.change(selectNear(/^Platform/), { target: { value: "Zoom" } });
  await user.type(
    screen.getByPlaceholderText("https://"),
    "https://zoom.us/j/123",
  );
}

async function createMeeting(user: ReturnType<typeof userEvent.setup>) {
  await fillRequiredVirtualMeeting(user);
  await user.click(screen.getByRole("button", { name: "Schedule Meeting" }));
  await screen.findByText("Meeting Created");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientsData = { data: CLIENTS };
  mocks.clientsLoading = false;
  mocks.meetingsData = { data: MEETINGS };
  mocks.meetingsLoading = false;
  mocks.searchParams = new URLSearchParams();
  mocks.swrKeys = [];
  mocks.guard = null;
  mocks.calendarProps = null;
  mocks.drawerProps = null;
  mocks.webinarsProps = null;
  mocks.getLastPlanId.mockReturnValue("plan-1");
  mocks.resolveStickyPlanId.mockReturnValue("plan-1");
  mocks.getRecentPlanIds.mockReturnValue([]);

  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(jsonResponse({ success: true }));
});

describe("Meetings page shell", () => {
  it("shows the plan skeleton until the client list arrives", () => {
    mocks.clientsData = undefined;

    const { container } = renderPage();

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(1);
  });

  it("renders the plan picker with active clients and no selection", () => {
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);

    renderPage();

    const picker = screen.getByTestId("plan-search-bar");
    expect(picker).toHaveAttribute("data-disabled", "false");
    expect(picker).toHaveAttribute("data-value", "");
    expect(screen.getByText("Meeting Sessions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "select-Acme Corp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "select-Beta LLC" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "select-Old Co" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Meeting/ })).not.toBeInTheDocument();
  });

  it("sets the page title", () => {
    renderPage();

    expect(mocks.setTitle).toHaveBeenCalledWith("Meetings");
  });

  it("restores the sticky communications plan and publishes its subtitle", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
        "data-value",
        "plan-1",
      ),
    );
    expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp");
    expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument();
  });

  it("disables the picker when there are no clients", () => {
    mocks.clientsData = { data: [] };
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);

    renderPage();

    expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
      "data-disabled",
      "true",
    );
    expect(screen.queryByRole("button", { name: /Add Meeting/ })).not.toBeInTheDocument();
  });

  it("honors a planId deep link and persists the selection", async () => {
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);
    mocks.searchParams = new URLSearchParams("planId=plan-2");

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
        "data-value",
        "plan-2",
      ),
    );
    expect(mocks.persistPlanSelection).toHaveBeenCalledWith(
      "communications",
      "plan-2",
    );
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        expect.stringContaining("planId=plan-2"),
      ),
    );
  });

  it("resolves a client query param case-insensitively", async () => {
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);
    mocks.searchParams = new URLSearchParams("client=acme%20corp");

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
        "data-value",
        "plan-1",
      ),
    );
    expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp");
    expect(
      screen.queryByText("Draft Session"),
    ).not.toBeInTheDocument();
  });

  it("applies the status query param to the request and the list", async () => {
    mocks.searchParams = new URLSearchParams("status=Upcoming");

    renderPage();

    await waitFor(() =>
      expect(
        mocks.swrKeys.some((key) => key.includes("status=Upcoming")),
      ).toBe(true),
    );
    expect(await screen.findByText("Open Enrollment Session")).toBeInTheDocument();
    expect(screen.queryByText("Benefits Overview")).not.toBeInTheDocument();
  });

  it("writes the active plan and client filter back to the URL", async () => {
    const user = userEvent.setup();
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);
    renderPage();

    await user.click(screen.getByRole("button", { name: "select-Beta LLC" }));

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        expect.stringContaining("planId=plan-2"),
      ),
    );
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("client=Beta+LLC"),
    );
  });

  it("opens the plan loading dialog and closes it once meetings settle", async () => {
    const user = userEvent.setup();
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);
    renderPage();

    await user.click(screen.getByRole("button", { name: "select-Beta LLC" }));

    expect(screen.getByTestId("plan-loading")).toBeInTheDocument();
    await waitFor(
      () => expect(screen.queryByTestId("plan-loading")).not.toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it("caps the plan loading dialog at six seconds", () => {
    vi.useFakeTimers();
    try {
      mocks.getLastPlanId.mockReturnValue(null);
      mocks.resolveStickyPlanId.mockReturnValue(null);
      mocks.meetingsData = undefined;
      mocks.meetingsLoading = true;

      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "select-Beta LLC" }));
      expect(screen.getByTestId("plan-loading")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(350);
      });
      expect(screen.getByTestId("plan-loading")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5650);
      });
      expect(screen.queryByTestId("plan-loading")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Meetings list", () => {
  it("shows the empty state with two Add Meeting actions", () => {
    mocks.meetingsData = { data: [] };

    renderPage();

    expect(screen.getByText("No meetings added yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add Meeting/ })).toHaveLength(2);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("renders meeting details, statuses, language, and formats", async () => {
    renderPage();
    await screen.findByText("Open Enrollment Session");

    const first = cardFor("Open Enrollment Session");
    expect(within(first).getByText("05/10/2027")).toBeInTheDocument();
    expect(within(first).getByText("9:30 AM")).toBeInTheDocument();
    expect(within(first).getByText("(ET)")).toBeInTheDocument();
    expect(within(first).getByText("1 hour")).toBeInTheDocument();
    expect(within(first).getByText("12")).toBeInTheDocument();
    expect(within(first).getByText("Zoom")).toBeInTheDocument();
    expect(within(first).getByText("ES")).toBeInTheDocument();
    expect(within(first).getByText("Retirement")).toBeInTheDocument();
    expect(within(first).getByText("Session description")).toBeInTheDocument();
    expect(within(first).getByText("Upcoming")).toBeInTheDocument();
    expect(
      within(first).getByRole("link", { name: /View link/ }),
    ).toHaveAttribute("href", "https://zoom.us/j/1");

    const second = cardFor("Benefits Overview");
    expect(within(second).getByText("06/15/2027")).toBeInTheDocument();
    expect(within(second).getByText("3 / 20")).toBeInTheDocument();
    expect(within(second).getByText("Austin, TX")).toBeInTheDocument();
    expect(within(second).getByText("EN")).toBeInTheDocument();
    // Scheduled is presented as Upcoming.
    expect(within(second).getByText("Upcoming")).toBeInTheDocument();
  });

  it("hides the filter row when the selected plan has no meetings", async () => {
    mocks.meetingsData = { data: [MEETINGS[2]] };

    renderPage();

    expect(await screen.findByText("No meetings added yet")).toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("filters by status", async () => {
    renderPage();
    await screen.findByText("Open Enrollment Session");

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "Upcoming" },
    });

    await waitFor(() =>
      expect(screen.queryByText("Benefits Overview")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Open Enrollment Session")).toBeInTheDocument();
    expect(screen.queryByText("Draft Session")).not.toBeInTheDocument();
  });

  it("filters by benefits category", async () => {
    renderPage();
    await screen.findByText("Open Enrollment Session");

    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "Retirement" },
    });

    await waitFor(() =>
      expect(screen.queryByText("Benefits Overview")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Open Enrollment Session")).toBeInTheDocument();
  });

  it("sorts meetings by furthest date", async () => {
    renderPage();
    await screen.findByText("Open Enrollment Session");

    fireEvent.change(screen.getAllByRole("combobox")[2], {
      target: { value: "date-desc" },
    });

    await waitFor(() => {
      const titles = screen
        .getAllByRole("heading", { level: 4 })
        .map((heading) => heading.textContent);
      expect(titles).toEqual(["Benefits Overview", "Open Enrollment Session"]);
    });
  });

  it("switches to the calendar view and opens the day drawer", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await user.click(screen.getByRole("button", { name: "Calendar" }));

    expect(screen.getByTestId("calendar-view")).toHaveAttribute(
      "data-count",
      "2",
    );
    await user.click(screen.getByRole("button", { name: "calendar-select-day" }));

    const drawer = screen.getByTestId("day-drawer");
    expect(drawer).toHaveAttribute("data-date", "2027-05-10");
    expect(within(drawer).getByText("drawer meetings: 1")).toBeInTheDocument();
  });

  it("quick-adds a meeting on the chosen calendar day", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await user.click(screen.getByRole("button", { name: "Calendar" }));
    await user.click(screen.getByRole("button", { name: "calendar-quick-add" }));

    expect(screen.getByText("Schedule a Meeting")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /May 10/ }),
    ).toBeInTheDocument();
  });

  it("forwards drawer edit and delete actions", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    await user.click(screen.getByRole("button", { name: "calendar-select-day" }));

    await user.click(screen.getByRole("button", { name: "drawer-edit" }));
    expect(screen.getByText("Edit Meeting")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "calendar-select-day" }));
    await user.click(screen.getByRole("button", { name: "drawer-delete" }));

    expect(
      screen.getByText(/Are you sure you want to delete "Open Enrollment Session"/),
    ).toBeInTheDocument();
  });

  it("switches to the portal preview with the plan brand colors", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    expect(
      screen.getByText("Meeting Preview").closest(".space-y-3"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("Meeting Preview").closest(".space-y-3")).not.toBeNull();
    expect(screen.getByTestId("webinars")).toHaveAttribute(
      "data-brand-color",
      "#123456",
    );
    expect(screen.getByTestId("webinars")).toHaveAttribute(
      "data-secondary-color",
      "#654321",
    );
    expect(screen.getByTestId("webinars")).toHaveAttribute(
      "data-client-id",
      "plan-1",
    );
  });
});

describe("Schedule meeting dialog", () => {
  it("opens with the selected plan and default copy", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await openSchedule(user);

    expect(screen.getByText("Schedule a Meeting")).toBeInTheDocument();
    expect(
      screen.getByText(/Fill in the details below to create a new meeting/),
    ).toBeInTheDocument();
    expect(selectNear(/^Meeting Type/)).toHaveValue("Open Enrollment");
    expect(screen.getByPlaceholderText(DEFAULT_DESCRIPTION)).toHaveValue(
      DEFAULT_DESCRIPTION,
    );
    expect(
      screen.getByRole("button", { name: "Schedule Meeting" }),
    ).toBeInTheDocument();
  });

  it("enables the end time after a start time and derives the duration", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    const endInput = screen.getByPlaceholderText("e.g. 2:00pm");
    expect(endInput).toBeDisabled();

    await user.type(screen.getByPlaceholderText("e.g. 1:30pm"), "1:30pm");
    expect(endInput).toBeEnabled();

    await user.type(endInput, "2:45pm");
    expect(screen.getByText("1 hour 15 minutes")).toBeInTheDocument();
  });

  it("reveals the custom meeting type input", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    fireEvent.change(selectNear(/^Meeting Type/), {
      target: { value: "Custom" },
    });

    expect(
      screen.getByPlaceholderText("Enter custom meeting type"),
    ).toBeInTheDocument();
  });

  it("switches conditional fields by format", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    fireEvent.change(selectNear(/^Format/), { target: { value: "Virtual" } });
    expect(screen.getByText(/^Platform/)).toBeInTheDocument();
    expect(screen.getByText(/^Meeting Link/)).toBeInTheDocument();
    expect(screen.queryByText(/^Location/)).not.toBeInTheDocument();

    fireEvent.change(selectNear(/^Format/), { target: { value: "In-Person" } });
    expect(screen.getByText(/^Location/)).toBeInTheDocument();
    expect(screen.queryByText(/^Platform/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Meeting Link/)).not.toBeInTheDocument();

    fireEvent.change(selectNear(/^Format/), {
      target: { value: "Virtual & In-Person" },
    });
    expect(screen.getByText(/^Location/)).toBeInTheDocument();
    expect(screen.getByText(/^Meeting Link/)).toBeInTheDocument();
  });

  it("fills the address from the address picker", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    fireEvent.change(selectNear(/^Format/), { target: { value: "In-Person" } });
    await user.click(screen.getByRole("button", { name: "select-address" }));

    expect(screen.getByLabelText("address")).toHaveValue("123 Main St");
  });

  it("requires the required fields before submitting", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    await user.click(screen.getByRole("button", { name: "Schedule Meeting" }));

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please fill in all required fields",
    );
    expect(postCalls()).toHaveLength(0);
  });

  it("creates a meeting, refreshes, and offers a duplicate", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await createMeeting(user);

    const [url, init] = postCalls()[0];
    expect(url).toBe("/api/meetings");
    expect(JSON.parse(init.body)).toMatchObject({
      meetingType: "Open Enrollment",
      client: "Acme Corp",
      clientId: "plan-1",
      date: "2027-05-10",
      time: "13:30",
      endTime: "15:00",
      duration: "1.5 hours",
      format: "Virtual",
      platform: "Zoom",
      meetingLink: "https://zoom.us/j/123",
      status: "Upcoming",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Meeting created successfully!",
    );
    expect(mocks.refreshMeetings).toHaveBeenCalled();
    expect(screen.getByText("Yes, duplicate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("reports a rejected create and keeps the dialog open", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "Nope" }, false, 500));
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await fillRequiredVirtualMeeting(user);
    await user.click(screen.getByRole("button", { name: "Schedule Meeting" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Nope"));
    expect(screen.getByText("Schedule a Meeting")).toBeInTheDocument();
    expect(mocks.refreshMeetings).not.toHaveBeenCalled();
  });

  it("reports a thrown create", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockRejectedValue(new Error("offline"));
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await fillRequiredVirtualMeeting(user);
    await user.click(screen.getByRole("button", { name: "Schedule Meeting" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "An error occurred while creating the meeting",
      ),
    );
  });

  it("saves a draft with sensible defaults", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    await user.click(screen.getByRole("button", { name: "Save as Draft" }));

    const [, init] = postCalls()[0];
    expect(JSON.parse(init.body)).toMatchObject({
      meeting: "Open Enrollment",
      meetingType: "Open Enrollment",
      client: "Acme Corp",
      clientId: "plan-1",
      time: "12:00",
      duration: "1 hour",
      format: "Virtual",
      platform: "Zoom",
      maxAttendees: "50",
      language: "English",
      status: "Draft",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Draft meeting saved successfully!",
    );
    expect(mocks.refreshMeetings).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reports a rejected draft save", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "Draft failed" }, false, 500));
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    await user.click(screen.getByRole("button", { name: "Save as Draft" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Draft failed"),
    );
  });

  it("reports a thrown draft save", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockRejectedValue(new Error("offline"));
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    await user.click(screen.getByRole("button", { name: "Save as Draft" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "An error occurred while saving the draft",
      ),
    );
  });

  it("edits an existing meeting and sends a PUT", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await user.click(
      within(cardFor("Open Enrollment Session")).getByRole("button", {
        name: "Edit",
      }),
    );

    expect(screen.getByText("Edit Meeting")).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Meeting data loaded for editing. Make your changes and submit to update.",
    );
    expect(screen.getByPlaceholderText("e.g. 1:30pm")).toHaveValue("9:30am");
    expect(screen.getByPlaceholderText("e.g. 2:00pm")).toHaveValue("10:30am");
    expect(selectNear(/^Format/)).toHaveValue("Virtual");

    await user.click(screen.getByRole("button", { name: "Update Meeting" }));

    await waitFor(() => expect(mocks.refreshMeetings).toHaveBeenCalled());
    const putCall = mocks.fetch.mock.calls.find(
      ([url, init]) => url === "/api/meetings/m-1" && init?.method === "PUT",
    );
    expect(JSON.parse(putCall![1].body)).toMatchObject({
      meetingType: "Open Enrollment",
      date: "2027-05-10",
      time: "09:30",
      duration: "1 hour",
      status: "Upcoming",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Meeting updated successfully!",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes an edit without saving and resets on reopen", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await user.click(
      within(cardFor("Open Enrollment Session")).getByRole("button", {
        name: "Edit",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openSchedule(user);
    expect(screen.getByText("Schedule a Meeting")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 1:30pm")).toHaveValue("");
  });

  it("duplicates a meeting with prefilled details and warns about the slot", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Benefits Overview");

    await user.click(
      within(cardFor("Benefits Overview")).getByRole("button", {
        name: "Duplicate",
      }),
    );

    expect(screen.getByText("Schedule a Meeting")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 1:30pm")).toHaveValue("2:00pm");
    expect(screen.getByPlaceholderText("e.g. 2:00pm")).toHaveValue("4:00pm");
    expect(selectNear(/^Format/)).toHaveValue("In-Person");
    expect(mocks.toastWarning).toHaveBeenCalledWith(
      expect.stringContaining("Time conflict detected"),
      { duration: 5000 },
    );
  });

  it("deletes a meeting after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await user.click(
      within(cardFor("Open Enrollment Session")).getByRole("button", {
        name: "Delete",
      }),
    );
    expect(
      screen.getByText(/Are you sure you want to delete "Open Enrollment Session"/),
    ).toBeInTheDocument();

    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith("/api/meetings/m-1", {
        method: "DELETE",
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Meeting deleted successfully!",
    );
    expect(mocks.refreshMeetings).toHaveBeenCalled();
  });

  it("reports a rejected delete", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "no" }, false, 500));
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await user.click(
      within(cardFor("Open Enrollment Session")).getByRole("button", {
        name: "Delete",
      }),
    );
    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete meeting"),
    );
    expect(mocks.refreshMeetings).not.toHaveBeenCalled();
  });

  it("tracks meaningful edits for the leave guard", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    expect(mocks.guard.hasUnsavedChanges).toBe(false);

    await openSchedule(user);
    await user.type(screen.getByPlaceholderText("e.g. 1:30pm"), "1:30pm");

    await waitFor(() => expect(mocks.guard.hasUnsavedChanges).toBe(true));
    expect(mocks.guard.enabled).toBe(true);
    expect(typeof mocks.guard.onSaveAndExit).toBe("function");
  });
});

describe("Post-save duplicate flow", () => {
  it("closes without duplicating when No is chosen", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await createMeeting(user);

    await user.click(screen.getByRole("button", { name: "No" }));

    expect(screen.queryByText("Meeting Created")).not.toBeInTheDocument();
    expect(postCalls()).toHaveLength(1);
    expect(mocks.refreshMeetings).toHaveBeenCalledTimes(1);
  });

  it("inherits the snapshot and requires date/time/end before duplicating", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await createMeeting(user);

    await user.click(screen.getByRole("button", { name: "Yes, duplicate" }));

    const duplicateDialog = screen.getByRole("dialog");
    expect(within(duplicateDialog).getByText("Duplicate Meeting")).toBeInTheDocument();
    expect(within(duplicateDialog).getByText("Open Enrollment")).toBeInTheDocument();
    expect(within(duplicateDialog).getByText("1.5 hours")).toBeInTheDocument();
    expect(within(duplicateDialog).getByText("Acme Corp")).toBeInTheDocument();
    expect(
      within(duplicateDialog).getByPlaceholderText(DEFAULT_DESCRIPTION),
    ).toHaveValue(DEFAULT_DESCRIPTION);

    await user.click(screen.getByRole("button", { name: "Create Duplicate" }));
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Date and time are required to duplicate the meeting",
    );

    await pickDate(user);
    await user.type(screen.getByPlaceholderText("e.g. 1:30pm"), "1:30pm");
    await user.click(screen.getByRole("button", { name: "Create Duplicate" }));
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please choose an end time for the duplicated meeting",
    );
  });

  it("creates the duplicate and closes the dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await createMeeting(user);

    await user.click(screen.getByRole("button", { name: "Yes, duplicate" }));
    await pickDate(user);
    await user.type(screen.getByPlaceholderText("e.g. 1:30pm"), "1:30pm");
    await user.type(screen.getByPlaceholderText("e.g. 2:00pm"), "3:00pm");
    await user.click(screen.getByRole("button", { name: "Create Duplicate" }));

    await waitFor(() => expect(postCalls()).toHaveLength(2));
    const [, init] = postCalls()[1];
    expect(JSON.parse(init.body)).toMatchObject({
      meetingType: "Open Enrollment",
      clientId: "plan-1",
      date: "2027-05-10",
      time: "13:30",
      endTime: "15:00",
      duration: "1.5 hours",
      status: "Upcoming",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Meeting duplicated successfully!",
    );
    expect(screen.queryByText("Duplicate Meeting")).not.toBeInTheDocument();
    expect(mocks.refreshMeetings).toHaveBeenCalledTimes(2);
  });

  it("returns from the duplicate view with Back", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await createMeeting(user);

    await user.click(screen.getByRole("button", { name: "Yes, duplicate" }));
    expect(screen.getByText("Duplicate Meeting")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Meeting Created")).toBeInTheDocument();
    expect(screen.queryByText("Duplicate Meeting")).not.toBeInTheDocument();
  });
});

describe("Meetings page edge cases", () => {
  it("submits a custom meeting type by its typed name", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);
    await pickDate(user);
    await user.type(screen.getByPlaceholderText("e.g. 1:30pm"), "1:30pm");
    await user.type(screen.getByPlaceholderText("e.g. 2:00pm"), "3:00pm");
    fireEvent.change(selectNear(/^Format/), { target: { value: "Virtual" } });
    fireEvent.change(selectNear(/^Platform/), { target: { value: "Zoom" } });
    await user.type(screen.getByPlaceholderText("https://"), "https://zoom.us/j/9");
    fireEvent.change(selectNear(/^Meeting Type/), {
      target: { value: "Custom" },
    });
    await user.type(
      screen.getByPlaceholderText("Enter custom meeting type"),
      "Fireside",
    );

    await user.click(screen.getByRole("button", { name: "Schedule Meeting" }));

    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(JSON.parse(postCalls()[0][1].body)).toMatchObject({
      meetingType: "Fireside",
      customMeetingType: "Fireside",
    });
  });

  it("requires and sends a custom platform for Other", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await fillRequiredVirtualMeeting(user);
    fireEvent.change(selectNear(/^Platform/), { target: { value: "Other" } });

    await user.click(screen.getByRole("button", { name: "Schedule Meeting" }));
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please fill in all required fields",
    );
    expect(postCalls()).toHaveLength(0);

    await user.type(
      screen.getByPlaceholderText("Enter platform name"),
      "Webex",
    );
    await user.click(screen.getByRole("button", { name: "Schedule Meeting" }));

    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(JSON.parse(postCalls()[0][1].body)).toMatchObject({
      platform: "Other",
      customPlatform: "Webex",
    });
  });

  it("requires an address for In-Person and sends the address parts", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);
    await pickDate(user);
    await user.type(screen.getByPlaceholderText("e.g. 1:30pm"), "1:30pm");
    await user.type(screen.getByPlaceholderText("e.g. 2:00pm"), "3:00pm");
    fireEvent.change(selectNear(/^Format/), { target: { value: "In-Person" } });

    await user.click(screen.getByRole("button", { name: "Schedule Meeting" }));
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please fill in all required fields",
    );

    await user.click(screen.getByRole("button", { name: "select-address" }));
    await user.click(screen.getByRole("button", { name: "Schedule Meeting" }));

    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(JSON.parse(postCalls()[0][1].body)).toMatchObject({
      format: "In-Person",
      address: "123 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
    });
  });

  it("keeps the previous date when the date picker is cancelled", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);
    await pickDate(user);

    await user.click(screen.getByRole("button", { name: /May 10/ }));
    await user.click(screen.getAllByRole("button", { name: "Cancel" })[0]);

    expect(screen.getByRole("button", { name: /May 10/ })).toBeInTheDocument();
  });

  it("parses compact typed times and restores an invalid value on blur", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    const start = screen.getByPlaceholderText("e.g. 1:30pm");
    await user.type(start, "2pm");

    expect(screen.getByPlaceholderText("e.g. 2:00pm")).toBeEnabled();
    expect(start).toHaveValue("2pm");

    await user.clear(start);
    await user.type(start, "nonsense");
    fireEvent.blur(start);

    expect(start).toHaveValue("2:00pm");
  });

  it("limits the end-time list to later slots and shows each duration", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    await user.type(screen.getByPlaceholderText("e.g. 1:30pm"), "1:30pm");
    // Close the start-time popover before opening the end-time one.
    await user.click(screen.getByRole("button", { name: "Pick start time" }));
    await user.click(screen.getByRole("button", { name: "Pick end time" }));

    expect(screen.queryByRole("button", { name: /^1:00pm/ })).not.toBeInTheDocument();
    const firstSlot = screen.getByRole("button", { name: /^1:45pm/ });
    expect(within(firstSlot).getByText("(15 minutes)")).toBeInTheDocument();
  });

  it("autofills the description and tracks its length", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await openSchedule(user);

    fireEvent.change(selectNear(/^Meeting Type/), {
      target: { value: "Understanding Your Benefits" },
    });

    expect(screen.getByPlaceholderText(DEFAULT_DESCRIPTION)).toHaveValue(
      "Get a clear overview of your benefits.",
    );
    expect(
      screen.getByText("Get a clear overview of your benefits.".length + "/180"),
    ).toBeInTheDocument();

    fireEvent.change(selectNear(/^Meeting Type/), {
      target: { value: "Custom" },
    });
    expect(screen.getByPlaceholderText(DEFAULT_DESCRIPTION)).toHaveValue("");
    expect(screen.getByText("0/180")).toBeInTheDocument();
  });

  it("hides Save as Draft while editing", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await user.click(
      within(cardFor("Open Enrollment Session")).getByRole("button", {
        name: "Edit",
      }),
    );

    expect(screen.queryByRole("button", { name: "Save as Draft" })).not.toBeInTheDocument();
  });

  it("shows a deleting overlay while the delete request is pending", async () => {
    const user = userEvent.setup();
    let resolveDelete: (value: any) => void = () => {};
    mocks.fetch.mockImplementation((url: string, init?: any) => {
      if (init?.method === "DELETE") {
        return new Promise((resolve) => {
          resolveDelete = resolve;
        });
      }
      return Promise.resolve(jsonResponse({ success: true }));
    });
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await user.click(
      within(cardFor("Open Enrollment Session")).getByRole("button", {
        name: "Delete",
      }),
    );
    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    expect(await screen.findByText("Deleting...")).toBeInTheDocument();

    await act(async () => {
      resolveDelete(jsonResponse({ success: true }));
    });
    await waitFor(() => expect(mocks.refreshMeetings).toHaveBeenCalled());
  });

  it("accepts a clientId deep link alias", async () => {
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);
    mocks.searchParams = new URLSearchParams("clientId=plan-2");

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
        "data-value",
        "plan-2",
      ),
    );
  });

  it("does nothing (and shows no loader) when the same plan is selected", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");

    await user.click(screen.getByRole("button", { name: "select-Acme Corp" }));

    expect(screen.queryByTestId("plan-loading")).not.toBeInTheDocument();
  });

  it("leaves the picker empty for an unknown planId", async () => {
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);
    mocks.searchParams = new URLSearchParams("planId=missing");

    renderPage();

    expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
      "data-value",
      "",
    );
    expect(screen.queryByRole("button", { name: /Add Meeting/ })).not.toBeInTheDocument();
  });

  it("forwards the drawer duplicate action", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Open Enrollment Session");
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    await user.click(screen.getByRole("button", { name: "calendar-select-day" }));

    await user.click(screen.getByRole("button", { name: "drawer-duplicate" }));

    expect(screen.getByText("Schedule a Meeting")).toBeInTheDocument();
    expect(mocks.toastWarning).toHaveBeenCalledWith(
      expect.stringContaining("Time conflict detected"),
      { duration: 5000 },
    );
  });

  it("renders the no-link, TBA, and hybrid-link branches", async () => {
    const base = { ...MEETINGS[0], client: "Acme Corp", clientId: "plan-1" };
    mocks.meetingsData = {
      data: [
        {
          ...base,
          id: "v-1",
          meeting: "Virtual No Link",
          format: "Virtual",
          meetingLink: undefined,
        },
        {
          ...base,
          id: "v-2",
          meeting: "In Person TBA",
          format: "In-Person",
          meetingLink: undefined,
          address: undefined,
          city: undefined,
          state: undefined,
        },
        {
          ...base,
          id: "v-3",
          meeting: "Hybrid Link",
          format: "Virtual & In-Person",
          meetingLink: "https://hybrid.example",
        },
      ],
    };
    renderPage();

    expect(await screen.findByText("Virtual No Link")).toBeInTheDocument();
    expect(within(cardFor("Virtual No Link")).getByText("No link")).toBeInTheDocument();
    expect(within(cardFor("In Person TBA")).getByText("TBA")).toBeInTheDocument();
    expect(
      within(cardFor("Hybrid Link")).getByRole("link", { name: /View link/ }),
    ).toHaveAttribute("href", "https://hybrid.example");
  });

  it("maps Completed and Cancelled statuses to Past", async () => {
    mocks.meetingsData = {
      data: [
        { ...MEETINGS[0], id: "c-1", meeting: "Completed Meeting", status: "Completed" },
        { ...MEETINGS[0], id: "c-2", meeting: "Cancelled Meeting", status: "Cancelled" },
      ],
    };
    renderPage();

    expect(await screen.findByText("Completed Meeting")).toBeInTheDocument();
    expect(
      within(cardFor("Completed Meeting")).getByText("Past"),
    ).toBeInTheDocument();
    expect(
      within(cardFor("Cancelled Meeting")).getByText("Past"),
    ).toBeInTheDocument();
  });
});
