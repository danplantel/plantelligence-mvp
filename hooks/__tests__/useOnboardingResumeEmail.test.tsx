import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_RESUME_EMAIL_THROTTLE_MS } from "@/lib/desktop-only";

import { useOnboardingResumeEmail } from "../useOnboardingResumeEmail";

const session = vi.hoisted(() => ({
  value: { data: { user: { id: "user-1" } } } as {
    data: { user?: { id?: string } } | null;
  },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => session.value,
}));

const fetchMock = vi.fn();
const userId = "user-1";
const storageKey = `pt:onboarding-resume-email:${userId}`;

function jsonResponse(ok = true): Response {
  return { ok, json: async () => ({}) } as Response;
}

describe("useOnboardingResumeEmail", () => {
  beforeEach(() => {
    session.value = { data: { user: { id: userId } } };
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(true));
    vi.stubGlobal("fetch", fetchMock);
  });

  it("does nothing without a signed-in user", () => {
    session.value = { data: null };
    const { result } = renderHook(() => useOnboardingResumeEmail());

    act(() => result.current());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the resume-email request and records the send time", async () => {
    const { result } = renderHook(() => useOnboardingResumeEmail());

    act(() => result.current());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding-wizard/send-resume-email",
        { method: "POST" },
      ),
    );
    await waitFor(() =>
      expect(localStorage.getItem(storageKey)).not.toBeNull(),
    );
  });

  it("suppresses a second send inside the throttle window", () => {
    localStorage.setItem(storageKey, String(Date.now()));

    const { result } = renderHook(() => useOnboardingResumeEmail());
    act(() => result.current());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends again once the throttle window has passed", async () => {
    localStorage.setItem(
      storageKey,
      String(Date.now() - ONBOARDING_RESUME_EMAIL_THROTTLE_MS - 1),
    );

    const { result } = renderHook(() => useOnboardingResumeEmail());
    act(() => result.current());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("does not record a send when the response is not OK", async () => {
    fetchMock.mockResolvedValue(jsonResponse(false));

    const { result } = renderHook(() => useOnboardingResumeEmail());
    act(() => result.current());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("swallows a failed request", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useOnboardingResumeEmail());

    expect(() => act(() => result.current())).not.toThrow();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("sends even when reading localStorage throws", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    try {
      const { result } = renderHook(() => useOnboardingResumeEmail());
      act(() => result.current());

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    } finally {
      getItem.mockRestore();
    }
  });

  it("does not throw when writing localStorage fails", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    const { result } = renderHook(() => useOnboardingResumeEmail());

    expect(() => act(() => result.current())).not.toThrow();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("throttles per account", async () => {
    localStorage.setItem(storageKey, String(Date.now()));
    session.value = { data: { user: { id: "user-2" } } };

    const { result } = renderHook(() => useOnboardingResumeEmail());
    act(() => result.current());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
