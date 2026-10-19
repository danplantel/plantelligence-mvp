import { describe, expect, it } from "vitest";

import {
  compareDocumentsByCustomOrder,
  sortDocumentRowsByCustomOrder,
} from "@/lib/documents/document-sort";

const at = (value: string) => new Date(value);

describe("compareDocumentsByCustomOrder", () => {
  it("orders explicit sortOrder values ascending", () => {
    const rows = [
      { id: "c", sortOrder: 3, uploadedAt: at("2026-01-03T00:00:00Z") },
      { id: "a", sortOrder: 1, uploadedAt: at("2026-01-01T00:00:00Z") },
      { id: "b", sortOrder: 2, uploadedAt: at("2026-01-02T00:00:00Z") },
    ];

    expect(sortDocumentRowsByCustomOrder(rows).map((row) => row.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("puts untracked rows last", () => {
    const rows = [
      { id: "untracked", uploadedAt: at("2026-01-05T00:00:00Z") },
      { id: "ordered", sortOrder: 1, uploadedAt: at("2026-01-01T00:00:00Z") },
    ];

    expect(sortDocumentRowsByCustomOrder(rows).map((row) => row.id)).toEqual([
      "ordered",
      "untracked",
    ]);
  });

  it("falls back to newest upload first for equal sortOrder", () => {
    const rows = [
      { id: "old", sortOrder: 1, uploadedAt: at("2026-01-01T00:00:00Z") },
      { id: "new", sortOrder: 1, uploadedAt: at("2026-02-01T00:00:00Z") },
    ];

    expect(sortDocumentRowsByCustomOrder(rows).map((row) => row.id)).toEqual([
      "new",
      "old",
    ]);
  });

  it("accepts numeric strings for sortOrder", () => {
    const rows = [
      { id: "two", sortOrder: "2" },
      { id: "one", sortOrder: "1" },
    ];

    expect(sortDocumentRowsByCustomOrder(rows).map((row) => row.id)).toEqual([
      "one",
      "two",
    ]);
  });

  it("accepts ISO strings and numbers for uploadedAt", () => {
    const rows = [
      { id: "older", sortOrder: 1, uploadedAt: "2026-01-01T00:00:00Z" },
      { id: "newer", sortOrder: 1, uploadedAt: Date.parse("2026-02-01") },
    ];

    expect(sortDocumentRowsByCustomOrder(rows).map((row) => row.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("returns a new array without mutating the input", () => {
    const rows = [{ id: "b", sortOrder: 2 }, { id: "a", sortOrder: 1 }];
    const sorted = sortDocumentRowsByCustomOrder(rows);

    expect(sorted).not.toBe(rows);
    expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("returns zero for rows with identical order and upload time", () => {
    const row = { sortOrder: 1, uploadedAt: at("2026-01-01T00:00:00Z") };

    expect(compareDocumentsByCustomOrder(row, row)).toBe(0);
  });

  it("treats an invalid uploadedAt as the oldest value", () => {
    const rows = [
      { id: "invalid", sortOrder: 1, uploadedAt: "not-a-date" },
      { id: "valid", sortOrder: 1, uploadedAt: at("2020-01-01T00:00:00Z") },
    ];

    expect(sortDocumentRowsByCustomOrder(rows).map((row) => row.id)).toEqual([
      "valid",
      "invalid",
    ]);
  });
});
