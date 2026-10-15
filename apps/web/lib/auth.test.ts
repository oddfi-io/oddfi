import { describe, it, expect } from "vitest";
import { buildSignMessage, mapWalletType, mapChainName, decodeJwtAddress } from "@/lib/auth";

// base64url 编码工具（浏览器/SSR 双端）
function b64url(input: string): string {
  const b64 =
    typeof btoa === "function" ? btoa(input) : Buffer.from(input, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

// ─── buildSignMessage ─────────────────────────────────────────────────────────

describe("buildSignMessage", () => {
  it("produces the correct full format with all fields", () => {
    const msg = buildSignMessage("0xABC", "bsc", "testNonce", 1000000);
    expect(msg).toBe(
      "oddfi wants you to sign in with your account:0xABC ChainID:bsc Nonce:testNonce Issued At:1000000 Expiration time:1000300"
    );
  });

  it("sets expiration time to issuedAt + 300", () => {
    const issuedAt = 1774598277;
    const msg = buildSignMessage("0x000", "eth", "abc", issuedAt);
    expect(msg).toContain(`Issued At:${issuedAt}`);
    expect(msg).toContain(`Expiration time:${issuedAt + 300}`);
  });

  it("preserves address casing exactly as provided", () => {
    const msg = buildSignMessage("0xDeAdBeEf", "bsc", "n", 0);
    expect(msg).toContain("account:0xDeAdBeEf");
  });

  it("handles empty nonce", () => {
    const msg = buildSignMessage("0x1", "bsc", "", 100);
    expect(msg).toBe(
      "oddfi wants you to sign in with your account:0x1 ChainID:bsc Nonce: Issued At:100 Expiration time:400"
    );
  });

  it("works with zero issuedAt", () => {
    const msg = buildSignMessage("0x1", "bsc", "n", 0);
    expect(msg).toContain("Issued At:0 Expiration time:300");
  });
});

// ─── mapWalletType ────────────────────────────────────────────────────────────

describe("mapWalletType", () => {
  describe("injected connector path (connector.id)", () => {
    it("maps metaMask to metamask", () => {
      expect(mapWalletType({ id: "metaMask" })).toBe("metamask");
    });

    it("maps metaMaskSDK to metamask (mobile SDK connector)", () => {
      expect(mapWalletType({ id: "metaMaskSDK" })).toBe("metamask");
    });

    it("maps okx to okx", () => {
      expect(mapWalletType({ id: "okx" })).toBe("okx");
    });

    it("maps binance to binance", () => {
      expect(mapWalletType({ id: "binance" })).toBe("binance");
    });

    it("maps coinbaseWallet to coinbase", () => {
      expect(mapWalletType({ id: "coinbaseWallet" })).toBe("coinbase");
    });

    it("maps walletConnect to walletconnect", () => {
      expect(mapWalletType({ id: "walletConnect" })).toBe("walletconnect");
    });

    it("maps com.okex.wallet to okx (legacy id)", () => {
      expect(mapWalletType({ id: "com.okex.wallet" })).toBe("okx");
    });

    it("maps com.binance to binance (legacy id)", () => {
      expect(mapWalletType({ id: "com.binance" })).toBe("binance");
    });

    // DD-131：rdns-lock 后 connector.id 为 rdns 形式；自动重登无 SELECTED_WALLET_KEY，
    // 全靠本函数归一。com.binance.wallet 之前漏配 → 错落 metamask（本次修复）。
    it("maps com.binance.wallet to binance (rdns, DD-131 修复点)", () => {
      expect(mapWalletType({ id: "com.binance.wallet" })).toBe("binance");
    });

    it("maps io.metamask to metamask (rdns)", () => {
      expect(mapWalletType({ id: "io.metamask" })).toBe("metamask");
    });
  });

  describe("子串兜底（任意 id 形态归一）", () => {
    it("含 binance 的未知 id → binance", () => {
      expect(mapWalletType({ id: "binanceWallet" })).toBe("binance");
    });
    it("含 okex 的未知 id → okx", () => {
      expect(mapWalletType({ id: "com.okex.wallet.v2" })).toBe("okx");
    });
    it("含 coinbase 的未知 id → coinbase", () => {
      expect(mapWalletType({ id: "com.coinbase.wallet" })).toBe("coinbase");
    });
    it("含 metamask 的未知 id → metamask", () => {
      expect(mapWalletType({ id: "io.metamask.flask" })).toBe("metamask");
    });
    it("完全未知 id → 默认 metamask", () => {
      expect(mapWalletType({ id: "some.random.wallet" })).toBe("metamask");
    });
    it("空 connector → 默认 metamask", () => {
      expect(mapWalletType(null)).toBe("metamask");
    });
  });

  describe("WalletConnect path — rkDetails.id takes priority", () => {
    it("resolves OKX via WC: id=walletConnect + rkDetails.id=okx returns okx", () => {
      expect(mapWalletType({ id: "walletConnect", rkDetails: { id: "okx" } })).toBe("okx");
    });

    it("resolves MetaMask via WC: rkDetails.id=metaMask returns metamask", () => {
      expect(mapWalletType({ id: "walletConnect", rkDetails: { id: "metaMask" } })).toBe(
        "metamask"
      );
    });

    it("resolves Binance via WC: rkDetails.id=binance returns binance", () => {
      expect(mapWalletType({ id: "walletConnect", rkDetails: { id: "binance" } })).toBe("binance");
    });

    it("falls back to connector.id when rkDetails.id is not in map", () => {
      expect(mapWalletType({ id: "walletConnect", rkDetails: { id: "unknownWallet" } })).toBe(
        "walletconnect"
      );
    });

    it("falls back to connector.id when rkDetails.id is undefined", () => {
      expect(mapWalletType({ id: "coinbaseWallet", rkDetails: {} })).toBe("coinbase");
    });

    it("rkDetails.id not in map falls through to connector.id", () => {
      expect(mapWalletType({ id: "okx", rkDetails: { id: "unknown-rk-id" } })).toBe("okx");
    });
  });

  describe("fallback / edge cases", () => {
    it("returns metamask when connector is undefined", () => {
      expect(mapWalletType(undefined)).toBe("metamask");
    });

    it("returns metamask when connector is null", () => {
      expect(mapWalletType(null)).toBe("metamask");
    });

    it("returns metamask for unknown connector id", () => {
      expect(mapWalletType({ id: "someRandomWallet" })).toBe("metamask");
    });

    it("returns metamask when connector has no id", () => {
      expect(mapWalletType({})).toBe("metamask");
    });
  });
});

// ─── mapChainName ─────────────────────────────────────────────────────────────

describe("mapChainName", () => {
  it("returns bsc for BSC mainnet (56)", () => {
    expect(mapChainName(56)).toBe("bsc");
  });

  it("returns bsc for BSC testnet (97)", () => {
    expect(mapChainName(97)).toBe("bsc");
  });

  it("returns eth for Ethereum mainnet (1)", () => {
    expect(mapChainName(1)).toBe("eth");
  });

  it("returns polygon for Polygon (137)", () => {
    expect(mapChainName(137)).toBe("polygon");
  });

  it("returns arbitrum for Arbitrum (42161)", () => {
    expect(mapChainName(42161)).toBe("arbitrum");
  });

  it("returns base for Base (8453)", () => {
    expect(mapChainName(8453)).toBe("base");
  });

  it("throws for unknown chain ID", () => {
    expect(() => mapChainName(10)).toThrow(/Unsupported chainId/);
    expect(() => mapChainName(999)).toThrow(/Unsupported chainId/);
  });

  it("throws when chainId is undefined", () => {
    expect(() => mapChainName(undefined)).toThrow(/Unsupported chainId/);
  });

  it("throws when chainId is 0", () => {
    expect(() => mapChainName(0)).toThrow(/Unsupported chainId/);
  });
});

// ─── decodeJwtAddress (DD-072 Batch 4) ────────────────────────────────────────

describe("decodeJwtAddress", () => {
  it("decodes address claim from a valid JWT payload", () => {
    const token = makeJwt({ address: "0xAbCdEf1234567890", sub: "123" });
    expect(decodeJwtAddress(token)).toBe("0xAbCdEf1234567890");
  });

  it("preserves address casing exactly", () => {
    const token = makeJwt({ address: "0xDeAdBeEf00112233" });
    expect(decodeJwtAddress(token)).toBe("0xDeAdBeEf00112233");
  });

  it("returns null when payload has no address field", () => {
    const token = makeJwt({ sub: "123", exp: 9999999 });
    expect(decodeJwtAddress(token)).toBeNull();
  });

  it("returns null when address is not a string", () => {
    const token = makeJwt({ address: 123 });
    expect(decodeJwtAddress(token)).toBeNull();
  });

  it("returns null for null / undefined input", () => {
    expect(decodeJwtAddress(null)).toBeNull();
    expect(decodeJwtAddress(undefined)).toBeNull();
    expect(decodeJwtAddress("")).toBeNull();
  });

  it("returns null for a token without a second segment", () => {
    expect(decodeJwtAddress("just-one-segment")).toBeNull();
  });

  it("returns null for malformed base64", () => {
    expect(decodeJwtAddress("header.!!!not-base64!!!.sig")).toBeNull();
  });

  it("returns null when payload is not valid JSON", () => {
    const fakePayload = b64url("not-json-at-all");
    expect(decodeJwtAddress(`header.${fakePayload}.sig`)).toBeNull();
  });

  it("handles base64url-specific characters (- _) in payload", () => {
    // 构造含 +/ 的原始 base64，transform 成 base64url(-_) 后 decodeJwtAddress 必须能还原
    const token = makeJwt({ address: "0xff?>>>????<<<<" });
    // sanity: token 的 payload 段不含裸 +/=，说明已经是 base64url
    const payloadSeg = token.split(".")[1];
    expect(payloadSeg).not.toMatch(/[+/=]/);
    expect(decodeJwtAddress(token)).toBe("0xff?>>>????<<<<");
  });
});
