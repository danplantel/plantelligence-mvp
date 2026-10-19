import { beforeEach, describe, expect, it, vi } from "vitest";

import { MEETING_TYPES, useMeetingStore } from "@/lib/meetings/meeting-store";

const fetchMock = vi.fn();

function response(payload: any, ok = true) {
  return { ok, json: async () => payload };
}

function resetStore() {
  useMeetingStore.setState({ customMeetings: [], deletedMeeting: undefined });
  localStorage.clear();
}

function mockSequence(handlers: {
  custom?: (init?: any) => any;
  put?: (body: any) => any;
  delete?: (body: any) => any;
}) {
  fetchMock.mockImplementation(async (url: string, init?: any) => {
    if (url === "/api/auth/session") {
      return response({ user: { id: "user-1" } });
    }
    if (url === "/api/user/user-1/custom-meetings") {
      const body = init?.body ? JSON.parse(init.body) : undefined;
      if (init?.method === "PUT") {
        return handlers.put ? handlers.put(body) : response({ success: true, data: body.customMeetings });
      }
      if (init?.method === "DELETE") {
        return handlers.delete ? handlers.delete(body) : response({ success: true });
      }
      return handlers.custom ? handlers.custom(init) : response({ success: true, data: [] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  vi.stubGlobal("fetch", fetchMock);
});

describe("fetchCustomMeetings", () => {
  it("stores the saved custom meetings", async () => {
    const saved = [
      { value: "Open Enrollment", label: "Open Enrollment", description: "A" },
    ];
    mockSequence({ custom: () => response({ success: true, data: saved }) });

    await useMeetingStore.getState().fetchCustomMeetings();

    expect(useMeetingStore.getState().customMeetings).toEqual(saved);
  });

  it("seeds the defaults when the user has none", async () => {
    mockSequence({ custom: () => response({ success: true, data: [] }) });

    await useMeetingStore.getState().fetchCustomMeetings();

    const state = useMeetingStore.getState().customMeetings;
    expect(state).toHaveLength(MEETING_TYPES.length + 1);
    expect(state.map((t) => t.value)).toEqual([
      ...MEETING_TYPES.map((t) => t.value),
      "Custom",
    ]);
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(put![1].body)).toMatchObject({ customMeetings: state });
  });

  it("falls back to localStorage when the request fails", async () => {
    const stored = [
      { value: "Stored", label: "Stored", description: "From storage" },
    ];
    localStorage.setItem("customMeetings", JSON.stringify(stored));
    fetchMock.mockRejectedValue(new Error("offline"));

    await useMeetingStore.getState().fetchCustomMeetings();

    expect(useMeetingStore.getState().customMeetings).toEqual(stored);
  });

  it("leaves the store empty when the request fails and there is no fallback", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await useMeetingStore.getState().fetchCustomMeetings();

    expect(useMeetingStore.getState().customMeetings).toEqual([]);
  });
});

describe("addCustomMeeting", () => {
  const meeting = {
    value: "Fireside",
    label: "Fireside",
    description: "A chat",
  };

  it("adds the type and stores the server response", async () => {
    mockSequence({
      custom: () =>
        response({ success: true, data: [{ value: "Existing", label: "Existing", description: "" }] }),
      put: (body) => response({ success: true, data: body.customMeetings }),
    });

    await useMeetingStore.getState().addCustomMeeting(meeting);

    expect(useMeetingStore.getState().customMeetings).toEqual([
      { value: "Existing", label: "Existing", description: "" },
      meeting,
    ]);
    expect(localStorage.getItem("customMeetings")).toContain("Fireside");
  });

  it("rolls back when the save is rejected", async () => {
    useMeetingStore.setState({
      customMeetings: [{ value: "Existing", label: "Existing", description: "" }],
    });
    mockSequence({
      custom: () => response({ success: true, data: [] }),
      put: () => response({ success: false }),
    });

    await useMeetingStore.getState().addCustomMeeting(meeting);

    expect(useMeetingStore.getState().customMeetings).toEqual([
      { value: "Existing", label: "Existing", description: "" },
    ]);
  });

  it("rolls back when the request throws", async () => {
    useMeetingStore.setState({
      customMeetings: [{ value: "Existing", label: "Existing", description: "" }],
    });
    fetchMock.mockRejectedValue(new Error("offline"));

    await useMeetingStore.getState().addCustomMeeting(meeting);

    expect(useMeetingStore.getState().customMeetings).toEqual([
      { value: "Existing", label: "Existing", description: "" },
    ]);
  });
});

describe("deleteCustomMeeting", () => {
  const existing = { id: "ct-1", value: "Custom", label: "Custom", description: "" };

  it("does nothing when the type is unknown", async () => {
    useMeetingStore.setState({ customMeetings: [existing] });

    await useMeetingStore.getState().deleteCustomMeeting("missing");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useMeetingStore.getState().customMeetings).toEqual([existing]);
  });

  it("removes the type and records it as deleted", async () => {
    useMeetingStore.setState({ customMeetings: [existing] });
    mockSequence({ delete: () => response({ success: true }) });

    await useMeetingStore.getState().deleteCustomMeeting("ct-1");

    expect(useMeetingStore.getState().customMeetings).toEqual([]);
    expect(useMeetingStore.getState().deletedMeeting).toEqual(existing);
  });

  it("restores the type when the delete is rejected", async () => {
    useMeetingStore.setState({ customMeetings: [existing] });
    mockSequence({ delete: () => response({ success: false, error: "no" }) });

    await useMeetingStore.getState().deleteCustomMeeting("ct-1");

    expect(useMeetingStore.getState().customMeetings).toEqual([existing]);
    expect(useMeetingStore.getState().deletedMeeting).toBeUndefined();
  });
});

describe("resetToDefaultMeetings", () => {
  it("stores the defaults returned by the server", async () => {
    const existing = { value: "Existing", label: "Existing", description: "" };
    useMeetingStore.setState({ customMeetings: [existing] });
    const server = [{ value: "Server", label: "Server", description: "" }];
    mockSequence({ put: () => response({ success: true, data: server }) });

    await useMeetingStore.getState().resetToDefaultMeetings();

    expect(useMeetingStore.getState().customMeetings).toEqual(server);
  });

  it("restores the previous list when the reset fails", async () => {
    const existing = { value: "Existing", label: "Existing", description: "" };
    useMeetingStore.setState({ customMeetings: [existing] });
    mockSequence({ put: () => response({ success: false }) });

    await useMeetingStore.getState().resetToDefaultMeetings();

    expect(useMeetingStore.getState().customMeetings).toEqual([existing]);
  });
});
