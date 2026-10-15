"use client";

/**
 * DD-107 §3.5：AI 消息 Markdown 安全渲染。
 *
 * 红线（R3 Critical · XSS 防御）：
 * - ❌ 禁止 dangerouslySetInnerHTML
 * - ❌ 禁止允许 <a> 标签（LLM 输出 [text](javascript:...) 风险）
 * - ❌ 禁止 <img>/<iframe>/<script>/<form>/<style>
 * - ✅ 仅 allowlist 中的语义标签
 */
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { useMemo } from "react";

const schema: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [
    "p",
    "strong",
    "em",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "h2",
    "h3",
    "br",
    "hr",
  ],
  attributes: {
    "*": ["className"],
  },
  protocols: {},
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // stable reference avoids react-markdown rebuilding the rehype processor on every render
  const rehypePlugins = useMemo(
    () => [[rehypeSanitize, schema]] as React.ComponentProps<typeof ReactMarkdown>["rehypePlugins"],
    []
  );

  return (
    <div className={`markdown-body text-[12px] leading-[18px] ${className ?? ""}`}>
      <ReactMarkdown rehypePlugins={rehypePlugins}>{content}</ReactMarkdown>
    </div>
  );
}
