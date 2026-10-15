import { describe, expect, it } from "vitest";
import { parseChatContextMarker, renderChatContextPrompt } from "./chat-context-marker.js";

const TEMPLATE = "<session_context>\n{{context_lines}}\n</session_context>";

describe("parseChatContextMarker", () => {
  it("parses a full marker and strips it from the message", () => {
    const parsed = parseChatContextMarker(
      "[intent=match-analysis match_id=66923 persona=aggressive risk=8]\n分析这场比赛"
    );
    expect(parsed.context).toEqual({
      intent: "match-analysis",
      matchId: "66923",
      persona: "aggressive",
      risk: 8
    });
    expect(parsed.message).toBe("分析这场比赛");
  });

  it("parses partial fields and ignores unknown keys", () => {
    const parsed = parseChatContextMarker("[persona=rational foo=bar]\n今晚怎么看？");
    expect(parsed.context).toEqual({ persona: "rational" });
    expect(parsed.message).toBe("今晚怎么看？");
  });

  it("drops invalid field values but keeps valid ones", () => {
    // persona 非枚举、risk 超界、match_id 含注入字符都必须被丢弃，仅保留合法 intent。
    const parsed = parseChatContextMarker(
      "[intent=match-analysis persona=<hacker> risk=99 match_id=12<script>]\n分析比赛"
    );
    expect(parsed.context).toEqual({ intent: "match-analysis" });
    expect(parsed.message).toBe("分析比赛");
  });

  it("treats plain messages without marker as normal conversation", () => {
    const parsed = parseChatContextMarker("今晚足球比赛怎么分析？");
    expect(parsed.context).toBeUndefined();
    expect(parsed.message).toBe("今晚足球比赛怎么分析？");
  });

  it("keeps the original message when bracket block is not key=value pairs", () => {
    // 用户正常输入的方括号文本（非 key=value）不能被误剥离。
    const original = "[重要] 帮我看看这场比赛";
    const parsed = parseChatContextMarker(original);
    expect(parsed.context).toBeUndefined();
    expect(parsed.message).toBe(original);
  });

  it("handles CRLF, fullwidth spaces, and duplicate keys deterministically", () => {
    // CRLF：\s* 覆盖 \r\n，标记照常剥离。
    const crlf = parseChatContextMarker("[persona=rational]\r\n分析比赛");
    expect(crlf.context).toEqual({ persona: "rational" });
    expect(crlf.message).toBe("分析比赛");

    // 全角空格 U+3000 属于 \s，token 拆分正常。
    const fullwidth = parseChatContextMarker("[persona=rational　risk=3]\n分析比赛");
    expect(fullwidth.context).toEqual({ persona: "rational", risk: 3 });

    // 重复 key 取最后一个（last-wins），行为固定避免前端误解。
    const duplicated = parseChatContextMarker("[persona=rational persona=strict]\n分析比赛");
    expect(duplicated.context).toEqual({ persona: "strict" });
  });

  it("falls back when all fields are invalid or message becomes empty", () => {
    const allInvalid = parseChatContextMarker("[intent=hack risk=banana]\n分析比赛");
    expect(allInvalid.context).toBeUndefined();
    expect(allInvalid.message).toBe("[intent=hack risk=banana]\n分析比赛");

    const emptyRest = parseChatContextMarker("[persona=rational]\n   ");
    expect(emptyRest.context).toBeUndefined();
    expect(emptyRest.message).toBe("[persona=rational]\n   ");
  });
});

describe("renderChatContextPrompt", () => {
  it("renders all validated fields into template lines", () => {
    const rendered = renderChatContextPrompt(TEMPLATE, {
      intent: "match-analysis",
      matchId: "66923",
      persona: "aggressive",
      risk: 8
    });
    expect(rendered).toContain("match_id=66923");
    expect(rendered).toContain("用户性格：aggressive");
    expect(rendered).toContain("风险偏好：8/10");
    expect(rendered).not.toContain("{{context_lines}}");
  });

  it("renders intent without match_id using the tool-driven fallback line", () => {
    const rendered = renderChatContextPrompt(TEMPLATE, { intent: "match-analysis" });
    expect(rendered).toContain("意图：赛事分析");
    expect(rendered).not.toContain("match_id=");
  });

  it("renders a standalone match line when match_id arrives without intent", () => {
    // 只有 match_id 时也不能渲染空上下文块，必须单独成行。
    const rendered = renderChatContextPrompt(TEMPLATE, { matchId: "66923" });
    expect(rendered).toContain("关联赛事：match_id=66923");
  });
});
