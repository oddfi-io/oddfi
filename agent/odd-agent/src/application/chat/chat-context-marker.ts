import { z } from "zod";

export type ChatSessionContext = {
  readonly intent?: "match-analysis";
  readonly matchId?: string;
  readonly persona?: "rational" | "companion" | "aggressive" | "strict";
  readonly risk?: number;
};

export type ParsedChatMessage = {
  readonly context: ChatSessionContext | undefined;
  readonly message: string;
};

// 每个字段独立 zod 校验：单个字段非法只丢弃该字段，不影响其他字段，也不让整条消息报错。
// 值全部限制为枚举 / 数字串 / 0-10 整数，保证插值进 system prompt 的内容天然无注入面。
const intentSchema = z.literal("match-analysis");
const matchIdSchema = z.string().regex(/^\d{1,20}$/);
const personaSchema = z.enum(["rational", "companion", "aggressive", "strict"]);
const riskSchema = z.coerce.number().int().min(0).max(10);

// 标记必须出现在 message 最开头的一对方括号内，且不允许跨行；后面可跟换行或空白。
const markerPattern = /^\[([^\]\n]+)\]\s*/;

/**
 * 调用流程：解析前端塞在 message 开头的上下文标记 `[intent=... match_id=... persona=... risk=...]`。
 * 入参：POST /api/chat 的原始 message 字段。
 * 出参：schema 校验通过的 context（无有效字段时为 undefined）+ 剥离标记后的纯用户输入。
 *
 * 实现方式：先用正则截取首个方括号块，再按空白拆 key=value 对逐字段 zod 校验；
 * 容错规则——无标记 / 块内不是 key=value 形态 / 全部字段非法 / 剥离后为空消息，都按
 * 普通对话处理返回原文，绝不报错（跨团队 handoff 约定）。
 */
export const parseChatContextMarker = (message: string): ParsedChatMessage => {
  const fallback: ParsedChatMessage = { context: undefined, message };
  const matched = markerPattern.exec(message);
  if (matched === null || matched[1] === undefined) {
    return fallback;
  }

  // 块内必须全部是 key=value 形态才视为上下文标记；避免误剥离用户正常输入的方括号文本。
  const tokens = matched[1].trim().split(/\s+/);
  const pairs: [string, string][] = [];
  for (const token of tokens) {
    const separatorIndex = token.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
      return fallback;
    }
    pairs.push([token.slice(0, separatorIndex), token.slice(separatorIndex + 1)]);
  }

  // 逐字段独立校验：已知 key 校验失败丢弃该字段，未知 key 直接忽略（向前兼容新增字段）。
  const context: {
    intent?: "match-analysis";
    matchId?: string;
    persona?: "rational" | "companion" | "aggressive" | "strict";
    risk?: number;
  } = {};
  for (const [key, value] of pairs) {
    if (key === "intent") {
      const parsed = intentSchema.safeParse(value);
      if (parsed.success) context.intent = parsed.data;
      continue;
    }
    if (key === "match_id") {
      const parsed = matchIdSchema.safeParse(value);
      if (parsed.success) context.matchId = parsed.data;
      continue;
    }
    if (key === "persona") {
      const parsed = personaSchema.safeParse(value);
      if (parsed.success) context.persona = parsed.data;
      continue;
    }
    if (key === "risk") {
      const parsed = riskSchema.safeParse(value);
      if (parsed.success) context.risk = parsed.data;
    }
  }

  // 没有任何有效字段，或剥离后用户输入为空，都退回普通对话，保留原始 message。
  const cleanMessage = message.slice(matched[0].length);
  if (Object.keys(context).length === 0 || cleanMessage.trim().length === 0) {
    return fallback;
  }
  return { context, message: cleanMessage };
};

/**
 * 调用流程：把校验后的 session context 渲染进 prompts/chat-agent.context.v1.md 模板。
 * 入参：模板原文和 parseChatContextMarker 输出的 context。
 * 出参：可直接 append 到 system 消息尾部的上下文段落。
 *
 * 实现方式：按字段生成中文说明行替换 {{context_lines}} 占位符；所有插值都来自
 * 枚举 / 数字串等 schema 校验过的安全字段，满足「system 消息禁止拼接未校验文本」红线。
 */
export const renderChatContextPrompt = (template: string, context: ChatSessionContext): string => {
  const lines: string[] = [];
  if (context.intent === "match-analysis") {
    lines.push(
      context.matchId === undefined
        ? "- 意图：赛事分析（请结合可用工具获取赛事数据）"
        : `- 意图：赛事分析（match_id=${context.matchId}，请调用赛事数据）`
    );
  } else if (context.matchId !== undefined) {
    // 只带 match_id 不带 intent 时也单独成行，避免字段被静默吞掉、模板渲染出空上下文块。
    lines.push(`- 关联赛事：match_id=${context.matchId}`);
  }
  if (context.persona !== undefined) {
    lines.push(`- 用户性格：${context.persona}`);
  }
  if (context.risk !== undefined) {
    lines.push(`- 风险偏好：${context.risk}/10`);
  }
  return template.replace("{{context_lines}}", lines.join("\n"));
};
