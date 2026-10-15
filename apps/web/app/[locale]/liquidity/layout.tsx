import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("pages.pools") };
}

export default function LiquidityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
