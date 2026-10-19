import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useWebinarHoverPreview,
  type HoverPreviewSubject,
} from "@/hooks/useWebinarHoverPreview";

const fetchMock = vi.fn();
let nextId = 0;

function uid(prefix = "w"): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function response(payload: any, ok = true) {
  return { ok, json: async () => payload };
}

function endpoint(subject: HoverPreviewSubject): string {
  return `/api/webinars/${subject.id}`;
}

async function waitForHover() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 280));
  });
}

function enter(result: { current: ReturnType<typeof useWebinarHoverPreview> }, subject: HoverPreviewSubject) {
  act(() => {
    result.current.getHoverProps(subject).onMouseEnter();
  });
}

function leave(result: { current: ReturnType<typeof useWebinarHoverPreview> }, subject: HoverPreviewSubject) {
  act(() => {
    result.current.getHoverProps(subject).onMouseLeave();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockResolvedValue(
    response({ success: true, data: { videoFileUrl: "BASE64" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWebinarHoverPreview", () => {
  it("publishes the hovered id immediately and previews an external URL", async () => {
    const id = uid();
    const id2 = uid();
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint }),
    );

    enter(result, { id: id2, videoUrl: "https://youtu.be/abcdefghijk" });
    expect(result.current.hoveredId).toBe(id2);

    await waitForHover();

    expect(result.current.previewFor(id2)).toMatchObject({
      videoUrl: "https://youtu.be/abcdefghijk",
      videoFileUrl: null,
      isLoading: false,
    });
    expect(result.current.previewFor(id)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("previews an in-hand base64 payload without fetching", async () => {
    const id = uid();
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint }),
    );

    enter(result, { id, videoFileUrl: "ALREADY" });
    await waitForHover();

    expect(result.current.previewFor(id)).toMatchObject({
      videoFileUrl: "ALREADY",
      isLoading: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores a subject with nothing to play", async () => {
    const id = uid();
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint }),
    );

    enter(result, { id });
    await waitForHover();

    expect(result.current.hoveredId).toBeNull();
    expect(result.current.previewFor(id)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits for hover intent and cancels on leave", async () => {
    const id = uid();
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint }),
    );

    enter(result, { id, videoUrl: "https://example.com/video.mp4" });
    act(() => {
      result.current.getHoverProps({ id }).onMouseLeave();
    });

    await waitForHover();

    expect(result.current.previewFor(id)).toBeNull();
    expect(result.current.hoveredId).toBeNull();
  });

  it("fetches, caches, and reports an uploaded payload", async () => {
    const id = uid("lazy");
    const onFilePayload = vi.fn();
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint, onFilePayload }),
    );

    enter(result, { id, hasVideoFile: true });
    await waitForHover();

    await waitFor(() =>
      expect(result.current.previewFor(id)).toMatchObject({
        videoFileUrl: "BASE64",
        isLoading: false,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(`/api/webinars/${id}`, {
      cache: "no-store",
    });
    expect(onFilePayload).toHaveBeenCalledWith(id, "BASE64");

    leave(result, { id, hasVideoFile: true });
    enter(result, { id, hasVideoFile: true });
    await waitForHover();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.previewFor(id)).toMatchObject({
      videoFileUrl: "BASE64",
    });
  });

  it("deduplicates an in-flight fetch across re-hovers", async () => {
    const id = uid("inflight");
    let resolveFetch: (value: any) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint }),
    );

    enter(result, { id, hasVideoFile: true });
    await waitForHover();
    expect(result.current.previewFor(id)).toMatchObject({ isLoading: true });

    leave(result, { id, hasVideoFile: true });
    enter(result, { id, hasVideoFile: true });
    await waitForHover();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(response({ success: true, data: { videoFileUrl: "SHARED" } }));
    });
    await waitFor(() =>
      expect(result.current.previewFor(id)).toMatchObject({
        videoFileUrl: "SHARED",
        isLoading: false,
      }),
    );
  });

  it("does not let a stale fetch replace a newer hover", async () => {
    const slowId = uid("slow");
    const fastId = uid("fast");
    let resolveSlow: (value: any) => void = () => {};
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith(slowId)) {
        return new Promise((resolve) => {
          resolveSlow = resolve;
        });
      }
      return Promise.resolve(response({ success: true }));
    });
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint }),
    );

    enter(result, { id: slowId, hasVideoFile: true });
    await waitForHover();

    enter(result, { id: fastId, videoUrl: "https://example.com/fast.mp4" });
    await waitForHover();
    expect(result.current.previewFor(fastId)?.videoUrl).toBe(
      "https://example.com/fast.mp4",
    );

    await act(async () => {
      resolveSlow(response({ success: true, data: { videoFileUrl: "SLOW" } }));
    });

    expect(result.current.previewFor(slowId)).toBeNull();
    expect(result.current.previewFor(fastId)?.videoUrl).toBe(
      "https://example.com/fast.mp4",
    );
  });

  it("clears the preview when suspended", async () => {
    const id = uid();
    const { result, rerender } = renderHook(
      ({ suspended }) =>
        useWebinarHoverPreview({ videoFileEndpoint: endpoint, suspended }),
      { initialProps: { suspended: false } },
    );

    enter(result, { id, videoUrl: "https://example.com/video.mp4" });
    await waitForHover();
    expect(result.current.previewFor(id)).not.toBeNull();

    rerender({ suspended: true });

    expect(result.current.previewFor(id)).toBeNull();
    expect(result.current.hoveredId).toBeNull();
  });

  it("does not arm the hover while suspended", async () => {
    const id = uid();
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint, suspended: true }),
    );

    enter(result, { id, videoUrl: "https://example.com/video.mp4" });
    await waitForHover();

    expect(result.current.hoveredId).toBeNull();
    expect(result.current.previewFor(id)).toBeNull();
  });

  it("swallows a hover-fetch failure", async () => {
    const id = uid("fail");
    fetchMock.mockResolvedValue(response({ success: false, error: "no" }, false));
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint }),
    );

    enter(result, { id, hasVideoFile: true });

    await waitFor(() => expect(console.error).toHaveBeenCalled(), {
      timeout: 2000,
    });
    expect(result.current.previewFor(id)).toBeNull();
  });

  it("preloads only uploaded payloads and skips duplicates", async () => {
    const uploadA = uid("pre");
    const uploadB = uid("pre");
    const urlRow = uid("pre");
    const emptyRow = uid("pre");
    const { result } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint }),
    );

    act(() => {
      result.current.preloadHoverPreviews([
        { id: uploadA, hasVideoFile: true },
        { id: uploadB, hasVideoFile: true },
        { id: urlRow, videoUrl: "https://youtu.be/abcdefghijk" },
        { id: emptyRow },
      ]);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), {
      timeout: 2000,
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/webinars/${uploadA}`, {
      cache: "no-store",
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/webinars/${uploadB}`, {
      cache: "no-store",
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/webinars/${urlRow}`,
      expect.anything(),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/webinars/${emptyRow}`,
      expect.anything(),
    );

    act(() => {
      result.current.preloadHoverPreviews([
        { id: uploadA, hasVideoFile: true },
        { id: uploadB, hasVideoFile: true },
      ]);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops a pending timer on unmount", async () => {
    const id = uid();
    const { result, unmount } = renderHook(() =>
      useWebinarHoverPreview({ videoFileEndpoint: endpoint }),
    );

    enter(result, { id, videoUrl: "https://example.com/video.mp4" });
    unmount();

    await waitForHover();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
