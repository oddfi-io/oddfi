import { describe, it, expect } from "vitest";
import { decideBindResult } from "./useTwitterBindResult";

// DD-148 §3.4：OAuth 回跳结果纯决策（登录门控 M1 + 脏 query 静默）
describe("decideBindResult", () => {
  it("无 bind 参数 → none，不清 query", () => {
    expect(decideBindResult("", true)).toEqual({ action: { kind: "none" }, clean: false });
    expect(decideBindResult("?foo=bar", true)).toEqual({
      action: { kind: "none" },
      clean: false,
    });
  });

  it("bind=success + 已登录 → 开 modal，带 username", () => {
    expect(decideBindResult("?bind=success&twitter_username=alice", true)).toEqual({
      action: { kind: "success-open", username: "alice" },
      clean: true,
    });
  });

  it("bind=success + 未登录 → 仅 toast，不开 modal（M1 门控）", () => {
    expect(decideBindResult("?bind=success&twitter_username=alice", false)).toEqual({
      action: { kind: "success-toast-only" },
      clean: true,
    });
  });

  it("bind=success 无 username → username 空串（仅装饰）", () => {
    expect(decideBindResult("?bind=success", true)).toEqual({
      action: { kind: "success-open", username: "" },
      clean: true,
    });
  });

  it("bind=cancelled → cancelled（info 轻提示，无登录门控）", () => {
    expect(decideBindResult("?bind=cancelled", true)).toEqual({
      action: { kind: "cancelled" },
      clean: true,
    });
    expect(decideBindResult("?bind=cancelled", false)).toEqual({
      action: { kind: "cancelled" },
      clean: true,
    });
  });

  it("bind=failed → failed（error toast，无登录门控）", () => {
    expect(decideBindResult("?bind=failed", true)).toEqual({
      action: { kind: "failed" },
      clean: true,
    });
    expect(decideBindResult("?bind=failed", false)).toEqual({
      action: { kind: "failed" },
      clean: true,
    });
  });

  it("bind 非法值（脏 query）→ none 但清掉，不弹任何 toast", () => {
    expect(decideBindResult("?bind=whatever", true)).toEqual({
      action: { kind: "none" },
      clean: true,
    });
    expect(decideBindResult("?bind=whatever", false)).toEqual({
      action: { kind: "none" },
      clean: true,
    });
  });
});
