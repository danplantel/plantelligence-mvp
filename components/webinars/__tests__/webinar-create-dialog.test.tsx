import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The webinar creator the portal's News & Events panel (and, in time, the
 * Webinars page) hosts.
 *
 * It carries the Webinars page's property set — title, description, category,
 * placements, event date, source (upload or URL) and a thumbnail — and validates
 * the same way: nothing is posted until the required pieces are there.
 */

import { WebinarCreateDialog } from "../webinar-create-dialog";

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ success: true }),
}));

describe("WebinarCreateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  function renderDialog() {
    return render(
      <WebinarCreateDialog
        open
        onOpenChange={() => {}}
        planId="db-plan-1"
        planName="Acme Corp"
      />,
    );
  }

  it("offers every property the Webinars page collects", () => {
    renderDialog();

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByText("Benefit category")).toBeInTheDocument();
    expect(screen.getByText("Where this video will live")).toBeInTheDocument();
    expect(screen.getByLabelText("Event date")).toBeInTheDocument();
    expect(screen.getByText("Video source")).toBeInTheDocument();
    expect(screen.getByText("Thumbnail")).toBeInTheDocument();
    // News & Events is the default placement; the benefits pages are opt-in.
    expect(
      screen.getByRole("checkbox", { name: /News & Events/ }),
    ).toBeChecked();
  });

  it("will not post a webinar with nothing in it", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Add video" }));

    expect(
      screen.getByText(/This webinar still needs a title, an event date/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts the title against its cap", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Title"), "Spring");

    expect(screen.getByText("6/60")).toBeInTheDocument();
  });
});
