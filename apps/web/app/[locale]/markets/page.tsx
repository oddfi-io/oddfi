import { getTranslations } from "next-intl/server";
import MarketsPageWrapper from "./MarketsPageWrapper";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("pages.markets") };
}

export default function MarketsPage() {
  return <MarketsPageWrapper />;
}
