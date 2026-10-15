import { describe, it, expect } from "vitest";
import { extractPicksBlock, hidePartialPicksBlock } from "./picks";

const VALID_BLOCK = `\`\`\`oddfi-picks
{"picks":[{"market":"1x2","side":"Away","confidence":"high","reason":"客队状态更佳"},{"market":"asian_handicap","side":"Away","confidence":"mid","reason":"受让有价值"},{"market":"asian_total","side":"Under","confidence":"low","reason":"双方进攻乏力"}]}
\`\`\``;

const BODY = `## 📊 Mexico vs South Africa · 快速分析

**实力对比**：墨西哥排名占优。

> ⚠️ 仅供参考，不构成投注建议`;

describe("extractPicksBlock", () => {
  it("解析合法块：剥离协议块 + 返回 3 条 picks", () => {
    const { cleanContent, picks } = extractPicksBlock(`${BODY}\n\n${VALID_BLOCK}`);
    expect(cleanContent).toBe(BODY);
    expect(picks).toHaveLength(3);
    expect(picks![0]).toEqual({
      market: "1x2",
      side: "Away",
      confidence: "high",
      reason: "客队状态更佳",
    });
  });

  it("无块 → 原文返回 + picks=null", () => {
    const { cleanContent, picks } = extractPicksBlock(BODY);
    expect(cleanContent).toBe(BODY);
    expect(picks).toBeNull();
  });

  it("坏 JSON → 块仍被剥离（不闪协议给用户）+ picks=null", () => {
    const broken = `${BODY}\n\n\`\`\`oddfi-picks\n{"picks": [BROKEN\n\`\`\``;
    const { cleanContent, picks } = extractPicksBlock(broken);
    expect(cleanContent).toBe(BODY);
    expect(picks).toBeNull();
  });

  it("缺关闭 fence（流被截断）→ 开头起全部剥离 + 尝试解析", () => {
    const truncated = `${BODY}\n\n\`\`\`oddfi-picks\n{"picks":[{"market":"1x2","side":"Home","confidence":"mid"}]}`;
    const { cleanContent, picks } = extractPicksBlock(truncated);
    expect(cleanContent).toBe(BODY);
    expect(picks).toHaveLength(1);
  });

  it("非法条目整条丢弃（market/side/confidence 校验），全非法 → null", () => {
    const block = `\`\`\`oddfi-picks
{"picks":[{"market":"btts","side":"Yes","confidence":"high"},{"market":"1x2","side":"Over","confidence":"high"},{"market":"asian_total","side":"Over","confidence":"sure"}]}
\`\`\``;
    expect(extractPicksBlock(`${BODY}\n${block}`).picks).toBeNull();
  });

  it("同玩法重复 → 首条生效；超 3 条截断；reason 超长截断", () => {
    const longReason = "字".repeat(80);
    const block = `\`\`\`oddfi-picks
{"picks":[{"market":"1x2","side":"Home","confidence":"high","reason":"${longReason}"},{"market":"1x2","side":"Away","confidence":"low"},{"market":"asian_handicap","side":"1","confidence":"mid"},{"market":"asian_total","side":"Over","confidence":"low"}]}
\`\`\``;
    const { picks } = extractPicksBlock(`${BODY}\n${block}`);
    expect(picks).toHaveLength(3);
    expect(picks![0]!.side).toBe("Home"); // 1x2 首条生效
    expect(picks![0]!.reason).toHaveLength(40);
    expect(picks![1]!.side).toBe("1"); // AH 的 SportMonks 变体 side 放行（派生层归一）
  });
});

describe("REV-v1-A M-2: fence 关闭行首匹配", () => {
  it("reason 内含行内反引号 → 不提前截断，正常解析", () => {
    const block = `\`\`\`oddfi-picks
{"picks":[{"market":"1x2","side":"Home","confidence":"mid","reason":"用\`xG\`占优"}]}
\`\`\``;
    const { cleanContent, picks } = extractPicksBlock(`${BODY}\n\n${block}`);
    expect(cleanContent).toBe(BODY);
    expect(picks).toHaveLength(1);
    expect(picks![0]!.reason).toBe("用`xG`占优");
  });

  it("body 内非行首三反引号 → 跳过，匹配真正的行首关闭 fence（无残块漏出）", () => {
    const block = `\`\`\`oddfi-picks
{"picks":[{"market":"asian_total","side":"Under","confidence":"low","reason":"\`\`\`注入\`\`\`"}]}
\`\`\``;
    const { cleanContent } = extractPicksBlock(`${BODY}\n\n${block}`);
    expect(cleanContent).toBe(BODY);
    expect(cleanContent).not.toContain("picks");
  });
});

describe("hidePartialPicksBlock", () => {
  it("完整 fence 开头出现 → 从开头截断", () => {
    const streaming = `${BODY}\n\n\`\`\`oddfi-picks\n{"picks":[{"mar`;
    expect(hidePartialPicksBlock(streaming)).toBe(BODY);
  });

  it("结尾是 fence 部分前缀 → 裁掉前缀防闪现", () => {
    expect(hidePartialPicksBlock(`${BODY}\n\n\`\`\`oddf`)).toBe(`${BODY}\n\n`);
    expect(hidePartialPicksBlock(`${BODY}\n\`\``)).toBe(`${BODY}\n`);
  });

  it("无关文本原样返回（含正文中的普通代码块）", () => {
    const withCode = "a\n```js\nconst x = 1;\n```\nb";
    expect(hidePartialPicksBlock(withCode)).toBe(withCode);
  });
});
