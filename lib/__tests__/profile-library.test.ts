import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtractedFile } from "@/lib/zip-image-extract";

/**
 * The advisor's .zip library (`lib/profile-library`).
 *
 * Drag a .zip into an image or document slot once, pick what you want, and the
 * archive's files stay on the profile so the next slot can offer them without
 * the archive being dragged in again. These tests pin the behaviour the
 * uploaders rely on: kind routing, a single request per "add" capped at 20 files
 * (an oversized set is refused, never split behind the advisor's back),
 * de-duplication (re-dropping the same archive must stay harmless) and the
 * asset → picker conversion that lets "from the library" share the .zip path.
 *
 * The module keeps a session-level de-dupe set, so each test re-imports a fresh
 * instance.
 */

type LibraryModule = typeof import("@/lib/profile-library");

let lib: LibraryModule;
let fetchMock: ReturnType<typeof vi.fn>;

function entry(
  fileName: string,
  size = 128,
  type = "image/png",
): ExtractedFile {
  return {
    file: new File([new Uint8Array(size)], fileName, { type }),
    fileName,
    width: 40,
    height: 30,
    size,
  };
}

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response;
}

beforeEach(async () => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  lib = await import("@/lib/profile-library");
});

describe("libraryKindForFileName", () => {
  it("routes images and documents to their pickers", () => {
    expect(lib.libraryKindForFileName("logo.PNG")).toBe("image");
    expect(lib.libraryKindForFileName("photo.jpeg")).toBe("image");
    expect(lib.libraryKindForFileName("art.webp")).toBe("image");
    expect(lib.libraryKindForFileName("mark.svg")).toBe("image");
    expect(lib.libraryKindForFileName("bag.gif")).toBe("image");
    expect(lib.libraryKindForFileName("spd.pdf")).toBe("document");
    expect(lib.libraryKindForFileName("summary.docx")).toBe("document");
    expect(lib.libraryKindForFileName("legacy.doc")).toBe("document");
  });

  it("rejects anything neither picker handles", () => {
    expect(lib.libraryKindForFileName("notes.txt")).toBeNull();
    expect(lib.libraryKindForFileName("archive.zip")).toBeNull();
    expect(lib.libraryKindForFileName("no-extension")).toBeNull();
  });
});

describe("filesForLibraryKind", () => {
  it("keeps only the entries of the requested kind, in order", () => {
    const files = [
      entry("a.png"),
      entry("b.pdf", 64, "application/pdf"),
      entry("c.jpg"),
    ];
    expect(
      lib.filesForLibraryKind(files, "image").map((f) => f.fileName),
    ).toEqual(["a.png", "c.jpg"]);
    expect(
      lib.filesForLibraryKind(files, "document").map((f) => f.fileName),
    ).toEqual(["b.pdf"]);
  });
});

describe("persistFilesToLibrary", () => {
  it("posts only the matching files, with their measured dimensions", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ success: true, stored: 2, skipped: 1 }),
    );

    const result = await lib.persistFilesToLibrary({
      files: [
        entry("a.png"),
        entry("b.pdf", 64, "application/pdf"),
        entry("c.png"),
      ],
      kind: "image",
      sourceZipName: "brand-pack.zip",
    });

    expect(result).toEqual({ stored: 2, skipped: 1, failed: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/profile/library");
    expect(init.method).toBe("POST");

    const form = init.body as FormData;
    expect(form.get("kind")).toBe("image");
    expect(form.get("sourceZipName")).toBe("brand-pack.zip");
    expect(form.getAll("files")).toHaveLength(2);
    // Dimensions travel with the bytes so the server never has to decode them.
    expect(form.getAll("widths")).toEqual(["40", "40"]);
    expect(form.getAll("heights")).toEqual(["30", "30"]);
  });

  it("skips a file it has already stored in this session", async () => {
    fetchMock.mockResolvedValue(okJson({ success: true, stored: 1 }));

    await lib.persistFilesToLibrary({
      files: [entry("logo.png")],
      kind: "image",
    });
    const second = await lib.persistFilesToLibrary({
      files: [entry("logo.png")],
      kind: "image",
    });

    expect(second.stored).toBe(0);
    expect(second.failed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stores the full 20-file allowance in one request", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ success: true, stored: 20 }));

    const files = Array.from({ length: 20 }, (_, i) =>
      entry(`image-${i}.png`, 10 + i),
    );
    const result = await lib.persistFilesToLibrary({ files, kind: "image" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/profile/library");
    expect((init.body as FormData).getAll("files")).toHaveLength(20);
    expect(result).toEqual({ stored: 20, skipped: 0, failed: false });
  });

  it("refuses more than 20 files in one action instead of batching them", async () => {
    const files = Array.from({ length: 21 }, (_, i) =>
      entry(`image-${i}.png`, 10 + i),
    );
    const result = await lib.persistFilesToLibrary({ files, kind: "image" });

    // One action is one request: splitting it into two would store files the
    // advisor never agreed to in one click.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ stored: 0, skipped: 0, failed: true });

    // Nothing was remembered as stored, so a smaller selection still goes out.
    fetchMock.mockResolvedValueOnce(okJson({ success: true, stored: 1 }));
    const retry = await lib.persistFilesToLibrary({
      files: [files[0]],
      kind: "image",
    });
    expect(retry).toEqual({ stored: 1, skipped: 0, failed: false });
  });

  it("exports the per-action cap the pickers enforce", () => {
    expect(lib.MAX_FILES_PER_LIBRARY_ADD).toBe(20);
  });

  it("forgets a failed batch so a later attempt retries it", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "nope" }),
    } as unknown as Response);
    const first = await lib.persistFilesToLibrary({
      files: [entry("logo.png")],
      kind: "image",
    });
    expect(first.stored).toBe(0);
    expect(first.failed).toBe(true);

    fetchMock.mockResolvedValueOnce(okJson({ success: true, stored: 1 }));
    const retry = await lib.persistFilesToLibrary({
      files: [entry("logo.png")],
      kind: "image",
    });

    expect(retry.stored).toBe(1);
    expect(retry.failed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never throws when the network is down", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const result = await lib.persistFilesToLibrary({
      files: [entry("logo.png")],
      kind: "image",
    });
    expect(result).toEqual({ stored: 0, skipped: 0, failed: true });
  });

  it("does nothing when no file belongs to the kind", async () => {
    const result = await lib.persistFilesToLibrary({
      files: [entry("spd.pdf", 64, "application/pdf")],
      kind: "image",
    });
    expect(result).toEqual({ stored: 0, skipped: 0, failed: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchLibraryAssets", () => {
  it("requests the kind and returns the stored assets", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        assets: [
          {
            id: "a1",
            kind: "image",
            fileName: "logo.png",
            url: "/api/r2/signed-url?key=x&redirect=1",
            contentType: "image/png",
            size: 100,
            width: 40,
            height: 30,
            sourceZipName: "brand.zip",
            createdAt: "2026-10-30T00:00:00.000Z",
          },
        ],
      }),
    );

    const assets = await lib.fetchLibraryAssets("image");

    expect(fetchMock).toHaveBeenCalledWith("/api/profile/library?kind=image", {
      cache: "no-store",
    });
    expect(assets).toHaveLength(1);
    expect(assets[0].fileName).toBe("logo.png");
  });

  it("seeds the de-dupe set so the same file is not re-uploaded", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        assets: [
          {
            id: "a1",
            kind: "image",
            fileName: "logo.png",
            url: "/x",
            contentType: "image/png",
            size: 128,
            width: 0,
            height: 0,
            sourceZipName: null,
            createdAt: "2026-10-30T00:00:00.000Z",
          },
        ],
      }),
    );
    await lib.fetchLibraryAssets("image");

    const result = await lib.persistFilesToLibrary({
      files: [entry("logo.png")],
      kind: "image",
    });

    expect(result.stored).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns nothing on failure instead of throwing", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(lib.fetchLibraryAssets("document")).resolves.toEqual([]);
  });
});

describe("deleteLibraryAsset", () => {
  it("deletes by id and reports success", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);
    await expect(lib.deleteLibraryAsset("asset-1")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/library/asset-1", {
      method: "DELETE",
    });
  });

  it("reports failure without throwing", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(lib.deleteLibraryAsset("asset-1")).resolves.toBe(false);
  });
});

describe("deleteAllLibraryAssets", () => {
  it("clears one kind in a single request", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);
    await expect(lib.deleteAllLibraryAssets("document")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile/library?kind=document",
      { method: "DELETE" },
    );
  });

  it("reports failure without throwing", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(lib.deleteAllLibraryAssets("image")).resolves.toBe(false);
  });

  it("forgets the availability answer so the buttons hide", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        assets: [
          {
            id: "a1",
            kind: "image",
            fileName: "logo.png",
            url: "/x",
            contentType: "image/png",
            size: 10,
            width: 0,
            height: 0,
            sourceZipName: null,
            createdAt: "2026-10-30T00:00:00.000Z",
            expiresAt: "2026-10-31T00:00:00.000Z",
          },
        ],
      }),
    );
    await expect(lib.libraryHasAssets("image")).resolves.toBe(true);

    fetchMock.mockResolvedValueOnce({ ok: true } as Response);
    await lib.deleteAllLibraryAssets("image");

    // A fresh question: the cached "true" is gone, so the answer comes from the
    // server and the "Choose from Library" button can disappear.
    fetchMock.mockResolvedValueOnce(okJson({ assets: [] }));
    await expect(lib.libraryHasAssets("image")).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("libraryHasAssets", () => {
  const asset = {
    id: "a1",
    kind: "image",
    fileName: "logo.png",
    url: "/x",
    contentType: "image/png",
    size: 10,
    width: 0,
    height: 0,
    sourceZipName: null,
    createdAt: "2026-10-30T00:00:00.000Z",
    expiresAt: "2026-10-31T00:00:00.000Z",
  };

  it("is true when the library lists files, and is cached for the page", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ assets: [asset] }));

    await expect(lib.libraryHasAssets("image")).resolves.toBe(true);
    // Second ask is answered from the cache — a form with several image slots
    // must not fire one request per slot.
    await expect(lib.libraryHasAssets("image")).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is false for an empty library", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ assets: [] }));
    await expect(lib.libraryHasAssets("document")).resolves.toBe(false);
  });

  it("re-asks the server when forced or invalidated", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ assets: [] }));
    await expect(lib.libraryHasAssets("image")).resolves.toBe(false);

    fetchMock.mockResolvedValueOnce(okJson({ assets: [asset] }));
    await expect(lib.libraryHasAssets("image", { force: true })).resolves.toBe(
      true,
    );

    lib.invalidateLibraryAvailability();
    fetchMock.mockResolvedValueOnce(okJson({ assets: [] }));
    await expect(lib.libraryHasAssets("image")).resolves.toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("becomes true as soon as something is added", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ stored: 1, skipped: 0 }));
    await lib.persistFilesToLibrary({
      files: [entry("logo.png")],
      kind: "image",
    });

    // No second request: the add itself told the cache.
    await expect(lib.libraryHasAssets("image")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("broadcasts a change so every uploader can refresh", async () => {
    const listener = vi.fn();
    window.addEventListener(lib.PROFILE_LIBRARY_CHANGED_EVENT, listener);

    fetchMock.mockResolvedValueOnce(okJson({ stored: 1, skipped: 0 }));
    await lib.persistFilesToLibrary({
      files: [entry("logo.png")],
      kind: "image",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(lib.PROFILE_LIBRARY_CHANGED_EVENT, listener);
  });

  it("stays false when the add fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await lib.persistFilesToLibrary({
      files: [entry("logo.png")],
      kind: "image",
    });

    fetchMock.mockResolvedValueOnce(okJson({ assets: [] }));
    await expect(lib.libraryHasAssets("image")).resolves.toBe(false);
  });
});

describe("libraryAssetToExtractedFile", () => {
  const base = {
    id: "a1",
    url: "/api/r2/signed-url?key=x&redirect=1",
    contentType: "image/png",
    size: 4,
    width: 120,
    height: 80,
    sourceZipName: "brand.zip",
    createdAt: "2026-10-30T00:00:00.000Z",
    expiresAt: "2026-10-31T00:00:00.000Z",
  };

  it("downloads the bytes into a File and keeps the thumbnail URL", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([new Uint8Array(4)], { type: "image/png" }),
    } as unknown as Response);

    const file = await lib.libraryAssetToExtractedFile({
      ...base,
      kind: "image",
      fileName: "logo.png",
    });

    expect(file).not.toBeNull();
    expect(file!.fileName).toBe("logo.png");
    expect(file!.file.size).toBe(4);
    expect(file!.width).toBe(120);
    expect(file!.height).toBe(80);
    expect(file!.previewUrl).toBe(base.url);
  });

  it("omits the thumbnail for documents", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: async () =>
        new Blob([new Uint8Array(4)], { type: "application/pdf" }),
    } as unknown as Response);

    const file = await lib.libraryAssetToExtractedFile({
      ...base,
      kind: "document",
      fileName: "spd.pdf",
      contentType: "application/pdf",
    });

    expect(file!.previewUrl).toBeUndefined();
  });

  it("returns null when the bytes cannot be fetched", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false } as Response);
    await expect(
      lib.libraryAssetToExtractedFile({
        ...base,
        kind: "image",
        fileName: "logo.png",
      }),
    ).resolves.toBeNull();
  });
});
