import { describe, it, expect } from "vitest";
import { decideReferralEntry, normalizeReferralCode, isValidReferralCode } from "./referral-entry";

// DD-119 #3 邀请码入口决策：他人码→预填 / 自己码·无码→弹引导 / 已绑→不动
// 码格式对齐后端：0x + 6 位大写 Base32（charset 23456789ABCDEFGHJKLMNPQRSTUVWXYZ）
describe("decideReferralEntry", () => {
  const OTHER = "0x3YCBK8"; // 真实后端码样例
  const MINE = "0xMVEKMP";

  it("已绑推荐人 → bound（无视 url / myCode）", () => {
    expect(decideReferralEntry({ urlRef: OTHER, myCode: MINE, hasReferrer: true })).toEqual({
      kind: "bound",
    });
    expect(decideReferralEntry({ urlRef: null, myCode: null, hasReferrer: true })).toEqual({
      kind: "bound",
    });
  });

  it("URL 带他人有效码 + 未绑 → prefill（归一后的码）", () => {
    expect(decideReferralEntry({ urlRef: OTHER, myCode: MINE, hasReferrer: false })).toEqual({
      kind: "prefill",
      code: OTHER,
    });
  });

  it("URL 带他人码大小写/空格 → prefill 用归一值（大写码体）", () => {
    expect(
      decideReferralEntry({ urlRef: "  0x3ycbk8 ", myCode: MINE, hasReferrer: false })
    ).toEqual({ kind: "prefill", code: OTHER });
  });

  // 覆盖函数内部语义：myCode=null 视为他人码。生产中 InvestContent effect 会在 myCode
  // 未就绪时 early-return 等轮询，不会以 null 调用本函数；此 case 守护函数契约不被误改。
  it("新用户（myCode 尚未生成）+ URL 他人码 → prefill", () => {
    expect(decideReferralEntry({ urlRef: OTHER, myCode: null, hasReferrer: false })).toEqual({
      kind: "prefill",
      code: OTHER,
    });
  });

  it("自己的链接（ref == myCode，大小写无关）→ modal", () => {
    expect(decideReferralEntry({ urlRef: "0xmvekmp", myCode: MINE, hasReferrer: false })).toEqual({
      kind: "modal",
    });
  });

  it("无邀请码链接 → modal", () => {
    expect(decideReferralEntry({ urlRef: null, myCode: MINE, hasReferrer: false })).toEqual({
      kind: "modal",
    });
    expect(decideReferralEntry({ urlRef: "", myCode: MINE, hasReferrer: false })).toEqual({
      kind: "modal",
    });
  });

  it("URL ref 格式非法 → modal（不预填垃圾）", () => {
    expect(decideReferralEntry({ urlRef: "not-a-code", myCode: MINE, hasReferrer: false })).toEqual(
      { kind: "modal" }
    );
    // 含被排除字符（0/1/I/O）也算非法
    expect(decideReferralEntry({ urlRef: "0xABCDE1", myCode: MINE, hasReferrer: false })).toEqual({
      kind: "modal",
    });
  });
});

describe("normalizeReferralCode / isValidReferralCode", () => {
  it("归一：trim + 码体大写，0x 前缀保持小写", () => {
    expect(normalizeReferralCode("  0x3ycbk8 ")).toBe("0x3YCBK8");
    expect(normalizeReferralCode("0xMVEKMP")).toBe("0xMVEKMP");
  });

  it("校验：0x + 6 位 Base32（charset 内）通过", () => {
    expect(isValidReferralCode("0x3YCBK8")).toBe(true);
    expect(isValidReferralCode("0xMVEKMP")).toBe(true);
  });

  it("校验：长度≠6 / 缺 0x / 含排除字符(0/1/I/O) / 小写未归一 → 拒绝", () => {
    expect(isValidReferralCode("0x3YCB")).toBe(false); // 5 位
    expect(isValidReferralCode("0x3YCBK89")).toBe(false); // 7 位
    expect(isValidReferralCode("3YCBK8")).toBe(false); // 缺 0x
    expect(isValidReferralCode("0xABCDE1")).toBe(false); // 含 1
    expect(isValidReferralCode("0xABCDEI")).toBe(false); // 含 I
    expect(isValidReferralCode("0xABCDEO")).toBe(false); // 含 O
    expect(isValidReferralCode("0x3ycbk8")).toBe(false); // 小写（须先 normalize）
  });
});
