import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PLATFORM_TOKEN_SYMBOL,
  PLATFORM_TOKEN_DISPLAY,
  PLATFORM_TOKEN_NAME,
  PLATFORM_TOKEN,
  IS_PLATFORM_TOKEN_PROXY,
} from "./platform-token";
import { TOKEN_BY_SYMBOL } from "./token-registry";

/**
 * ENH-012 契约测试
 *
 * 冻结"单一数据源"三常量的当前取值与 token-registry 关联契约。
 * 变更任意常量 → 测试失败 → 触发人工 review 是否同步 UI 文案 / 图标 / 合约地址。
 */
describe("platform-token 契约", () => {
  it("PLATFORM_TOKEN_SYMBOL 锚定链上 symbol 字面量", () => {
    expect(PLATFORM_TOKEN_SYMBOL).toBe("ODD");
  });

  it("PLATFORM_TOKEN_DISPLAY 锚定 UI 展示单位字面量", () => {
    expect(PLATFORM_TOKEN_DISPLAY).toBe("ODD");
  });

  it("PLATFORM_TOKEN_NAME 锚定品牌名字面量", () => {
    expect(PLATFORM_TOKEN_NAME).toBe("Odd");
  });

  it("PLATFORM_TOKEN 指向 token-registry 中 SYMBOL 对应条目", () => {
    expect(PLATFORM_TOKEN).toBe(TOKEN_BY_SYMBOL[PLATFORM_TOKEN_SYMBOL]);
    expect(PLATFORM_TOKEN.symbol).toBe(PLATFORM_TOKEN_SYMBOL);
  });

  it("PLATFORM_TOKEN 元数据与真 ODD 主网条目一致（DD-142）", () => {
    expect(PLATFORM_TOKEN.address).toBe("0x3e130563e069c414F0a18863966c211aA5D518F9");
    expect(PLATFORM_TOKEN.decimals).toBe(18);
    expect(PLATFORM_TOKEN.chainId).toBe(56);
    expect(PLATFORM_TOKEN.iconUrl).toBe("/images/tokens/odd.svg");
  });

  it("IS_PLATFORM_TOKEN_PROXY: proxy 退役后 symbol === display → false（DD-142）", () => {
    expect(IS_PLATFORM_TOKEN_PROXY).toBe(
      (PLATFORM_TOKEN_SYMBOL as string) !== (PLATFORM_TOKEN_DISPLAY as string)
    );
    expect(IS_PLATFORM_TOKEN_PROXY).toBe(false);
  });
});

/**
 * DD-142: proxy 退役后两网链上 symbol 均为真 ODD，IS_PLATFORM_TOKEN_PROXY 恒 false。
 * PLATFORM_TOKEN 仍按 NETWORK_MODE 派生到对应链条目（mainnet 56 / testnet 97）。
 */
describe("platform-token DD-142 proxy 退役 / mode 切换", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("mainnet：PLATFORM_TOKEN_SYMBOL=ODD, IS_PLATFORM_TOKEN_PROXY=false, chainId=56", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "mainnet");
    const mod = await import("./platform-token");
    expect(mod.PLATFORM_TOKEN_SYMBOL).toBe("ODD");
    expect(mod.PLATFORM_TOKEN_DISPLAY).toBe("ODD");
    expect(mod.IS_PLATFORM_TOKEN_PROXY).toBe(false);
    expect(mod.PLATFORM_TOKEN.chainId).toBe(56);
  });

  it("testnet：PLATFORM_TOKEN_SYMBOL=ODD, IS_PLATFORM_TOKEN_PROXY=false, chainId=97", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "testnet");
    const mod = await import("./platform-token");
    expect(mod.PLATFORM_TOKEN_SYMBOL).toBe("ODD");
    expect(mod.PLATFORM_TOKEN_DISPLAY).toBe("ODD");
    expect(mod.IS_PLATFORM_TOKEN_PROXY).toBe(false);
    expect(mod.PLATFORM_TOKEN.chainId).toBe(97);
  });
});
