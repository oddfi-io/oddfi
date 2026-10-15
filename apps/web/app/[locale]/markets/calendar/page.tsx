import { getTranslations } from "next-intl/server";
import CalendarPageClient from "./CalendarPageClient";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: `${t("pages.markets")} · Calendar` };
}

export default function CalendarPage() {
  return <CalendarPageClient />;
}
