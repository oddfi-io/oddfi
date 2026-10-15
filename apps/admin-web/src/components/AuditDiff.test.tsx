// Tests for AuditDiff component.
// 契约：docs/spa-presale-admin/04-components.md §4。
// AntD ConfigProvider 必须包裹才能使用 theme.useToken()。
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfigProvider } from "antd";
import { vercelTheme } from "@/theme/vercelTheme";
import { AuditDiff } from "./AuditDiff";
import type { AuditDiffProps } from "./AuditDiff";

// ── Helper ─────────────────────────────────────────────────────────────────────

function renderDiff(props: AuditDiffProps) {
  return render(
    <ConfigProvider theme={vercelTheme}>
      <AuditDiff {...props} />
    </ConfigProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("AuditDiff — null / empty inputs", () => {
  it("renders '无变更' when both before and after are null", () => {
    renderDiff({ before: null, after: null });
    expect(screen.getByText("无变更")).toBeInTheDocument();
  });

  it("renders '无变更' when both before and after are undefined (cast as null)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderDiff({ before: null as any, after: null as any });
    expect(screen.getByText("无变更")).toBeInTheDocument();
  });
});

describe("AuditDiff — value change on existing field", () => {
  it("renders both old and new value when field value changes", () => {
    renderDiff({ before: { a: 1 }, after: { a: 2 } });
    // Both values must appear in the document
    expect(screen.getByText(/\b1\b/)).toBeInTheDocument();
    expect(screen.getByText(/\b2\b/)).toBeInTheDocument();
  });

  it("renders field key 'a' in the diff table", () => {
    renderDiff({ before: { a: 1 }, after: { a: 2 } });
    // key should appear as a label
    expect(screen.getAllByText(/\ba\b/).length).toBeGreaterThan(0);
  });

  it("shows 变更 tag when field value is different", () => {
    renderDiff({ before: { price: "100" }, after: { price: "200" } });
    expect(screen.getByText("变更")).toBeInTheDocument();
  });

  it("does NOT show 变更 tag when field value is identical", () => {
    renderDiff({ before: { status: "active" }, after: { status: "active" } });
    expect(screen.queryByText("变更")).not.toBeInTheDocument();
  });
});

describe("AuditDiff — before is null, after is full object (first-time creation audit)", () => {
  it("renders every after-key as added when before is null", () => {
    renderDiff({ before: null, after: { vault: "0xabc", min: "0.01" } });
    expect(screen.getByText("vault")).toBeInTheDocument();
    expect(screen.getByText("min")).toBeInTheDocument();
    // Both keys should show 变更 tag (all are added)
    expect(screen.getAllByText("变更")).toHaveLength(2);
  });
});

describe("AuditDiff — added field (after has extra key)", () => {
  it("renders new field key when after has an extra key", () => {
    renderDiff({ before: { a: 1 }, after: { a: 1, b: 2 } });
    // field 'b' must appear
    expect(screen.getAllByText(/\bb\b/).length).toBeGreaterThan(0);
    // new value must appear
    expect(screen.getByText(/\b2\b/)).toBeInTheDocument();
  });

  it("shows 变更 tag for the added field", () => {
    renderDiff({ before: { a: 1 }, after: { a: 1, newField: "hello" } });
    expect(screen.getByText("变更")).toBeInTheDocument();
  });
});

describe("AuditDiff — removed field (before has extra key)", () => {
  it("renders removed field key when before has an extra key", () => {
    renderDiff({ before: { a: 1, old: "gone" }, after: { a: 1 } });
    expect(screen.getAllByText(/\bold\b/).length).toBeGreaterThan(0);
  });

  it("shows 变更 tag for removed field", () => {
    renderDiff({ before: { a: 1, removed: "x" }, after: { a: 1 } });
    expect(screen.getByText("变更")).toBeInTheDocument();
  });
});

describe("AuditDiff — string inputs (already-serialised JSON)", () => {
  it("parses JSON string input and renders field values", () => {
    renderDiff({
      before: JSON.stringify({ status: "paused" }),
      after: JSON.stringify({ status: "active" }),
    });
    expect(screen.getByText(/paused/)).toBeInTheDocument();
    expect(screen.getByText(/active/)).toBeInTheDocument();
  });

  it("falls back gracefully for malformed JSON string — renders as raw value", () => {
    // Malformed string should not throw; renders without crashing
    const { container } = renderDiff({
      before: "not valid json {{{",
      after: null,
    });
    expect(container.firstChild).not.toBeNull();
  });

  it("does NOT use dangerouslySetInnerHTML anywhere in the output", () => {
    const { container } = renderDiff({
      before: { msg: '<script>alert("xss")</script>' },
      after: { msg: "safe" },
    });
    // The script tag must NOT appear as executable HTML — it should be text-encoded
    const scriptTags = container.querySelectorAll("script");
    expect(scriptTags.length).toBe(0);
    // The raw string content should appear as escaped text, not as a script element
    expect(container.innerHTML).not.toContain("<script>alert");
  });
});

describe("AuditDiff — both sides are non-null objects", () => {
  it("renders all changed fields from a config-like object", () => {
    const before = { tgeTs: 1000, minSubscribeUsd: "1000", auditLabel: "v1" };
    const after = { tgeTs: 1000, minSubscribeUsd: "500", auditLabel: "v2" };
    renderDiff({ before, after });

    // Changed fields
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/v2/)).toBeInTheDocument();
    // Unchanged field should NOT have 変更 badge — check count matches changed fields only
    const changeTags = screen.getAllByText("变更");
    // minSubscribeUsd + auditLabel changed = 2 tags
    expect(changeTags.length).toBe(2);
  });

  it("renders '→' arrow between before and after cells", () => {
    renderDiff({ before: { x: 1 }, after: { x: 2 } });
    expect(screen.getByText("→")).toBeInTheDocument();
  });
});
