import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useNewsPostAssets,
  usePortalNoticeAssets,
  usePopUpAssets,
} from "@/hooks/useMarketingAssets";

const mocks = vi.hoisted(() => ({
  key: null as string | null,
  options: null as any,
  data: undefined as any,
  error: null as any,
  isLoading: false,
}));

vi.mock("swr", () => ({
  default: (key: string | null, _fetcher: unknown, options: any) => {
    mocks.key = key;
    mocks.options = options;
    return {
      data: mocks.data,
      error: mocks.error,
      isLoading: mocks.isLoading,
    };
  },
}));

beforeEach(() => {
  mocks.key = null;
  mocks.options = null;
  mocks.data = undefined;
  mocks.error = null;
  mocks.isLoading = false;
});

describe("useNewsPostAssets", () => {
  it("does not request anything without a client id", () => {
    const { result } = renderHook(() => useNewsPostAssets());

    expect(mocks.key).toBeNull();
    expect(result.current.assets).toEqual([]);
  });

  it("requests the public news-post feed for the client", () => {
    renderHook(() => useNewsPostAssets("plan-1"));

    expect(mocks.key).toBe(
      "/api/marketing/assets/public?clientId=plan-1&type=news-post",
    );
    expect(mocks.options).toMatchObject({
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
    });
  });

  it("returns the payload's data array", () => {
    mocks.data = { data: [{ id: "post-1" }] };
    const { result } = renderHook(() => useNewsPostAssets("plan-1"));

    expect(result.current.assets).toEqual([{ id: "post-1" }]);
  });

  it("returns an empty array when the payload has no data", () => {
    mocks.data = { data: null };
    const { result } = renderHook(() => useNewsPostAssets("plan-1"));

    expect(result.current.assets).toEqual([]);
  });

  it("passes the error and loading flags through", () => {
    const error = new Error("offline");
    mocks.error = error;
    mocks.isLoading = true;
    const { result } = renderHook(() => useNewsPostAssets("plan-1"));

    expect(result.current.error).toBe(error);
    expect(result.current.isLoading).toBe(true);
  });
});

describe("marketing asset type filters", () => {
  it("queries pop-up assets", () => {
    renderHook(() => usePopUpAssets("plan-1"));

    expect(mocks.key).toBe(
      "/api/marketing/assets/public?clientId=plan-1&type=pop-up",
    );
  });

  it("queries portal-notice assets", () => {
    renderHook(() => usePortalNoticeAssets("plan-1"));

    expect(mocks.key).toBe(
      "/api/marketing/assets/public?clientId=plan-1&type=portal-notice",
    );
  });
});
