import { describe, it, expect } from "vitest";
import {
  classifyWalletError,
  mapWalletError,
  shouldReportToSentry,
  isUserCanceledMessage,
  getWalletErrorInfo,
} from "./wallet-error";

describe("classifyWalletError", () => {
  it("returns 'connector-chain-mismatch' for ConnectorChainMismatchError", () => {
    const err = new Error("chain mismatch");
    err.name = "ConnectorChainMismatchError";
    expect(classifyWalletError(err)).toBe("connector-chain-mismatch");
  });

  it("returns 'user-rejected' for error containing 'reject'", () => {
    expect(classifyWalletError(new Error("User rejected the request"))).toBe("user-rejected");
  });

  it("returns 'user-rejected' for error containing 'Reject' (case-insensitive)", () => {
    expect(classifyWalletError(new Error("Reject"))).toBe("user-rejected");
  });

  it("returns 'user-rejected' for error containing 'denied'", () => {
    expect(classifyWalletError(new Error("Transaction denied by user"))).toBe("user-rejected");
  });

  it("returns 'user-rejected' for error containing 'Denied' (case-insensitive)", () => {
    expect(classifyWalletError(new Error("Denied"))).toBe("user-rejected");
  });

  it("returns 'sign-timeout' for error containing 'timeout'", () => {
    expect(classifyWalletError(new Error("Sign timeout exceeded"))).toBe("sign-timeout");
  });

  it("returns 'sign-timeout' for error containing 'Timeout' (case-insensitive)", () => {
    expect(classifyWalletError(new Error("Timeout"))).toBe("sign-timeout");
  });

  it("returns 'unknown' for generic Error with no matching keywords", () => {
    expect(classifyWalletError(new Error("Something went wrong"))).toBe("unknown");
  });

  it("returns 'unknown' for a string", () => {
    expect(classifyWalletError("some error string")).toBe("unknown");
  });

  it("returns 'unknown' for null", () => {
    expect(classifyWalletError(null)).toBe("unknown");
  });

  it("returns 'unknown' for undefined", () => {
    expect(classifyWalletError(undefined)).toBe("unknown");
  });

  it("returns 'unknown' for a plain object", () => {
    expect(classifyWalletError({ message: "rejected" })).toBe("unknown");
  });

  it("returns 'connector-chain-mismatch' for BaseError-wrapped message (message fallback)", () => {
    const err = new Error(
      "The current chain of the connector (id: 1) does not match the connection's chain (id: 97).\nVersion: @wagmi/core@2.22.1"
    );
    expect(classifyWalletError(err)).toBe("connector-chain-mismatch");
  });

  it("returns 'chain-switch-timeout' for store-chain-sync-timeout message", () => {
    expect(classifyWalletError(new Error("store-chain-sync-timeout"))).toBe("chain-switch-timeout");
  });

  it("returns 'chain-switch-timeout' for 'did not switch in time' message", () => {
    expect(
      classifyWalletError(new Error("Wallet did not switch to BSC Testnet in time — please retry"))
    ).toBe("chain-switch-timeout");
  });

  it("returns 'sign-timeout' not 'chain-switch-timeout' for generic timeout", () => {
    expect(classifyWalletError(new Error("Sign timeout exceeded"))).toBe("sign-timeout");
  });

  // ── BD-008 ensureCoreChain 友好文案分类（A1 修复 REV-fix-bug-008-v1 M-1） ──
  it("returns 'user-rejected' for ensureCoreChain 'Please switch your wallet to BSC Testnet' (testnet copy)", () => {
    expect(
      classifyWalletError(new Error("Please switch your wallet to BSC Testnet and try again"))
    ).toBe("user-rejected");
  });

  it("returns 'user-rejected' for ensureCoreChain 'Please switch your wallet to BSC Mainnet' (mainnet copy)", () => {
    expect(
      classifyWalletError(new Error("Please switch your wallet to BSC Mainnet and try again"))
    ).toBe("user-rejected");
  });

  it("returns 'chain-switch-failed' for ensureCoreChain switchChainAsync non-reject failure", () => {
    expect(
      classifyWalletError(
        new Error("Failed to switch to BSC Testnet — please switch manually in your wallet")
      )
    ).toBe("chain-switch-failed");
  });

  it("returns 'chain-switch-timeout' for ensureCoreChain 'Wallet RPC did not reflect' message", () => {
    expect(
      classifyWalletError(new Error("Wallet RPC did not reflect BSC Testnet switch — please retry"))
    ).toBe("chain-switch-timeout");
  });

  // ── BUG-013 多扩展 provider contention → wagmi state.current 被异步清空 → signMessage 抛 ConnectorNotConnectedError ──
  it("returns 'connector-not-connected' for ConnectorNotConnectedError by name", () => {
    const err = Object.assign(new Error("Connector not connected."), {
      name: "ConnectorNotConnectedError",
    });
    expect(classifyWalletError(err)).toBe("connector-not-connected");
  });

  it("returns 'connector-not-connected' for message text fallback (when name missing)", () => {
    expect(classifyWalletError(new Error("Connector not connected."))).toBe(
      "connector-not-connected"
    );
  });
});

describe("mapWalletError", () => {
  it("maps ConnectorChainMismatchError to syncing message", () => {
    const err = new Error("chain mismatch");
    err.name = "ConnectorChainMismatchError";
    expect(mapWalletError(err)).toBe("Wallet network is still syncing — please retry");
  });

  it("maps user-rejected error without phase to default connection-canceled message", () => {
    expect(mapWalletError(new Error("User rejected"))).toBe(
      "Wallet connection canceled. Please try again"
    );
  });

  it("maps user-rejected with phase='sign' to signature-canceled message", () => {
    expect(mapWalletError(new Error("User rejected"), "sign")).toBe(
      "Signature canceled. Please try again"
    );
  });

  it("maps user-rejected with phase='switch' to network-switch-canceled message", () => {
    expect(mapWalletError(new Error("User rejected"), "switch")).toBe(
      "Network switch canceled. Please try again"
    );
  });

  it("maps user-rejected with phase='connect' to connection-canceled message", () => {
    expect(mapWalletError(new Error("User rejected"), "connect")).toBe(
      "Wallet connection canceled. Please try again"
    );
  });

  it("preserves ensureCoreChain 'Please switch your wallet' even when phase='sign' (friendly msg wins)", () => {
    const msg = "Please switch your wallet to BSC Testnet and try again";
    expect(mapWalletError(new Error(msg), "sign")).toBe(msg);
  });

  // ── BUG-013 ConnectorNotConnectedError 友好文案 ──
  it("maps ConnectorNotConnectedError to 'connection lost' friendly message", () => {
    const err = Object.assign(new Error("Connector not connected."), {
      name: "ConnectorNotConnectedError",
    });
    expect(mapWalletError(err, "sign")).toBe("Wallet connection lost — please try again");
  });
});

describe("shouldReportToSentry", () => {
  it("returns false for user-rejected error", () => {
    expect(shouldReportToSentry(new Error("User rejected the request"))).toBe(false);
  });

  it("returns false for ensureCoreChain 'Please switch your wallet' message", () => {
    expect(
      shouldReportToSentry(new Error("Please switch your wallet to BSC Testnet and try again"))
    ).toBe(false);
  });

  it("returns true for connector-chain-mismatch", () => {
    const err = new Error("chain mismatch");
    err.name = "ConnectorChainMismatchError";
    expect(shouldReportToSentry(err)).toBe(true);
  });

  it("returns true for generic unknown error", () => {
    expect(shouldReportToSentry(new Error("Network error"))).toBe(true);
  });

  it("returns true for sign-timeout", () => {
    expect(shouldReportToSentry(new Error("Sign timeout exceeded"))).toBe(true);
  });

  // ── BUG-013 ConnectorNotConnectedError 必须上报 Sentry（不是用户主动取消） ──
  it("returns true for connector-not-connected (system error, not user cancel)", () => {
    const err = Object.assign(new Error("Connector not connected."), {
      name: "ConnectorNotConnectedError",
    });
    expect(shouldReportToSentry(err)).toBe(true);
  });
});

// ── BUG-013 v2 · getWalletErrorInfo 11 kind + severity 矩阵 ──
describe("getWalletErrorInfo (BUG-013 v2)", () => {
  it("user-rejected with phase=connect → user-rejected-connect / info", () => {
    expect(getWalletErrorInfo(new Error("User rejected"), "connect")).toEqual({
      kind: "user-rejected-connect",
      severity: "info",
    });
  });

  it("user-rejected with phase=switch → user-rejected-switch / info", () => {
    expect(getWalletErrorInfo(new Error("User rejected"), "switch")).toEqual({
      kind: "user-rejected-switch",
      severity: "info",
    });
  });

  it("user-rejected with phase=sign → user-rejected-sign / info", () => {
    expect(getWalletErrorInfo(new Error("User rejected"), "sign")).toEqual({
      kind: "user-rejected-sign",
      severity: "info",
    });
  });

  it("user-rejected without phase defaults to connect", () => {
    expect(getWalletErrorInfo(new Error("User rejected"))).toEqual({
      kind: "user-rejected-connect",
      severity: "info",
    });
  });

  it("ConnectorNotConnectedError → connector-not-connected / warning", () => {
    const err = Object.assign(new Error("Connector not connected."), {
      name: "ConnectorNotConnectedError",
    });
    expect(getWalletErrorInfo(err, "sign")).toEqual({
      kind: "connector-not-connected",
      severity: "warning",
    });
  });

  it("ConnectorChainMismatchError → connector-chain-mismatch / warning", () => {
    const err = Object.assign(new Error("chain mismatch"), {
      name: "ConnectorChainMismatchError",
    });
    expect(getWalletErrorInfo(err)).toEqual({
      kind: "connector-chain-mismatch",
      severity: "warning",
    });
  });

  it("chain-switch-failed → warning severity", () => {
    expect(
      getWalletErrorInfo(
        new Error("Failed to switch to BSC Testnet — please switch manually in your wallet")
      )
    ).toEqual({
      kind: "chain-switch-failed",
      severity: "warning",
    });
  });

  it("chain-switch-timeout → warning severity", () => {
    expect(
      getWalletErrorInfo(new Error("Wallet did not switch to BSC Testnet in time — please retry"))
    ).toEqual({
      kind: "chain-switch-timeout",
      severity: "warning",
    });
  });

  it("sign-timeout → warning severity", () => {
    expect(getWalletErrorInfo(new Error("Sign timeout exceeded"))).toEqual({
      kind: "sign-timeout",
      severity: "warning",
    });
  });

  it("ky HTTPError by name → server-error / error severity (UI 不再误报后端问题为钱包问题反之亦然)", () => {
    const err = Object.assign(new Error("Request failed with status code 500"), {
      name: "HTTPError",
    });
    expect(getWalletErrorInfo(err)).toEqual({
      kind: "server-error",
      severity: "error",
    });
  });

  it("HTTP message regex fallback → server-error", () => {
    expect(getWalletErrorInfo(new Error("HTTP 502 Bad Gateway"))).toEqual({
      kind: "server-error",
      severity: "error",
    });
  });

  it("ky TimeoutError → network-error / error severity", () => {
    const err = Object.assign(new Error("Request timed out"), {
      name: "TimeoutError",
    });
    expect(getWalletErrorInfo(err)).toEqual({
      kind: "network-error",
      severity: "error",
    });
  });

  it("Failed to fetch message → network-error", () => {
    expect(getWalletErrorInfo(new Error("Failed to fetch"))).toEqual({
      kind: "network-error",
      severity: "error",
    });
  });

  it("non-Error → unknown / error", () => {
    expect(getWalletErrorInfo("some string")).toEqual({
      kind: "unknown",
      severity: "error",
    });
  });

  it("generic Error → unknown / error", () => {
    expect(getWalletErrorInfo(new Error("Some unmapped weird thing"))).toEqual({
      kind: "unknown",
      severity: "error",
    });
  });
});

// 历史遗留：以下 it() 原本错误地嵌套在 shouldReportToSentry describe 内（实际测的是 mapWalletError），
// E1 重构期归到独立 describe 保持原有覆盖
describe("mapWalletError legacy cases", () => {
  it("maps sign-timeout error to timeout message", () => {
    expect(mapWalletError(new Error("timeout occurred"))).toBe(
      "Signature timeout — please open your wallet app to sign"
    );
  });

  it("maps generic Error to friendly fallback (not raw message)", () => {
    expect(mapWalletError(new Error("some unexpected failure"))).toBe(
      "Login failed. Please try again."
    );
  });

  it("maps non-Error (string) to friendly fallback", () => {
    expect(mapWalletError("not an error")).toBe("Login failed. Please try again.");
  });

  it("maps non-Error (null) to friendly fallback", () => {
    expect(mapWalletError(null)).toBe("Login failed. Please try again.");
  });

  it("maps chain-switch-timeout to original error message", () => {
    const msg = "Wallet did not switch to BSC Testnet in time — please retry";
    expect(mapWalletError(new Error(msg))).toBe(msg);
  });

  it("maps BaseError-wrapped connector mismatch to syncing message", () => {
    const err = new Error(
      "The current chain of the connector (id: 1) does not match the connection's chain (id: 97).\nVersion: @wagmi/core@2.22.1"
    );
    expect(mapWalletError(err)).toBe("Wallet network is still syncing — please retry");
  });

  // ── BD-008 ensureCoreChain 友好文案 UI 文案保留 ──
  it("preserves ensureCoreChain 'Please switch your wallet' message verbatim", () => {
    const msg = "Please switch your wallet to BSC Testnet and try again";
    expect(mapWalletError(new Error(msg))).toBe(msg);
  });

  it("preserves ensureCoreChain 'Failed to switch' message verbatim", () => {
    const msg = "Failed to switch to BSC Testnet — please switch manually in your wallet";
    expect(mapWalletError(new Error(msg))).toBe(msg);
  });
});

describe("isUserCanceledMessage", () => {
  it("returns true for sign-phase cancellation message", () => {
    expect(isUserCanceledMessage("Signature canceled. Please try again")).toBe(true);
  });

  it("returns true for network-switch cancellation message", () => {
    expect(isUserCanceledMessage("Network switch canceled. Please try again")).toBe(true);
  });

  it("returns true for connect-phase cancellation message", () => {
    expect(isUserCanceledMessage("Wallet connection canceled. Please try again")).toBe(true);
  });

  it("returns true for ensureCoreChain switch prompt", () => {
    expect(isUserCanceledMessage("Please switch your wallet to BSC Testnet and try again")).toBe(
      true
    );
  });

  it("returns false for API/server error", () => {
    expect(isUserCanceledMessage("Login failed. Please try again.")).toBe(false);
  });

  it("returns false for raw HTTP error message", () => {
    expect(
      isUserCanceledMessage("Request failed with status code 502: POST https://api.oddfi.io")
    ).toBe(false);
  });

  it("returns false for null", () => {
    expect(isUserCanceledMessage(null)).toBe(false);
  });
});
