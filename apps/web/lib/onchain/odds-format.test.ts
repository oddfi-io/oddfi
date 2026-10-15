import { describe, expect, it } from "vitest";

import { compareQuoteVersion, restBaseOddsToContractStrings } from "./odds-format";

describe("restBaseOddsToContractStrings", () => {
  it("converts exact float odds", () => {
    expect(restBaseOddsToContractStrings([2.29, 3.36, 3.17])).toEqual(["22900", "33600", "31700"]);
  });

  it("rounds half-up on 1.005 boundary (must not floor)", () => {
    // 1.005 * 10000 = 10049.999… in IEEE-754 → Math.floor wrongly gives "10049"
    // Math.round must give "10050".
    expect(restBaseOddsToContractStrings([1.005])).toEqual(["10050"]);
  });

  it("rounds down when remainder < 0.5", () => {
    expect(restBaseOddsToContractStrings([1.0049])).toEqual(["10049"]);
  });

  it("rounds up when remainder >= 0.5", () => {
    expect(restBaseOddsToContractStrings([1.0051])).toEqual(["10051"]);
  });

  it("preserves zero", () => {
    expect(restBaseOddsToContractStrings([0])).toEqual(["0"]);
  });

  it("throws on NaN / Infinity / negative", () => {
    expect(() => restBaseOddsToContractStrings([NaN])).toThrow(/invalid odds value/);
    expect(() => restBaseOddsToContractStrings([Infinity])).toThrow(/invalid odds value/);
    expect(() => restBaseOddsToContractStrings([-1])).toThrow(/invalid odds value/);
  });

  it("returns empty array for empty input", () => {
    expect(restBaseOddsToContractStrings([])).toEqual([]);
  });
});

describe("compareQuoteVersion", () => {
  it("returns positive when a > b", () => {
    expect(compareQuoteVersion(22, 21)).toBeGreaterThan(0);
  });

  it("returns negative when a < b", () => {
    expect(compareQuoteVersion(21, 22)).toBeLessThan(0);
  });

  it("returns 0 when equal", () => {
    expect(compareQuoteVersion(21, 21)).toBe(0);
  });

  it("works for large uint64-ish numbers within JS safe range", () => {
    expect(
      compareQuoteVersion(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1)
    ).toBeGreaterThan(0);
  });

  it("throws on non-finite input", () => {
    expect(() => compareQuoteVersion(NaN, 1)).toThrow(/non-finite/);
    expect(() => compareQuoteVersion(1, Infinity)).toThrow(/non-finite/);
  });
});
