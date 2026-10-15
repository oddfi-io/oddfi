"use client";

/**
 * DD-122 v2 — NewsCard 按 Figma 7232:113081 像素级还原。
 *
 * 结构：
 *   ① Header: avatar(首字母 fallback) + name(+verified 白名单) + @handle · time + 右上外链
 *   ② originalText 推文正文
 *   ③ AI 解读块（mint 0.5px border + rounded 16）：Union icon + 渐变标题 + change + 3 chip
 *   ④ 内嵌赔率卡（命中 fixture 时）
 *
 * V1 占位：
 *   - verified 走本地白名单（推特 push card 无 verified 字段）
 *   - 3 个 tag chip (阵容/伤病/利好) 硬编码（无 aiTags 字段）
 *   - 设计稿不显示 title / match / suggest / priceImpact / probImpact / tag chip → 本组件不渲染
 */
import { useEffect, useState } from "react";
import { ArrowUpRightIcon, SealCheckIcon, SparkleIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { formatRelativeTimeMs } from "@/lib/news/relative-time-ms";
import type { PushCard } from "@/types/news";
import type { SportmonksFixture } from "@/types/api";
import { ChatRecommendationCard } from "../ChatRecommendationCard";

interface NewsCardProps {
  card: PushCard;
  /**
   * DD-120：扫新闻英文文本命中我方赛事（WC/欧冠）。命中 → 卡内嵌推荐下注卡。
   * 由 NewsPanel 用英文 fixtures 构建（locale 稳定匹配）；缺省（如单测）则不渲染推荐卡。
   */
  resolveFixture?: (text: string) => SportmonksFixture | null;
}

/** DD-122 V1：verified 白名单（推特 push card 无 verified 字段，靠源 handle 命中判断） */
const VERIFIED_HANDLES = new Set([
  "fabrizioromano",
  "skysportsnews",
  "lequipe",
  "whoscored",
  "fourfourtwo",
  "deadlinedaylive",
  "touchlinex",
  "footballtweet",
]);

/** DD-122 V1：AI 解读 3 chip 硬编码占位，等后端 aiTags 字段后接 */
const PLACEHOLDER_AI_TAGS = [
  { emoji: "⭐", label: "阵容", textCls: "text-fn-yellow", bgCls: "bg-tag-gray" },
  { emoji: "🤕", label: "伤病", textCls: "text-orange", bgCls: "bg-tag-orange" },
  { emoji: "🟢", label: "利好", textCls: "text-green", bgCls: "bg-tag-green" },
] as const;

export function NewsCard({ card, resolveFixture }: NewsCardProps) {
  const matchedFixture =
    card.enrichStatus === "ok" && card.originalText && resolveFixture
      ? resolveFixture(card.originalText)
      : null;
  // 30s ttl 刷新「N 分钟前」（前端按 createdAt 自算，不用 deprecated `time` 字段）
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const relative = formatRelativeTimeMs(card.createdAt, now);
  const avatar = authorAvatarFallback(card.source);
  const handle = extractHandle(card.sourceUrl);
  const displayName = card.authorName || card.source;
  const verified = isVerifiedSource(handle);

  return (
    <div
      // @figma-hardcoded: #212124 line/border-secondary — pending design token (NewsCard 外框)
      className="flex flex-col gap-4 rounded-2xl border border-[#212124] bg-secondary p-4"
    >
      {/* ① Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-static-black",
                avatar.bg
              )}
              aria-hidden
            >
              {avatar.letter}
            </div>
            <div className="flex min-w-0 flex-col justify-center">
              <div className="flex items-center gap-[5px]">
                <span className="truncate text-[14px] font-medium leading-[18px] text-primary">
                  {displayName}
                </span>
                {verified && (
                  <SealCheckIcon
                    size={14}
                    weight="fill"
                    // @figma-hardcoded: #4C9EEB blue-active verified-tick — pending design token
                    className="shrink-0 text-[#4C9EEB]"
                    aria-label="Verified"
                  />
                )}
              </div>
              <div className="flex min-w-0 items-center gap-[4px] text-[12px] leading-[18px] text-secondary">
                {handle && <span className="truncate">{handle}</span>}
                {handle && <span aria-hidden>·</span>}
                <span className="shrink-0">{relative}</span>
              </div>
            </div>
          </div>
          {card.sourceUrl && (
            <a
              href={
                card.sourceUrl.startsWith("http") ? card.sourceUrl : `https://${card.sourceUrl}`
              }
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open original tweet"
              className="shrink-0 text-tertiary transition hover:text-brand-default"
            >
              <ArrowUpRightIcon size={20} weight="bold" />
            </a>
          )}
        </div>

        {/* ② 原推文本 */}
        <p className="whitespace-pre-wrap break-words text-[14px] leading-[20px] text-primary">
          {card.originalText}
        </p>
      </div>

      {/* ③ AI 解读块（mint 0.5px border + rounded 16） */}
      {card.enrichStatus === "ok" && card.aiAnalysis && (
        <div
          // @figma-hardcoded: rgba(74,231,221,0.5) mint border — Figma 0.5px 视觉，用半透明色降权使其更细 — pending design token
          className="flex flex-col gap-2 rounded-2xl border-[0.5px] border-[rgba(74,231,221,0.5)] px-3 py-2"
        >
          <div className="flex items-center gap-1">
            <SparkleIcon
              size={12}
              weight="fill"
              // @figma-hardcoded: #4ae7dd — pending token
              className="text-[#4ae7dd]"
            />
            <span
              className="bg-clip-text text-[12px] leading-[18px] text-transparent"
              // @figma-hardcoded: linear-gradient(144.169deg, #4ae7dd 42%, #eaea32 92%) ai-title — pending token
              style={{
                backgroundImage: "linear-gradient(144.169deg, #4ae7dd 42.267%, #eaea32 91.863%)",
              }}
            >
              AI 解读
            </span>
          </div>
          {card.aiAnalysis.change && (
            <p className="break-words text-[12px] leading-[18px] text-primary">
              {card.aiAnalysis.change}
            </p>
          )}
          {/* DD-122 V1 占位：3 chip 硬编码，等后端 aiTags 字段 */}
          <div className="flex flex-wrap gap-1">
            {PLACEHOLDER_AI_TAGS.map((tag) => (
              <span
                key={tag.label}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium leading-4",
                  tag.bgCls
                )}
              >
                <span className="text-brand-default" aria-hidden>
                  {tag.emoji}
                </span>
                <span className={tag.textCls}>{tag.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* enrich 非 ok 状态降级 chip（保持原 UI 反馈） */}
      {card.enrichStatus === "pending" && (
        <StatusChip className="bg-tag-gray text-secondary" label="AI 解读中…" />
      )}
      {card.enrichStatus === "skipped" && (
        <StatusChip className="bg-tag-gray text-tertiary" label="非体育内容，未生成 AI 解读" />
      )}
      {card.enrichStatus === "failed" && (
        <StatusChip className="bg-tag-red text-red" label="AI 解读失败" />
      )}

      {/* ④ 命中 WC/欧冠赛事 → 内嵌推荐下注卡 */}
      {matchedFixture && <ChatRecommendationCard matchId={String(matchedFixture.id)} />}
    </div>
  );
}

function StatusChip({ className, label }: { className: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] leading-[14px]",
        className
      )}
    >
      {label}
    </span>
  );
}

// DD-122 helpers ────────────────────────────────────────────────────────

/**
 * source 字符串首字母 + 6 色循环背景。
 * "🐦 FabrizioRomano" → { letter: "F", bg: "bg-fn-brand" }
 * 推特数据无 authorAvatar 字段，V1 用此 fallback 占位。
 */
export function authorAvatarFallback(source: string): { letter: string; bg: string } {
  const handle = source.replace(/^[^a-zA-Z]*/, "");
  const letter = (handle[0] ?? "?").toUpperCase();
  const palette = [
    "bg-fn-brand",
    "bg-fn-yellow",
    "bg-fn-orange",
    "bg-tag-red",
    "bg-tag-brand",
    "bg-fn-green",
  ];
  const sum = [...source].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return { letter, bg: palette[sum % palette.length] };
}

/** "x.com/FabrizioRomano/status/..." → "@FabrizioRomano" */
export function extractHandle(sourceUrl: string | undefined): string | null {
  if (!sourceUrl) return null;
  const m = sourceUrl.match(/x\.com\/([^/]+)\//i) ?? sourceUrl.match(/twitter\.com\/([^/]+)\//i);
  return m ? `@${m[1]}` : null;
}

/** DD-122 V1 verified 白名单判定：handle 去掉 @ 大小写忽略匹配 */
export function isVerifiedSource(handle: string | null): boolean {
  if (!handle) return false;
  return VERIFIED_HANDLES.has(handle.replace(/^@/, "").toLowerCase());
}
