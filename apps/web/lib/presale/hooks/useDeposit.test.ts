import { describe, it, expect, vi } from "vitest";
import {
  REPORT_TX_MAX_RETRIES,
  reportTxBackoffMs,
  classifyReportTxError,
  reportTxWithRetry,
} from "./useDeposit";

// DD-119：report-tx 静默重试机制（40006 上报过早 → 指数避让；终态码立即失败）
describe("classifyReportTxError", () => {
  it("tx 本身有问题（40007/40008/40902）→ terminal（立即失败，不重试）", () => {
    expect(classifyReportTxError(40007)).toBe("terminal"); // 非金库
    expect(classifyReportTxError(40008)).toBe("terminal"); // 非 USDT
    expect(classifyReportTxError(40902)).toBe("terminal"); // 钱包不符
  });

  it("40006（receipt 暂未索引/revert）→ retry（指数避让静默重试）", () => {
    expect(classifyReportTxError(40006)).toBe("retry");
  });

  it("40405 / 网络未知(null) / 其它未知码 → poll（交 worker 兜底轮询）", () => {
    expect(classifyReportTxError(40405)).toBe("poll");
    expect(classifyReportTxError(null)).toBe("poll");
    expect(classifyReportTxError(50000)).toBe("poll");
  });
});

describe("reportTxBackoffMs", () => {
  it("指数递增：1s,2s,4s,8s", () => {
    expect(reportTxBackoffMs(0)).toBe(1000);
    expect(reportTxBackoffMs(1)).toBe(2000);
    expect(reportTxBackoffMs(2)).toBe(4000);
    expect(reportTxBackoffMs(3)).toBe(8000);
  });

  it("封顶 8s，不无限增长", () => {
    expect(reportTxBackoffMs(4)).toBe(8000);
    expect(reportTxBackoffMs(10)).toBe(8000);
  });
});

describe("REPORT_TX_MAX_RETRIES", () => {
  it("重试 5 次（共 6 次上报尝试）", () => {
    expect(REPORT_TX_MAX_RETRIES).toBe(5);
  });
});

// 构造 ky HTTPError 形态：response.clone().json() 返回 { code }
const bizErr = (code: number) => ({
  response: { clone: () => ({ json: async () => ({ code }) }) },
});

describe("reportTxWithRetry", () => {
  it("首次成功 → ok，不重试不 sleep", async () => {
    const doReport = vi.fn(async () => undefined);
    const sleep = vi.fn(async () => undefined);
    expect(await reportTxWithRetry(doReport, { sleep })).toBe("ok");
    expect(doReport).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("40006 重试 2 次后成功 → ok，按指数避让 sleep(1s,2s)", async () => {
    let n = 0;
    const doReport = vi.fn(async () => {
      if (n++ < 2) throw bizErr(40006);
    });
    const sleep = vi.fn(async () => undefined);
    expect(await reportTxWithRetry(doReport, { sleep })).toBe("ok");
    expect(doReport).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it("40006 持续失败 → 耗尽转 poll（worker 兜底），共 1+5 次尝试 + 5 次 sleep", async () => {
    const doReport = vi.fn(async () => {
      throw bizErr(40006);
    });
    const sleep = vi.fn(async () => undefined);
    expect(await reportTxWithRetry(doReport, { sleep })).toBe("poll");
    expect(doReport).toHaveBeenCalledTimes(REPORT_TX_MAX_RETRIES + 1);
    expect(sleep).toHaveBeenCalledTimes(REPORT_TX_MAX_RETRIES);
  });

  it("40007（tx 本身错）→ 立即 terminal，不重试", async () => {
    const doReport = vi.fn(async () => {
      throw bizErr(40007);
    });
    const sleep = vi.fn(async () => undefined);
    expect(await reportTxWithRetry(doReport, { sleep })).toEqual({ terminal: 40007 });
    expect(doReport).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("网络错误（无 response）→ poll，不重试", async () => {
    const doReport = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await reportTxWithRetry(doReport, { sleep: async () => undefined })).toBe("poll");
    expect(doReport).toHaveBeenCalledTimes(1);
  });

  it("40405 → poll，不重试", async () => {
    const doReport = vi.fn(async () => {
      throw bizErr(40405);
    });
    expect(await reportTxWithRetry(doReport, { sleep: async () => undefined })).toBe("poll");
    expect(doReport).toHaveBeenCalledTimes(1);
  });
});
