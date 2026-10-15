// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { useWithdrawTx } from "./useWithdrawTx";

const mockSignMessageAsync = vi.fn();
const mockWithdrawApply = vi.fn();

vi.mock("wagmi", () => ({
  useSignMessage: () => ({ signMessageAsync: mockSignMessageAsync }),
}));

vi.mock("@/lib/api", () => ({
  withdrawApply: (req: unknown) => mockWithdrawApply(req),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const VALID_ADDR = "0x9B1453b88B449d286e1E78bab706880362A47354";
const OK_RESULT = {
  withdraw_address: VALID_ADDR,
  real_amount: "4.5",
  fee: "0.5",
  order_sn: "WD-001",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DD-123: 构造 ky HTTPError 形态的 mock 错误。
// 真实 ky.HTTPError 原生只有 .response/.request/.options，无 .responseJSON。
// lib/api.ts 的 beforeError hook 注入 .responseJSON。本 mock 模拟"经过 hook 后"的错误形态。
function makeKyHttpError(status: number, code: number, message: string): Error {
  const err = new Error(`HTTP ${status} ${message}`) as Error & {
    response?: { status: number };
    responseJSON?: { code?: number; message?: string };
  };
  err.name = "HTTPError";
  err.response = { status };
  err.responseJSON = { code, message };
  return err;
}

// 模拟 beforeError 注入失败（body 非 JSON / 空 body）—— 仅有 .response.status 没有 .responseJSON
function makeKyHttpErrorStatusOnly(status: number): Error {
  const err = new Error(`HTTP ${status}`) as Error & { response?: { status: number } };
  err.name = "HTTPError";
  err.response = { status };
  return err;
}

describe("useWithdrawTx", () => {
  beforeEach(() => {
    mockSignMessageAsync.mockReset();
    mockWithdrawApply.mockReset();
    vi.mocked(Sentry.captureException).mockReset();
  });

  it("starts in idle", () => {
    const { result } = renderHook(() => useWithdrawTx());
    expect(result.current.phase).toBe("idle");
    expect(result.current.result).toBeUndefined();
    expect(result.current.errorKey).toBeUndefined();
  });

  it("rejects invalid address before signing", async () => {
    const { result } = renderHook(() => useWithdrawTx());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.execute({ address: "notanaddress", amount: "5" });
    });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("failed");
    expect(result.current.errorKey).toBe("wdErrFailedDesc");
    expect(mockSignMessageAsync).not.toHaveBeenCalled();
  });

  it("rejects amount below 1 before signing", async () => {
    const { result } = renderHook(() => useWithdrawTx());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.execute({ address: VALID_ADDR, amount: "0.5" });
    });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("failed");
    expect(result.current.errorKey).toBe("wdErrFailedDesc");
    expect(mockSignMessageAsync).not.toHaveBeenCalled();
  });

  it("user rejection on signature → errorKey=wdErrSigRejected + Sentry tag=sig_rejected", async () => {
    mockSignMessageAsync.mockRejectedValueOnce(
      Object.assign(new Error("User rejected the request"), { code: 4001 })
    );
    const { result } = renderHook(() => useWithdrawTx());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("failed");
    expect(result.current.errorKey).toBe("wdErrSigRejected");
    expect(mockWithdrawApply).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          feature: "withdraw",
          withdraw_error_kind: "sig_rejected",
        }),
      })
    );
  });

  it("HTTP failure (generic 500) → errorKey=wdErrFailedDesc + Sentry tag=other", async () => {
    mockSignMessageAsync.mockResolvedValueOnce("0xSIGNATURE");
    mockWithdrawApply.mockRejectedValueOnce(makeKyHttpError(500, 500, "internal server error"));
    const { result } = renderHook(() => useWithdrawTx());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("failed");
    expect(result.current.errorKey).toBe("wdErrFailedDesc");
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ withdraw_error_kind: "other" }),
      })
    );
  });

  it("DD-123: HTTP 409 nonce 重放 → errorKey=wdErrNonceUsed + Sentry tag=nonce_used", async () => {
    mockSignMessageAsync.mockResolvedValueOnce("0xSIGNATURE");
    mockWithdrawApply.mockRejectedValueOnce(
      makeKyHttpError(409, 409, "withdraw wallet nonce already used")
    );
    const { result } = renderHook(() => useWithdrawTx());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("failed");
    expect(result.current.errorKey).toBe("wdErrNonceUsed");
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ withdraw_error_kind: "nonce_used" }),
      })
    );
  });

  it("DD-123: status=409 fallback（responseJSON 未注入）→ errorKey=wdErrNonceUsed", async () => {
    // 防御场景：beforeError hook 解析 body 失败（如 reverse proxy 截断），仅 status 可用
    mockSignMessageAsync.mockResolvedValueOnce("0xSIGNATURE");
    mockWithdrawApply.mockRejectedValueOnce(makeKyHttpErrorStatusOnly(409));
    const { result } = renderHook(() => useWithdrawTx());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    expect(ok).toBe(false);
    expect(result.current.errorKey).toBe("wdErrNonceUsed");
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ withdraw_error_kind: "nonce_used" }),
      })
    );
  });

  it("DD-123: HTTP 400 sig_time invalid → errorKey=wdErrFailedDesc + Sentry tag=sig_time_invalid", async () => {
    mockSignMessageAsync.mockResolvedValueOnce("0xSIGNATURE");
    mockWithdrawApply.mockRejectedValueOnce(
      makeKyHttpError(400, 400, "withdraw sig time is invalid, new:1234, sig:1234")
    );
    const { result } = renderHook(() => useWithdrawTx());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("failed");
    expect(result.current.errorKey).toBe("wdErrFailedDesc");
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ withdraw_error_kind: "sig_time_invalid" }),
      })
    );
  });

  it("success path: phase=success + result filled + returns true", async () => {
    mockSignMessageAsync.mockResolvedValueOnce("0xSIGNATURE");
    mockWithdrawApply.mockResolvedValueOnce(OK_RESULT);
    const { result } = renderHook(() => useWithdrawTx());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    expect(ok).toBe(true);
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.real_amount).toBe("4.5");
    expect(result.current.errorKey).toBeUndefined();
  });

  it("DD-123: signature message uses canonical format with lowercase address + nonce suffix", async () => {
    mockSignMessageAsync.mockResolvedValueOnce("0xSIG");
    mockWithdrawApply.mockResolvedValueOnce(OK_RESULT);
    const { result } = renderHook(() => useWithdrawTx());
    await act(async () => {
      await result.current.execute({ address: VALID_ADDR, amount: "10" });
    });
    const signArgs = mockSignMessageAsync.mock.calls[0][0];
    // 后端按 lowercase 拼 message verify，前端必须统一 lowercase。
    // DD-123: 末尾 append `, nonce: <36 uuid>`，与请求体 wallet_nonce 同源。
    const m = signArgs.message.match(
      /^Oddfi withdraw amount: 10, withdraw address: ([0-9a-fx]+), sig time: (\d+), nonce: ([0-9a-f-]{36})$/i
    );
    expect(m).not.toBeNull();
    expect(m![1]).toBe(VALID_ADDR.toLowerCase());
    expect(m![3]).toMatch(UUID_RE);
  });

  it("DD-123: apply body carries signature + sig_time + chain=bsc + wallet_nonce; address is lowercased", async () => {
    mockSignMessageAsync.mockResolvedValueOnce("0xSIG");
    mockWithdrawApply.mockResolvedValueOnce(OK_RESULT);
    const { result } = renderHook(() => useWithdrawTx());
    await act(async () => {
      await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    const body = mockWithdrawApply.mock.calls[0][0];
    expect(body.withdraw_address).toBe(VALID_ADDR.toLowerCase());
    expect(body.withdraw_sign).toBe("0xSIG");
    expect(body.amount).toBe("5");
    expect(body.chain).toBe("bsc");
    expect(typeof body.sig_time).toBe("number");
    expect(body.wallet_nonce).toMatch(UUID_RE);
  });

  it("DD-123: signature message nonce === body.wallet_nonce (same source)", async () => {
    mockSignMessageAsync.mockResolvedValueOnce("0xSIG");
    mockWithdrawApply.mockResolvedValueOnce(OK_RESULT);
    const { result } = renderHook(() => useWithdrawTx());
    await act(async () => {
      await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    const signedMessage: string = mockSignMessageAsync.mock.calls[0][0].message;
    const body = mockWithdrawApply.mock.calls[0][0];
    expect(signedMessage.endsWith(`, nonce: ${body.wallet_nonce}`)).toBe(true);
  });

  it("W-2 (REV-v3): crypto.randomUUID throws (non-secure context) → errorKey=wdErrFailedDesc + Sentry tag=uuid_unavailable", async () => {
    const spy = vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
      throw new TypeError("crypto.randomUUID is not a function");
    });
    const { result } = renderHook(() => useWithdrawTx());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    expect(ok).toBe(false);
    expect(result.current.phase).toBe("failed");
    expect(result.current.errorKey).toBe("wdErrFailedDesc");
    expect(mockSignMessageAsync).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({
        tags: expect.objectContaining({ withdraw_error_kind: "uuid_unavailable" }),
      })
    );
    spy.mockRestore();
  });

  it("DD-123: crypto.randomUUID is called for each execute (no reuse)", async () => {
    const spy = vi.spyOn(crypto, "randomUUID");
    mockSignMessageAsync.mockResolvedValue("0xSIG");
    mockWithdrawApply.mockResolvedValue(OK_RESULT);
    const { result } = renderHook(() => useWithdrawTx());
    await act(async () => {
      await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    await act(async () => {
      result.current.reset();
    });
    await act(async () => {
      await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    expect(spy).toHaveBeenCalledTimes(2);
    const firstNonce = mockWithdrawApply.mock.calls[0][0].wallet_nonce;
    const secondNonce = mockWithdrawApply.mock.calls[1][0].wallet_nonce;
    expect(firstNonce).not.toBe(secondNonce);
    spy.mockRestore();
  });

  it("reset brings state back to idle", async () => {
    mockSignMessageAsync.mockResolvedValueOnce("0xSIG");
    mockWithdrawApply.mockResolvedValueOnce(OK_RESULT);
    const { result } = renderHook(() => useWithdrawTx());
    await act(async () => {
      await result.current.execute({ address: VALID_ADDR, amount: "5" });
    });
    expect(result.current.phase).toBe("success");
    act(() => {
      result.current.reset();
    });
    expect(result.current.phase).toBe("idle");
    expect(result.current.result).toBeUndefined();
    expect(result.current.errorKey).toBeUndefined();
  });
});
