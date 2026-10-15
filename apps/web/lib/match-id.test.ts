import { describe, it, expect } from "vitest";
import { fixtureIdToMatchId } from "./match-id";

describe("fixtureIdToMatchId", () => {
  it("matches odd skill idFromText output for known UCL fixture (snapshot)", () => {
    expect(fixtureIdToMatchId(19146050)).toBe(
      "0x3c64a9085c1804d995cf17ebc6eb2b6f0303ed30d1be72c20f12e0902f5420eb"
    );
  });

  it("matches odd skill idFromText output for known WC fixture (snapshot)", () => {
    expect(fixtureIdToMatchId(19135490)).toBe(
      "0xfd967bad13407591b57cc6e1cd5faa83051bc0957f92a524d94ecd72d5609a23"
    );
  });

  it("number and string fixture_id produce identical matchId", () => {
    expect(fixtureIdToMatchId(19146050)).toBe(fixtureIdToMatchId("19146050"));
  });

  it("returns 0x-prefixed 32-byte hex (66 chars)", () => {
    const matchId = fixtureIdToMatchId(1);
    expect(matchId).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("different fixture_id produces different matchId", () => {
    expect(fixtureIdToMatchId(19146050)).not.toBe(fixtureIdToMatchId(19146051));
  });
});
