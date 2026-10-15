import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertUniqueKeys } from "./assert-unique-keys";

describe("assertUniqueKeys (dev-only)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // vitest 默认 NODE_ENV=test，强制设为 development 让分支生效
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("无重复时不打 warn", () => {
    assertUniqueKeys([{ id: "a" }, { id: "b" }, { id: "c" }], (x) => x.id, "test");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("重复 key 触发 warn，message 含 label / key / 次数", () => {
    assertUniqueKeys([{ id: "a" }, { id: "b" }, { id: "a" }], (x) => x.id, "parseOddsLines");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("[parseOddsLines]");
    expect(warnSpy.mock.calls[0]?.[0]).toContain('"a"');
    expect(warnSpy.mock.calls[0]?.[0]).toContain("2x");
  });

  it("多组重复分别 warn", () => {
    assertUniqueKeys(
      [{ id: "a" }, { id: "b" }, { id: "a" }, { id: "b" }, { id: "c" }],
      (x) => x.id,
      "multi"
    );
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("空数组 no-op", () => {
    assertUniqueKeys([], (x: { id: string }) => x.id, "empty");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("prod 模式完全 no-op", () => {
    vi.stubEnv("NODE_ENV", "production");
    assertUniqueKeys([{ id: "a" }, { id: "a" }], (x) => x.id, "prod");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
