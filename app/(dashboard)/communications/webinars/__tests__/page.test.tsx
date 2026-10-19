import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  setTitle: vi.fn(),
  setSubtitle: vi.fn(),
  getLastPlanId: vi.fn(),
  resolveStickyPlanId: vi.fn(),
  compressImage: vi.fn(),
  preload: vi.fn(),
  hoverOptions: null as any,
  clients: [] as any[],
  webinars: [] as any[],
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/hooks/usePageTitleContext", () => ({
  usePageTitleContext: () => ({
    setTitle: mocks.setTitle,
    setSubtitle: mocks.setSubtitle,
  }),
}));

vi.mock("@/lib/plan-selector-storage", () => ({
  getLastPlanId: mocks.getLastPlanId,
  resolveStickyPlanId: mocks.resolveStickyPlanId,
}));

vi.mock("@/lib/image-compression", () => ({
  compressImage: mocks.compressImage,
}));

vi.mock("@/hooks/useWebinarHoverPreview", () => ({
  useWebinarHoverPreview: (options: any) => {
    mocks.hoverOptions = options;
    return {
      previewFor: () => null,
      hoveredId: null,
      getHoverProps: () => ({}),
      preloadHoverPreviews: mocks.preload,
    };
  },
}));

vi.mock("@/components/webinars/webinar-hover-preview", () => ({
  WebinarHoverPreviewLayer: ({ title }: any) => (
    <div data-testid="hover-layer" data-title={title} />
  ),
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

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
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

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ id, checked, onCheckedChange, ...props }: any) => (
    <input
      id={id}
      type="checkbox"
      checked={!!checked}
      onChange={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

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

import WebinarsPage from "../page";

const CLIENTS = [
  { id: "plan-1", companyName: "Acme Corp", status: "Active" },
  { id: "plan-2", companyName: "Beta LLC", status: "Active" },
  { id: "plan-3", companyName: "Old Co", status: "Archived" },
];

const WEBINARS = [
  {
    id: "w-1",
    clientId: "plan-1",
    clientName: "Acme Corp",
    sourceType: { upload: true, url: false },
    webinarTitle: "Retirement Replay",
    description: "Retirement description",
    thumbnail: "data:image/png;base64,thumb1",
    benefitsCategory: "Retirement",
    placements: ["news-events", "retirement"],
    eventDate: "2027-05-10T12:00:00.000Z",
    videoFileUrl: null,
    hasVideoFile: true,
    videoSize: 5_000,
    videoUrl: null,
    createdAt: "2027-05-01T00:00:00.000Z",
  },
  {
    id: "w-2",
    clientId: "plan-1",
    clientName: "Acme Corp",
    sourceType: { upload: false, url: true },
    webinarTitle: "Health Webinar",
    description: "Health description",
    thumbnail: "data:image/png;base64,thumb2",
    benefitsCategory: "Health",
    placements: ["news-events"],
    eventDate: "2027-06-01T12:00:00.000Z",
    videoFileUrl: null,
    videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    createdAt: "2027-05-02T00:00:00.000Z",
  },
  {
    id: "w-3",
    clientId: "plan-2",
    clientName: "Beta LLC",
    sourceType: { upload: false, url: true },
    webinarTitle: "Beta Video",
    description: "Beta description",
    thumbnail: "data:image/png;base64,thumb3",
    benefitsCategory: "All",
    placements: ["news-events"],
    eventDate: "2027-07-01T12:00:00.000Z",
    videoFileUrl: null,
    videoUrl: "https://vimeo.com/123456789",
    createdAt: "2027-05-03T00:00:00.000Z",
  },
];

function response(payload: any, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => payload };
}

function installFetch() {
  mocks.fetch.mockImplementation(async (url: string, init?: any) => {
    if (url === "/api/clients") {
      return response({ success: true, data: mocks.clients });
    }
    if (url === "/api/webinars?includeVideoFiles=0") {
      return response({ success: true, data: mocks.webinars });
    }
    if (url === "/api/webinars/bulk-delete") {
      return response({ success: true });
    }
    if (url === "/api/webinars" && init?.method === "POST") {
      return response({ success: true });
    }
    if (url.startsWith("/api/webinars/")) {
      if (init?.method === "DELETE") return response({ success: true });
      if (init?.method === "PUT") return response({ success: true });
      return response({ success: true, data: { videoFileUrl: "STORED" } });
    }
    throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
  });
}

function cardFor(title: string): HTMLElement {
  const heading = screen.getByText(title);
  return heading.closest(".p-4") as HTMLElement;
}

function postCall() {
  return mocks.fetch.mock.calls.find(
    ([url, init]) => url === "/api/webinars" && init?.method === "POST",
  );
}

async function openAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Add Video/ }));
}

async function pickDate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Pick a date/ }));
  await user.click(screen.getByRole("button", { name: "pick-calendar-date" }));
}

async function uploadThumbnail() {
  const input = document.querySelector(
    'input[type="file"][accept="image/*"]',
  ) as HTMLInputElement;
  fireEvent.change(input, {
    target: {
      files: [new File(["image"], "thumb.png", { type: "image/png" })],
    },
  });
  await waitFor(() => expect(mocks.compressImage).toHaveBeenCalled());
  await screen.findByAltText("Thumbnail preview");
}

function formDialog(): HTMLElement {
  return screen.getByRole("dialog");
}

async function fillUrlForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: { title?: string; url?: string } = {},
) {
  await openAdd(user);
  await user.type(
    screen.getByPlaceholderText("Enter webinar title"),
    overrides.title ?? "New Webinar",
  );
  await pickDate(user);
  await uploadThumbnail();
  await user.click(within(formDialog()).getByText("URL"));
  await user.type(
    screen.getByPlaceholderText("https://youtube.com/watch?v=..."),
    overrides.url ?? "https://youtu.be/abcdefghijk",
  );
}

async function submitDialog(
  user: ReturnType<typeof userEvent.setup>,
  name = "Add Video",
) {
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clients = CLIENTS;
  mocks.webinars = WEBINARS;
  mocks.getLastPlanId.mockReturnValue("plan-1");
  mocks.resolveStickyPlanId.mockReturnValue("plan-1");
  mocks.compressImage.mockResolvedValue("data:image/jpeg;base64,compressed");
  installFetch();
  vi.stubGlobal("fetch", mocks.fetch);
  Object.defineProperty(window.URL, "createObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(() => "blob:video"),
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(),
  });
});

describe("Webinars page shell", () => {
  it("shows the plan skeleton until clients arrive", async () => {
    let resolveClients: (value: any) => void = () => {};
    mocks.fetch.mockImplementation((url: string) => {
      if (url === "/api/clients") {
        return new Promise((resolve) => {
          resolveClients = resolve;
        });
      }
      return Promise.resolve(response({ success: true, data: [] }));
    });

    const { container } = render(<WebinarsPage />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(1);

    await act(async () => {
      resolveClients(response({ success: true, data: CLIENTS }));
    });
    await screen.findByTestId("plan-search-bar");
  });

  it("sets the page title", () => {
    render(<WebinarsPage />);

    expect(mocks.setTitle).toHaveBeenCalledWith("Webinars & Replays");
  });

  it("loads active clients and restores the sticky plan", async () => {
    render(<WebinarsPage />);

    expect(await screen.findByText("Retirement Replay")).toBeInTheDocument();
    const picker = screen.getByTestId("plan-search-bar");
    await waitFor(() =>
      expect(picker).toHaveAttribute("data-value", "plan-1"),
    );
    expect(screen.getByRole("button", { name: "select-Acme Corp" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "select-Old Co" })).not.toBeInTheDocument();
    expect(screen.queryByText("Beta Video")).not.toBeInTheDocument();
  });

  it("shows the select-a-plan state when nothing is stored", async () => {
    mocks.getLastPlanId.mockReturnValue(null);
    mocks.resolveStickyPlanId.mockReturnValue(null);

    render(<WebinarsPage />);

    expect(
      await screen.findByText("Select a plan to get started"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
      "data-value",
      "",
    );
  });

  it("reports a client-load failure", async () => {
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url === "/api/clients") throw new Error("offline");
      return response({ success: true, data: [] });
    });

    render(<WebinarsPage />);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to load plans"),
    );
  });

  it("reports a webinars-load failure", async () => {
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url === "/api/clients") {
        return response({ success: true, data: CLIENTS });
      }
      throw new Error("offline");
    });

    render(<WebinarsPage />);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to load webinars"),
    );
  });

  it("reports a rejected webinars response", async () => {
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url === "/api/clients") {
        return response({ success: true, data: CLIENTS });
      }
      return response({ success: false, error: "nope" });
    });

    render(<WebinarsPage />);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to load webinars"),
    );
  });

  it("preloads hover subjects for the visible plan", async () => {
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await waitFor(() =>
      expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
        "data-value",
        "plan-1",
      ),
    );

    await waitFor(() => {
      const subjects = mocks.preload.mock.calls.at(-1)?.[0];
      expect(subjects.map((s: any) => s.id)).toEqual(["w-2", "w-1"]);
    });
    expect(mocks.hoverOptions.videoFileEndpoint({ id: "w-9" })).toBe(
      "/api/webinars/w-9",
    );
    expect(mocks.hoverOptions.suspended).toBe(false);
  });
});

describe("Webinars list", () => {
  it("shows the empty state", async () => {
    mocks.webinars = [];

    render(<WebinarsPage />);

    expect(await screen.findByText("No videos added yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first video with the Add Video button above"),
    ).toBeInTheDocument();
  });

  it("renders source, category, description, date, and source labels", async () => {
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    const first = within(cardFor("Retirement Replay"));
    expect(first.getByText("Upload")).toBeInTheDocument();
    expect(first.getByText("Retirement")).toBeInTheDocument();
    expect(first.getByText("Retirement description")).toBeInTheDocument();
    expect(first.getByText("05/10/2027")).toBeInTheDocument();
    expect(first.getByText("Uploaded File")).toBeInTheDocument();

    const second = within(cardFor("Health Webinar"));
    expect(second.getByText("URL")).toBeInTheDocument();
    expect(second.getByText("External URL")).toBeInTheDocument();
  });

  it("shows an em dash for an invalid event date", async () => {
    mocks.webinars = [
      { ...WEBINARS[0], id: "bad", webinarTitle: "Bad Date", eventDate: "not-a-date" },
    ];

    render(<WebinarsPage />);

    expect(await screen.findByText("Bad Date")).toBeInTheDocument();
    expect(within(cardFor("Bad Date")).getByText("—")).toBeInTheDocument();
  });

  it("sorts by date descending by default and toggles direction", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    const titles = () =>
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(titles()).toEqual(["Health Webinar", "Retirement Replay"]);

    await user.click(screen.getByTitle("Sort descending"));

    expect(titles()).toEqual(["Retirement Replay", "Health Webinar"]);
  });

  it("sorts by size using the reported video size", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "size" },
    });

    const titles = screen
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(titles[0]).toBe("Retirement Replay");
  });

  it("scopes the list to the selected plan", async () => {
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    expect(screen.queryByText("Beta Video")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.setSubtitle).toHaveBeenCalledWith("Acme Corp"),
    );
  });

  it("resets the form and closes the dialog when the plan changes", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);
    expect(screen.getByText("Upload Video")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "select-Beta LLC" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("plan-search-bar")).toHaveAttribute(
      "data-value",
      "plan-2",
    );
    expect(await screen.findByText("Beta Video")).toBeInTheDocument();
  });
});

describe("Upload video form", () => {
  it("opens the add dialog with defaults and counters", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await openAdd(user);

    expect(screen.getByText("Upload Video")).toBeInTheDocument();
    expect(screen.getByText("0/60")).toBeInTheDocument();
    expect(screen.getByText("0/200")).toBeInTheDocument();
    expect(screen.getByLabelText(/News & Events/)).toBeChecked();
  });

  it("validates the required fields", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);

    await submitDialog(user);

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Please fill in all required fields",
    );
    expect(postCall()).toBeUndefined();
  });

  it("switches between URL and upload sources", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);

    await user.click(within(formDialog()).getByText("URL"));
    expect(within(formDialog()).getByText(/Video URL/)).toBeInTheDocument();
    expect(within(formDialog()).queryByText(/Video File/)).not.toBeInTheDocument();

    await user.click(within(formDialog()).getByText("Upload"));
    expect(within(formDialog()).getByText(/Video File/)).toBeInTheDocument();
    expect(within(formDialog()).queryByText(/Video URL/)).not.toBeInTheDocument();
  });

  it("creates a URL webinar with the expected payload", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await fillUrlForm(user, { title: "New URL Webinar" });
    await submitDialog(user);

    await waitFor(() => expect(postCall()).toBeDefined());
    const body = JSON.parse(postCall()![1].body);
    expect(body).toMatchObject({
      client: "Acme Corp",
      sourceType: { upload: false, url: true },
      webinarTitle: "New URL Webinar",
      thumbnail: "data:image/jpeg;base64,compressed",
      benefitsCategory: "All",
      placements: ["news-events"],
      videoFile: null,
      videoUrl: "https://youtu.be/abcdefghijk",
    });
    expect(new Date(body.eventDate).getTime()).toBe(
      new Date(2027, 4, 10).getTime(),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Webinar added successfully",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates an uploaded webinar with base64 video", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);
    await user.type(screen.getByPlaceholderText("Enter webinar title"), "Uploaded Webinar");
    await pickDate(user);
    await uploadThumbnail();
    await user.click(within(formDialog()).getByText("Upload"));

    const videoInput = document.querySelector(
      'input[type="file"][accept="video/*"]',
    ) as HTMLInputElement;
    fireEvent.change(videoInput, {
      target: {
        files: [new File(["video-bytes"], "clip.mp4", { type: "video/mp4" })],
      },
    });
    expect(screen.getByText(/Selected: clip.mp4/)).toBeInTheDocument();

    await submitDialog(user);

    await waitFor(() => expect(postCall()).toBeDefined());
    const body = JSON.parse(postCall()![1].body);
    expect(body.sourceType).toEqual({ upload: true, url: false });
    expect(body.videoFile).toBe("dmlkZW8tYnl0ZXM=");
  });

  it("rejects files over the 10MB limit", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);
    await user.click(within(formDialog()).getByText("Upload"));

    const videoInput = document.querySelector(
      'input[type="file"][accept="video/*"]',
    ) as HTMLInputElement;
    const big = new File(["x"], "big.mp4", { type: "video/mp4" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(videoInput, { target: { files: [big] } });

    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("10MB limit"),
    );
    expect(screen.queryByText(/Selected: big.mp4/)).not.toBeInTheDocument();
  });

  it("rejects a non-image thumbnail", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);

    const thumbInput = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    fireEvent.change(thumbInput, {
      target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
    });

    expect(mocks.toastError).toHaveBeenCalledWith("Please select an image file");
  });

  it("removes an uploaded thumbnail", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);
    await uploadThumbnail();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByAltText("Thumbnail preview")).not.toBeInTheDocument();
  });

  it("requires at least one placement", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);

    await user.click(screen.getByLabelText(/News & Events/));
    await submitDialog(user);

    expect(screen.getByText("Choose at least one page")).toBeInTheDocument();
    expect(postCall()).toBeUndefined();
  });

  it("sends the chosen benefit category and placements", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await fillUrlForm(user);
    fireEvent.change(within(formDialog()).getByRole("combobox"), {
      target: { value: "Health" },
    });
    await user.click(screen.getByRole("checkbox", { name: /^Retirement/ }));
    await submitDialog(user);

    await waitFor(() => expect(postCall()).toBeDefined());
    const body = JSON.parse(postCall()![1].body);
    expect(body.benefitsCategory).toBe("Health");
    expect(body.placements).toEqual(["news-events", "retirement"]);
  });

  it("reports a rejected create", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/clients") return response({ success: true, data: CLIENTS });
      if (url === "/api/webinars?includeVideoFiles=0") {
        return response({ success: true, data: WEBINARS });
      }
      return response({ error: "Save failed" }, false, 500);
    });
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await fillUrlForm(user);
    await submitDialog(user);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Save failed"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("Editing and deleting", () => {
  it("edits a webinar without requiring a new file", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(within(cardFor("Retirement Replay")).getByRole("button", { name: "Edit" }));

    expect(screen.getByText("Edit Video")).toBeInTheDocument();
    expect(screen.getByText("Current video")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Retirement Replay")).toBeInTheDocument();

    await submitDialog(user, "Update Webinar");

    await waitFor(() =>
      expect(
        mocks.fetch.mock.calls.some(
          ([url, init]) => url === "/api/webinars/w-1" && init?.method === "PUT",
        ),
      ).toBe(true),
    );
    const put = mocks.fetch.mock.calls.find(
      ([url, init]) => url === "/api/webinars/w-1" && init?.method === "PUT",
    );
    expect(JSON.parse(put![1].body)).toMatchObject({
      webinarTitle: "Retirement Replay",
      videoFile: null,
      placements: ["news-events", "retirement"],
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Webinar updated successfully",
    );
  });

  it("loads the stored video preview on demand", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await user.click(within(cardFor("Retirement Replay")).getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith("/api/webinars/w-1"),
    );
    const video = document.querySelector("video");
    expect(video).toHaveAttribute("src", "data:video/mp4;base64,STORED");
  });

  it("reports a failed stored-video preview", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/clients") return response({ success: true, data: CLIENTS });
      if (url === "/api/webinars?includeVideoFiles=0") {
        return response({ success: true, data: WEBINARS });
      }
      return response({ error: "no" }, false, 500);
    });
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await user.click(within(cardFor("Retirement Replay")).getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to load that video"),
    );
  });

  it("deletes a webinar after confirmation", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(within(cardFor("Retirement Replay")).getByRole("button", { name: "Delete" }));
    expect(
      screen.getByText('Are you sure you want to delete "Retirement Replay"?'),
    ).toBeInTheDocument();

    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() =>
      expect(mocks.fetch).toHaveBeenCalledWith("/api/webinars/w-1", {
        method: "DELETE",
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Webinar deleted successfully",
    );
  });

  it("reports a rejected delete", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/clients") return response({ success: true, data: CLIENTS });
      if (url === "/api/webinars?includeVideoFiles=0") {
        return response({ success: true, data: WEBINARS });
      }
      if (init?.method === "DELETE") {
        return response({ error: "Delete failed" }, false, 500);
      }
      return response({ success: true });
    });
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(within(cardFor("Retirement Replay")).getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Delete failed"),
    );
  });
});

describe("Multi-select and bulk delete", () => {
  it("selects one webinar and bulk-deletes it", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select Retirement Replay" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Delete selected/ }));
    expect(
      screen.getByText('Are you sure you want to delete "Retirement Replay"?'),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() =>
      expect(
        mocks.fetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/webinars/bulk-delete" && init?.method === "POST",
        ),
      ).toBe(true),
    );
    const bulk = mocks.fetch.mock.calls.find(
      ([url]) => url === "/api/webinars/bulk-delete",
    );
    expect(JSON.parse(bulk![1].body)).toEqual({ ids: ["w-1"] });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Webinar deleted successfully",
    );
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });

  it("selects and clears all visible rows", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });

  it("bulk-deletes every selected webinar with a counted toast", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    await user.click(screen.getByRole("button", { name: /Delete selected/ }));
    expect(
      screen.getByText(
        "Are you sure you want to delete 2 webinars? This cannot be undone.",
      ),
    ).toBeInTheDocument();

    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "2 webinars deleted successfully",
      ),
    );
  });

  it("reports a rejected bulk delete", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/clients") return response({ success: true, data: CLIENTS });
      if (url === "/api/webinars?includeVideoFiles=0") {
        return response({ success: true, data: WEBINARS });
      }
      if (url === "/api/webinars/bulk-delete") {
        return response({ error: "Bulk failed" }, false, 500);
      }
      return response({ success: true });
    });
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Select Retirement Replay" }));
    await user.click(screen.getByRole("button", { name: /Delete selected/ }));
    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Bulk failed"),
    );
  });
});

describe("Video preview", () => {
  it("embeds a YouTube URL", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Health Webinar");

    await user.click(
      within(cardFor("Health Webinar")).getByRole("button", {
        name: "Play Health Webinar",
      }),
    );

    const frame = document.querySelector("iframe")!;
    expect(frame).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/abcdefghijk",
    );
  });

  it("embeds a Vimeo URL", async () => {
    const user = userEvent.setup();
    mocks.webinars = [WEBINARS[2]];
    mocks.getLastPlanId.mockReturnValue("plan-2");
    mocks.resolveStickyPlanId.mockReturnValue("plan-2");
    render(<WebinarsPage />);
    await screen.findByText("Beta Video");

    await user.click(
      within(cardFor("Beta Video")).getByRole("button", {
        name: "Play Beta Video",
      }),
    );

    expect(document.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("uses a video element for direct MP4 URLs", async () => {
    const user = userEvent.setup();
    mocks.webinars = [
      {
        ...WEBINARS[1],
        id: "mp4",
        webinarTitle: "Direct MP4",
        videoUrl: "https://cdn.example/video.mp4",
      },
    ];
    render(<WebinarsPage />);
    await screen.findByText("Direct MP4");

    await user.click(
      within(cardFor("Direct MP4")).getByRole("button", {
        name: "Play Direct MP4",
      }),
    );

    expect(screen.getByRole("dialog").querySelector("video")).toHaveAttribute(
      "src",
      "https://cdn.example/video.mp4",
    );
  });

  it("lazily fetches the stored video payload", async () => {
    const user = userEvent.setup();
    let resolveVideo: (value: any) => void = () => {};
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/clients") return response({ success: true, data: CLIENTS });
      if (url === "/api/webinars?includeVideoFiles=0") {
        return response({ success: true, data: WEBINARS });
      }
      if (url === "/api/webinars/w-1" && !init?.method) {
        return new Promise((resolve) => {
          resolveVideo = resolve;
        });
      }
      return response({ success: true });
    });
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(
      within(cardFor("Retirement Replay")).getByRole("button", {
        name: "Play Retirement Replay",
      }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText("Retirement Replay"),
    ).toBeInTheDocument();

    await waitFor(() => expect(resolveVideo).toBeTypeOf("function"));
    await act(async () => {
      resolveVideo(response({ success: true, data: { videoFileUrl: "LAZY" } }));
    });

    await waitFor(() => {
      expect(
        screen.getByRole("dialog").querySelector("video"),
      ).toHaveAttribute("src", "data:video/mp4;base64,LAZY");
    });
  });

  it("reports a failed lazy video load", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/clients") return response({ success: true, data: CLIENTS });
      if (url === "/api/webinars?includeVideoFiles=0") {
        return response({ success: true, data: WEBINARS });
      }
      return response({ error: "no video" }, false, 500);
    });
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(
      within(cardFor("Retirement Replay")).getByRole("button", {
        name: "Play Retirement Replay",
      }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to load that video"),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("omits the play button when a row has no video", async () => {
    mocks.webinars = [
      {
        ...WEBINARS[0],
        id: "no-video",
        webinarTitle: "No Video",
        hasVideoFile: false,
        videoFileUrl: null,
        videoUrl: null,
      },
    ];
    render(<WebinarsPage />);
    await screen.findByText("No Video");

    expect(
      within(cardFor("No Video")).queryByRole("button", { name: "Play No Video" }),
    ).not.toBeInTheDocument();
  });
});

describe("Webinars page edge cases", () => {
  function videoFileInput(): HTMLInputElement {
    return document.querySelector(
      'input[type="file"][accept="video/*"]',
    ) as HTMLInputElement;
  }

  it("enables frame capture only after a video file is chosen", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);
    await user.click(within(formDialog()).getByText("Upload"));

    expect(
      screen.getByRole("button", { name: /Use Video Frame/ }),
    ).toBeDisabled();

    fireEvent.change(videoFileInput(), {
      target: {
        files: [new File(["video"], "clip.mp4", { type: "video/mp4" })],
      },
    });

    expect(
      screen.getByRole("button", { name: /Use Video Frame/ }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /Use Video Frame/ }));

    expect(
      screen.getByLabelText("Choose the video frame to use"),
    ).toBeInTheDocument();
  });

  it("captures a video frame as the thumbnail", async () => {
    const user = userEvent.setup();
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as any);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,frame",
    );
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);
    await user.click(within(formDialog()).getByText("Upload"));
    fireEvent.change(videoFileInput(), {
      target: {
        files: [new File(["video"], "clip.mp4", { type: "video/mp4" })],
      },
    });
    await user.click(screen.getByRole("button", { name: /Use Video Frame/ }));

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "videoWidth", { value: 1280 });
    Object.defineProperty(video, "videoHeight", { value: 720 });
    fireEvent.seeked(video);

    await waitFor(() =>
      expect(mocks.compressImage).toHaveBeenCalledWith(
        "data:image/jpeg;base64,frame",
        expect.objectContaining({ maxWidth: 640, maxHeight: 640 }),
      ),
    );
    expect(drawImage).toHaveBeenCalled();
    expect(await screen.findByAltText("Thumbnail preview")).toBeInTheDocument();
  });

  it("reports a thumbnail compression failure", async () => {
    const user = userEvent.setup();
    mocks.compressImage.mockRejectedValueOnce(new Error("canvas"));
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);

    const thumbInput = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    fireEvent.change(thumbInput, {
      target: { files: [new File(["img"], "thumb.png", { type: "image/png" })] },
    });

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to process that image",
      ),
    );
  });

  it("reports an unreadable thumbnail", async () => {
    const user = userEvent.setup();
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(
      function (this: FileReader) {
        Object.defineProperty(this, "result", { value: null });
        this.onerror?.(new ProgressEvent("error") as any);
      },
    );
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);

    const thumbInput = document.querySelector(
      'input[type="file"][accept="image/*"]',
    ) as HTMLInputElement;
    fireEvent.change(thumbInput, {
      target: { files: [new File(["img"], "thumb.png", { type: "image/png" })] },
    });

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to read that image",
      ),
    );
  });

  it("replaces the stored video when editing", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await user.click(
      within(cardFor("Retirement Replay")).getByRole("button", { name: "Edit" }),
    );

    fireEvent.change(videoFileInput(), {
      target: {
        files: [new File(["new-video"], "new.mp4", { type: "video/mp4" })],
      },
    });
    expect(screen.getByText("Replacing this video")).toBeInTheDocument();

    await submitDialog(user, "Update Webinar");

    await waitFor(() =>
      expect(
        mocks.fetch.mock.calls.some(
          ([url, init]) => url === "/api/webinars/w-1" && init?.method === "PUT",
        ),
      ).toBe(true),
    );
    const put = mocks.fetch.mock.calls.find(
      ([url, init]) => url === "/api/webinars/w-1" && init?.method === "PUT",
    );
    expect(JSON.parse(put![1].body).videoFile).toBe("bmV3LXZpZGVv");
  });

  it("closes and clears the form with Cancel", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);
    await user.type(
      screen.getByPlaceholderText("Enter webinar title"),
      "Unsaved title",
    );

    await user.click(
      within(formDialog()).getByRole("button", { name: "Cancel" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openAdd(user);
    expect(screen.getByPlaceholderText("Enter webinar title")).toHaveValue("");
  });

  it("cancels a single delete without calling the API", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await user.click(
      within(cardFor("Retirement Replay")).getByRole("button", { name: "Delete" }),
    );

    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    expect(
      mocks.fetch.mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);
  });

  it("cancels a bulk delete without posting", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(
      screen.getByRole("button", { name: "Select Retirement Replay" }),
    );
    await user.click(screen.getByRole("button", { name: /Delete selected/ }));
    await user.click(
      within(screen.getByTestId("confirm-dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(
      mocks.fetch.mock.calls.some(([url]) => url === "/api/webinars/bulk-delete"),
    ).toBe(false);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("clears the selection when the plan changes", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(
      screen.getByRole("button", { name: "Select Retirement Replay" }),
    );
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "select-Beta LLC" }));

    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
  });

  it("sorts by size ascending", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "size" },
    });
    await user.click(screen.getByTitle("Sort descending"));

    const titles = screen
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(titles).toEqual(["Health Webinar", "Retirement Replay"]);
  });

  it("shows the no-video message when the lazy fetch returns no payload", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/clients") return response({ success: true, data: CLIENTS });
      if (url === "/api/webinars?includeVideoFiles=0") {
        return response({ success: true, data: WEBINARS });
      }
      if (url === "/api/webinars/w-1" && !init?.method) {
        return response({ success: true, data: { videoFileUrl: null } });
      }
      return response({ success: true });
    });
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");

    await user.click(
      within(cardFor("Retirement Replay")).getByRole("button", {
        name: "Play Retirement Replay",
      }),
    );

    expect(
      await screen.findByText("No video available for this webinar."),
    ).toBeInTheDocument();
  });

  it("caps the title counter at the field maximum", async () => {
    const user = userEvent.setup();
    render(<WebinarsPage />);
    await screen.findByText("Retirement Replay");
    await openAdd(user);

    await user.type(
      screen.getByPlaceholderText("Enter webinar title"),
      "a".repeat(70),
    );

    expect(screen.getByText("60/60")).toBeInTheDocument();
  });
});
