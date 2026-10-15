import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { TemplateId } from "@/types/home-banner";
import BannerDetailView from "@/components/banner-detail/BannerDetailView";
import { MARKET_API_BASE } from "@/lib/market-api";

const VALID_CODES = [
  "top_wins_the_world_cup",
  "total_goals",
  "top_golden_ball_name",
  "top_golden_boot_name",
  "top_golden_glove_name",
] as const satisfies readonly TemplateId[];

function isValidBannerCode(code: string): code is TemplateId {
  return (VALID_CODES as readonly string[]).includes(code);
}

// 服务端按 lang 拉 banner list 取 tag_text（如 "热门市场" / "Hot Market"）— 走根 layout 的 "OddFi · %s" template
// 直连后端而非 /api 代理：generateMetadata 在服务端跑，没有 origin 也不能用相对路径
async function fetchBannerTagText(bannerCode: TemplateId, lang: string): Promise<string | null> {
  const baseUrl = MARKET_API_BASE;
  try {
    const res = await fetch(`${baseUrl}/api/v1/market/banners?lang=${encodeURIComponent(lang)}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ template_id: string; tag_text: string }>;
    };
    return json.data?.find((b) => b.template_id === bannerCode)?.tag_text ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; bannerCode: string }>;
}) {
  const { locale, bannerCode } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const bannerName = isValidBannerCode(bannerCode)
    ? await fetchBannerTagText(bannerCode, locale)
    : null;
  return { title: `${t("pages.markets")} - ${bannerName ?? bannerCode}` };
}

export default async function BannerDetailPage({
  params,
}: {
  params: Promise<{ bannerCode: string }>;
}) {
  const { bannerCode } = await params;
  if (!isValidBannerCode(bannerCode)) notFound();
  return <BannerDetailView bannerCode={bannerCode} />;
}
