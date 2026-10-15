import { describe, it, expect } from "vitest";
import {
  validateUsername,
  isValidUsername,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
} from "./username-validation";

describe("validateUsername", () => {
  describe("length checks", () => {
    it("accepts empty string (clear username)", () => {
      expect(validateUsername("")).toBeNull();
    });

    it("rejects below min length", () => {
      expect(validateUsername("ab")).toBe("tooShort");
    });

    it("accepts exact min length", () => {
      expect(validateUsername("abc")).toBeNull();
      expect("abc".length).toBe(USERNAME_MIN_LENGTH);
    });

    it("accepts exact max length", () => {
      const v = "a".repeat(USERNAME_MAX_LENGTH);
      expect(validateUsername(v)).toBeNull();
    });

    it("rejects above max length", () => {
      const v = "a".repeat(USERNAME_MAX_LENGTH + 1);
      expect(validateUsername(v)).toBe("tooLong");
    });

    it("trims whitespace before measuring length", () => {
      expect(validateUsername("  ab  ")).toBe("tooShort");
    });
  });

  describe("character set", () => {
    it("accepts lowercase / uppercase / digits", () => {
      expect(validateUsername("Will123")).toBeNull();
    });

    it("accepts `.` and `_` and `-` in middle", () => {
      expect(validateUsername("will.eth")).toBeNull();
      expect(validateUsername("will_eth")).toBeNull();
      expect(validateUsername("will-eth")).toBeNull();
    });

    it("rejects spaces", () => {
      expect(validateUsername("will eth")).toBe("invalidChars");
    });

    it("rejects emoji / non-ascii", () => {
      expect(validateUsername("will😀")).toBe("invalidChars");
      expect(validateUsername("张三吗")).toBe("invalidChars");
    });

    it("rejects punctuation outside allowed set", () => {
      expect(validateUsername("will@eth")).toBe("invalidChars");
      expect(validateUsername("will+eth")).toBe("invalidChars");
      expect(validateUsername("will/eth")).toBe("invalidChars");
    });
  });

  describe("edge / consecutive special", () => {
    it("rejects leading special char", () => {
      expect(validateUsername(".willy")).toBe("edgeSpecial");
      expect(validateUsername("_willy")).toBe("edgeSpecial");
      expect(validateUsername("-willy")).toBe("edgeSpecial");
    });

    it("rejects trailing special char", () => {
      expect(validateUsername("willy.")).toBe("edgeSpecial");
      expect(validateUsername("willy_")).toBe("edgeSpecial");
      expect(validateUsername("willy-")).toBe("edgeSpecial");
    });

    it("rejects consecutive specials", () => {
      expect(validateUsername("will..eth")).toBe("consecutiveSpecial");
      expect(validateUsername("will__eth")).toBe("consecutiveSpecial");
      expect(validateUsername("will--eth")).toBe("consecutiveSpecial");
      expect(validateUsername("will._eth")).toBe("consecutiveSpecial");
      expect(validateUsername("will-_eth")).toBe("consecutiveSpecial");
    });
  });

  describe("realistic handles", () => {
    it.each([["will.eth"], ["will_eth"], ["alice-2026"], ["bob.alice_99"], ["A1B2C3"]])(
      "accepts %s",
      (handle) => {
        expect(validateUsername(handle)).toBeNull();
      }
    );
  });
});

describe("isValidUsername", () => {
  it("returns true when validateUsername returns null", () => {
    expect(isValidUsername("will.eth")).toBe(true);
  });

  it("returns false for any error code", () => {
    expect(isValidUsername("a")).toBe(false);
    expect(isValidUsername(".willy")).toBe(false);
    expect(isValidUsername("will eth")).toBe(false);
  });
});
