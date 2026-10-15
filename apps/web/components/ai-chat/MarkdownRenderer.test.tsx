// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer · XSS sanitize (DD-107 §3.5)", () => {
  it("strips <script> tags in LLM output", () => {
    const evil = `## Analysis\n<script>window.__pwned__ = 1</script>\nGo team!`;
    const { container } = render(<MarkdownRenderer content={evil} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("window.__pwned__");
  });

  it("strips <img onerror=…>", () => {
    const evil = `Check this:\n<img src=x onerror="window.__pwned__=1">`;
    const { container } = render(<MarkdownRenderer content={evil} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("strips <iframe>", () => {
    const evil = `<iframe src="https://attacker.example/track"></iframe>`;
    const { container } = render(<MarkdownRenderer content={evil} />);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("strips <a href='javascript:...'> links", () => {
    const evil = `Click [here](javascript:alert(1)) to win.`;
    const { container } = render(<MarkdownRenderer content={evil} />);
    const a = container.querySelector("a");
    if (a) {
      // Allowlist removes <a> entirely; if test env keeps it, href must not be javascript:
      expect(a.getAttribute("href")?.toLowerCase().startsWith("javascript:")).toBe(false);
    }
  });

  it("strips <a> tag entirely (allowlist excludes anchors)", () => {
    const evil = `Visit [our docs](https://docs.example.com).`;
    const { container } = render(<MarkdownRenderer content={evil} />);
    expect(container.querySelector("a")).toBeNull();
  });

  it("preserves allowed semantic tags (h2/strong/ul/blockquote)", () => {
    const safe = `## Match Analysis\n\n**Strong text**\n\n- bullet 1\n- bullet 2\n\n> Notice block`;
    const { container } = render(<MarkdownRenderer content={safe} />);
    expect(container.querySelector("h2")?.textContent).toContain("Match Analysis");
    expect(container.querySelector("strong")?.textContent).toBe("Strong text");
    expect(container.querySelectorAll("li").length).toBe(2);
    expect(container.querySelector("blockquote")).not.toBeNull();
  });

  it("renders DD-107 §3.1 Layer 3 output format end-to-end", () => {
    const llmOutput = `## 📊 Arsenal vs PSG · 快速分析

**实力对比**：双方近况均强势

**关键看点**
- 看点 1
- 看点 2
- 看点 3

**比分倾向**：1–2 球差

> ⚠️ 仅供参考，不构成投注建议`;
    const { container } = render(<MarkdownRenderer content={llmOutput} />);
    expect(container.textContent).toContain("Arsenal vs PSG");
    expect(container.textContent).toContain("仅供参考");
    expect(container.querySelector("blockquote")).not.toBeNull();
  });
});
