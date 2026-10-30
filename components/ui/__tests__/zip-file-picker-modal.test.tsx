import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ZipFilePickerModal } from "@/components/ui/zip-file-picker-modal";
import type { LibraryAsset, LibraryKind } from "@/lib/profile-library";
import type { ExtractedFile } from "@/lib/zip-image-extract";

/**
 * The picker's read-only "other files in this .zip" accordion, its two
 * "keep this archive" buttons, and the library view's per-kind accordions.
 *
 * An image slot cannot upload a PDF and the documents section cannot upload a
 * logo, yet one archive often carries both. Instead of dropping the other kind
 * silently, the picker reports how many arrived and lists them as disabled
 * previews inside an accordion, so the advisor knows where they need to go —
 * and "Add all files" can keep both kinds at once, which is why the library
 * itself now has one accordion per kind.
 *
 * Pinned here:
 *
 *  - the archive accordion states the count, starts collapsed while there IS
 *    something selectable, and expands on click;
 *  - its entries are inert — the disabled group holds no buttons and sits
 *    outside the selectable grid, so the tiles above it still work;
 *  - an archive holding ONLY the other kind still opens on the ".zip" view with
 *    a "nothing for this section" message and the list already expanded;
 *  - the keep buttons name their kind ("Add all 3 Images to Library") and the
 *    "Files" variant stores images and documents in one go;
 *  - the library view lists an accordion per kind, and only the picker's own
 *    kind is selectable there.
 */

// The library is a network client. Both calls are replaced here: one test needs
// to see which kinds "Add all files" writes, the other what the two library
// accordions are fed.
const library = vi.hoisted(() => ({
  persistFilesToLibrary: vi.fn(),
  fetchLibraryAssets: vi.fn(),
}));

vi.mock("@/lib/profile-library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profile-library")>();
  return {
    ...actual,
    persistFilesToLibrary: library.persistFilesToLibrary,
    fetchLibraryAssets: library.fetchLibraryAssets,
  };
});

function extracted(overrides: Partial<ExtractedFile> = {}): ExtractedFile {
  const fileName = overrides.fileName ?? "logo.png";
  return {
    file: new File(["bytes"], fileName, { type: "application/octet-stream" }),
    fileName,
    width: 0,
    height: 0,
    size: 1024,
    ...overrides,
  };
}

function storedAsset(overrides: Partial<LibraryAsset> = {}): LibraryAsset {
  const fileName = overrides.fileName ?? "logo.png";
  return {
    id: `asset-${fileName}`,
    kind: "image",
    fileName,
    url: `/api/profile/library/asset-${fileName}`,
    contentType: "image/png",
    size: 2048,
    width: 512,
    height: 512,
    sourceZipName: "bundle.zip",
    createdAt: "2026-10-30T12:00:00.000Z",
    expiresAt: "2026-10-31T12:00:00.000Z",
    ...overrides,
  };
}

const image = extracted({ fileName: "logo.png", width: 512, height: 512 });
const secondImage = extracted({
  fileName: "mark.png",
  width: 256,
  height: 256,
});
const specSheet = extracted({ fileName: "spd.pdf" });
const summary = extracted({ fileName: "sbc.docx" });

type PickerProps = React.ComponentProps<typeof ZipFilePickerModal>;

function renderPicker(props: Partial<PickerProps> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <ZipFilePickerModal
      open
      files={[image]}
      libraryKind="image"
      // Radix warns when a dialog has neither a Description nor an
      // aria-describedby; every real caller passes a description.
      description="This .zip contains these files."
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...view, onSelect, onClose };
}

beforeEach(() => {
  library.persistFilesToLibrary.mockResolvedValue({
    stored: 3,
    skipped: 0,
    failed: false,
  });
  library.fetchLibraryAssets.mockResolvedValue([]);
});

describe("ZipFilePickerModal other-kind accordion", () => {
  it("lists the archive's documents read-only, collapsed until asked", async () => {
    renderPicker({ otherKindFiles: [specSheet, summary] });

    const toggle = screen.getByRole("button", {
      name: /2 Documents are present in this \.zip/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("spd.pdf")).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const group = screen.getByRole("group", {
      name: /Documents in this \.zip \(not selectable here\)/i,
    });
    expect(within(group).getByText("spd.pdf")).toBeInTheDocument();
    expect(within(group).getByText("sbc.docx")).toBeInTheDocument();
    // Each preview still carries its own size, even though it cannot be picked.
    expect(within(group).getAllByText("1 KB")).toHaveLength(2);
  });

  it("makes the other kind inert while the archive's own images stay selectable", async () => {
    const { onSelect } = renderPicker({ otherKindFiles: [specSheet] });

    await userEvent.click(
      screen.getByRole("button", { name: /1 Document is present/i }),
    );
    const group = screen.getByRole("group", {
      name: /Document in this \.zip/i,
    });
    // Previews only: no button, so nothing inside can be picked or focused.
    expect(within(group).queryAllByRole("button")).toEqual([]);

    await userEvent.click(within(group).getByText("spd.pdf"));
    expect(onSelect).not.toHaveBeenCalled();

    // The image tile above the accordion still selects immediately.
    await userEvent.click(screen.getByRole("button", { name: /logo\.png/i }));
    expect(onSelect).toHaveBeenCalledWith([image]);
  });

  it("opens on the .zip view, list expanded, when the archive holds only documents", () => {
    renderPicker({ files: [], otherKindFiles: [specSheet], multiple: true });

    // The empty state names the kind this picker does take.
    expect(
      screen.getByText(/No images were found in this \.zip/i),
    ).toBeInTheDocument();
    // ...and the archive itself is still reachable: no need to hunt through tabs.
    expect(screen.getByRole("tab", { name: /This \.zip/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const toggle = screen.getByRole("button", {
      name: /1 Document is present in this \.zip/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("group", { name: /Document in this \.zip/i }),
    ).toBeInTheDocument();
  });
});

describe("ZipFilePickerModal keep-this-archive buttons", () => {
  it("names the kind it is about to keep", () => {
    renderPicker({ files: [image, secondImage] });
    expect(
      screen.getByRole("button", { name: "Add all 2 Images to Library" }),
    ).toBeInTheDocument();
  });

  it("says Documents in the documents picker", () => {
    renderPicker({
      files: [specSheet, summary],
      libraryKind: "document",
      multiple: true,
    });
    expect(
      screen.getByRole("button", { name: "Add all 2 Documents to Library" }),
    ).toBeInTheDocument();
    // Nothing of the other kind in this archive, so no "Files" variant.
    expect(
      screen.queryByRole("button", { name: /Files to Library/ }),
    ).toBeNull();
  });

  it("stores every file in the archive when the Files variant is used", async () => {
    renderPicker({
      files: [image, secondImage],
      otherKindFiles: [specSheet],
      multiple: true,
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Add all 3 Files to Library" }),
    );

    // One write per kind, each given the whole archive (the library client
    // filters by kind itself).
    expect(library.persistFilesToLibrary).toHaveBeenCalledTimes(2);
    const calls = library.persistFilesToLibrary.mock.calls.map(
      ([args]) => args as { kind: LibraryKind; files: ExtractedFile[] },
    );
    expect(calls.map((call) => call.kind).sort()).toEqual([
      "document",
      "image",
    ]);
    calls.forEach((call) => expect(call.files).toHaveLength(3));
  });
});

describe("ZipFilePickerModal library accordions", () => {
  beforeEach(() => {
    library.fetchLibraryAssets.mockImplementation(async (kind: LibraryKind) =>
      kind === "image"
        ? [storedAsset({ id: "i1", fileName: "logo.png" })]
        : [
            storedAsset({
              id: "d1",
              kind: "document",
              fileName: "spd.pdf",
              contentType: "application/pdf",
              width: 0,
              height: 0,
            }),
            storedAsset({
              id: "d2",
              kind: "document",
              fileName: "sbc.docx",
              contentType: "application/pdf",
              width: 0,
              height: 0,
            }),
          ],
    );
  });

  it("lists the stored images and documents in one accordion each", async () => {
    renderPicker({ files: [] });

    // The picker's own kind opens; the other kind is there to be found.
    const imagesToggle = await screen.findByRole("button", {
      name: /Images in your library \(1\)/i,
    });
    expect(imagesToggle).toHaveAttribute("aria-expanded", "true");
    const documentsToggle = screen.getByRole("button", {
      name: /Documents in your library \(2\).*not selectable here/i,
    });
    expect(documentsToggle).toHaveAttribute("aria-expanded", "false");

    // Images are pickable here...
    expect(
      screen.getByRole("button", { name: "Use logo.png" }),
    ).toBeInTheDocument();

    // ...documents are not, but they are still shown (and still deletable).
    await userEvent.click(documentsToggle);
    expect(screen.getByText("spd.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use spd.pdf" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove spd.pdf from your library" }),
    ).toBeInTheDocument();
  });

  it("keeps a Delete All per kind", async () => {
    renderPicker({ files: [] });

    await screen.findByRole("button", {
      name: /Images in your library \(1\)/i,
    });
    expect(
      screen.getByRole("button", { name: "Delete all images" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete all documents" }),
    ).toBeInTheDocument();
  });
});

describe("ZipFilePickerModal 20-file keep limit", () => {
  const manyImages = Array.from({ length: 21 }, (_, index) =>
    extracted({ fileName: `image-${index}.png` }),
  );

  it("states the limit beside the keep buttons", () => {
    renderPicker({ files: [image, secondImage] });
    expect(
      screen.getByText(/You can add up to 20 files at a time\./),
    ).toBeInTheDocument();
  });

  it("asks for a selection instead of keeping an oversized archive whole", () => {
    renderPicker({ files: manyImages });

    expect(
      screen.getByRole("button", { name: "Add all 21 Images to Library" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        /This \.zip holds more — select the files you want to keep\./,
      ),
    ).toBeInTheDocument();
  });

  it("refuses a 21st selection so one action never exceeds the cap", () => {
    renderPicker({ files: manyImages, multiple: true });

    // One role query for the whole grid: 21 `getByRole` lookups (each computing
    // accessible names across the dialog) would dominate the test. `fireEvent`
    // rather than `userEvent` for the same reason — no pointer simulation.
    const tiles = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.startsWith("image-"));
    expect(tiles).toHaveLength(21);

    tiles.forEach((tile) => fireEvent.click(tile));

    // Twenty picks stick; the twenty-first is dropped rather than queued.
    expect(screen.getByText("20 files selected")).toBeInTheDocument();
    // ...which also makes the whole-archive "Add all" reachable again, because
    // the target is now the 20 selected files.
    expect(
      screen.getByRole("button", { name: "Add 20 Images to Library" }),
    ).toBeEnabled();
  });
});
