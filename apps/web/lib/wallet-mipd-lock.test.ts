// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  makeRdnsLockedWallet,
  setMipdStoreForTestOnly,
  setIsMobileForTestOnly,
} from "./wallet-mipd-lock";
import type { Store } from "mipd";

/* ------------------------------------------------------------------ */
/*  Fakes                                                              */
/* ------------------------------------------------------------------ */

function makeFakeMipdStore(providersByRdns: Record<string, unknown>): Store {
  return {
    findProvider: ({ rdns }: { rdns: string }) =>
      providersByRdns[rdns] ? ({ provider: providersByRdns[rdns] } as never) : undefined,
    getProviders: () => [],
    subscribe: () => () => {},
    clear: () => {},
    destroy: () => {},
    reset: () => {},
    _listeners: () => new Set(),
  } as unknown as Store;
}

function makeMockBaseWallet() {
  // 返回一个最小化的 RK wallet 对象 + 闭包追踪 createConnector 是否被原样保留
  return vi.fn(() => ({
    id: "metaMask",
    name: "MetaMask",
    rdns: "io.metamask",
    iconUrl: "data:image/svg+xml,fake",
    iconBackground: "#fff",
    installed: true, // RK 原装根据 isMetaMask(window.ethereum) 算出
    createConnector: vi.fn(),
  }));
}

beforeEach(() => {
  setMipdStoreForTestOnly(null);
  setIsMobileForTestOnly(null);
});

afterEach(() => {
  setMipdStoreForTestOnly(null);
  setIsMobileForTestOnly(null);
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("makeRdnsLockedWallet — 桌面场景", () => {
  beforeEach(() => setIsMobileForTestOnly(false));

  it("installed=true 当 MIPD announce 到对应 rdns provider", () => {
    const realProvider = { isMetaMask: true, request: vi.fn() };
    setMipdStoreForTestOnly(makeFakeMipdStore({ "io.metamask": realProvider }));

    const base = makeMockBaseWallet();
    const wrapped = makeRdnsLockedWallet("io.metamask", base);
    const wallet = wrapped({ projectId: "test" });

    expect(wallet.installed).toBe(true);
    expect(wallet.id).toBe("metaMask");
    expect(wallet.rdns).toBe("io.metamask");
  });

  it("installed=false 当 MIPD 找不到对应 rdns（钱包未装）", () => {
    setMipdStoreForTestOnly(makeFakeMipdStore({})); // 空 store

    const base = makeMockBaseWallet();
    const wrapped = makeRdnsLockedWallet("io.metamask", base);
    const wallet = wrapped({ projectId: "test" });

    expect(wallet.installed).toBe(false);
  });

  it("createConnector 被替换为 MIPD-locked 版（不复用 RK 原装 createConnector）", () => {
    const realProvider = { isMetaMask: true, request: vi.fn() };
    setMipdStoreForTestOnly(makeFakeMipdStore({ "io.metamask": realProvider }));

    const base = makeMockBaseWallet();
    const wrapped = makeRdnsLockedWallet("io.metamask", base);
    const wallet = wrapped({ projectId: "test" });

    // base() 返回的 createConnector 是 vi.fn()；wrapped 应该替换它
    expect(wallet.createConnector).not.toBe(base.mock.results[0].value.createConnector);
    expect(typeof wallet.createConnector).toBe("function");
  });

  it("多扩展污染场景：window.ethereum 被污染但 MIPD 仍返回真 MetaMask provider", () => {
    // 模拟污染：window.ethereum 指向 Yoroi 风格的伪 provider
    const pollutedProvider = { isMetaMask: true, __polluted: true };
    (globalThis as { window?: { ethereum?: unknown } }).window!.ethereum = pollutedProvider;
    // MIPD store 通过 EIP-6963 announce 拿到的是真 MetaMask provider
    const realMetaMaskProvider = { isMetaMask: true, __real: true };
    setMipdStoreForTestOnly(makeFakeMipdStore({ "io.metamask": realMetaMaskProvider }));

    const base = makeMockBaseWallet();
    const wrapped = makeRdnsLockedWallet("io.metamask", base);
    const wallet = wrapped({ projectId: "test" });

    // 关键：installed 由 MIPD 决定，不被 window.ethereum 污染干扰
    expect(wallet.installed).toBe(true);
    // 清理污染
    delete (globalThis as { window?: { ethereum?: unknown } }).window!.ethereum;
  });
});

describe("makeRdnsLockedWallet — 移动场景透传", () => {
  beforeEach(() => setIsMobileForTestOnly(true));

  it("透传 RK 原装 wallet 对象（不动 installed 也不动 createConnector）", () => {
    setMipdStoreForTestOnly(makeFakeMipdStore({})); // 即使桌面会判 installed=false 移动场景也不该看 MIPD

    const baseWallet = {
      id: "metaMask",
      name: "MetaMask",
      rdns: "io.metamask",
      iconUrl: "data:image/svg+xml,fake",
      iconBackground: "#fff",
      installed: undefined, // RK 移动端通常 undefined
      createConnector: vi.fn(),
    };
    const base = vi.fn(() => baseWallet);
    const wrapped = makeRdnsLockedWallet("io.metamask", base);
    const wallet = wrapped({ projectId: "test" });

    expect(wallet).toBe(baseWallet); // 同引用，未包裹
    expect(wallet.createConnector).toBe(baseWallet.createConnector);
  });
});
