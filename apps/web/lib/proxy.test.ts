import { describe, it, expect } from "vitest";
import { sanitizePath } from "./proxy";

describe("sanitizePath", () => {
  it("returns the segments unchanged when all are valid", () => {
    expect(sanitizePath(["detail", "fixture", "12345"])).toEqual(["detail", "fixture", "12345"]);
  });

  it("returns a single-segment array unchanged", () => {
    expect(sanitizePath(["account"])).toEqual(["account"]);
  });

  it("returns null when a segment is double-dot (path traversal)", () => {
    expect(sanitizePath(["detail", "..", "secret"])).toBeNull();
  });

  it("returns null when a segment is a single dot", () => {
    expect(sanitizePath(["detail", ".", "fixture"])).toBeNull();
  });

  it("returns null when a segment is an empty string", () => {
    expect(sanitizePath(["detail", "", "fixture"])).toBeNull();
  });

  it("returns null when a segment contains a backslash", () => {
    expect(sanitizePath(["detail", "fix\\ture"])).toBeNull();
  });

  it("returns null when the double-dot segment is the first element", () => {
    expect(sanitizePath(["..", "fixture"])).toBeNull();
  });

  it("returns null when the double-dot segment is the last element", () => {
    expect(sanitizePath(["detail", "fixture", ".."])).toBeNull();
  });

  it("returns an empty array unchanged when given an empty array", () => {
    expect(sanitizePath([])).toEqual([]);
  });

  it("returns null when a segment is only backslashes", () => {
    expect(sanitizePath(["\\\\"])).toBeNull();
  });
});
