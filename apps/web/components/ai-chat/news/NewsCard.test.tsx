/**
 * @vitest-environment jsdom
 *
 * DD-122 v2 — NewsCard 像素级还原后测试。
 * 覆盖：4 enrichStatus 状态分支 + avatar/handle 派生 + verified 白名单 + 3-chip 占位 + 推荐卡接线 + 外链。
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NewsCard, authorAvatarFallback, extractHandle, isVerifiedSource } from "./NewsCard";
import type { PushCard } from "@/types/news";
import type { SportmonksFixture } from "@/types/api";

vi.mock("../ChatRecommendationCard", () => ({
  ChatRecommendationCard: ({ matchId }: { matchId: string }) => (
    <div data-testid="rec-card">{matchId}</div>
  ),
}));

function baseCard(overrides: Partial<PushCard> = {}): PushCard {
  return {
    id: "c1",
    ingestedAt: Date.now(),
    createdAt: Date.now() - 60_000,
    enrichStatus: "ok",
    source: "🐦 Fabrizio Romano",
    sourceUrl: "x.com/FabrizioRomano/status/1",
    authorName: "Fabrizio Romano",
    originalText: "BREAKING: Player X signed.",
    aiAnalysis: {
      change: "Transfer confirmed.",
      priceImpact: '<b class="delta-up">+5%</b>',
      probImpact: "",
    },
    ...overrides,
  };
}

describe("NewsCard — enrichStatus 分支", () => {
  it("ok → 渲染 AI 解读区块（mint 标题 + change 文本 + 3 chip 占位）", () => {
    render(<NewsCard card={baseCard({ enrichStatus: "ok" })} />);
    expect(screen.getByText("AI 解读")).toBeTruthy();
    expect(screen.getByText("Transfer confirmed.")).toBeTruthy();
    expect(screen.getByText("阵容")).toBeTruthy();
    expect(screen.getByText("伤病")).toBeTruthy();
    expect(screen.getByText("利好")).toBeTruthy();
  });

  it("pending → 渲染 AI 解读中… chip，不渲染 AI 解读块", () => {
    render(<NewsCard card={baseCard({ enrichStatus: "pending", aiAnalysis: undefined })} />);
    expect(screen.getByText("AI 解读中…")).toBeTruthy();
    expect(screen.queryByText("AI 解读")).toBeNull();
  });

  it("skipped → 渲染 非体育内容 chip", () => {
    render(<NewsCard card={baseCard({ enrichStatus: "skipped", aiAnalysis: undefined })} />);
    expect(screen.getByText("非体育内容，未生成 AI 解读")).toBeTruthy();
    expect(screen.queryByText("AI 解读")).toBeNull();
  });

  it("failed → 渲染 AI 解读失败 chip", () => {
    render(<NewsCard card={baseCard({ enrichStatus: "failed", aiAnalysis: undefined })} />);
    expect(screen.getByText("AI 解读失败")).toBeTruthy();
  });
});

describe("NewsCard — Header 渲染 (DD-122)", () => {
  it("avatar 字母 + displayName + @handle + 相对时间", () => {
    render(
      <NewsCard
        card={baseCard({
          source: "🐦 FabrizioRomano",
          authorName: "Fabrizio Romano",
          sourceUrl: "x.com/FabrizioRomano/status/1",
        })}
      />
    );
    expect(screen.getByText("F")).toBeTruthy();
    expect(screen.getByText("Fabrizio Romano")).toBeTruthy();
    expect(screen.getByText("@FabrizioRomano")).toBeTruthy();
  });

  it("authorName 缺省 → displayName 退化到 source 字符串", () => {
    render(<NewsCard card={baseCard({ authorName: undefined, source: "🐦 lequipe" })} />);
    expect(screen.getByText("🐦 lequipe")).toBeTruthy();
  });

  it("verified 白名单源 → 渲染勾", () => {
    render(<NewsCard card={baseCard({ sourceUrl: "x.com/FabrizioRomano/status/1" })} />);
    expect(screen.getByLabelText("Verified")).toBeTruthy();
  });

  it("非白名单源 → 不渲染勾", () => {
    render(<NewsCard card={baseCard({ sourceUrl: "x.com/RandomDude/status/1" })} />);
    expect(screen.queryByLabelText("Verified")).toBeNull();
  });
});

describe("NewsCard — 外链 (右上 icon)", () => {
  it("有 sourceUrl → 渲染右上外链 icon（自动补 https://）", () => {
    render(<NewsCard card={baseCard({ sourceUrl: "x.com/x/status/1" })} />);
    const link = screen.getByLabelText("Open original tweet");
    expect(link.getAttribute("href")).toBe("https://x.com/x/status/1");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("已含 http(s) 前缀 → 不重复添加", () => {
    render(<NewsCard card={baseCard({ sourceUrl: "https://x.com/x/status/1" })} />);
    expect(screen.getByLabelText("Open original tweet").getAttribute("href")).toBe(
      "https://x.com/x/status/1"
    );
  });

  it("空 sourceUrl → 不渲染外链 icon", () => {
    render(<NewsCard card={baseCard({ sourceUrl: "" })} />);
    expect(screen.queryByLabelText("Open original tweet")).toBeNull();
  });
});

describe("NewsCard — DD-120 推荐卡接线（扫 originalText）", () => {
  const fakeFixture = { id: 777 } as SportmonksFixture;

  it("resolveFixture 命中 → 渲染推荐卡", () => {
    render(
      <NewsCard
        card={baseCard({ originalText: "Arsenal transfer target set for move." })}
        resolveFixture={() => fakeFixture}
      />
    );
    expect(screen.getByTestId("rec-card").textContent).toBe("777");
  });

  it("resolveFixture 未命中 → 不渲染推荐卡", () => {
    render(<NewsCard card={baseCard()} resolveFixture={() => null} />);
    expect(screen.queryByTestId("rec-card")).toBeNull();
  });

  it("无 resolveFixture → 不渲染推荐卡", () => {
    render(<NewsCard card={baseCard()} />);
    expect(screen.queryByTestId("rec-card")).toBeNull();
  });

  it("enrichStatus 非 ok（pending）→ 不渲染推荐卡（即使有 resolver 且命中）", () => {
    render(
      <NewsCard
        card={baseCard({ enrichStatus: "pending", aiAnalysis: undefined })}
        resolveFixture={() => fakeFixture}
      />
    );
    expect(screen.queryByTestId("rec-card")).toBeNull();
  });
});

describe("NewsCard helpers — avatar / handle / verified", () => {
  it("authorAvatarFallback: 跳过 emoji 取首字母大写", () => {
    expect(authorAvatarFallback("🐦 FabrizioRomano").letter).toBe("F");
    expect(authorAvatarFallback("🐦 lequipe").letter).toBe("L");
  });

  it("authorAvatarFallback: 同 source → 同色", () => {
    const a = authorAvatarFallback("🐦 FabrizioRomano");
    const b = authorAvatarFallback("🐦 FabrizioRomano");
    expect(a.bg).toBe(b.bg);
  });

  it("authorAvatarFallback: 空 / 无字母 → '?'", () => {
    expect(authorAvatarFallback("").letter).toBe("?");
    expect(authorAvatarFallback("🐦").letter).toBe("?");
  });

  it("extractHandle: x.com / twitter.com URL → @handle", () => {
    expect(extractHandle("x.com/FabrizioRomano/status/1")).toBe("@FabrizioRomano");
    expect(extractHandle("https://twitter.com/Footballtweet/status/2")).toBe("@Footballtweet");
  });

  it("extractHandle: undefined / 无法解析 → null", () => {
    expect(extractHandle(undefined)).toBeNull();
    expect(extractHandle("https://example.com/foo")).toBeNull();
  });

  it("isVerifiedSource: 白名单大小写忽略匹配", () => {
    expect(isVerifiedSource("@FabrizioRomano")).toBe(true);
    expect(isVerifiedSource("@fabrizioromano")).toBe(true);
    expect(isVerifiedSource("@SkySportsNews")).toBe(true);
    expect(isVerifiedSource("@RandomUser")).toBe(false);
    expect(isVerifiedSource(null)).toBe(false);
  });
});
