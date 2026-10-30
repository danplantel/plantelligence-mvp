import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { extractZipContents, isZipFile } from "@/lib/zip-image-extract";

/**
 * `extractZipContents` reads an archive once for BOTH pickers.
 *
 * The image picker must be able to say "2 Documents are present in this .zip"
 * without treating them as the thing it was asked for, and the documents picker
 * the same in reverse. The two edge cases that matter are: an archive with only
 * one kind (the other list is simply empty, no error) and an archive with
 * neither (a single readable error).
 *
 * Image entries are exercised through the uploaders' own flows: extracting them
 * here would need `URL.createObjectURL` + a decoding `Image`, neither of which
 * jsdom provides.
 */

function buildZip(entries: Record<string, string>): File {
  const data = Object.fromEntries(
    Object.entries(entries).map(([name, body]) => [name, strToU8(body)]),
  );
  return new File([zipSync(data)], "bundle.zip", { type: "application/zip" });
}

describe("isZipFile", () => {
  it("recognises archives by extension or MIME type", () => {
    expect(isZipFile(new File([], "pack.zip"))).toBe(true);
    expect(isZipFile(new File([], "pack", { type: "application/zip" }))).toBe(
      true,
    );
    expect(isZipFile(new File([], "logo.png", { type: "image/png" }))).toBe(
      false,
    );
  });
});

describe("extractZipContents", () => {
  it("returns the documents and an empty image list", async () => {
    const zip = buildZip({
      "docs/spd.pdf": "pdf-bytes",
      "docs/sbc.DOCX": "docx-bytes",
      "readme.txt": "ignored",
    });

    const contents = await extractZipContents(zip);

    expect(contents.images).toEqual([]);
    expect(contents.documents.map((f) => f.fileName)).toEqual([
      "sbc.DOCX",
      "spd.pdf",
    ]);
    // Each entry is a real File the upload pipeline can take.
    const first = contents.documents[0];
    expect(first.file).toBeInstanceOf(File);
    expect(first.file.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(first.size).toBe("docx-bytes".length);
  });

  it("skips directories, hidden files and macOS resource forks", async () => {
    const zip = buildZip({
      "docs/": "",
      "docs/spd.pdf": "pdf-bytes",
      "__MACOSX/docs/._spd.pdf": "junk",
      "docs/.hidden.pdf": "junk",
    });

    const contents = await extractZipContents(zip);
    expect(contents.documents.map((f) => f.fileName)).toEqual(["spd.pdf"]);
  });

  it("throws one readable error when the archive holds neither kind", async () => {
    const zip = buildZip({ "notes.txt": "plain text" });
    await expect(extractZipContents(zip)).rejects.toThrow(
      "No images, PDFs or Word files were found in that .zip.",
    );
  });
});
