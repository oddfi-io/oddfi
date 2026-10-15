import { describe, expect, it } from "vitest";

import { InvalidMarketIdError, isValidMarketId, normalizeMarketId } from "./market-id";

const VALID = "0x020368b0e5316baa9a48b3e7c77872b0e7ca0ffcfd2f18319ebea5b25e762164";

describe("normalizeMarketId", () => {
  it("returns lowercase 0x-prefixed 66-char id when input already valid", () => {
    expect(normalizeMarketId(VALID)).toBe(VALID);
  });

  it("lowercases uppercase hex", () => {
    const mixed = "0x" + "020368B0E5316BAA9A48B3E7C77872B0E7CA0FFCFD2F18319EBEA5B25E762164";
    expect(normalizeMarketId(mixed)).toBe(VALID);
  });

  it("normalizes 0X prefix to 0x", () => {
    const upperPrefix = "0X" + "020368b0e5316baa9a48b3e7c77872b0e7ca0ffcfd2f18319ebea5b25e762164";
    expect(normalizeMarketId(upperPrefix)).toBe(VALID);
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeMarketId(`  ${VALID}  `)).toBe(VALID);
  });

  it.each([
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
  ])("throws InvalidMarketIdError for %s", (_label, raw) => {
    expect(() => normalizeMarketId(raw as string)).toThrow(InvalidMarketIdError);
  });

  it("throws when missing 0x prefix", () => {
    const noPrefix = "020368b0e5316baa9a48b3e7c77872b0e7ca0ffcfd2f18319ebea5b25e762164";
    expect(() => normalizeMarketId(noPrefix)).toThrow(/must start with 0x/);
  });

  it("throws when too short", () => {
    expect(() => normalizeMarketId("0xabc")).toThrow(/must be 66 chars/);
  });

  it("throws when too long", () => {
    expect(() => normalizeMarketId(VALID + "00")).toThrow(/must be 66 chars/);
  });

  it("throws when containing non-hex chars", () => {
    const badHex = "0x" + "z".repeat(64);
    expect(() => normalizeMarketId(badHex)).toThrow(/64 hex chars/);
  });
});

describe("isValidMarketId", () => {
  it("returns true for valid", () => {
    expect(isValidMarketId(VALID)).toBe(true);
  });

  it("returns false for invalid", () => {
    expect(isValidMarketId("0xabc")).toBe(false);
    expect(isValidMarketId(null)).toBe(false);
    expect(isValidMarketId(123)).toBe(false);
  });
});
