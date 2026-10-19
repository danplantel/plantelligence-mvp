import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSaveMeetingDebugStore } from "@/lib/meetings/meeting-debug-store";
import { useMeetingStore } from "@/lib/meetings/meeting-store";

const fetchMock = vi.fn();

function response(payload: any, ok = true) {
  return { ok, json: async () => payload };
}

function resetStores() {
  useSaveMeetingDebugStore.setState({
    savedMeetings: [],
    deletedMeeting: undefined,
  });
  useMeetingStore.setState({ customMeetings: [], deletedMeeting: undefined });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStores();
  vi.stubGlobal("fetch", fetchMock);
});

describe("saveCustomMeeting", () => {
  it("appends a new custom type", () => {
    const meeting = {
      value: "Fireside",
      label: "Fireside",
      description: "A chat",
    };

    useSaveMeetingDebugStore.getState().saveCustomMeeting(meeting);

    expect(useSaveMeetingDebugStore.getState().savedMeetings).toEqual([meeting]);
  });

  it("ignores an exact duplicate", () => {
    const meeting = {
      value: "Fireside",
      label: "Fireside",
      description: "A chat",
    };
    useSaveMeetingDebugStore.setState({ savedMeetings: [meeting] });

    useSaveMeetingDebugStore.getState().saveCustomMeeting({ ...meeting });

    expect(useSaveMeetingDebugStore.getState().savedMeetings).toEqual([meeting]);
  });

  it("ignores a built-in meeting type", () => {
    useSaveMeetingDebugStore.getState().saveCustomMeeting({
      value: "Open Enrollment",
      label: "Open Enrollment",
      description:
        "Learn about upcoming plan options, updates, and key dates so you can make informed choices for the year ahead.",
    });

    expect(useSaveMeetingDebugStore.getState().savedMeetings).toEqual([]);
  });
});

describe("deleteMeeting and clearSaved", () => {
  const meeting = { value: "Fireside", label: "Fireside", description: "" };

  it("removes the type and records it as deleted", () => {
    useSaveMeetingDebugStore.setState({ savedMeetings: [meeting] });

    useSaveMeetingDebugStore.getState().deleteMeeting(meeting);

    expect(useSaveMeetingDebugStore.getState().savedMeetings).toEqual([]);
    expect(useSaveMeetingDebugStore.getState().deletedMeeting).toEqual(meeting);
  });

  it("clears the saved list and deleted marker", () => {
    useSaveMeetingDebugStore.setState({
      savedMeetings: [meeting],
      deletedMeeting: meeting,
    });

    useSaveMeetingDebugStore.getState().clearSaved();

    expect(useSaveMeetingDebugStore.getState().savedMeetings).toEqual([]);
    expect(useSaveMeetingDebugStore.getState().deletedMeeting).toBeUndefined();
  });
});

describe("rebaseCustomMeeting", () => {
  const saved = { value: "Fireside", label: "Fireside", description: "" };
  const existing = { value: "Existing", label: "Existing", description: "" };

  function mockRebase(result: (body: any) => any) {
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/auth/session") {
        return response({ user: { id: "user-1" } });
      }
      if (url === "/api/user/user-1/custom-meetings" && init?.method === "PUT") {
        return result(JSON.parse(init.body));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
  }

  it("merges saved types into the meeting store and clears the saved list", async () => {
    useSaveMeetingDebugStore.setState({ savedMeetings: [saved] });
    useMeetingStore.setState({ customMeetings: [existing] });
    mockRebase((body) =>
      response({ success: true, data: body.customMeetings }),
    );

    await useSaveMeetingDebugStore.getState().rebaseCustomMeeting();

    expect(useMeetingStore.getState().customMeetings).toEqual([existing, saved]);
    expect(useSaveMeetingDebugStore.getState().savedMeetings).toEqual([]);
  });

  it("restores the meeting store and keeps the saved list on failure", async () => {
    useSaveMeetingDebugStore.setState({ savedMeetings: [saved] });
    useMeetingStore.setState({ customMeetings: [existing] });
    mockRebase(() => response({ success: false }));

    await useSaveMeetingDebugStore.getState().rebaseCustomMeeting();

    expect(useMeetingStore.getState().customMeetings).toEqual([existing]);
    expect(useSaveMeetingDebugStore.getState().savedMeetings).toEqual([saved]);
  });

  it("restores state when the PUT throws", async () => {
    useSaveMeetingDebugStore.setState({ savedMeetings: [saved] });
    useMeetingStore.setState({ customMeetings: [existing] });
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/auth/session") {
        return response({ user: { id: "user-1" } });
      }
      throw new Error("offline");
    });

    await useSaveMeetingDebugStore.getState().rebaseCustomMeeting();

    expect(useMeetingStore.getState().customMeetings).toEqual([existing]);
    expect(useSaveMeetingDebugStore.getState().savedMeetings).toEqual([saved]);
  });
});
