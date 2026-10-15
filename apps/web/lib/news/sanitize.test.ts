import { describe, expect, it } from "vitest";
import { sanitizeDeltaHtml } from "./sanitize";

describe("sanitizeDeltaHtml — 正例（保留）", () => {
  it("纯文本", () => {
    expect(sanitizeDeltaHtml("±1.2%")).toBe("±1.2%");
  });

  it("单个 delta-up", () => {
    expect(sanitizeDeltaHtml('<b class="delta-up">+5%</b>')).toBe('<b class="delta-up">+5%</b>');
  });

  it("单个 delta-down", () => {
    expect(sanitizeDeltaHtml('<b class="delta-down">-3.5%</b>')).toBe(
      '<b class="delta-down">-3.5%</b>'
    );
  });

  it("混合文本 + delta", () => {
    expect(sanitizeDeltaHtml('Win prob <b class="delta-up">+2%</b> after news')).toBe(
      'Win prob <b class="delta-up">+2%</b> after news'
    );
  });

  it("多个 delta 串接", () => {
    expect(sanitizeDeltaHtml('<b class="delta-up">+1%</b> / <b class="delta-down">-2%</b>')).toBe(
      '<b class="delta-up">+1%</b> / <b class="delta-down">-2%</b>'
    );
  });
});

describe("sanitizeDeltaHtml — 负例（全剥）", () => {
  it("非允许标签 <script>", () => {
    expect(sanitizeDeltaHtml("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("HTML entity 注入 &lt;script&gt;", () => {
    // 关键 case：禁 & 后整体不匹配 → 走全剥分支
    // &lt;script&gt;alert(1)&lt;/script&gt; → 剥光 entity → "scriptalert(1)/script"
    expect(sanitizeDeltaHtml("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe(
      "scriptalert(1)/script"
    );
  });

  it("任意 class 不允许", () => {
    expect(sanitizeDeltaHtml('<b class="evil">x</b>')).toBe("x");
  });

  it("nested 标签", () => {
    expect(sanitizeDeltaHtml('<b class="delta-up"><script>x</script></b>')).toBe("x");
  });

  it("带属性的 a 标签", () => {
    expect(sanitizeDeltaHtml('<a href="javascript:alert(1)" class="delta-up">click</a>')).toBe(
      "click"
    );
  });

  it("&amp; 单独出现也走全剥（禁 & 严格语义）", () => {
    expect(sanitizeDeltaHtml("A &amp; B")).toBe("A  B");
  });

  it("超长字符串直接返回空", () => {
    expect(sanitizeDeltaHtml("a".repeat(2001))).toBe("");
  });

  it("非字符串输入", () => {
    expect(sanitizeDeltaHtml(null as unknown as string)).toBe("");
    expect(sanitizeDeltaHtml(undefined as unknown as string)).toBe("");
    expect(sanitizeDeltaHtml(123 as unknown as string)).toBe("");
  });

  it("空字符串", () => {
    expect(sanitizeDeltaHtml("")).toBe("");
  });
});
