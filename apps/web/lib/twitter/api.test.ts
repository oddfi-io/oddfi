import { describe, it, expect, vi, beforeEach } from "vitest";

// mock lib/api 的底层 helper，专测数据层错误归一逻辑（不打真网络）
vi.mock("@/lib/api", () => ({
  authGet: vi.fn(),
  authPost: vi.fn(),
}));

import { authGet, authPost } from "@/lib/api";
import {
  statusOf,
  reasonOf,
  classifyBindUrlError,
  getTwitterBindUrl,
  getTwitterBinding,
  checkTwitterFollow,
  unbindTwitter,
} from "./api";
import { TwitterBindUrlError, TwitterCheckFollowError } from "./types";

const authGetMock = vi.mocked(authGet);
const authPostMock = vi.mocked(authPost);

/** 构造 ky HTTPError 形态：response.status + responseJSON.data.reason */
const httpErr = (status: number, reason?: string) => ({
  response: { status } as Response,
  responseJSON: reason ? { data: { reason } } : undefined,
});

beforeEach(() => {
  authGetMock.mockReset();
  authPostMock.mockReset();
});

// ── 纯函数 helper ─────────────────────────────────────────────
describe("statusOf / reasonOf", () => {
  it("从 HTTPError 取 status 与 reason", () => {
    const e = httpErr(409, "user_already_bound");
    expect(statusOf(e)).toBe(409);
    expect(reasonOf(e)).toBe("user_already_bound");
  });

  it("非 HTTPError（网络错）→ undefined", () => {
    const e = new Error("network down");
    expect(statusOf(e)).toBeUndefined();
    expect(reasonOf(e)).toBeUndefined();
  });

  it("无 reason body → reason undefined", () => {
    expect(reasonOf(httpErr(503))).toBeUndefined();
  });
});

describe("classifyBindUrlError", () => {
  it("409 + user_already_bound → user_already_bound", () => {
    expect(classifyBindUrlError(409, "user_already_bound")).toBe("user_already_bound");
  });
  it("409 但 reason 不符 → unknown", () => {
    expect(classifyBindUrlError(409, "something_else")).toBe("unknown");
  });
  it("503 → disabled（功能未就绪）", () => {
    expect(classifyBindUrlError(503, undefined)).toBe("disabled");
  });
  it("其它（500 / 网络 undefined）→ unknown", () => {
    expect(classifyBindUrlError(500, undefined)).toBe("unknown");
    expect(classifyBindUrlError(undefined, undefined)).toBe("unknown");
  });
});

// ── API 行为 ──────────────────────────────────────────────────
describe("getTwitterBindUrl", () => {
  it("成功 → 返回 authorize_url", async () => {
    authGetMock.mockResolvedValue({ authorize_url: "https://x.com/oauth?code=abc" });
    expect(await getTwitterBindUrl()).toBe("https://x.com/oauth?code=abc");
  });

  it("409 user_already_bound → 抛 TwitterBindUrlError(user_already_bound)", async () => {
    authGetMock.mockRejectedValue(httpErr(409, "user_already_bound"));
    await expect(getTwitterBindUrl()).rejects.toMatchObject({
      name: "TwitterBindUrlError",
      kind: "user_already_bound",
    });
  });

  it("503 → 抛 TwitterBindUrlError(disabled)", async () => {
    authGetMock.mockRejectedValue(httpErr(503));
    await expect(getTwitterBindUrl()).rejects.toBeInstanceOf(TwitterBindUrlError);
    await expect(getTwitterBindUrl()).rejects.toMatchObject({ kind: "disabled" });
  });
});

describe("getTwitterBinding", () => {
  it("成功 → 透传 binding", async () => {
    const binding = { bound: true, twitter: { username: "alice" } };
    authGetMock.mockResolvedValue(binding);
    expect(await getTwitterBinding()).toEqual(binding);
  });

  it("503 → 归一 {bound:false, disabled:true}（不抛）", async () => {
    authGetMock.mockRejectedValue(httpErr(503));
    expect(await getTwitterBinding()).toEqual({ bound: false, disabled: true });
  });

  it("401 → 向上抛（交 Query 处理）", async () => {
    const e = httpErr(401);
    authGetMock.mockRejectedValue(e);
    await expect(getTwitterBinding()).rejects.toBe(e);
  });
});

describe("checkTwitterFollow", () => {
  it("默认快照 → 不带 refresh searchParams", async () => {
    authGetMock.mockResolvedValue({ bound: true, following: true, status: "verified" });
    await checkTwitterFollow();
    expect(authGetMock).toHaveBeenCalledWith("account/twitter/check_follow", undefined);
  });

  it("refresh=true → 带 {refresh:'1'}", async () => {
    authGetMock.mockResolvedValue({ bound: true, following: false, status: "not_following" });
    await checkTwitterFollow(true);
    expect(authGetMock).toHaveBeenCalledWith("account/twitter/check_follow", {
      searchParams: { refresh: "1" },
    });
  });

  it("429 → 抛 TwitterCheckFollowError(rate_limited)", async () => {
    authGetMock.mockRejectedValue(httpErr(429));
    await expect(checkTwitterFollow(true)).rejects.toMatchObject({
      name: "TwitterCheckFollowError",
      kind: "rate_limited",
    });
  });

  it("401 → 原样透传（交 Query/refresh 处理，不归一）", async () => {
    const e = httpErr(401);
    authGetMock.mockRejectedValue(e);
    await expect(checkTwitterFollow()).rejects.toBe(e);
  });

  it("其它错误 → 抛 TwitterCheckFollowError(unknown)", async () => {
    authGetMock.mockRejectedValue(new Error("boom"));
    await expect(checkTwitterFollow()).rejects.toBeInstanceOf(TwitterCheckFollowError);
  });
});

describe("unbindTwitter", () => {
  it("POST account/twitter/unbind 空 body", async () => {
    authPostMock.mockResolvedValue({ unbound: true });
    await unbindTwitter();
    expect(authPostMock).toHaveBeenCalledWith("account/twitter/unbind", {});
  });
});
