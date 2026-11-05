import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Creating content from the News & Events panel.
 *
 * The panel edits rows that already exist; the only way to START one is the
 * dashboard's `MarketingAssetModal`. Two rules matter:
 *
 *  1. the three creators map onto the right asset type — and "Portal Notice"
 *     lands on the top-banner form rather than the type picker;
 *  2. the modal is handed the plan's DATABASE id, which is what
 *     `POST /api/marketing/assets` resolves (`assertOwnership` runs
 *     `findUnique({ where: { id } })`), NOT the route's plan slug.
 */

// A stable cache entry: the editor re-seeds from `data.data`, so a fresh array
// per render would look like a new asset list on every render.
const swr = vi.hoisted(() => ({
  state: {
    data: { data: [] as unknown[] },
    error: undefined,
    mutate: vi.fn(async () => undefined),
  },
  mutate: vi.fn(async () => undefined),
}));

// The panel reads two lists: the plan's marketing assets and its meetings. The
// stub answers per key so one cannot masquerade as the other.
const meetings = vi.hoisted(() => ({
  state: {
    data: { data: [] as unknown[] },
    error: undefined,
    mutate: vi.fn(async () => undefined),
  },
}));

vi.mock("swr", () => ({
  default: (key: string | null) =>
    String(key).startsWith("/api/meetings") ? meetings.state : swr.state,
  useSWRConfig: () => ({ mutate: swr.mutate }),
}));

const portal = vi.hoisted(() => ({
  clientData: {
    // The id the API needs…
    id: "db-plan-1",
    companyName: "Acme Corp",
    companyLogo: "https://cdn.test/logo.png",
  },
}));

vi.mock("@/contexts/client-portal-context", () => ({
  useClientPortal: () => portal,
}));

vi.mock("@/components/portal-editing/portal-editing-provider", () => {
  const value = {
    target: { page: "news", label: "News & Events" },
    // …as opposed to this, the route parameter. Deliberately different, so a
    // creator that used the wrong one would be caught.
    planId: "acme-slug",
    canEdit: true,
    isOpen: true,
    closePanel: () => {},
    beginSave: () => {},
    finishSave: () => {},
    failSave: () => {},
    resetSave: () => {},
    saveState: "idle",
    saveError: null,
    patchClientData: () => {},
    refetchPortal: async () => null,
  };
  return {
    usePortalEditing: () => value,
    useOptionalPortalEditing: () => value,
  };
});

vi.mock(
  "@/components/wizard/new-client-steps/sections/brand-images-section",
  () => ({
    BrandImagesSection: () => <div data-testid="brand-images" />,
  }),
);

// The two shared creators, reduced to the props the panel is responsible for.
vi.mock("@/components/meetings/meeting-create-dialog", () => ({
  MeetingCreateDialog: ({
    open,
    planId,
    planName,
    editing,
  }: {
    open: boolean;
    planId: string;
    planName: string;
    editing?: { id: string } | null;
  }) =>
    open ? (
      <div
        data-testid="meeting-create-dialog"
        data-plan-id={planId}
        data-plan-name={planName}
        data-editing-id={editing?.id ?? ""}
      />
    ) : null,
}));

vi.mock("@/components/webinars/webinar-create-dialog", () => ({
  WebinarCreateDialog: ({
    open,
    planId,
    planName,
  }: {
    open: boolean;
    planId: string;
    planName: string;
  }) =>
    open ? (
      <div
        data-testid="webinar-create-dialog"
        data-plan-id={planId}
        data-plan-name={planName}
      />
    ) : null,
}));

/** The dashboard's creator, reduced to the props this panel is responsible for. */
vi.mock("@/components/pages/marketing/marketing-asset-modal", () => ({
  default: ({
    open,
    onOpenChange,
    assetType,
    initialPortalElement,
    planId,
    planName,
    dialogZClass,
    editingAsset,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    assetType: string;
    initialPortalElement?: string | null;
    planId: string;
    planName: string;
    dialogZClass?: string;
    editingAsset?: { id?: string } | null;
  }) =>
    open ? (
      <div
        data-testid="marketing-asset-modal"
        data-asset-type={assetType}
        data-portal-element={initialPortalElement ?? ""}
        data-plan-id={planId}
        data-plan-name={planName}
        data-z-class={dialogZClass ?? ""}
        data-editing-id={editingAsset?.id ?? ""}
      >
        <button type="button" onClick={() => onOpenChange(false)}>
          close creator
        </button>
      </div>
    ) : null,
}));

import { PortalNewsEditor } from "@/components/portal-editing/editors/portal-news-editor";

function creator() {
  return screen.getByTestId("marketing-asset-modal");
}

describe("PortalNewsEditor — creating content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swr.state.data = { data: [] };
  });

  it("offers the three assets this page can create in place", () => {
    render(<PortalNewsEditor />);

    expect(
      screen.getByRole("button", { name: /Portal Notice/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /News post/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pop-up/ })).toBeInTheDocument();
  });

  it("creates a meeting in place, for this plan", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByRole("button", { name: /Meeting/ }));

    const dialog = screen.getByTestId("meeting-create-dialog");
    expect(dialog).toHaveAttribute("data-plan-id", "db-plan-1");
    expect(dialog).toHaveAttribute("data-plan-name", "Acme Corp");
  });

  it("creates a webinar in place, for this plan", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByRole("button", { name: /Webinar/ }));

    const dialog = screen.getByTestId("webinar-create-dialog");
    expect(dialog).toHaveAttribute("data-plan-id", "db-plan-1");
    expect(dialog).toHaveAttribute("data-plan-name", "Acme Corp");
  });

  it("opens the portal-notice creator straight on the top-banner form", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByRole("button", { name: /Portal Notice/ }));

    expect(creator()).toHaveAttribute("data-asset-type", "portal-notice");
    // The picker would offer Top Banner / Pop-up / Post; the label already said
    // which one, so it is preselected.
    expect(creator()).toHaveAttribute("data-portal-element", "top-banner");
  });

  it("opens the news-post creator", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByRole("button", { name: /News post/ }));

    expect(creator()).toHaveAttribute("data-asset-type", "news-post");
    expect(creator()).toHaveAttribute("data-portal-element", "");
  });

  it("opens the pop-up creator", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByRole("button", { name: /Pop-up/ }));

    expect(creator()).toHaveAttribute("data-asset-type", "pop-up");
  });

  it("hands the creator the plan's database id, not the route slug", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByRole("button", { name: /Portal Notice/ }));

    expect(creator()).toHaveAttribute("data-plan-id", "db-plan-1");
    expect(creator()).toHaveAttribute("data-plan-name", "Acme Corp");
  });

  it("raises the creator above the panel it was opened from", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByRole("button", { name: /News post/ }));

    // The panel itself is `fixed z-[51]`, above the dialog tier, so a modal left
    // at `z-50` opened underneath it. It also clears the published pop-up
    // (`z-[100]`), because an action the advisor asked for must beat an
    // unsolicited dialog.
    expect(creator()).toHaveAttribute("data-z-class", "z-[110]");
  });

  it("closes the creator when it asks to", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(screen.getByRole("button", { name: /Portal Notice/ }));
    await user.click(screen.getByRole("button", { name: "close creator" }));

    expect(screen.queryByTestId("marketing-asset-modal")).toBeNull();
  });
});

/**
 * The asset rows themselves.
 *
 * Three FIXED sections — one per asset type — so a second pop-up appends a row
 * instead of inserting another numbered section and renumbering everything
 * below it. Each asset is a collapsed accordion: expanding every one at once
 * made the panel a wall of fields.
 */
describe("PortalNewsEditor — asset sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swr.state.data = {
      data: [
        {
          id: "pop-1",
          type: "pop-up",
          status: "Published",
          headline: "Spring enrollment",
          body: "Enrolment is open.",
          ctaText: "Enroll",
        },
        {
          id: "pop-2",
          type: "pop-up",
          status: "Draft",
          headline: "Summer hours",
          body: "We close early on Fridays.",
          ctaText: "",
        },
        {
          id: "post-1",
          type: "news-post",
          status: "Published",
          headline: "New portal is live",
          body: "Welcome aboard.",
          ctaText: "See what changed",
        },
      ],
    };
  });

  it("groups the rows into one section per asset type", () => {
    render(<PortalNewsEditor />);

    // `SectionHeader` renders "Section N: <title>" as one heading, so the title
    // is matched as part of that line rather than on its own.
    expect(screen.getByText(/Pop-Ups \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/News Posts \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Portal Notices \(0\)/)).toBeInTheDocument();
  });

  it("says when a section has nothing in it yet", () => {
    render(<PortalNewsEditor />);

    expect(screen.getByText(/No portal notices yet/)).toBeInTheDocument();
  });

  it("counts the characters against the caps the tool enforces", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(
      screen.getByRole("button", { name: /^Spring enrollment/ }),
    );

    // "Spring enrollment" is 17 characters, and the body is 18.
    expect(screen.getByText("17/80")).toBeInTheDocument();
    expect(screen.getByText("18/300")).toBeInTheDocument();
    // The inputs refuse more than the counter allows.
    expect(screen.getByDisplayValue("Spring enrollment")).toHaveAttribute(
      "maxlength",
      "80",
    );
  });

  it("opens the full editor, so every property of a type can be changed", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(
      screen.getByRole("button", { name: /^Spring enrollment/ }),
    );
    await user.click(screen.getByRole("button", { name: "Edit all fields" }));

    // The row is handed to the Marketing tool's own modal, which owns the
    // colours, images, dates and targeting the four inline fields do not.
    expect(creator()).toHaveAttribute("data-editing-id", "pop-1");
    expect(creator()).toHaveAttribute("data-asset-type", "pop-up");
  });

  it("offers the same full editor from the header, without opening the row", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(
      screen.getByRole("button", {
        name: "Edit all fields for Spring enrollment",
      }),
    );

    expect(creator()).toHaveAttribute("data-editing-id", "pop-1");
    expect(screen.queryByDisplayValue("Spring enrollment")).toBeNull();
  });

  it("shows each row's window on its header", () => {
    swr.state.data = {
      data: [
        {
          id: "pop-1",
          type: "pop-up",
          status: "Published",
          headline: "Spring enrollment",
          body: "Enrolment is open.",
          ctaText: "Enroll",
          startDate: "2026-03-01",
          endDate: "2026-03-31",
        },
      ],
    };
    render(<PortalNewsEditor />);

    // Both ends, in the panel's own compact form.
    expect(screen.getByText("Mar 1 – Mar 31")).toBeInTheDocument();
  });

  it("paints each status chip in the publishing colours", () => {
    render(<PortalNewsEditor />);

    // The same map the Marketing tool's asset list uses. Two rows are published
    // here — the pop-up and the news post — so both chips are checked.
    const published = screen.getAllByText("Published");
    expect(published).toHaveLength(2);
    for (const chip of published) {
      expect(chip.className).toContain("bg-green-50");
      expect(chip.className).toContain("text-green-700");
    }

    expect(screen.getByText("Draft").className).toContain("bg-gray-100");
  });

  it("keeps each asset collapsed until it is opened", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    // Collapsed: the fields are not rendered at all.
    expect(screen.queryByDisplayValue("Spring enrollment")).toBeNull();

    // Anchored: the header also carries a "Delete Spring enrollment" button.
    await user.click(
      screen.getByRole("button", { name: /^Spring enrollment/ }),
    );

    expect(screen.getByDisplayValue("Spring enrollment")).toBeInTheDocument();
    // Its sibling in the same section stays shut.
    expect(screen.queryByDisplayValue("Summer hours")).toBeNull();
  });
});

/**
 * Deleting is the one action on this panel that is NOT a draft: the row stops
 * existing in the API, so it leaves the list and its draft goes with it. Both
 * entry points — the header and the end of the fields — open one confirmation.
 */
/** Section 6: the plan's meetings, so the one just scheduled has a home. */
describe("PortalNewsEditor — meetings section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swr.state.data = { data: [] };
    meetings.state.data = { data: [] };
  });

  it("says when the plan has no meetings", () => {
    render(<PortalNewsEditor />);

    expect(screen.getByText(/Meetings \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/No meetings yet/)).toBeInTheDocument();
  });

  function oneMeeting() {
    meetings.state.data = {
      data: [
        {
          id: "meeting-1",
          meeting: "Open Enrollment",
          meetingType: "Open Enrollment",
          date: "2026-03-03",
          time: "09:00",
          endTime: "10:00",
          duration: "1 hour",
          status: "Upcoming",
          format: "Virtual",
          platform: "Zoom",
          language: "English",
          description: "Bring your questions.",
        },
      ],
    };
  }

  it("lists each meeting as an accordion, with its day and status on the header", () => {
    oneMeeting();
    render(<PortalNewsEditor />);

    expect(screen.getByText(/Meetings \(1\)/)).toBeInTheDocument();
    // 2026-03-03 is a Tuesday; the day is read as a local calendar day.
    expect(screen.getByText(/Tue, Mar 3/)).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    // Collapsed: the properties are not rendered until the row is opened.
    expect(screen.queryByText("1 hour")).toBeNull();
  });

  it("opens a meeting's properties", async () => {
    oneMeeting();
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    // Anchored: the header also carries "Edit Open Enrollment" and
    // "Delete Open Enrollment".
    await user.click(
      screen.getByRole("button", { name: /^Open Enrollment/ }),
    );

    expect(screen.getByText("9:00am")).toBeInTheDocument();
    expect(screen.getByText("1 hour")).toBeInTheDocument();
    expect(screen.getByText("Zoom")).toBeInTheDocument();
    expect(screen.getByText("Bring your questions.")).toBeInTheDocument();
  });

  it("edits a meeting from its header", async () => {
    oneMeeting();
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(
      screen.getByRole("button", { name: "Edit Open Enrollment" }),
    );

    expect(screen.getByTestId("meeting-create-dialog")).toHaveAttribute(
      "data-editing-id",
      "meeting-1",
    );
  });

  it("spins on the row while its delete is in flight", async () => {
    let release: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      ),
    );
    oneMeeting();
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(
      screen.getByRole("button", { name: "Delete Open Enrollment" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // The confirmation has closed; the row is still there until the API answers.
    expect(
      screen.getByRole("status", { name: "Deleting…" }),
    ).toBeInTheDocument();

    release({ ok: true, json: async () => ({}) });
    await waitFor(() =>
      expect(
        screen.queryByRole("status", { name: "Deleting…" }),
      ).toBeNull(),
    );
    vi.unstubAllGlobals();
  });

  it("deletes a meeting after asking", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    oneMeeting();
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(
      screen.getByRole("button", { name: "Delete Open Enrollment" }),
    );
    expect(screen.getByText("Delete this meeting?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/meetings/meeting-1", {
        method: "DELETE",
      }),
    );
    vi.unstubAllGlobals();
  });
});

describe("PortalNewsEditor — deleting an asset", () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true }),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    swr.state.data = {
      data: [
        {
          id: "pop-1",
          type: "pop-up",
          status: "Published",
          headline: "Spring enrollment",
          body: "Enrolment is open.",
          ctaText: "Enroll",
        },
      ],
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("puts a delete control on the accordion header", () => {
    render(<PortalNewsEditor />);

    expect(
      screen.getByRole("button", { name: "Delete Spring enrollment" }),
    ).toBeInTheDocument();
  });

  it("asks first, without opening the row", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(
      screen.getByRole("button", { name: "Delete Spring enrollment" }),
    );

    expect(screen.getByText("Delete this asset?")).toBeInTheDocument();
    // The click did not toggle the accordion it sits beside.
    expect(screen.queryByDisplayValue("Spring enrollment")).toBeNull();
  });

  it("deletes on confirm and re-reads the list", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(
      screen.getByRole("button", { name: "Delete Spring enrollment" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/marketing/assets/pop-1", {
        method: "DELETE",
      }),
    );
    // Both caches: the panel's list and the portal's public copies.
    await waitFor(() => expect(swr.state.mutate).toHaveBeenCalled());
  });

  it("offers the same delete at the end of the fields", async () => {
    const user = userEvent.setup();
    render(<PortalNewsEditor />);

    await user.click(
      screen.getByRole("button", { name: /^Spring enrollment/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Delete this asset" }),
    );

    expect(screen.getByText("Delete this asset?")).toBeInTheDocument();
  });
});
